# P3-B.6B.0 — Survival difficulty diagnosis

Baseline: `dc8131e0451fb2c752246614b3e610539963f032`. Frozen `playtest-2026-10-08`: `59136b49e1328ab754412f7affe90c755c76c0fd`.

**Current Survival is easy for both moving pilots and fatal when lanes are ignored. Spawn population substantially overstates the danger of a wave.** All 50 moving-policy runs completed 180 seconds of Survival without casualties; no enemy reached 20 units during their Survival window. All 25 fixed-lane runs lost; five died before reaching Survival. Natural waves spawned at Lv8 often encounter three times their original firepower by their theoretical 10-unit arrival. This report proposes a first experiment; **no balance or production code was changed**.

## Existing system

| Level | Living full squad | Total MG Hz | Ordinary Survival group | Initial HP / successful MG hits | Nominal kill XP |
| --- | --- | --- | --- | --- | --- |
| 6 | 1 | 18 | 26 Grunts + 4 Heavies; three pressure lanes | 86 | 66 |
| 7 | 1 | 22.5 | Same | 86 | 66 |
| 8 | 1 | 27 | 36 Grunts + 6 Heavies; four pressure lanes | 126 | 96 |
| 9 | 2 | 54 | Same | 126 | 96 |
| 10 | 3 | 81 | Same | 126 | 96 |

MG damage is one enemy HP per successful hit, speed 60, range 80. Casualties reduce the **actual** rate; profiles follow progression level, not living members. XP costs remain 28/60/110/180/220/200/300/350/450, total 1,898 usable XP from Lv1 to Lv10.

Ordinary opportunities are six seconds apart, with full-group admission only if it fits the 180-enemy soft cap. Blocked slots and stream rows are consumed. Natural Survival starts when the concurrent Destroyer completes at MG release +27s; its first wave is +1s. Carnival ends at +24s. Existing enemies remain. No ordinary admissions occur during the authored encounters.

Runtime enemy approach speeds in this baseline are **Grunt 0.85, Heavy 0.72, Giant 0.68 units/s**. The authored data already has `defenseMotionVersion: 2`; adding the historical forward-speed contribution again would produce an incorrect forecast. Ordinary formation depth is approximately 38–47 units, with deterministic jitter/placement. The analysis uses each admitted enemy's actual Z and actual movement helper, not this approximate envelope. Player Z stays zero. All spawn positions are within MG range.

Giant opportunities recur every 24s, maximum one living Giant, HP172/XP120; occupied or cap-blocked slots are skipped. Supply opportunities recur every 30s, +1 Grenade, skip full inventory/existing crate. Neither has catch-up spawning.

## Method and read-only verification

75 runs: five seeds **1, 17, 42, 99, 2026**, three policies, natural plus isolated Lv7/Lv8/Lv9/Lv10. Every alive run continues 180s after activation. Ordinary Game Over ends observation immediately. A natural prelude has a 600s safety bound; none reached that bound.

- **Competent:** existing `survivalDecision`, one adjacent-lane decision every 12 fixed ticks / 200ms. Exclude active shell target lanes among current/adjacent choices. Prefer a Supply lane; otherwise nearest enemy, with distant Giant preference when the nearest enemy is beyond10. No perfect teleport/dodge or invulnerability. Evaluate the existing Grenade predicate each tick: available inventory/no flight, nearest emergency blast with at least six victims within14, or at least12 HP within10.
- **Slower:** same decisions every36 ticks / 600ms; Grenade predicate only at those decisions.
- **Negligent (`fixed` in JSON):** initial center lane, no movement or Grenades. Actual targeting, firing, damage and contacts apply.

These pilots have global enemy/shell awareness, consistent decisions and no distraction. They are not representative samples of human reaction errors. Slower timing alone does not model a novice's poor target selection.

Isolated runs reuse the existing test-only `survivalSimulation`: correct authored level, zero XP, full living squad, three Grenades, consumed teaching/naval encounters, one seeded ordinary group at t=0 and next opportunity at t=6. XP growth stays active. They are **fresh-start comparisons, not artificially frozen-level combat**. The first Lv8–10 cohort has identical seed/placement and is eliminated before that run's first upgrade, providing a comparison of starting weapon power; Lv7 uses its genuine smaller three-lane profile. The temporary human MG TEST fixtures are not used because those intentionally disable recurring Survival.

