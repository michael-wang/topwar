# Phase 3A — amphibious Grunt prototype review

Baseline: `69768dc8b7a1dacfcee9d3fafe45972933977f3e` (accepted Phase 2B).
Only Grunt is replaced. Player, Heavy, Giant, Boss, gameplay, world, camera,
lighting, UI, balance, snapshots and shipping GLBs/bakes are unchanged.
This is a prototype for human review. No deployment or subsequent visual phase.

## Start here

- [Legacy → prototype normal crowd](comparison-normal.png)
- [Mixed crowd with unchanged legacy Heavy](comparison-mixed-heavy.png)
- [Front inspection](comparison-isolated-front.png) and [rear inspection](comparison-isolated-rear.png)
- [Full 360 ms gait](prototype-gait-motion-strip.png), sampled at 0/60/120/180/240/300/360 ms
- [Player / Grunt black silhouettes](prototype-player-grunt-silhouettes.png) and [pixel inspection](prototype-player-grunt-silhouettes-crop.png)
- [Helmet-only comparison](prototype-helmet-only.png) and [pixel inspection](prototype-helmet-only-crop.png): Grunt left, Player right, equal authored crown/root scale
- [Actual-size Grunt silhouette comparison](comparison-silhouette.png)
- [Camouflage close inspection](prototype-camouflage-close.png)
- [Outer lane](prototype-outer-lane.png), [near contact](prototype-near-contact.png), [asynchronous small group](prototype-asynchronous.png)
- [80 ms live-hit window](prototype-hit.png), [gray death](prototype-death.png), [contact exchange/fade](prototype-contact.png)
- [50](prototype-crowd-50.png), [100](prototype-crowd-100.png), [150](prototype-crowd-150.png), [200 Grunts](prototype-crowd-200.png)
- [Two untouched Giants](prototype-giants-two-guard.png), [recent legacy collapse](prototype-giants-collapse-guard.png)
- [Raw metrics](performance.json), [pixel/occupancy results](comparison.json), [live input sanity](live-sanity.json)

All full portrait captures use a 390×844 CSS viewport, DPR 2 (780×1688 PNG).
Close inspection deliberately uses a QA-only camera; silhouettes and gait retain
the actual gameplay projection. Crops/strips preserve source pixels; the two
explicitly labeled pixel-inspection panels enlarge them with nearest sampling.
The gait uses ID 0 and the unchanged run-frame/root-motion functions. The
asynchronous fixture uses eight different IDs at the same timestamp.
The actual front-facing gameplay view is visible in crowds; the rear inspection
also verifies the shared human grammar against Player.

## Implemented visual structure

Three crowd parts: merged body, tier helmet, tier waistband. The body contains a
large head, bare compact torso, broad three-color shorts, detached thumb mittens,
detached large shoes, and tiny neutral face marks. No rifle, vest or connecting
limbs. The helmet is a broad low pot with a thick lip, distinct from Player's
clean dome/rear panel. The compatibility `vest` field contains only waistband.

Skin uses Player's `ART.faction.skin`; camouflage uses original broad olive
`#68734f`, taupe `#b9a785`, and navy `ART.faction.equipment` patches. No uniform,
insignia, exact helmet model or nationally identifiable camouflage is copied.
Matte vertex-color materials preserve skin/camo/shoes under neutral white body
instance tint. Only helmet/waistband receive existing enemy tier colors.

Four merged static poses use the unchanged 360 ms asynchronous crowd clock:
shoe lead/trail ±0.16, lift up to 0.08, hands counter-swing ±0.125 authored units.
Root lean, bob and sway remain unchanged. Hit remains helmet/waistband dominant
for 80 ms. New reference parts drive contact; a grayscale merged reference body
drives death. Existing 240 ms contact, 480 ms death, pop/rise/shrink/fade,
DeathBurst and 48-slot feedback pools remain. No ragdoll or per-Grunt hierarchy.

The family owns eight geometries and three materials, disposed by CharacterAssets.
Renderer clones and instancing buffers remain renderer-owned. Heavy/Giant pin raw
normal GLBs independently of the resolved Grunt role; Giant contact has an
explicit legacy material policy. Boss keeps dedicated body/run/slam and selected
legacy shared resources. New Grunt and legacy Heavy split bounded batches;
the matching-resource batch-sharing path remains available and tested.

