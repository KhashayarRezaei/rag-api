import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DatabaseService } from 'src/database/database.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { INGESTION_QUEUE, IngestionJobData } from './ingestion.constants';

export interface DocumentRow {
  id: string;
  title: string;
  source_url: string | null;
  status: string;
  chunk_count: number;
  error: string | null;
  created_at: Date;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly db: DatabaseService,
    @InjectQueue(INGESTION_QUEUE) private readonly queue: Queue<IngestionJobData>,
  ) {}

  /** Insert a document row and enqueue its ingestion job. Returns immediately. */
  async create(dto: CreateDocumentDto): Promise<{ jobId: string; documentId: string }> {
    if (!dto.text && !dto.sourceUrl) {
      throw new BadRequestException('provide either `text` or `sourceUrl`');
    }
    const { rows } = await this.db.query<{ id: string }>(
      `INSERT INTO documents (title, source_url) VALUES ($1, $2) RETURNING id`,
      [dto.title, dto.sourceUrl ?? null],
    );
    const documentId = rows[0].id;

    const job = await this.queue.add(
      'ingest',
      { documentId, text: dto.text, sourceUrl: dto.sourceUrl },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
    return { jobId: job.id!, documentId };
  }

  async jobStatus(jobId: string): Promise<{
    jobId: string;
    state: string;
    documentId: string | null;
    documentStatus: string | null;
    chunkCount: number | null;
    error: string | null;
  }> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new BadRequestException(`no ingestion job with id ${jobId}`);
    }
    const state = await job.getState();
    const documentId = job.data.documentId ?? null;
    let documentStatus: string | null = null;
    let chunkCount: number | null = null;
    let error: string | null = job.failedReason ?? null;
    if (documentId) {
      const { rows } = await this.db.query<DocumentRow>(
        `SELECT status, chunk_count, error FROM documents WHERE id = $1`,
        [documentId],
      );
      if (rows[0]) {
        documentStatus = rows[0].status;
        chunkCount = rows[0].chunk_count;
        error = error ?? rows[0].error;
      }
    }
    return { jobId, state, documentId, documentStatus, chunkCount, error };
  }

  async list(): Promise<DocumentRow[]> {
    const { rows } = await this.db.query<DocumentRow>(
      `SELECT id, title, source_url, status, chunk_count, error, created_at
         FROM documents ORDER BY created_at DESC LIMIT 200`,
    );
    return rows;
  }
}
