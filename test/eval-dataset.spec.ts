import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');

interface Question {
  question: string;
  expected_keywords: string[];
}

function loadQuestions(): Question[] {
  return readFileSync(join(ROOT, 'eval', 'questions.jsonl'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => JSON.parse(l) as Question);
}

describe('eval dataset', () => {
  const questions = loadQuestions();

  it('has at least 15 question/answer pairs (the differentiator)', () => {
    expect(questions.length).toBeGreaterThanOrEqual(15);
  });

  it('every gold keyword actually appears in the corpus', () => {
    const dir = join(ROOT, 'eval', 'corpus');
    const corpus = readdirSync(dir)
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .join(' ')
      .toLowerCase()
      .replace(/\s+/g, ' '); // mirror the chunker's whitespace normalization
    for (const q of questions) {
      for (const kw of q.expected_keywords) {
        expect(corpus.includes(kw.toLowerCase())).toBe(true);
      }
    }
  });
});
