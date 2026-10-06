# P1.5 — Initial radius-two pressure measurements

Historical evidence for commit `3e2b640a78a65b064cf6643ec6dffe0602ef1048`. Human playtesting subsequently superseded the radius and 8–12-kill target. Current authored radius is four; see `P15_GRENADE_REVIEW.md` and `GAME_SPEC.md` for current behavior. The results below describe the original radius-two implementation.

Baseline: `157faccc5857aa480fd97445414b8909617be319`. Local HEAD, origin/main and live GitHub main matched; tracked worktree was clean before implementation. No deployment.

## Implemented behavior

Authored in `public/game-data/game.json → catharsis.grenade`, validated by `src/config/grenadeConfig.ts`:

| Value | Implemented |
| --- | --- |
| First supply | 8 simulation seconds after entering Lv3; once per run |
| Supply acquisition | Exactly one Rifle hit |
| Inventory capacity | 1; independent of squad/rocket count |
| Damage | 9 defense-enemy HP, no falloff |
| Blast radius | 2 world units, circular X/Z distance, inclusive boundary |
| Flight | 0.65 simulation seconds; captured destination |
| Throw range | 24 forward world units |
| Normal supply depth | 14 units ahead; prefer lanes allowing at least 6 |
| Front clearance | 1.25 units ahead of the nearest same-lane enemy |
| Lane distance penalty | 3 HP of placement score per lane from the selected lane |

Placement scores remaining HP within throw range plus lane distance. It first considers lanes with a readable clear depth; if all are obstructed, it chooses the most open lane and brings the supply closer. The supply remains at its captured player-relative depth until shot, so a slow player does not lose the only teaching item to scrolling. Extreme already-surrounded cases can have insufficient clearance; no enemies are moved or despawned to manufacture a safe lane.

The button appears on acquisition, shows one charge and pulses twice. It is safe-area anchored and isolated from lane taps. Start/Pause/death/empty inventory/no eligible target disable activation. The app queues a one-shot input for the next fixed simulation tick; only a valid captured throw consumes inventory. Held charges survive Lv4/Lv5. Retry clears the encounter and HUD. No recurring supplies, grenade weapon progression, modal tutorial or generic active-item framework.

Eligible same-lane enemies ahead and within range are candidate anchors. The selected anchor maximizes all defense enemies inside the circle, including adjacent lanes. Ties use nearest Z then enemy ID. Detonation visits living victims in ID order. Rifle, retained rocket and Grenade now share `Simulation.step`'s `damageEnemy → awardKill → grantXp` lethal boundary; no separate Grenade XP calculation. Nominal per-victim kill rewards in the transient event come from that same boundary; normal overflow/cap semantics remain in `grantXp`.

Grunt dies; full-health Heavy remains at **6/15**; Giant remains at **163/172** (5.23% damage). Legacy Boss is excluded. Flight parameters, inventory, supply and lifecycle clocks are plain validated snapshot data. Restore clears transient events, not held/airborne gameplay state.

`GrenadeRenderer` owns one supply, one analytic arc, one flash/ring and 16 dust instances. Enemy hit/death presentation remains unchanged. Detonation reuses the gated ground-artillery sound with a shorter/lighter variation; audio activation architecture is unchanged.

## Scope preservation

No requested existing balance value changed: XP `[28,60,110,180]`; Rifle multipliers `[1,1.25,1.5]`; Lv4/Lv5 grants; 24 enemies / three fronts / existing cadence; Heavy chance .25, HP15; Grunt HP1; speeds .25/.12 plus .6 approach; projectile speed60; Giant HP172 and other Giant/late-game settings. Character/death/coastal-water/audio-startup source remains untouched. The proposed two-lane P1.5b wave is not implemented.

## Deterministic policy and reproduction

Run `node scripts/qa/p15-metrics.mjs`. It executes seeds **1–50**, both normal and hesitation pilots, with use/no-use controls: **200 runs**. Full metrics: `artifacts/p15/metrics.json`; seed-1/17/42 one-second timelines: `artifacts/p15/timelines.json`. These generated files are ignored; the scripts and this report are durable.