The private QA Vite SSR transform adds observation calls only to its in-memory copies of Simulation, `admitDefenseGroup` and Giant admission. Original files are unchanged. Admission hooks record every allocated ID and row/cursor before collision, including spawn-tick kills. Damage/removal hooks distinguish projectile, rocket, Grenade, contact and leak. XP is read from actual `awardKill` grants, including partial cap overflow; contacts/leaks receive zero XP. It does not infer kills by diffing final arrays.

Each run has a separate **uninstrumented** Simulation receiving the identical lane commands and input objects. Exact transient presentation/Grenade/artillery events match on **681,185 executed ticks**. Full serialized state matches at **11,521 checkpoints**, including entry, each second and final state, covering RNG, IDs/cursors, positions, HP, progression, phase clocks, cooldowns and snapshots. State/input SHA-256 digests are saved per run. The final matrix was regenerated after correcting only the executed-tick counter. Source-anchor drift fails loudly.

Distances mean longitudinal `enemy.z - player.z`. Unique crossings at30/20/10 are sampled live before combat each fixed tick, within1/60s of a boundary; recorded HP is HP on that crossing. Post-step population/HP averages use every Survival tick. “Target available” means an enemy ahead within current primary range, reported both globally and on the selected lane; it does not imply every fired shot hits. Long-range clear means every member killed by the player and no member reaching20. Pending cohorts at the end are excluded from the completed/opportunity-mature clear denominator. Projected arrivals beyond observation/Game Over are **censored**, even if the cohort was killed earlier.

## Natural level timeline

Seconds since Tap-to-Start simulation origin; Lv1=t0. Values rounded to0.01s, full precision in JSON. All moving runs finish with three MGs and zero casualties.

| Policy / seed | Lv2 | Lv3 | Lv4 | Lv5 | Lv6 | Lv7 | Survival | Lv8 | Lv9 | Lv10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| competent1 | 10.32 | 30.23 | 47.42 | 83.12 | 94.92 | 110.92 | 121.92 | 131.28 | 155.73 | 173.97 |
| competent17 | 12.60 | 27.85 | 44.98 | 83.50 | 94.18 | 108.72 | 121.18 | 130.07 | 153.50 | 172.32 |
| competent42 | 10.95 | 28.32 | 46.35 | 83.77 | 95.65 | 110.87 | 122.65 | 132.02 | 156.22 | 174.75 |
| competent99 | 10.95 | 26.92 | 45.03 | 82.55 | 94.27 | 107.07 | 121.27 | 124.25 | 153.70 | 166.47 |
| competent2026 | 10.33 | 27.88 | 49.07 | 81.63 | 93.43 | 107.62 | 120.43 | 127.35 | 152.78 | 172.37 |
| slower1 | 10.98 | 29.53 | 44.72 | 79.13 | 93.43 | 113.05 | 120.43 | 136.52 | 158.80 | 174.23 |
| slower17 | 10.17 | 27.25 | 46.50 | 80.22 | 96.63 | 109.33 | 123.63 | 128.42 | 157.13 | 170.07 |
| slower42 | 10.97 | 31.22 | 45.33 | 80.83 | 95.18 | 111.37 | 122.18 | 138.05 | 162.07 | 175.40 |
| slower99 | 10.93 | 26.87 | 45.68 | 86.28 | 96.52 | 112.55 | 123.52 | 132.73 | 157.08 | 175.37 |
| slower2026 | 11.97 | 32.65 | 48.60 | 84.58 | 95.53 | 109.32 | 122.53 | 134.97 | 155.87 | 175.35 |

Competent Lv7→8 takes17.18–21.35s, Lv8→9 23.43–29.45s, Lv9→10 12.77–19.58s. Slower:19.08–26.68 /20.90–28.72 /12.93–19.48s. The biggest firepower step, Lv8→9, doubles27→54Hz; Lv9→10 adds another50%. The first natural Giant spawns at Lv4, survives32.57–38.52s for competent /34.42–42.15s for slower, and dies through ordinary combat. It is not artificially retained until MG evolution.

Natural negligent seeds1/17/42/99/2026 die at26.72/27.20/28.55/28.13/26.77s, at levels2/2/1/2/2. **They never activate Survival.** Their absence of Survival metrics is missing exposure, not evidence of an easy late game.

