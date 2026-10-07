# P2C — Threat Ladder

Historical phase evidence: measurements below used capacity 1. Current capacity is 3; the defense hint and standalone base-archetype review fixtures have been removed. See `PRE_RELEASE_REPORT.md` for current behavior and validation.

Starting baseline: `53bed551ae867f356f5709c8a7d82b50de2a09c1`. HEAD, origin/main, live GitHub main and clean worktree were verified before edits. No deployment.

## Authored behavior

| Phase | Total | Fronts | Heavy rule | Hit debt | XP per full group |
| --- | ---: | ---: | --- | ---: | ---: |
| Lv1–3 / early Lv4 | 24 | 3 | Existing .25 chance, at most one | 24 or 38 | 24 or 33 |
| Lv4 at 63/180 XP | 24 | 4 | Exactly 1 | 38 | 33 |
| Early Lv5 | 30 | 3 | Existing .25 chance, at most one | 30 or 44 | 30 or 39 |
| Lv5 at 55/220 XP | 30 | 3 | Exactly 1 | 44 | 39 |
| Lv6 only | 60 | 3 | Exactly 1 | 74 | Cap reached |

One Giant is scheduled on the exact Lv5 crossing tick, due six simulation seconds later. It retains 172 HP / 120 XP / .08 speed, interior-lane placement and all accepted presentation. It persists across Lv6 if alive; its consumed encounter never respawns. Ordinary spawning continues throughout.

Lv6 retains one specialist, 18 Hz, 1 enemy HP per bullet, speed 60, range 80. Its immediate seeded 59-Grunt/one-Heavy crowd enters 38–47 units ahead, alongside survivors. Consuming the next ordinary group row prevents later duplication: the first subsequent normal group is 6–12 seconds later, then six-second cadence resumes. Nine-unit depth, base groupSize 24 and the multiplier table remain unchanged; Lv7 does not inherit the override.

XP costs remain [28,60,110,180,220], rewards Grunt 1 / Heavy 10 / Giant 120. The existing cap discards excess XP at Lv6. Grenade remains capacity 1 / 9 HP / radius 4 / .65s / range 24 / Lv3 +8s supply, with global emergency targeting and shared Q/button input. No new archetype, weapon, damage multiplier, speed, art or audio-startup changes.

## Implementation and persistence

- `public/game-data/game.json` and `src/config/catharsisConfig.ts`: narrow late-phase heavyCount and exact-Lv6 group override; validate count against group population and fronts against lanes. Legacy chance-authored phases remain valid.
- `src/simulation/enemies/latePressure.ts`: XP-derived future settings, exact-Lv6 size and existing one-shot Giant scheduling.
- `src/simulation/enemies/laneComposition.ts`: each Heavy replaces a Grunt; wave-index rotation spreads leaders across fronts before repeating a lane. Existing seeded low-level chance behavior and 2.5-unit front clearance are preserved.
- `src/simulation/enemies/defenseGroup.ts::admitDefenseGroup`: shared seeded placement, authoritative IDs and HP for ordinary/release/fixture groups.
- `src/simulation/Simulation.ts`: schedule Giant after real XP progression; admit release after evolution/combat on the same tick. Serialized `machineGunReleaseAtSeconds`, encounter clock and consumed row preserve continuation and Retry resets. Older established Lv6 snapshots default release to consumed, avoiding retroactive crowds; older lower-level snapshots can evolve normally.
- `src/app/DevReviewFixtures.ts` and `src/ui/DevReviewControls.ts`: DEV CURVE / physical Digit4 starts Lv4, 150/180 XP, two Rifles, center, two comeback groups (46 Grunts + 2 Heavies). Normal stream and unscheduled Giant remain active. EVOLVE uses real evolution/release; isolated EVOLVE/MG consume the natural Giant encounter to suppress contamination. MG remains 60 Grunts + 5 Heavies. Physical 4/5/6 share button reset paths, ignore repeats/modifiers/editable/TUNE focus and pre-start input. Production excludes factory/controls/handlers.

## Deterministic method

Seeds 1–50, normal and 1.8-second Lv3 hesitation pilots. Nearest-threat pilot takes one adjacent lane step every 200ms; Grenade policy is unchanged. P2C additionally runs a proactive Giant policy whenever no enemy is within 10 approach units (200 current runs versus 100 baseline). Follow ten seconds after Lv6. Near-defense means within 10 approach units; hit debt sums actual remaining defense HP per lane, including Giant HP. Phase peaks belong to the resulting level so the release does not inflate Lv5's peak.

