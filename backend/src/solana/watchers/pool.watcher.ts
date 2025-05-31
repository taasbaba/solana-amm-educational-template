import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ProgramService } from '../program/program.service';
import { MemoryCacheService } from '../../cache/memory-cache.service';

@Injectable()
export class PoolWatcher {
  private readonly logger = new Logger(PoolWatcher.name);
  private readonly poolTypes = ['NTD-USD', 'USD-YEN', 'NTD-YEN'];
  
  // Devnet protection variables
  private poolDataFailures = 0;
  private readonly MAX_FAILURES = 3;      // Lock transactions after 3 failures
  private readonly MAX_DOWNTIME = 20;     // Consider devnet down after 20 failures (1 min)
  private isDevnetDown = false;
  private isTransactionsLocked = false;

  constructor(
    private programService: ProgramService,
    private cacheService: MemoryCacheService,
  ) {}

  // Watch all pools every 3 seconds to minimize RPC calls
  @Cron('*/3 * * * * *')
  async updateAllPools() {
    try {
      this.logger.debug('Updating all pool states...');
      
      const poolsData = {};
      let successfulPools = 0;
      
      const updatePromises = this.poolTypes.map(async (poolType) => {
        try {
          const poolState = await this.programService.getPoolState(poolType);
          if (poolState) {
            poolsData[poolType] = poolState;
            this.cacheService.setPoolState(poolType, poolState);
            successfulPools++;
            this.logger.debug(`Updated ${poolType} pool state`);
          } else {
            this.logger.warn(`Failed to get ${poolType} pool state`);
          }
        } catch (error) {
          this.logger.error(`Error updating ${poolType} pool:`, error);
        }
      });

      await Promise.all(updatePromises);

      // Check if we got any pool data
      if (successfulPools > 0) {
        // Success - reset failure counter
        this.poolDataFailures = 0;
        this.isTransactionsLocked = false;
        this.isDevnetDown = false;
        
        // Update all pools cache
        this.cacheService.setAllPoolsState(poolsData);
        this.logger.debug(`Updated ${successfulPools} pools in cache`);
      } else {
        // No pools updated - count as failure
        throw new Error('No pool data could be fetched');
      }

    } catch (error) {
      // Increment failure counter
      this.poolDataFailures++;
      this.logger.warn(`Pool fetch failed ${this.poolDataFailures}/${this.MAX_DOWNTIME} - ${error.message}`);
      
      // Lock transactions after MAX_FAILURES
      if (this.poolDataFailures >= this.MAX_FAILURES && !this.isTransactionsLocked) {
        this.isTransactionsLocked = true;
        this.logger.warn('TRANSACTIONS LOCKED - Devnet appears unstable');
      }
      
      // Mark devnet as down after MAX_DOWNTIME
      if (this.poolDataFailures >= this.MAX_DOWNTIME && !this.isDevnetDown) {
        this.isDevnetDown = true;
        this.logger.error('DEVNET IS DOWN - Entering maintenance mode');
      }
    }
  }

  // Get current pools state from cache
  getAllPoolsFromCache() {
    return this.cacheService.getAllPoolsState();
  }

  // Get specific pool from cache
  getPoolFromCache(poolType: string) {
    return this.cacheService.getPoolState(poolType);
  }

  // Force refresh a specific pool
  async forceRefreshPool(poolType: string) {
    try {
      this.logger.debug(`Force refreshing ${poolType} pool...`);
      const poolState = await this.programService.getPoolState(poolType);
      
      if (poolState) {
        this.cacheService.setPoolState(poolType, poolState);
        this.logger.debug(`Force refreshed ${poolType} pool successfully`);
        return poolState;
      } else {
        this.logger.warn(`Failed to force refresh ${poolType} pool`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Error force refreshing ${poolType} pool:`, error);
      return null;
    }
  }

  // Manual trigger for all pools update (useful for testing)
  async manualUpdateAllPools() {
    this.logger.log('Manual update triggered for all pools');
    await this.updateAllPools();
  }

  // Devnet status getters
  isTransactionLocked(): boolean {
    return this.isTransactionsLocked;
  }

  isDevnetOffline(): boolean {
    return this.isDevnetDown;
  }

  getFailureCount(): number {
    return this.poolDataFailures;
  }

  // Get devnet status for frontend
  getDevnetStatus() {
    return {
      isDown: this.isDevnetDown,
      isTransactionsLocked: this.isTransactionsLocked,
      failureCount: this.poolDataFailures,
      maxFailures: this.MAX_FAILURES,
      maxDowntime: this.MAX_DOWNTIME
    };
  }

  // Manual reset for testing/admin purposes
  resetDevnetStatus() {
    this.poolDataFailures = 0;
    this.isTransactionsLocked = false;
    this.isDevnetDown = false;
    this.logger.log('Devnet status manually reset');
  }
}