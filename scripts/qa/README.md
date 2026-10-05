# Browser sanity

Run from the repository root with the existing Playwright/Chrome QA runtime:

```sh
node scripts/qa/live-sanity.mjs
node scripts/qa/production-sanity.mjs
```

The first script requires the Vite development server and checks review/normal
starts, firing, keyboard/touch input, pause and Retry. The second requires a
current `npm run build` and opens a temporary local preview for production start
guards. Neither deploys or changes shipping code. Both fail on browser errors.

An optional first argument sets the output directory (default `artifacts/sanity`).
`TOPWAR_QA_URL` overrides the development URL. `TOPWAR_PLAYWRIGHT_MODULE` may
point to another installed Playwright module URL, and `TOPWAR_CHROME_PATH` to
another Chrome executable; defaults use the existing local QA runtime.
Historical phase-specific capture/baseline scripts remain in Git history.

## Enemy VFX Lab

Development defense builds show three compact buttons below Pause:

- **GRUNT:** ten Grunts, Lv1 / one Rifle; review contact blood, pale intact lift/fade.
- **HEAVY:** three Heavies, Lv3 / one Rifle; review surviving hits and weighted collapse.
- **GIANT:** one Giant, Lv5 / three Rifles; review chip hits, maul/dust impact and long death.

Buttons restart deterministic validated fixtures using real HP, damage and P1
progression. Switching roles clears projectiles and all presentation feedback;
Retry restarts the selected fixture. Repeated restarts vary only the development
visual salt. The lab is presentation QA, not gameplay configuration or a saved
simulation mode. Normal `/` remains Lv1 until a button is used;
`?review=threats` remains a separate art fixture. Production excludes lab controls
and fixture code behind `import.meta.env.DEV`.

`node scripts/qa/vfx-lab-sanity.mjs` verifies fixture loadouts, clearing, Retry,
repeated switching/resource reuse, 350/390 portrait and the separate normal/review
starts. It accepts the same output-directory and browser environment overrides
as the other scripts. The production sanity script also guards lab exclusion.
