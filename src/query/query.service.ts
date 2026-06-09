import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pgvector from 'pgvector/pg';
import { DatabaseService } from 'src/database/database.service';
import { EmbeddingsService } from 'src/embeddings/embeddings.service';
import { LlmService } from 'src/llm/llm.service';
import { rerank } from 'src/rerank/rerank';

export interface Source {
  chunkId: string;
  documentTitle: string;
  content: string;
  similarityScore: number;
}

export interface QueryResult {
  answer: string;
  sources: Source[];
  latencyMs: number;
}

interface CandidateRow {
  id: string;
  content: string;
  title: string;
  similarity: number;
}

@Injectable()
export class QueryService {
  constructor(
    private readonly db: DatabaseService,
    private readonly embeddings: EmbeddingsService,
    private readonly llm: LlmService,
    private readonly config: ConfigService,
  ) {}

  async query(question: string, topK?: number): Promise<QueryResult> {
    const started = Date.now();
    const k = topK ?? this.config.get<number>('retrieval.topK') ?? 5;
    const n = Math.max(this.config.get<number>('retrieval.topN') ?? 20, k);

    const qvec = await this.embeddings.embedOne(question, 'query');

    // Stage 1: ANN candidates from pgvector (cosine). probes raises IVFFlat recall.
    const candidates = await this.db.withClient(async (client) => {
      await client.query('BEGIN');
      try {
        await client.query('SET LOCAL ivfflat.probes = 10');
        const { rows } = await client.query<CandidateRow>(
          `SELECT c.id, c.content, d.title,
                  1 - (c.embedding <=> $1::vector) AS similarity
             FROM chunks c
             JOIN documents d ON d.id = c.document_id
            ORDER BY c.embedding <=> $1::vector
            LIMIT $2`,
          [pgvector.toSql(qvec), n],
        );
        await client.query('COMMIT');
        return rows;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });

    if (candidates.length === 0) {
      return { answer: "I don't know — no documents have been ingested yet.", sources: [], latencyMs: Date.now() - started };
    }

    // Stage 2: rerank, then keep top-k as the cited sources.
    const ranked = rerank(
      question,
      candidates.map((c) => c.content),
      candidates.map((c) => Number(c.similarity)),
    ).slice(0, k);

    const sources: Source[] = ranked.map(({ index }) => ({
      chunkId: candidates[index].id,
      documentTitle: candidates[index].title,
      content: candidates[index].content,
      similarityScore: Math.round(Number(candidates[index].similarity) * 10000) / 10000,
    }));

    const answer = await this.llm.generateAnswer(
      question,
      sources.map((s, i) => ({ index: i + 1, documentTitle: s.documentTitle, content: s.content })),
    );

    return { answer, sources, latencyMs: Date.now() - started };
  }
}
