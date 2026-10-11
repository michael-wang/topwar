# P3-B.6B.1 — Survival balance experiment

Baseline: `d8795c5f00e3b1a725ca75a78deae01238120f2f`. Frozen `playtest-2026-10-08`: `59136b49e1328ab754412f7affe90c755c76c0fd`.

## Decision

Keep the accepted production balance unchanged. The exact combined table is implemented as the DEV/QA experiment for physical-phone review. Combat is bounded and moving pilots survive, but fresh-context software-rendering samples raise mean frame time about 60% and contain three >200ms frames. This invokes the task's costly-candidate fallback; no values were retuned to improve automated success. Production `public/game-data/game.json`, weapons, assets, renderers and audio remain unchanged.

## Candidate and implementation

| Level | Grunts | Heavies | Pressure lanes | Interval | Ordinary speed |
| --- | --- | --- | --- | --- | --- |
| 6–7 | 26 | 4 | 3 | 6.0s | 1.0× |
| 8–9 | 31 | 11 | 4 | 6.0s | 1.4× |
| 10 | 27 | 15 | 4 | 4.5s | 1.4× |

The exact proposal lives in DEV/QA data `src/config/survivalExperiment.json`. Optional advanced/cap profile fields support authored ordinary speed and cadence. Each newly admitted ordinary Grunt/Heavy captures its speed multiplier in plain enemy snapshot data. Inherited pre-NAVAL enemies retain their previous speed; changing level changes future admissions, without retroactively changing an existing cohort. Missing metadata means original movement. Giant speed remains 0.68, HP 172, XP 120 and opportunities every 24 seconds. Supply remains every 30 seconds, +1, held capacity three. Heavy HP 15 and all weapon values remain unchanged.

One scheduled deadline still owns ordinary admissions. A Lv10 upgrade uses the new cadence after the already-scheduled opportunity; it does not reset that deadline or create another wave stream. Cap-blocked/missed opportunities consume their row/time slot, without deleting existing enemies or creating a backlog. The 180-active-enemy cap, first natural wave at departure +1s, Carnival +24s and Destroyer +27s are preserved.

## Matched measurement method

375 runs: five candidates × natural/Lv7/Lv8/Lv9/Lv10 × competent/slower/negligent × seeds 1,17,42,99,2026. Every reached Survival runs 180 seconds at fixed 60 Hz unless Game Over. Isolated runs start with one immediate seeded group at age zero; their first opportunity differs intentionally from natural departure +1s. Normal XP growth is enabled throughout; isolated Lv8 is not artificially kept at Lv8.

Competent pilot: existing adjacent-lane policy, one decision every 200 ms; avoids locked artillery lanes, targets the nearest enemy except Supply/distant Giant preference; existing emergency Grenade predicate every tick. Slower: same policy at 600 ms, Grenade predicate only at decisions. Negligent: stays in the center lane, no Grenades. No invulnerability, fake hits or enemy manipulation. Natural negligent pilots all fail at 26.72–28.55s before Survival; these are **not** post-NAVAL failures.

Heavy-only changes composition at Lv8/Lv10 but retains 1× speed and 6s cadence. Speed-only changes Lv8+ ordinary speed but retains original composition and 6s cadence. Combined/6s adds both at 6s; full experiment adds the proposed Lv10 4.5s cadence. This fifth control exposes the cadence contribution rather than attributing it to speed.

Existing QA-only source transforms observe admission IDs/cursors, pre-combat crossings, exact damage/removal causes and awarded XP, including admission-tick kills. They are not imported into shipping code. Every observed run replays identical inputs in a separate plain Simulation: **3,367,767 event ticks and 56,970 full-state checkpoints** pass. **30,692 same-tick deaths** are included. All 75 baseline final states/events match the historical source engine, with retained B6B0 historical final/input hashes checked. Every natural pre-Survival tick's gameplay/input/event hash matches baseline across candidates, excluding only the deliberately different saved balance config. Earlier accepted gameplay is unchanged.

