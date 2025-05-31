import { LoggerService } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export class FileLogger implements LoggerService {
  private logFilePath = path.join(__dirname, '../../../logs/app.log');

  log(message: string) {
    this.writeToFile('LOG', message);
  }

  error(message: string, trace?: string) {
    this.writeToFile('ERROR', `${message}\nTRACE: ${trace}`);
  }

  warn(message: string) {
    this.writeToFile('WARN', message);
  }

  debug(message: string) {
    this.writeToFile('DEBUG', message);
  }

  verbose(message: string) {
    this.writeToFile('VERBOSE', message);
  }

  private writeToFile(level: string, message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}\n`;
    fs.appendFileSync(this.logFilePath, logMessage, { encoding: 'utf8' });
  }
}
