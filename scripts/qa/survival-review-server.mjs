import { createServer } from 'vite';
// Private cache/watch scope lets diagnosis artifacts grow without interrupting DEV play.
const server = await createServer({ cacheDir: 'artifacts/p3b6b1/dev-cache',
  server: { host: '127.0.0.1', port: 5175, strictPort: true, watch: { ignored: ['**/artifacts/**'] } } });
await server.listen();console.log('Survival review QA server http://127.0.0.1:5175/');