All values below are ranges across the five seeds. Mean population/HP samples every post-step Survival frame. Crossing fractions count unique ordinary enemies, including immediate deaths in their admission denominator. Long-range clear fraction uses mature ordinary cohorts completely killed by player combat before reaching 20 units; late unobserved theoretical arrivals remain censored. Contacts/leaks award no XP. Target gaps use global weapon-range availability; selected-lane gaps are also retained in machine-readable data.

Historical digest checks use the historical engine's original serialization. Current snapshots can reorder configuration keys without changing their values; strict deep state equality is checked separately, so a raw JSON key-order difference is not mistaken for gameplay divergence.

## Natural difficulty

| Candidate / pilot | Mean / peak active | Peak ≤30 / ≤20 / ≤10 | Long-range cleared waves | Ordinary crossing 20 / 10 | Kills/s | Longest target gap (s) |
| --- | --- | --- | --- | --- | --- | --- |
| Baseline / competent | 20.7–21.2 / 87–99 | 0–2 / 0 / 0 | 100.0% | 0.0% / 0.0% | 6.93–7.09 | 3.12–3.52 |
| Baseline / slower | 21.9–25.8 / 91–115 | 1–16 / 0 / 0 | 100.0% | 0.0% / 0.0% | 6.92–7.08 | 2.90–3.65 |
| Heavy only / competent | 32.1–35.7 / 133–146 | 18–36 / 0 / 0 | 100.0% | 0.0% / 0.0% | 6.88–7.08 | 1.93–2.52 |
| Heavy only / slower | 39.0–46.5 / 128–150 | 16–43 / 0 / 0 | 100.0% | 0.0% / 0.0% | 6.86–6.96 | 1.00–1.52 |
| Speed only / competent | 20.1–21.0 / 86–94 | 7–15 / 0 / 0 | 100.0% | 0.0% / 0.0% | 6.93–7.09 | 3.13–3.53 |
| Speed only / slower | 20.8–26.0 / 81–114 | 11–30 / 0 / 0 | 100.0% | 0.0% / 0.0% | 6.92–7.08 | 2.75–3.52 |
| Combined / 6s / competent | 28.4–33.6 / 111–127 | 23–55 / 0 / 0 | 100.0% | 0.0% / 0.0% | 6.93–7.09 | 2.13–2.58 |
| Combined / 6s / slower | 38.2–44.7 / 124–148 | 44–73 / 1–13 / 0 | 82.8–96.4% | 0.1–2.9% / 0.0% | 6.86–7.04 | 1.17–2.08 |
| Full experiment / competent | 39.3–43.7 / 111–127 | 23–55 / 0 / 0 | 100.0% | 0.0% / 0.0% | 8.51–8.83 | 0.43–1.12 |
| Full experiment / slower | 53.7–75.6 / 124–148 | 44–73 / 4–13 / 0 | 85.7–94.4% | 0.3–2.3% / 0.0% | 8.39–8.71 | 0.00–1.52 |

All 250 moving-policy runs across the five candidates survived their full window with **zero casualties**. The combined candidate has substantially more persistent work and shorter empty intervals. Its slower natural pilots allow 0.33–2.27% of ordinary enemies inside 20 units, with peak 4–13, but none reaches 10. Competent natural pilots still clear all mature ordinary waves above 20. These pilots demonstrate workload and recoverable pressure, not a guaranteed human outcome.

## XP feedback and progression

