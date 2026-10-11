# P3-B.6B.2 — Lv9–10 Survival pressure recovery

Baseline: `56a4f1647b7badd94b33bb77bb1d1e71fcbed87b`. Frozen `playtest-2026-10-08`: `59136b49e1328ab754412f7affe90c755c76c0fd`.

## Decision and implementation

The requested STAGED and AHEAD candidates are available exclusively through DEV/QA for phone comparison. **Accepted production difficulty remains unchanged.** BASELINE and EXPERIMENTAL remain exact comparison controls. No weapon, pre-Survival gameplay, renderer, audio or public asset changes were made. No deployment or next-content development.

Implementation commit: `b7282a9c0a34c5c7c759f0be34f5bc19ee2f6f8c`. This report is delivered in a separate documentation commit following it.

| Mode | Level | Grunts | Heavies | Lanes | Cadence | Ordinary speed | MG hits/wave | Nominal XP/wave |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| All | 6–7 | 26 | 4 | 3 | 6s | 1× | 86 | 66 |
| BASELINE | 8–10 | 36 | 6 | 4 | 6s | 1× | 126 | 96 |
| EXPERIMENTAL | 8–9 | 31 | 11 | 4 | 6s | 1.4× | 196 | 141 |
| EXPERIMENTAL | 10 | 27 | 15 | 4 | 4.5s | 1.4× | 252 | 177 |
| STAGED / AHEAD | 8, before lookahead | 31 | 11 | 4 | 6s | 1.4× | 196 | 141 |
| STAGED / AHEAD | 9 | 27 | 15 | 5 | 5s | 1.6× | 252 | 177 |
| STAGED / AHEAD | 10 | 23 | 19 | 5 | 4s | 1.6× | 308 | 213 |
| AHEAD only | 8, XP ≥245/350 | 31 | 11 | 5 | 6s | 1.6× | 196 | 141 |

Heavy HP remains 15; Grunt HP 1. MG rates remain 27/54/81 Hz at Lv8/9/10. STAGED's nominal ordinary workload is 50.4 hits/s at Lv9 and 77 hits/s at Lv10, compared with EXPERIMENTAL's 32.67/56. Giant work is additional, but opportunities can be skipped and Grenades remove HP across groups. These workloads are admission budgets, not successful-hit or danger measurements.

`levelProfiles` is optional, strictly ordered, and mutually exclusive with historical advanced/cap fields. `xpLookahead` requires a matching profile, valid lane count and positive integer XP strictly below the level's authored requirement. AHEAD overrides only lanes and ordinary speed. At 244 XP it uses four lanes / 1.4×; at 245 it uses five / 1.6×. Tests exercise both exact boundaries.

One ordinary-wave deadline remains authoritative. Crossing an XP/level boundary does not reset it or create a wave. The next due opportunity selects the new profile, then advances using that profile's cadence. Existing enemies retain their admission-time speed. The 180-active cap skips complete groups that do not fit; it does not delete enemies, partially admit groups or bank overdue opportunities. IDs, row cursors, RNG, first natural wave at departure +1s, Giant 24s and Supply 30s opportunities remain intact.

DEV → SURVIVAL TEST offers BASELINE / EXPERIMENTAL / STAGED / AHEAD and LV7 / LV8 / LV9 / LV10. Both selections have explicit pressed states, restart real seed-17 combat, and close DEV. Retry reproduces the selected fixture. Touch buttons are 48px high at both 350×844 and 390×844. Main LATE/CRATE3/CRATE8/NAVAL and MG TEST are unchanged. All review controls and preset data are excluded from the production bundle.

## Measurement method and deterministic checks

240 runs: four modes × natural/Lv8/Lv9/Lv10 × three existing pilots × seeds 1,17,42,99,2026. Simulation runs at fixed 60 Hz for 180 seconds after Survival activation unless Game Over. Isolated entries have one immediate review group and normal XP progression; they are not level-locked. Natural runs preserve the complete Lv1→Carnival/Destroyer sequence.

Competent: adjacent lane decisions every 200ms; existing nearest-threat/Supply/distant-Giant preference, artillery-lane avoidance and emergency Grenade predicate. Slower: same decisions every 600ms, Grenade check at those decisions. Fixed: center lane, no Grenades. No perfect-hit injection or invulnerability. All natural fixed pilots die at 26.72–28.55s before Survival; those are not post-NAVAL failures.

