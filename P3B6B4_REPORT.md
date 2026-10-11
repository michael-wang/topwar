# P3-B.6B.4 — AHEAD production and endless naval barrage

Starting commit: `4b32eed1151814b4ccd95d9f88e0ddf3a6558a99`.

Three independently validated implementation commits:

1. `f1954dfa8a756d7e6cbd72eb3d41ecc805c276c2` — promote the approved AHEAD balance.
2. `b593a0fad204711ce5e70e28c1e84317e748e8ba` — independent naval presence and authored encounter ownership.
3. `f2d6f23c94b85e152a5a9daa23ba2c0e22ca6851` — deterministic repeating barrage, DEV review, regression tests and QA scripts.

All three features are enabled in the shipping configuration. No deployment was performed. The frozen `playtest-2026-10-08` tag remains at `59136b49e1328ab754412f7affe90c755c76c0fd`. A separate documentation commit records this report without changing the implementation.

## Exact shipping AHEAD configuration

| Progression | Grunts | Heavies | Total | Pressure lanes | Interval | Ordinary speed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Lv6–7 | 26 | 4 | 30 | 3 | 6s | 1.0× |
| Lv8, XP <245 | 31 | 11 | 42 | 4 | 6s | 1.4× |
| Lv8, XP ≥245 | 31 | 11 | 42 | 5 | 6s | 1.6× |
| Lv9 | 27 | 15 | 42 | 5 | 5s | 1.6× |
| Lv10 | 23 | 19 | 42 | 5 | 4s | 1.6× |

The profile and lookahead fields match `survivalExperiment.json.ahead` exactly. Changes apply only to future admissions. The first Survival ordinary wave remains +1s; the population soft cap remains 180; Giant opportunities remain every 24s with at most one living Giant; Supply opportunities remain every 30s with the existing inventory/crate checks. HP, XP, Giant speed and MG rates (18/22.5/27/54/81Hz) are unchanged.

DEV BASELINE, EXPERIMENTAL, STAGED and AHEAD are still separately authored controls. Their review factories explicitly omit the shipping naval policy so promotion does not silently alter those comparisons. LATE retains its Lv10 loadout and uses the selected authored Lv10 wave cadence. Main entries remain LATE / CRATE3 / CRATE8 / NAVAL.

## Component ownership and Stage 1 timeline

Small simulation modules replace the dependency on whether the ship is visible:

- `levelEncounters.ts`: ordered, versioned, data-driven time/level/MG-release triggers. Explicit ordinary-admission and Survival flags; consumed trigger clocks are saved. Actions also support later entrance, retreat and independent barrage on/off. `Simulation.commandEncounter` uses the same action path for QA and future authored callers.
- `navalPresence.ts`: absent → entering → stationed → explicitly requested retreat. Existing entrance position, ambient motion and visuals are retained. Re-entry does not restart the introductory encounter.
- `navalBarrage.ts`: enable state, dedicated RNG, next launch deadline and bounded outcome counters. It neither owns ordinary waves nor changes Survival deadlines.
- Existing Defense/Survival schedulers still own ordinary waves, Giant opportunities and Supplies. Existing Carnival still exclusively owns its admissions during its 24s window. Existing Destroyer state tracks the one-time introduction; existing artillery owns real shell flight, warnings, collision, impact and damage.

| Offset from Lv6 MG release | Shipping behavior |
| --- | --- |
| 0s | Existing 60-enemy release; Carnival and Destroyer introduction begin |
| 1.3s | Existing Field Observer warning |
| 8.8 / 12.0 / 16.0 / 17.3 / 21.0s | Exactly the original five attacks, using the original targeting/source path |
| 23s | Ship stays stationed; no automatic retreat |
| 24s | Carnival completes |
| 27s | Introduction completes; Survival enabled; ordinary admission flag enabled; recurring barrage enabled |
| 28s | First Survival ordinary wave |
| 28–29s | First recurring salvo, following its independent randomized delay |
| Thereafter | AHEAD waves, Giants and Supplies continue alongside artillery; ship remains offshore |

No Tank Boss, later stage or automatic retreat trigger was added. A future level can request retreat independently of barrage state. QA demonstrates presence without firing, barrage stop/resume without replay, retreat while waves continue, absent-source opportunity skips, and a later entrance without Carnival/MG Evolution.

## Salvos, randomness and structural limits

Shipping `navalBarrage` version 1 uses stream seed `1312904780`, 1–2 shells, a uniform integer count (50% each), distinct lanes sampled from `[0,1,2,3,4]`, and a uniform 1–2s interval. Three-shell future configurations are already tested without scheduler changes.

