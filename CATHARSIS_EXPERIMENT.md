# Second Catharsis Loop experiment: beachhead defense

This prototype asks whether choosing a corridor to defend is fun by itself.
It does not implement the full Catharsis progression design. The first experiment's
readable Grunt/Heavy art and one/two-lane pressure remain; discrete lane selection
replaces continuous aiming.

## Controls and combat

A/D or Left/Right moves exactly one destination lane per press; key repeat and
holding do not steer. A tap released on the gameplay area's left/right half steps
one lane in that direction. Swipes are ignored. HUD, Pause, TUNE and Retry receive
their own input. The compact DEFEND label shows the selected lane immediately.
Pause stops gameplay input; Retry starts at the middle lane and retains live tuning.

The selected lane is plain serialized player state. Squad X approaches its center
in a configurable 0.15 seconds per lane. Rifle projectiles carry the lane selected
when fired, so changing lanes does not redirect existing shots. Swept forward
collision checks hit enemies of that lane regardless of small lateral offsets.
Tracers take a fixed trajectory toward the nearest same-lane enemy at firing time;
they do not home. An enemy killed before a tracer arrives can leave a tracer that
hits another member without perfect visual alignment. Evaluate this presentation.

Each wave generates a loose cluster at its first row. Seeded per-member lateral
offsets and staggered depths replace single-file queues. Members remain within
their corridor and carry explicit lane identity. Priority lanes still persist across
three groups; the total group budget is split when there are two priority lanes.

## Runtime tuning

Edit `public/game-data/game.json` and reload to change authored values; no production
rebuild is needed. The `catharsis` values are included in simulation snapshots.

| Value | Initial setting | Meaning |
| --- | --- | --- |
| `defenseMode` | true | Temporarily enables this focused experiment |
| `laneCount` | 5 | Configurable corridor count; try 3/4/5 |
| `edgeInset` | 0.4 | Centers span ±2.8 on a ±3.2 track; spacing 1.4 |
| `laneSwitchSeconds` | 0.15 | Time to traverse one lane spacing |
| `waveRows` | 12 | Group cadence: 7.2 world units at existing row spacing |
| `priorityWaves` | 3 | Groups before pressure lanes change |
| `groupSize` | 4 | Total members per group, including a possible Heavy |
| `secondLaneChance` | 0.4 | Chance of two priority lanes |
| `lateralSpreadFraction` | 0.26 | Maximum lateral offset as a fraction of lane spacing |
| `memberDepthSpacing` | 0.85 | Depth between loose member pairs |
| `depthJitter` | 0.35 | Seeded positive/negative depth jitter |
| `heavyChance` | 0.25 | Chance of one Heavy replacing the first group member |
| `gruntSpeed` | 0.8 | Approach speed plus internal forward progression |
| `heavySpeed` | 0.3 | Slower Heavy approach speed |
| `heavyHp` | 5 | Five base Rifle hits; Grunt remains exactly 1 HP |
| `enemyVisualScale` | 1.4 | Retained enlarged Grunt model |
| `heavyVisualScale` | 1.35 | Relative multiplier; Heavy model scale 1.89 |

`weapon.rifle.fireRate` is **5 shots/second**. TUNE keeps Fire rate, enemy scale,
Grunt speed, Heavy HP/speed/frequency, bullet speed/range, approach pace and music
volume. Reset Defaults restores authored values. Enemy lookahead remains 96 units,
so Retry is the quickest way to see frequency changes in nearby groups. Lane count,
switch duration and cluster layout are JSON controls. Legacy `groupRowStride` and
reward settings remain stored but are inactive in defense mode.

## Presentation and temporarily disabled systems

Defenders stand at the bottom of a sandy beach, with sea and broken shoreline
toward the upper battlefield. Staggered crossed obstacles and muted sand scuffs
suggest corridor openings. Bridge road, rails, road markings and bright corridor
lines are hidden. Existing generic industrial silhouettes, smoke, ships and aircraft
remain. Simulation still advances internally in Z; rendering subtracts player Z
and holds the environment fixed so the player reads as defending a position.

Boss spawning/showdown, normal enemy tier escalation, the ENEMY LV HUD and yellow
recruitment rewards are temporarily disabled. Their implementations remain available
outside defense mode. Irrelevant TUNE controls are hidden. Merge, tier power,
penetration, casualties and higher-tier infrastructure are retained without redesign;
the authored run starts with one soldier and no rewards to grow the squad.

No XP, upgrades, additional weapons/enemies, backend, framework or deployment.
The single-soldier opening is unforgiving: a missed lane can end the run quickly.
Assess that pressure and the 5 Hz rhythm before adding progression to compensate.

## Verification and phone playtest focus

Focused tests cover one-step input/clamping, repeat suppression, UI input isolation,
lane snapshot continuation, same-lane hits despite X spread, deterministic bounded
clusters, Grunt/Heavy health, 5 Hz defaults, disabled streams/tier escalation and
stationary beach presentation. Legacy system tests remain operational.

Run `npm test`, `npm run typecheck` and `npm run build` before delivery. Mobile browser
evidence is kept locally under `artifacts/beachhead-defense/` at 390×844 with touch
enabled (390×693 gameplay area). Emulation does not replace a physical-phone test.
Evaluate corridor readability without bright markers, tap-release responsiveness,
the 150 ms switch, group readability near the horizon, and fixed tracer alignment
when enemies die before arrival.

Delivery verification: 363 tests in 54 files passed, as did typecheck and production
build. Existing dependency annotation and bundle-size warnings remain. The portrait
browser check exercised tap stepping/clamping, repeat-free keys, Pause, live TUNE,
Reset Defaults, natural Game Over and Retry, with no browser errors. After Retry,
the middle lane was restored and taps worked. The run contained only Tier-1 normal
enemies, no Boss and no recruitment rewards. Local emulation is not a claim of
physical-phone performance.