| Candidate / pilot | Lv9 after Survival (s) | Lv10 after Survival (s) | Survival XP earned / usable | Mean HP debt | Mean per-lane HP debt range | Peak per-lane debt |
| --- | --- | --- | --- | --- | --- | --- |
| Baseline / competent | 32.32–33.82 | 45.20–52.10 | 3665–3711 / 841–915 | 63.9–66.1 | 6.3–25.1 | 39–208 |
| Baseline / slower | 33.33–39.88 | 46.43–53.80 | 3657–3710 / 838–996 | 77.8–84.2 | 7.5–32.2 | 45–211 |
| Heavy only / competent | 32.30–33.25 | 42.33–45.37 | 5708–5843 / 841–915 | 143.1–159.6 | 18.5–40.2 | 69–236 |
| Heavy only / slower | 32.30–39.17 | 42.82–52.15 | 5597–5803 / 838–996 | 176.9–202.9 | 23.6–54.8 | 130–239 |
| Speed only / competent | 32.87–33.82 | 44.78–52.65 | 3665–3711 / 841–915 | 63.4–66.6 | 6.4–24.9 | 39–209 |
| Speed only / slower | 33.87–39.53 | 45.18–54.38 | 3657–3710 / 838–996 | 76.0–84.4 | 6.8–30.8 | 46–211 |
| Combined / 6s / competent | 24.27–34.22 | 39.65–45.97 | 5717–5844 / 841–915 | 135.7–158.1 | 20.9–40.5 | 90–236 |
| Combined / 6s / slower | 33.97–38.67 | 43.73–52.75 | 5598–5760 / 838–996 | 178.7–210.8 | 24.8–56.3 | 132–250 |
| Full experiment / competent | 24.27–34.22 | 39.65–45.97 | 6955–7183 / 841–915 | 169.1–193.1 | 28.6–48.8 | 118–231 |
| Full experiment / slower | 33.97–38.67 | 43.73–52.75 | 6747–7044 / 838–996 | 246.3–345.0 | 33.2–100.6 | 155–288 |

Giant contributions remain separately recorded: each moving natural run earns 840 Survival Giant XP across seven admissions. Six Supply opportunities admit three natural crates; remaining full-inventory opportunities skip. Full-experiment natural runs admit 37–38 ordinary waves versus baseline 30, with no blocked opportunities for those moving policies. A full baseline Lv8+ wave offers 96 XP / 126 MG hits; the experiment offers 141 XP / 196 hits at Lv8–9 and 177 XP / 252 hits at Lv10. More Heavy workload increases earned XP, but Lv9 is not uniformly earlier: slower aim and backlog can postpone the two-MG upgrade. Lv10 generally arrives earlier. Earned XP after Lv10 is nominal combat reward, not usable further progression.

Absolute natural simulation timestamps (seconds; pre-Survival Lv1–7 is identical):

| Seed / pilot | Survival at | Lv7 | Lv8 baseline → experiment | Lv9 baseline → experiment | Lv10 baseline → experiment |
| --- | --- | --- | --- | --- | --- |
| 1 / competent | 121.92 | 110.92 | 131.28 → 131.28 | 155.73 → 156.08 | 173.97 → 167.67 |
| 17 / competent | 121.18 | 108.72 | 130.07 → 130.07 | 153.50 → 153.75 | 172.32 → 165.92 |
| 42 / competent | 122.65 | 110.87 | 132.02 → 132.02 | 156.22 → 156.87 | 174.75 → 168.62 |
| 99 / competent | 121.27 | 107.07 | 124.25 → 124.25 | 153.70 → 145.53 | 166.47 → 160.92 |
| 2026 / competent | 120.43 | 107.62 | 127.35 → 127.35 | 152.78 → 153.35 | 172.37 → 163.85 |
| 1 / slower | 120.43 | 113.05 | 136.52 → 136.52 | 158.80 → 159.10 | 174.23 → 173.18 |
| 17 / slower | 123.63 | 109.33 | 128.42 → 128.42 | 157.13 → 157.60 | 170.07 → 167.37 |
| 42 / slower | 122.18 | 111.37 | 138.05 → 138.05 | 162.07 → 160.50 | 175.40 → 174.07 |
| 99 / slower | 123.52 | 112.55 | 132.73 → 132.73 | 157.08 → 157.90 | 175.37 → 172.90 |
| 2026 / slower | 122.53 | 109.32 | 134.97 → 134.97 | 155.87 → 158.17 | 175.35 → 169.07 |

## The one-MG Lv8 bottleneck

196 required hits every six seconds demand 32.67 successful hits/s, exceeding one Stage III MG's 27 shots/s even before lane transitions and misses. This is a **transient backlog**, not evidence that a player must lose: killing cohorts and Giants increases XP and recruits the second/third MG. No weapon or difficulty values were changed to rescue a pilot.

