import { Module } from '@nestjs/common';
import { SolanaService } from './solana.service';
import { ProgramService } from './program/program.service';
import { PoolWatcher } from './watchers/pool.watcher';
import { CacheModule } from '../cache/cache.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [CacheModule, DatabaseModule],
  providers: [SolanaService, ProgramService, PoolWatcher],
  exports: [SolanaService, ProgramService, PoolWatcher],
})
export class SolanaModule {}