The stream starts from `(runSeed XOR streamSeed) >>> 0`; all naval draws use its own `SeededRng`. The ordinary gameplay RNG, wave cursors, Giant and Supply placement streams are untouched. The first delay is drawn when enabling; each opportunity draws count, lanes and the next delay. Simultaneous shells launch in the same tick. Intervals are measured from launches, never impacts. Fixed-step execution rounds a sampled deadline up to the next tick.

Capacity policy: if the complete salvo cannot fit in the existing artillery capacity, skip the entire salvo, consume the opportunity and all normal random draws, and schedule the next interval from that opportunity. An absent ship similarly consumes/skips the opportunity. No partial or invisible shell, safe-lane guarantee, queued catch-up or difficulty adjustment is used. Even a large late step consumes at most one opportunity. The existing eight-shell renderer and effect pools are reused.

Authoritative saved state includes enable/activation/deadline clocks, RNG state, opportunities/launched/capacity-skipped/absent-skipped counts, and only the most recent outcome. This is bounded state, not a growing production telemetry log. Game Over stops the scheduler.

## Snapshot and checkpoint compatibility

Optional validated configuration/state fields provide explicit opt-in. Historical configs without `levelEncounters` retain their old sequential/concurrent ownership and timed retreat; configs without `navalBarrage` never acquire recurring attacks. Historical saved AHEAD profiles, eight-level and ten-level progression plans retain their serialized balance and enemy speed stamps.

Snapshots save full presence, encounter trigger cursors, barrage RNG/deadline and existing artillery shells alongside unchanged wave/Survival clocks. Restore does not infer elapsed events from a new shipping config. Missing state under an opted-in policy, invalid clocks, duplicate lanes, inconsistent counters and invalid ownership are rejected atomically. Existing old-phase/snapshot regression assertions remain covered with explicit historical config data.

Browser checks restored paused DEV barrage fixtures and a natural shipping-policy Lv7 checkpoint with a shell already airborne. Full simulation state was identical before/after recovery. Subsequent identical inputs/ticks produced identical state and artillery events; restore itself emitted no launch cues. Production checkpoint size in that natural scene was 19,883 characters. Early Continue/New Game, explicit Resume audio activation, Wake Lock and FPS behavior were preserved; their production diagnostics remain absent.

## Deterministic combat evaluation

120 runs: seeds **1, 17, 42, 99, 2026**, natural progression and isolated Lv8/Lv9/Lv10, barrage on/off, three policies. Each ran for 180 Survival seconds or until actual Game Over. Natural fixed-lane pilots died before Survival and are censored for Survival metrics.

Policies reuse the existing QA pilot: competent makes adjacent-lane decisions every 200ms; slower every 600ms; both prefer Supply/appropriate Giant/nearest targets and exclude currently warned artillery lanes. Grenades use the existing near-group/HP predicate (six victims within 14 units, or ≥12 HP within 10 units); slower checks at its decision interval. Fixed stays in its lane and never throws Grenades. There is no invulnerability or perfect-hit intervention. Warning avoidance is deliberately simple, not a deadline-aware optimal human dodge model.

The QA-only cohort transform observes admissions and kills, including same-tick kills. Every presentation/grenade/artillery event matched an uninstrumented simulation each tick; full states matched initially, every simulated second and at the end for all 120 runs. Thus observation did not change gameplay, RNG, controls or time. On/off natural runs also matched every introductory launch and pre-handoff loadout timeline.

### Natural competent timeline (absolute simulation seconds)

| Seed | Lv6 / Survival | Lv8 off / on | Lv9 off / on | Lv10 off / on | On: Game Over / Survival duration |
| --- | --- | --- | --- | --- | --- |
| 1 | 94.92 / 121.92 | 131.28 / 132.88 | 156.08 / 165.18 | 167.57 / 175.13 | 218.22 / 96.30s |
| 17 | 94.18 / 121.18 | 130.07 / — | 153.75 / — | 165.27 / — | 125.00 / 3.82s |
| 42 | 95.65 / 122.65 | 132.02 / 136.43 | 156.87 / 162.20 | 168.03 / 174.77 | 204.58 / 81.93s |
| 99 | 94.27 / 121.27 | 124.25 / 124.25 | 145.70 / 157.10 | 159.62 / 169.53 | 172.90 / 51.63s |
| 2026 | 93.43 / 120.43 | 127.35 / 131.18 | 155.05 / — | 164.20 / — | 133.33 / 12.90s |

All five natural competent barrage-off runs completed 180 Survival seconds without casualties. With barrage, all five lost; total casualties were 3/1/3/3/1 respectively. The early Lv7 failure is a real one-soldier artillery death, not a scheduler failure. No mitigation was applied.

### Five-seed aggregate: mean observed Survival seconds; Game Overs / 5