Simulation runs at 60 Hz. Every 200 ms the pilot selects the nearest ahead threat lane using ordinary `stepLane` calls, matching the prior P1 diagnostic convention. It may issue multiple lane taps at a decision; movement still interpolates normally. Supply acquisition temporarily takes lane priority. The hesitation pilot holds its existing lane for **1.8 seconds starting Lv3 +3 seconds**; auto-fire continues. It then resumes the same policy.

Grenade use policy: at least six targets and an anchor within ten units; emergency use with at least three targets within six when the nearest threat is under four; after holding eight seconds, accept at least six targets within fourteen. Controls acquire the supply but never throw, isolating use from diversion/acquisition cost. None of these pilot decisions changes shipped targeting or balance.

Near-defense means enemy Z within ten units ahead of the player (including unremoved leaks). Rifle-hit debt is sum of remaining defense HP, separately for each lane. Approximate TTC is remaining forward distance minus .52 contact radii divided by .6 plus archetype speed; it ignores lateral travel and is diagnostic, not an exact collision prediction. Values below are simulation seconds, rounded to two decimals. Runs stop at Lv5 or failure, with up to two seconds of post-blast observation when needed.

## Required seeds: normal versus hesitation

All six Grenade runs reach Lv5 with **zero contact casualties**. N = normal; H = hesitation.

| Seed/pilot | Lv2 | Lv3 | Lv4 | Lv5 | Lv3 duration | No-throw Lv4 / Lv5 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 N | 9.33 | 26.63 | 51.90 | 72.75 | 25.27 | 53.87 / 74.50 |
| 1 H | 9.33 | 26.63 | 51.90 | 72.75 | 25.27 | 53.87 / 74.50 |
| 17 N | 12.93 | 30.23 | 52.07 | 73.77 | 21.83 | 53.58 / 75.08 |
| 17 H | 12.93 | 30.23 | 52.27 | 73.77 | 22.03 | 53.58 / 75.08 |
| 42 N | 10.97 | 26.95 | 50.10 | 72.10 | 23.15 | 52.90 / 74.95 |
| 42 H | 10.97 | 26.95 | 50.72 | 72.75 | 23.77 | 52.90 / 74.95 |

| Seed/pilot | Supply spawn | Acquisition | Activation | Detonation | XP at spawn (Lv3) | XP before → after blast tick | Grenade kills / XP |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 N | 34.63 | 35.13 | 41.97 | 42.62 | 26 | 64 → 73 | 9 / 9 |
| 1 H | 34.63 | 35.13 | 40.60 | 41.25 | 32 | 57 → 67 | 9 / 9 |
| 17 N | 38.23 | 38.23 | 38.23 | 38.88 | 41 | 43 → 50 | 7 / 7 |
| 17 H | 38.23 | 38.45 | 38.60 | 39.25 | 41 | 45 → 51 | 6 / 6 |
| 42 N | 34.95 | 35.25 | 36.40 | 37.05 | 24 | 38 → 51 | 13 / 13 |
| 42 H | 34.95 | 35.25 | 38.80 | 39.45 | 29 | 49 → 59 | 10 / 10 |

Seed 1 H also earns one Rifle XP on the detonation tick; the event records only the nine Grenade kills. In seed 17 N an existing Rifle shot acquires the supply on its spawn tick. The ready button/pop is visible, but the crate itself may not be seen: phone testing should judge this discovery case.

All Grenade victims in these six runs are Grunts. Total Grunt/Heavy kills through Lv5 are **338/4** for seeds 1 and 17, **328/5** for seed42. Peak simultaneous Heavy counts are **3, 3, 4** respectively. No Giant naturally spawns.

## Pressure before, immediately after, and two seconds after detonation