| Candidate / pilot | First Lv8 cohort clear time (s) | Closest distance | Lv9 time (s) | Lv10 time (s) |
| --- | --- | --- | --- | --- |
| Baseline / competent | 7.65–11.03 | 34.05–34.60 | 21.73–22.18 | 42.03–42.23 |
| Baseline / slower | 6.97–15.12 | 32.01–35.08 | 21.48–23.27 | 42.10–42.23 |
| Heavy only / competent | 15.42–17.60 | 31.18–31.83 | 20.08–21.77 | 33.20–34.57 |
| Heavy only / slower | 15.58–21.55 | 28.49–31.70 | 19.83–23.42 | 34.27–37.28 |
| Speed only / competent | 7.58–10.75 | 32.49–33.28 | 21.05–22.68 | 42.03–42.23 |
| Speed only / slower | 6.85–12.72 | 30.88–33.93 | 21.47–23.78 | 42.10–42.23 |
| Combined / 6s / competent | 14.45–15.90 | 28.05–29.62 | 20.20–21.47 | 33.43–34.90 |
| Combined / 6s / slower | 14.88–16.67 | 26.60–29.26 | 19.93–30.30 | 33.83–39.75 |
| Full experiment / competent | 14.45–15.90 | 28.05–29.62 | 20.20–21.47 | 33.43–34.90 |
| Full experiment / slower | 14.88–16.67 | 26.60–29.26 | 19.93–30.30 | 33.83–39.75 |

The first full experimental Lv8 cohort offers 141 actual kill XP, versus 96 baseline. Cohort records retain the fraction killed and population remaining at the next level-up, theoretical arrival times at 20/10 and actual observed future loadout. The first experimental cohort clears before Lv9 for every moving seed; later admitted cohorts overlap the power upgrade. The slower seed-1 pilot reaches Lv9 at 30.30s (baseline 23.27s), illustrating the temporary overload; it still survives and reaches Lv10 at 39.75s (baseline 42.23s). First-cohort clearing at long range does not imply all later cohorts remain harmless.

For natural cohorts admitted at Lv8, the following counts show the **observed player level at the first theoretical unopposed arrival**. These clocks are retained even when the cohort was already killed; they are not counts of actual threatening survivors. All listed arrivals were observed before run end (zero censored here):

| Candidate / pilot | Boundary | Cohorts | Actual Lv8 / Lv9 / Lv10 | Lv+1 underestimates firepower |
| --- | --- | --- | --- | --- |
| Baseline / competent | 20 | 22 | 2 / 14 / 6 | 27.3% |
| Baseline / competent | 10 | 22 | 0 / 6 / 16 | 72.7% |
| Baseline / slower | 20 | 21 | 1 / 12 / 8 | 38.1% |
| Baseline / slower | 10 | 21 | 0 / 3 / 18 | 85.7% |
| Experiment / competent | 20 | 20 | 5 / 11 / 4 | 20.0% |
| Experiment / competent | 10 | 20 | 1 / 8 / 11 | 55.0% |
| Experiment / slower | 20 | 21 | 6 / 11 / 4 | 19.0% |
| Experiment / slower | 10 | 21 | 1 / 9 / 11 | 52.4% |

Faster approach narrows the progression window, but the simple Lv+1 budget still misses many 81Hz arrivals. Actual survivors/HP crossings above remain the evidence of danger; a forecast alone does not establish a casualty risk. No future knowledge is used by gameplay or pilot controls.

## Isolated levels and neglected lanes

