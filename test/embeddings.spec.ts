import { ConfigService } from '@nestjs/config';
import { EmbeddingsService } from 'src/embeddings/embeddings.service';

function makeService(): EmbeddingsService {
  const values: Record<string, unknown> = {
    'gemini.embeddingDim': 768,
    'gemini.embeddingModel': 'text-embedding-004',
    'gemini.apiKey': null, // -> offline fallback
  };
  const config = { get: (k: string) => values[k] } as unknown as ConfigService;
  return new EmbeddingsService(config);
}

const dot = (a: number[], b: number[]): number => a.reduce((s, v, i) => s + v * b[i], 0);

describe('EmbeddingsService (offline fallback)', () => {
  const svc = makeService();

  it('uses the fallback provider with the configured dimension', async () => {
    expect(svc.providerName).toBe('hashing-fallback');
    expect(svc.dimension).toBe(768);
    const [v] = await svc.embed(['hello world'], 'document');
    expect(v).toHaveLength(768);
    expect(Math.abs(Math.sqrt(dot(v, v)) - 1)).toBeLessThan(1e-6); // L2-normalized
  });

  it('is deterministic', async () => {
    const a = await svc.embedOne('the quick brown fox', 'document');
    const b = await svc.embedOne('the quick brown fox', 'document');
    expect(a).toEqual(b);
  });

  it('ranks a lexically related text above an unrelated one', async () => {
    const q = await svc.embedOne('how are failed jobs retried in the queue', 'query');
    const related = await svc.embedOne('a failed job is retried up to three times in the queue', 'document');
    const unrelated = await svc.embedOne('laptops are encrypted with full disk encryption', 'document');
    expect(dot(q, related)).toBeGreaterThan(dot(q, unrelated));
  });
});
