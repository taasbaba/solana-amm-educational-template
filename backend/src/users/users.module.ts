import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { DatabaseModule } from '../database/database.module';
import { SolanaModule } from '../solana/solana.module';

@Module({
  imports: [DatabaseModule, SolanaModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}