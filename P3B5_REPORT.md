# P3-B.5 Post-NAVAL Endless Survival

Implementation commit: 9aa1bcc7ba8268f2a7fd744188cf1c84c580a37f. Canonical baseline: 9c445c2881bcedec6d76f31cd9c5fa9d8593b6ef. Validation: 2026-10-11. This report is committed separately after the implementation.
Frozen tag remains 59136b49e1328ab754412f7affe90c755c76c0fd. No deployment or P3-C work.

## Authored configuration and ownership

Survival still activates exactly at the concurrent Destroyer's +27-second completion, after Carnival finishes at +24. Only new Survival activations replace the consumed ordinary deadline with activation+1 second. No battlefield clearing or overdue burst occurs. Thereafter the existing ordinary row cursor admits one full group every six seconds indefinitely:

| Progression | Total | Grunts | Heavies | Pressure lanes | Interval |
| --- | --- | --- | --- | --- | --- |
| Lv6–7 | 30 | 26 | 4 | 3 | 6s |
| Lv8 | 42 | 36 | 6 | 4 | 6s |

Selection uses progression, never living soldier count. Existing Heavy HP 15, speeds, enemy damage, player damage/rates, XP math and lane selection are unchanged. Future admissions alone use the new settings. New optional configuration fields are advancedProfile (startLevel 8), waveIntervalSeconds (6), firstWaveDelaySeconds (1) and maxActiveEnemies (180); all are serialized configuration, not new state fields.

The Survival-only soft cap skips the whole ordinary opportunity if adding its complete group would exceed 180 living enemies. Existing enemies are retained even if already above the cap. Every blocked/missed slot advances time and row cursors without global gameplay RNG draws or queued waves. Recurring Giants also skip a population-full slot: every 24s, maximum one living Giant, unchanged HP172/speed0.68/XP120/interior placement. Supply opportunities remain every30s, +1 to maximum3, skip full inventory/any existing crate, unchanged staged destruction and reward presentation.

Human LATE now starts Lv8 with three staggered 18Hz MG soldiers, three Grenades and an immediate 36-Grunt/6-Heavy group; the next wave is at +6s. The menu remains exactly LATE/CRATE3/CRATE8/NAVAL. Other controls are unchanged. Test-only LATE retains Lv6; browser QA can explicitly select late6. No new shipping QA endpoint or renderer/VFX/audio work was introduced.

## Matched difficulty measurements

Exact historical code/config and final code use the same 60Hz pilot and seeds1,17,42,99,2026. Natural runs begin at Lv1 and continue for 180 seconds after Survival activation. Isolated Lv7 and Lv8 runs start with ordinary combat, a completed release/teaching intro and one immediate group, then run180s. The primary pilot makes one adjacent decision every200ms, prefers Supply/nearest threat/Giant and uses ordinary emergency Grenades. A separate600ms pilot checks a slower reaction; a fixed-lane pilot ignores other lanes and uses no Grenades. No invulnerability, damage override, XP grant during combat or disabled natural artillery.

At naval departure, all five natural runs match baseline exactly in Lv1–7 entry times, activation time, enemies, cursors, weapon/projectile clocks, Grenade state, Giant state, squad/progression, Carnival/Destroyer clocks and gameplay RNG. Only the new Survival settings/deadline differ. The first new natural wave arrives exactly1.00s after departure, rather than inheriting a variable0.40–5.75s ordinary deadline.

| Seed | Survival activation | Old first-wave delay | New delay | Old Lv8 entry | New Lv8 entry |
| --- | --- | --- | --- | --- | --- |
| 1 | 121.92 | 5.75 | 1.00 | 151.35 | 131.02 |
| 17 | 121.18 | 0.48 | 1.00 | 135.40 | 128.55 |
| 42 | 122.65 | 5.02 | 1.00 | 136.40 | 126.70 |
| 99 | 121.27 | 0.40 | 1.00 | 118.48 | 118.48 |
| 2026 | 120.43 | 1.23 | 1.00 | 119.12 | 119.12 |

Times above are absolute simulation seconds except the first-wave delays. Faster post-NAVAL Lv8 entry follows ordinary XP from more enemies; progression math is untouched. Isolated entries already contain a group at0; their new next group is at6 rather than the historical1.67.

The table below records all180s with the primary pilot. Peak HP debt and mean populations use one-second samples. Peaks are measured every tick. Kills include new Grunts killed by already-travelling projectiles on the admission tick; groups are measured by allocated IDs, not merely the remaining visible enemies.