## Actual density, workload and defense danger

Each range is the min–max across five seeds. Population/HP/kill measures cover Survival only, except the explicitly pre-Survival negligent row. “Clear” is each run's median completed-wave lifetime, not a fixed-level service time.

| Start / pilot | Mean live | Peak live | Mean live HP debt | Kills/s | Median wave clear(s) | Longest global no-target(s) | Peak within10 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| natural competent | 20.7–21.2 | 87–99 | 63.9–66.1 | 6.93–7.09 | 3.57–4.10 | 3.12–3.52 | 0 |
| natural slower | 21.9–25.8 | 91–115 | 77.8–84.2 | 6.92–7.08 | 4.35–5.60 | 2.90–3.65 | 0 |
| Lv7 competent | 20.0–22.6 | 78–90 | 60.3–66.3 | 6.67–6.68 | 4.13–4.83 | 3.03–3.40 | 0 |
| Lv7 slower | 20.4–29.1 | 79–135 | 66.5–91.4 | 6.67–6.68 | 4.28–5.77 | 3.18–3.62 | 0 |
| Lv8 competent | 17.4–18.2 | 51–63 | 53.1–54.9 | 7.07–7.09 | 3.23–3.60 | 3.17–3.42 | 0 |
| Lv8 slower | 16.9–19.3 | 53–70 | 58.0–64.0 | 7.07–7.09 | 3.58–4.60 | 3.60–3.63 | 0 |
| Lv9 competent | 15.2–15.5 | 42–60 | 49.4–51.1 | 7.07–7.09 | 3.23–3.43 | 3.17–3.42 | 0 |
| Lv9 slower | 14.2–16.3 | 43–63 | 53.7–58.4 | 7.07–7.09 | 3.58–4.02 | 3.17–3.63 | 0 |
| Lv10 competent | 14.5–14.9 | 42–49 | 47.4–48.7 | 7.07–7.08 | 3.22–3.43 | 3.18–3.55 | 0 |
| Lv10 slower | 13.8–15.3 | 42–63 | 52.8–56.1 | 7.07–7.08 | 3.58–4.00 | 3.18–3.63 | 0 |

All moving runs clear **100% of observed mature ordinary cohorts beyond20**; ordinary crossing fractions at20/10 are both0%. This is not zero visual pressure: slower isolated Lv7 peaks at135 enemies,31 within30, but none within20. Early Survival waves can linger while the pilot targets a Giant, then be cleared by newly stronger MGs. Across moving scenarios, the closest member of a wave admitted at Lv7 comes to21.72; Lv8 to22.90. Maximum completed lifetime27.02/24.30s respectively. A crowded frame is not equivalent to a defense-line threat.

Natural windows have30 admitted ordinary waves, exact six-second cadence, first delay1.000s, no blocked opportunity. They spawn6.84–6.97 enemies/s including recurring Giants; kills6.92–7.09/s also include enemies retained from Carnival. Hence kills can exceed new admissions. Isolated runs have the initial cohort plus30 scheduled admissions, including a new still-pending group exactly at the180s cutoff. Their spawned rate includes that boundary group:6.87/s startingLv7 or7.27/s startingLv8–10. Completed kills are6.67–6.68 or7.07–7.09/s. This endpoint difference is not a backlog.

Natural competent global target availability73.9–75.8%, selected-lane66.6–68.0%; slower77.2–84.8% /65.1–67.4%. Isolated Lv10 competent61.2–64.9% /55.4–57.0%. Much firing occurs with no enemy in the chosen lane, and a global quiet interval of roughly3–3.6s persists even after all levels are earned. Potential hits/second and emitted shots/second are therefore different quantities; both actual emission counts and kill rates are in raw metrics.

Natural mean HP debt per lane ranges6.27–25.13 for competent and7.46–32.20 for slower; lane peaks39–208 /45–211 include GiantHP. HP debt is distributed unevenly despite zero near20 pressure. Raw every-second samples retain five-lane HP debt; per-run means/peaks and near10 lane peaks use all ticks.

