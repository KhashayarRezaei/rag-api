import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { createHash } from 'crypto';

export type EmbedKind = 'document' | 'query';

/**
 * Embeddings provider. Primary path is Gemini `text-embedding-004` (768-d).
 * When GEMINI_API_KEY is unset, a deterministic, dependency-free feature-hashing
 * embedder is used instead so the entire service — and the eval — runs offline
 * with no key. It is lexical (hashed uni/bi-grams, L2-normalized), not deep
 * semantics, but produces meaningful retrieval on keyword-overlapping queries.
 */
@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly dim: number;
  private readonly modelName: string;
  private readonly client: GoogleGenerativeAI | null;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.dim = config.get<number>('gemini.embeddingDim') ?? 768;
    this.modelName = config.get<string>('gemini.embeddingModel') ?? 'text-embedding-004';
    const apiKey = config.get<string | null>('gemini.apiKey');
    this.client = apiKey ? new GoogleGenerativeAI(apiKey) : null;
    this.logger.log(`embeddings provider: ${this.providerName} (dim=${this.dim})`);
  }

  get providerName(): string {
    return this.client ? `gemini:${this.modelName}` : 'hashing-fallback';
  }

  get dimension(): number {
    return this.dim;
  }

  async embed(texts: string[], kind: EmbedKind): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (this.client) return this.embedGemini(texts, kind);
    return texts.map((t) => this.hashEmbed(t));
  }

  async embedOne(text: string, kind: EmbedKind): Promise<number[]> {
    return (await this.embed([text], kind))[0];
  }

  private async embedGemini(texts: string[], kind: EmbedKind): Promise<number[][]> {
    const model = this.client!.getGenerativeModel({ model: this.modelName });
    const taskType =
      kind === 'query' ? TaskType.RETRIEVAL_QUERY : TaskType.RETRIEVAL_DOCUMENT;
    const { embeddings } = await model.batchEmbedContents({
      requests: texts.map((text) => ({
        content: { role: 'user', parts: [{ text }] },
        taskType,
      })),
    });
    return embeddings.map((e) => e.values);
  }

  /** Deterministic feature-hashing embedding, L2-normalized. */
  private hashEmbed(text: string): number[] {
    const tokens = (text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
    const grams = [...tokens];
    for (let i = 0; i + 1 < tokens.length; i++) grams.push(`${tokens[i]}_${tokens[i + 1]}`);

    const counts = new Map<string, number>();
    for (const g of grams) counts.set(g, (counts.get(g) ?? 0) + 1);

    const vec = new Array<number>(this.dim).fill(0);
    for (const [gram, count] of counts) {
      const h = createHash('md5').update(gram).digest();
      const index = h.readUInt32BE(0) % this.dim;
      const sign = h[4] & 1 ? 1 : -1;
      vec[index] += sign * (1 + Math.log(count)); // sublinear TF
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    return norm > 0 ? vec.map((v) => v / norm) : vec;
  }
}