| Seed/pilot | Active count before → after → +2s | Near-defense count | Nearest distance before → after → +2s | Approx. TTC before → after → +2s |
| --- | --- | --- | --- | --- |
| 1 N | 154 → 145 → 160 | 9 → 3 → 0 | 9.21 → 9.46 → 10.14 | 10.22 → 10.52 → 11.32 |
| 1 H | 161 → 151 → 142 | 6 → 2 → 1 | 8.57 → 8.73 → 9.75 | 9.47 → 9.66 → 10.85 |
| 17 N | 175 → 168 → 159 | 11 → 6 → 4 | 8.35 → 8.34 → 8.77 | 9.21 → 9.20 → 9.71 |
| 17 H | 173 → 167 → 158 | 10 → 7 → 8 | 8.23 → 8.60 → 8.97 | 9.07 → 9.50 → 9.94 |
| 42 N | 156 → 143 → 158 | 7 → 0 → 0 | 8.84 → 10.07 → 10.34 | 9.79 → 11.24 → 11.56 |
| 42 H | 169 → 159 → 150 | 10 → 5 → 1 | 8.41 → 8.85 → 9.88 | 9.28 → 9.80 → 11.01 |

Remaining Rifle-hit debt, lanes **0,1,2,3,4**:

| Seed/pilot | Before | After | +2s |
| --- | --- | --- | --- |
| 1 N | 27,28,62,36,27 | 24,22,62,36,27 | 23,30,69,44,20 |
| 1 H | 29,31,62,36,29 | 24,26,62,36,29 | 24,23,62,36,23 |
| 17 N | 34,24,62,9,74 | 27,24,62,9,74 | 26,24,62,5,70 |
| 17 H | 33,24,62,9,73 | 27,24,62,9,73 | 26,24,62,5,69 |
| 42 N | 24,28,0,54,78 | 24,28,0,46,73 | 24,29,0,52,95 |
| 42 H | 24,35,0,56,96 | 23,26,0,56,96 | 23,25,0,51,93 |

Active count can rise from another scheduled wave while near-defense pressure falls; it is not the sole success measure. Seed17 H retains appreciable pressure after the blast. During its hesitation, near-defense count rises **1→8** and approximate TTC falls **10.79→9.39s**. Seeds1/42 are still farther from the line during the prescribed lapse: nearest distance falls **13.28→12.16** / **12.01→10.58**, while near count remains zero. This modest mistake does not force every seed into an identical crisis.

## Broader results and mixed evidence

| 50-seed cohort | Reached Lv5 | Failed | Used charge | Median kills when used | Kill range | Immediate near-count reduction |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Normal, no throw | 49 | 1 (seed35) | 0 | — | — | — |
| Normal, Grenade | 50 | 0 | 44 | 10 | 4–21 | 24/44 |
| Hesitation, no throw | 49 | 1 (seed35) | 0 | — | — | — |
| Hesitation, Grenade | 50 | 0 | 44 | 10 | 4–20 | 24/44 |

No casualties occur in either Grenade cohort. Mean kill counts per used blast are **10.36 / 10.43**. **26/44 normal** and **30/44 hesitation** blasts fall within 6–12 kills; **20/44 / 21/44** fall within 8–12. Mean nominal Grenade XP per run (including unused charges) is **9.48 / 9.72**. Each cohort damages seven Heavies; two/three already-wounded Heavies die. Full-health Heavy survival is separately tested.

The same six seeds (11,21,24,28,34,49) reach Lv5 without the policy spending their charge. The tool is available but not mandatory. Lv3 is the highest-or-tied near-defense-count peak in **49/50** Grenade runs for each pilot; mean Lv3 durations are **23.77 / 23.86s**. This supports retained tension but is not a human difficulty ranking.

Seed35 illustrates recovery under substantial pressure. No-throw runs die at **48.45 / 48.67s**, both Lv3. Grenade runs kill 16 Grunts and damage a Heavy, reaching Lv4 at **51.37 / 51.35s**, then Lv5 at **73.50s**. Normal near count falls **39→23→25**; hesitation **41→26→34**. Hesitation TTC later falls to **1.64s** despite surviving: the blast buys room, not invulnerability. Its blast reduces lane-2 debt **41→17**, including nine Heavy HP.

