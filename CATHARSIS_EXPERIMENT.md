# First Catharsis Loop experiment

This prototype tests lane decisions and readable larger combat only. The supplied
Catharsis design SPEC is direction, not an implementation checklist.

## Initial tuning

Runtime-loaded `public/game-data/game.json`, under `catharsis`:

| Value | Initial setting | Meaning |
| --- | --- | --- |
| `laneCount` | 5 | Try 3, 4 or 5; no renderer positions are hard-coded |
| `edgeInset` | 0.4 | Centers span ±2.8 on a ±3.2 track; spacing is 1.4 |
| `waveRows` | 12 | One group every 7.2 world units at existing 0.6 row spacing |
| `priorityWaves` | 3 | Keep the same one/two pressure lanes across three groups |
| `groupSize` | 4 | Total group budget, split across lanes when there are two |
| `groupRowStride` | 2 | 1.2 world units between members; group must fit the wave |
| `secondLaneChance` | 0.4 | Chance of two priority lanes in a pressure block |
| `heavyChance` | 0.25 | Chance of one Heavy replacing the first member of a group |
| `gruntSpeed` | 0.8 | Approach speed in world units/second, in addition to player advance |
| `heavySpeed` | 0.3 | Heavy approach speed |
| `heavyHp` | 5 | Five initial normal rifle hits; Grunt HP is always exactly 1 |
| `enemyVisualScale` | 1.4 | About 71% larger than the previous 0.82 model scale |
| `heavyVisualScale` | 1.35 | Relative multiplier: initial Heavy scale is 1.89 |
| `rewardAimRadius` | 0.5 | Maximum squad-center distance from a crate lane for hits |

TUNE applies visual size and movement to active enemies, Heavy HP by remaining
health fraction, and Heavy chance to future groups. Retry retains slider values;
Reset Defaults restores them. Because enemy lookahead is still 96 units, Retry
is the quickest way to see a new Heavy-frequency setting in nearby waves.
Lane count, group density/spacing, priority duration and the Heavy relative size
are JSON controls: edit the table's values and reload, without a production rebuild.
Configuration rejects groups that do not fit a wave and lanes outside track bounds.
Rewards initially use one per 12-row block; the existing reward-density slider
can override that temporarily. The level JSON still owns row spacing, lookahead,
tier colors and unchanged Boss row formulas.

## Preserved contracts and limitations to playtest

- Gameplay uses seeded block/row generation independent of gameplay RNG, fixed
  stepping, narrow simulation APIs and JSON-only snapshots. Serialized experiment
  balance plus archetypes reproduces future spawning after restore.
- Both normal archetypes retain radius 0.30. Enlarging their art does not enlarge
  the hit corridor or cause neighboring-lane collisions. Full steering clamps
  to the outer corridor; movement between corridors stays continuous.
- Quiet-lane crates use the existing ten-hit reinforcement system. Squad-center
  alignment prevents distant formation-edge shots from granting incidental rewards.
  Rewards avoid the squad lane at spawn. With three lanes, a pressured lane is used if the only quiet lane is already defended. Adjacent blocks can bring later threats.
- Normal archetype damage is measured in initial rifle-hit units (existing rifle
  damage divided by Tier-1 power). Bosses retain original projectile damage/HP,
  cadence, melee and pause behavior. Merge remains 10-to-1, with all tier power,
  penetration, formation and casualty rules intact.
- Consequently, higher-tier rifles can one-shot Heavies, high-tier contacts/leaks
  retain large exchange-value losses, and the old single-soldier opening still
  punishes a missed lane. These are deliberate constraints of retaining progression;
  evaluate mowing rhythm, readability and positioning before changing progression.
- Several pressure blocks can be visible at the retained long enemy horizon;
  holding priorities for three groups reduces lane churn, but phone playtests
  should assess whether the closest one/two threats remain obvious.
- No XP, new weapons/buttons/framework/backend, Merge redesign or Boss redesign.

## Verification

Simulation tests cover seeded composition, priority/quiet lanes, bounds with
3/4/5 lanes, Grunt one-hit and Heavy five-hit health, live tuning, reward aim,
outer-lane steering, JSON snapshot continuation and retained Boss showdown damage.
Renderer/control tests cover configured scales, Heavy identification/deaths,
dynamic corridor count, all experiment sliders and Reset Defaults. Run `npm test`,
`npm run typecheck` and `npm run build` before delivery.

Mobile browser checks use a 390×844 touch-enabled portrait Chrome viewport
(390×693 gameplay area at 9:16). Screenshots and detailed local check output
are kept under `artifacts/catharsis-loop/`; these are playtest evidence, not
deployment artifacts. Browser emulation does not replace a physical-phone test.

Delivery checks: 351 tests in 51 files passed; typecheck and production build
passed. Build retains dependency annotation and large-bundle warnings. The mobile
check exercised touch drag to a crate, confirmed recruitment and crate removal,
Pause/Resume, a live size edit, Reset Defaults and Retry, with no browser errors.
The short emulated run reported roughly 60 FPS with about 30–40 active enemies;
this is local browser evidence, not a physical-phone performance claim.
