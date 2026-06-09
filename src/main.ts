import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 8000;
  await app.listen(port, '0.0.0.0');
  new Logger('bootstrap').log(`rag-api listening on http://0.0.0.0:${port}`);
}

void bootstrap();