QA-only source transforms observe exact admissions, pre-combat crossings, damage/removal causes and granted XP, including admission-tick kills. Additional read-only collection captures live cohort IDs/HP before and after upgrades and first actual damage engagement at fixed-tick resolution. The before-upgrade sample is one tick before the resolved level change; +5/+10/+20 windows are actual live enemies, not projected travel. Incomplete windows remain censored.

**2,168,822 event ticks and 36,696 full-state checkpoints** match an uninstrumented simulation receiving identical inputs. **11,841 admission-tick deaths** are included. Both controls' 120 final states/events match the B6B1 source engine; retained B6B1 final/input hashes match. Every natural pre-Survival gameplay/input/event hash matches across modes, excluding only the deliberately different serialized balance configuration. Thus the accepted earlier combat sequence is unchanged.

Machine-readable raw cohorts, upgrade windows, engagements, input/final hashes, summaries and analyses live under ignored `artifacts/p3b6b2/`. Reproduce with `node scripts/qa/survival-pressure.mjs`, then `node scripts/qa/survival-pressure-analysis.mjs`. `--quick` runs seed 1; `--self-test` checks the six hook integration edge cases. The prior B6B0/B6B1 evidence remains intact.

## Natural progression and actual pressure

Ranges below cover five seeds. Ages are seconds after Survival activation, which remains 120.43–122.65s for competent and 120.43–123.63s for slower pilots. The first natural wave remains exactly +1s. XP awarded by kills is tracked directly across level resets; it is not inferred from the visible XP counter.

| Mode | Pilot | Lv9 age | Lv10 age | Mean enemies | Mean HP | Peak enemies | Peak within 20 / 10 | Game Over / 5 | Blocked waves |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BASELINE | competent | 32.32–33.82 | 45.20–52.10 | 20.7–21.2 | 63.9–66.1 | 87–99 | 0 / 0 | 0 | 0 |
| BASELINE | slower | 33.33–39.88 | 46.43–53.80 | 21.9–25.8 | 77.8–84.2 | 91–115 | 0 / 0 | 0 | 0 |
| EXPERIMENTAL | competent | 24.27–34.22 | 39.65–45.97 | 39.3–43.7 | 169.1–193.1 | 111–127 | 0 / 0 | 0 | 0 |
| EXPERIMENTAL | slower | 33.97–38.67 | 43.73–52.75 | 53.7–75.6 | 246.3–345.0 | 124–148 | 4–13 / 0 | 0 | 0 |
| STAGED | competent | 24.27–34.22 | 38.60–45.90 | 103.1–112.5 | 638.0–717.8 | 168–180 | 21–36 / 0 | 0 | 1 |
| STAGED | slower | 33.97–38.67 | 42.88–52.97 | 109.3–116.0 | 701.3–741.4 | 173–180 | 49–70 / 15–38 | 3 | 1–2 |
| AHEAD | competent | 24.43–34.62 | 38.35–45.65 | 103.1–112.2 | 638.0–707.1 | 168–179 | 24–32 / 0 | 0 | 1–2 |
| AHEAD | slower | 33.47–38.67 | 42.98–52.80 | 109.4–116.0 | 683.6–741.4 | 172–179 | 48–67 / 16–33 | 4 | 1–2 |

STAGED preserves the exact Lv9 arrival times of EXPERIMENTAL: only future Lv9+ admissions change. Its Lv10 arrival moves by −1.05 to +0.15s for competent seeds and −1.72 to +0.22s for slower seeds. AHEAD is not consistently earlier: competent Lv9 changes 0 to +1.70s relative to STAGED, slower −0.50 to 0s. More enemy XP can accelerate cap arrival, but routing, Heavy survival, Giant kills and unchanged pending deadlines also matter.

The competent pilots lose no soldiers in any mode. Natural slower STAGED deaths occur at Survival ages 164.95s (17), 176.63s (99), 161.30s (2026); AHEAD at 177.58s (1), 157.30s (17), 176.63s (99), 145.95s (2026). Each losing run loses all three soldiers through real combat. Surviving slower runs have zero casualties. These losses were not used to retune the requested profiles.

## Pressure during the power upgrades

