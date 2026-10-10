import { readFileSync, writeFileSync } from 'node:fs';
import { inspectRecordingFrames } from './browser-recording.mjs';
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ?? 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const out = 'artifacts/p3b33/visual', results = [];
try {
  for (const width of [350, 390]) for (const variant of ['P1', 'P2', 'P3']) {
    const path = `${out}/${variant}-${width}`, bytes = readFileSync(`${path}.webm`);
    await inspectRecordingFrames(browser, bytes, width, path, [2, 10]);
    results.push({ variant, width, bytes: bytes.length, decodedAndSeekedSeconds: [2, 10] });
  }
  writeFileSync(`${out}/media-check.json`, JSON.stringify(results, null, 2));
} finally { await browser.close(); }
