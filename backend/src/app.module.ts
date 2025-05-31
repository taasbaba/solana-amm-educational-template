import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SolanaModule } from './solana/solana.module';
import { DatabaseModule } from './database/database.module';
import { CacheModule } from './cache/cache.module';
import { GatewayModule } from './gateway/gateway.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    SolanaModule,
    DatabaseModule,
    CacheModule,
    GatewayModule,
    UsersModule,
  ],
  controllers: [AppController], // Make sure this is here
  providers: [AppService],
})
export class AppModule {}