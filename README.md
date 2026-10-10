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

Development `/` starts normal Level 1 with the accepted P3 Ink Spear projectile, identical to production. The top-left DEV menu contains exactly LATE (playable Lv6 / one MG), CRATE3 (Lv3 teaching Supply / three Grenade transfers), CRATE8 (Lv8 recurring Supply / one transfer), and NAVAL (Destroyer / Observer encounter). The existing balance/audio controls remain. Selection or Retry restores the deterministic fixture and clears presentation feedback; a development-only visual salt varies splashes without affecting simulation. Reload to return to normal play. The projectile selector and 4/5/6 shortcuts are removed. Historical Rifle, Grenade, evolution, MG, Carnival and artillery scenarios remain available through test-only helpers; see `scripts/qa/README.md`. Production excludes DEV controls and fixture code.

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
