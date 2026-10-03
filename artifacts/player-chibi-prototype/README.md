# Phase 2A Player prototype review

Baseline: `d219cbfab4c6a13f5fafebebbb8754ea903f8643` (Phase 1).
Only Player presentation is intentionally replaced. No deployment or enemy
replacement is included. Further visual polish awaits human review.

## Evidence

All portrait fixtures use the actual game camera, lighting, formation and
390×844 CSS viewport at DPR 2 (780×1688 PNGs). Matching `baseline-*.png` and
`prototype-*.png` cover:

- [Idle](prototype-idle.png), [baseline idle](baseline-idle.png).
- [Firing and muzzle flash](prototype-firing.png).
- [Lane movement](prototype-lane.png).
- [Reinforcement entrance](prototype-reinforcement.png).
- [Level-Up](prototype-level-up.png).
- [Tier upgrade](prototype-tier-upgrade.png).
- [Hit](prototype-hit.png) and [casualty](prototype-casualty.png).
- [Two defenders](prototype-two-defenders.png).
- [Isolated inspection](prototype-isolated.png) and
  [black silhouette at gameplay projection](prototype-silhouette.png).
- [Actual running game](live-sanity.png).

The isolated inspection uses a QA-only close camera; the black silhouette keeps
the gameplay camera. Those evidence views do not alter shipping framing.
Captures freeze UI animation and the app clock for repeatability; fixture
states and timestamps match across baseline and prototype. The baseline Vite
loader reads the changed rendering modules directly from Git without resetting
the checkout or editing assets. `capture.mjs` contains the fixture definitions.

`comparison.json` records exact pixel differences and renderer counters. Every
active-Player difference is confined to the Player, shadow, tracer or Player
effect area (image Y 1160–1383 across these fixtures). Player-free world, Giant
and Boss guards are pixel-identical. Outside those Player areas the coastal
world, enemies and UI remain stable. Projected ground-to-crown height is
53.22488 CSS pixels in both idle captures (0% change).

## Validation and cost

`npm test`: 73 files, 526 tests passed. `npm run typecheck` and `npm run build`
passed. Phase 1 isolation and unchanged legacy asset guards remain active.
`live-sanity.json` records passing actual keyboard/touch input, advancing
simulation, firing and pause/resume checks, with no browser errors.

| Metric | Phase 1 | Phase 2A | Delta |
| --- | ---: | ---: | ---: |
| One-defender draw calls | 138 | 138 | 0 |
| One-defender triangles | 32,424 | 32,964 | +540 |
| GPU geometries | 59 | 61 | +2 |
| GPU textures | 10 | 9 | −1 |
| Two-defender draw calls | 142 | 142 | 0 |
| Two-defender triangles | 33,182 | 34,262 | +1,080 |
| JavaScript bytes | 962,831 | 967,499 | +4,668 |
| JavaScript gzip bytes | 259,314 | 261,094 | +1,780 |
| Loaded character GLB bytes | 589,000 | 532,448 | −56,552 |
| Character GLB requests | 21 | 19 | −2 |

Draw/triangle fixtures contain the same 36 enemies (35 Grunts and one Heavy).
Four primary meshes per defender remain. The extra two GPU geometries replace
formerly shared legacy helmet/chest geometry with Player-owned sources. Old
Player body/rifle GLBs stay in the repository but are no longer requested.
No new textures or external assets are needed. CSS size is unchanged.
Software-renderer counters are not physical-phone frame-time measurements.

Existing build warnings remain: two Zod annotation notices and the >500 kB
bundle warning. `bundle-comparison.json` comes from matching write-disabled Vite
builds, rather than inferred bundle estimates.

## Review questions

The helmet dominates from the rear; the human head mostly reads as a warm skin
band beneath it. The offhand is deliberately abstract rather than a precise
two-handed grip. Boots/chest are broad and simple. Evaluate the shoe rhythm,
weapon direction and two-defender spacing in the playable prototype before
authorizing polish. Static captures validate poses, not subjective motion feel.

## Reproduction

The QA scripts use this workspace's bundled Playwright and installed Chrome
paths; these are local evidence utilities, not shipping dependencies. Start the
existing Vite development server on port 5173, then run:

```text
node artifacts/player-chibi-prototype/capture.mjs baseline
node artifacts/player-chibi-prototype/capture.mjs prototype
node artifacts/player-chibi-prototype/live-sanity.mjs
node artifacts/player-chibi-prototype/compare-bundles.mjs
python artifacts/player-chibi-prototype/compare.py
```

Baseline capture temporarily uses port 5180. Pillow is needed for pixel
comparison. No gameplay files, snapshots, GLBs or bake outputs are modified by
these scripts.