| Isolated negligent start | Death age(s) | Peak live | Peak within20 /10 | Ordinary enemies crossing10 | Casualties | Blocked ordinary slots |
| --- | --- | --- | --- | --- | --- | --- |
| Lv7 | 49.48–50.10 | 161–180 | 87–127 /43–66 | 17.9–36.7% | 1 | 1–3 |
| Lv8 | 49.48–49.58 | 153–167 | 132–145 /64–91 | 30.5–54.2% | 1 | 4–5 |
| Lv9 | 49.62–50.43 | 151–165 | 133–145 /64–92 | 30.5–55.4% | 2 | 4–5 |
| Lv10 | 49.62–50.62 | 151–162 | 133–145 /64–92 | 31.0–55.4% | 3 | 4–5 |

Every negligent isolated run loses by normal enemy contact/leak. No full ordinary cohort is combat-cleared; survivors retained at Game Over are not labeled dead. Lv10 mean live118.2–122.4, mean HP350.8–458.2; selected-lane target availability only4.1–13.1%, although global availability100%. Longest selected-lane gap21.57–25.28s shows why high total fire rate cannot defend neglected lanes. Spawn rate falls to3.41–4.25/s because cap-blocked opportunities are skipped. Kill rate only0.46–1.13/s. The soft cap works, but reaching it is already a substantial rendering load.

The competent first isolated cohort clears at Lv7 in5.32–5.98s (smaller profile), Lv8 in7.65–11.03s, Lv9 in4.15–4.93s, Lv10 in3.40–4.20s. The latter three share the same42-member workload/placement and have no intervening upgrade. This separates the starting firepower effect from later XP feedback. Subsequent cohorts overlap and gain progression; their service times must not be treated as frozen-level tests.

## Cohorts and XP feedback

Every raw cohort includes exact ID list, kind/row/cursor, spawn level/XP/stage/living squad/Hz, individual lanes/positions/HP/speed, required MG hits, actual successful hits/damage by source, deaths/removals and rewards, first crossing HP, closest approach, clear time, loadout changes during life and each member's projected20/10 arrival/loadout. Null future observations remain censored.

**7,956 enemies die on their admission tick** across the complete75-run matrix. Among moving ordinary Survival cohorts,7,622 of63,732 admitted enemies do so; for cohorts spawned at Lv10,6,949/50,862 =13.66%. Persistent in-flight real bullets can intercept newly admitted enemies immediately. Final-array differences would undercount these admissions and kills, precisely the flaw the task called out.

Example natural seed1, competent; fractional clearance includes kills on the upgrade tick:

| Wave spawn(s) | Spawn level /XP | Workload | Nominal /usable XP | Next upgrade | Cleared before upgrade | Remaining after upgrade |
| --- | --- | --- | --- | --- | --- | --- |
| 122.92 | 7 /196 | 86 hits | 66 /66 | 8 | 100% | 0 |
| 128.92 | 7 /269 | 86 | 66 /66 | 8 | 23.3% | 23 |
| 140.92 | 8 /127 | 126 | 96 /96 | 9 | 83.3% | 7 |
| 146.92 | 8 /216 | 126 | 96 /96 | 9 | 2.4% | 41 |
| 152.92 | 8 /216 | 126 | 96 /96 | 9 | 0% | 42 |
| 170.92 | 9 /381 | 126 | 96 /0 | 10 | 0% | 42 |

The first Survival Giant at145.92 dies154.20 (+8.28s), awarding120XP and helping reachLv9 at155.73. The second at169.92 dies173.97 (+4.05s), taking the player toLv10 before that170.92 wave is killed. Its96 nominal XP is then entirely unusable. These are exact grants, not XP-counter subtraction. Surviving members of earlier waves are exposed to27→54→81Hz while still far from defense.

All natural moving runs earn960 nominal GiantXP: first introduction120 plus seven Survival Giants840. Total natural kill rewards4,655–4,768 for competent /4,564–4,770 for slower; only1,898 is usable. During Survival alone:3,665–3,711 /3,657–3,710 nominalXP, with841–915 /838–996 usable. Isolated starts7/8/9/10 have1,100/800/450/0 XP left to use, respectively. Cap kills retain nominal diagnostic rewards while `grantXp` discards further progression, unchanged.

Every moving run admits and kills seven recurring Giants. Across natural and isolated moving scenarios their life is2.08–8.45s competent /2.08–9.50s slower; nearest position32.25/31.54. They generateXP without approaching20. Negligent isolated runs receive two Giant opportunities, admit one or two, kill some (17 of34 admitted across all20), and leave the others alive/censored. Occupied/cap opportunities are skipped, never caught up.

