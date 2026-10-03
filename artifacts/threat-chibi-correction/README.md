# Phase 4C threat correction review

Baseline: `9e67006422dbf13460f108f19c9f63419087f9a0` (Phase 4B). Two changes are independently revertable: palette/footwear, then Heavy/Giant form and Giant HP correction.

## Review entry

Local development `http://localhost:5173/` still starts Level 7, XP 0, two defenders, reinforcement arrived, seed 303216 and Grunt/Heavy/Giant. `?review=normal` starts Level 1. Production defaults Level 1; `?review=threats` is explicit review. Retry preserves the selected mode.

## Images and temporal evidence

All source PNGs are 390×844 portrait at DPR 2, using actual renderer camera/lighting. `baseline-*` uses a read-only Git-source Vite adapter; `palette-*` is the first commit; `polish-*` is the completed correction. Isolated front/rear views use a closer inspection camera; silhouettes and gait use gameplay projection. No simulation or camera changes ship.

- `enemy-palette-before-after.png`: Grunt, Heavy and Giant compared with Phase 4B.
- `player-vs-enemy-palette.png`: blue defender versus olive/slate/stone raiders.
- `footwear-before-after.png`: all five soldier families, including narrow Boss atlas footwear correction.
- `heavy-form-before-after.png`, `heavy-helmet-comparison.png`: broad bucket crown, almost flush lip and wider visible human head.
- `giant-form-before-after.png`, `giant-upper-body-comparison.png`: open shallow shoulder yoke replaces front signboard.
- `giant-hp-containment.png`: matched full/half/10%/zero bar comparison. New fill uses one full frame quad and clips inside its inner track.
- `polish-review-opening.png`, `polish-mixed-threats.png`: actual review opening and mixed battlefield.
- `silhouette-sheet.png`: feet aligned without normalizing projected role sizes. Original full portraits remain available.
- `grunt-gait-confirmation.png`, `heavy-gait-confirmation.png`, `giant-gait-confirmation.png`: nine samples per unchanged 360/650/850 ms cycle.
- `baseline-running.gif`, `polish-running.gif`: 2.5-second sequences through the actual fixed-step app/combat frame path, sampled every 50 ms. Temporal JSON proves identical simulation samples.
- `polish-heavy-hit/death/contact.png` and `polish-giant-reveal/hit/fall/crash/debris.png`: bounded feedback integration.

## Verification

569 tests across 79 files pass; typecheck and production build pass. All legacy asset hashes, role isolation, snapshot/gameplay, Player/Grunt and Boss protections remain. Existing Zod annotation warnings and >500 kB JS chunk warning remain.

`prototype-live-sanity.json` verifies dev default, normal override, explicit review, keyboard/touch, combat, pause/resume and Retry without browser errors. `production-sanity.json` verifies production default Level 1 / explicit review Level 7 / normal override Level 1.

`review-validation.json` proves pixel-identical world-only, Player silhouette and Grunt silhouette captures (only build footer excluded), identical temporal simulation samples and no rendering errors. An independent rendered-pixel check finds 34/28/43 coral pixels outside the empty inner track in the baseline full/half/low captures, versus zero in all three corrected captures (one-pixel track-edge antialias allowance). Player/Grunt/Boss silhouettes are not redesigned; intentional palette and footwear differences remain visible.

## Performance versus Phase 4B

| Fixture | Draws before/after | Triangles before/after | Geometries | Textures |
|---|---:|---:|---:|---:|
| Normal, 35 Grunts | 135 / 135 | 35,236 / 35,236 | 66 / 66 | 6 / 6 |
| Mixed, 35 Grunts + Heavy + Giant | 149 / 149 | 39,118 / 39,186 | 72 / 72 | 9 / 9 |
| 50, 20% Heavy | 164 / 164 | 49,820 / 49,340 | 90 / 90 | 11 / 11 |
| 100, 20% Heavy | 185 / 185 | 89,322 / 88,362 | 90 / 90 | 11 / 11 |
| 150, 20% Heavy | 204 / 204 | 128,820 / 127,380 | 90 / 90 | 11 / 11 |
| 200, 20% Heavy | 224 / 224 | 168,320 / 166,400 | 90 / 90 | 11 / 11 |
| Two Giants | 146 / 146 | 13,020 / 13,252 | 90 / 90 | 12 / 12 |

These are matching warmed fixture sequences on SwiftShader, not hardware FPS claims. The Heavy helmet removes 48 triangles per member; Giant yoke adds 116 per Giant. No added draw calls, loaded geometries or textures. Matched-build JS: 974,188 → 977,933 bytes (+3,745); gzip 263,276 → 264,497 (+1,221). Thirteen retained GLBs / 356,172 bytes are unchanged. No new art download or runtime package.

## Reproduce

Run `capture.mjs baseline`, `capture.mjs polish`, `temporal.mjs baseline`, `temporal.mjs polish`, `review.py`, `live-sanity.mjs`, `production-sanity.mjs` and `compare-bundles.mjs`. Scripts use this Windows development machine's installed Node/Playwright/Chrome/Pillow paths. Raw temporal frames are ignored; GIFs, contact sheets and JSON are tracked. The baseline adapter never resets the checkout.

## Human review still needed

Heavy has deliberately minimal diamond-like eyes and a broad, quiet bucket profile. Giant's collar is a strong continuous band and may need a less ring-like interpretation after human feedback. Lighter footwear is intentionally visible against sand; its relative brightness should be judged in motion on a phone. The four-pose stepping remains discrete. No automatic follow-up polish or Boss redesign is included.