Each cell is **living population / remaining HP**. It includes inherited ordinary and Giant cohorts. Levels can advance again inside a +20s window. All natural moving-pilot windows are observed. At Lv9, BASELINE has 3–4 live cohorts, EXPERIMENTAL/STAGED/AHEAD 3–4; at Lv10, competent BASELINE has one, EXPERIMENTAL 2–3, STAGED 3–4, AHEAD 2–3. Raw windows contain each cohort's count and HP.

| Competent, Lv9 | Before | +5s | +10s | +20s |
| --- | --- | --- | --- | --- |
| BASELINE | 87–99 / 222–267 | 59–72 / 95–174 | 0–42 / 0–126 | 16–42 / 33–126 |
| EXPERIMENTAL | 49–127 / 315–537 | 83–121 / 295–470 | 57–85 / 183–333 | 34–71 / 148–361 |
| STAGED | 49–127 / 315–537 | 81–121 / 334–526 | 81–109 / 400–509 | 72–96 / 445–593 |
| AHEAD | 52–125 / 300–491 | 77–118 / 308–477 | 69–100 / 380–465 | 72–87 / 438–559 |

| Slower, Lv9 | Before | +5s | +10s | +20s |
| --- | --- | --- | --- | --- |
| BASELINE | 90–105 / 213–257 | 49–75 / 105–167 | 1–42 / 103–240 | 0–24 / 0–88 |
| EXPERIMENTAL | 118–143 / 431–550 | 100–118 / 381–495 | 56–120 / 308–491 | 48–96 / 198–435 |
| STAGED | 118–143 / 431–550 | 101–118 / 428–551 | 86–114 / 410–659 | 86–112 / 537–735 |
| AHEAD | 118–143 / 431–564 | 98–122 / 428–563 | 81–114 / 400–644 | 92–120 / 556–718 |

| Competent, Lv10 | Before | +5s | +10s | +20s |
| --- | --- | --- | --- | --- |
| BASELINE | 21–43 / 49–127 | 11–35 / 14–187 | 31–42 / 100–126 | 0–7 / 0–172 |
| EXPERIMENTAL | 68–101 / 238–398 | 24–76 / 177–353 | 24–61 / 153–272 | 22–74 / 67–315 |
| STAGED | 78–110 / 339–512 | 61–83 / 333–477 | 58–103 / 376–722 | 79–103 / 433–608 |
| AHEAD | 72–98 / 343–508 | 60–83 / 337–608 | 58–102 / 376–726 | 93–122 / 568–742 |

| Slower, Lv10 | Before | +5s | +10s | +20s |
| --- | --- | --- | --- | --- |
| BASELINE | 21–43 / 49–127 | 0–27 / 0–99 | 20–42 / 58–126 | 0–43 / 0–272 |
| EXPERIMENTAL | 65–121 / 262–655 | 49–96 / 264–417 | 66–101 / 279–465 | 43–97 / 205–486 |
| STAGED | 75–122 / 361–644 | 85–126 / 468–767 | 76–113 / 412–708 | 85–109 / 559–679 |
| AHEAD | 75–121 / 367–644 | 84–129 / 486–772 | 75–116 / 431–708 | 88–109 / 550–679 |

STAGED restores substantial surviving workload after the firepower spikes. This is not equivalent to unavoidable defense-line danger: competent pilots still intercept every ordinary enemy before 10 units, while slower pilots accumulate threatening survivors and can lose.

## Lookahead evidence

Across natural moving runs, STAGED and AHEAD each admit ten qualifying late-Lv8 cohorts: five competent and five slower. Seed 17 competent and seed 99 slower have no qualifying admission; crossing the XP threshold does not itself create a wave. Cohorts keep their seeded IDs/cursors, and AHEAD's same 196 HP is distributed over five lanes at 1.6×.

Actual cohort examples:

| Pilot / seed / cohort | Spawn XP | STAGED closest / crossing 20 | AHEAD closest / crossing 20 | Live at Lv9 +10s, STAGED → AHEAD |
| --- | ---: | --- | --- | --- |
| competent / 1 / 32 | 262 | 25.16 / 0 | 22.68 / 0 | 12 enemies, 12 HP → 7, 13 HP |
| competent / 2026 / 32 | 300 | 21.54 / 0 | 18.95 / 4, 28 HP | 0 → 0 |
| slower / 17 / 35 | 292 | 17.80 / 5, 11 HP | 13.58 / 17, 79 HP | 9, 15 HP → 13, 16 HP |
| slower / 42 / 34 | 336 | 20.21 / 0 | 22.04 / 0 | 17, 26 HP → 7, 7 HP |

