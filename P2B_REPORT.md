# P2B — Pressure Comeback

Historical phase evidence: measurements below used capacity 1. Current capacity is 3; the defense hint and standalone base-archetype review fixtures have been removed. See `PRE_RELEASE_REPORT.md` for current behavior and validation.

Starting HEAD, origin/main and live GitHub main were verified at
`4b337232bd2b4b58e913f1214841cf270e93f9a7`, with a clean worktree.
No deployment. This implements the requested initial targeting/ramp values;
the deterministic evidence does **not** establish that the Lv6 crowd shortage
is solved.

## Authored behavior

| Phase | Current-level XP | Future fronts | Heavy chance | Group population |
| --- | --- | --- | --- | --- |
| Lv4 power window | 0–62 / 180 | 3 | .25 | 24 |
| Lv4 comeback | ≥63 / 180 (35%) | 4 | .35 | 24 |
| Lv5 power window | 0–54 / 220 | 3 | .25 | 30 (existing 1.25×) |
| Lv5 comeback | ≥55 / 220 (25%) | 4 | .50 | 30 |

`public/game-data/game.json::catharsis.pressureRamp` owns the two stages.
`src/config/catharsisConfig.ts` validates fractions, chances and battlefield
front bounds. `src/simulation/enemies/latePressure.ts::pressureWaveSettings`
derives settings from the current serialized level/XP. `Simulation.ts::extendEnemyStream`
applies them only when admitting future groups through the existing seeded
`laneCompositionForRow` path. No latch, extra RNG, new director, retroactive
enemy edits or population/cadence adjustment. Heavy chance still means at most
one Heavy replacing the first Grunt in a group. A kill grant can jump over a
threshold; the following admission uses the resulting XP. Each new level resets
to its base power window, including Lv6. Older snapshot balances without the
optional ramp field retain their original future-wave composition.

`src/simulation/grenade.ts::grenadeTarget` now considers living defense enemies
in every lane on the active battlefield (the historical distance cap was removed in the r3 hotfix). Lowest world Z is
closest to the defense line; stable enemy ID breaks ties. Living enemies at or
just past player Z remain eligible and take priority over enemies still
approaching it. The local group is all living defense enemies inside radius 4
of that anchor. Its unweighted X/Z centroid is summed in ID order and captured
once. The captured urgent position is inside the resulting circle. Existing
flight and normal enemy movement continue; there is no homing or motion freeze.

Grenade capacity 1, damage 9 enemy HP, radius 4, no falloff, .65-second flight,
Lv3 +8-second one-hit Supply, Q/button request and ordinary XP remain
unchanged. HP, speeds, XP curve/rewards, weapons, soldier progression, cadence,
art/death/coastal presentation and audio startup remain unchanged. Giant stays
deferred to Lv7; no new weapon or archetype is introduced.

## Deterministic pressure evidence

Saved baseline: 100 runs, seeds 1–50 × normal/1.8-second Lv3 hesitation, historical
pilot with nearest-threat/supply decisions every 200 ms. Current diagnostics add
100 matching runs and 200 adjacent-lane control runs, for 400 recorded baseline
and current comparisons. Adjacent pilots permit one step per decision rather
than crossing several lanes in one frame. With/without-ramp adjacent runs both
use the same P2B emergency Grenade and the existing use policy. Near-defense
means approach depth ≤10; debt sums remaining enemy HP per lane. These are
diagnostics, not human-play guarantees.

Means below use runs reaching Lv6 for its timestamp/pressure:

| Pilot / balance | Reached Lv6 | Lv5 duration | Active at Lv6 | Near at Lv6 | Hit debt at Lv6 | Failures |
| --- | --- | --- | --- | --- | --- | --- |
| Historical pilot / starting baseline | 100/100 | 29.42s | 16.51 | 0 | 17.55 | 0 |
| Historical pilot / P2B | 100/100 | 28.10s | 15.36 | 0 | 16.48 | 0 |
| Adjacent pilot / P2B Grenade, ramp disabled | 97/100 | 28.65s | 15.61 | 0 | 16.47 | 3 |
| Adjacent pilot / full P2B | 97/100 | 27.26s | 16.19 | 0 | 18.20 | 3 |

In the adjacent comparison, Lv5 average peak Heavy overlap increases from
1.25 to 1.50; average peak debt rises from 85.07 to 87.30. Average Lv6 Heavy
overlap rises from .062 to .155, but nearest threat remains about 38.30 units
away, and every surviving run has zero near-defense enemies at Lv6. The same
three failures occur before Lv4 with and without the ramp: seed 29 hesitation
at 39.48s, seed 35 normal at 43.45s and seed 35 hesitation at 41.72s, all Lv3.
The ramp does not cause these failures.