| Scenario | Seed | Old/new kills | Old/new peak enemies | New mean active | New peak HP debt | Old/new longest target gap |
| --- | --- | --- | --- | --- | --- | --- |
| natural | 1 | 94/1243 | 5/61 | 23.21 | 286 | 5.75/2.77s |
| natural | 17 | 101/1247 | 6/58 | 17.63 | 243 | 4.00/3.22s |
| natural | 42 | 96/1256 | 4/55 | 20.40 | 276 | 4.77/2.67s |
| natural | 99 | 97/1267 | 4/62 | 18.87 | 255 | 3.98/2.70s |
| natural | 2026 | 97/1267 | 4/63 | 19.93 | 266 | 3.98/2.48s |
| lv7 | 1 | 100/1213 | 5/62 | 22.47 | 298 | 4.02/3.05s |
| lv7 | 17 | 100/1210 | 5/62 | 22.45 | 289 | 4.02/3.22s |
| lv7 | 42 | 100/1211 | 5/59 | 21.90 | 291 | 3.80/3.20s |
| lv7 | 99 | 100/1212 | 5/62 | 22.29 | 289 | 4.02/3.05s |
| lv7 | 2026 | 100/1212 | 5/62 | 21.77 | 289 | 4.02/3.42s |
| lv8 | 1 | 100/1274 | 5/62 | 23.42 | 298 | 3.98/2.65s |
| lv8 | 17 | 100/1272 | 5/62 | 23.02 | 290 | 3.98/2.68s |
| lv8 | 42 | 100/1271 | 5/57 | 22.90 | 291 | 3.80/2.67s |
| lv8 | 99 | 100/1272 | 5/62 | 23.18 | 290 | 3.98/2.83s |
| lv8 | 2026 | 100/1273 | 5/62 | 22.84 | 289 | 3.98/2.83s |

All primary runs survive180s with zero casualties, 72 peak live projectiles and30 future wave admissions at six-second cadence; no cap blocks for this informed pilot. Lv7 starts with26+4 across3 fronts, then changes only future admissions to36+6 across4 on reaching8. Every sampled lane population is in raw metrics. Peak enemies within10/20 units are zero for both primary and slower pilots: they clear at distance. This is sustained clearing pressure, not proof of moderate human difficulty. Target gaps mean no live enemy within the configured80-unit MG range, across all lanes; they do not mean every lane always has a target.

All primary runs consume7 Giant opportunities at24…168s and6 Supply opportunities at30…180s. Giants spawn at each primary opportunity. Natural runs admit3 recurring Supplies; isolated runs keep inventory full and skip all6. Existing tests separately exercise spending, staged acquisition, occupied crates and in-flight inventory.

The600ms Lv8 pilot also survives180s with zero casualties, 61–69 peak enemies, 1265–1273 kills (7.03–7.07/s) and3.02–3.37s target gaps. This automated policy has perfect state awareness despite bounded movement/reaction, so it is an optimistic clearing benchmark. Fixed-lane results expose neglected-lane buildup:

| Seed | Old failure age | New failure age | New peak/near10 enemies | New peak HP debt | Cap-blocked waves |
| --- | --- | --- | --- | --- | --- |
| 1 | 54.87 | 49.62 | 163/67 | 680 | 4 |
| 17 | 54.87 | 49.87 | 152/89 | 610 | 5 |
| 42 | 54.87 | 50.62 | 165/69 | 669 | 4 |
| 99 | 56.53 | 50.03 | 161/63 | 651 | 4 |
| 2026 | 56.53 | 50.28 | 163/68 | 680 | 4 |

Each fixed pilot loses its three soldiers through ordinary contact; no scripted failure or forced survival. Primary clear rates rise from roughly0.52–0.56 enemies/s to6.72–7.08/s, with substantially higher simultaneous density. Exact requested balance was retained rather than tuned to pilot success.

## Snapshot compatibility

No snapshot version or state shape changes. Missing optional profile/interval/delay/cap fields retain old serialized groups and deadlines, including the three-Heavy placeholder; absent whole configuration remains disabled. Two real P3-B.4 Survival saves (natural entry and established Lv8 at180s) are committed in tests/fixtures/old-survival.json and replay under new code without clock resets or rebalance. Historical sequential Carnival/Destroyer saves remain covered by the existing five captured fixtures. Validators still reject corrupt phase clocks, ownership and consumed cursors. Retry resets the new sequence; disabling Survival restores the retained ordinary stream without altering combat.

Browser replay comparisons use complete parsed states: object property ordering after schema parsing is not gameplay divergence. A production QA pilot was corrected to stop issuing direct lane commands while paused; the full frozen-state assertion remains. Legacy Supply QA explicitly selects historical ten-hit configuration and the current crate hit pulse, keeping normal three-stage play unchanged.

