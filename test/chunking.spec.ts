import { chunkText } from 'src/chunking/chunking';

describe('chunkText', () => {
  it('produces sequential chunk indexes within the token budget', () => {
    const text = Array.from({ length: 30 }, (_, i) => `Paragraph ${i} ${'word '.repeat(40)}`).join(
      '\n\n',
    );
    const chunks = chunkText(text, 512, 50);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c) => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
    for (const c of chunks) expect(c.content.split(/\s+/).length).toBeLessThanOrEqual(512);
  });

  it('carries an overlap window between consecutive chunks', () => {
    const paras = Array.from({ length: 12 }, (_, i) => `para${i} ${'tok '.repeat(60)}`).join('\n\n');
    const chunks = chunkText(paras, 120, 20);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    const prevTail = new Set(chunks[0].content.split(/\s+/).slice(-20));
    const nextHead = new Set(chunks[1].content.split(/\s+/));
    expect([...prevTail].some((t) => nextHead.has(t))).toBe(true);
  });

  it('hard-splits a paragraph longer than the budget', () => {
    const huge = Array.from({ length: 250 }, (_, i) => `tok${i}`).join(' ');
    const chunks = chunkText(huge, 100, 0);
    expect(chunks.length).toBe(3);
    for (const c of chunks) expect(c.content.split(/\s+/).length).toBeLessThanOrEqual(100);
  });

  it('returns no chunks for empty input', () => {
    expect(chunkText('   \n\n  ', 512, 50)).toEqual([]);
  });
});
