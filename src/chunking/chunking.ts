/**
 * Paragraph-aware chunking with token overlap.
 *
 * Deliberate strategy (see README → Engineering decisions): pack whole
 * paragraphs up to `maxTokens`, and carry an `overlap` window of tokens between
 * consecutive chunks so a fact that straddles a boundary is still retrievable.
 * Paragraphs are the unit because sentence splitters shed surrounding context
 * and fixed-character splits cut mid-word. A paragraph longer than the budget is
 * hard-split so no chunk silently exceeds it.
 *
 * "Tokens" are whitespace-delimited words — a transparent stand-in for a model
 * tokenizer (real BPE counts run ~1.3x word counts; the 512 budget is sized
 * with that headroom).
 */
export interface Chunk {
  content: string;
  chunkIndex: number;
}

const tokenize = (s: string): string[] => s.trim().split(/\s+/).filter(Boolean);

const splitParagraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim().replace(/\s+/g, ' '))
    .filter(Boolean);

export function chunkText(text: string, maxTokens = 512, overlapTokens = 50): Chunk[] {
  if (maxTokens <= 0) throw new Error('maxTokens must be positive');
  const overlap = Math.max(0, Math.min(overlapTokens, maxTokens - 1));

  const chunks: Chunk[] = [];
  let buffer: string[] = [];

  const flush = (): void => {
    if (buffer.length === 0) return;
    chunks.push({ content: buffer.join(' '), chunkIndex: chunks.length });
  };

  for (const paragraph of splitParagraphs(text)) {
    const words = tokenize(paragraph);

    // Paragraph bigger than a whole chunk: hard-split it.
    if (words.length > maxTokens) {
      flush();
      buffer = [];
      for (let i = 0; i < words.length; i += maxTokens) {
        const window = words.slice(i, i + maxTokens);
        chunks.push({ content: window.join(' '), chunkIndex: chunks.length });
      }
      continue;
    }

    if (buffer.length + words.length > maxTokens && buffer.length > 0) {
      flush();
      buffer = overlap > 0 ? buffer.slice(-overlap) : [];
    }
    buffer.push(...words);
  }

  flush();
  return chunks;
}
