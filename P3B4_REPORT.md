# P3-B.4 Difficulty Curve Rebalance

Baseline: 83afed85f4552801feb92ac4165d0747b9e3dce4.
Phase A: 25d2ba38d4f9eadb6e177677683bcc024aafb49a.
Phase B: 314a433e4dcbf5f071b8cc1325396649482c0b5b.
Validation date: 2026-10-11. Frozen playtest tag remains 59136b49e1328ab754412f7affe90c755c76c0fd. No deployment or P3-C work.

## Exact changes

- Giant unlock 5→4; introduction delay 6→0 seconds. The ordinary kill tick reaching Lv4 also schedules and spawns the Giant at the unchanged 38-unit distant position. HP 172, speed 0.68, XP 120, one-time flag, interior-lane selection and presentation remain unchanged.
- Lv4 future waves at 63/180 XP (35%): 22 Grunts + 2 Heavies, 24 total, four fronts. Lv5 at 55/220 XP (25%): 27 Grunts + 3 Heavies, 30 total, three fronts. Before those thresholds, the original seeded Heavy chance remains. Six-second cadence, HP, movement, lane algorithm and every player weapon/progression value are unchanged.
- New games author Destroyer startPolicy=withCarnival. Both phases use the exact Lv6 release timestamp. The mandatory 59-Grunt/one-Heavy release remains untrimmed, alongside survivors. Carnival retains fifteen capped 36-Grunt opportunities at 2, 3.5, …, 23 seconds, rotating the existing lane pairs, with an admission limit of 80. There is no second ordinary stream.
- Destroyer warning starts at +1.3; shells remain +8.8/+12/+16/+17.3/+21; exit starts +23. Carnival completes +24, Destroyer +27, then Temporary Survival starts. Ordinary deadlines are consumed throughout both phases; no backlog is released afterward. Existing enemies are never cleared or converted.
- A lethal artillery tick updates Carnival's elapsed clock without admitting enemies, fixing invalid Game Over snapshots during overlap. Direct hits still remove one soldier; an undodged first shell can kill the sole Lv6 MG.

Production edits are limited to authored configuration, Giant validation, Destroyer scheduling and simulation phase validation. No renderer, artwork, audio, controls, projectile, damage, collision or RNG code was retuned. DEV still contains exactly LATE, CRATE3, CRATE8 and NAVAL.

## Matched deterministic difficulty measurements

All times below are simulation seconds. Natural Lv1 starts at 0; no DEV fixture, XP grant, invulnerability, damage change or artillery disabling is used. The same pilot runs 240 seconds at 60 Hz: one adjacent lane input every 200ms, Supply/nearest-threat/Giant priority, avoid locked artillery lanes, ordinary emergency Grenades. Each final run is repeated in unit tests and produces identical gameplay results (CPU timing excluded). Raw runs and admission/HP records are local ignored artifacts in artifacts/p3b4/{baseline,phase-a,final}/metrics.json.

| Stage | Seed | Lv2 | Lv3 | Lv4 | Lv5 | Lv6 | Lv7 | Lv8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline | 1 | 10.32 | 30.23 | 47.42 | 67.50 | 90.53 | 104.62 | 146.05 |
| Baseline | 17 | 12.60 | 27.85 | 44.98 | 66.08 | 89.03 | 101.25 | 113.42 |
| Baseline | 42 | 10.95 | 28.32 | 46.35 | 68.32 | 90.67 | 103.68 | 116.52 |
| Baseline | 99 | 10.95 | 26.92 | 45.03 | 67.35 | 88.83 | 102.10 | 114.60 |
| Baseline | 2026 | 10.33 | 27.88 | 49.07 | 71.58 | 93.35 | 106.07 | 117.83 |
| Phase A | 1 | 10.32 | 30.23 | 47.42 | 83.12 | 94.92 | 110.48 | 160.20 |
| Phase A | 17 | 12.60 | 27.85 | 44.98 | 83.50 | 94.18 | 108.53 | 121.02 |
| Phase A | 42 | 10.95 | 28.32 | 46.35 | 83.77 | 95.65 | 109.07 | 121.03 |
| Phase A | 99 | 10.95 | 26.92 | 45.03 | 82.55 | 94.27 | 106.95 | 118.60 |
| Phase A | 2026 | 10.33 | 27.88 | 49.07 | 81.63 | 93.43 | 107.62 | 119.72 |
| Final | 1 | 10.32 | 30.23 | 47.42 | 83.12 | 94.92 | 110.92 | 151.35 |
| Final | 17 | 12.60 | 27.85 | 44.98 | 83.50 | 94.18 | 108.72 | 135.40 |
| Final | 42 | 10.95 | 28.32 | 46.35 | 83.77 | 95.65 | 110.87 | 136.40 |
| Final | 99 | 10.95 | 26.92 | 45.03 | 82.55 | 94.27 | 107.07 | 118.48 |
| Final | 2026 | 10.33 | 27.88 | 49.07 | 81.63 | 93.43 | 107.62 | 119.12 |

