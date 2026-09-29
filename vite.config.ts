import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const projectDirectory = fileURLToPath(new URL('.', import.meta.url));
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};
let shortSha = 'unknown';
try {
  shortSha = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'],
    { cwd: projectDirectory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch { /* A source archive can be built without Git metadata. */ }

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
        if (url.split('?')[0] !== '/art-showcase') return next();
        response.writeHead(302, { Location: `/art-showcase/${url.includes('?') ? url.slice(url.indexOf('?')) : ''}` });
        response.end();
      });
    },
  }],
}));