Natural moving runs receive six Supply opportunities and admit three, then skip at full inventory. Isolated moving runs receive six and admit none: their initial three charges remain unused because ordinary waves never satisfy the close emergency predicate. Negligent isolated runs receive one Supply opportunity and skip full inventory. No early wave kills are credited to a nonexistent Grenade or to contact.

## Future threat time and heuristic reliability

For each member, projected arrival is `spawn time + max(0, spawnZ - playerZ - boundary) / actual speed`. Killed members retain this counterfactual time. Observed future loadouts come from the same real run; no future state is supplied to gameplay. Cohort first arrival is useful for warning budget, but last-member and individual arrivals can cross another upgrade and are included in JSON.

| Seed1 competent wave | Spawn Hz | Theoretical first20(s): actual | Theoretical first10(s): actual |
| --- | --- | --- | --- |
| Lv7 at122.92 | 22.5 | 147.06: Lv8 /27Hz | 158.83: Lv9 /54Hz |
| Lv8 at134.92 | 27 | 159.19: Lv9 /54Hz | 170.96: Lv9 /54Hz; last member alreadyLv10 |
| Lv8 at140.92 | 27 | 165.18: Lv9 /54Hz | 176.94: Lv10 /81Hz |
| Lv8 at152.92 | 27 | 177.05: Lv10 /81Hz | 188.81: Lv10 /81Hz |

Natural cohort **first-arrival** comparison below. “Under” means predicted full-squad firepower is lower than actually observed; +1/+2 clamp to cap10. N=waves pooled over five seeds in that policy, not independent human trials.

| Policy | Spawn level | Boundary | N | Actual future level counts | Under: current /+1 /+2 |
| --- | --- | --- | --- | --- | --- |
| competent | 7 | 20 | 8 | 8 atLv8 | 100% /0% /0% |
| competent | 7 | 10 | 8 | 8 atLv9 | 100% /100% /0% |
| competent | 8 | 20 | 22 | 2 Lv8,14 Lv9,6 Lv10 | 90.9% /27.3% /0% |
| competent | 8 | 10 | 22 | 6 Lv9,16 Lv10 | 100% /72.7% /0% |
| competent | 9 | 20 and10 | 14 each | allLv10 | 100% /0% /0% |
| slower | 7 | 20 | 11 | allLv8 | 100% /0% /0% |
| slower | 7 | 10 | 11 | 2 Lv8,9 Lv9 | 100% /81.8% /0% |
| slower | 8 | 20 | 21 | 1 Lv8,12 Lv9,8 Lv10 | 95.2% /38.1% /0% |
| slower | 8 | 10 | 21 | 3 Lv9,18 Lv10 | 100% /85.7% /0% |
| slower | 9 | 20 and10 | 12 each | allLv10 | 100% /0% /0% |

**Lv+1 works for earlyLv7 at20 and Lv9→10, but fails near the Lv8→9 doubling and at the longer10-unit horizon.** Lv+2 covers these observed natural cases, but often overbudgets: competent Lv8 first20 is overestimated72.7%, and earlyLv7 first20 is overestimated100%. In isolated Lv7 starts, +1 already underestimates26.3% at20; +2 still underestimates13.2% at10 across pooled competent runs because some reachLv10 fromLv7. A single universal level-offset rule is unreliable; horizon, currentXP, living squad and Giant rewards matter.

For each natural moving policy,106 cohorts spawned at cap10 have86 observed /20 censored first20 arrival loadouts and76 observed /30 censored first10 loadouts. Censored late cohorts are not counted as confirmed cap firepower. Negligent runs often end before projected arrivals; future observations are not extrapolated after death. Full results and over/under counts for all scenarios are in `analysis.json`.

## Offline workload and speed candidates — estimates only

The figures below are arithmetic comparisons. **They are not outcomes of simulated alternative balance.** Count-only scaling preserves an approximate mix; integer replacement mixes give near/equal hit workload with less population. HeavyHP15/XP10 and GruntHP1/XP1 remain fixed in every actual run.

