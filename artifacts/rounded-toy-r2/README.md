# Rounded Toy R2 review

R1 baseline: `a36b3c5e09559ba0ea0b364ec3347e4d85eda25c`, verified as HEAD and fetched origin/main before editing. Captures use a 390×844 CSS portrait viewport, DPR 2, actual coastal lighting and gameplay projection except labeled close inspection views. Baseline geometry comes from the pinned Git commit through a read-only Vite adapter; the checkout is never reset.

## Combat identity

The first separately revertable commit, `fbc0e1a62a7c3df5c03b3c0781934e1b91508257`, adds trousers, short rounded cuffs and the role gear below. R1 shoes, base proportions, motion regions and gait clocks remain unchanged.

- Player: deep-blue trousers `#365973`, belt and one utility pouch `#4C6673`.
- Grunt: existing slate trousers, belt `#526358` and one flattened round canteen `#8E9987`.
- Heavy: deeper olive shirt `#59674C`, darker slate trousers `#4E6067`, deep helmet `#626F51`, broad curved diagonal harness `#989077` and two hip pouches `#7E836A`.
- Giant: strengthened existing slate trouser region, curved waist sash `#85856D` and one oversized satchel `#747F66` opposite the maul. No chest plate or harness.

All equipment is merged into the owning reference/run body. Crowd gear remains instanced; Player equipment uses the fixed torso motion region. There are no additional character draws, uploaded geometry objects or textures. Curved bands use 16 radial segments; small cuffs/pouches use 8–10, with 4–5 vertical segments. A surface-clearance test protects bands from intersecting the rounded body.

Review [R1 → R2 beauty](r1-to-r2-four-role-beauty-sheet.png), [R2 beauty](r2-four-role-beauty-sheet.png), [equal-height Grunt/Heavy](grunt-heavy-normalized-height.png), [equal-height black silhouettes](grunt-heavy-normalized-silhouettes.png), [actual-projection silhouettes](actual-projection-silhouette-sheet.png), and [trousers/footwear](trousers-footwear-relationship.png).

The normalized QA composites resize each rendered figure to exactly 320 pixels tall; this never changes runtime proportions. Black silhouette widths are 251 pixels for Grunt and 452 for Heavy. Heavy remains clearly broader, with huge fists, recessed/deep helmet, diagonal harness and paired hip equipment at equal height.

Separate [Grunt](grunt-equipment-close.png), [Heavy](heavy-equipment-close.png) and [Giant](giant-equipment-close.png) front/rear equipment views are included. `polish-*-isolated-front.png` provides front three-quarter inspection for every role. [Opening Level 7](polish-review-opening.png), [dense Grunts + Heavy](polish-one-heavy-crowd.png), [mixed threats](polish-mixed-threats.png) and [Giant normal view](polish-giant-hp.png) show actual portrait composition.

## Softer Giant surviving hits

The second commit changes ordinary surviving-hit presentation only. Giant wash is muted peach `#DDA999` at 0.24 opacity instead of the shared 0.72 near-white wash. Warm emissive peaks at 0.10 instead of 0.45. Three sparks replace six; peak scale is 0.9 instead of 1.8, opacity 0.5 instead of 1, and spread 0.30 instead of 0.50.

The 100 ms overlay, 170 ms spark decay, 250 ms impact gap, twelve-burst bounded pool, hit impulse and compression remain unchanged. One extra shared Giant overlay material is owned/disposed by the feedback system; there are no per-hit material allocations. Heavy retains its existing wash and four sparks. Lethal/death explicitly restores original core emissive color and the 0.6 multiplier; reveal/death timing remains unchanged.

Review [R1 peak → R2 peak / 50 ms / settled](giant-hit-comparison.png). Corresponding full portrait source captures are `baseline-giant-hit-peak.png`, `polish-giant-hit-peak.png`, `polish-giant-hit-50.png`, and `polish-giant-hit-settled.png`.

## Performance

Matched warmed Chrome/SwiftShader fixtures, not device FPS measurements. Normal has 35 Grunts/one Player; mixed threats adds one Heavy/one Giant and uses two Players. Larger mixed fixtures use 20% Heavy; two-Giant fixture retains two Players. Population is unchanged.

