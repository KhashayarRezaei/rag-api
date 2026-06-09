export interface AppConfig {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  gemini: {
    apiKey: string | null;
    embeddingModel: string;
    llmModel: string;
    embeddingDim: number;
  };
  chunking: {
    maxTokens: number;
    overlapTokens: number;
  };
  retrieval: {
    topN: number;
    topK: number;
  };
}

const int = (v: string | undefined, fallback: number): number => {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

export default (): AppConfig => ({
  port: int(process.env.PORT, 8000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://rag:rag@localhost:5432/rag',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || null,
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? 'text-embedding-004',
    llmModel: process.env.GEMINI_LLM_MODEL ?? 'gemini-1.5-flash',
    embeddingDim: int(process.env.EMBEDDING_DIM, 768),
  },
  chunking: {
    maxTokens: int(process.env.CHUNK_MAX_TOKENS, 512),
    overlapTokens: int(process.env.CHUNK_OVERLAP_TOKENS, 50),
  },
  retrieval: {
    topN: int(process.env.RETRIEVAL_TOP_N, 20),
    topK: int(process.env.RETRIEVAL_TOP_K, 5),
  },
});