| Original /factor | Target successful hits | Count-only population /XP | Same-population equivalent | Actual hits /XP |
| --- | --- | --- | --- | --- |
| 26G4H /1.0× | 86 | 30 /66 | 26G4H | 86 /66 |
| 26G4H /1.5× | 129 | 45 /99 | 23G7H,30 total | 128 /93 |
| 26G4H /2.0× | 172 | 60 /132 | 20G10H,30 total | 170 /120 |
| 36G6H /1.0× | 126 | 42 /96 | 36G6H | 126 /96 |
| 36G6H /1.5× | 189 | 63 /144 | 31G11H,42 total | 196 /141 |
| 36G6H /2.0× | 252 | 84 /192 | 27G15H,42 total | 252 /177 |

At81Hz,126/189/252 hits require an **ideal lower bound**1.56/2.33/3.11s of perfect successful firing. At27Hz:4.67/7.00/9.33s. Real service adds travel, movement, lane selection, misses, Supply targeting and other cohorts; measured cap-wave medians around3–4s already exceed the ideal baseline. Doubling workload alone still leaves a long approach window and does not establish that enemies will threaten10.

At a six-second cadence, the current126-hit wave supplies21 hits/s against81 potential shots/s (26% utilization before Giant workload/misses). A2× workload supplies42 hits/s (52%). Giant172 every24s adds an average7.17 hits/s if every opportunity is admitted. A proposed4.5s cap cadence would supply56 hits/s, about69% before Giants. These are queue/workload estimates, not probabilities of survival.

Heavy replacements improve workload per XP: existing126 hits/96XP=0.762XP perhit; 252/177=0.702. However they still produce84% more XP per completed wave before cap. A1.5× mix196/141 also raises XP47%, acceleratingLv9/10 and partially cancelling the added workload. Giant172/120=0.698XP perhit. Pure Grunt density has the strongest XP feedback. Future balancing should not assume additional objects are free difficulty.

The following travel envelopes use38–47 units; actual cohort forecasts use exact member positions. Speed factors apply **conceptually to ordinary Survival enemies**, not to the accepted Giant or earlier encounters.

| Speed factor | Grunt to20 /10(s) | Heavy to20 /10(s) | Reaction window retained |
| --- | --- | --- | --- |
| 1.0× | 21.18–31.76 /32.94–43.53 | 25.00–37.50 /38.89–51.39 | 100% |
| 1.4× | 15.13–22.69 /23.53–31.09 | 17.86–26.79 /27.78–36.71 | 71.4% |
| 1.6× | 13.24–19.85 /20.59–27.21 | 15.63–23.44 /24.31–32.12 | 62.5% |

Faster approach shortens the XP-growth horizon and the time available to revisit another lane. It also reduces unopposed crowd residence, which helps cap pressure. It does not eliminate the pilot's ability to clear rapidly at cap. Changed arrival times would change actual combat/XP, so the current future-loadout timeline cannot be claimed as a measured prediction for faster enemies. Prefer1.4× as the initial phone experiment;1.6× may make missed-lane recovery disproportionately punishing at one living MG.

## Performance implications

No new browser timing was collected: no gameplay, rendering, asset, audio, configuration or startup path changed. Existing **P3-B.6A** evidence remains the baseline, not a new benchmark. Chrome/SwiftShader/DPR1/CPU4× sustained90s81Hz:

| Viewport | Mean /p95 frame(ms) | >100 /200ms | Peak live projectile /pool | Peak draws /triangles |
| --- | --- | --- | --- | --- |
| 350×844 | 22.69 /33.4 | 7 /0 | 107 /128 | 186 /137,828 |
| 390×844 | 22.92 /33.4 | 5 /0 | 107 /128 | 186 /134,488 |

Resources plateaued at102 geometries/12 textures after existing preparation; warm windows had no frame above100ms. The separate dense80-enemy Carnival software-rendering smoke sample was much worse: mean54.5/56.4ms and p9583.4/133.4ms. It was not a matched before/after benchmark. Neither test measures physical-phone GPU/thermal performance. The current diagnostic's fixed-step live-projectile peak108 fits the previously observed128 pool; these counts are not new renderer timings.

Count-only1.5×/2× would create63/84-member waves. Two84 waves already occupy168 slots; a third is rejected until enough enemies die. At current approach time, unopposed waves would exceed180, so increased count becomes cap-driven admission gaps rather than unlimited difficulty. Negligent baseline already peaks180, and moving slowerLv7 peaks135. Do not recommend hundreds of simultaneous enemies from a firepower×travel multiplication.

