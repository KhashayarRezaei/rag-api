import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import pgvector from 'pgvector/pg';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from 'src/database/database.service';
import { EmbeddingsService } from 'src/embeddings/embeddings.service';
import { chunkText } from 'src/chunking/chunking';
import { INGESTION_QUEUE, IngestionJobData } from './ingestion.constants';

/**
 * BullMQ worker that runs the ingestion pipeline asynchronously:
 * resolve text → chunk → embed → store chunks in pgvector → mark ready.
 * Runs in-process; BullMQ decouples it from the request and retries on failure.
 */
@Processor(INGESTION_QUEUE)
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly embeddings: EmbeddingsService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<IngestionJobData>): Promise<{ chunks: number }> {
    const { documentId, text, sourceUrl } = job.data;
    try {
      await this.db.query(
        `UPDATE documents SET status = 'processing', error = NULL WHERE id = $1`,
        [documentId],
      );

      const content = text ?? (sourceUrl ? await this.fetchUrl(sourceUrl) : '');
      const chunks = chunkText(
        content,
        this.config.get<number>('chunking.maxTokens'),
        this.config.get<number>('chunking.overlapTokens'),
      );
      if (chunks.length === 0) {
        await this.db.query(
          `UPDATE documents SET status = 'ready', chunk_count = 0 WHERE id = $1`,
          [documentId],
        );
        return { chunks: 0 };
      }

      const vectors = await this.embeddings.embed(
        chunks.map((c) => c.content),
        'document',
      );

      await this.db.withClient(async (client) => {
        await client.query('BEGIN');
        try {
          await client.query('DELETE FROM chunks WHERE document_id = $1', [documentId]);
          for (let i = 0; i < chunks.length; i++) {
            await client.query(
              `INSERT INTO chunks (document_id, content, embedding, chunk_index)
               VALUES ($1, $2, $3, $4)`,
              [documentId, chunks[i].content, pgvector.toSql(vectors[i]), chunks[i].chunkIndex],
            );
          }
          await client.query(
            `UPDATE documents SET status = 'ready', chunk_count = $2 WHERE id = $1`,
            [documentId, chunks.length],
          );
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        }
      });

      // IVFFlat clusters are trained from existing rows (k-means at build time),
      // so the index must be rebuilt after inserting data or recall collapses.
      // Fine to do per-batch at this scale; at larger scale you'd debounce this,
      // schedule periodic REINDEX, or use HNSW (which needs no training).
      await this.reindex();

      this.logger.log(`document ${documentId} ingested: ${chunks.length} chunks`);
      return { chunks: chunks.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`document ${documentId} failed: ${message}`);
      // Mark failed on the final attempt; earlier attempts will be retried.
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        await this.db.query(`UPDATE documents SET status = 'failed', error = $2 WHERE id = $1`, [
          documentId,
          message.slice(0, 2000),
        ]);
      }
      throw err;
    }
  }

  /** Retrain the IVFFlat index on current data. Non-fatal: exact scan still works. */
  private async reindex(): Promise<void> {
    try {
      await this.db.query('REINDEX INDEX chunks_embedding_ivfflat_idx');
    } catch (err) {
      this.logger.warn(`reindex skipped: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** Minimal URL ingestion: fetch and strip HTML to text (no scraping heroics). */
  private async fetchUrl(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
