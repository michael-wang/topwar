import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'artifacts/p3b4/baseline'; mkdirSync(out, { recursive: true });
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { runDifficultyPilot } = await server.ssrLoadModule('/scripts/qa/difficultyPilot.ts');
  const runs = [1, 17, 42, 99, 2026].map(seed => runDifficultyPilot(seed, seed === 17));
  writeFileSync(`${out}/metrics.json`, JSON.stringify({ policy: '60Hz, 240s, one adjacent input every 200ms; supply/nearest/Giant priority; avoid locked shell lanes; ordinary emergency grenades; no gameplay overrides', runs }, null, 2));
  console.log(JSON.stringify(runs.map(({ snapshots, waves, ...r }) => r), null, 2));
} finally { await server.close(); }
