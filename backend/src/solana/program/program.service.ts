import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import * as anchor from '@coral-xyz/anchor';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import {
  createSolanaConnection,
  getSolanaConfig,
} from '../../config/solana.config';
import { IDL } from './idl';

@Injectable()
export class ProgramService implements OnModuleInit {
  private readonly logger = new Logger(ProgramService.name);
  private connection: Connection;
  private program: Program;
  private config: ReturnType<typeof getSolanaConfig>;

  // Pool type mapping with actual addresses
  // NOTE: These should match your deployed pool addresses from setup script
  private poolConfigs = {
    'NTD-USD': {
      type: 1, // Stable pool
      tokenA:
        process.env.NTD_MINT || 'EzuizPB11ShdvPgLsfXKf1U6TXxTpAbiCMBzaJyjkE7u',
      tokenB:
        process.env.USD_MINT || '5ru1xrqJtfcJfr2uEr4yr9q39RWiLUX6zaWy7PnbtR6A',
      // These will be calculated dynamically instead of hardcoded
      poolState: null, //process.env.NTD_USD_POOL_STATE || null,
      vaultA: null, //process.env.NTD_USD_VAULT_A || null,
      vaultB: null, //process.env.NTD_USD_VAULT_B || null,
    },
    'USD-YEN': {
      type: 0, // Standard pool
      tokenA:
        process.env.USD_MINT || '5ru1xrqJtfcJfr2uEr4yr9q39RWiLUX6zaWy7PnbtR6A',
      tokenB:
        process.env.YEN_MINT || '9qp6x7Y7miKUVgfQk4fy8yTwJcvSr8X6fzbxvHaJFGx5',
      poolState: null, //process.env.USD_YEN_POOL_STATE || null,
      vaultA: null, //process.env.USD_YEN_VAULT_A || null,
      vaultB: null, //process.env.USD_YEN_VAULT_B || null,
    },
    'NTD-YEN': {
      type: 2, // Concentrated pool
      tokenA:
        process.env.NTD_MINT || 'EzuizPB11ShdvPgLsfXKf1U6TXxTpAbiCMBzaJyjkE7u',
      tokenB:
        process.env.YEN_MINT || '9qp6x7Y7miKUVgfQk4fy8yTwJcvSr8X6fzbxvHaJFGx5',
      poolState: null, //process.env.NTD_YEN_POOL_STATE || null,
      vaultA: null, //process.env.NTD_YEN_VAULT_A || null,
      vaultB: null, //process.env.NTD_YEN_VAULT_B || null,
    },
  };

  onModuleInit() {
    this.connection = createSolanaConnection();
    this.config = getSolanaConfig();
    this.initializeProgram();
    this.logger.log('Program service initialized');
  }

  private initializeProgram() {
    // Create a dummy wallet for program initialization
    const dummyKeypair = Keypair.generate();
    const wallet = new Wallet(dummyKeypair);

    const provider = new AnchorProvider(this.connection, wallet, {
      commitment: 'confirmed',
    });

    this.program = new Program(IDL, provider);
  }

  // Get pool PDA address (fixed seed order)
  private async getPoolPDA(tokenAMint: PublicKey, tokenBMint: PublicKey) {
    const [poolPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool'), tokenAMint.toBuffer(), tokenBMint.toBuffer()],
      this.config.PROGRAM_ID,
    );
    return poolPDA;
  }

