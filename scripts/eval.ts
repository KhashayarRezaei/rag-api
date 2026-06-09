/**
 * Retrieval eval harness. Runs each {question, expected_keywords} pair through
 * POST /query and reports retrieval hit-rate, average top-1 similarity, and
 * average latency. Usage: `npm run eval` (API must be running and seeded).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const API_URL = process.env.API_URL ?? 'http://localhost:8000';
const QUESTIONS = join(__dirname, '..', 'eval', 'questions.jsonl');
const TOP_K = 5;

interface Question {
  question: string;
  expected_keywords: string[];
}
interface Source {
  content: string;
  similarityScore: number;
}
interface QueryResponse {
  answer: string;
  sources: Source[];
  latencyMs: number;
}

const containsAll = (text: string, keywords: string[]): boolean => {
  const hay = text.toLowerCase();
  return keywords.every((k) => hay.includes(k.toLowerCase()));
};

async function main(): Promise<void> {
  const questions: Question[] = readFileSync(QUESTIONS, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => JSON.parse(l));

  let top1Hits = 0;
  let topKHits = 0;
  let simSum = 0;
  let latencySum = 0;

  console.log(`running retrieval eval on ${questions.length} questions (k=${TOP_K})\n`);
  for (const q of questions) {
    const res = await fetch(`${API_URL}/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: q.question, topK: TOP_K }),
    });
    if (!res.ok) throw new Error(`POST /query failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as QueryResponse;

    const top = data.sources[0];
    const top1Hit = !!top && containsAll(top.content, q.expected_keywords);
    const topKHit = data.sources.some((s) => containsAll(s.content, q.expected_keywords));
    if (top1Hit) top1Hits++;
    if (topKHit) topKHits++;
    if (top) simSum += top.similarityScore;
    latencySum += data.latencyMs;

    console.log(`  [${top1Hit ? '✓' : topKHit ? '~' : '✗'}] ${q.question.slice(0, 68)}`);
  }

  const n = questions.length;
  console.log('\n' + '='.repeat(56));
  console.log(`  Questions:                 ${n}`);
  console.log(`  Retrieval hit-rate (top-1) ${((top1Hits / n) * 100).toFixed(1)}%  (${top1Hits}/${n})`);
  console.log(`  Retrieval hit-rate (top-${TOP_K}) ${((topKHits / n) * 100).toFixed(1)}%  (${topKHits}/${n})`);
  console.log(`  Avg top-1 similarity       ${(simSum / n).toFixed(3)}`);
  console.log(`  Avg latency                ${Math.round(latencySum / n)}ms`);
  console.log('='.repeat(56));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