Lv1–4 entry times are identical across all three stages, preserving Lv3→4 danger. Earlier Giant combat lengthens Lv4; its ordinary 120-XP kill reward completes Lv4 and leaves 88–112 XP in Lv5 in these runs. This crosses the unchanged 55-XP pressure threshold immediately; future Lv5 waves consequently use three Heavies. No level is skipped. This is a real combat/XP consequence, not a scripted promotion.

### First Giant

| Seed | Old spawn | Old death | Old survival | New spawn | New death | New survival |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 73.50 | 87.17 | 13.67 | 47.42 | 83.12 | 35.70 |
| 17 | 72.08 | 85.80 | 13.72 | 44.98 | 83.50 | 38.52 |
| 42 | 74.32 | 87.60 | 13.28 | 46.35 | 83.77 | 37.42 |
| 99 | 73.35 | 86.58 | 13.23 | 45.03 | 82.55 | 37.52 |
| 2026 | 77.58 | 90.58 | 13.00 | 49.07 | 81.63 | 32.57 |

Every first Giant starts at 172 HP. Phase A and Final first-Giant times/HP/placement/deaths are identical. All five are killed normally before Lv6; survival is not forced. Unit tests also cover one-time spawning after death, exact same-tick Lv4 spawn, least-crowded interior placement, ordinary Grunt/Heavy coexistence, threshold boundaries, population/debt, historical delayed introduction and JSON continuation.

### Destroyer and progression consequences

| Stage | Seed | Entrance | Shells 1–5 (absolute seconds) | Survival |
| --- | --- | --- | --- | --- |
| Baseline | 1 | 114.53 | 123.33, 126.53, 130.53, 131.83, 135.53 | 141.53 |
| Baseline | 17 | 113.03 | 121.83, 125.03, 129.03, 130.33, 134.03 | 140.03 |
| Baseline | 42 | 114.67 | 123.47, 126.67, 130.67, 131.97, 135.67 | 141.67 |
| Baseline | 99 | 112.83 | 121.63, 124.83, 128.83, 130.13, 133.83 | 139.83 |
| Baseline | 2026 | 117.35 | 126.15, 129.35, 133.35, 134.65, 138.35 | 144.35 |
| Phase A | 1 | 118.92 | 127.72, 130.92, 134.92, 136.22, 139.92 | 145.92 |
| Phase A | 17 | 118.18 | 126.98, 130.18, 134.18, 135.48, 139.18 | 145.18 |
| Phase A | 42 | 119.65 | 128.45, 131.65, 135.65, 136.95, 140.65 | 146.65 |
| Phase A | 99 | 118.27 | 127.07, 130.27, 134.27, 135.57, 139.27 | 145.27 |
| Phase A | 2026 | 117.43 | 126.23, 129.43, 133.43, 134.73, 138.43 | 144.43 |
| Final | 1 | 94.92 | 103.72, 106.92, 110.92, 112.22, 115.92 | 121.92 |
| Final | 17 | 94.18 | 102.98, 106.18, 110.18, 111.48, 115.18 | 121.18 |
| Final | 42 | 95.65 | 104.45, 107.65, 111.65, 112.95, 116.65 | 122.65 |
| Final | 99 | 94.27 | 103.07, 106.27, 110.27, 111.57, 115.27 | 121.27 |
| Final | 2026 | 93.43 | 102.23, 105.43, 109.43, 110.73, 114.43 | 120.43 |

Entrance equals Lv6 time in Final, rather than Lv6+24 in Baseline/Phase A. Carnival always ends at Lv6+24. Final Survival begins at Lv6+27; sequential saves retain Lv6+51. Lv7/Lv8 advance through ordinary XP, including lane changes needed for artillery.