Tests cover exact handoff/first wave, mixed composition by progression after casualties, capacity-fit/full/over-cap and missed slots, Giant cap/no catch-up, serialized old settings, deterministic180s natural/Lv8 continuation across all five seeds, supplies, Pause/Retry, legacy and existing authored encounters.

## Mobile browser performance

Desktop Chrome/SwiftShader, CPU4×, 350×844 and390×844, DPR1. Each primary profile runs continuously for90s with three sequential30s windows and six-second resource samples. These are not three independent cold starts. Baseline uses exact9c445c2 source/config; both versions enter the same seed17 Lv8 review after three real seconds of startup preparation. Recordings are separate from timing. The browser pilot has the same adjacent 200ms policy evaluated on render frames, so its exact inputs vary with RAF timing.

| Stage | Width | Mean per window (ms) | p95 per window | Longest per window | >100ms per window | >200ms per window |
| --- | --- | --- | --- | --- | --- | --- |
| before | 350 | 17.13/16.69/16.69 | 16.80/16.80/16.80 | 233.30/50.00/22.80 | 1/0/0 | 1/0/0 |
| before | 390 | 16.94/16.69/16.67 | 16.80/16.80/16.70 | 100.10/50.00/16.80 | 1/0/0 | 0/0/0 |
| after | 350 | 23.46/24.62/24.23 | 33.40/33.40/33.40 | 200.10/50.10/66.60 | 5/0/0 | 1/0/0 |
| after | 390 | 23.29/24.35/24.61 | 33.40/33.50/33.50 | 216.60/66.70/52.20 | 6/0/0 | 1/0/0 |

The sparse baseline averages approximately17ms; the mixed waves average23–25ms with57–62 peak enemies, against5. Sustained warm windows have no frames above100ms. Initial synthetic jumps still show200–217ms frames, versus100–233ms historically. Earlier matched final runs varied166–233ms on their first window. No shader, texture, renderer or VFX implementation was changed; this timing does not attribute a specific shader/GPU cost or reproduce natural121-second preparation. The extra full-scene cost is retained rather than hidden by reducing quality.

| Stage | Width | Peak enemies/projectiles | Draw calls | Triangles | Final geometries/textures | Projectile pool |
| --- | --- | --- | --- | --- | --- | --- |
| before | 350 | 5/72 | 164 | 42894 | 93/12 | 128 |
| before | 390 | 5/72 | 165 | 42594 | 100/12 | 128 |
| after | 350 | 57/72 | 181 | 196242 | 100/12 | 128 |
| after | 390 | 62/72 | 181 | 195080 | 100/12 | 128 |

Geometry/texture counts plateau by roughly30s through90s; no wave-by-wave resource growth or network request. The old350 run warms fewer optional presentation resources (93 geometries) than the other runs (100); the other baseline viewport and both final viewports share the100 plateau. New mixed Grunts and more deaths increase submitted triangles/draw calls through the existing pools. Simulation p95 is0.7ms; render submission p95 is6.3/7.1ms in final350/390. Peak72 projectiles and128-slot pools retain54Hz firing. No new asset is fetched for Survival.

The separate fixed-lane stress profile holds lane 2 with three MG soldiers and no Grenades for 45 seconds, before ordinary casualties begin. It uses the same seed, CPU throttle and initial preparation; its windows are 30s then 15s. Both versions remain alive throughout this browser sample.

| Stage | Width | Mean per window | p95 per window | Longest per window | >100ms | >200ms | Peak enemies | Peak draws/triangles |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| before | 350 | 17.58/19.56ms | 16.8/33.4ms | 200.0/33.5ms | 3/0 | 0/0 | 21 | 187/89766 |
| before | 390 | 17.85/20.22ms | 16.8/33.4ms | 200.1/33.5ms | 2/0 | 1/0 | 21 | 187/89766 |
| after | 350 | 60.29/84.82ms | 100/100ms | 283.4/100.1ms | 19/2 | 5/0 | 152 | 207/427622 |
| after | 390 | 58.45/84.27ms | 100/100ms | 266.7/100.1ms | 19/2 | 3/0 | 151 | 207/424684 |

This is a substantial dense-crowd performance risk, despite the bounded admissions. Final simulation p95 is 3.1/3.0ms and render submission p95 is 8.4/8.6ms; those measurements alone do not explain the entire frame interval or isolate GPU cost. Geometries/textures stabilize at 99/12 by 30s through 42s, with 72 live projectiles, a 128-slot projectile pool and no new network requests. Most >200ms frames occur in the first window; the subsequent steady ~84ms mean is crowd cost rather than a single first-use hitch. No unrelated renderer optimization or reduction of the requested 180 cap/visual quality was made. Physical-phone GPU and thermal testing is necessary before calling cap-full gameplay smooth.

