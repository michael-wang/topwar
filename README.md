# TopWar

TopWar is a fully static TypeScript/Vite game. It requires no backend.

## Development

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

## Publishing

With Pages Source set to GitHub Actions, deployment is **manual only**. Pushing to `main` or pushing a tag does not publish the game. Friends continue to see the last manually published build until another manual deployment succeeds.

Before the first publication, set **Repository → Settings → Pages → Build and deployment → Source: GitHub Actions**. A branch-based Pages source would publish on push and violate the manual-only rule.

To publish, open **GitHub → Actions → Deploy TopWar to GitHub Pages → Run workflow**, enter the Git ref to publish, and run it. Use `main` to publish the current main branch.

For a frozen playtest checkpoint, create and push a tag first:

```bash
git tag playtest-2026-09-25
git push origin playtest-2026-09-25
```

Then manually run the deployment workflow with `ref` set to `playtest-2026-09-25`.

Published site: [https://michael-wang.github.io/topwar/](https://michael-wang.github.io/topwar/)
