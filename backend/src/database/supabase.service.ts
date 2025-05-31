import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateSupabaseConfig } from '../config/supabase.config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase: SupabaseClient; // Regular client for JWT verification
  private supabaseService: SupabaseClient; // Service role client for database operations

  onModuleInit() {
    const config = validateSupabaseConfig();

    // Regular client (for JWT verification only)
    this.supabase = createClient(config.url!, config.anonKey!);

    // Service role client (for all database operations - bypasses RLS)
    this.supabaseService = createClient(config.url!, config.serviceRoleKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.logger.debug(
      'SupabaseService initialized with both regular and service role clients',
    );
  }

  // JWT verification (uses regular client)
  verifyUser(token: string): any | null {
    try {
      const jwtSecret = process.env.SUPABASE_JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('SUPABASE_JWT_SECRET is not set');
      }

      // DEBUG: Log the first few characters of secret and token
      this.logger.debug(
        `JWT Secret (first 10 chars): ${jwtSecret.substring(0, 10)}`,
      );
      this.logger.debug(`Token (first 50 chars): ${token.substring(0, 50)}`);

      const decoded = jwt.verify(token, jwtSecret);
      this.logger.debug(`JWT verification successful for user: ${decoded.sub}`);
      return decoded;
    } catch (error) {
      this.logger.error(`JWT verification failed: ${error.message}`);
      this.logger.debug(`Token length: ${token.length}`);
      return null;
    }
  }

  // Alternative JWT verification using Supabase's built-in method
  async verifyUserWithSupabase(token: string) {
    try {
      const { data, error } = await this.supabase.auth.getUser(token);
      if (error) throw error;
      return data.user;
    } catch (error) {
      this.logger.error('Supabase JWT verification failed', error);
      return null;
    }
  }

  // Read user private key (uses SERVICE ROLE - bypasses RLS)
  async getUserPrivateKey(userId: string): Promise<string | null> {
    try {
      this.logger.debug(`Getting private key for user: ${userId}`);

      const { data, error } = await this.supabaseService
        .from('user_profiles')
        .select('private_key_b64')
        .eq('id', userId)
        .single();

      if (error) {
        this.logger.error('Failed to get user private key', error);
        return null;
      }

      if (data?.private_key_b64) {
        const bufferTest = Buffer.from(data.private_key_b64, 'base64');

        if (bufferTest.length !== 64) {
          console.log(
            `ERROR: Retrieved private key creates ${bufferTest.length} byte buffer instead of 64`,
          );
          console.log('This confirms the database has corrupted data');
        }
      }

      return data?.private_key_b64 || null;
    } catch (error) {
      this.logger.error('Failed to get user private key', error);
      return null;
    }
  }

  // Read user profile (uses SERVICE ROLE - bypasses RLS)
  async getUserProfile(userId: string) {
    try {
      this.logger.debug(`Getting profile for user: ${userId}`);
      const { data, error } = await this.supabaseService
        .from('user_profiles')
        .select('*')
        .eq('id', userId) // Using 'id' as per your table structure
        .single();

      if (error) {
        this.logger.error('Failed to get user profile', error);
        return null;
      }

      return data;
    } catch (error) {
      this.logger.error('Failed to get user profile', error);
      return null;
    }
  }

  // Create user profile (uses SERVICE ROLE - bypasses RLS)
  async createUserProfile(profile: {
    id: string;
    email: string;
    wallet_address: string;
    private_key_b64: string;
  }) {
    try {
      this.logger.debug(`Creating user profile for: ${profile.email}`);

      // DEBUG: Log what we're about to save
      console.log('=== BEFORE DATABASE INSERT ===');
      console.log(`Private key input: ${profile.private_key_b64}`);
      console.log(`Private key length: ${profile.private_key_b64.length}`);
      console.log(
        `Private key buffer test: ${Buffer.from(profile.private_key_b64, 'base64').length} bytes`,
      );

      const profileData = {
        id: profile.id,
        email: profile.email,
        wallet_address: profile.wallet_address,
        private_key_b64: profile.private_key_b64,
        created_at: new Date().toISOString(),
      };

      // DEBUG: Log the complete payload
      console.log('=== PAYLOAD TO DATABASE ===');
      console.log(JSON.stringify(profileData, null, 2));

      const { data, error } = await this.supabaseService
        .from('user_profiles')
        .insert(profileData)
        .select()
        .single();

      if (error) {
        this.logger.error('Failed to create user profile', error);
        throw new Error(
          `Failed to save user profile to database: ${error.message}`,
        );
      }

      // DEBUG: Log what came back from database
      console.log('=== AFTER DATABASE INSERT ===');
      console.log(`Returned private key: ${data.private_key_b64}`);
      console.log(`Returned length: ${data.private_key_b64.length}`);
      console.log(
        `Returned buffer test: ${Buffer.from(data.private_key_b64, 'base64').length} bytes`,
      );
      console.log(
        `Keys match: ${profile.private_key_b64 === data.private_key_b64}`,
      );

      if (profile.private_key_b64 !== data.private_key_b64) {
        console.log('ERROR: Database corrupted the private key during insert!');
        console.log(`Original: ${profile.private_key_b64}`);
        console.log(`Returned: ${data.private_key_b64}`);

        // Try to insert without select to see if it's the read operation
        console.log('=== TESTING INSERT WITHOUT SELECT ===');
        const { error: insertError } = await this.supabaseService
          .from('user_profiles')
          .insert({
            ...profileData,
            id: profile.id + '_test', // Different ID to avoid conflict
          });

        if (!insertError) {
          console.log(
            'Insert without select succeeded - issue is in the SELECT operation',
          );
        }
      }

      this.logger.debug('User profile created successfully', data);
      return data;
    } catch (error) {
      this.logger.error('Failed to create user profile', error);
      throw error;
    }
  }

  // Update user profile (uses SERVICE ROLE - bypasses RLS)
  async updateUserProfile(userId: string, updates: any) {
    try {
      this.logger.debug(`Updating user profile for: ${userId}`);

      const { data, error } = await this.supabaseService
        .from('user_profiles')
        .update(updates)
        .eq('id', userId) // Using 'id' as per your table structure
        .select()
        .single();

      if (error) {
        this.logger.error('Failed to update user profile', error);
        return null;
      }

      return data;
    } catch (error) {
      this.logger.error('Failed to update user profile', error);
      return null;
    }
  }

  // Record LP snapshot (uses SERVICE ROLE - bypasses RLS)
  async createLpSnapshot(snapshot: {
    user_id: string; // References user_profiles(id)
    wallet_address: string;
    lp_token_amount: number;
    token_a_amount: number;
    token_b_amount: number;
    total_value_usd?: number;
    captured_at?: string; // Optional, defaults to now() in database
  }) {
    try {
      this.logger.debug(`Creating LP snapshot for user: ${snapshot.user_id}`);

      const snapshotData = {
        user_id: snapshot.user_id,
        wallet_address: snapshot.wallet_address,
        lp_token_amount: snapshot.lp_token_amount,
        token_a_amount: snapshot.token_a_amount,
        token_b_amount: snapshot.token_b_amount,
        total_value_usd: snapshot.total_value_usd,
        captured_at: snapshot.captured_at || new Date().toISOString(),
      };

      const { data, error } = await this.supabaseService
        .from('lp_snapshots')
        .insert(snapshotData)
        .select()
        .single();

      if (error) {
        this.logger.error('Failed to create LP snapshot', error);
        return null;
      }

      return data;
    } catch (error) {
      this.logger.error('Failed to create LP snapshot', error);
      return null;
    }
  }

  // Record wallet balance (uses SERVICE ROLE - bypasses RLS)
  async createWalletBalance(balance: {
    user_id: string; // References user_profiles(id)
    wallet_address: string;
    token_a_balance: number;
    token_b_balance: number;
    captured_at?: string; // Optional, defaults to now() in database
  }) {
    try {
      this.logger.debug(`Creating wallet balance for user: ${balance.user_id}`);

      const balanceData = {
        user_id: balance.user_id,
        wallet_address: balance.wallet_address,
        token_a_balance: balance.token_a_balance,
        token_b_balance: balance.token_b_balance,
        captured_at: balance.captured_at || new Date().toISOString(),
      };

      const { data, error } = await this.supabaseService
        .from('wallet_balances')
        .insert(balanceData)
        .select()
        .single();

      if (error) {
        this.logger.error('Failed to create wallet balance', error);
        return null;
      }

      return data;
    } catch (error) {
      this.logger.error('Failed to create wallet balance', error);
      return null;
    }
  }

  // Get user by email (uses SERVICE ROLE - bypasses RLS)
  async getUserByEmail(email: string) {
    try {
      this.logger.debug(`Getting user by email: ${email}`);

      const { data, error } = await this.supabaseService
        .from('user_profiles')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - user doesn't exist
          this.logger.debug(`User not found for email: ${email}`);
          return null;
        }
        this.logger.error('Failed to get user by email', error);
        return null;
      }

      return data;
    } catch (error) {
      this.logger.error('Failed to get user by email', error);
      return null;
    }
  }

  // Check if user exists (uses SERVICE ROLE - bypasses RLS)
  async userExists(userId: string): Promise<boolean> {
    try {
      const profile = await this.getUserProfile(userId);
      return profile !== null;
    } catch (error) {
      this.logger.error('Failed to check if user exists', error);
      return false;
    }
  }

  // Get all user profiles (admin function - uses SERVICE ROLE)
  async getAllUsers() {
    try {
      const { data, error } = await this.supabaseService
        .from('user_profiles')
        .select('id, email, wallet_address, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error('Failed to get all users', error);
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error('Failed to get all users', error);
      return [];
    }
  }

  // Get LP snapshots for user (uses SERVICE ROLE - bypasses RLS)
  async getUserLpSnapshots(userId: string) {
    try {
      this.logger.debug(`Getting LP snapshots for user: ${userId}`);

      const { data, error } = await this.supabaseService
        .from('lp_snapshots')
        .select('*')
        .eq('user_id', userId)
        .order('captured_at', { ascending: false });

      if (error) {
        this.logger.error('Failed to get user LP snapshots', error);
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error('Failed to get user LP snapshots', error);
      return [];
    }
  }

  // Get wallet balances for user (uses SERVICE ROLE - bypasses RLS)
  async getUserWalletBalances(userId: string) {
    try {
      this.logger.debug(`Getting wallet balances for user: ${userId}`);

      const { data, error } = await this.supabaseService
        .from('wallet_balances')
        .select('*')
        .eq('user_id', userId)
        .order('captured_at', { ascending: false });

      if (error) {
        this.logger.error('Failed to get user wallet balances', error);
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error('Failed to get user wallet balances', error);
      return [];
    }
  }

  // Delete user profile (admin function - uses SERVICE ROLE)
  async deleteUserProfile(userId: string) {
    try {
      this.logger.debug(`Deleting user profile for: ${userId}`);

      const { error } = await this.supabaseService
        .from('user_profiles')
        .delete()
        .eq('id', userId); // Using 'id' as per your table structure

      if (error) {
        this.logger.error('Failed to delete user profile', error);
        return false;
      }

      this.logger.debug('User profile deleted successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to delete user profile', error);
      return false;
    }
  }

  // Health check method
  async healthCheck() {
    try {
      // Test service role connection
      const { data, error } = await this.supabaseService
        .from('user_profiles')
        .select('count')
        .limit(1);

      if (error) {
        this.logger.error('Health check failed', error);
        return false;
      }

      this.logger.debug('SupabaseService health check passed');
      return true;
    } catch (error) {
      this.logger.error('Health check failed', error);
      return false;
    }
  }
}