| Start / candidate / pilot | Mean / peak active | Peak ≤20 / ≤10 | Cleared at >20 | Lv9 / Lv10 time (s) | Longest target gap (s) |
| --- | --- | --- | --- | --- | --- |
| lv7 / Baseline / competent | 20.0–22.6 / 78–90 | 0 / 0 | 100.0% | 45.68–47.30 / 62.53–63.45 | 3.03–3.40 |
| lv7 / Baseline / slower | 20.4–29.1 / 79–135 | 0 / 0 | 100.0% | 45.65–55.42 / 62.67–66.12 | 3.18–3.62 |
| lv8 / Baseline / competent | 17.4–18.2 / 51–63 | 0 / 0 | 100.0% | 21.73–22.18 / 42.03–42.23 | 3.17–3.42 |
| lv8 / Baseline / slower | 16.9–19.3 / 53–70 | 0 / 0 | 100.0% | 21.48–23.27 / 42.10–42.23 | 3.60–3.63 |
| lv9 / Baseline / competent | 15.2–15.5 / 42–60 | 0 / 0 | 100.0% | 0.00 / 27.38–28.15 | 3.17–3.42 |
| lv9 / Baseline / slower | 14.2–16.3 / 43–63 | 0 / 0 | 100.0% | 0.00 / 25.75–28.95 | 3.17–3.63 |
| lv10 / Baseline / competent | 14.5–14.9 / 42–49 | 0 / 0 | 100.0% | — / 0.00 | 3.18–3.55 |
| lv10 / Baseline / slower | 13.8–15.3 / 42–63 | 0 / 0 | 100.0% | — / 0.00 | 3.18–3.63 |
| lv7 / Full experiment / competent | 34.9–37.1 / 92–114 | 0 / 0 | 100.0% | 45.88–48.07 / 59.18–61.57 | 0.88–1.85 |
| lv7 / Full experiment / slower | 45.3–55.6 / 98–148 | 0–8 / 0 | 88.6–100.0% | 46.68–50.27 / 59.35–63.07 | 0.00–2.03 |
| lv8 / Full experiment / competent | 34.7–40.2 / 93–106 | 0 / 0 | 100.0% | 20.20–21.47 / 33.43–34.90 | 0.37–1.08 |
| lv8 / Full experiment / slower | 47.3–59.5 / 100–157 | 0–17 / 0 | 85.7–100.0% | 19.93–30.30 / 33.83–39.75 | 0.00–0.23 |
| lv9 / Full experiment / competent | 27.8–30.2 / 73–85 | 0 / 0 | 100.0% | 0.00 / 18.52–19.48 | 1.80–2.63 |
| lv9 / Full experiment / slower | 34.9–43.7 / 83–100 | 0 / 0 | 100.0% | 0.00 / 18.52–18.92 | 0.00–1.83 |
| lv10 / Full experiment / competent | 26.8–29.7 / 66–81 | 0 / 0 | 100.0% | — / 0.00 | 0.63–1.10 |
| lv10 / Full experiment / slower | 36.5–42.9 / 74–99 | 0 / 0 | 100.0% | — / 0.00 | 0.00–0.47 |

| Start / candidate | Game Over age (s) | Peak active | Peak ≤20 / ≤10 | Blocked ordinary slots |
| --- | --- | --- | --- | --- |
| lv7 / Baseline | 49.48–50.10 | 161–180 | 87–127 / 43–66 | 1–3 |
| lv8 / Baseline | 49.48–49.58 | 153–167 | 132–145 / 64–91 | 4–5 |
| lv9 / Baseline | 49.62–50.43 | 151–165 | 133–145 / 64–92 | 4–5 |
| lv10 / Baseline | 49.62–50.62 | 151–162 | 133–145 / 64–92 | 4–5 |
| lv7 / Full experiment | 49.48–50.10 | 161–180 | 87–127 / 43–66 | 1–3 |
| lv8 / Full experiment | 35.35–35.78 | 153–167 | 93–116 / 54–74 | 1–2 |
| lv9 / Full experiment | 35.45–36.02 | 151–165 | 93–116 / 56–75 | 1–2 |
| lv10 / Full experiment | 35.62–36.55 | 152–163 | 122–141 / 61–90 | 3–4 |

