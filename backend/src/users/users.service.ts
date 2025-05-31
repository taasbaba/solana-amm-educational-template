import { Injectable, Logger } from '@nestjs/common';
import { Keypair } from '@solana/web3.js';
import { SupabaseService } from '../database/supabase.service';
import { SolanaService } from '../solana/solana.service';

interface CreateWalletResult {
  success: boolean;
  wallet_address?: string;
  message: string;
  error?: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private supabaseService: SupabaseService,
    private solanaService: SolanaService,
  ) {}

  // Create wallet for new user (called via WebSocket)
  async createWalletForUser(
    userId: string,
    email: string,
  ): Promise<CreateWalletResult> {
    try {
      this.logger.log(`Creating wallet for user: ${email} (${userId})`);

      // Check if user already has a wallet
      const existingProfile = await this.supabaseService.getUserProfile(userId);
      if (existingProfile && existingProfile.wallet_address) {
        return {
          success: false,
          message: 'User already has a wallet',
          error: 'Wallet already exists',
        };
      }

      // Generate new Solana keypair
      const keypair = Keypair.generate();
      const walletAddress = keypair.publicKey.toString();
      const privateKeyBase64 = Buffer.from(keypair.secretKey).toString(
        'base64',
      );

      this.logger.log(`Generated wallet address: ${walletAddress}`);

      // Save wallet to database
      const data = await this.supabaseService.createUserProfile({
        id: userId,
        email: email,
        wallet_address: walletAddress,
        private_key_b64: privateKeyBase64,
      });

      if (!data) {
        throw new Error('Failed to save user profile to database');
      }

      this.logger.log(`Saved wallet to database for user: ${email}`);

      // Request SOL airdrop for devnet (optional)
      try {
        await this.solanaService.requestAirdrop(walletAddress, 1);
        this.logger.log(`Airdrop requested for wallet: ${walletAddress}`);
      } catch (airdropError) {
        this.logger.warn(`Airdrop failed for ${walletAddress}:`, airdropError);
        // Don't fail wallet creation if airdrop fails
      }

      // Mint initial tokens to user
      try {
        await this.mintInitialTokens(userId, keypair);
        this.logger.log(`Initial tokens minted for user: ${email}`);
      } catch (mintError) {
        this.logger.error(`Token minting failed for ${email}:`, mintError);
        // Don't fail wallet creation if minting fails
      }

      return {
        success: true,
        wallet_address: walletAddress,
        message: 'Wallet created successfully! Initial tokens have been added.',
      };
    } catch (error) {
      this.logger.error(`Wallet creation failed for user ${email}:`, error);
      return {
        success: false,
        message: 'Failed to create wallet',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Mint initial tokens to new user
  private async mintInitialTokens(
    userId: string,
    userKeypair: Keypair,
  ): Promise<void> {
    try {
      // Define initial token amounts
      const initialAmounts = {
        NTD: 100000, // 100,000 NTD
        USD: 10000, // 10,000 USD
        YEN: 1000000, // 1,000,000 YEN
      };

      // Mint tokens using Solana service
      // Note: This requires implementing token minting in SolanaService
      await this.solanaService.mintTokensToUser(
        userKeypair,
        initialAmounts.NTD,
        initialAmounts.USD,
        initialAmounts.YEN,
      );

      this.logger.log(
        `Minted initial tokens: ${JSON.stringify(initialAmounts)}`,
      );
    } catch (error) {
      this.logger.error('Failed to mint initial tokens:', error);
      throw error;
    }
  }

  // Get user profile
  async getUserProfile(userId: string) {
    return await this.supabaseService.getUserProfile(userId);
  }

  // Update user profile
  async updateUserProfile(userId: string, updates: any) {
    try {
      const data = await this.supabaseService.updateUserProfile(
        userId,
        updates,
      );

      if (data) {
        return {
          success: true,
          profile: data,
          message: 'Profile updated successfully',
        };
      } else {
        return {
          success: false,
          error: 'Failed to update profile',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
