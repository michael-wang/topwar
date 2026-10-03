# Phase 4B threat review

Baseline: cfc61886293522121ef250c2c04f014d078297a8. Portrait 390×844, DPR 2,
Chrome/SwiftShader. QA scripts do not enter the shipping bundle.

- `start-mode-live-*`: development default, normal opt-out and explicit threats,
  keyboard/touch, firing, pause/resume and actual Retry.
- `compare-*-gait.png`: complete 360/650/850ms cycles, nine samples each.
- `baseline-running.gif` / `polish-running.gif`: 2.5s of ordinary app frame code
  and fixed-step combat, 20fps. `*-temporal.json` records all timestamps/ticks;
  simulation samples match exactly. RAF scheduling alone is replaced for capture.
- `compare-heavy-isolated-*`, `compare-giant-isolated-*`,
  `compare-heavy-silhouette.png`, `polish-silhouette-sheet.png`: form review.
- `polish-heavy-hit/death/contact`, `polish-giant-reveal/hit/fall/crash/debris/hp`:
  dedicated resource and timing validation.
- `pixel-guards.json`: Player, Boss, world and Grunt reference/feedback guards;
  ten comparisons match. Only the changing build SHA footer is excluded.
- `*-stats.json`: matching normal, mixed, 50/100/150/200 and two-Giant fixtures.
  Normal: 135 draws /35236 triangles, unchanged. Mixed: 150→149 draws,
  39358→39118 triangles. Two Giants: 146 draws, 13044→13020 triangles.
  GPU geometry counts decrease by one; textures are unchanged. Removing Heavy's
  guard eliminates one populated batch draw and 228 triangles per Heavy.
- `bundle-comparison.json`: matched build stamp, 972999→973688 JS bytes,
  262819→263085 gzip. Character downloads unchanged: 13 GLBs /356172 bytes.

Reproduce from repo root with Node24: run `capture.mjs baseline`,
`capture.mjs polish`, `temporal.mjs baseline`, `temporal.mjs polish`, then
`review.py` (Python/Pillow). Start Vite at 5173; baseline adapter serves Git
sources at 5180. Raw sequence PNGs are ignored; GIFs and timestamp records ship
with this evidence. Run `live-sanity.mjs polish` separately for real-time input.

Enemy-stage checks: 562 tests /77 files, typecheck and build passed. Existing
Zod annotation and >500KB chunk warnings remain. No gameplay/config/snapshot,
Player or Boss source changed. Quantized four-pose feet and tiny face readability
remain matters for human review; no skeleton/interpolation framework was added.


## Completed naval pass / final validation

`compare-landing-craft.png` and `compare-wide-naval.png` show matching before/after
painted boats. Close craft inspection uses only the real craft, coastal water and
shipping lights, avoiding an occluding village roof. The wide view is a clearly
supplemental 844×390 QA camera; production framing is unchanged.

`final-live-*` repeats all development modes/input/combat/pause/Retry checks.
`production-sanity.json` checks the actual built bundle at `/topwar/`: default
Level 1, explicit threats Level 7, normal override Level 1. The QA server answers
an absent browser favicon with 204; no shipping behavior is changed.

`performance-final.json` uses the same warmed fixture sequence as the baseline:
normal 135 draws /35236 triangles; mixed 150→149 /39358→39118;
two Giants 146→146 /13044→13020. Representative 20% Heavy crowds:
50: 165→164 /52100→49820; 100: 186→185 /93882→89322;
150: 205→204 /135660→128820; 200: 225→224 /177440→168320.
Final GPU geometry/texture counts match baseline in each fixture. One additional
shared painted-hull geometry offsets removal of Heavy's visible guard geometry;
there are no new textures or naval draws. Counts describe this Chrome capture,
not phone FPS. Character download bytes remain unchanged.

Final matched JS bundle: 972999→974188 bytes (+1189), gzip 262819→263275 (+456).
The earlier enemy-only bundle was 973688 /263085. `bundle-comparison.json` records
the complete final pass. Build stamp is matched for exact comparisons.

`naval-pixel-guards.json` verifies no changes outside the ship horizon band
(Y430..565 at DPR2) and changing build footer, including Player/Boss/normal crowd.
Final validation: 563 tests across 77 files, typecheck and build passed, no runtime
errors in development or production sanity. Existing two Zod annotation warnings
and >500KB chunk warning remain. Nothing was deployed.

Review concerns: four static locomotion poses still produce intentional stepping
transitions; physical foot locking is approximate, not skeletal animation. Heavy
face cues remain tiny under the broad brim. Boat paint is intentionally broad and
flat; the retained pilot house remains a simple block. These need human review,
not automatic further polish. Boss/defenses are untouched.
