# P3-B.6B.7A — Directional artillery warnings

Starting SHA: **bc578bc2cf13e1f4a4fed60aa9478462031391f5**. Cleanup had completed, been pushed and reported before this task began. Fetched origin/main and verified the clean starting tree.

Implementation: **4a4f78f1f92814d15182c7dc00f7e64ac4f91b1b**. The following report commit completes delivery; its final SHA is included in the delivery response.

## Presentation change

Restored an inverted triangle with an ivory exclamation inside. The point identifies the threatened lane. The triangle has a thin muted gray/navy rim instead of the earlier heavy dark backing; its base width is 0.80 world units versus the older badge's 0.94. The rim inset is 0.025 units at the sides/top. Early flight remains subtle rather than immediately showing a large opaque danger badge.

Body color moves from low-saturation terracotta **#b07c73**, through orange-red **#eb5635**, to the stronger final red **#ff1000**. The previous minimal marker ended at #ff2518. Ivory #fff3dc stays legible inside; rim #3b4045 becomes prominent only as the shared opacity increases.

All timing and placement logic is unchanged: target X × −0.72, Y=2.05, locked target Z, billboard orientation, earliest impact per lane, continuous presence, the smooth 15%→100% opacity ramp and the existing final-150ms 1.10–1.38× pulse. Player movement never moves a warning. Multiple same-lane shells keep the marker until the final threat resolves. Pause freezes simulation-based urgency; restoration reconstructs it directly from active shells.

Matched authoritative phase samples have exactly equal times and alpha values before/after at both widths:

| Sample | First / second lane opacity |
|---|---|
| Launch +50ms | 15.14% / 15.14% |
| Mid-flight | 57.40% / 57.50% |
| Approximately 150ms remaining | 98.73% / 100% |
| Final pulse sample, approximately 40ms remaining | 100% / 100% |

The small difference between lanes at the 150ms sample reflects their distinct authoritative impact deadlines; they do not share a global clock. Final opacity never pulses to zero.

Ground rings/fills/countdowns remain disabled for current Stage 1. Historical ground-warning rendering is untouched. FPS, HUD, QA hatch, Wake Lock, AHEAD, naval quiet-gap RNG, targeting, shell flight/damage, Grenade inventory and all simulation/configuration/save code are unchanged.

## Bounded rendering

Triangle fill, rim and glyph are merged into the existing single InstancedMesh. Static vertex accents preserve the ivory glyph and rim while the body receives its per-lane tint. The existing instance-alpha attribute controls the complete marker.

| Warning resource | Minimal ! | Directional triangle |
|---|---:|---:|
| Batches/materials/geometries | 1 / 1 / 1 | 1 / 1 / 1 |
| Capacity | 8 | 8 |
| Vertices per marker | 29 | 38 |
| Triangles per marker | 25 | 32 |
| Extra textures/asset requests | 0 | 0 |

Two active lanes add 14 triangles and no draw calls. Geometry/accent data is prepared once; temporary construction geometries are disposed, and the owned merged geometry/material are released on disposal. No per-shell objects or per-frame arrays were added. The updated shader layout is allocated before the existing bounded idle presentation preparation, with a distinct cache key. Shader preparation, resource plateau and disposal regressions pass; no claim about Pixel 8 first-use GPU latency is made from desktop automation.

Production JS before the change was 1018121 bytes (279559 gzip); the implementation measurement is 1018867 bytes (279764 gzip), approximately +746 / +205 bytes. Build-marker gzip variation is incidental. No production balance, asset content or caching policy changed.

## Mobile evidence

Captures use the real shipping renderer and deterministic high-load AHEAD Lv10 fixture with actual enemies, HP bars, projectiles, naval presence and saved shells. Phase screenshots sample authoritative shell times while paused; the recordings use actual fixed-tick gameplay, firing and impacts without time scaling or invulnerability.

Native 350×844 and 390×844 phase captures are under ignored artifacts/p3b6b7a/:

| Evidence | 350px | 390px |
|---|---|---|
| Previous minimal !, early | [before](artifacts/p3b6b7a/before/350-warning-early.png) | [before](artifacts/p3b6b7a/before/390-warning-early.png) |
| Restored direction, early | [early](artifacts/p3b6b7a/after/350-warning-early.png) | [early](artifacts/p3b6b7a/after/390-warning-early.png) |
| Mid-flight | [middle](artifacts/p3b6b7a/after/350-warning-middle.png) | [middle](artifacts/p3b6b7a/after/390-warning-middle.png) |
| Final pulse / two simultaneous lanes | [pulse](artifacts/p3b6b7a/after/350-warning-pulse.png) | [pulse](artifacts/p3b6b7a/after/390-warning-pulse.png) |
| Different impact deadlines | [independent](artifacts/p3b6b7a/lanes/350-independent-deadlines.png) | [independent](artifacts/p3b6b7a/lanes/390-independent-deadlines.png) |
| Complete warning lifetime with audio | [recording](artifacts/p3b6b7a/lanes/350-warning-lifetime.webm) | [recording](artifacts/p3b6b7a/lanes/390-warning-lifetime.webm) |

Before/after directories also contain final-150ms images and phase JSON. Native frames were inspected: the earlier ! has little directional silhouette at launch; the restored triangle points to each lane even at low emphasis, becomes readable mid-flight and turns vivid red near impact. Markers remain within the screen and above the unchanged bottom HUD. No ground circles are visible. Physical-phone readability remains the acceptance decision.

## Verification

- **67 focused tests / 8 files pass**: warning geometry, lane positioning at launch/middle/maximum pulse on both widths, independent urgency, complete lifetime, same-lane coalescing, cancellation, restore/no replay, bounded resources/disposal, artillery combat, historical/current cadence, shader/idle preparation and released checkpoints.
- **Full suite: 1033 tests pass**, zero failures. Typecheck and production build pass.
- Production lane-warning browser QA passes all **six** width/level combinations: 350/390 × Lv8/Lv9/Lv10. Pause/reload restores identical state, stays paused and replays no muzzle flash. Hidden/visible stays frozen/paused. Adjacent movement preserves warning anchors; cancelling one shell removes only its warning.
- Real full-flight recordings observe 129/127 frames, including 54/52 active-warning frames at 350/390. Every sampled active frame has one marker per threatened lane, nonzero alpha and no ground warnings. Independent launches verify different lane deadlines.
- Shipping smoke tests pass at both widths with zero console/request errors, correct /topwar/ content-addressed URLs, normal startup and intended restricted QA only.
- The retained naval QA script's independent-deadline tuning object was updated to the current Defense-only contract, removing obsolete Boss/Rocket references. No runtime gameplay changed.

ART_DIRECTION, GAME_SPEC and ROADMAP now describe the directional warning. The only runtime file changed is OverheadLaneWarnings.ts; no simulation, authored balance, checkpoint, audio, FPS, Wake Lock or HUD implementation was modified.

No deployment was dispatched. Frozen playtest-2026-10-08 remains 59136b49e1328ab754412f7affe90c755c76c0fd. Stop here for physical Pixel 8 review of early lane readability and final-pulse emphasis; desktop captures do not certify phone perception or GPU performance.
