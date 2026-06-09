import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { LlmModule } from './llm/llm.module';
import { DocumentsModule } from './documents/documents.module';
import { QueryModule } from './query/query.module';
import { HealthController } from './health/health.controller';

function parseRedisUrl(url: string): { host: string; port: number; password?: string } {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 6379,
    password: u.password || undefined,
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          ...parseRedisUrl(config.get<string>('redisUrl')!),
          maxRetriesPerRequest: null,
        },
      }),
    }),
    DatabaseModule,
    EmbeddingsModule,
    LlmModule,
    DocumentsModule,
    QueryModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
