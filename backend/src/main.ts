import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ConsoleLogger } from '@nestjs/common';

// Custom logger that filters debug logs in production
class ProductionLogger extends ConsoleLogger {
  debug(message: any, ...optionalParams: any[]) {
    if (process.env.NODE_ENV !== 'production') {
      super.debug(message, ...optionalParams);
    }
  }

  verbose(message: any, ...optionalParams: any[]) {
    if (process.env.NODE_ENV !== 'production') {
      super.verbose(message, ...optionalParams);
    }
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production' 
      ? new ProductionLogger() 
      : undefined, // Use default logger in development
  });

  // Enable CORS for frontend
  app.enableCors({
  origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'https://solana-amm-educational-template.vercel.app',
      'http://localhost:3000',
    ],
    credentials: true,
  });

  const port = process.env.PORT || 3001;

  await app.listen(port);

  logger.log(`Solana AMM Backend running on port ${port}`);
  logger.log(
    `Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`,
  );
  logger.log(`WebSocket ready for connections`);
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});