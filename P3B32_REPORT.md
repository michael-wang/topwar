# P3-B.3.2 — Mobile projectile readability

Baseline: `f74ab61a3280e899be63ddb270a0dbb7b0231f9c`. This report accompanies the implementation commit. No deployment or frozen-tag change; no P3-C work.

Frozen `playtest-2026-10-08` remains at `59136b49e1328ab754412f7affe90c755c76c0fd`.

## Findings and selected treatment

- The GLB is a 24-vertex box, 0.052 × 0.052 × 0.52 world units. The actual muzzle height is 0.37145, with the existing 0.32147 lateral presentation offset. At 350×844 the camera uses a 62.26° vertical FOV; at 390×844, 56.91°. Desktop 1280×900 contains a 506×900 game viewport, with 48.02° FOV.
- The estimated **axial** footprints were accurate: at 350 px, width × axial length is 1.19×2.39 at Z20, 0.91×1.38 at Z30 and 0.73×0.90 at Z40. Perspective and looking along the trajectory make distant shots read as tiny dots. The complete projected silhouette is slightly larger because the box thickness also projects vertically.
- The old translucent red fringe has weaker contrast against pale sand/buildings than navy ink. Pixel readback with the fringe enabled/disabled returned the same ivory center, RGB 255/244/229, across sand, sea, plaster, helmet and shadow backgrounds. **Center tinting was investigated but not confirmed as a root cause.**
- Selected: unchanged warm ivory core, Command Blue navy outline, and a short tapered tail oriented along projected travel. Compared 1.5 px / 5.5 px, 2 px / 7 px, and 2.5 px / 9 px core-width/length targets; the middle option maintains a clearer distant stroke without the larger option's added density. Navy was preferred to the old translucent red and a darker ink experiment.
- At normal combat depths the core is approximately 2 CSS px wide and 7 px long, with a 3 px total width. World caps (0.16 core width, 0.08 outline addition, 0.65 tail length) prevent excessive horizon enlargement. At Z60/Z100 on 350 px, the core naturally drops to 1.62×6.63 / 1.04×4.26 px. The existing 65 ms firing pulse remains.
- The rendered head retains the existing muzzle offset and authoritative shot position. All tail vertices project behind it. No simulation, trajectory, collision, firing, damage, RNG, progression, artwork, audio or HUD code changed.

## Projected pixels

Measured from actual geometry vertices, instance matrices and camera transforms, after the firing pulse expires. Values below are axis-aligned core silhouette width × height in CSS pixels; the slight diagonal from the existing muzzle offset explains 7.05 rather than exactly 7.

| Viewport | Depth | Before | After |
|---|---:|---:|---:|
| 350×844 | Z20 | 1.31×3.56 | 2.00×7.05 |
| 350×844 | Z30 | 0.98×2.29 | 2.00×7.05 |
| 350×844 | Z40 | 0.78×1.63 | 2.00×7.05 |
| 390×844 | Z20 | 1.46×3.97 | 2.00×7.05 |
| 390×844 | Z30 | 1.09×2.55 | 2.00×7.05 |
| 390×844 | Z40 | 0.87×1.82 | 2.00×7.05 |
| Desktop 1280×900 | Z20 | 1.90×5.15 | 2.00×7.05 |
| Desktop 1280×900 | Z30 | 1.41×3.30 | 2.00×7.05 |
| Desktop 1280×900 | Z40 | 1.12×2.36 | 2.00×7.05 |

The normal outline measures 3.00×8.08 px at Z20–40. Level Up retains aqua/energy colors, additive blending, 0.55 opacity, 1.2× core width and 2.4× halo width: approximately 2.40 px core / 5.75 px halo at those depths. It remains clearly stronger than ordinary fire. Depth testing preserves enemy occlusion; health indicators draw above the tracers.

## Performance and startup

Chrome/SwiftShader, mobile DPR 2, 4× CPU throttling, seed 17. Timing runs were isolated from recording and other browser jobs. Three six-second real-RAF Lv8 samples per size, following a 2.5-second warm-up; approximately 324 shots per six simulation seconds (54 Hz). Before uses the exact baseline renderer through QA-only interception. Initial synthetic-frame timing experiments were discarded because queued GPU work contaminated their first measured frame.

| 54 Hz metric | 350 before → after | 390 before → after |
|---|---:|---:|
| Median of mean frame intervals | 21.58 → 22.10 ms | 24.52 → 24.23 ms |
| Range of run means | 21.51–22.28 → 21.98–22.14 ms | 24.29–24.52 → 24.16–24.32 ms |
| Frame p95 | 33.4 → 33.4 ms | 33.4 → 33.4 ms |
| Longest frame | 50.1 → 33.5 ms | 50.0 → 50.0 ms |
| Frames >100 / >200 ms | 0 / 0 → 0 / 0 | 0 / 0 → 0 / 0 |
| Mean projectile-update JS, median run | 0.117 → 0.173 ms | 0.132 → 0.202 ms |

Two instanced draws remain, with the same 128-instance high-water capacity in the 54 Hz runs. No texture or postprocessing additions, per-projectile objects, per-frame geometry generation, DOM measurement, or production profiling hooks. The one tapered geometry copy is reused across Retry and disposed with the renderer. Legacy keeps the original GLB, materials and transforms.