| Entry | Competent off → on | Slower off → on | Fixed off → on |
| --- | --- | --- | --- |
| Natural | 180, 0 → 49.32, 5 | 167.49, 4 → 69.83, 5 | No Survival entry in either mode |
| Lv8 | 180, 0 → 43.59, 5 | 180, 0 → 62.09, 5 | 33.27, 5 → 6.52, 5 |
| Lv9 | 180, 0 → 62.41, 5 | 173.04, 2 → 75.84, 5 | 29.34, 5 → 11.69, 5 |
| Lv10 | 180, 0 → 64.81, 5 | 175.66, 1 → 69.96, 5 | 29.62, 5 → 13.84, 5 |

For isolated Lv10 competent, mean active population increased from 91.68 to 114.43; peak from 170 to 177; mean enemies within 10 units from 0 to 4.43; mean casualties from 0 to 3. The on runs admitted 14.4 ordinary waves on average before failure, with 2.4 blocked admissions; off admitted 46 over the full 180s. Different observation lengths must not be interpreted as lower wave cadence.

Across the on scenarios, 1,728 observed salvos contained 904 single / 824 double salvos (52.3% / 47.7%); 1,673 within-run measured launch intervals averaged 1.506s, range 1.017–2.000s. Peak airborne shells was four. No normal-profile capacity skips occurred. The forced reduced-capacity test verifies the skip policy. Finite life-limited pilot samples are not an unbiased distribution experiment: lane counts were 479/457/496/640/480. Separate 5×5,000-opportunity tests verify uniform count/lane/interval behavior and distinct reproducible seed sequences.

Raw JSON records include shell targets, impacts, overlaps, wave deadlines, blocked admissions, cohort/XP data, Giant and Supply opportunities and final deterministic hashes. Ordinary schedules keep advancing during every naval state; no backlog appeared. The new challenge is intentionally severe and awaits human assessment.

## Mobile-sized production performance

Chrome on Windows, SwiftShader, **4× CPU throttling, DPR1**, separate renderer contexts; accepted geometry/effects/HP bars/render settings unchanged. This is a controlled software-rendering diagnostic, not Pixel 8 GPU evidence. Production visual/recovery checks additionally use DPR2. The rendering pilot decides adjacent moves every 200ms, avoids warned lanes and seeks Supply/Giant/nearest targets; it uses real combat but no Grenades. Different combat outcomes consequently produce different live crowd workloads.

| Viewport / mode | Phase / observed simulation duration | Mean / p95 / max frame ms | >100 / >200ms frames | Peak enemies / projectiles / shells |
| --- | --- | --- | --- | --- |
| 350×844 off | Fresh / 10s | 41.13 / 66.7 / 366.7 | 5 / 2 | 52 / 61 / 0 |
| 350×844 on | Fresh / 10s | 48.41 / 83.3 / 350.0 | 7 / 2 | 65 / 107 / 2 |
| 390×844 off | Fresh / 10s | 40.72 / 50.1 / 266.6 | 6 / 2 | 52 / 61 / 0 |
| 390×844 on | Fresh / 10.02s | 47.03 / 83.3 / 216.7 | 9 / 1 | 65 / 107 / 2 |
| 350×844 off | Warm / 90.02s, clean repeat | 55.77 / 83.4 / 233.4 | 12 / 2 | 116 / 76 / 0 |
| 350×844 on | Warm / 76.35s, Game Over | 80.02 / 116.7 / 316.7 | 240 / 3 | 168 / 107 / 4 |
| 390×844 off | Warm / 90.05s | 57.65 / 83.4 / 250.0 | 14 / 2 | 117 / 76 / 0 |
| 390×844 on | Warm / 76.35s, Game Over | 80.12 / 116.7 / 566.7 | 229 / 4 | 167 / 107 / 4 |

Warm live combat was about 39–44% slower with barrage and greater accumulated crowds; >200ms outliers remain. The first 350-off warm run overlapped unit-test work, so the table uses its clean serial repeat (original mean55.97/p9583.4/max233.4 is retained in raw output). Barrage runs ended at real Game Over; they were not extended with invulnerability to claim 90s survival.

To distinguish the additional naval rendering from divergent combat populations, a supplemental **QA-only frozen identical crowd** benchmark used 168 enemies (75 Heavies), 61 projectiles and three airborne shells versus the same crowd without shells. It warmed 100 frames and measured three five-second windows per separate context:

| Viewport | Off mean (repeat range) | On mean (repeat range) | Draw calls off → on | Triangles off → on |
| --- | --- | --- | --- | --- |
| 350×844 | 115.61ms (115.08–116.27) | 115.49ms (115.09–116.27) | 293–295 → 335–337 | ~506.6k → ~509.0k |
| 390×844 | 117.20ms (116.67–117.86) | 113.72ms (112.13–115.48) | 293–295 → 335–337 | ~506.6k → ~509.0k |