Most first engagements of these cohorts occur at Lv9/10, validating the travel-delay concern using actual hits. In seed 1 competent, STAGED's cohort has first-hit levels 33 at Lv9 / 9 at Lv10; AHEAD has all 42 at Lv9. AHEAD's cohort clears at 166.42s versus 169.92s, so faster approach does not necessarily leave more sustained debt. Every qualifying natural late-Lv8 cohort is eliminated by Lv9 +20s in both modes; none reaches 10 units. The later sustained workload comes from Lv9/10 admissions.

AHEAD adds near-range pressure in some seeds, but its aggregate +10/+20s Lv9 debt is not consistently above STAGED. The additional natural slower failure is evidence of greater sensitivity, not proof of a uniformly better emotional curve. Do not infer success from theoretical travel alone.

## Clearance, target availability and XP feedback

Percentages count unique ordinary enemies including immediate kills. Long-range clearance counts mature cohorts completely killed by player combat before any member reaches 20 units. HP debt is remaining successful-hit workload; visual population and defense danger are separate measurements.

| Mode / pilot | Cross 30 / 20 / 10 (%) | Long-range cleared (%) | Global / selected-lane target availability (%) | Longest global gap | Ordinary / Giant XP |
| --- | --- | --- | --- | --- | --- |
| BASELINE competent | 0–0.2 / 0 / 0 | 100 | 73.9–75.8 / 66.6–68.0 | 3.12–3.52s | 2820–2850 / 840 |
| BASELINE slower | 0.2–1.4 / 0 / 0 | 100 | 77.2–84.8 / 65.1–67.4 | 2.90–3.65s | 2783–2850 / 840 |
| EXPERIMENTAL competent | 5.4–8.3 / 0 / 0 | 100 | 98.6–99.1 / 90.4–92.9 | 0.43–1.12s | 6103–6322 / 840 |
| EXPERIMENTAL slower | 15.2–31.5 / 0.3–2.3 / 0 | 85.7–94.4 | 98.9–100 / 86.3–90.4 | 0–1.52s | 5880–6184 / 840 |
| STAGED competent | 64.6–70.8 / 11.8–20.6 / 0 | 41.7–54.1 | 99.3–100 / 96.7–98.1 | 0.08–1.12s | 7320–7649 / 840 |
| STAGED slower | 57.5–63.1 / 24.5–28.1 / 8.6–9.7 | 6.1–29.4 | 99–100 / 94–96.4 | 0–1.52s | 6058–7003 / 720 |
| AHEAD competent | 64.6–71.3 / 12.5–19.3 / 0 | 41.7–52.8 | 99.3–100 / 96.9–97.9 | 0.08–1.12s | 7373–7583 / 840 |
| AHEAD slower | 57.7–68.1 / 23.7–28.1 / 3.5–9.7 | 6.1–32.4 | 99–100 / 94–96 | 0–1.52s | 5475–6934 / 600–840 |

Natural competent ordinary admissions: BASELINE 30 waves, EXPERIMENTAL 38, STAGED 41–42, AHEAD 41. Actual admitted ordinary workloads average 20.56–20.78 / 49.49–50.41 / 64.58–67.83 / 64.58–66.12 hits/s over Survival, including the early lower-level phase and cap skips. Corresponding all-enemy kills are 6.93–7.09 / 8.51–8.83 / 8.67–8.95 / 8.68–8.88 per second. STAGED/AHEAD median wave-clear times rise to 18.05–19.68s from EXPERIMENTAL's 8.80–9.58s. Near-continuous targets therefore coexist with much greater HP debt, rather than simply more instant low-HP kills.

Nominal XP includes rewards after the cap; usable XP stops at Lv10. Giant contributions are separated. The 840 competent Giant XP represents seven normal 120-XP Survival kills; slower STAGED yields six, AHEAD five to seven, with occupied/cap/death truncation preserved. The first-wave and opportunity schedules are unchanged. Raw records include wave kill causes, per-lane HP and remaining cohorts after each level-up; existing Grenade rewards and kills are not reassigned to ordinary fire.

## Isolated entries

