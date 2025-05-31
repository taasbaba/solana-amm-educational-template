import { Injectable } from '@nestjs/common';

interface CacheItem {
  value: any;
  expireAt: number;
}

@Injectable()
export class MemoryCacheService {
  private cache = new Map<string, CacheItem>();

  set(key: string, value: any, ttlMs: number = 5000): void {
    const expireAt = Date.now() + ttlMs;
    this.cache.set(key, { value, expireAt });

    setTimeout(() => {
      this.delete(key);
    }, ttlMs);
  }

  get(key: string): any {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expireAt) {
      this.delete(key);
      return null;
    }

    return item.value;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  setPoolState(poolType: string, state: any): void {
    const key = `pool:${poolType}`;
    this.set(key, state, 5000);
  }

  getPoolState(poolType: string): any {
    return this.get(`pool:${poolType}`);
  }

  setAllPoolsState(poolsData: Record<string, any>): void {
    const key = 'pools:all';
    this.set(key, poolsData, 5000);
  }

  getAllPoolsState(): Record<string, any> | null {
    return this.get('pools:all');
  }

  setUserBalance(userId: string, balance: any): void {
    const key = `user:${userId}:balance`;
    this.set(key, balance, 30000);
  }

  getUserBalance(userId: string): any {
    return this.get(`user:${userId}:balance`);
  }

  setUserPortfolio(userId: string, portfolio: any): void {
    const key = `user:${userId}:portfolio`;
    this.set(key, portfolio, 10000);
  }

  getUserPortfolio(userId: string): any {
    return this.get(`user:${userId}:portfolio`);
  }

  clearUserCache(userId: string): void {
    this.delete(`user:${userId}:balance`);
    this.delete(`user:${userId}:portfolio`);
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}