| Fixture | Draws R1 = R2 | Triangles R1 → R2 | Increase | Geometries R1 = R2 | Textures R1 = R2 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Normal | 135 | 91,020 → 99,660 | 9.49% | 66 | 6 |
| Mixed threats | 148 | 101,410 → 110,818 | 9.28% | 71 | 9 |
| Mixed 50 | 164 | 135,428 → 148,388 | 9.57% | 90 | 11 |
| Mixed 100 | 184 | 257,328 → 282,768 | 9.89% | 90 | 11 |
| Mixed 150 | 204 | 379,228 → 417,148 | 10.00% | 90 | 11 |
| Mixed 200 | 224 | 501,128 → 551,528 | 10.06% | 90 | 11 |
| Two Giants | 144 | 21,940 → 22,900 | 4.38% | 90 | 12 |

No crowd fixture exceeds 15%. Active Giant impact has three fewer spark draws; steady-state counts above are unchanged. Matched build stamps give JS 975,474 → 977,736 bytes (+2,262), gzip 263,679 → 264,444 (+765). Legacy asset downloads remain 13 GLBs / 356,172 bytes. No new GLBs, textures or packages. Exact measurements: [performance.json](performance.json), [bundle comparison](bundle-comparison.json).

## Verification and temporal evidence

- `npm test`: 578 passing tests across 82 files; all gameplay, role-isolation, R1 and legacy Boss protections retained.
- `npm run typecheck`: passed.
- `npm run build`: passed, 208 modules. Existing two Zod annotation warnings and the >500 kB chunk warning remain.
- [Live sanity](r2-live-sanity.json): default development Level 7, explicit threats Level 7, normal opt-out Level 1; keyboard/touch movement, ordinary combat, pause/resume and Retry passed without browser errors.
- [Production sanity](production-sanity.json): default Level 1, explicit threats Level 7, normal opt-out Level 1, no browser errors.
- Final world, Boss and Boss-death guards are pixel-identical. R1 Giant HP full/half/low/zero bar crops remain pixel-identical; dedicated 1.20×0.20 dimensions are unchanged.
- Real app frame path over 2.5 seconds, 51 frames at 50 ms intervals, ordinary fixed-step combat: baseline and R2 simulation samples are identical. QA replaces only the RAF scheduler and hides the build stamp.

Review [R1 running](baseline-running.gif), [R2 running](polish-running.gif), [temporal contact sheet](polish-temporal-contact-sheet.png), and [Player](player-gait-strip.png), [Grunt](grunt-gait-strip.png), [Heavy](heavy-gait-strip.png), [Giant](giant-gait-strip.png) strips. Gear does not change 360/650/850 ms enemy gait timing or detached-foot alternation. Temporal JSON retains matching ticks/enemy positions.

## Reproduce

From repository root with `npm run dev` running on port 5173:

```text
node artifacts/rounded-toy-r2/capture.mjs baseline
node artifacts/rounded-toy-r2/capture.mjs polish
node artifacts/rounded-toy-r2/live-sanity.mjs r2
node artifacts/rounded-toy-r2/temporal.mjs baseline
node artifacts/rounded-toy-r2/temporal.mjs polish
node artifacts/rounded-toy-r2/compare-bundles.mjs
python artifacts/rounded-toy-r2/review.py
npm run build
node artifacts/rounded-toy-r2/production-sanity.mjs
```

QA scripts use the existing local Playwright/Chrome and Python/Pillow runtimes, with Windows paths recorded in the scripts. They add no shipping dependency. Raw temporal frame directories are ignored; GIFs/contact sheets and results are tracked.

## Human review concerns / scope

Pant cuffs remain intentionally short and subtle at phone scale. Canteen/pouches are abstract soft volumes; close inspection shows their economical segmentation. Assess field-item recognition and softer Giant sparks during rapid combat before further polish. R1 footwear is frozen. Gameplay/config/snapshots, review workflow, world/UI/naval art and Boss are unchanged. Boss Rounded Toy migration remains deferred. Stop after R2; no deployment.