All three stages: 0 casualties and 0/5 Game Overs for this informed pilot, all seeds reach Lv8. This is not a human failure-rate estimate. An additional undodged one-soldier test dies during Carnival and successfully round-trips its frozen Game Over state. Peak enemy counts by seed 1/17/42/99/2026 remain 184/178/183/172/177 across all stages; peak projectiles remain 72. The old production browser pilot could steer into a locked target lane; it now avoids those lanes and uses emergency Grenades without altering artillery. Both production viewports reach every level naturally, with Pause/Retry/snapshot replay intact.

## Snapshot compatibility

Missing Destroyer startPolicy defaults explicitly to afterCarnival, preserving serialized historical balance and sequential clocks. Five real natural seed-17 snapshots captured before editing (Carnival start/middle/completion, Destroyer middle/completion) are committed in tests/fixtures/sequential-encounters.json. Each loads under new code, continues identically in two simulations, emits only remaining shots and retains its original Survival origin. Older missing-phase saves still skip already-past encounters; shorter pre-voice naval schedules remain covered.

Concurrent restores require identical Carnival/Destroyer origins. Validators reject future clocks, mismatched policies, missing concurrent entrance, consumed-shot resets, active Carnival opportunity resets/future cursors, overlapping Survival ownership and backdated Survival activation. Completed historical Carnival saves may keep older consumed cursors after large steps: they never admit again, so they remain loadable. Retry constructs a fresh simultaneous sequence.

## Runtime and resource measurements

Desktop Chrome, SwiftShader, CPU 4×, mobile 350×844/390×844, DPR 1; three 28-second samples per profile. Historical source is served at the exact baseline revision with its historical game.json. Each replay begins from its natural seed-17 Carnival entry after three real seconds of normal presentation preparation. Runs 2/3 reuse prepared resources in the same page. Recordings are separate from measurements. This compares the full rebalance and overlap, not an isolated identical-crowd naval draw.

| Stage | Width | Mean (runs 1/2/3) | p95 (runs 1/2/3) | Longest (runs 1/2/3) | Frames >200ms (runs 1/2/3) |
| --- | --- | --- | --- | --- | --- |
| Baseline | 350 | 50.63 / 48.03 / 46.59 | 83.30 / 83.30 / 83.30 | 450.00 / 133.40 / 116.70 | 6 / 0 / 0 |
| Baseline | 390 | 46.28 / 46.51 / 46.90 | 66.80 / 83.30 / 83.30 | 316.70 / 116.60 / 116.70 | 2 / 0 / 0 |
| Final | 350 | 54.48 / 53.13 / 53.03 | 100.10 / 100.00 / 100.00 | 266.80 / 133.40 / 116.70 | 6 / 0 / 0 |
| Final | 390 | 49.04 / 52.63 / 49.47 | 83.40 / 100.00 / 99.90 | 299.90 / 133.30 / 133.40 | 6 / 0 / 0 |

Repeated frame means rise approximately 7–14% with the heavier crowd and concurrent effects. Repeated samples have no >200ms frames. Initial late-state replays still have 267–300ms stalls (baseline 317–450ms); Final includes an approximately 200–233ms first-shell frame. These early restores jump into a late crowd after only three real startup seconds and do not model the full natural preparation interval. They are retained as a conservative first-use risk, not concealed or claimed eliminated. No new rendering/audio initialization code was introduced. Specific GPU/shader/audio attribution is not established by RAF timing alone.

Final replay peak: 163 enemies versus historical 142; final includes more inherited Heavies and remains at Lv7 during most of this window. Peak submitted triangles about 441k versus 380k. Resource counts plateau across repeats: 103 geometries/11 textures versus 93/11 historically; artillery capacity remains 8. Projectile pools in the overlap replay remain 64 (48 live) because Lv8 is later, rather than reduced weapon firepower. The separate Lv8 test confirms 54Hz and a 128-slot pool. No model/image request is introduced by overlap; only the existing Destroyer Mandarin file is fetched on its first presentation.

Lv8 54Hz, DPR2/renderer cap1.6, CPU4×, three 6-second samples: mean frame 22.14–22.73ms at 350 and 24.32–24.59ms at 390; longest 83.3ms, none >100ms. Projectile update means 0.17–0.24ms. Approximately 324–328 shots per six-second sample (exact rate 54Hz against simulation time). Warm repeats add zero shader programs; the first 350 sample adds one program without a >100ms frame. Accepted P3 geometry/colors, stable Level Up appearance and Legacy presentation pass shipping-bundle assertions.