Baseline was captured before runtime edits. Refined active-peak/admission counters were rerun using the baseline JSON through preserved chance/no-override paths; timings/cohort summaries reproduce the original capture. Raw per-run lane debt, timelines, admissions and Giant XP records are in ignored `artifacts/p2c/{baseline,current}/{runs,representative,summary}.json`. Reproduce with `scripts/qa/p2c-metrics.mjs`; see QA README. All times below are simulation seconds. N = normal, H = hesitation.

### Natural progression

| Run | Version | Lv2 | Lv3 | Lv4 | Lv5 | Lv6 | Lv4 duration | Lv5 duration |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 N | baseline | 10.33 | 30.23 | 51.78 | 71.67 | 100.50 | 19.88 | 28.83 |
| 1 N | P2C | 10.33 | 30.23 | 51.78 | 71.67 | 94.38 | 19.88 | 22.72 |
| 1 H | baseline | 10.33 | 30.23 | 47.33 | 68.37 | 98.13 | 21.03 | 29.77 |
| 1 H | P2C | 10.33 | 30.23 | 47.33 | 68.08 | 91.00 | 20.75 | 22.92 |
| 17 N | baseline | 12.60 | 27.85 | 50.42 | 70.70 | 98.18 | 20.28 | 27.48 |
| 17 N | P2C | 12.60 | 27.85 | 50.42 | 71.45 | 95.32 | 21.03 | 23.87 |
| 17 H | baseline | 12.60 | 27.85 | 48.83 | 69.68 | 98.98 | 20.85 | 29.30 |
| 17 H | P2C | 12.60 | 27.85 | 48.83 | 71.37 | 94.57 | 22.53 | 23.20 |
| 42 N | baseline | 10.95 | 28.32 | 48.47 | 72.02 | 92.65 | 23.55 | 20.63 |
| 42 N | P2C | 10.95 | 28.32 | 48.47 | 72.02 | 96.97 | 23.55 | 24.95 |
| 42 H | baseline | 10.95 | 28.32 | 48.47 | 72.02 | 92.65 | 23.55 | 20.63 |
| 42 H | P2C | 10.95 | 28.32 | 48.47 | 72.02 | 96.97 | 23.55 | 24.95 |

### Lv4 admissions and whole-level peaks

| Run | Comeback time | Future groups after threshold | Heavies in each | Peak active baseline→P2C | Peak near baseline→P2C | Peak hit debt baseline→P2C | Peak Heavy overlap baseline→P2C |
| --- | ---: | ---: | --- | --- | --- | --- | --- |
| 1 N | 58.42 | 2 | 1, 1 | 165→165 | 14→14 | 168→168 | 1→2 |
| 1 H | 54.58 | 3 | 1, 1, 1 | 154→154 | 11→11 | 154→154 | 1→3 |
| 17 N | 56.87 | 2 | 1, 1 | 156→156 | 4→4 | 172→172 | 2→2 |
| 17 H | 56.00 | 2 | 1, 1 | 162→162 | 17→17 | 176→176 | 1→2 |
| 42 N | 55.67 | 2 | 1, 1 | 149→149 | 0→0 | 191→191 | 4→4 |
| 42 H | 55.67 | 2 | 1, 1 | 149→149 | 0→0 | 191→191 | 4→4 |

Every measured late-Lv4 group is exactly 24 / four fronts / one Heavy. Early window composition is unchanged; existing enemies are never rewritten.

### Lv5 Giant encounter

