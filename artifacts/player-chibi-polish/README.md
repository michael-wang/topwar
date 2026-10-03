# Phase 2B Player visual-language review

Baseline: `e0946f183f57b6331b9feac161d2edc0f6fa9a66` (Phase 2A).
The accepted two-head Player is refined, not replaced with a different concept.
Player base grammar is stabilized pending human approval. Enemies remain legacy;
the amphibious enemy direction is documentation-only. No deployment is included.

## Direct comparisons

- [Isolated close inspection](comparison-isolated.png).
- [Gameplay idle](comparison-idle.png).
- [Lane movement](comparison-lane.png).
- [Two defenders](comparison-two-defenders.png).
- [Black silhouette](comparison-silhouette.png).
- [Complete lane step](comparison-lane-motion-strip.png).
- [Firing/recoil](comparison-recoil-motion-strip.png).
- [Level-Up and weapon afterglow](comparison-empowerment-motion-strip.png).

Each comparison labels Phase 2A and Phase 2B. Full portraits use the actual game
camera, coastal lighting and formation at 390×844 CSS pixels, DPR 2 (780×1688
PNGs). The isolated view uses the same QA-only close camera in both versions.
Motion strips use crops from that unchanged gameplay projection; no camera zoom
or character scaling is introduced for those strips.

## Shipping evidence

Paired `phase2a-*.png` and `phase2b-*.png` include:

- [Idle](phase2b-idle.png), [firing](phase2b-firing.png), [lane movement](phase2b-lane.png).
- [Reinforcement](phase2b-reinforcement.png), [Level-Up](phase2b-level-up.png), [tier upgrade](phase2b-tier-upgrade.png).
- [Hit](phase2b-hit.png), [casualty](phase2b-casualty.png).
- [Two defenders idle](phase2b-two-defenders.png), [simultaneous firing](phase2b-two-defenders-firing.png),
  [two defenders moving](phase2b-two-defenders-lane.png).
- [Isolated](phase2b-isolated.png), [actual-projection black silhouette](phase2b-silhouette.png).
- [Actual live game](live-sanity.png).

The lane strip samples the full existing 220 ms presentation step at 0%, 20%,
40%, 60%, 80% and settle: 0/44/88/132/176/220 ms. Recoil samples
0/20/40/80/120/150 ms. Its initial tracer is removed from the QA fixture after
50 ms so later samples expose weapon recovery; runtime projectiles are untouched.
Empowerment samples 0/80/240/480/799/800/1100/1400 ms, covering the main wash
and the complete afterglow. Individual cropped frames remain alongside strips.

## Refinement facts

The compact tunic has broad bevels and a gentle top taper with corrected smooth
normals. One lower uniform wrap panel replaces the inset front rectangle and is
visible from the rear. The head sits slightly lower and has a deeper rounded rear
contour; the helmet keeps its crown, with a smoother dome and modestly thicker rim.

Both detached hands are flattened mittens with cheap thumb lobes and navy cuffs.
Their weapon-local grip anchors follow the actual rifle matrix, accounting for
body lean; the support hand absorbs less recoil and counter-swings during lane
motion. The rifle sits closer to the torso and has an 8° forward-facing yaw.
Its child muzzle follows the rendered barrel, and tracer origins use the rotated
rest anchor. No connecting limbs or new gameplay weapon behavior are added.

Shoes have slightly wider centers and a small rest fore/aft stagger. Motion
increases fore/aft travel to 0.22 units, lifts up to 0.075 units and steps outward
up to 0.035 units per shoe. The original motion clock is unchanged. Shadow stays
0.64×0.46. A shared renderer-owned material gives the rifle a foam wash blending
into aqua afterglow. Hands, cuffs and shoes share body wash/hit ownership. The
rifle intentionally remains neutral during hit feedback. Casualty parts retain
the same weapon cant and original 360 ms knockout; no ragdoll is introduced.

## Validation and exact cost

`npm test`: 73 files, 528 tests passed. `npm run typecheck` and `npm run build`
passed. Phase 1 role-isolation tests and unchanged legacy asset guards remain.
Live keyboard/touch lane changes, firing, advancing simulation and pause/resume
all passed with no browser errors; see `live-sanity.json`.

| Metric | Phase 2A | Phase 2B | Delta |
| --- | ---: | ---: | ---: |
| One-defender draw calls | 138 | 138 | 0 |
| One-defender triangles | 32,964 | 33,280 | +316 |
| GPU geometries | 61 | 61 | 0 |
| GPU textures | 9 | 9 | 0 |
| Two-defender draw calls | 142 | 142 | 0 |
| Two-defender triangles | 34,262 | 34,894 | +632 |
| JavaScript bytes | 967,499 | 970,092 | +2,593 |
| JavaScript gzip bytes | 261,094 | 261,892 | +798 |
| Loaded character bytes | 532,448 | 532,448 | 0 |
| Character GLB requests | 19 | 19 | 0 |

Matching scenes contain 35 Grunts and one Heavy. Four primary meshes remain per
defender. Mittens, thumbs and cuffs share existing geometry/material draws; there
is one additional shared weapon-wash material but no new mesh, geometry or
texture resource. CSS is unchanged. These software-renderer counters do not
claim physical-phone frame-time performance.

`comparison.json` records image difference bounds and counters. Projected
ground-to-crown height is 53.22488 CSS pixels in both versions (0% change).
Player-free world, Giant and Boss captures are pixel-identical. Active-Player
differences stay within Player-dependent presentation areas.
`bundle-comparison.json` uses matched write-disabled Vite builds from Git/current
sources. Existing warnings remain: two Zod annotation notices and the >500 kB
bundle warning.

## Remaining review compromises

The rear head remains secondary to the helmet. The hands are abstract mittens;
there are no fingers or connecting arms. The forward shoe is partly occluded by
the tunic at peak lifted stride, although the sampled visible leading shoe swaps
sides clearly. Rifle cant is deliberately subtle, so it remains compressed from
the rear camera. Human approval should judge these at normal play speed.

## Reproduction

The local QA scripts use the workspace's bundled Playwright and installed Chrome
paths, not shipping dependencies. With the normal Vite server on port 5173:

```text
node artifacts/player-chibi-polish/capture.mjs phase2a
node artifacts/player-chibi-polish/capture.mjs phase2b
python artifacts/player-chibi-polish/review.py
node artifacts/player-chibi-polish/live-sanity.mjs
node artifacts/player-chibi-polish/compare-bundles.mjs
```

Baseline capture reads relevant modules from the verified Phase 2A Git commit
through a temporary Vite loader on port 5180, without resetting the checkout.
Fixtures freeze the app clock and UI animations only for QA. Pillow assembles
comparisons/strips. No simulation, snapshot, balance, asset or bake output changes.