Additional matched six-second fixture samples: Lv6 (18 Hz) mean frame time 44.82→42.81 ms at 350 and 45.90→41.27 ms at 390; Lv7 (36 Hz) 23.93→21.14 ms and 25.50→23.68 ms. No frame exceeded 100 ms. These are single samples per fixture/size, not statistically established speedups. The Lv6 review contains a heavier crowd than the later-level fixtures, so compare before/after within a row, not across levels. Raw data: `performance-6-7.json`.

Both Defense layers now share the existing transparent basic-material shader variant. First visible tracer draws created one program rather than two; observed first-draw CPU submission totals were 336.7→40.7 ms (350) and 228.0→78.0 ms (390). These single samples include driver/setup work and are **not** a robust physical-GPU benchmark. No additional programs appeared during any measured 54 Hz window.

Production startup used separate frozen before/after builds, 150 ms latency, 1.6 Mbps download, 4× CPU and three cold/warm pairs per size. Medians, milliseconds:

| View / cache | Navigation→Tap-to-Start before → after | Navigation→first scene before → after | Tap→interactive before → after |
|---|---:|---:|---:|
| 350 cold | 3943 → 3992 | 4208 → 4276 | 52 → 62 |
| 350 warm | 2133 → 1997 | 2348 → 2205 | 76 → 66 |
| 390 cold | 3982 → 3933 | 4262 → 4244 | 37 → 63 |
| 390 warm | 2009 → 2128 | 2304 → 2347 | 49 → 60 |

Cold start ranges overlap: 350 before 3907–3977 / after 3920–4002; 390 before 3950–4001 / after 3912–3996. Warm ranges: 350 before 1941–2189 / after 1950–2016; 390 before 1917–2139 / after 2014–2184. No material startup regression was identified. Resource requests remain eight; cold transferred bytes 480,385→481,132 (+747), warm transferred bytes zero. Every intro began at voice offset zero with a decoded portrait and zero blank portrait frames. Existing public-asset content hashes and `/topwar/` paths are unchanged.

## Evidence and validation

Local artifacts are intentionally ignored by Git. Reproduce with `scripts/qa/projectile-readability.mjs before|after|experiments`, `projectile-performance.mjs before|after [6,7]`, and `startup-profile.mjs`. `TOPWAR_STARTUP_REUSE_BUILD=1` remeasures a saved frozen startup build.

| View | Depth probes before / after | Combat recordings before / after |
|---|---|---|
| 350×844 | [Before](artifacts/p3b32/before/depths-350.png) / [After](artifacts/p3b32/after/depths-350.png) | [Before](artifacts/p3b32/before/combat-350.webm) / [After](artifacts/p3b32/after/combat-350.webm) |
| 390×844 | [Before](artifacts/p3b32/before/depths-390.png) / [After](artifacts/p3b32/after/depths-390.png) | [Before](artifacts/p3b32/before/combat-390.webm) / [After](artifacts/p3b32/after/combat-390.webm) |
| 1280×900 | [Before](artifacts/p3b32/before/depths-1280.png) / [After](artifacts/p3b32/after/depths-1280.png) | [Before](artifacts/p3b32/before/combat-1280.webm) / [After](artifacts/p3b32/after/combat-1280.webm) |

Each recording cycles Lv1, 3, 5 Rifle and Lv6, 7, 8 MG, normal then afterglow. Individual screenshots use `lv{level}-{normal|glow}-{width}.png` in the same directories. `results.json` stores projections and pixel samples; `performance.json` stores the repeated 54 Hz samples. Controlled depth probes include Z10/20/30/40/60 across sand, sea, buildings and enemy silhouettes. Size/color comparisons are in `artifacts/p3b32/experiments/`.

Validation:

- `npm test`: **149 files, 1,066 tests passed**, including 11 focused projectile tests covering Legacy transforms, pixel floors/caps, directional anchoring, afterglow, pool growth, reset and disposal.
- `npm run typecheck` and `npm run build`: passed. Existing large-bundle/Zod annotation warnings remain.
- Production browser checks: Tap-to-Start, correct assets, no DEV/QA controls, normal/threat-review entries at 350/390 passed (`artifacts/p3b32/production/production-sanity.json`).
- Production natural Lv1–8 progression at both widths, Legacy Boss entry, Pause/Resume, Retry, and 120-tick deterministic snapshot continuation passed (`artifacts/p3b32/modes/results.json`). Defense loaded one GLB; Legacy loaded all 13, without duplicates.
- Both viewport recordings and the desktop reference include normal/afterglow Rifle and MG shots; dense Lv8 fire remains below health indicators and respects enemy occlusion.
- WebGL context loss/restoration, Retry/disposal, Observer naval fallback with voice, Supply resize/safe-area alignment, and unchanged aircraft pixels passed at both widths (`artifacts/p3b32/lifecycle/results.json`).
- All six WebM recordings decoded and sought successfully at their requested dimensions (`artifacts/p3b32/media-check.json`); extracted frames were inspected.

Implementation files: `src/art/ArtDirection.ts`, `src/rendering/GameRenderer.ts`, `src/rendering/projectiles/ProjectileRenderer.ts`, new `DefenseTracer.ts`, and `tests/DefenseProjectilePresentation.test.ts`. Supporting changes are scoped QA scripts, this report, and the stable presentation contracts in `ARCHITECTURE.md` / `GAME_SPEC.md`.

Physical-device limitation: no phone was connected. Desktop CPU throttling and software rendering do not reproduce phone GPU drivers, thermal limits, panel brightness or motion perception. Final physical-phone review should confirm ordinary distant shots remain easy to follow and Lv8 density stays comfortable; approved visuals and gameplay were not reduced to improve benchmarks.
