import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { EmbeddingsService } from 'src/embeddings/embeddings.service';
import { LlmService } from 'src/llm/llm.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly embeddings: EmbeddingsService,
    private readonly llm: LlmService,
  ) {}

  @Get()
  async health() {
    let database = 'ok';
    try {
      await this.db.query('SELECT 1');
    } catch {
      database = 'unavailable';
    }
    return {
      status: database === 'ok' ? 'ok' : 'degraded',
      database,
      embeddingProvider: this.embeddings.providerName,
      embeddingDim: this.embeddings.dimension,
      llmEnabled: this.llm.enabled,
    };
  }
}