These are real growing-XP runs, not permanent fixed-level tests. All competent isolated runs complete 180s without casualties. BASELINE/EXPERIMENTAL slower runs also complete; STAGED/AHEAD slower runs each lose in 2/5 seeds at each isolated entry. Their identical Lv9/Lv10 outcomes confirm that AHEAD adds no rule at those starting levels.

| Mode | Entry | Competent mean / peak enemies | Slower mean / peak | Slower peak within 20 / 10 | Slower ordinary cross 20 / 10 (%) |
| --- | --- | --- | --- | --- | --- |
| BASELINE | 8 | 17.4–18.2 / 51–63 | 16.9–19.3 / 53–70 | 0 / 0 | 0 / 0 |
| BASELINE | 9 | 15.2–15.5 / 42–60 | 14.2–16.3 / 43–63 | 0 / 0 | 0 / 0 |
| BASELINE | 10 | 14.5–14.9 / 42–49 | 13.8–15.3 / 42–63 | 0 / 0 | 0 / 0 |
| EXPERIMENTAL | 8 | 34.7–40.2 / 93–106 | 47.3–59.5 / 100–157 | 0–17 / 0 | 0–3.9 / 0 |
| EXPERIMENTAL | 9 | 27.8–30.2 / 73–85 | 34.9–43.7 / 83–100 | 0 / 0 | 0 / 0 |
| EXPERIMENTAL | 10 | 26.8–29.7 / 66–81 | 36.5–42.9 / 74–99 | 0 / 0 | 0 / 0 |
| STAGED | 8 | 87.1–101.6 / 149–166 | 103.1–110.1 / 169–179 | 36–71 / 2–41 | 16.3–29.8 / 0.2–8.6 |
| STAGED | 9 | 82.7–87.9 / 150–160 | 95.8–105.6 / 166–180 | 39–72 / 5–38 | 16.1–22.0 / 0.9–10.1 |
| STAGED | 10 | 88.5–92.3 / 159–169 | 104.4–110.6 / 169–180 | 32–64 / 3–34 | 15.3–22.1 / 0.3–4.8 |
| AHEAD | 8 | 87.0–97.4 / 152–161 | 101.6–112.5 / 172–179 | 30–75 / 0–42 | 11.3–22.1 / 0–10.4 |
| AHEAD | 9 | 82.7–87.9 / 150–160 | 95.8–105.6 / 166–180 | 39–72 / 5–38 | 16.1–22.0 / 0.9–10.1 |
| AHEAD | 10 | 88.5–92.3 / 159–169 | 104.4–110.6 / 169–180 | 32–64 / 3–34 | 15.3–22.1 / 0.3–4.8 |

Every isolated fixed-lane pilot fails in all modes. BASELINE fails at 49.48–50.62s across the entries. EXPERIMENTAL Lv8/Lv9/Lv10 fails at 35.35–35.78 / 35.45–36.02 / 35.62–36.55s; STAGED/AHEAD at 35.35–35.78 / 31.00–31.53 / 31.10–31.98s. The fixed pilot does not unlock late profiles from Lv8 before dying, so those Lv8 results remain identical. Precise seed times and casualties are retained in raw metrics. No negligible-policy success requirement was imposed.

## Mobile rendering gate

Chrome / SwiftShader, CPU 4×, DPR 1, 350×844 and 390×844. Each mode starts in a separate new page/WebGL context, then retries in that same context for a warm sample. All samples start real Lv8 seed-17 combat with normal XP growth and the same frame-driven adjacent-lane pilot. Each measures 90 wall seconds; raw output retains actual simulation duration, including the existing large-frame timestep clamp. UI fixture loops are skipped during timing to avoid prewarming a purported fresh context. Other compute/browser QA and recording are run separately. The Chrome process is shared, so driver-level caches are not forcibly cleared between contexts.