Cold/Warm startup uses the existing production profiling script: CPU4×, 150ms network latency, 1.6Mbps download/750Kbps upload, DPR2, three independent cold-cache contexts and a subsequent warm navigation per size. The before build is the retained accepted P3-B.4 instrumented build from its final validation (build branding predates its implementation commit); after is freshly instrumented current code. Shipping build QA is separate.

| Width/cache | Before/after median Tap-to-Start | Before/after median first frame | Before/after median tap-to-interactive |
| --- | --- | --- | --- |
| 350/cold | 3522.2/3557.8ms | 3724.8/3770.7ms | 60.0/72.2ms |
| 350/warm | 1485.8/1505.7ms | 1648.4/1669.9ms | 65.1/60.7ms |
| 390/cold | 3546.3/3512.6ms | 3754.7/3740.3ms | 74.5/70.4ms |
| 390/warm | 1581.1/1533.6ms | 1750.8/1693.5ms | 63.7/64.2ms |

Cold Tap-to-Start ranges: before 350=3513–3532ms, 390=3503–3565ms; after 350=3554–3617ms, 390=3504–3548ms. No material startup regression is established by these small samples. All runs make eight measured startup resource requests; cold transfers are 481390 bytes before and 481848 after (+458 bytes), warm transfers zero. Both builds start voice at offset zero with a decoded portrait and zero blank frames in all 12 runs. Existing content-addressed assets, `/topwar/` paths and one-GLB Defense startup remain intact.

## Validation and evidence

- Full Vitest suite: 152 files / 1104 tests pass. Typecheck and production build pass; the existing bundle-size advisory remains. Logs: `artifacts/p3b5-tests.log`, `p3b5-typecheck.log`, `p3b5-build.log`.
- Both 350×844 and 390×844: natural Lv1–8 production Defense, Tap-to-Start, Pause/Resume, complete snapshot continuation, Retry and Legacy/Boss pass (`startup-modes.mjs`). Production assets/hash URLs/DEV exclusion pass (`production-sanity.mjs`).
- Both portrait sizes: Carnival admission cap/release/concurrent naval timing and handoff, stable P3 projectile appearance in DEV and production, CRATE3/CRATE8/Grenade explosion/Heavy/Giant, historical ten-hit Supply and the retained Lv6 QA scenario pass. NAVAL warning/five shells/departure also passes at desktop reference width.
- Observer failure emblem and voice-at-zero, safe-area resize, WebGL restoration and resource disposal pass (`runtime-readiness.mjs`). Human LATE has level 8, three living MG soldiers and the correct 42-enemy group; menu/Pause/Retry/120-tick full parsed-state replay pass in the new Survival browser script.
- No gameplay weapons, progression, projectile renderer, environment, Observer, audio, artillery or art assets changed. Only authored Survival data, Survival scheduling/validation and human LATE behavior change production behavior.

Evidence is retained locally in ignored `artifacts/p3b5/` rather than committing large recordings:

- `baseline/metrics.json` and `final/metrics.json`: 25 deterministic runs per version, every wave/opportunity and one-second lane/HP samples.
- `baseline-browser/results.json`, `final-browser/results.json`: continuous 90s moving-pilot RAF/resource rows. `baseline-fixed-browser/results.json`, `final-fixed-browser/results.json`: 45s neglected-lane stress rows. The earlier repeat is in `pre-cleanup-browser-results.json`.
- `before-startup/startup.json`, `after-startup/startup.json`: every cold/warm run, marks, transfer bytes, image/audio readiness.
- `baseline-browser/{350,390}-survival.webm`, `final-browser/{350,390}-survival.webm`: separate 30s composited recordings with game audio; corresponding `*-survival-video-{0,1}.png` are actual recording frames. Inspected native-size final frames show stable Ink Spear tracers, existing HUD/art composition and visible mixed waves; phone readability still requires the user.
- `production`, `modes`, `carnival`, `projectile`, `grenade`, `naval`, `readiness` and `legacy-supply` subdirectories contain browser screenshots/results; matching `artifacts/p3b5-*.log` files record successful checks.

## Remaining phone risks

These counts are provisional. Both moving pilots clear at long range with zero casualties; actual phone input and human threat selection may produce much more accumulation. Confirm whether26+4 and36+6 feel moderately demanding, whether four-lane priorities stay legible, and whether cap-full crowds/recurring Giants remain smooth under sustained three-MG fire. Desktop SwiftShader/CPU throttling cannot establish physical-phone GPU FPS, Safari behavior or thermal limits. No resolution, geometry, VFX, audio or projectile quality was reduced. No Victory, new Giant, Air Drop, Tank Boss or P3-C system was added.
