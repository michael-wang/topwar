# Phase 3B — simplify Grunt body and clothing

Baseline: `ee59abdf7c41b3fd8b22bd6fe9fcc700dc360238` (Phase 3A).
Phase 3A was not approved as the final Grunt. This is a design correction for
human review, not final acceptance. No Heavy development or deployment.

## Review evidence

- [Isolated front before/after](comparison-isolated-front.png) and [rear](comparison-isolated-rear.png)
- [Body detail before/after](comparison-body-detail.png): rounded shirt, plain shorts, ball hands, no belt
- [Gameplay crowd before/after](comparison-normal.png): cool shirt separation against unchanged sand
- [Player vs Grunt color comparison](comparison-player-grunt-colors.png)
- [Black Grunt silhouette before/after](comparison-silhouette.png)
- [Player/Grunt silhouettes](prototype-player-grunt-silhouettes.png) and [helmet-only comparison](prototype-helmet-only.png)
- [Full 360 ms motion strip](prototype-gait-motion-strip.png) and [Phase 3A strip](baseline-gait-motion-strip.png)
- [Legacy Heavy mixed into Grunts](comparison-mixed-heavy.png)
- [Near contact](comparison-near-contact.png) and [outer lane](comparison-outer-lane.png)
- [Plain clothing close inspection](prototype-clothing-close.png)
- [Hit](prototype-hit.png), [death](prototype-death.png), [contact](prototype-contact.png), [asynchronous group](prototype-asynchronous.png)
- [Performance JSON](performance.json), [pixel/occupancy comparison](comparison.json), [live input sanity](live-sanity.json)

Full portraits use 390×844 CSS pixels at DPR 2 (780×1688 PNG). Scene projection,
lighting, population, camera and state match across baseline/current fixtures.
Close inspections use the same QA camera in both versions. Actual-scale
silhouettes and gait use the shipping projection. The gait samples ID 0 at
0/60/120/180/240/300/360 ms through unchanged pose/root-motion functions.
The isolated Player/Grunt pair normalizes crown/root scale for comparison;
the gameplay crowds retain their actual shipping scales. Pixel inspection
panels explicitly use nearest enlargement; source portraits remain available.

## Exact revision

- One smooth-shaded ellipsoid, 0.50 wide × 0.34 high × 0.38 deep, replaces the
  separate beveled bare torso and patch-covered shorts masses. No shoulder/chest
  planes, anatomical detail, garment stacking or new equipment.
- Plain shirt: cool muted gray-green `#a4bcb6`. Plain shorts: darker companion
  slate-green `#526967`. Both are vertex colors on that one body, separated at a
  latitude ring about Y=0.302. No camouflage, texture, folds, sleeves or seams.
- Each hand is one radius-0.057 sphere. Removed mitten shaping and thumb lobes.
  Existing hand centers and fore/aft counter-swing remain.
- Removed visible waistband. The required legacy `vest` slot remains as an
  explicitly hidden zero-vertex compatibility resource. Crowd rendering honors
  secondary-source visibility; pooled contact/death reuse restores visible
  legacy gear. Batch sharing checks that visibility as well as resources.
- Pot helmet, head/neutral face, large shoes, 360 ms four-pose cadence,
  asynchronous ID phase, shoe offsets/lifts, root lean/bob/sway and visual scale
  are unchanged. Projected reference height remains 36.073 CSS pixels; crown
  remains 1.025. Idle body width changes 0.800→0.784.
- Hit/contact/death timing and pools remain unchanged. Feedback uses the revised
  body; death retains a grayscale copy. Shadow remains 0.68×0.42.

The source family still owns eight geometries (including the empty adapter) and
three materials. Renderers borrow those resources and dispose their own clones
and instance buffers. No new character resources are loaded.

## Performance versus Phase 3A

| Matching fixture | Draws before → after | Triangles before → after | GPU geometries | Textures |
|---|---:|---:|---:|---:|
| 35 Grunts + Player | 136 → 135 | 36,916 → 35,236 | 67 → 66 | 7 → 7 |
| Same + legacy Heavy | 141 → 140 | 37,596 → 35,916 | 67 → 66 | 9 → 9 |
| 50 Grunts + Player | 136 → 135 | 49,006 → 46,606 | 92 → 91 | 13 → 13 |
| 100 Grunts + Player | 136 → 135 | 89,306 → 84,506 | 92 → 91 | 13 → 13 |
| 150 Grunts + Player | 136 → 135 | 129,606 → 122,406 | 92 → 91 | 13 → 13 |
| 200 Grunts + Player | 136 → 135 | 169,906 → 160,306 | 92 → 91 | 13 → 13 |

The revision removes 48 triangles per Grunt (806→758) and the single active-tier
secondary draw. GPU memory counts are uploaded/cache counts at matching points
in the same QA sequence; later crowd fixtures retain warmed legacy/feedback
resources. The empty adapter is not uploaded/rendered. Draws remain bounded by
pose, role and tier rather than entity count.

Matched production JS: 974,651→974,520 bytes (-131); gzip 263,399→263,327 (-72).
Character downloads remain 19 requests / 532,448 bytes. No texture is added.
Optional browser update-CPU timings are recorded in performance.json; the
200-Grunt median is 0.272→0.280 ms. This small diagnostic variation is not a
physical-phone FPS result; Chrome uses desktop software rendering.

## Verification and review concerns

538 tests across 74 files pass; typecheck and build pass. Existing gameplay,
snapshot, legacy-asset, role-isolation, Player, material, gait, feedback and
disposal protections remain. The obsolete camo assertion now protects two
plain clothing colors. Added spherical-hand and secondary-visibility coverage,
including restoration during feedback pool reuse.

Twelve Player/Heavy/Giant/Boss/world guards are pixel-identical. Helmet-only
evidence is also pixel-identical, preserving the pot helmet. No Player, Heavy,
Giant, Boss, simulation, balance, lane, camera, environment, UI, ship, GLB or bake
changes. Live keyboard/touch lane input, firing, simulation advance and
pause/resume pass without browser errors. Existing build warnings: two Zod
annotation notices and the >500 kB chunk warning.

Remaining human review questions: shorts intentionally read as a dark lower
color block rather than constructed trousers; low-segment outlines remain
visible close up; the four-frame gait remains stepped; ball hands become tiny
at distant crowd scale. The cool shirt now separates from sand more clearly,
but final clothing shade/shape acceptance belongs to human review. Heavy
deliberately retains its older style. Stop here before further Grunt or Heavy.

## Reproduce

With Vite running on 127.0.0.1:5173, from the repository root:

```powershell
node artifacts/grunt-chibi-simplify/capture.mjs baseline
node artifacts/grunt-chibi-simplify/capture.mjs prototype
node artifacts/grunt-chibi-simplify/compare-bundles.mjs
node artifacts/grunt-chibi-simplify/live-sanity.mjs
python artifacts/grunt-chibi-simplify/review.py
```

These scripts reuse the existing QA path and this workstation's bundled
Playwright/installed Chrome; adjust explicit dependency/browser paths elsewhere.
review.py requires Pillow. The baseline server loads the three changed runtime
modules from Git on port 5180 without resetting the checkout. Browser route
overrides expose/stop the app for fixtures; shipping has no QA hook. Live sanity
keeps the real app clock. CSS animation is frozen only for matching captures.