Full P2B adjacent-pilot mean phase peaks (including runs that fail early) are:
Lv3 near/debt/Heavy 13.89 / 198.82 / 2.64; Lv4 4.59 / 165.90 / 2.37;
Lv5 .14 / 87.30 / 1.50. Lv3 still dominates measured near-line pressure.

Representative historical-pilot P2B timestamps, seconds from run start:

| Seed / pilot | Lv2 | Lv3 | Lv4 | Lv5 | Lv6 | Lv5 duration |
| --- | --- | --- | --- | --- | --- | --- |
| 1 normal | 9.33 | 26.63 | 51.03 | 71.88 | 100.18 | 28.30 |
| 1 hesitation | 9.33 | 26.63 | 49.72 | 70.68 | 100.18 | 29.50 |
| 17 normal | 12.93 | 30.23 | 51.18 | 72.67 | 99.02 | 26.35 |
| 17 hesitation | 12.93 | 30.23 | 49.65 | 71.45 | 99.02 | 27.57 |
| 42 normal | 10.97 | 26.95 | 47.65 | 69.67 | 92.57 | 22.90 |
| 42 hesitation | 10.97 | 26.95 | 47.65 | 69.67 | 92.57 | 22.90 |

All six have no casualties. Lv6 active counts are 14 / 23 / 20 for seeds
1 / 17 / 42, near-line counts all zero, and remaining per-lane debts are
[7,7,0,0,0] / [0,8,1,7,7] / [6,7,7,0,0].

The requested ramp adds attention pressure and modest Heavy debt but is
insufficient to create a strong natural Lv6 mowing crowd in these pilots.
More Heavies also yield ordinary 10 XP instead of the replaced Grunt's 1 XP,
which shortens progression without increasing group population. That tradeoff
is measured, not compensated by changing XP or other knobs. At a six-second
cadence, late Lv5's expected newly admitted debt is only 37 hits per group
(30 + 14 × .50), about 6.17 hits/second against three Rifles' 13.5 Hz.
Human attention may still make four fronts tense; this needs physical playtest.
Further pressure changes require a separate authored iteration, not hidden
population/HP/speed tuning in this task.

Natural P2B Grenade kills span 0–38 (mean 18.88) in the historical pilot,
with mean ordinary kill XP 19.69. Zero means the charge was not used before
the run reached Lv6. Adjacent pilots span 0–35 (mean 19.18), mean XP 20.35.

## Validation and review loop

- Full automated suite: **767 tests / 124 files passed**. Typecheck and production
  build pass. Existing dependency-annotation and bundle-size warnings remain.
- Focused tests cover nearest small cluster versus 30 distant Grunts, centroid
  weighting/ID ordering, captured urgent inclusion, at/behind-player eligibility,
  global shared Q/button guards, invalid charge preservation, unchanged damage/XP,
  threshold boundaries, level reset, generated population, unchanged enemies,
  old balance compatibility and JSON continuation across ramp admissions.
- Chrome portrait 390×844 / 350×844: empty selected lane + Q/touch Grenade clears
  three near Grunts for exactly three XP, Heavy survives at 6 HP, all 30 distant
  Grunts survive. In-flight snapshot continuation, Pause and normal Retry pass.
  Five repeated emergency bursts retain 74 geometries / 11 textures / 16 dust slots.
- Existing DEV Grenade Lab: representative throw clears 22/45 Grunts (48.9%) for
  22 XP; two Heavies take 9 HP and survive at 6, the third stays at 15. Repeated
  bursts retain 77 geometries / 11 textures / 16 dust slots. No enemy death VFX changes.
- EVOLVE/MG portrait and physical 5/6 checks pass; ordinary ten-kill evolution
  remains 1.00s, one specialist/HUD/first shots remain correct. Six alternating
  cycles retain 85 geometries / 11 textures / 32 projectile slots.
- Existing Tap-to-Start/native audio and production checks pass. Production
  contains no DEV Review, EVOLVE/MG controls or physical 5/6 handlers.
- One initial emergency browser run timed out because its manually frozen RAF
  had not refreshed the disabled HUD after unpausing. Advancing the harness's
  render frames resolved it; reruns pass. No runtime workaround was needed.

Commands and policy are documented in `scripts/qa/README.md`. Ignored artifacts
under `artifacts/p2b/` contain captures, baseline/current JSON, per-second pressure,
per-lane debt, ramp crossings and group admissions. Generated population is counted
at the authoritative stream ID boundary, separately from same-tick survivors.
The software renderer checks correctness/resource bounds, not physical-phone
frame time, audio feel or certification. Remaining human questions are emergency
throw timing and whether four-front late Rifle play supplies enough comeback
pressure and a satisfying crowd for the first natural Machine Gun.
