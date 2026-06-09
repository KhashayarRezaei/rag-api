/**
 * Rerank the ANN candidate set by blending the vector similarity with a BM25
 * lexical-overlap score computed over the candidates themselves. Dense retrieval
 * has strong recall but can rank a topically-similar chunk above the one that
 * literally answers the question; the lexical signal is a cheap, no-infra way to
 * sharpen precision in the top-k that get cited.
 */
const K1 = 1.5;
const B = 0.75;
const LEXICAL_WEIGHT = 0.35;

const tokenize = (s: string): string[] => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];

function minMax(values: number[]): number[] {
  if (values.length === 0) return [];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (hi - lo < 1e-12) return values.map(() => 0.5);
  return values.map((v) => (v - lo) / (hi - lo));
}

function bm25Scores(query: string, docs: string[][]): number[] {
  const n = docs.length;
  if (n === 0) return [];
  const avgLen = docs.reduce((s, d) => s + d.length, 0) / n;
  const df = new Map<string, number>();
  for (const d of docs) for (const term of new Set(d)) df.set(term, (df.get(term) ?? 0) + 1);
  const qTerms = new Set(tokenize(query));

  return docs.map((d) => {
    const tf = new Map<string, number>();
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);
    const dl = d.length || 1;
    let score = 0;
    for (const term of qTerms) {
      const freq = tf.get(term);
      if (!freq) continue;
      const idf = Math.log(1 + (n - df.get(term)! + 0.5) / (df.get(term)! + 0.5));
      score += idf * ((freq * (K1 + 1)) / (freq + K1 * (1 - B + (B * dl) / avgLen)));
    }
    return score;
  });
}

export interface Ranked {
  index: number;
  relevanceScore: number;
}

export function rerank(query: string, texts: string[], similarities: number[]): Ranked[] {
  if (texts.length === 0) return [];
  const vecN = minMax(similarities);
  const lexN = minMax(bm25Scores(query, texts.map(tokenize)));
  const blended = texts.map((_, i) => (1 - LEXICAL_WEIGHT) * vecN[i] + LEXICAL_WEIGHT * lexN[i]);
  return texts
    .map((_, i) => ({ index: i, relevanceScore: blended[i] }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}