CRATE3/8 Chrome traces: first CRATE3 maxima 150.0/149.9ms (350/390), first CRATE8 116.8/133.4ms; repeats 50–66.8ms. No >200ms event-window frames, no new network requests, one cached destination measurement per transfer. These match the accepted earlier hitch-fix range; no runtime optimization was removed. Raw traces are under artifacts/p3b4/hitches.

## Startup regression

Representative 150ms latency/1.6Mbps network, CPU4×, DPR2, three Cold/Warm pairs per viewport. The saved accepted P3-B.3.4 instrumented build and current instrumented production build were rerun under matched conditions; baseline build branding predates its commit. Medians:

| Stage | Width | Cold → Start (s) | Warm → Start (s) | Cold → first frame (s) | Warm → first frame (s) |
| --- | --- | --- | --- | --- | --- |
| before | 350 | 3.97 | 2.05 | 4.23 | 2.27 |
| before | 390 | 3.95 | 1.85 | 4.23 | 2.06 |
| after | 350 | 3.94 | 1.99 | 4.21 | 2.20 |
| after | 390 | 3.95 | 1.95 | 4.25 | 2.16 |

Eight resource entries in every run; cold transfer 481,106→481,390 bytes (+284), warm transfer zero. Median Tap→interactive 60–75ms before and 62–67ms after. Portraits decode before the intro; zero blank frames, speech starts at offset zero. Warm 390 Start increases about 105ms while warm 350 decreases about 65ms; cold times are essentially unchanged. This does not establish a meaningful critical-path regression with three noisy samples. No additional critical asset or preload was added. Unchanged public assets retain content-addressed URLs; the changed game.json correctly receives a new hash.

## Verification and evidence

- Phase A: 150 test files / 1,068 tests, typecheck and production build passed. Final: 151 files / 1,090 tests, typecheck and production build passed. Existing Vite large-chunk warning remains.
- production-sanity: shipping DEV exclusion, correct /topwar/ paths, content hashes, normal/forced-threat review, Traditional Chinese intro and one Defense GLB.
- startup-modes: natural Lv1–8, Pause/Resume, Retry, snapshot continuation and Legacy Boss/13 unique GLBs at both mobile sizes.
- carnival-sanity: exact four-button menu, release/cap/24s completion, concurrent naval completion/Survival, Pause/Retry and active-phase snapshot replay.
- projectile-finalization: exact accepted P3 in DEV/production, no switcher, no Level Up appearance change, inactive removed shortcuts and current fixtures.
- p28-browser, p3a-browser, p3b-browser: Grenade supplies/explosion/Heavy/Giant reactions, artillery/overlap/dodge/impact, NAVAL transforms/warning/phase; Pause/Retry/restore.
- runtime-readiness: both portraits failed → local emblem and available voice, Pause, safe-area/resize, WebGL context restore and disposal.
- startup-profile, projectile-performance and runtime-hitches: measurements above; profiling remains QA-only.

Artifacts are retained locally under ignored artifacts/p3b4, not bundled or deployed. [350 warning](artifacts/p3b4/final-browser/350-warning.png), [390 warning](artifacts/p3b4/final-browser/390-warning.png), [350 overlap](artifacts/p3b4/final-browser/350-artillery-overlap.png), [390 overlap](artifacts/p3b4/final-browser/390-artillery-overlap.png). [350 recording](artifacts/p3b4/final-browser/350-concurrent.webm), [390 recording](artifacts/p3b4/final-browser/390-concurrent.webm) include Mandarin audio and the whole 27-second sequence. Screenshots are actual recording frames. Full raw RAF rows and counters: artifacts/p3b4/{baseline,final}-browser/results.json.

## Physical-phone risks

The new counts are provisional. Informed deterministic dodging does not predict human casualties; an early direct hit can legitimately end Lv6. Verify Lv4 crowd/Giant pressure, the normal Giant-XP overflow into Lv5, warning intelligibility over MG fire and the concurrent scene on a phone. Software WebGL is already below 60fps for dense baseline combat; the measured extra crowd cost and conservative first-replay stalls require real-device review. No physical-phone GPU/FPS, Safari autoplay or thermal claim is made. Temporary Survival, accepted art/effects and player firepower remain unchanged. Stop at P3-B.4.