All isolated negligent pilots fail through ordinary real contact/casualties. Their failure at Lv7 remains about 49.5–50.1s because its profile is unchanged. Lv8+ speed shortens the failure window to about 35–36.6s. Fixed-lane Survival populations remain bounded; blocked opportunities are skipped. No soldiers are silently restored or enemies deleted. Full-experiment competent isolated Lv10 averages 26.8–29.7 enemies versus baseline 14.5–14.9; slower Lv10 averages 36.5–42.9. The cap-level experiment reduces target gaps and preserves satisfying 81Hz clearing, while ignored lanes remain dangerous.

## Mobile performance and evidence

| Viewport / profile | Mean / p95 frame (ms) | Maximum (ms) | >100 / >200 ms | Peak enemies / projectiles | Peak calls / triangles |
| --- | --- | --- | --- | --- | --- |
| 350 / baseline, fresh | 25.90 / 50.00 | 150.10 | 9 / 0 | 69 / 108 | 198 / 214304 |
| 350 / experiment, fresh | 41.48 / 66.70 | 250.10 | 11 / 2 | 105 / 107 | 220 / 326720 |
| 390 / baseline, fresh | 25.61 / 49.90 | 150.00 | 7 / 0 | 54 / 108 | 198 / 208170 |
| 390 / experiment, fresh | 40.84 / 66.70 | 216.60 | 11 / 1 | 112 / 108 | 220 / 359442 |

Mean increases **60.1% / 59.5%** at 350/390. The last 30s still costs **35.05 / 34.82ms** versus baseline **23.48 / 23.38ms**, with p95 **50.1ms** versus **33.4ms**. Thus the sustained difference is not only initial preparation. First 30s experimental means are 50.39/48.89ms; later windows improve. An earlier sequential same-renderer pair warmed the experiment's pools: means 39.06/38.35ms, p95 66.7/66.6ms. That corroborates the sustained cost but is excluded from fresh first-use claims. The reusable script now gives each profile a fresh renderer context.

All profiles plateau at **102 geometries / 12 textures**, and the projectile pool remains **128** with at most 108 live projectiles. Geometry/texture growth in fresh runs finishes around 30s, matching existing Giant/effect preparation; no continuing leak or new network asset request was observed. Experimental Heavy instance capacity rises 16→32 and body capacities 4→8, then stay bounded. Heavier bodies and pooled two-Sprite HP bars remain visually unchanged; extra crowd/triangle work correlates with the higher frame cost. There is no new material, shader or texture implementation.

The three >200ms frames occur at Survival ages **5.93s / 29.10s** (350, Lv8/Lv9) and **28.63s** (390, Lv9). All occur in the first 30s; none occurs in the final 60s. CPU submission in those current rows is 95.2/37.0/33.6ms, while another early 350 row takes 128.9ms. No call-stack or GPU timer trace was captured, so these measurements do not prove a shader-specific cause. The candidate fails the desired hitch/performance headroom in this profile; it remains experimental. Late rolling 120-frame step/render submission p95 is baseline 0.6/7.3ms → experiment 1.5/9.1ms at 350, and 0.6/6.3 → 1.3/7.1 at 390. These rolling CPU values are not whole-run GPU time.

Fresh baseline and experimental runs both begin with the same UI preparation and 65 geometries / nine textures. Baselines are in `artifacts/p3b6b1/browser/results.json`; fresh repeats are in `browser-fresh/results.json`. All samples advance approximately 90 simulation seconds, retain three living soldiers and have zero new asset requests. Existing startup remains one Defense GLB, approved decoded portraits/audio and the unchanged content-hashed game config; no additional production startup asset or renderer work is introduced.

Recordings and inspected frames, captured separately from timing: [350 baseline](artifacts/p3b6b1/browser/350-baseline.webm), [350 experiment](artifacts/p3b6b1/browser/350-experimental.webm), [390 baseline](artifacts/p3b6b1/browser/390-baseline.webm), [390 experiment](artifacts/p3b6b1/browser/390-experimental.webm). Each is 20s of real Lv8 combat. Paired `*-video-0/1/2.png` frames show 3/12/18s; `*-dev-menu.png` shows the touch panel. Visual inspection confirms the accepted Ink Spear/HUD/environment, readable Heavy HP bars and the greater Heavy presence. Phone performance and actual human lane management still require review.

