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
