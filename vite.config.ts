import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const projectDirectory = fileURLToPath(new URL('.', import.meta.url));
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};
function readShortSha(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'],
      { cwd: projectDirectory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return 'unknown'; }
}
const shortSha = readShortSha();

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/topwar/' : '/',
  define: {
    __TOPWAR_VERSION__: JSON.stringify(version),
    __TOPWAR_SHA__: JSON.stringify(shortSha),
  },
  plugins: [{
    name: 'art-showcase-dev-route',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = request.url ?? '';
        if (request.method === 'GET' && url.split('?')[0] === '/__topwar/build-info') {
          response.setHeader('Content-Type', 'application/json');
          response.setHeader('Cache-Control', 'no-store');
          response.end(JSON.stringify({ shortSha: readShortSha() }));
          return;
        }
        if (url.split('?')[0] !== '/art-showcase') return next();
        response.writeHead(302, { Location: `/art-showcase/${url.includes('?') ? url.slice(url.indexOf('?')) : ''}` });
        response.end();
      });
    },
  }],
}));