| Run | Scheduled / due / spawned | Active at spawn | First hit | Death | Spawn→death TTK | First hit→death | Peak Heavies alive | Peak near | XP before→after kill | Remaining to Lv6 | Kill triggers Lv6 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- |
| 1 N | 71.67 / 77.67 / 77.67 | 42 | 79.67 | 94.38 | 16.72 | 14.72 | 4 | 0 | Lv5:118→Lv6:0 (cap) | 0 | true |
| 1 H | 68.08 / 74.08 / 74.08 | 51 | 78.37 | 91.00 | 16.92 | 12.63 | 3 | 0 | Lv5:117→Lv6:0 (cap) | 0 | true |
| 17 N | 71.45 / 77.45 / 77.45 | 44 | 79.32 | 95.32 | 17.87 | 16.00 | 4 | 0 | Lv5:128→Lv6:0 (cap) | 0 | true |
| 17 H | 71.37 / 77.37 / 77.37 | 33 | 81.38 | 94.57 | 17.20 | 13.18 | 4 | 0 | Lv5:119→Lv6:0 (cap) | 0 | true |
| 42 N | 72.02 / 78.02 / 78.02 | 54 | 81.43 | 96.97 | 18.95 | 15.53 | 4 | 0 | Lv5:138→Lv6:0 (cap) | 0 | true |
| 42 H | 72.02 / 78.02 / 78.02 | 54 | 81.43 | 96.97 | 18.95 | 15.53 | 4 | 0 | Lv5:138→Lv6:0 (cap) | 0 | true |

The authoritative Giant reward is 120 XP even where the Lv6 cap prevents displaying the remainder. Ordinary late-Lv5 groups are exactly 30 / three fronts / one Heavy. No natural second Giant exists.

### Lv6 release and mowing

| Run | Alive before→after evolution | Released | +2s active / MG kills | +5s active / MG kills | +10s active / MG kills | Empty during 10s? |
| --- | --- | --- | --- | --- | --- | --- |
| 1 N | 87→146 | 59G + 1H, three fronts | 135 / 11 | 102 / 44 | 106 / 100 | false |
| 1 H | 76→135 | 59G + 1H, three fronts | 111 / 24 | 87 / 48 | 91 / 104 | false |
| 17 N | 86→145 | 59G + 1H, three fronts | 123 / 22 | 92 / 53 | 84 / 121 | false |
| 17 H | 95→154 | 59G + 1H, three fronts | 129 / 25 | 95 / 59 | 90 / 124 | false |
| 42 N | 85→144 | 59G + 1H, three fronts | 128 / 16 | 86 / 58 | 97 / 107 | false |
| 42 H | 85→144 | 59G + 1H, three fronts | 128 / 16 | 86 / 58 | 97 / 107 | false |

Before includes the lethal victim on the evolution tick; after removes that victim and adds 60. All six representative runs have zero contact casualties/failures and zero near-defense enemies after evolution.

### Cohort and mixed evidence

| Successful-run mean | Baseline nearest | P2C nearest | P2C Giant priority |
| --- | ---: | ---: | ---: |
| Reached Lv6 | 97/100 | 97/100 | 97/100 |
| Lv4 duration | 22.27s | 22.71s | 22.71s |
| Lv5 duration | 27.26s | 24.29s | 21.85s |
| Active immediately at Lv6 | 16.19 | 150.72 | 159.48 |
| Active +2 / +5 / +10s | 7.84 / 12.91 / 10.33 | 133.95 / 100.81 / 81.76 | 140.04 / 107.58 / 93.45 |
| MG kills +2 / +5 / +10s | 10.54 / 25.92 / 51.26 | 16.77 / 49.91 / 106.68 | 19.44 / 51.91 / 108.70 |
| Became empty within 10s | 97/97 | 0/97 | 0/97 |
| Giant defeated / triggered Lv6 | 0 / 0 | 97 / 90 | 97 / 2 |
| Giant spawn→death TTK | — | 18.20s | 13.61s |

The same three early failures occur in each cohort: seed29 hesitation and seed35 normal/hesitation, all at Lv3 before these changes. Successful runs have zero contact casualties. Seven nearest-pilot Giant kills leave up to 23 XP still needed; 95 proactive-pilot kills leave up to 46 XP. No cohort Giant survived to Lv6, but automated lifecycle coverage explicitly verifies the alive/pending-across-Lv6 cases.

Late-Lv4 Heavy overlap increased (whole-Lv4 mean peak 2.44→3.07), but active/near/debt whole-level peaks were identical across these pilots because the earlier backlog dominates. This does not prove late Lv4 now feels hard enough.

Lv5 mean peak hit debt increased 90.02→247.16; mean peak active 73.76→94.15. However, nearest pilots saw **zero near-defense pressure during the Giant encounter** in every successful run; proactive pilots peaked at four near enemies. The priority/HP task is real, but urgent human difficulty remains unproven. No pilot-driven power/speed/XP retuning was performed.

