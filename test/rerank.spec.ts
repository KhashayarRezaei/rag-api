import { rerank } from 'src/rerank/rerank';

describe('rerank', () => {
  it('returns a full permutation of the candidate indexes', () => {
    const ranked = rerank('alpha', ['alpha', 'beta', 'gamma'], [0.3, 0.2, 0.1]);
    expect(ranked.map((r) => r.index).sort()).toEqual([0, 1, 2]);
  });

  it('promotes the keyword-matching chunk above a higher-similarity distractor', () => {
    // index 0 has the highest raw vector similarity but no query terms; index 1
    // has mid similarity and strong lexical overlap — the blend should surface it.
    const texts = [
      'general background information about the company and its history and mission',
      'engineers roll back a deployment using the nwctl rollback command',
      'the on-call rotation hands off every monday morning',
    ];
    const ranked = rerank('how do I roll back a deployment with a command', texts, [0.9, 0.7, 0.5]);
    expect(ranked[0].index).toBe(1);
  });
});
