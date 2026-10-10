# P3-B.3.4 — Projectile finalization and DEV cleanup

Baseline: `2081abe74baf5928984584a552c394c86f626297`. P3 Ink Spear was selected by the user on a physical phone. This task promotes that selection without retuning it. No simulation, balance data, approved artwork/audio, caching, controls, Carnival, Destroyer or artillery implementation changed.

## Implementation

- Defense now uses the exact P3 in DEV and production: `#080b10` silhouette, `#fff2ce` core, core length ratio `.68`, the six-vertex/four-triangle pointed geometry, and the same perspective targets/caps. Geometry and transforms live in `DefenseTracer.ts`; constants live in `ArtDirection.ts`.
- Two pooled instanced batches and existing basic materials remain. Removed the obsolete GLB-derived Defense shape, optional presentation setter/state, rejected presets, selector, and overwritten camera-plane basis calculation. One owned geometry is disposed once; the borrowed Legacy GLB and Legacy transforms remain unchanged. Level Up has no projectile appearance effect.
- DEV contains exactly LATE, CRATE3, CRATE8 and NAVAL. Existing Tuning Panel, balance/audio controls, 44px button targets, responsive layout and safe-area handling remain. Removed the 4/5/6 listener and GameApp's SHELL launch branch.
- Removed scenarios moved to `tests/helpers/ReviewFixtures.ts` and `tests/helpers/ShellReview.ts`. Retained NAVAL has its own runtime adapter. Browser QA clicks retained buttons; removed scenarios use a test-side factory and SHELL input wrapper. No application module imports the QA helpers.
- Updated affected browser actions, assertions and current documentation. Selector-specific capture scripts were replaced by `projectile-finalization.mjs`.

## Exactness and regression evidence

Before editing, captured P3 instance matrices for 350/390px, five depths (1/20/30/40/150), three slopes and two muzzle ages. All 60 core/outline matrix pairs match exactly (JSON-normalized signed zero). Geometry, colors, size constants, anchoring, pooling and disposal also pass.

All thirteen original fixture initial-state SHA-256 hashes match after migration. Existing combat/continuation assertions remain; obsolete selector/shortcut tests were replaced with permanent-P3 and absent-control checks.

Production inspection uses the actual shipping bundle with a test-side app reference only. Both widths verify the exact P3 geometry/colors, stable Level Up/Retry/snapshot appearance and absent DEV UI. Normal DEV verifies all four retained controls. Production natural Lv1–8 milestones match the prior baseline exactly: Lv2 9.33s, Lv3 25.57s, Lv4 44.85s, Lv5 65.13s, Lv6 87.30s, Lv7 100.73s, Lv8 140.03s (seed-17 QA pilot). Legacy, Pause, Retry and 120-tick snapshot continuation pass.

## 54 Hz comparison

Chrome/SwiftShader, DPR2, 4× CPU throttle, same MG8 fixture, three six-second samples per width after 2.5 seconds of real RAF warm-up. Before replays the selected P3 renderer from the baseline; after uses permanent P3. These are desktop emulation measurements, not phone GPU measurements.

| Viewport | Mean frame before → after | Per-run mean range before → after | Projectile JS before → after |
| --- | --- | --- | --- |
| 350×844 | 22.60 → 22.64 ms | 22.33–23.01 → 22.52–22.84 ms | .294 → .210 ms |
| 390×844 | 24.32 → 24.38 ms | 24.19–24.45 → 24.32–24.49 ms | .300 → .217 ms |

Both: p95 33.4ms, worst 66.7ms, no frames over 100ms; approximately 54 shots per simulation second. Pool capacity remains 128 with two batches. First projectile submission compiled one program in both versions: outline 24.2/33.9ms before versus 29.9/29.5ms after; core .3–.5ms. No additional projectile shader or first-use path was introduced.

## Local browser evidence

Generated evidence remains under ignored `artifacts/p3b34/`:

- `visual/production-lv1-350.png`, `production-lv1-390.png`: ordinary production Rifle fire.
- `visual/production-350.webm`, `production-390.webm`: uninterrupted production fire, decoded/seeked for media validation.
- `visual/dev-menu-{350,390}.png`, `dev-lv{1,3,6,8}-{350,390}.png`, `dev-{350,390}.webm`: permanent P3 and cleaned menu.
- `before-performance/`, `after-performance/`: individual samples, resource and first-draw data.
- `production/`, `modes/`, `evolution/`, `grenade/`, `artillery/`, `naval/`, `readiness/`: browser assertions, captures and recordings where supported.