| Viewport | Mode | Context | Mean / p95 / max frame (ms) | >100 / >200ms | Peak enemies / projectiles | Peak calls / triangles | Projectile pool |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 350 | EXPERIMENTAL | fresh | 42.0 / 66.7 / 216.8 | 10 / 2 | 120 / 107 | 214 / 368084 | 128 |
| 350 | EXPERIMENTAL | warm | 39.9 / 66.7 / 100.0 | 0 / 0 | 116 / 107 | 210 / 362300 | 128 |
| 350 | STAGED | fresh | 59.0 / 83.4 / 283.4 | 14 / 1 | 123 / 53 | 266 / 389910 | 64 |
| 350 | STAGED | warm | 59.0 / 83.4 / 100.1 | 2 / 0 | 122 / 63 | 261 / 381916 | 64 |
| 350 | AHEAD | fresh | 62.3 / 83.5 / 300.0 | 23 / 1 | 129 / 58 | 267 / 424620 | 64 |
| 350 | AHEAD | warm | 55.9 / 83.4 / 100.1 | 2 / 0 | 114 / 61 | 255 / 380976 | 64 |
| 390 | EXPERIMENTAL | fresh | 40.1 / 66.7 / 200.0 | 9 / 0 | 108 / 108 | 215 / 341638 | 128 |
| 390 | EXPERIMENTAL | warm | 38.5 / 66.7 / 83.4 | 0 / 0 | 112 / 107 | 215 / 354520 | 128 |
| 390 | STAGED | fresh | 57.7 / 83.4 / 283.4 | 10 / 1 | 116 / 60 | 262 / 360768 | 64 |
| 390 | STAGED | warm | 57.8 / 83.4 / 100.1 | 3 / 0 | 118 / 57 | 257 / 365456 | 64 |
| 390 | AHEAD | fresh | 59.5 / 83.4 / 266.7 | 13 / 1 | 119 / 57 | 262 / 393952 | 64 |
| 390 | AHEAD | warm | 59.7 / 83.4 / 100.1 | 5 / 0 | 126 / 52 | 264 / 414860 | 64 |

STAGED raises mean frame time **40.4–44.1% fresh / 48.1–50.1% warm** relative to matched EXPERIMENTAL. AHEAD raises it **48.2–48.4% fresh / 40.2–55.1% warm**. These are one fresh and one warmed run per mode/size, not a statistical certification. Input decisions are sampled by real RAF, so long-frame phase changes can alter the exact combat trajectory. The variation does not support ranking AHEAD and STAGED's rendering cost narrowly.

The last 30-second window is worse for the candidates: EXPERIMENTAL mean 33.5–34.5ms, STAGED 69.3–72.6ms, AHEAD 71.0–79.9ms. This sustained late-crowd cost remains after preparation. Late rolling simulation-step p95 is 1.0–1.6ms for EXPERIMENTAL versus 1.8–2.2ms for the candidates; renderer submission p95 7.4–8.5ms versus 9.7–10.2ms. These CPU metrics cover the final 120 frames, not the whole run and not GPU time.

All trials reach Lv10 with three living MGs; actual simulation duration is 89.97–90.05s. Geometry/texture counts rise from 62/9 to **102/12** and remain there after approximately 30–36s. Heavy tier capacity grows from 16→32 in EXPERIMENTAL, 16→32→64 in candidates; Heavy body batches grow to 16 where needed. Enemy shadow capacity can grow from 120→240 at a new peak, including a late warmed AHEAD run; those are bounded capacity steps, not continuous growth. Warm contexts retain resources across Retry. Fewer candidate projectiles reflect nearer hits and shorter lifetimes, not weaker weapons. No new model/image/audio/JSON request occurs during any measured trial.

Fresh EXPERIMENTAL reproduces the existing first-use risk (two >200ms frames at 350px; the 390px maximum is exactly 200ms). Each candidate has one >200ms fresh frame around the first Giant/death-effect window; none occurs in warm runs. Adjacent-frame records identify preceding render-frame CPU work of roughly 200–285ms, rather than assigning the interval to the following frame's much shorter CPU work.

Separate 35s STAGED Chrome timelines/CPU profiles, followed by timed WebGL queries, reproduce the stall at Survival age ~29s. At 350px, the preceding frame takes 255.8ms CPU, with **171.1ms in one `getShaderInfoLog` and 68.2ms in `getProgramInfoLog`**. At 390px, it takes 238.7ms CPU, including **175.1ms in `getShaderInfoLog`**. Three.js's existing first-use shader-error checks query these logs synchronously. This confirms blocking shader/program information queries as the dominant cost of the reproduced stall; the short `compileShader` call alone would miss it. The first CPU profile also spends 800.8ms total in shader-log queries and 505.5ms in program-log queries over 35s, spread across first-use programs.

