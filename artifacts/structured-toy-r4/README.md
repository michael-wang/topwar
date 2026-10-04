# Structured Toy R4 review

Starting HEAD and fetched origin/main verified at
`a4a530447d833ee341805ee6df02f947cd435aa7`. Baseline fixtures read that commit
through a Vite source adapter; the checkout is never reset. All default
portraits are 390×844 CSS / DPR 2 with the shipping camera/lighting.

## Commit 1 — near-field village

`baseline-*` is accepted R3; `environment-*` captures the near houses before
character or HUD edits. Standalone pottery, rope, bench, timber seat and cloth
are removed. Six merged material/side draws replace seven prop draws. Screen-left
house center is X=5.35/Z=7.2 at track half-width 3.2; screen-right is
X=−5.65/Z=11.85. The left house has a cyan shutter, short front stair and
low terrace; right has a plaster arch/cyan recessed doorway, steps and terrace.
All opaque vertices stay outside track edge +0.4 at half-widths 1.5/2.5/3.2/6,
with heights below 2.1 and Z inside 5–17. No collision or upper village changes.
Four focused environment tests and typecheck pass at this checkpoint.

Named `left-house`/`right-house` frames are QA close inspections. `opening`,
`empty` and `outer-lanes` use the actual camera and demonstrate composition.
Final character/HUD comparisons and measurements follow in commits 2/3.

## Commit 2 — structured threats

`characters-*` captures Heavy/Giant before the HUD change. Heavy keeps its
0.68×0.48×0.55 authored body envelope, helmet and fists/shoes; the torso now has
a 0.28-high vertical middle with 0.10 rounded caps. The diagonal harness follows
that surface; two canvas bodies with shallow integrated flaps replace ball
pouches. They sit inside fist width at X=±0.245/Y=0.245/Z=0.235.

Giant keeps crown 1.355 and all simulation/root scales. Skin head and helmet
width/depth shrink 18%; the head zone is now 0.54, or approximately 2.51 heads.
The padded torso is 0.84×0.76×0.58, top 0.895. A flat belt and one flapped canvas
satchel replace the ellipsoid gear. Maul, crest identity, gait/shoes, HP bar,
surviving-hit styles and Pale Shatter clocks are unchanged.

All equipment is baked into existing role bodies/poses, with no added crowd
or Giant draw. 588 tests / 86 files and typecheck pass at this checkpoint.
The initial measurements show +72 primary triangles per Heavy and a small
Giant triangle reduction; final per-role and fixture counters follow below.

## Commit 3 — weapon + enhancement

`final-*` captures completed R4. The rifle now has a 44×20 tight authored SVG
and occupies 3.4×1.5 rem, or 3.1×1.4 on ≤350px. Enhancement is its own adjacent
slot with a quiet divider; its minimum width can grow for `+130%` without
clipping. It continues to show actual fire-rate math or the actual arrived
squad multiplier. No bullet-stage model or progression rule is implemented.
The approved future three cartridge pips → two soldiers → three soldiers
requires explicit future progression state, documented in SUNLIT_COASTAL_ART.

At ordinary 390/350 widths, the XP track remains 161.89/153.89 CSS px wide;
at the widest `+130%` it is 158.02/150.20. The safe-area QA also tests 20px
left/right/bottom insets, both enhancement kinds and build-label separation.
All slots remain separate, non-wrapping and inside the safe area.

## Human review index

- [Full portrait before/after](portrait-before-after.png)
- [Foreground before/after](foreground-before-after.png)
- [Left close](left-house-close.png), [right close](right-house-close.png)
- [Outer-lane clearance / defenders](lane-clearance.png)
- [Heavy before/after](heavy-before-after.png), [three views](heavy-views.png),
  [canvas pouches](heavy-equipment-close.png)
- [Giant before/after](giant-before-after.png), [three views](giant-views.png),
  [head-height guides](giant-proportion-guides.png), [satchel](giant-equipment-close.png)
- [Actual-projection silhouettes](silhouette-sheet.png)
- [Live mixed threats](final-mixed-threats.png)
- [HUD before/after](hud-before-after.png), [390px](hud-390.png), [350px](hud-350.png)
- [Rifle inspection](weapon-readability.png), [fire rate](enhancement-fireRate.png),
  [squad](enhancement-squad.png)
- [Performance + guards](performance-comparison.json)

Giant guides identify authored crown/head-bottom/ground projected through the
same inspection camera. The ratio is authored height divided by helmet/head
zone, not a perspective-pixel division. R3 is 2.13; R4 is 2.51. Gameplay
projection remains exactly 173.208 CSS px high; Heavy is 77.077 px before/after.
Player, Grunt and Boss guard crops are pixel-identical excluding the changed HUD.

## R3 → R4 renderer counters

| Fixture | Draws | Triangles | Geometries | Textures |
| --- | --- | --- | --- | --- |
| 100 Grunts | 144 → 143 | 270900 → 271268 | 71 → 70 | 6 → 6 |
| 35 mixed + one Giant | 167 → 166 | 114812 → 115644 | 75 → 74 | 9 → 9 |
| 100 mixed (20% Heavy) | 189 → 188 | 285060 → 286868 | 71 → 70 | 8 → 8 |
| 200 mixed (20% Heavy) | 229 → 228 | 553820 → 557068 | 71 → 70 | 8 → 8 |
| Two Giants | 149 → 148 | 25192 → 25480 | 76 → 75 | 10 → 10 |

Heavy primary triangles: 3248 → 3320 (+2.22%); Giant 4440 → 4400; Grunt
2544 unchanged. Existing body/helmet batches remain; gear has zero extra
per-entity draws. Foreground adds 368 triangles while removing one draw/geometry.
JS 983898 → 984883 bytes (+985); gzip 265755 → 266233 (+478).
Thirteen legacy GLB requests / 356172 bytes are unchanged, with no new textures.
These are deterministic SwiftShader counters, not mobile hardware FPS results.

## Verification and rerun

- `npm test`: 589 tests / 86 files pass. Typecheck and build pass.
- Existing Zod annotation warnings and >500kB JS chunk warning remain.
- Live development default: Level 7 / XP 0 / two arrived defenders / three roles.
- `?review=normal`: Level 1; explicit threats and Retry retain their modes.
- Keyboard, touch, targeting/combat, Pause/resume and Retry sanity pass.
- Production default/normal Level 1, explicit threats Level 7; no browser errors.
- Four width-clearance cases and environment/role resource disposal pass.

With Vite running at 5173, use `node artifacts/structured-toy-r4/capture.mjs baseline`
then `.../capture.mjs final`. Live, production and HUD sanity helpers are beside
it. `compare-bundles.mjs` makes read-only in-memory builds; `review.py` makes
contact sheets and checks guards. These are QA-only, never shipping imports.
This host used the bundled Python with `-X utf8` and Pillow, the existing
Playwright runtime/Chrome, and a local ignored npm CLI to run package scripts.
No project dependency, game data, simulation or snapshot changes were needed.

Remaining review concerns: the houses are intentionally cropped, so their exact
visual weight should be judged on real devices; canvas flaps use broad chamfers
rather than cloth texture; the Giant's new vertical jacket is intentionally more
structured. No further polish, Boss migration, future progression or deployment.