Physical-phone appearance approval is the user's P3 selection. This task does not substitute desktop pixel estimates for that approval; another physical-device performance run remains useful. No deployment or frozen-tag modification is part of this task.

## Validation

- `npm test`: **150 files / 1,067 tests passed**. `npm run typecheck` and `npm run build` passed. Existing Zod annotation and bundle-size warnings remain.
- `projectile-finalization.mjs`, `production-sanity.mjs`, `startup-modes.mjs`: DEV/production P3, controls, content-addressed `/topwar/` assets, no duplicate resource requests or DEV/QA production leakage, natural Lv1–8, Legacy Boss, Pause/Retry/snapshot continuation.
- `evolution-fixture-sanity.mjs`, `late-dev-sanity.mjs`: migrated evolution/MG7/MG8/curve scenarios, deterministic resets, 150-second late gameplay, progression and bounded resources. Lv5→6 remains 1.00s after ten ordinary kills; six alternating evolution/MG resets hold 85 geometries / 11 textures / 32 projectile slots.
- `carnival-sanity.mjs`: accepted 24-second Carnival, authored Destroyer handoff, then Survival; Pause, phase snapshot replay and exact Retry. Dense 80-enemy software-rendered samples still cost 52.6–53.5ms/frame; this is a remaining GPU/emulation limitation, not a physical-phone result or a matched regression comparison.
- `p28-browser.mjs`: eight mobile scenario checks for CRATE3/CRATE8, Grenades, Giant/Heavy reactions, empty-field throws, Pause and in-flight restore. `p3a-browser.mjs` and `p3b-browser.mjs`: artillery singles/overlaps and NAVAL at both mobile widths plus desktop.
- `runtime-readiness.mjs`: missing-portrait NAVAL fallback with voice, resize/safe-area transfer alignment, Pause, WebGL context loss/restore, Retry and disposal at both widths. No browser errors in these checks.

## Startup and first-use regression samples

Same Chrome/SwiftShader profile before/after: 4× CPU, DPR2, 150ms latency, 1.6Mbps download, three cold and three warm navigations per viewport. Timings are medians to the Tap-to-Start mark; brackets show the run range.

| Viewport/cache | Before | After |
| --- | --- | --- |
| 350 cold | 3.957s [3.933–4.114] | 4.064s [4.001–4.075] |
| 350 warm | 1.965s [1.872–2.161] | 2.139s [2.054–2.174] |
| 390 cold | 3.998s [3.927–4.070] | 3.940s [3.905–3.969] |
| 390 warm | 1.975s [1.927–2.082] | 1.983s [1.858–2.110] |

350px warm median was 175ms higher; this small sample overlaps the baseline range and does not establish its cause. No startup speedup is claimed. At 390px cold startup improved slightly and warm was essentially unchanged. First-frame medians were 4.232→4.346s / 2.176→2.399s at 350 cold/warm, and 4.279→4.213s / 2.174→2.229s at 390. After-change tap-to-interactive medians were 73/66ms at 350 cold/warm and 69/64ms at 390. Request count stays eight, cold transfer 481,266→481,106 bytes, warm transfer zero. All twelve after samples have zero blank Observer frames and ready-portrait speech starting at offset zero. Raw measurements: `before-startup/startup.json`, `after-startup/startup.json`.

Crate traces use the existing 4× CPU profile; first and two repeat openings in each browser session:

| Viewport / scenario | First maximum frame | Repeat maximum frames |
| --- | --- | --- |
| 350 CRATE3 | 149.9ms | 66.7 / 66.7ms |
| 350 CRATE8 | 116.7ms | 66.7 / 50.1ms |
| 390 CRATE3 | 150.0ms | 66.8 / 66.8ms |
| 390 CRATE8 | 133.3ms | 50.1 / 50.1ms |

No event-window frame exceeded 200ms, no reward-triggered network requests, and icon bounds were measured once per transfer. The existing first crate-fade material/driver diagnostics remain visible in traces (for example the first 350 CRATE3 retaining-strap draw); this task adds no new first-use resource path. The earlier runtime hitch fixes remain intact. Raw Chrome traces and JS/Layout/Paint breakdowns are in `hitches/`.

Delivery is a main-branch commit; its SHA is supplied in the delivery message. Frozen `playtest-2026-10-08` remains `59136b49e1328ab754412f7affe90c755c76c0fd`. No deployment; no P3-C work.