An initial, stricter pilot issued only one adjacent lane step per 200ms and allowed a dense distant target when any threat was near. Seeds1/17 died with and without Grenade; seed42 survived. Grenade kills were 9/17 (seed1 N/H), 8/7 (17), and 11/11 (42). Several blasts gave no immediate near-line relief. This exploratory output is retained locally in `artifacts/p15/initial-adjacent-pilot.json`. We corrected the diagnostic to match the established P1 lane-selection convention and documented a near-pressure use policy; **no shipping balance was changed in response**. It remains evidence that slower lane handling can overwhelm this one-use tool.

Decision: retain requested **8 seconds / 9 HP / radius2 / .65 seconds** for human playtesting. These measurements do not justify changing global spawning, XP or Heavy frequency. They also do not prove that every brief human mistake is recoverable. Max-count targeting sometimes selects a deeper cluster, some blasts exceed twelve kills, and immediate near-pressure reduction is not universal. Evaluate those explicitly before considering timing/radius changes or the unimplemented P1.5b concentration wave. Lv4 still doubles sustained fire from 4.5 to 9 shots/sec; Grenade is a single burst and does not replace that upgrade.

## Verification

- Full Vitest: **701 tests across 121 files pass**. Typecheck and production build pass. Tests cover 8-second scheduling without XP, placement/one-hit acquisition, target/tie rules, invalid actions, exact 39-tick flight, circular boundary/no falloff, Heavy/Giant damage, overflow/squad rewards, concurrent Rifle/blast duplicate prevention, and pending/spawned/held/in-flight snapshot continuation.
- 350×844 and 390×844 Chrome mobile emulation / DPR2: ready button, analytic flight and burst screenshots inspected; safe-area offsets and >=44px target checked; button does not change lane; Pause freezes clocks; empty lane keeps inventory; ten-victim burst grants ten XP; Retry clears charge/supply/effects. Render-only objects are reused.
- Existing `audio-start-sanity`, `live-sanity`, `vfx-lab-sanity`, and `production-sanity` pass. Production excludes Lab controls. A first concurrent production run exposed a pre-existing review-HUD wait race (frozen Lv5 before its initial presentation); the QA script now waits for stable post-start HUD. No startup runtime change was made.
- Five repeated burst cycles retain **85 geometries / 12 textures**, with 16 fixed dust slots. The isolated 200-enemy software-renderer comparison warms the scene, then samples four seconds per case. No-blast: **124.25ms mean / 133.40ms p95** frame, **2.01ms mean / 2.60ms p95** app CPU. Blast: **118.63ms mean / 150ms p95** frame, **1.92ms mean / 2.50ms p95** app CPU. Blast ends with 190 enemies. No resource growth or CPU spike was detected; p95 frame time is worse and SwiftShader is slow in both cases. These short samples cannot certify phone GPU performance. Earlier un-warmed samples had allocation/backlog stalls and were not used as comparative timing evidence.
- Existing Zod annotation and >500kB bundle warnings remain. No dependency, character/death, coastal-water or audio-startup changes. Physical-phone feel/performance remains an open check, not a completed claim.

## Files and ownership

- `src/config/grenadeConfig.ts`, `catharsisConfig.ts`, `public/game-data/game.json`: authored validated item values.
- `src/simulation/grenade.ts`, `Simulation.ts`, `SimulationState.ts`: lifecycle, target/placement, shared damage/XP, snapshot state and transient events.
- `src/ui/GrenadeButton.ts`, `src/style.css`, `src/app/GameApp.ts`: mobile action, fixed-tick input and existing gated audio cues.
- `src/app/projectRenderState.ts`, `src/rendering/RenderState.ts`, `GameRenderer.ts`, `GrenadeRenderer.ts`: plain-data projection and bounded presentation.
- `tests/Grenade.test.ts`, `GrenadePresentation.test.ts`, `P15Pilot.test.ts`; existing app/collision adapters updated for the added contracts.
- `scripts/qa/p15Pilot.ts`, `p15-metrics.mjs`, `p15-browser.mjs`, production wait correction, QA README and current gameplay/architecture/roadmap documentation.
