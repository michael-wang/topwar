import { defineConfig } from 'vite';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/topwar/' : '/',
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
