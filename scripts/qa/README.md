# Browser sanity

## P1.5 Grenade and pressure

`node scripts/qa/p15-metrics.mjs` runs 200 deterministic comparisons: seeds 1–50, normal/1.8-second Lv3 hesitation, each with/without Grenade use. It loads the actual TypeScript simulation through Vite, needs no browser/server and writes `artifacts/p15/metrics.json` plus detailed seed-1/17/42 timelines. The controls acquire the supply but never throw, isolating use from acquisition cost. The pilot is a diagnostic, not a human-survival guarantee. `P15_REPORT.md` records policy, results and mixed evidence.

With Vite running, `node scripts/qa/p15-browser.mjs` verifies 350/390 portrait, safe-area/touch targets, one-hit acquisition, empty-lane preservation, input isolation, Pause/Retry, ten-kill XP, Heavy/Giant damage, repeated resource reuse and a warmed 200-enemy frame-time sample. Outputs use the same browser environment overrides below. Software Chrome timings are not physical-phone GPU measurements. Unit tests cover pending/spawned/held/in-flight snapshot continuation and exact kill ordering.

## Intentional web audio start

Web builds require one real user activation before audible gameplay because of
browser audio policy. TopWar holds simulation and presentation at time zero until
a viewport tap/click or Enter/Space activates audio. Gameplay then starts even if
audio is unavailable or denied; a pending browser resume is bounded to one second.
Retry in the same page session restarts immediately without another start gesture.
After backgrounding, a suspended context is resumed on the next real gesture;
this does not reset gameplay/music clocks. Browser permission to resume remains
outside the app's control. A page reload requires a new start gesture.

Run from the repository root with the existing Playwright/Chrome QA runtime:

```sh
node scripts/qa/live-sanity.mjs
node scripts/qa/production-sanity.mjs
node scripts/qa/audio-start-sanity.mjs
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

The audio-start check waits five seconds without input, then uses real touch,
mouse and keyboard activation. It checks zero pre-start clocks/cues, running
audio before the first volley, Retry, Pause and post-start Lab access. It saves
timestamped browser-screen frames and native master-bus audio for local recording
QA. The original speaker connection is preserved; no autoplay exemption is used.
Audio capture measures the browser signal, not physical device/speaker latency.

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