Grunt crown is still 1.025 authored units; head zone starts at 0.47 (~54%).
Matching-camera reference height is 36.58→36.07 CSS pixels (-1.4%). Idle body
width is 0.908→0.800, inside the requested limit. Shadow remains 0.68×0.42;
its existing footprint grounds the feet/body without expanding to helmet width.

## Performance versus Phase 2B

Each fixture keeps identical world, camera, lighting, Player, population, tier and
state. Normal is 35 Grunts plus one Player; mixed adds one legacy Heavy. Crowd
fixtures contain exactly the stated number of Grunts plus one Player.

| Fixture | Draws before → after | Triangles before → after | GPU geometries | Textures |
|---|---:|---:|---:|---:|
| Normal | 136 → 136 | 32,600 → 36,916 | 61 → 67 | 7 → 7 |
| Mixed Heavy | 138 → 141 | 33,280 → 37,596 | 61 → 67 | 9 → 9 |
| 50 Grunts | 136 → 136 | 42,818 → 49,006 | 84 → 92 | 13 → 13 |
| 100 Grunts | 136 → 136 | 76,943 → 89,306 | 84 → 92 | 13 → 13 |
| 150 Grunts | 136 → 136 | 111,068 → 129,606 | 84 → 92 | 13 → 13 |
| 200 Grunts | 136 → 136 | 145,193 → 169,906 | 84 → 92 | 13 → 13 |

Geometry/texture counts are WebGL uploaded/cache counts at the same point in an
identical QA sequence. The later crowd fixtures retain warmed feedback/legacy
role resources; they are not fresh-page counts. Source ownership adds eight
Grunt geometries; six are uploaded for live poses/gear, with idle/death uploaded
when feedback uses them. Draws are bounded by roles, poses and tiers, not entity
count. The mixed fixture adds three draws because Heavy no longer shares Grunt
body/helmet/secondary geometry. No extra textures are authored.

JS: 970,092→974,651 bytes (+4,559); gzip 261,892→263,400 (+1,508).
Character requests/bytes: unchanged at 19 / 532,448. Legacy normal resources
remain necessary for Heavy/Giant; no duplicate GLBs are downloaded.
The roughly 17% triangle increase at 200 Grunts is explicit. Cheap beveled
blocks keep it below the initial prototype's measured 65% increase.
Optional update-CPU diagnostics in performance.json are median warmed browser
timings, approximately 0.07/0.14/0.20/0.26 ms for 50/100/150/200. Chrome uses a
desktop software renderer; these results do not establish physical-phone FPS.

## Validation and limits

536 tests / 74 files pass; typecheck and build pass. Eight new focused tests
cover deterministic/static texture-free geometry, skin/camo, four poses/clock,
white body tint/tier helmets, 80 ms hit, role-correct pool reuse, disposal and a
simulation-free presentation contract. Phase 1 separation, Phase 2 Player,
unchanged legacy asset, combat and snapshot tests remain.

Twelve no-Grunt guards have zero changed pixels: Player; Heavy idle/hit/death/
contact; Giant idle/contact; Boss idle/death; world; two Giants; recent collapse.
Live keyboard/touch lane selection, simulation advance, firing and pause/resume
pass without console errors. The only existing build warnings are two Zod
annotation notices and the chunk exceeding 500 kB.

Known review compromises: the deliberately cheap torso/mittens/shoes show broad
bevel facets close up; camouflage is angular and collapses to one shorts mass
at distance; four-pose movement is visibly stepped; distant hands/face become
secondary to helmets. Skin separation relies on volume/shading and dark lower
parts as well as hue. Heavy deliberately looks older beside Grunt during this
migration. Extremely dense rear ranks overlap helmets, while front rows retain
individual bodies/feet. No further polish is implied by these observations.

## Reproduce locally

Start the existing Vite server on 127.0.0.1:5173. From the repository root:

```powershell
node artifacts/grunt-chibi-prototype/capture.mjs baseline
node artifacts/grunt-chibi-prototype/capture.mjs prototype
node artifacts/grunt-chibi-prototype/compare-bundles.mjs
node artifacts/grunt-chibi-prototype/live-sanity.mjs
python artifacts/grunt-chibi-prototype/review.py
```

The scripts use this workstation's bundled Playwright and installed Chrome;
adjust their explicit dependency/browser paths on another machine. review.py
requires Pillow. Baseline modules are read from Git into a temporary Vite server
on port 5180, without resetting the checkout. QA exposes the app only through a
browser route override, stops its clock for fixtures, and freezes CSS animation;
shipping code has no QA hook. The live-sanity route keeps the real app clock.
