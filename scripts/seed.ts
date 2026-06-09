/**
 * Ingest the eval corpus through the running API (POST /documents) and poll each
 * ingestion job until it is ready. Usage: `npm run seed`.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const API_URL = process.env.API_URL ?? 'http://localhost:8000';
const CORPUS_DIR = join(__dirname, '..', 'eval', 'corpus');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const files = readdirSync(CORPUS_DIR).filter((f) => /\.(md|txt)$/.test(f));
  const jobs: { file: string; jobId: string }[] = [];

  for (const file of files) {
    const text = readFileSync(join(CORPUS_DIR, file), 'utf8');
    const res = await fetch(`${API_URL}/documents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: file.replace(/\.[^.]+$/, ''), text }),
    });
    if (!res.ok) throw new Error(`POST /documents failed for ${file}: ${res.status} ${await res.text()}`);
    const { jobId } = (await res.json()) as { jobId: string };
    jobs.push({ file, jobId });
    console.log(`queued ${file} -> job ${jobId}`);
  }

  console.log(`\nwaiting for ${jobs.length} ingestion jobs...`);
  const deadline = Date.now() + 120_000;
  const pending = new Map(jobs.map((j) => [j.jobId, j.file]));
  while (pending.size > 0 && Date.now() < deadline) {
    for (const [jobId, file] of [...pending]) {
      const res = await fetch(`${API_URL}/documents/${jobId}/status`);
      const s = (await res.json()) as { documentStatus: string | null; chunkCount: number | null; error: string | null };
      if (s.documentStatus === 'ready') {
        console.log(`  ${file} ready (${s.chunkCount} chunks)`);
        pending.delete(jobId);
      } else if (s.documentStatus === 'failed') {
        console.error(`  ${file} FAILED: ${s.error}`);
        pending.delete(jobId);
      }
    }
    if (pending.size > 0) await sleep(1000);
  }
  if (pending.size > 0) {
    console.error(`timed out waiting for: ${[...pending.values()].join(', ')}`);
    process.exit(1);
  }
  console.log('all documents ready.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