The empty-beach issue is resolved in the measured horizon. The new 150–159-enemy average at evolution is a large visual backlog, so human play must judge whether it remains a satisfying release. At 74 HP debt per six-second group, sustained incoming debt is 12.33 HP/s against MG's 18 Hz before lane/travel costs; no suppression/AoE was added.

### Controlled unchanged weapon comparison

| Metric | Lv5 three Rifles | Lv6 one MG |
| --- | ---: | ---: |
| Observed projectile cadence | 13.5 Hz | 18 Hz |
| Clear 30 same-lane Grunts | 2.317s | 1.783s |
| Full-health Heavy, including travel | 1.217s | .967s |
| Heavy, first hit→death | 1.017s | .767s |

Same ordinary collision and one enemy-HP damage; cadence improves 33.3%.

## Validation and review

- Full automated suite: **777 tests / 125 files passed**. Typecheck and production build passed. Existing Rollup annotation/large-bundle warnings remain.
- New tests cover explicit composition/debt, lane rotation/clearance, legacy schemas, exact threshold behavior, same-tick release, consumed row and future six-second cadence, pending/post-release snapshots, old Lv6 migration, natural Giant schedule/lifecycle, and an in-flight 30-kill Grenade XP overflow producing one coherent evolution/release.
- Browser scripts passed: threat-ladder, evolution-fixture, machine-gun, p2b-pressure, audio-start and production sanity. 390×844 / 350×844 inspected: CURVE reset, early three-Rifle window, natural Giant reveal, real evolution/HUD, immediate crowd and MG aftermath. Physical 4/5/6, focus/repeat guards, Pause/Retry and pre-start blocking pass. Production raw JS excludes CURVE/Digit4 and all earlier Lab markers; normal/review startups have no Lab controls.
- Accepted emergency Grenade regression: near cluster cleared despite empty selected lane / distant crowd; three Grunts / three ordinary XP, Heavy 6 HP, far 30 Grunts untouched; repeated resources stable. Existing damage/Giant/XP and startup tests remain passing.
- EVOLVE reaches Lv6 at **1.00s** via ten ordinary Grunt kills; 3/2/1 living Rifle casualty-state variants each become one specialist without damage/fatal cues. All fixtures reset deterministically.
- Six repeated release cycles after warming Giant presentation: **102 geometries / 12 textures / 32 projectile slots**, stable. EVOLVE/MG-only cycles hold 85 geometries / 11 textures / 32 slots; the isolated MG script warms 86 / 11 / 32. Different fixtures warm different retained visual pools. No monotonic allocation growth.
- Native Web Audio remained running; isolated MG emitted 41 bounded automatic cues over six measured seconds, at most four SFX sources. No Rifle or audio activation change.
- Software Chrome/SwiftShader: isolated same-crowd Lv5 **44.17ms average / 50.10ms p95**, Lv6 **42.78 / 50.10ms**. Natural dense release profile (101–153 active) measured **82.21ms average / 100ms p95**, simulation **.259ms**, renderer CPU **1.255ms**, audio **.096ms**, at most five SFX sources. This is an obvious dense-scene software frame-time cost, not a leak or proof of phone performance. Physical-phone profiling remains required.
- A repeat with the diagnostic overlay hidden measured **73.84ms average / 116.70ms p95**, simulation **.294ms** and renderer CPU **1.137ms**. The variation reinforces the limit of software timing; the dense-state cost remains clear.

Captures and raw browser/resource/frame results: `artifacts/p2c/{browser,clean-review,evolve,mg,grenade,audio,production}`. `clean-review` contains unobstructed Giant and MG portrait captures. These ignored local artifacts are reproducible with the committed QA scripts. No deployment was performed.

## Human-play questions

1. Does one Heavy per late-Lv4 group create enough visible attention pressure after the early backlog clears?
2. Does the six-second Giant arrive after a satisfying three-Rifle window and force meaningful lane choices, despite low near-line pressure in pilots?
3. Are the shorter Lv5 duration and large 120-XP reward satisfying? Pacing changes need a separate decision.
4. Does the 60-person release plus survivors feel like mowing rather than a new pressure peak, and is the dense natural scene acceptable on physical phones?
