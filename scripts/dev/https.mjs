// Optional trusted-certificate LAN testing. Normal npm run dev is unchanged.
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
const { TOPWAR_TLS_KEY, TOPWAR_TLS_CERT } = process.env;
if (!TOPWAR_TLS_KEY || !TOPWAR_TLS_CERT) throw Error('Set TOPWAR_TLS_KEY and TOPWAR_TLS_CERT to a certificate/key trusted by the phone for your LAN host.');
const server = await createServer({ server: { host: '0.0.0.0', port: 5173, strictPort: true,
  https: { key: readFileSync(TOPWAR_TLS_KEY), cert: readFileSync(TOPWAR_TLS_CERT) }, hmr: { protocol: 'wss' } } });
await server.listen(); server.printUrls();
