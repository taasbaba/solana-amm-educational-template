import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SolanaService } from '../solana/solana.service';
import { MemoryCacheService } from '../cache/memory-cache.service';
import { SupabaseService } from '../database/supabase.service';
import { PoolWatcher } from '../solana/watchers/pool.watcher';
import { UsersService } from '../users/users.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
  isNewUser?: boolean;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AppGateway.name);
  private connectedClients = new Map<string, AuthenticatedSocket>();

  constructor(
    private solanaService: SolanaService,
    private cacheService: MemoryCacheService,
    private supabaseService: SupabaseService,
    private poolWatcher: PoolWatcher,
    private usersService: UsersService,
  ) {
    this.logger.debug('AppGateway constructor initialized with all services');
  }

  // Handle client connection with JWT authentication - MINIMAL VERSION
  async handleConnection(client: AuthenticatedSocket) {
    this.logger.debug(`New connection attempt from client: ${client.id}`);
    this.logger.debug(
      `Client handshake auth exists: ${!!client.handshake.auth}`,
    );

    try {
      const token = client.handshake.auth?.token;
      this.logger.debug(`Token received from client ${client.id}: ${!!token}`);
      this.logger.debug(`Token length: ${token?.length || 0}`);

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        this.logger.debug(
          `Disconnecting client ${client.id} due to missing token`,
        );
        client.disconnect();
        return;
      }

      this.logger.debug(`Attempting JWT verification for client: ${client.id}`);
      // Verify JWT token
      const user = this.supabaseService.verifyUser(token);
      this.logger.debug(
        `JWT verification result for client ${client.id}: ${!!user}`,
      );

      if (!user) {
        this.logger.warn(`Client ${client.id} has invalid token`);
        this.logger.debug(
          `Disconnecting client ${client.id} due to invalid token`,
        );
        client.disconnect();
        return;
      }

      this.logger.debug(
        `User data extracted - ID: ${user.sub}, Email: ${user.email}`,
      );

      // Store user info in socket
      client.userId = user.sub;
      client.userEmail = user.email;
      this.connectedClients.set(client.id, client);

      this.logger.log(`Client connected: ${client.id} (User: ${user.email})`);
      this.logger.debug(
        `Total connected clients: ${this.connectedClients.size}`,
      );
      this.logger.debug(`Client ${client.id} stored in connected clients map`);

      // Don't do any heavy work here - let initialize_user handle business logic
      this.logger.debug(
        `Connection handling completed for client: ${client.id}`,
      );
    } catch (error) {
      this.logger.error(`Connection error for client ${client.id}:`, error);
      this.logger.debug(
        `Disconnecting client ${client.id} due to connection error`,
      );
      client.disconnect();
    }
  }

  // Add a separate method for user initialization after connection
  @SubscribeMessage('initialize_user')
  async handleInitializeUser(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      type: 'login' | 'signup';
    },
  ) {
    this.logger.debug(
      `Initialize user event received from client: ${client.id}`,
    );
    this.logger.debug(`Initialize user data:`, data);
    this.logger.debug(`Client userId: ${client.userId}`);
    this.logger.debug(`Client userEmail: ${client.userEmail}`);

    try {
      if (!client.userId) {
        this.logger.debug(
          `Client ${client.id} not authenticated, sending error`,
        );
        client.emit('initialization_result', {
          success: false,
          error: 'User not authenticated',
        });
        return;
      }

      this.logger.debug(`Checking devnet status for client: ${client.id}`);
      // Check devnet status first
      if (this.poolWatcher.isDevnetOffline()) {
        this.logger.debug(
          `Devnet is offline, sending devnet_status to client: ${client.id}`,
        );
        client.emit('devnet_status', {
          status: 'down',
          message: 'Devnet is currently offline. Please try again in 2 hours.',
          failureCount: this.poolWatcher.getFailureCount(),
        });
        client.emit('initialization_result', {
          success: false,
          error: 'Devnet is currently offline',
          devnetDown: true,
        });
        return;
      }

      this.logger.debug(
        `Devnet is online, sending pool states to client: ${client.id}`,
      );
      // Send initial pool states (moved from handleConnection)
      await this.sendPoolStates(client);

      if (data.type === 'login') {
        this.logger.debug(
          `Processing login initialization for client: ${client.id}`,
        );
        // For login, check profile and send portfolio or trigger wallet creation
        this.logger.debug(`Getting user profile for userId: ${client.userId}`);
        const userProfile = await this.usersService.getUserProfile(
          client.userId,
        );
        this.logger.debug(`User profile result:`, userProfile);

        if (userProfile && userProfile.wallet_address) {
          this.logger.debug(
            `Existing user found with wallet: ${userProfile.wallet_address}`,
          );
          client.isNewUser = false;
          this.logger.debug(
            `Sending user portfolio to existing user: ${client.userEmail}`,
          );
          await this.sendUserPortfolio(client);

          this.logger.debug(
            `Emitting initialization_result success to client: ${client.id}`,
          );
          client.emit('initialization_result', {
            success: true,
            type: 'login',
            hasWallet: true,
            message: 'Login successful',
          });
        } else {
          this.logger.debug(`No wallet found for user, marking as new user`);
          // No wallet - emit user_status to trigger automatic wallet creation
          client.isNewUser = true;
          this.logger.debug(
            `Emitting user_status for new user: ${client.userEmail}`,
          );
          client.emit('user_status', {
            status: 'new_user',
            message: 'Welcome! Creating your wallet...',
            hasWallet: false,
          });
          this.logger.log(
            `New user login: ${client.userEmail} - wallet creation needed`,
          );
        }
      } else if (data.type === 'signup') {
        this.logger.debug(
          `Processing signup initialization for client: ${client.id}`,
        );
        // For signup, always create wallet
        client.isNewUser = true;
        this.logger.debug(
          `Emitting user_status for signup user: ${client.userEmail}`,
        );
        client.emit('user_status', {
          status: 'new_user',
          message: 'Welcome! Creating your wallet...',
          hasWallet: false,
        });
        this.logger.log(
          `New user signup: ${client.userEmail} - wallet creation needed`,
        );
      }

      this.logger.debug(
        `User initialization completed for client: ${client.id}`,
      );
    } catch (error) {
      this.logger.error(
        `User initialization error for client ${client.id}:`,
        error,
      );
      this.logger.debug(`Sending initialization error to client: ${client.id}`);
      client.emit('initialization_result', {
        success: false,
        error: error.message,
      });
    }
  }

  handleDisconnection(client: AuthenticatedSocket) {
    this.logger.debug(`Client disconnection started: ${client.id}`);
    this.logger.debug(
      `Removing client from connected clients map: ${client.id}`,
    );
    this.connectedClients.delete(client.id);
    this.logger.debug(
      `Total connected clients after removal: ${this.connectedClients.size}`,
    );
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Required by OnGatewayDisconnection interface
  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.debug(`handleDisconnect called for client: ${client.id}`);
    return this.handleDisconnection(client);
  }

  // Handle create wallet request (for new user signup)
  @SubscribeMessage('create_wallet')
  async handleCreateWallet(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      userId: string;
      email: string;
    },
  ) {
    this.logger.debug(`Create wallet event received from client: ${client.id}`);
    this.logger.debug(`Create wallet data:`, data);
    this.logger.debug(
      `Client userId: ${client.userId}, Data userId: ${data.userId}`,
    );
    this.logger.debug(
      `Client userEmail: ${client.userEmail}, Data email: ${data.email}`,
    );

    try {
      this.logger.log(`Create wallet request: ${data.email} (${data.userId})`);

      this.logger.debug(`Checking devnet status for wallet creation`);
      // Check devnet status
      if (this.poolWatcher.isDevnetOffline()) {
        this.logger.debug(
          `Devnet offline, cannot create wallet for: ${data.email}`,
        );
        client.emit('wallet_created', {
          success: false,
          error: 'Devnet is currently offline. Wallet creation unavailable.',
          message: 'Please try again when devnet is restored.',
          devnetDown: true,
        });
        return;
      }

      this.logger.debug(
        `Devnet online, proceeding with wallet creation for: ${data.email}`,
      );
      this.logger.debug(
        `Calling usersService.createWalletForUser with userId: ${data.userId}`,
      );
      const result = await this.usersService.createWalletForUser(
        data.userId,
        data.email,
      );
      this.logger.debug(`Wallet creation result:`, result);

      this.logger.debug(
        `Emitting wallet_created event to client: ${client.id}`,
      );
      // Send result back to client
      client.emit('wallet_created', {
        success: result.success,
        wallet_address: result.wallet_address,
        message: result.message,
        error: result.error,
      });

      // If wallet creation was successful, update client status and send portfolio
      if (result.success) {
        this.logger.debug(`Wallet creation successful, updating client status`);
        client.isNewUser = false;
        this.logger.debug(
          `Sending initial portfolio to new user: ${data.email}`,
        );
        // Send initial portfolio for the new user
        await this.sendUserPortfolio(client);
        this.logger.log(
          `Wallet created and portfolio sent to new user: ${data.email}`,
        );
      } else {
        this.logger.debug(
          `Wallet creation failed for: ${data.email}, error: ${result.error}`,
        );
      }

      this.logger.log(
        `Wallet creation ${result.success ? 'successful' : 'failed'} for ${data.email}`,
      );
      this.logger.debug(
        `Create wallet handling completed for client: ${client.id}`,
      );
    } catch (error) {
      this.logger.error(`Create wallet error for client ${client.id}:`, error);
      this.logger.debug(
        `Sending wallet creation error to client: ${client.id}`,
      );
      client.emit('wallet_created', {
        success: false,
        error: error.message,
        message: 'Failed to create wallet',
      });
    }
  }

  @SubscribeMessage('get_profile')
  async handleGetProfile(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { userId: string },
  ) {
    this.logger.debug(`Get profile event received from client: ${client.id}`);
    this.logger.debug(`Get profile data:`, data);

    try {
      if (!client.userId) {
        this.logger.debug(
          `Client ${client.id} not authenticated for get_profile`,
        );
        client.emit('profile_result', {
          success: false,
          error: 'User not authenticated',
        });
        return;
      }

      this.logger.debug(`Getting profile for userId: ${data.userId}`);
      const profile = await this.usersService.getUserProfile(data.userId);
      this.logger.debug(`Profile result:`, profile);

      this.logger.debug(`Emitting profile_result to client: ${client.id}`);
      client.emit('profile_result', {
        success: true,
        profile: profile,
      });
    } catch (error) {
      this.logger.error(`Get profile error for client ${client.id}:`, error);
      client.emit('profile_result', {
        success: false,
        error: error.message,
      });
    }
  }

  @SubscribeMessage('update_profile')
  async handleUpdateProfile(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { userId: string; updates: any },
  ) {
    this.logger.debug(
      `Update profile event received from client: ${client.id}`,
    );
    this.logger.debug(`Update profile data:`, data);

    try {
      if (!client.userId) {
        this.logger.debug(
          `Client ${client.id} not authenticated for update_profile`,
        );
        client.emit('profile_updated', {
          success: false,
          error: 'User not authenticated',
        });
        return;
      }

      this.logger.debug(
        `Updating profile for userId: ${data.userId} with updates:`,
        data.updates,
      );
      const result = await this.usersService.updateUserProfile(
        data.userId,
        data.updates,
      );
      this.logger.debug(`Profile update result:`, result);

      this.logger.debug(`Emitting profile_updated to client: ${client.id}`);
      client.emit('profile_updated', result);
    } catch (error) {
      this.logger.error(`Update profile error for client ${client.id}:`, error);
      client.emit('profile_updated', {
        success: false,
        error: error.message,
      });
    }
  }

  // Trading methods with devnet protection
  @SubscribeMessage('swap')
  async handleSwap(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      poolType: string;
      amountIn: number;
      tokenType: 'A' | 'B';
      minAmountOut: number;
    },
  ) {
    this.logger.debug(`Swap event received from client: ${client.id}`);
    this.logger.debug(`Swap data:`, data);
    this.logger.debug(
      `Client authentication - userId: ${client.userId}, isNewUser: ${client.isNewUser}`,
    );

    try {
      if (!client.userId || client.isNewUser) {
        this.logger.debug(
          `Client ${client.id} not authenticated or wallet not created for swap`,
        );
        client.emit('transaction_result', {
          success: false,
          error: 'User not authenticated or wallet not created',
        });
        return;
      }

      this.logger.debug(`Checking devnet status for swap operation`);
      // Check devnet status
      if (this.poolWatcher.isDevnetOffline()) {
        this.logger.debug(
          `Devnet offline, cannot execute swap for: ${client.userEmail}`,
        );
        client.emit('transaction_result', {
          success: false,
          error: 'Devnet is currently offline',
        });
        return;
      }

      if (this.poolWatcher.isTransactionLocked()) {
        this.logger.debug(
          `Transactions locked due to unstable devnet for: ${client.userEmail}`,
        );
        client.emit('transaction_result', {
          success: false,
          error: 'Devnet is unstable. Transactions are temporarily disabled.',
        });
        return;
      }

      this.logger.log(
        `Swap request from ${client.userEmail}: ${JSON.stringify(data)}`,
      );
      this.logger.debug(
        `Executing swap via solanaService for userId: ${client.userId}`,
      );

      const result = await this.solanaService.executeSwap(
        client.userId,
        data.poolType,
        data.amountIn,
        data.tokenType,
        data.minAmountOut,
      );

      this.logger.debug(`Swap execution result:`, result);
      this.logger.debug(`Emitting transaction_result to client: ${client.id}`);

      client.emit('transaction_result', {
        success: result.success,
        txSignature: result.txSignature,
        message: result.success ? 'Swap completed successfully' : 'Swap failed',
      });

      this.sendUserPortfolio(client);

      if (result.success) {
        this.logger.debug(`Swap successful, processing post-swap actions`);
        if (result.updatedBalances) {
          this.logger.debug(
            `Emitting balance_update to client: ${client.id}`,
            result.updatedBalances,
          );
          client.emit('balance_update', { data: result.updatedBalances });
        }
        this.logger.debug(
          `Forcing pool refresh for poolType: ${data.poolType}`,
        );
        await this.poolWatcher.forceRefreshPool(data.poolType);
        this.logger.debug(`Broadcasting updated pool states to all clients`);
        await this.broadcastPoolStates();
      }
    } catch (error) {
      this.logger.error(`Swap error for client ${client.id}:`, error);
      client.emit('transaction_result', {
        success: false,
        error: error.message,
      });
    }
  }

  @SubscribeMessage('add_liquidity')
  async handleAddLiquidity(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      poolType: string;
      amountA: number;
      amountB: number;
    },
  ) {
    this.logger.debug(`Add liquidity event received from client: ${client.id}`);
    this.logger.debug(`Add liquidity data:`, data);
    this.logger.debug(
      `Client authentication - userId: ${client.userId}, isNewUser: ${client.isNewUser}`,
    );

    try {
      if (!client.userId || client.isNewUser) {
        this.logger.debug(
          `Client ${client.id} not authenticated or wallet not created for add_liquidity`,
        );
        client.emit('transaction_result', {
          success: false,
          error: 'User not authenticated or wallet not created',
        });
        return;
      }

      this.logger.debug(`Checking devnet status for add liquidity operation`);
      // Check devnet status
      if (this.poolWatcher.isDevnetOffline()) {
        this.logger.debug(
          `Devnet offline, cannot add liquidity for: ${client.userEmail}`,
        );
        client.emit('transaction_result', {
          success: false,
          error: 'Devnet is currently offline',
        });
        return;
      }

      if (this.poolWatcher.isTransactionLocked()) {
        this.logger.debug(
          `Transactions locked due to unstable devnet for: ${client.userEmail}`,
        );
        client.emit('transaction_result', {
          success: false,
          error: 'Devnet is unstable. Transactions are temporarily disabled.',
        });
        return;
      }

      this.logger.log(
        `Add liquidity request from ${client.userEmail}: ${JSON.stringify(data)}`,
      );
      this.logger.debug(
        `Executing add liquidity via solanaService for userId: ${client.userId}`,
      );

      const result = await this.solanaService.executeAddLiquidity(
        client.userId,
        data.poolType,
        data.amountA,
        data.amountB,
      );

      this.logger.debug(`Add liquidity execution result:`, result);

      client.emit('transaction_result', {
        success: result.success,
        txSignature: result.txSignature,
        message: result.success
          ? 'Add liquidity completed successfully'
          : 'Add liquidity failed',
      });

      this.sendUserPortfolio(client);
      
      if (result.success) {
        this.logger.debug(
          `Add liquidity successful, processing post-transaction actions`,
        );
        if (result.updatedBalances) {
          this.logger.debug(
            `Emitting balance_update to client: ${client.id}`,
            result.updatedBalances,
          );
          client.emit('balance_update', { data: result.updatedBalances });
        }
        this.logger.debug(
          `Forcing pool refresh for poolType: ${data.poolType}`,
        );
        await this.poolWatcher.forceRefreshPool(data.poolType);
        this.logger.debug(`Broadcasting updated pool states to all clients`);
        await this.broadcastPoolStates();
      }
    } catch (error) {
      this.logger.error(`Add liquidity error for client ${client.id}:`, error);
      client.emit('transaction_result', {
        success: false,
        error: error.message,
      });
    }
  }

  @SubscribeMessage('remove_liquidity')
  async handleRemoveLiquidity(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      poolType: string;
      lpAmount: number;
      minAmountA: number;
      minAmountB: number;
    },
  ) {
    this.logger.debug(
      `Remove liquidity event received from client: ${client.id}`,
    );
    this.logger.debug(`Remove liquidity data:`, data);
    this.logger.debug(
      `Client authentication - userId: ${client.userId}, isNewUser: ${client.isNewUser}`,
    );

    try {
      if (!client.userId || client.isNewUser) {
        this.logger.debug(
          `Client ${client.id} not authenticated or wallet not created for remove_liquidity`,
        );
        client.emit('transaction_result', {
          success: false,
          error: 'User not authenticated or wallet not created',
        });
        return;
      }

      this.logger.debug(
        `Checking devnet status for remove liquidity operation`,
      );
      // Check devnet status
      if (this.poolWatcher.isDevnetOffline()) {
        this.logger.debug(
          `Devnet offline, cannot remove liquidity for: ${client.userEmail}`,
        );
        client.emit('transaction_result', {
          success: false,
          error: 'Devnet is currently offline',
        });
        return;
      }

      if (this.poolWatcher.isTransactionLocked()) {
        this.logger.debug(
          `Transactions locked due to unstable devnet for: ${client.userEmail}`,
        );
        client.emit('transaction_result', {
          success: false,
          error: 'Devnet is unstable. Transactions are temporarily disabled.',
        });
        return;
      }

      this.logger.log(
        `Remove liquidity request from ${client.userEmail}: ${JSON.stringify(data)}`,
      );
      this.logger.debug(
        `Executing remove liquidity via solanaService for userId: ${client.userId}`,
      );

      const result = await this.solanaService.executeRemoveLiquidity(
        client.userId,
        data.poolType,
        data.lpAmount,
        data.minAmountA,
        data.minAmountB,
      );

      this.logger.debug(`Remove liquidity execution result:`, result);

      client.emit('transaction_result', {
        success: result.success,
        txSignature: result.txSignature,
        message: result.success
          ? 'Remove liquidity completed successfully'
          : 'Remove liquidity failed',
      });

      this.sendUserPortfolio(client);

      if (result.success) {
        this.logger.debug(
          `Remove liquidity successful, processing post-transaction actions`,
        );
        if (result.updatedBalances) {
          this.logger.debug(
            `Emitting balance_update to client: ${client.id}`,
            result.updatedBalances,
          );
          client.emit('balance_update', { data: result.updatedBalances });
        }
        this.logger.debug(
          `Forcing pool refresh for poolType: ${data.poolType}`,
        );
        await this.poolWatcher.forceRefreshPool(data.poolType);
        this.logger.debug(`Broadcasting updated pool states to all clients`);
        await this.broadcastPoolStates();
      }
    } catch (error) {
      this.logger.error(
        `Remove liquidity error for client ${client.id}:`,
        error,
      );
      client.emit('transaction_result', {
        success: false,
        error: error.message,
      });
    }
  }

  // Broadcast pool states to all connected clients every 5 seconds with devnet protection
  @Cron('*/5 * * * * *')
  async broadcastPoolStates() {
    this.logger.debug(`Broadcast pool states cron job triggered`);
    this.logger.debug(`Connected clients count: ${this.connectedClients.size}`);

    if (this.poolWatcher.isDevnetOffline()) {
      this.logger.debug(`Devnet is offline, broadcasting devnet down status`);
      // Broadcast devnet down status
      this.server.emit('devnet_status', {
        status: 'down',
        message: 'Devnet is currently offline. Please try again in 2 hours.',
        failureCount: this.poolWatcher.getFailureCount(),
      });
      this.logger.debug('Broadcasted devnet down status to all clients');
      return;
    }

    // this.logger.debug(`Getting pool data from cache`);
    const poolsData = this.poolWatcher.getAllPoolsFromCache();
    // this.logger.debug(`Pool data retrieved:`, poolsData ? Object.keys(poolsData) : 'null');

    if (poolsData && Object.keys(poolsData).length > 0) {
      this.logger.debug(
        `Broadcasting pools_update to ${this.connectedClients.size} clients`,
      );
      // this.logger.debug(`broadcastPoolStates poolsData:${JSON.stringify(poolsData)}`);
      this.server.emit('pools_update', { data: poolsData });
      this.logger.debug('Broadcasted pool states to all clients');
    } else {
      this.logger.debug('No pool data available to broadcast');
    }
  }

  // Send pool states to specific client
  private async sendPoolStates(client: Socket) {
    this.logger.debug(`Sending pool states to specific client: ${client.id}`);
    const poolsData = this.poolWatcher.getAllPoolsFromCache();
    this.logger.debug(
      `Pool data for specific client:`,
      poolsData ? Object.keys(poolsData) : 'null',
    );

    if (poolsData) {
      this.logger.debug(`Emitting pools_update to client: ${client.id}`);
      client.emit('pools_update', { data: poolsData });
      this.logger.debug(`Pool states sent to client: ${client.id}`);
    } else {
      this.logger.debug(
        `No pool data available to send to client: ${client.id}`,
      );
    }
  }

  // Send user portfolio to specific client (now only called for existing users)
  private async sendUserPortfolio(client: AuthenticatedSocket) {
    this.logger.debug(`Sending user portfolio to client: ${client.id}`);
    this.logger.debug(
      `Client userId: ${client.userId}, userEmail: ${client.userEmail}`,
    );

    if (!client.userId) {
      this.logger.debug(
        `No userId for client ${client.id}, cannot send portfolio`,
      );
      return;
    }

    try {
      this.logger.debug(`Getting portfolio for userId: ${client.userId}`);

      // Get complete portfolio data from service
      const portfolioResult = await this.solanaService.getUserPortfolio(
        client.userId,
      );

      if (portfolioResult.success) {
        this.logger.debug(`Portfolio data prepared for client: ${client.id}`);
        this.logger.debug(`Emitting user_portfolio to client: ${client.id}`);

        client.emit('user_portfolio', {
          success: true,
          data: portfolioResult.data,
        });

        this.logger.log(`Portfolio sent to user: ${client.userEmail}`);
      } else {
        this.logger.warn(
          `Failed to get portfolio for user: ${client.userEmail} - ${portfolioResult.error}`,
        );

        client.emit('user_portfolio', {
          success: false,
          error: portfolioResult.error,
        });
      }
    } catch (error) {
      this.logger.error(
        `Error sending user portfolio for ${client.userEmail}:`,
        error,
      );
      this.logger.debug(`Portfolio sending failed for client: ${client.id}`);

      client.emit('user_portfolio', {
        success: false,
        error: 'Failed to fetch portfolio data',
      });
    }
  }
}
