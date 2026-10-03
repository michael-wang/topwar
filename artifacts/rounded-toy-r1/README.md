# Rounded Toy R1 evidence

Baseline is Phase 4C, 67b81f70a9453e199330960e65298692790b1b27. The documentation-only pivot commit precedes runtime changes.

## Base-role checkpoint

`base-role-checkpoint.png`, `base-player/grunt-isolated-front/rear/side.png`, `base-review-opening.png`, silhouette/gait images and `base-stats.json` were captured and reviewed before starting Heavy/Giant. Actual portrait composition retains clear blue defenders, distinct olive Grunt, visible separated feet and weapon direction. Crown/root scales are retained. No readability regression was observed; this is pending human form-language approval.

571 tests / 80 files, typecheck and build passed at the base-role checkpoint. The final threat commit adds zero/two-Giant HP coverage: **572 tests / 80 files**, typecheck and build pass. Build transforms 207 modules. Existing Zod annotation warnings and the >500 kB JavaScript chunk warning remain.

## Human review entry points

- [Four-role beauty sheet](four-role-beauty-sheet.png) is the primary form review.
- [Four-role Phase 4C → R1 comparison](four-role-before-after.png).
- [Front three-quarter views](front-three-quarter-sheet.png), [side views](side-view-sheet.png), [helmet sheet](helmet-comparison-sheet.png), [footwear comparison](footwear-before-after.png).
- [Actual-projection black silhouettes](silhouette-sheet.png). These retain actual relative screen occupancy; inspection/beauty images use closer cameras to show form and are not a scale chart.
- [Level-7 opening](polish-review-opening.png), [mixed battlefield](polish-mixed-threats.png), [normal live battlefield](normal-live-battlefield.png).
- [Player lane strip](player-gait-confirmation.png), [Grunt 360 ms](grunt-gait-confirmation.png), [Heavy 650 ms](heavy-gait-confirmation.png), [Giant 850 ms](giant-gait-confirmation.png).
- [R1 real running sequence](polish-running.gif), [Phase 4C sequence](baseline-running.gif), [R1 temporal contact sheet](polish-temporal-contact-sheet.png). Each GIF contains 51 frames over 2.5 seconds at 50 ms intervals, using the real application frame path and ordinary simulation.
- [Giant full/half/low/zero HP comparison](giant-hp-containment.png).
- Raw `polish-heavy-hit/death/contact.png`, `polish-giant-reveal/hit/fall/crash/debris.png` retain the existing feedback beats with the new role geometry.

Portrait captures use a **390×844 CSS viewport, DPR 2** (780×1688 image pixels), actual coastal lighting and camera for gameplay/gait/silhouette views. Inspection views change only QA camera distance, background and visibility. No shipping screenshot harness or dependency was added.

## Implemented form

Player is a blue bean-bodied toy with spherical head/hands, wrapping shell and ellipsoidal rifle receiver/stock/grip. A uniform accent follows torso curvature in the existing fourth mesh slot. Grunt is one olive shirt/shorts bean with ball hands and a curved helmet shell. Heavy is a wide barrel with huge separate fists; its curved shell has a high front opening and lowered cheek/rear protection, 0.74 nominal front/back depth and 0.02 shell thickness. Giant has one uninterrupted rounded body, one soft broad crest and a rounded maul; no chest or collar geometry remains.

All four shoes use the same short ellipsoid/bean helper, flattened underneath and wider than long. Player upper/sole: **#778E9C / #647B88**. Enemy upper/sole: **#7D8B84 / #667770**. Sole color is a region inside the same geometry, without another draw or texture. Boss shoes and silhouette remain Phase 4C; separate Boss guard captures prove they are unchanged.

Giant HP defines both authored billboard dimensions: **1.20 × 0.20**, a **6:1** ratio. Both dimensions use the same visual X scale; two-Giant layout multiplies both by 0.8. The existing frame-space clipping remains. The rendered pixel check finds zero coral pixels outside the inner track at full/half/low HP; zero HP hides the fill. Unit tests cover nonuniform character scaling, two Giants, moving centers and pool reuse for Heavy.

360/650/850 ms enemy clocks, four static poses, foot lift, outward step, weight transfer and hand counter-swing are retained. Player motion factory, weapon-local muzzle, firing/reinforcement/tier/Level-Up/hit/casualty and their presentation metadata are unchanged. No gameplay/config/snapshot/app-boot code changed.

## Validation

`review-validation.json` proves:

- Phase 4C and R1 world, Boss and Boss death guards are pixel-identical, excluding only the build stamp.
- The third commit preserves the Player/Grunt checkpoint pixels for idle, hit, death and contact.
- Temporal simulation samples match the baseline exactly.
- All captured browser scenes report no errors; full/half/low HP fill pixels remain contained.

`r1-live-sanity.json` covers development default, `?review=normal`, explicit `?review=threats`, keyboard/touch lane input, real combat, pause/resume and Retry. Default/explicit review start at Level 7, XP 0, two defenders and arrived reinforcement with all three threats; normal starts Level 1. `production-sanity.json` verifies production default Level 1, explicit threats Level 7 and normal override Level 1. The normal live capture begins at Level 1 and runs ordinary combat for 12 seconds; Level 2 in the image was earned through normal progression (180 enemies, one defender), not a special start.

## Performance versus Phase 4C

Matching warmed fixtures, same viewport, Chrome SwiftShader; counts are renderer submissions/resources, **not measurements of real-phone frame time**. Normal = 35 Grunts + one Player; mixed threats = 35 Grunts + Heavy + Giant + two Players. Larger mixed crowds contain 20% Heavy, no population reduction.

| Fixture | Draws 4C → R1 | Triangles 4C → R1 | Geometries 4C → R1 | Textures 4C → R1 |
|---|---:|---:|---:|---:|
| Normal | 135 → 135 | 35,236 → 91,020 | 66 → 66 | 6 → 6 |
| Mixed threats | 149 → 148 | 39,186 → 101,410 | 72 → 71 | 9 → 9 |
| 50 mixed | 164 → 164 | 49,340 → 135,428 | 90 → 89 | 11 → 11 |
| 100 mixed | 185 → 185 | 88,362 → 257,330 | 90 → 89 | 11 → 11 |
| 150 mixed | 204 → 204 | 127,380 → 379,228 | 90 → 89 | 11 → 11 |
| 200 mixed | 224 → 224 | 166,400 → 501,128 | 90 → 89 | 11 → 11 |
| Two Giants | 146 → 144 | 13,252 → 21,940 | 90 → 89 | 12 → 12 |

The smoother head/body/shoe curves and thick two-surface shells increase crowd triangles approximately **2.6–3.0×**. This is the main R1 cost and needs device review; bounded draw counts do not establish mobile performance by themselves. Hidden Giant secondary geometry saves one mesh draw per live Giant and one uploaded geometry. Empty adapters retain existing ownership/disposal contracts. Instancing, bounded effects and tiny Giant slot count remain.

Matched production bundle comparison (`bundle-comparison.json`): JavaScript **977,933 → 975,474 bytes (−2,459)**; gzip **264,497 → 263,680 (−817)**. Thirteen legacy GLB downloads remain **356,172 bytes**, unchanged. No new textures, GLBs, downloaded art or runtime packages.

## Reproduction

Use the declared Node version and `npm run dev` on port 5173. QA scripts use the existing locally bundled Playwright and Chrome paths recorded in each script:

```text
node artifacts/rounded-toy-r1/capture.mjs baseline
node artifacts/rounded-toy-r1/capture.mjs polish
node artifacts/rounded-toy-r1/temporal.mjs baseline
node artifacts/rounded-toy-r1/temporal.mjs polish
python artifacts/rounded-toy-r1/review.py
node artifacts/rounded-toy-r1/live-sanity.mjs r1
node artifacts/rounded-toy-r1/normal-live.mjs
npm run build
node artifacts/rounded-toy-r1/production-sanity.mjs
node artifacts/rounded-toy-r1/compare-bundles.mjs
```

The baseline adapter reads the verified Git commit into Vite; it never resets or checks out the workspace. Raw temporal frame directories are ignored; GIF/contact sheets and JSON are committed. Base-checkpoint images are historical evidence captured before Heavy/Giant; reproducing that checkpoint requires commit 2.

## Remaining human-review concerns

Helmet/footwear silhouette edges still reveal limited segment counts at extreme enlargement, while key surfaces use smooth normals. Eyes remain small low-segment geometry. The rounded rifle/maul can look very toy-like in frontal compression and should be judged in the actual battlefield. Heavy's front opening and deep rear shell need human approval as a form, beyond the tested depth/sightlines. The crowd triangle increase is substantial and has no real-device timing measurement yet. Boss remains legacy and **Boss Rounded Toy migration** is explicitly deferred. No further polish, Boss, world, UI, naval or deployment work begins without feedback.
