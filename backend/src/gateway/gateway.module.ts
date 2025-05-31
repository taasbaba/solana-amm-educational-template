import { Module } from '@nestjs/common';
import { AppGateway } from './app.gateway';
import { SolanaModule } from '../solana/solana.module';
import { CacheModule } from '../cache/cache.module';
import { DatabaseModule } from '../database/database.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [SolanaModule, CacheModule, DatabaseModule, UsersModule],
  providers: [AppGateway],
  exports: [AppGateway],
})
export class GatewayModule {}