This isolates rendering only, not a gameplay outcome. Differences are within software-renderer variance; it does not prove artillery is free on a physical GPU. No >200ms frame appeared in those 12 warmed windows. Geometry counts stayed 73 off / 81 on and textures nine across all repeats. In sustained live runs, the final 20s plateau was 107 geometries/12 textures off versus 119/12 on (Game Over presentation can add a final bounded resource). Enemy instance tiers grew to bounded capacities, projectile pool128, artillery capacity8, enemy shadow capacity240. No growth per salvo or new downloaded naval assets was observed.

QA counted shader compile/link calls: fresh off39 versus on51; warm on48. These direct-entry fixtures skip the five introductory attacks and can therefore encounter artillery for the first time. The shipping natural sequence already renders those same resources before repeating barrage. Synchronous renderer submission and shader call timing are recorded, but this is not a GPU trace capable of attributing every 200ms outlier. No quality reduction or speculative rendering rewrite was made.

## Validation and browser evidence

- Full final suite: **1,225 tests across 164 files passed**; typecheck and production build passed. The existing >500kB bundle warning remains nonfatal.
- Phase commits were also valid independently: promotion 1,205 tests; architecture 1,211 tests, each with typecheck/build.
- Unit coverage: exact five-shot offsets and +27/+28 handoff, one-time triggers, independent presence/retreat/re-entry, uniform dedicated stream, simultaneous/overlapping shells, three-shell configuration, bounded capacity, large-step skip, malformed/atomic snapshot rejection, deterministic in-flight continuation, historical sequential/concurrent/eight/ten-level plans and existing gameplay regressions.
- 120 observed/unobserved combat pairs passed event/state equivalence. Existing wave/cohort diagnostics remain QA-only source transforms.
- DEV mobile checks: 12 Lv8/9/10 × on/off × 350/390 cases passed. NAVAL BARRAGE is collapsible, controls are 48 CSS px high, selected states and closing after selection work; Pause/reload/Continue restores identical paused state and Retry keeps the selected scenario. Existing groups remain available.
- Shipping mobile smoke passed at 350/390 DPR2; served config matches authored AHEAD, `/topwar/` content-hash URLs are correct, and DEV controls/fixtures/FPS/lifecycle strings are excluded. The final committed implementation was rebuilt and smoke-tested again.
- Natural shipping-policy checkpoint browser test: ship visible after intro completion, existing shell retained, recovery paused, HUD shows saved level, identical 120-tick replay and events; no DEV fixture/UI.
- Production Defense/Legacy save/recovery regression passed at both sizes. Instant recovery selection regression passed. Golden Grenade functional browser checks passed in CRATE3/AHEAD8/AHEAD10 at both sizes. Observer mobile portrait/dialogue checks passed at both sizes with safe-area variations. No authored audio/art was changed.

Ignored local evidence is under `artifacts/p3b6b4/`: `combat/`, `analysis.txt`, `mobile/`, `performance/`, `performance-repeat/`, `matched-render/`, `production-naval/`, `release-production/`, `production-resume/` and final check logs. Representative images: `mobile/350-controls-10-on.png`, `mobile/390-combat-10-on.png`, `production-naval/350-offshore-production.png`, `production-naval/390-offshore-production.png`. No new audio/video recording is claimed; these are screenshots, frame/resource measurements and machine-readable simulation traces. Generated evidence is intentionally not committed.

Reproduce from the repository root after npm setup:

```text
npm test
npm run typecheck
npm run build
node scripts/qa/naval-barrage-metrics.mjs
node scripts/qa/naval-barrage-performance.mjs
node scripts/qa/naval-barrage-matched-render.mjs
node scripts/qa/naval-barrage-production.mjs
node scripts/qa/production-sanity.mjs
# Run the existing Vite server on 127.0.0.1:5175 for DEV mobile review:
node scripts/qa/naval-barrage-browser.mjs
node scripts/qa/naval-barrage-analysis.mjs
```

The scripts use the existing local Playwright/Chrome QA runtime; alternate module location can be supplied with `TOPWAR_PLAYWRIGHT_MODULE`. Performance output is deliberately separate from production telemetry.

## Pixel 8 review risks / stopping point

The prior physical approval covered AHEAD without this continuous barrage. It does not certify the new combined workload or difficulty. Test ordinary natural progression and NAVAL BARRAGE Lv8/9/Lv10 on/off on Pixel 8, especially rapid artillery warnings/Observer readability, launch/impact audio, movement under multiple airborne salvos, deaths, sustained thermal behavior and paused/reloaded recovery. Existing secure-origin/ADB instructions still apply to Wake Lock.

Automated pilots frequently die, sometimes immediately after the handoff; this is reported rather than mitigated. Software rendering has significant dense-crowd cost and isolated long frames; resource counts are bounded, but smooth phone performance must be confirmed physically. No deployment, Tank Boss, enemy recoloring, Air Drop or later content was started. Stop here for human review.