In the separate 350px timeline, individual Layout / Style / Paint maxima are 2.21 / 3.20 / 0.83ms; scavenger GC max 1.59ms and one major GC 8.25ms. They do not explain the ~250ms reproduced stall. The render-call and sampled native-call durations include blocking waits, not solely CPU instruction execution. This does not attribute every long frame, nor measure real phone GPU compilation. Profiling/wrapping overhead is excluded from the primary table. No shader/material code was added by the balance change, and no rendering refactor or disabling of error checks was made. The fresh candidate hitch gate is therefore **not cleared**; the existing preparation path still leaves first-use synchronization risk, now under a more costly crowd.

The measured candidates are materially more expensive than EXPERIMENTAL. Fixed 42-person group size does not imply fixed active population, workload, raster coverage or HP-bar cost: longer-lived Heavies, shorter cadence and closer approach increase those costs. Resources remain bounded, but this is a performance gate against production promotion. No art, HP bars, effects, resolution or accepted projectile presentation is reduced. Desktop software rendering is not physical-phone GPU performance; phone frame pacing and thermal behavior still require human validation.

## Compatibility, regression and evidence

- Full suite: **157 files, 1,172 tests passed**; typecheck and production build passed. Existing nonfatal chunk-size/Zod annotation warnings remain.
- Both viewports: all **32** Survival mode/level UI checks pass, including pressed states, actual authored weapons/composition, closing DEV, deterministic Retry, Pause and JSON snapshot continuation. MG TEST remains 18 / 22.5 / 27 / 54 / 81 Hz with real projectiles and contact Game Over/Retry.
- CRATE3/CRATE8 at both widths retain exact three-hit destruction, ordered impact/crack/open/reward audio, three/one reward transfers, partial snapshot restore, paused recovery/transfer and Retry. Main DEV entries remain unchanged.
- Naval Observer failure checks pass at both sizes: a generated emblem with available voice beginning at offset zero, readable Destroyer subtitles, Pause, transfer resize/safe-area alignment, pixel-identical aircraft, WebGL context restoration and disposal.
- Production: six mobile smoke cases pass; no Survival/MG review UI or preset values survive tree-shaking. Natural Lv1–10 combat, Pause/Retry/Snapshot and Legacy Boss continuation pass at both sizes. Defense still requests one GLB; Legacy retains its 13 assets.
- Historical three-Heavy settings, eight/ten-level plans, sequential and concurrent Carnival/Destroyer saves, unstamped ordinary movement, saved speed stamps and schedule ownership retain existing regression coverage. Both comparison controls also match the historical engine through complete natural/isolated combat. New ordered profiles/lookahead are serialized opt-ins; loading old configuration does not invent them.
- Invalid profiles, mixed profile formats, cap overflow, invalid lanes/speeds and lookahead thresholds are rejected. Unit tests prove no threshold wave, no upgrade deadline reset, no survivor rewrite and exact 244/245 behavior. Existing no-backlog/cap/RNG tests remain intact.
- `public/game-data/game.json`, weapon/progression rules, renderer/audio and assets are unchanged. Content-addressed `/topwar/` paths remain intact, including `game.f03e1e1605650187.json` and the single Defense bullet GLB. Startup critical assets and first-use preparation remain the accepted implementation.

Evidence: `artifacts/p3b6b2/ui-final/`, `mg/`, `supply/`, `readiness/`, `production/`, `natural-legacy/`, `performance/`, `traces/`, `traces-gl/` and `recordings/` retained locally. Diagnostic artifacts are intentionally ignored, not committed. Chrome trace JSON and CPU profiles can be opened in performance tooling. Six separate 45s recordings show actual Lv8→Lv9→Lv10 combat at both widths, all ending with three living MG soldiers; extracted 3/25/40s frames retain the approved P3, HUD and safe-area composition. Files follow `recordings/{350,390}-{experimental,staged,ahead}.webm`.

## Next phone comparison

Use EXPERIMENTAL as the accepted comparison, then STAGED at Lv8 and follow natural upgrades for at least 20s after Lv9 and Lv10. Compare AHEAD second, concentrating on the first 10–20s after Lv9; repeat seeds/scenarios because it does not reliably raise the aggregate debt above STAGED. Include a sustained Lv10 run, HP-bar readability and slower lane changes. Verify phone frame pacing and thermal behavior before any production decision. Nothing is promoted automatically.