  // Get pool authority PDA
  private async getPoolAuthorityPDA(
    tokenAMint: PublicKey,
    tokenBMint: PublicKey,
  ) {
    const [authorityPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('pool_authority'),
        tokenAMint.toBuffer(),
        tokenBMint.toBuffer(),
      ],
      this.config.PROGRAM_ID,
    );
    return authorityPDA;
  }

  // Get LP mint PDA
  private async getLpMintPDA(tokenAMint: PublicKey, tokenBMint: PublicKey) {
    const [lpMintPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('lp_mint'), tokenAMint.toBuffer(), tokenBMint.toBuffer()],
      this.config.PROGRAM_ID,
    );
    return lpMintPDA;
  }

  // Get vault PDAs (following setup script pattern)
  private async getVaultAPDA(tokenAMint: PublicKey, tokenBMint: PublicKey) {
    const [vaultA] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault_a'), tokenAMint.toBuffer(), tokenBMint.toBuffer()],
      this.config.PROGRAM_ID,
    );
    return vaultA;
  }

  private async getVaultBPDA(tokenAMint: PublicKey, tokenBMint: PublicKey) {
    const [vaultB] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault_b'), tokenAMint.toBuffer(), tokenBMint.toBuffer()],
      this.config.PROGRAM_ID,
    );
    return vaultB;
  }

  // Helper to get pool configuration with calculated PDAs
  private async getPoolConfigWithPDAs(poolType: string) {
    const poolConfig = this.poolConfigs[poolType];
    if (!poolConfig) {
      throw new Error(`Unknown pool type: ${poolType}`);
    }

    const tokenAMint = new PublicKey(poolConfig.tokenA);
    const tokenBMint = new PublicKey(poolConfig.tokenB);

    // Calculate PDAs dynamically
    const poolState = poolConfig.poolState
      ? new PublicKey(poolConfig.poolState)
      : await this.getPoolPDA(tokenAMint, tokenBMint);

    const vaultA = poolConfig.vaultA
      ? new PublicKey(poolConfig.vaultA)
      : await this.getVaultAPDA(tokenAMint, tokenBMint);

    const vaultB = poolConfig.vaultB
      ? new PublicKey(poolConfig.vaultB)
      : await this.getVaultBPDA(tokenAMint, tokenBMint);

    const poolAuthority = await this.getPoolAuthorityPDA(
      tokenAMint,
      tokenBMint,
    );
    const lpMint = await this.getLpMintPDA(tokenAMint, tokenBMint);

    return {
      ...poolConfig,
      tokenAMint,
      tokenBMint,
      poolState,
      vaultA,
      vaultB,
      poolAuthority,
      lpMint,
    };
  }

  // Debug helper: Check user account balances and status
  async debugUserAccounts(userKeypair: Keypair, poolType: string) {
    const poolConfig = await this.getPoolConfigWithPDAs(poolType);

    const userTokenA = await getAssociatedTokenAddress(
      poolConfig.tokenAMint,
      userKeypair.publicKey,
    );
    const userTokenB = await getAssociatedTokenAddress(
      poolConfig.tokenBMint,
      userKeypair.publicKey,
    );

    this.logger.debug('=== USER ACCOUNT DEBUG ===');
    this.logger.debug(`User: ${userKeypair.publicKey.toString()}`);
    this.logger.debug(`Pool Type: ${poolType}`);

    try {
      const tokenABalance =
        await this.connection.getTokenAccountBalance(userTokenA);
      this.logger.debug(`Token A Account: ${userTokenA.toString()}`);
      this.logger.debug(
        `Token A Balance: ${tokenABalance.value.uiAmount} (${tokenABalance.value.amount})`,
      );
    } catch (error) {
      this.logger.debug(
        `Token A Account: ${userTokenA.toString()} - NOT FOUND`,
      );
    }

    try {
      const tokenBBalance =
        await this.connection.getTokenAccountBalance(userTokenB);
      this.logger.debug(`Token B Account: ${userTokenB.toString()}`);
      this.logger.debug(
        `Token B Balance: ${tokenBBalance.value.uiAmount} (${tokenBBalance.value.amount})`,
      );
    } catch (error) {
      this.logger.debug(
        `Token B Account: ${userTokenB.toString()} - NOT FOUND`,
      );
    }
  }

  // Helper: Create missing token accounts
  async createAllUserTokenAccounts(
    userKeypair: Keypair,
    poolType: string,
  ): Promise<string | null> {
    const poolConfig = await this.getPoolConfigWithPDAs(poolType);

    const userTokenA = await getAssociatedTokenAddress(
      poolConfig.tokenAMint,
      userKeypair.publicKey,
    );
    const userTokenB = await getAssociatedTokenAddress(
      poolConfig.tokenBMint,
      userKeypair.publicKey,
    );

    const instructions: TransactionInstruction[] = [];

    // Check and create Token A account
    try {
      await this.connection.getTokenAccountBalance(userTokenA);
      this.logger.debug(
        `Token A account already exists: ${userTokenA.toString()}`,
      );
    } catch (error) {
      this.logger.debug(`Creating Token A account: ${userTokenA.toString()}`);
      instructions.push(
        createAssociatedTokenAccountInstruction(
          userKeypair.publicKey,
          userTokenA,
          userKeypair.publicKey,
          poolConfig.tokenAMint,
        ),
      );
    }

    // Check and create Token B account
    try {
      await this.connection.getTokenAccountBalance(userTokenB);
      this.logger.debug(
        `Token B account already exists: ${userTokenB.toString()}`,
      );
    } catch (error) {
      this.logger.debug(`Creating Token B account: ${userTokenB.toString()}`);
      instructions.push(
        createAssociatedTokenAccountInstruction(
          userKeypair.publicKey,
          userTokenB,
          userKeypair.publicKey,
          poolConfig.tokenBMint,
        ),
      );
    }

    // Send transaction if any accounts need to be created
    if (instructions.length > 0) {
      const transaction = new Transaction().add(...instructions);

      // Use connection.sendTransaction instead of provider
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userKeypair.publicKey;
      transaction.sign(userKeypair);

      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
      );
      await this.connection.confirmTransaction(signature, 'confirmed');

      this.logger.debug(`Created token accounts. Signature: ${signature}`);
      return signature;
    }

    return null;
  }

  // Execute swap transaction with enhanced debugging
  async executeSwap(
    userKeypair: Keypair,
    poolType: string,
    amountIn: number,
    tokenType: 'A' | 'B',
    minAmountOut: number,
  ): Promise<string> {
    try {
      const poolConfig = await this.getPoolConfigWithPDAs(poolType);

      // CRITICAL FIX: Create provider with USER keypair, not dummy keypair
      const userWallet = new anchor.Wallet(userKeypair);
      const userProvider = new anchor.AnchorProvider(
        this.connection,
        userWallet, // Use the actual user wallet
        { commitment: 'confirmed' },
      );

      // Create program instance with user provider
      const userProgram = new Program(IDL, userProvider);

      // Rest of your validation code...
      const validation = await this.validatePoolSetup(poolType, userKeypair);

      if (!validation.isValid) {
        throw new Error(
          `Pool validation failed: ${validation.errors.join(', ')}`,
        );
      }

      // Get token decimals for proper conversion
      const tokenAInfo = await this.connection.getParsedAccountInfo(
        poolConfig.tokenAMint,
      );
      const tokenBInfo = await this.connection.getParsedAccountInfo(
        poolConfig.tokenBMint,
      );

      const tokenADecimals =
        (tokenAInfo.value?.data as any)?.parsed?.info?.decimals || 6;
      const tokenBDecimals =
        (tokenBInfo.value?.data as any)?.parsed?.info?.decimals || 6;

      // Convert frontend amounts to raw amounts with proper decimals
      const rawAmountIn = Math.floor(
        amountIn *
          Math.pow(10, tokenType === 'A' ? tokenADecimals : tokenBDecimals),
      );
      const rawMinAmountOut = Math.floor(
        minAmountOut *
          Math.pow(10, tokenType === 'A' ? tokenBDecimals : tokenADecimals),
      );

      // Get user token accounts
      const userTokenA = await getAssociatedTokenAddress(
        poolConfig.tokenAMint,
        userKeypair.publicKey,
      );
      const userTokenB = await getAssociatedTokenAddress(
        poolConfig.tokenBMint,
        userKeypair.publicKey,
      );

      this.logger.debug('=== SWAP DEBUG INFO ===');
      this.logger.debug(`User Public Key: ${userKeypair.publicKey.toString()}`);
      this.logger.debug(`Amount In (Raw): ${rawAmountIn}`);
      this.logger.debug(`Min Amount Out (Raw): ${rawMinAmountOut}`);

      // Ensure both token accounts exist
      await this.createAllUserTokenAccounts(userKeypair, poolType);

      // Check sufficient balance
      const aToB = tokenType === 'A';
      const sourceAccount = aToB ? userTokenA : userTokenB;

      const sourceBalance =
        await this.connection.getTokenAccountBalance(sourceAccount);

      if (parseInt(sourceBalance.value.amount) < rawAmountIn) {
        throw new Error(
          `Insufficient balance. Required: ${rawAmountIn} raw (${amountIn} tokens), ` +
            `Available: ${sourceBalance.value.amount} raw (${sourceBalance.value.uiAmount} tokens)`,
        );
      }

      this.logger.debug('=== EXECUTING SWAP ===');
      this.logger.debug(
        `Sending to program: rawAmountIn=${rawAmountIn}, rawMinAmountOut=${rawMinAmountOut}`,
      );

      // Use the user program (with proper provider) instead of this.program
      const tx = await userProgram.methods
        .swap(new BN(rawAmountIn), new BN(rawMinAmountOut), aToB)
        .accounts({
          poolState: poolConfig.poolState,
          userTokenA: userTokenA,
          userTokenB: userTokenB,
          poolTokenAVault: poolConfig.vaultA,
          poolTokenBVault: poolConfig.vaultB,
          poolAuthority: poolConfig.poolAuthority,
          userAuthority: userKeypair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc(); // No need to specify signers - the provider's wallet will sign automatically

      this.logger.debug(`Swap successful! Transaction: ${tx}`);
      return tx;
    } catch (error) {
      this.logger.error('Swap execution failed:', error);
      throw new Error(`Swap failed: ${error.message}`);
    }
  }

  // Execute add liquidity transaction
  async executeAddLiquidity(
    userKeypair: Keypair,
    poolType: string,
    amountA: number,
    amountB: number,
  ): Promise<string> {
    try {
      const poolConfig = await this.getPoolConfigWithPDAs(poolType);

      // CRITICAL FIX: Create provider with USER keypair, not dummy keypair
      const userWallet = new anchor.Wallet(userKeypair);
      const userProvider = new anchor.AnchorProvider(
        this.connection,
        userWallet,
        { commitment: 'confirmed' },
      );

      // Create program instance with user provider
      const userProgram = new Program(IDL, userProvider);

      // Get token decimals
      const tokenAInfo = await this.connection.getParsedAccountInfo(
        poolConfig.tokenAMint,
      );
      const tokenBInfo = await this.connection.getParsedAccountInfo(
        poolConfig.tokenBMint,
      );

      const tokenADecimals =
        (tokenAInfo.value?.data as any)?.parsed?.info?.decimals || 6;
      const tokenBDecimals =
        (tokenBInfo.value?.data as any)?.parsed?.info?.decimals || 6;

      // Convert to raw amounts
      const rawAmountA = Math.floor(amountA * Math.pow(10, tokenADecimals));
      const rawAmountB = Math.floor(amountB * Math.pow(10, tokenBDecimals));

      this.logger.debug('=== ADD LIQUIDITY DEBUG INFO ===');
      this.logger.debug(`User Public Key: ${userKeypair.publicKey.toString()}`);
      this.logger.debug(`Amount A (Raw): ${rawAmountA}`);
      this.logger.debug(`Amount B (Raw): ${rawAmountB}`);

      // Get user token accounts
      const userTokenA = await getAssociatedTokenAddress(
        poolConfig.tokenAMint,
        userKeypair.publicKey,
      );
      const userTokenB = await getAssociatedTokenAddress(
        poolConfig.tokenBMint,
        userKeypair.publicKey,
      );
      const userLpToken = await getAssociatedTokenAddress(
        poolConfig.lpMint,
        userKeypair.publicKey,
      );

      // Ensure all token accounts exist
      await this.createAllUserTokenAccounts(userKeypair, poolType);

      // Create LP token account if needed
      try {
        await this.connection.getTokenAccountBalance(userLpToken);
        this.logger.debug(
          `LP token account already exists: ${userLpToken.toString()}`,
        );
      } catch (error) {
        this.logger.debug(
          `Creating LP token account: ${userLpToken.toString()}`,
        );
        const createLpAccountIx = createAssociatedTokenAccountInstruction(
          userKeypair.publicKey,
          userLpToken,
          userKeypair.publicKey,
          poolConfig.lpMint,
        );

        const createTx = new Transaction().add(createLpAccountIx);
        const { blockhash } = await this.connection.getLatestBlockhash();
        createTx.recentBlockhash = blockhash;
        createTx.feePayer = userKeypair.publicKey;
        createTx.sign(userKeypair);

        const signature = await this.connection.sendRawTransaction(
          createTx.serialize(),
        );
        await this.connection.confirmTransaction(signature, 'confirmed');
        this.logger.debug(`Created LP token account: ${signature}`);
      }

      // Check sufficient balances
      const tokenABalance =
        await this.connection.getTokenAccountBalance(userTokenA);
      const tokenBBalance =
        await this.connection.getTokenAccountBalance(userTokenB);

      if (parseInt(tokenABalance.value.amount) < rawAmountA) {
        throw new Error(
          `Insufficient Token A balance. Required: ${rawAmountA} raw (${amountA} tokens), ` +
            `Available: ${tokenABalance.value.amount} raw (${tokenABalance.value.uiAmount} tokens)`,
        );
      }

      if (parseInt(tokenBBalance.value.amount) < rawAmountB) {
        throw new Error(
          `Insufficient Token B balance. Required: ${rawAmountB} raw (${amountB} tokens), ` +
            `Available: ${tokenBBalance.value.amount} raw (${tokenBBalance.value.uiAmount} tokens)`,
        );
      }

      this.logger.debug('=== EXECUTING ADD LIQUIDITY ===');
      this.logger.debug(
        `Sending to program: rawAmountA=${rawAmountA}, rawAmountB=${rawAmountB}`,
      );

      // Use the user program (with proper provider) instead of this.program
      const tx = await userProgram.methods
        .addLiquidity(new BN(rawAmountA), new BN(rawAmountB))
        .accounts({
          poolState: poolConfig.poolState,
          userTokenA: userTokenA,
          userTokenB: userTokenB,
          userLpToken: userLpToken,
          poolTokenAVault: poolConfig.vaultA,
          poolTokenBVault: poolConfig.vaultB,
          lpMint: poolConfig.lpMint,
          poolAuthority: poolConfig.poolAuthority,
          userAuthority: userKeypair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc(); // No need to specify signers - the provider's wallet will sign automatically

      this.logger.debug(`Add liquidity successful! Transaction: ${tx}`);
      return tx;
    } catch (error) {
      this.logger.error('Add liquidity execution failed:', error);
      throw new Error(`Add liquidity failed: ${error.message}`);
    }
  }

  // Execute remove liquidity transaction
  async executeRemoveLiquidity(
    userKeypair: Keypair,
    poolType: string,
    lpAmount: number,
    minAmountA: number,
    minAmountB: number,
  ): Promise<string> {
    try {
      const poolConfig = await this.getPoolConfigWithPDAs(poolType);

      // CRITICAL FIX: Create provider with USER keypair, not dummy keypair
      const userWallet = new anchor.Wallet(userKeypair);
      const userProvider = new anchor.AnchorProvider(
        this.connection,
        userWallet,
        { commitment: 'confirmed' },
      );

      // Create program instance with user provider
      const userProgram = new Program(IDL, userProvider);

      // Get LP token decimals (usually 6)
      const lpMintInfo = await this.connection.getParsedAccountInfo(
        poolConfig.lpMint,
      );
      const lpDecimals =
        (lpMintInfo.value?.data as any)?.parsed?.info?.decimals || 6;

      // Get token decimals
      const tokenAInfo = await this.connection.getParsedAccountInfo(
        poolConfig.tokenAMint,
      );
      const tokenBInfo = await this.connection.getParsedAccountInfo(
        poolConfig.tokenBMint,
      );

      const tokenADecimals =
        (tokenAInfo.value?.data as any)?.parsed?.info?.decimals || 6;
      const tokenBDecimals =
        (tokenBInfo.value?.data as any)?.parsed?.info?.decimals || 6;

      // Convert to raw amounts
      const rawLpAmount = Math.floor(lpAmount * Math.pow(10, lpDecimals));
      const rawMinAmountA = Math.floor(
        minAmountA * Math.pow(10, tokenADecimals),
      );
      const rawMinAmountB = Math.floor(
        minAmountB * Math.pow(10, tokenBDecimals),
      );

      this.logger.debug('=== REMOVE LIQUIDITY DEBUG INFO ===');
      this.logger.debug(`User Public Key: ${userKeypair.publicKey.toString()}`);
      this.logger.debug(`LP Amount (Raw): ${rawLpAmount}`);
      this.logger.debug(`Min Amount A (Raw): ${rawMinAmountA}`);
      this.logger.debug(`Min Amount B (Raw): ${rawMinAmountB}`);

      // Get user token accounts
      const userTokenA = await getAssociatedTokenAddress(
        poolConfig.tokenAMint,
        userKeypair.publicKey,
      );
      const userTokenB = await getAssociatedTokenAddress(
        poolConfig.tokenBMint,
        userKeypair.publicKey,
      );
      const userLpToken = await getAssociatedTokenAddress(
        poolConfig.lpMint,
        userKeypair.publicKey,
      );

      // Ensure all token accounts exist
      await this.createAllUserTokenAccounts(userKeypair, poolType);

      // Check if LP token account exists and has sufficient balance
      let lpBalance;
      try {
        const lpBalanceResult =
          await this.connection.getTokenAccountBalance(userLpToken);
        lpBalance = parseInt(lpBalanceResult.value.amount);
        this.logger.debug(
          `LP token balance: ${lpBalance} raw (${lpBalanceResult.value.uiAmount} tokens)`,
        );
      } catch (error) {
        throw new Error(
          `LP token account does not exist: ${userLpToken.toString()}`,
        );
      }

      if (lpBalance < rawLpAmount) {
        throw new Error(
          `Insufficient LP token balance. Required: ${rawLpAmount} raw (${lpAmount} tokens), ` +
            `Available: ${lpBalance} raw (${lpBalance / Math.pow(10, lpDecimals)} tokens)`,
        );
      }

      this.logger.debug('=== EXECUTING REMOVE LIQUIDITY ===');
      this.logger.debug(
        `Sending to program: rawLpAmount=${rawLpAmount}, rawMinAmountA=${rawMinAmountA}, rawMinAmountB=${rawMinAmountB}`,
      );

      // Use the user program (with proper provider) instead of this.program
      const tx = await userProgram.methods
        .removeLiquidity(
          new BN(rawLpAmount),
          new BN(rawMinAmountA),
          new BN(rawMinAmountB),
        )
        .accounts({
          poolState: poolConfig.poolState,
          userTokenA: userTokenA,
          userTokenB: userTokenB,
          userLpToken: userLpToken,
          poolTokenAVault: poolConfig.vaultA,
          poolTokenBVault: poolConfig.vaultB,
          lpMint: poolConfig.lpMint,
          poolAuthority: poolConfig.poolAuthority,
          userAuthority: userKeypair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc(); // No need to specify signers - the provider's wallet will sign automatically

      this.logger.debug(`Remove liquidity successful! Transaction: ${tx}`);
      return tx;
    } catch (error) {
      this.logger.error('Remove liquidity execution failed:', error);
      throw new Error(`Remove liquidity failed: ${error.message}`);
    }
  }

  // Get pool state from blockchain
  async getPoolState(poolType: string) {
    try {
      this.logger.debug(`Getting pool state for ${poolType}...`);

      const poolConfig = this.poolConfigs[poolType];
      if (!poolConfig) {
        throw new Error(`Unknown pool type: ${poolType}`);
      }

      const tokenAMint = new PublicKey(poolConfig.tokenA);
      const tokenBMint = new PublicKey(poolConfig.tokenB);

      // Use hardcoded pool state if available, otherwise calculate
      let poolPDA: PublicKey;
      if (poolConfig.poolState) {
        poolPDA = new PublicKey(poolConfig.poolState);
        // this.logger.debug(`Using hardcoded pool state: ${poolPDA.toString()}`);
      } else {
        poolPDA = await this.getPoolPDA(tokenAMint, tokenBMint);
        // this.logger.debug(`Calculated pool state: ${poolPDA.toString()}`);
      }

      // Check if pool state account exists
      const poolStateInfo = await this.connection.getAccountInfo(poolPDA);
      if (!poolStateInfo) {
        this.logger.warn(
          `Pool state account does not exist: ${poolPDA.toString()}`,
        );
        return null;
      }

      // Fetch pool account data
      const poolAccount =
        await this.program.account['poolState'].fetch(poolPDA);
      // this.logger.debug(`Pool account data:`, {
      //   tokenA: poolAccount.tokenA.toString(),
      //   tokenB: poolAccount.tokenB.toString(),
      //   lpMint: poolAccount.lpMint.toString(),
      //   feeRate: poolAccount.feeRate,
      //   poolType: poolAccount.poolType,
      // });

      // Get vault addresses - try hardcoded first, then calculate from pool data
      let vaultAAddress: PublicKey;
      let vaultBAddress: PublicKey;

      if (poolConfig.vaultA && poolConfig.vaultB) {
        // Use hardcoded vault addresses
        vaultAAddress = new PublicKey(poolConfig.vaultA);
        vaultBAddress = new PublicKey(poolConfig.vaultB);
        // this.logger.debug(
        //   `Using hardcoded vaults: A=${vaultAAddress.toString()}, B=${vaultBAddress.toString()}`,
        // );
      } else {
        // Calculate vault addresses using the actual token mints from pool state
        vaultAAddress = await this.getVaultAPDA(
          poolAccount.tokenA,
          poolAccount.tokenB,
        );
        vaultBAddress = await this.getVaultBPDA(
          poolAccount.tokenA,
          poolAccount.tokenB,
        );
        // this.logger.debug(
        //   `Calculated vaults: A=${vaultAAddress.toString()}, B=${vaultBAddress.toString()}`,
        // );
      }

      // Check if vault accounts exist before getting balances
      let vaultABalance = 0;
      let vaultBBalance = 0;

      try {
        const vaultAInfo = await this.connection.getAccountInfo(vaultAAddress);
        if (vaultAInfo) {
          const vaultABalanceResult =
            await this.connection.getTokenAccountBalance(vaultAAddress);
          vaultABalance = parseInt(vaultABalanceResult.value.amount);
          // this.logger.debug(
          //   `Vault A balance: ${vaultABalance} (${vaultABalanceResult.value.uiAmount})`,
          // );
        } else {
          this.logger.warn(
            `Vault A account does not exist: ${vaultAAddress.toString()}`,
          );
          vaultABalance = 0;
        }
      } catch (error) {
        this.logger.error(`Error getting Vault A balance: ${error.message}`);
        vaultABalance = 0;
      }

      try {
        const vaultBInfo = await this.connection.getAccountInfo(vaultBAddress);
        if (vaultBInfo) {
          const vaultBBalanceResult =
            await this.connection.getTokenAccountBalance(vaultBAddress);
          vaultBBalance = parseInt(vaultBBalanceResult.value.amount);
          // this.logger.debug(
          //   `Vault B balance: ${vaultBBalance} (${vaultBBalanceResult.value.uiAmount})`,
          // );
        } else {
          this.logger.warn(
            `Vault B account does not exist: ${vaultBAddress.toString()}`,
          );
          vaultBBalance = 0;
        }
      } catch (error) {
        this.logger.error(`Error getting Vault B balance: ${error.message}`);
        vaultBBalance = 0;
      }

      const result = {
        poolType: poolType,
        tokenA: poolAccount.tokenA.toString(),
        tokenB: poolAccount.tokenB.toString(),
        lpMint: poolAccount.lpMint.toString(),
        feeRate: poolAccount.feeRate,
        poolTypeNum: poolAccount.poolType,
        vaultABalance: vaultABalance || 0,
        vaultBBalance: vaultBBalance || 0,
        vaultAAddress: vaultAAddress.toString(),
        vaultBAddress: vaultBAddress.toString(),
        poolStateAddress: poolPDA.toString(),
      };

      // this.logger.debug(`Successfully got pool state for ${poolType}:`, result);
      return result;
    } catch (error) {
      this.logger.error(`Failed to get pool state for ${poolType}:`, error);

      // Log more details about the error
      if (error.message.includes('could not find account')) {
        this.logger.error(
          `Account not found error - this might indicate the pool was not properly initialized`,
        );
      }

      return null;
    }
  }

  async validatePoolSetup(
    poolType: string,
    userKeypair: Keypair,
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    this.logger.debug('=====================================');
    this.logger.debug(`=== VALIDATING POOL SETUP: ${poolType} ===`);
    this.logger.debug('=====================================');

    try {
      const poolConfig = await this.getPoolConfigWithPDAs(poolType);

      // 1. VALIDATE TOKEN MINTS
      this.logger.debug('=== 1. CHECKING TOKEN MINTS ===');
      const tokenAMintInfo = await this.connection.getAccountInfo(
        poolConfig.tokenAMint,
      );
      const tokenBMintInfo = await this.connection.getAccountInfo(
        poolConfig.tokenBMint,
      );

      if (!tokenAMintInfo) {
        errors.push(
          `Token A mint does not exist: ${poolConfig.tokenAMint.toString()}`,
        );
      } else {
        this.logger.debug(
          `✓ Token A Mint EXISTS: ${poolConfig.tokenAMint.toString()}`,
        );
      }

      if (!tokenBMintInfo) {
        errors.push(
          `Token B mint does not exist: ${poolConfig.tokenBMint.toString()}`,
        );
      } else {
        this.logger.debug(
          `✓ Token B Mint EXISTS: ${poolConfig.tokenBMint.toString()}`,
        );
      }

      // 2. VALIDATE POOL STATE
      this.logger.debug('=== 2. CHECKING POOL STATE ===');
      const poolStateInfo = await this.connection.getAccountInfo(
        poolConfig.poolState,
      );

      if (!poolStateInfo) {
        errors.push(
          `Pool state account does not exist: ${poolConfig.poolState.toString()}`,
        );
      } else {
        this.logger.debug(
          `✓ Pool State EXISTS: ${poolConfig.poolState.toString()}`,
        );

        try {
          const poolAccount = await this.program.account['poolState'].fetch(
            poolConfig.poolState,
          );
          this.logger.debug(`✓ Pool State Data:`);
          this.logger.debug(
            `  - Token A in pool: ${poolAccount.tokenA.toString()}`,
          );
          this.logger.debug(
            `  - Token B in pool: ${poolAccount.tokenB.toString()}`,
          );
          this.logger.debug(`  - LP Mint: ${poolAccount.lpMint.toString()}`);
          this.logger.debug(`  - Fee Rate: ${poolAccount.feeRate}`);
          this.logger.debug(`  - Pool Type: ${poolAccount.poolType}`);

          // Validate token mints match
          if (!poolAccount.tokenA.equals(poolConfig.tokenAMint)) {
            errors.push(
              `Pool Token A mismatch. Expected: ${poolConfig.tokenAMint.toString()}, Pool has: ${poolAccount.tokenA.toString()}`,
            );
          }
          if (!poolAccount.tokenB.equals(poolConfig.tokenBMint)) {
            errors.push(
              `Pool Token B mismatch. Expected: ${poolConfig.tokenBMint.toString()}, Pool has: ${poolAccount.tokenB.toString()}`,
            );
          }
        } catch (error) {
          errors.push(`Failed to parse pool state data: ${error.message}`);
        }
      }

      // 3. VALIDATE POOL VAULTS
      this.logger.debug('=== 3. CHECKING POOL VAULTS ===');
      const vaultAInfo = await this.connection.getAccountInfo(
        poolConfig.vaultA,
      );
      const vaultBInfo = await this.connection.getAccountInfo(
        poolConfig.vaultB,
      );

      if (!vaultAInfo) {
        errors.push(
          `Pool Token A vault does not exist: ${poolConfig.vaultA.toString()}`,
        );
      } else {
        this.logger.debug(
          `✓ Pool Token A Vault EXISTS: ${poolConfig.vaultA.toString()}`,
        );

        try {
          const vaultABalance = await this.connection.getTokenAccountBalance(
            poolConfig.vaultA,
          );
          this.logger.debug(
            `  - Vault A Balance: ${vaultABalance.value.amount} (${vaultABalance.value.uiAmount})`,
          );

          const vaultAParsed = await this.connection.getParsedAccountInfo(
            poolConfig.vaultA,
          );
          const vaultAOwner = (vaultAParsed.value?.data as any)?.parsed?.info
            ?.owner;
          this.logger.debug(`  - Vault A Owner: ${vaultAOwner}`);
          this.logger.debug(
            `  - Expected Owner: ${poolConfig.poolAuthority.toString()}`,
          );

          if (vaultAOwner !== poolConfig.poolAuthority.toString()) {
            errors.push(
              `Vault A owner mismatch. Expected: ${poolConfig.poolAuthority.toString()}, Actual: ${vaultAOwner}`,
            );
          }
        } catch (error) {
          errors.push(`Failed to get Vault A details: ${error.message}`);
        }
      }

      if (!vaultBInfo) {
        errors.push(
          `Pool Token B vault does not exist: ${poolConfig.vaultB.toString()}`,
        );
      } else {
        this.logger.debug(
          `✓ Pool Token B Vault EXISTS: ${poolConfig.vaultB.toString()}`,
        );

        try {
          const vaultBBalance = await this.connection.getTokenAccountBalance(
            poolConfig.vaultB,
          );
          this.logger.debug(
            `  - Vault B Balance: ${vaultBBalance.value.amount} (${vaultBBalance.value.uiAmount})`,
          );

          const vaultBParsed = await this.connection.getParsedAccountInfo(
            poolConfig.vaultB,
          );
          const vaultBOwner = (vaultBParsed.value?.data as any)?.parsed?.info
            ?.owner;
          this.logger.debug(`  - Vault B Owner: ${vaultBOwner}`);
          this.logger.debug(
            `  - Expected Owner: ${poolConfig.poolAuthority.toString()}`,
          );

          if (vaultBOwner !== poolConfig.poolAuthority.toString()) {
            errors.push(
              `Vault B owner mismatch. Expected: ${poolConfig.poolAuthority.toString()}, Actual: ${vaultBOwner}`,
            );
          }
        } catch (error) {
          errors.push(`Failed to get Vault B details: ${error.message}`);
        }
      }

      // 4. VALIDATE USER TOKEN ACCOUNTS
      this.logger.debug('=== 4. CHECKING USER TOKEN ACCOUNTS ===');
      const userTokenA = await getAssociatedTokenAddress(
        poolConfig.tokenAMint,
        userKeypair.publicKey,
      );
      const userTokenB = await getAssociatedTokenAddress(
        poolConfig.tokenBMint,
        userKeypair.publicKey,
      );

      const userTokenAInfo = await this.connection.getAccountInfo(userTokenA);
      const userTokenBInfo = await this.connection.getAccountInfo(userTokenB);

      if (!userTokenAInfo) {
        errors.push(
          `User Token A account does not exist: ${userTokenA.toString()}`,
        );
      } else {
        this.logger.debug(
          `✓ User Token A Account EXISTS: ${userTokenA.toString()}`,
        );

        try {
          const userABalance =
            await this.connection.getTokenAccountBalance(userTokenA);
          this.logger.debug(
            `  - User Token A Balance: ${userABalance.value.amount} (${userABalance.value.uiAmount})`,
          );
        } catch (error) {
          errors.push(`Failed to get User Token A balance: ${error.message}`);
        }
      }

      if (!userTokenBInfo) {
        errors.push(
          `User Token B account does not exist: ${userTokenB.toString()}`,
        );
      } else {
        this.logger.debug(
          `✓ User Token B Account EXISTS: ${userTokenB.toString()}`,
        );

        try {
          const userBBalance =
            await this.connection.getTokenAccountBalance(userTokenB);
          this.logger.debug(
            `  - User Token B Balance: ${userBBalance.value.amount} (${userBBalance.value.uiAmount})`,
          );
        } catch (error) {
          errors.push(`Failed to get User Token B balance: ${error.message}`);
        }
      }

      // 5. VALIDATE PROGRAM ID
      this.logger.debug('=== 5. CHECKING PROGRAM ===');
      this.logger.debug(`Program ID: ${this.config.PROGRAM_ID.toString()}`);
      const programInfo = await this.connection.getAccountInfo(
        this.config.PROGRAM_ID,
      );

      if (!programInfo) {
        errors.push(
          `Program does not exist: ${this.config.PROGRAM_ID.toString()}`,
        );
      } else {
        this.logger.debug(
          `✓ Program EXISTS: ${this.config.PROGRAM_ID.toString()}`,
        );
      }

      // 6. VALIDATE PDA CALCULATIONS
      this.logger.debug('=== 6. VALIDATING PDA CALCULATIONS ===');

      // Check if calculated pool PDA matches actual
      const calculatedPoolPDA = await this.getPoolPDA(
        poolConfig.tokenAMint,
        poolConfig.tokenBMint,
      );
      this.logger.debug(`Calculated Pool PDA: ${calculatedPoolPDA.toString()}`);
      this.logger.debug(
        `Actual Pool State: ${poolConfig.poolState.toString()}`,
      );

      if (!calculatedPoolPDA.equals(poolConfig.poolState)) {
        errors.push(
          `Pool PDA mismatch. Calculated: ${calculatedPoolPDA.toString()}, Actual: ${poolConfig.poolState.toString()}`,
        );
      } else {
        this.logger.debug(`✓ Pool PDA calculation matches actual`);
      }

      // Check vault PDAs
      const calculatedVaultA = await this.getVaultAPDA(
        poolConfig.tokenAMint,
        poolConfig.tokenBMint,
      );
      const calculatedVaultB = await this.getVaultBPDA(
        poolConfig.tokenAMint,
        poolConfig.tokenBMint,
      );

      if (!calculatedVaultA.equals(poolConfig.vaultA)) {
        errors.push(
          `Vault A PDA mismatch. Calculated: ${calculatedVaultA.toString()}, Actual: ${poolConfig.vaultA.toString()}`,
        );
      } else {
        this.logger.debug(`✓ Vault A PDA calculation matches actual`);
      }

      if (!calculatedVaultB.equals(poolConfig.vaultB)) {
        errors.push(
          `Vault B PDA mismatch. Calculated: ${calculatedVaultB.toString()}, Actual: ${poolConfig.vaultB.toString()}`,
        );
      } else {
        this.logger.debug(`✓ Vault B PDA calculation matches actual`);
      }

      // Final validation summary
      this.logger.debug('=====================================');
      if (errors.length === 0) {
        this.logger.debug('✅ ALL POOL VALIDATIONS PASSED');
      } else {
        this.logger.error(
          `❌ POOL VALIDATION FAILED WITH ${errors.length} ERRORS:`,
        );
        errors.forEach((error, index) => {
          this.logger.error(`  ${index + 1}. ${error}`);
        });
      }
      this.logger.debug('=====================================');

      return { isValid: errors.length === 0, errors };
    } catch (error) {
      this.logger.error('Pool validation failed:', error);
      errors.push(`Validation error: ${error.message}`);
      return { isValid: false, errors };
    }
  }
}