Keeping42 members and increasing Heavy share avoids enlarging each initial crowd, but surviving longer can still increase active population. Enemy body/gear rendering is instanced; Heavies also have individual backing/fill HP sprites. Replacing six with15 Heavies can add roughly18 HP-sprite draws when all bars are visible, plus longer-lived effects/crowds; total draw/triangle/frame cost cannot be predicted exactly from object count. Pools may grow to accommodate new sustained peaks. Profile actual resource plateaus and phone readability before acceptance. No claim is made that equal population means equal rendering cost.

## Recommended first experimental table — proposal, not applied

Start with modest additional workload during the vulnerable one-MG phase and a stronger, more continuous cap workload. Preserve population limits and recurring Giant/Supply mechanics. This is a measured starting hypothesis, **not an accepted balance or a guarantee of moderate difficulty**.

| Post-NAVAL player level | Total | Grunts | Heavies | Pressure lanes | Cadence(s) | Ordinary-only speed factor | Workload /XP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 6–7 | 30 | 26 | 4 | 3 | 6.0 | 1.0× | 86 /66; retain current profile |
| 8–9 | 42 | 31 | 11 | 4 | 6.0 | 1.4× | 196 /141; ~1.56× workload |
| 10 | 42 | 27 | 15 | 4 | 4.5 | 1.4× | 252 /177;2× workload |

Retain soft cap180, first wave+1s, Giant24s/maxone with unchanged0.68speed/172HP/120XP, Supply30s/+1, all player stats and pre-Survival balance. Profile selection would remain progression-level-based, with changes only to future ordinary admissions. **This task does not implement this table, a speed override, a new cadence policy or a difficulty director.**

Rationale: Lv6–7 already has the weaker one-soldier stage and some high transient density, so leave it alone initially. AtLv8–9, increase workload through composition and shorten the growth window, while measuring the stronger XP feedback. AtLv10, lost quiet intervals can be addressed through cadence without larger waves, and additional XP is unusable. Faster approach plus more Heavy bars can still produce a phone difficulty/performance spike; both need a matched experiment and human review. Even this cap workload has a perfect-hit service lower bound3.11s, so meaningful10-unit threats are not assured. If it remains easy, evaluate measured misses, lane debt and approach recovery before further population increases.

## Evidence, tests and scope

Reusable commands:

```text
node scripts/qa/survival-diagnosis.mjs --self-test
node scripts/qa/survival-diagnosis.mjs
node scripts/qa/survival-diagnosis-analysis.mjs
npm test -- tests/survivalDiagnosis.test.ts
```

Ignored local evidence: `artifacts/p3b6b0/summary.json`, `analysis.json`, and75 files `<scenario>-<policy>-<seed>.json`. Summary contains exact policy definitions, opportunity/casualty records and determinism digests; raw files retain all cohorts/enemies and population samples. `--quick` runs all15 combinations for seed1; `--out=<directory>` selects a different evidence directory. QA README documents reuse. Source matching guards against running this baseline diagnosis on silently changed production code.

- Six hook integration cases pass: real spawn-and-kill same tick, partial cap XP, Grenade damage/kill, contact, leak, unique boundary/censored future. Every case exactly matches unobserved state and transient events.
- Eight collector tests pass, including XP reset/cap accounting, same-tick death, no mutation and invalid observation rejection.
- Full `npm test`: **155 files /1,152 tests passed**.
- `npm run typecheck`: passed.
- `npm run build`: passed; existing chunk-size and dependency annotation warnings remain. Diagnostic modules/markers are absent from shipping JS.
- `git diff` against baseline for `src`, `public`, Vite/package configuration: empty. No production gameplay/configuration/assets changed. Content-addressed `/topwar/` assets, accepted P3, Observer, startup/hitch work, snapshots, historical policies and Legacy therefore retain the same implementation; full existing regression coverage also passes.

This task adds only QA scripts, a focused test, QA usage documentation and this report. No deployment, frozen-tag update, Survival tuning, enemy recoloring or later content. Physical-phone difficulty/performance and the proposed mixtures/cadence remain untested. Stop here for human review.