Performance uses serial Chrome SwiftShader runs at 350×844 and 390×844, DPR1 and CPU4×: one fresh baseline and one fresh experimental 90-wall-second sample per viewport, plus an exploratory warmed experimental sample at each size. Runs begin at Lv8 seed17 with normal XP growth and the same frame-driven adjacent pilot. Recordings run separately from timing. Three 30-simulation-second windows expose within-run variance but are not independent replicates; additional independent repeats would be needed for a confidence interval. The browser pilot acts when a rendered frame reaches its next 200ms decision; very long frames may delay input compared with the exact offline pilot. Simulation age is recorded separately from wall time; background-gap clamping is not counted as faster gameplay. This does **not** measure a phone GPU, thermal behavior or device frame rate.

## DEV review and compatibility

Open DEV → **SURVIVAL TEST**. **BASELINE / EXPERIMENTAL** restart the currently selected Survival level; **LV7 / LV8 / LV9 / LV10** restart that level with the chosen profile. Both use seed17 and deterministic stream placement, normal weapons/projectiles/damage/XP, one immediate initial cohort, and normal recurring Giant/Supply opportunities. The panel closes after selection; Retry reconstructs the selected level/profile. Difficulty and level buttons retain their selected state. Levels can increase naturally during review. Pause and snapshot replay use ordinary app paths.

The existing main entries LATE / CRATE3 / CRATE8 / NAVAL and the separate five-button MG TEST remain unchanged. The new section is initially collapsed; 48px touch targets work at both mobile sizes, including a simulated 34px bottom safe area. Only DEV includes the factory, UI and candidate JSON. Production checks reject its markers, and shipped asset paths retain content addressing under /topwar/.

Historical three-Heavy Survival configs, eight-level MG plans, sequential Carnival→Destroyer saves and unstamped enemies remain valid without implicit migration. Saved experimental settings and per-enemy movement survive strict restore and deterministic continuation. Invalid speed stamps, Giant/legacy stamps and invalid profile levels/cadences are rejected. Existing inherited enemies are not retuned. Disabling Survival remains independent. New tests cover profile boundaries, real ordinary/Giant movement, casualties selecting by progression, blocked/missed deadlines, cap-level cadence changes, historical settings and all eight level/profile fixture combinations.

## Verification and remaining review

- Full tests: **156 files / 1164 tests pass**. Typecheck and production build pass.
- 375 matched deterministic cases pass; baseline artifacts preserved under ignored artifacts/p3b6b0/.
- Production browser: six startup/default/review cases and four Defense/Legacy cases pass at both mobile sizes. Natural production Lv1–10, Pause/Resume, Retry and snapshot continuation pass. Approved Observer portrait/audio bytes and one-bullet Defense loading are unchanged; Legacy loads its 13 models. No DEV UI or QA hooks ship.
- Touch review: eight level/profile selections at each viewport pass Pause, Retry and snapshot continuation. Existing MG/main button groups remain present.
- Existing MG TEST browser checks pass at both sizes, including exact 18 / 22.5 / 27 / 54 / 81Hz firing, real damage, Game Over → Retry, authored HUD and unchanged main entries.
- Six 90s browser timing runs and four separate recordings complete; resource counts plateau and no new assets are requested. The fresh experimental runs contain three >200ms frames, so the proposal is not promoted to production. Six exact QA hook edge cases pass against plain Simulation.

Reusable commands and definitions are in scripts/qa/README.md. Ignored artifacts/p3b6b1/ contains every raw cohort run, comparison.json, per-candidate analyses, browser resources/frame rows, screenshots and WebM recordings. Baseline artifacts are not overwritten. No asset, renderer, audio, weapon, targeting, collision, RNG or pre-Survival schedule was redesigned. No deploy or frozen-tag change. Stop for physical-phone review; no further balance tuning, recoloring, Air Drop, Tank Boss or P3-C.

Implementation commit: `813dab008d44bc02d33f34040d20cc3cb455ebe5`. This report is committed afterward so it can reference the validated implementation SHA.
