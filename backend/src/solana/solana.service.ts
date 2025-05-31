import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  Transaction,
} from '@solana/web3.js';
import {
  createSolanaConnection,
  getSolanaConfig,
} from '../config/solana.config';
import { ProgramService } from './program/program.service';
import { MemoryCacheService } from '../cache/memory-cache.service';
import { SupabaseService } from '../database/supabase.service';
import {
  PortfolioData,
  LpPositions,
  LpTokenData,
  UserLiquidityPositions,
  LiquidityPosition,
} from '../types/portfolio.types';

@Injectable()
export class SolanaService implements OnModuleInit {
  private readonly logger = new Logger(SolanaService.name);
  private connection: Connection;
  private config: ReturnType<typeof getSolanaConfig>;

  constructor(
    private programService: ProgramService,
    private cacheService: MemoryCacheService,
    private supabaseService: SupabaseService,
  ) {}

  onModuleInit() {
    this.connection = createSolanaConnection();
    this.config = getSolanaConfig();
    this.logger.log('Solana service initialized');
  }

  getConnection(): Connection {
    return this.connection;
  }

  // Execute swap transaction
  async executeSwap(
    userId: string,
    poolType: string,
    amountIn: number,
    tokenType: 'A' | 'B',
    minAmountOut: number,
  ) {
    try {
      // Get user private key from database
      const privateKeyB64 =
        await this.supabaseService.getUserPrivateKey(userId);
      if (!privateKeyB64) {
        throw new Error('User private key not found');
      }

      // Decode private key
      const privateKeyBuffer = Buffer.from(privateKeyB64, 'base64');
      const userKeypair = Keypair.fromSecretKey(privateKeyBuffer);

      // Execute swap through program service
      const txSignature = await this.programService.executeSwap(
        userKeypair,
        poolType,
        amountIn,
        tokenType,
        minAmountOut,
      );

      this.logger.log(`Swap executed: ${txSignature}`);

      // Get updated user balances
      const updatedBalances = await this.getUserTokenBalances(userId);

      return {
        success: true,
        txSignature,
        updatedBalances,
      };
    } catch (error) {
      this.logger.error('Swap execution failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Execute add liquidity transaction
  async executeAddLiquidity(
    userId: string,
    poolType: string,
    amountA: number,
    amountB: number,
  ) {
    try {
      // First ensure user has LP token account for this pool
      await this.createUserLpTokenAccounts(userId, [poolType]);

      // Get user private key from database
      const privateKeyB64 =
        await this.supabaseService.getUserPrivateKey(userId);
      if (!privateKeyB64) {
        throw new Error('User private key not found');
      }

      // Decode private key
      const privateKeyBuffer = Buffer.from(privateKeyB64, 'base64');
      const userKeypair = Keypair.fromSecretKey(privateKeyBuffer);

      // Execute add liquidity through program service
      const txSignature = await this.programService.executeAddLiquidity(
        userKeypair,
        poolType,
        amountA,
        amountB,
      );

      this.logger.log(`Add liquidity executed: ${txSignature}`);

      // Get updated user balances
      const updatedBalances = await this.getUserTokenBalances(userId);

      return {
        success: true,
        txSignature,
        updatedBalances,
      };
    } catch (error) {
      this.logger.error('Add liquidity execution failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Execute remove liquidity transaction
  async executeRemoveLiquidity(
    userId: string,
    poolType: string,
    lpAmount: number,
    minAmountA: number,
    minAmountB: number,
  ) {
    try {
      // Get user private key from database
      const privateKeyB64 =
        await this.supabaseService.getUserPrivateKey(userId);
      if (!privateKeyB64) {
        throw new Error('User private key not found');
      }

      // Decode private key
      const privateKeyBuffer = Buffer.from(privateKeyB64, 'base64');
      const userKeypair = Keypair.fromSecretKey(privateKeyBuffer);

      // Execute remove liquidity through program service
      const txSignature = await this.programService.executeRemoveLiquidity(
        userKeypair,
        poolType,
        lpAmount,
        minAmountA,
        minAmountB,
      );

      this.logger.log(`Remove liquidity executed: ${txSignature}`);

      // Get updated user balances
      const updatedBalances = await this.getUserTokenBalances(userId);

      return {
        success: true,
        txSignature,
        updatedBalances,
      };
    } catch (error) {
      this.logger.error('Remove liquidity execution failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Get pool state from cache or fetch from blockchain
  async getPoolState(poolType: string) {
    // Try to get from cache first
    let poolState = this.cacheService.getPoolState(poolType);

    if (!poolState) {
      // Fetch from blockchain if not in cache
      poolState = await this.programService.getPoolState(poolType);
      if (poolState) {
        this.cacheService.setPoolState(poolType, poolState);
      }
    }

    return poolState;
  }

  // Helper method to get LP mint address for a specific pool
  private async getLpMintForPool(poolType: string) {
    const poolConfigs = {
      'NTD-USD': {
        tokenA:
          process.env.NTD_MINT ||
          '9ZNR5SDKdvUjh1PogrZQYrJ851zv2c4bkpGZaidMFP7V',
        tokenB:
          process.env.USD_MINT ||
          'EZNZ1GnxJoFAGBUeKGtf7zCcz6F5CtbQCPBkSzVwWUmh',
      },
      'USD-YEN': {
        tokenA:
          process.env.USD_MINT ||
          'EZNZ1GnxJoFAGBUeKGtf7zCcz6F5CtbQCPBkSzVwWUmh',
        tokenB:
          process.env.YEN_MINT ||
          'AifcapG2iHSTfUiG2ppP4EURm2xsRMGo5ZaWVRkKgkYH',
      },
      'NTD-YEN': {
        tokenA:
          process.env.NTD_MINT ||
          '9ZNR5SDKdvUjh1PogrZQYrJ851zv2c4bkpGZaidMFP7V',
        tokenB:
          process.env.YEN_MINT ||
          'AifcapG2iHSTfUiG2ppP4EURm2xsRMGo5ZaWVRkKgkYH',
      },
    };

    const poolConfig = poolConfigs[poolType];
    if (!poolConfig) {
      throw new Error(`Unknown pool type: ${poolType}`);
    }

    const tokenAMint = new PublicKey(poolConfig.tokenA);
    const tokenBMint = new PublicKey(poolConfig.tokenB);

    // Calculate LP mint PDA using the same logic as ProgramService
    const [lpMintPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('lp_mint'), tokenAMint.toBuffer(), tokenBMint.toBuffer()],
      this.config.PROGRAM_ID,
    );

    return {
      lpMint: lpMintPDA,
      tokenA: tokenAMint,
      tokenB: tokenBMint,
    };
  }

  // Get user token balances including LP tokens for all pools
  async getUserTokenBalances(userId: string) {
    try {
      // Get user profile to get wallet address
      const userProfile = await this.supabaseService.getUserProfile(userId);
      if (!userProfile || !userProfile.wallet_address) {
        throw new Error('User wallet address not found');
      }

      const userPublicKey = new PublicKey(userProfile.wallet_address);

      // Get associated token addresses for all tokens
      const ntdMint = new PublicKey(
        process.env.NTD_MINT || '9ZNR5SDKdvUjh1PogrZQYrJ851zv2c4bkpGZaidMFP7V',
      );
      const usdMint = new PublicKey(
        process.env.USD_MINT || 'EZNZ1GnxJoFAGBUeKGtf7zCcz6F5CtbQCPBkSzVwWUmh',
      );
      const yenMint = new PublicKey(
        process.env.YEN_MINT || 'AifcapG2iHSTfUiG2ppP4EURm2xsRMGo5ZaWVRkKgkYH',
      );

      const { getAssociatedTokenAddress } = await import('@solana/spl-token');

      const ntdTokenAccount = await getAssociatedTokenAddress(
        ntdMint,
        userPublicKey,
      );
      const usdTokenAccount = await getAssociatedTokenAddress(
        usdMint,
        userPublicKey,
      );
      const yenTokenAccount = await getAssociatedTokenAddress(
        yenMint,
        userPublicKey,
      );

      // Define proper type for LP token accounts
      interface LpTokenInfo {
        lpMint: PublicKey;
        userLpAccount: PublicKey;
      }

      // Get LP mint addresses for each pool using ProgramService logic
      const poolTypes = ['NTD-USD', 'USD-YEN', 'NTD-YEN'];
      const lpTokenAccounts: Record<string, LpTokenInfo | null> = {};

      // Get LP mint PDAs for each pool
      for (const poolType of poolTypes) {
        try {
          const poolConfig = await this.getLpMintForPool(poolType);
          if (poolConfig.lpMint) {
            const userLpTokenAccount = await getAssociatedTokenAddress(
              poolConfig.lpMint,
              userPublicKey,
            );
            lpTokenAccounts[poolType] = {
              lpMint: poolConfig.lpMint,
              userLpAccount: userLpTokenAccount,
            };
          }
        } catch (error) {
          this.logger.warn(
            `Failed to get LP mint for pool ${poolType}:`,
            error,
          );
          lpTokenAccounts[poolType] = null;
        }
      }

      // Fetch main token balances
      const [ntdBalance, usdBalance, yenBalance] = await Promise.all([
        this.connection
          .getTokenAccountBalance(ntdTokenAccount)
          .catch(() => ({ value: { amount: '0' } })),
        this.connection
          .getTokenAccountBalance(usdTokenAccount)
          .catch(() => ({ value: { amount: '0' } })),
        this.connection
          .getTokenAccountBalance(yenTokenAccount)
          .catch(() => ({ value: { amount: '0' } })),
      ]);

      // Fetch LP token balances
      const lpBalances: Record<string, any> = {};
      for (const [poolType, lpInfo] of Object.entries(lpTokenAccounts)) {
        if (lpInfo && lpInfo.userLpAccount) {
          try {
            const lpBalance = await this.connection.getTokenAccountBalance(
              lpInfo.userLpAccount,
            );
            lpBalances[poolType] = {
              balance: parseInt(lpBalance.value.amount),
              uiAmount: lpBalance.value.uiAmount || 0,
              lpMint: lpInfo.lpMint.toString(),
              userLpAccount: lpInfo.userLpAccount.toString(),
              accountExists: true,
            };
          } catch (error) {
            // Account doesn't exist - user has no LP tokens for this pool
            this.logger.debug(
              `User has no LP token account for ${poolType}:`,
              error.message,
            );
            lpBalances[poolType] = {
              balance: 0,
              uiAmount: 0,
              lpMint: lpInfo.lpMint.toString(),
              userLpAccount: lpInfo.userLpAccount.toString(),
              accountExists: false,
            };
          }
        } else {
          lpBalances[poolType] = {
            balance: 0,
            uiAmount: 0,
            lpMint: null,
            userLpAccount: null,
            accountExists: false,
          };
        }
      }

      return {
        // Main token balances
        NTD: parseInt(ntdBalance.value.amount),
        USD: parseInt(usdBalance.value.amount),
        YEN: parseInt(yenBalance.value.amount),

        // LP token balances for each pool
        lpTokens: lpBalances,

        // User info
        walletAddress: userProfile.wallet_address,
      };
    } catch (error) {
      this.logger.error('Failed to get user token balances:', error);
      return null;
    }
  }

  // Get user's LP token balances only (lighter method)
  async getUserLpTokenBalances(userId: string) {
    try {
      const userProfile = await this.supabaseService.getUserProfile(userId);
      if (!userProfile || !userProfile.wallet_address) {
        throw new Error('User wallet address not found');
      }

      const userPublicKey = new PublicKey(userProfile.wallet_address);
      const { getAssociatedTokenAddress } = await import('@solana/spl-token');

      const poolTypes = ['NTD-USD', 'USD-YEN', 'NTD-YEN'];
      const lpBalances = {};

      for (const poolType of poolTypes) {
        try {
          const poolConfig = await this.getLpMintForPool(poolType);
          const userLpTokenAccount = await getAssociatedTokenAddress(
            poolConfig.lpMint,
            userPublicKey,
          );

          try {
            const lpBalance =
              await this.connection.getTokenAccountBalance(userLpTokenAccount);
            lpBalances[poolType] = {
              balance: parseInt(lpBalance.value.amount),
              uiAmount: lpBalance.value.uiAmount || 0,
              lpMint: poolConfig.lpMint.toString(),
              userLpAccount: userLpTokenAccount.toString(),
              accountExists: true,
            };
          } catch (error) {
            // Account doesn't exist
            lpBalances[poolType] = {
              balance: 0,
              uiAmount: 0,
              lpMint: poolConfig.lpMint.toString(),
              userLpAccount: userLpTokenAccount.toString(),
              accountExists: false,
            };
          }
        } catch (error) {
          this.logger.warn(`Failed to get LP balance for ${poolType}:`, error);
          lpBalances[poolType] = {
            balance: 0,
            uiAmount: 0,
            lpMint: null,
            userLpAccount: null,
            accountExists: false,
            error: error.message,
          };
        }
      }

      return {
        success: true,
        lpTokens: lpBalances,
        walletAddress: userProfile.wallet_address,
      };
    } catch (error) {
      this.logger.error('Failed to get user LP token balances:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Create LP token accounts for user if they don't exist
  async createUserLpTokenAccounts(
    userId: string,
    poolTypes: string[] = ['NTD-USD', 'USD-YEN', 'NTD-YEN'],
  ) {
    try {
      // Get user private key from database
      const privateKeyB64 =
        await this.supabaseService.getUserPrivateKey(userId);
      if (!privateKeyB64) {
        throw new Error('User private key not found');
      }

      // Decode private key
      const privateKeyBuffer = Buffer.from(privateKeyB64, 'base64');
      const userKeypair = Keypair.fromSecretKey(privateKeyBuffer);

      const {
        createAssociatedTokenAccountInstruction,
        getAssociatedTokenAddress,
      } = await import('@solana/spl-token');

      const instructions: TransactionInstruction[] = [];
      const createdAccounts: Array<{
        poolType: string;
        lpMint: string;
        userLpAccount: string;
      }> = [];

      for (const poolType of poolTypes) {
        try {
          const poolConfig = await this.getLpMintForPool(poolType);
          const userLpTokenAccount = await getAssociatedTokenAddress(
            poolConfig.lpMint,
            userKeypair.publicKey,
          );

          // Check if account already exists
          try {
            await this.connection.getTokenAccountBalance(userLpTokenAccount);
            this.logger.debug(
              `LP token account already exists for ${poolType}: ${userLpTokenAccount.toString()}`,
            );
          } catch (error) {
            // Account doesn't exist, create it
            this.logger.debug(
              `Creating LP token account for ${poolType}: ${userLpTokenAccount.toString()}`,
            );

            instructions.push(
              createAssociatedTokenAccountInstruction(
                userKeypair.publicKey, // payer
                userLpTokenAccount, // associatedToken
                userKeypair.publicKey, // owner
                poolConfig.lpMint, // mint
              ),
            );

            createdAccounts.push({
              poolType,
              lpMint: poolConfig.lpMint.toString(),
              userLpAccount: userLpTokenAccount.toString(),
            });
          }
        } catch (error) {
          this.logger.warn(
            `Failed to process LP account creation for ${poolType}:`,
            error,
          );
        }
      }

      // Send transaction if any accounts need to be created
      if (instructions.length > 0) {
        const transaction = new Transaction().add(...instructions);

        // Get latest blockhash and set transaction properties
        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = userKeypair.publicKey;
        transaction.sign(userKeypair);

        const signature = await this.connection.sendRawTransaction(
          transaction.serialize(),
        );
        await this.connection.confirmTransaction(signature, 'confirmed');

        this.logger.log(
          `Created ${createdAccounts.length} LP token accounts. Signature: ${signature}`,
        );

        return {
          success: true,
          signature,
          createdAccounts,
          message: `Created ${createdAccounts.length} LP token accounts`,
        };
      }

      return {
        success: true,
        signature: null,
        createdAccounts: [],
        message: 'All LP token accounts already exist',
      };
    } catch (error) {
      this.logger.error('Failed to create LP token accounts:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Request SOL airdrop for new wallets (devnet only)
  async requestAirdrop(
    walletAddress: string,
    solAmount: number = 1,
  ): Promise<void> {
    try {
      const publicKey = new PublicKey(walletAddress);
      const lamports = solAmount * 1000000000; // Convert SOL to lamports

      this.logger.log(
        `Requesting ${solAmount} SOL airdrop for ${walletAddress}`,
      );

      const signature = await this.connection.requestAirdrop(
        publicKey,
        lamports,
      );
      await this.connection.confirmTransaction(signature);

      this.logger.log(`Airdrop completed: ${signature}`);
    } catch (error) {
      this.logger.error(`Airdrop failed for ${walletAddress}:`, error);
      throw error;
    }
  }

  // Mint initial tokens to new user
  async mintTokensToUser(
    userKeypair: Keypair,
    ntdAmount: number,
    usdAmount: number,
    yenAmount: number,
  ): Promise<void> {
    try {
      const {
        createAssociatedTokenAccountInstruction,
        getAssociatedTokenAddress,
        createMintToInstruction,
      } = await import('@solana/spl-token');

      // Get mint authority keypair from environment
      const mintAuthorityBase64 = process.env.MINT_AUTHORITY_PRIVATE_KEY;
      if (!mintAuthorityBase64) {
        throw new Error('MINT_AUTHORITY_PRIVATE_KEY not found in environment');
      }

      // Decode mint authority keypair
      const mintAuthorityArray = JSON.parse(
        Buffer.from(mintAuthorityBase64, 'base64').toString(),
      );
      const mintAuthorityKeypair = Keypair.fromSecretKey(
        new Uint8Array(mintAuthorityArray),
      );

      this.logger.log(
        `Using mint authority: ${mintAuthorityKeypair.publicKey.toString()}`,
      );

      // Token mint addresses
      const ntdMint = new PublicKey(
        process.env.NTD_MINT || '9ZNR5SDKdvUjh1PogrZQYrJ851zv2c4bkpGZaidMFP7V',
      );
      const usdMint = new PublicKey(
        process.env.USD_MINT || 'EZNZ1GnxJoFAGBUeKGtf7zCcz6F5CtbQCPBkSzVwWUmh',
      );
      const yenMint = new PublicKey(
        process.env.YEN_MINT || 'AifcapG2iHSTfUiG2ppP4EURm2xsRMGo5ZaWVRkKgkYH',
      );

      // Get associated token addresses
      const userNtdAccount = await getAssociatedTokenAddress(
        ntdMint,
        userKeypair.publicKey,
      );
      const userUsdAccount = await getAssociatedTokenAddress(
        usdMint,
        userKeypair.publicKey,
      );
      const userYenAccount = await getAssociatedTokenAddress(
        yenMint,
        userKeypair.publicKey,
      );

      // Create transaction with all instructions
      const transaction = new Transaction();

      // Add create ATA instructions
      transaction.add(
        createAssociatedTokenAccountInstruction(
          mintAuthorityKeypair.publicKey, // payer (mint authority pays for account creation)
          userNtdAccount, // associatedToken
          userKeypair.publicKey, // owner
          ntdMint, // mint
        ),
      );

      transaction.add(
        createAssociatedTokenAccountInstruction(
          mintAuthorityKeypair.publicKey,
          userUsdAccount,
          userKeypair.publicKey,
          usdMint,
        ),
      );

      transaction.add(
        createAssociatedTokenAccountInstruction(
          mintAuthorityKeypair.publicKey,
          userYenAccount,
          userKeypair.publicKey,
          yenMint,
        ),
      );

      // Add mint instructions (actual token creation)
      transaction.add(
        createMintToInstruction(
          ntdMint, // mint
          userNtdAccount, // destination
          mintAuthorityKeypair.publicKey, // authority
          ntdAmount * 1000000, // amount (assuming 6 decimals)
        ),
      );

      transaction.add(
        createMintToInstruction(
          usdMint,
          userUsdAccount,
          mintAuthorityKeypair.publicKey,
          usdAmount * 1000000,
        ),
      );

      transaction.add(
        createMintToInstruction(
          yenMint,
          userYenAccount,
          mintAuthorityKeypair.publicKey,
          yenAmount * 1000000,
        ),
      );

      this.logger.log(
        `Minting tokens to user: ${userKeypair.publicKey.toString()}`,
      );
      this.logger.log(
        `- NTD: ${ntdAmount}, USD: ${usdAmount}, YEN: ${yenAmount}`,
      );

      // Send transaction (signed by mint authority)
      const signature = await this.connection.sendTransaction(transaction, [
        mintAuthorityKeypair,
      ]);
      await this.connection.confirmTransaction(signature);

      this.logger.log(`Tokens minted successfully: ${signature}`);
    } catch (error) {
      this.logger.error('Failed to mint tokens to user:', error);
      throw error;
    }
  }

  // Get all pools state
  async getAllPoolsState() {
    const poolTypes = ['NTD-USD', 'USD-YEN', 'NTD-YEN'];
    const poolsState = {};

    for (const poolType of poolTypes) {
      poolsState[poolType] = await this.getPoolState(poolType);
    }

    return poolsState;
  }

  // Get complete user portfolio data including LP positions
  async getUserPortfolio(
    userId: string,
  ): Promise<
    { success: true; data: PortfolioData } | { success: false; error: string }
  > {
    try {
      this.logger.debug(`Getting complete portfolio for userId: ${userId}`);

      // Get user's token balances (including LP tokens)
      const balances = await this.getUserTokenBalances(userId);
      if (!balances) {
        throw new Error('Failed to get user token balances');
      }

      // Get all pool states for calculations
      const poolsState = await this.getAllPoolsState();

      // Calculate LP positions with underlying values
      const lpPositions = await this.calculateLpPositions(
        balances.lpTokens,
        poolsState,
      );

      const portfolioData: PortfolioData = {
        walletTokens: {
          NTD: balances.NTD,
          USD: balances.USD,
          YEN: balances.YEN,
        },
        lpPositions: lpPositions,
        walletAddress: balances.walletAddress,
        lastUpdated: new Date().toISOString(),
      };

      this.logger.debug(`Portfolio data calculated for user ${userId}:`, {
        tokenCount: Object.keys(portfolioData.walletTokens).length,
        lpPositionCount: Object.keys(portfolioData.lpPositions).length,
        hasLpTokens: Object.values(portfolioData.lpPositions).some(
          (pos) => pos.lpAmount > 0,
        ),
      });

      return {
        success: true,
        data: portfolioData,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get user portfolio for userId ${userId}:`,
        error,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Calculate LP positions with underlying values and share percentages
  private async calculateLpPositions(
    lpTokens: any,
    poolsState: any,
  ): Promise<LpPositions> {
    const positions: LpPositions = {
      'NTD-USD': {
        lpAmount: 0,
        sharePercent: 0,
        underlyingNTD: 0,
        underlyingUSD: 0,
      },
      'USD-YEN': {
        lpAmount: 0,
        sharePercent: 0,
        underlyingUSD: 0,
        underlyingYEN: 0,
      },
      'NTD-YEN': {
        lpAmount: 0,
        sharePercent: 0,
        underlyingNTD: 0,
        underlyingYEN: 0,
      },
    };

    // Process each pool
    for (const poolType of Object.keys(positions) as Array<keyof LpPositions>) {
      try {
        const userLpData = lpTokens[poolType];
        const poolState = poolsState[poolType];

        if (!userLpData || !poolState || userLpData.balance === 0) {
          this.logger.debug(`No LP position for pool ${poolType}`);
          continue;
        }

        // Get total LP supply from mint
        const totalLpSupply = await this.getLpMintTotalSupply(
          userLpData.lpMint,
        );

        if (totalLpSupply === 0) {
          this.logger.warn(`LP mint has zero supply for pool ${poolType}`);
          continue;
        }

        // Calculate user's share percentage
        const sharePercent = (userLpData.balance / totalLpSupply) * 100;
        const userShareRatio = userLpData.balance / totalLpSupply;

        // Calculate underlying token amounts based on pool vault balances
        const underlyingA = Math.floor(
          poolState.vaultABalance * userShareRatio,
        );
        const underlyingB = Math.floor(
          poolState.vaultBBalance * userShareRatio,
        );

        // Update position based on pool type
        if (poolType === 'NTD-USD') {
          positions[poolType].lpAmount = userLpData.uiAmount;
          positions[poolType].sharePercent = sharePercent;
          positions[poolType].underlyingNTD = underlyingA;
          positions[poolType].underlyingUSD = underlyingB;
        } else if (poolType === 'USD-YEN') {
          positions[poolType].lpAmount = userLpData.uiAmount;
          positions[poolType].sharePercent = sharePercent;
          positions[poolType].underlyingUSD = underlyingA;
          positions[poolType].underlyingYEN = underlyingB;
        } else if (poolType === 'NTD-YEN') {
          positions[poolType].lpAmount = userLpData.uiAmount;
          positions[poolType].sharePercent = sharePercent;
          positions[poolType].underlyingNTD = underlyingA;
          positions[poolType].underlyingYEN = underlyingB;
        }

        this.logger.debug(`Calculated LP position for ${poolType}:`, {
          lpAmount: positions[poolType].lpAmount,
          sharePercent: sharePercent.toFixed(4) + '%',
          userLpBalance: userLpData.balance,
          totalLpSupply: totalLpSupply,
          vaultABalance: poolState.vaultABalance,
          vaultBBalance: poolState.vaultBBalance,
        });
      } catch (error) {
        this.logger.error(
          `Error calculating LP position for ${poolType}:`,
          error,
        );
        // Keep default values (zeros) for this pool
      }
    }

    return positions;
  }

  // Get total supply of LP mint tokens
  private async getLpMintTotalSupply(lpMintAddress: string): Promise<number> {
    try {
      const lpMintPublicKey = new PublicKey(lpMintAddress);
      const lpMintInfo =
        await this.connection.getParsedAccountInfo(lpMintPublicKey);

      if (lpMintInfo.value?.data && 'parsed' in lpMintInfo.value.data) {
        const supply = parseInt(lpMintInfo.value.data.parsed.info.supply);
        this.logger.debug(`LP mint ${lpMintAddress} total supply: ${supply}`);
        return supply;
      }

      this.logger.warn(`Could not parse LP mint info for ${lpMintAddress}`);
      return 0;
    } catch (error) {
      this.logger.error(
        `Error getting LP mint supply for ${lpMintAddress}:`,
        error,
      );
      return 0;
    }
  }

  // Get user's liquidity position summary (useful for quick checks)
  async getUserLiquidityPositions(userId: string) {
    try {
      const lpBalances = await this.getUserLpTokenBalances(userId);
      if (!lpBalances.success) {
        throw new Error(lpBalances.error);
      }

      // Define proper interface for LP data
      interface LpTokenData {
        balance: number;
        uiAmount: number;
        lpMint: string;
        userLpAccount: string;
        accountExists: boolean;
        error?: string;
      }

      const activePools: Array<{
        pool: string;
        lpAmount: number;
        lpMint: string;
        userLpAccount: string;
      }> = [];

      let totalLpValue = 0;

      // Ensure lpTokens exists and is defined
      if (lpBalances.lpTokens) {
        for (const [poolType, lpData] of Object.entries(
          lpBalances.lpTokens,
        ) as Array<[string, LpTokenData]>) {
          if (lpData && lpData.balance > 0) {
            activePools.push({
              pool: poolType,
              lpAmount: lpData.uiAmount,
              lpMint: lpData.lpMint,
              userLpAccount: lpData.userLpAccount,
            });
            totalLpValue += lpData.uiAmount;
          }
        }
      }

      return {
        success: true,
        data: {
          activePoolsCount: activePools.length,
          activePools: activePools,
          totalLpTokens: totalLpValue,
          walletAddress: lpBalances.walletAddress,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get user liquidity positions for userId ${userId}:`,
        error,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
