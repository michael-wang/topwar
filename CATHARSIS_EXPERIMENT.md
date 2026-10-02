# Phase 2.8: Readable Multi-Lane Pressure

This beachhead-defense prototype tests the naked combat target:
**one defended normal lane is manageable, all active lanes are not**.
Twenty-four members attack three coherent fronts per wave. Wider/deeper crowds
should read as individuals and make repeated gray-rise kills visible, while
unattended lanes accumulate. The 15-hit Heavy remains the successful tactical
priority threat. No progression or support is added to compensate for the loop.
Performance is measured, with no adaptive density or FPS-dependent gameplay.

Heavy has a fixed authored **15 base Rifle-hit HP**, with explicit live TUNE edits
up to **40**. It never scales itself from Rifle fire rate, DPS, squad size or weapon
power. Grunt stays exactly **1 HP**. Uninterrupted single-soldier fire needs 15 hits:
roughly five seconds at the authored 3 Hz,
including small projectile/cooldown timing differences. Later power can outgrow it.

## Controls and combat

A/D or Left/Right immediately steps one destination lane. Holding repeats after
350 ms, then every 220 ms using one input timer; OS repeat events do not determine
cadence. Timings are localized in `src/input/LaneStepInput.ts`. The latest pressed
key owns the hold, including opposite-direction presses with a fresh delay.
Releasing it does not resume an older held key. Reaching an edge stops scheduling;
key-up, focus entering a HUD control, window blur, Pause/stop and Retry clear timers.

Mobile remains one tap released on the gameplay area's left/right half = one lane.
Swipes and mobile holds do not steer. HUD, Pause, TUNE and Retry receive their own
input. The compact DEFEND label shows the selected lane immediately. Retry starts
at the middle lane and retains live tuning.

TUNE previously left focus on a hidden slider after closing, so lane input correctly
ignored keys targeting that slider. Closing TUNE now blurs focus inside the panel:
synchronously for Escape/programmatic close and on native details-toggle close.
Arrow-key range/select editing remains native while open; no battlefield click is
required after closing. Focus outside the panel is preserved.

The selected lane is plain serialized player state. Squad X approaches its center
in a configurable 0.15 seconds per lane. Rifle projectiles carry the lane selected
when fired, so changing lanes does not redirect existing shots. Swept forward
collision checks hit enemies of that lane regardless of small lateral offsets.
Tracers take a fixed trajectory toward the nearest same-lane enemy at firing time;
they do not home. An enemy killed before a tracer arrives can leave a tracer that
hits another member without perfect visual alignment. Evaluate this presentation.

Each wave generates twenty-four members at its first row, every six rows. Seeded independent
lateral and depth samples have no unique slots, rows or count-dependent column length.
Overlap and occlusion are intentional human-wave presentation: members need no
personal space and there is no enemy-to-enemy collision avoidance. Lateral samples
stay inside each corridor and track bounds; depth is sampled in **[-9, 0]** units
relative to group entry, independently of population. Ten, twenty-four and sixty
members occupy the same bounded volume. Adjacent groups may overlap too. Explicit lane identity
keeps targeting independent of crowd geometry. Priority lanes still persist across
three groups; the total group budget is divided round-robin between three distinct
seeded fronts (8/8/8 at the authored density). This count is defense-only config;
legacy non-defense behavior retains its one/two fronts.
The old group-row fit validation is only applied outside defense mode.

Defense stream lookahead is **53 units** ahead of the standing defender, near the
existing shoreline foam at Z≈52.8. Group anchors enter at the next authored stream
row boundary; members are sampled beachward only, so no member of a new group is
placed beyond the entry horizon. Initial runs prefill the authored stream from
Z=30 to that horizon; subsequent groups emerge at the shoreline. The legacy
non-defense stream retains its 96-unit horizon and original layout.

## Runtime tuning

Edit `public/game-data/game.json` and reload to change authored values; no production
rebuild is needed. The `catharsis` values are included in simulation snapshots.

| Value | Initial setting | Meaning |
| --- | --- | --- |
| `defenseMode` | true | Temporarily enables this focused experiment |
| `defenseSpawnAheadDistance` | 53 | Defense-only entry/lookahead distance in world units |
| `crowdDepthSpan` | 9 | Maximum beachward depth of every group, independent of population |
| `laneCount` | 5 | Configurable corridor count; try 3/4/5 |
| `edgeInset` | 0.4 | Centers span ±2.8 on a ±3.2 track; spacing 1.4 |
| `laneSwitchSeconds` | 0.15 | Time to traverse one lane spacing |
| `waveRows` | 6 | Group cadence: 3.6 world units at existing row spacing |
| `priorityWaves` | 3 | Groups before pressure lanes change |
| `groupSize` | 24 | Total members per group, including a possible Heavy; TUNE 10–60, step 2 |
| `pressureLaneCount` | 3 | Distinct pressure fronts per block; runtime-loaded JSON, 1–laneCount |
| `lateralSpreadFraction` | 0.42 | Maximum lateral offset as a fraction of lane spacing |
| `heavyChance` | 0.25 | Chance of one Heavy replacing the first group member |
| `gruntSpeed` | 0.25 | Approach speed plus internal forward progression |
| `heavySpeed` | 0.12 | Slower Heavy approach speed |
| `heavyHp` | 15 | Fixed base Rifle-hit durability; TUNE range 2–40; Grunt stays 1 HP |
| `enemyVisualScale` | 1.4 | Retained enlarged Grunt model |
| `heavyVisualScale` | 1.35 | Relative multiplier; Heavy model scale 1.89 |

`player.forwardSpeed` (Approach pace) is **0.6 units/second**. Effective closing
speeds are initially 0.85 for Grunts and 0.72 for Heavies.
`weapon.rifle.fireRate` starts at **3 shots/second**, with unchanged base damage. TUNE keeps Fire rate, enemy scale,
Grunt speed, Heavy HP/speed/frequency, bullet speed/range, approach pace and music
volume and **Enemies / wave** (10–60, step 2). Density changes only future groups:
active enemies remain untouched. Retry retains tuning and is the cleanest way to
refill the beach at a new density. Reset Defaults restores authored values. Lane
count, switch duration, entry horizon and crowd span are JSON controls. Balance,
including density/horizon/span, is serialized with stream cursors for deterministic
snapshot continuation. Legacy `secondLaneChance`, `groupRowStride`, `memberDepthSpacing`, `depthJitter`
and reward settings remain stored but inactive in this defense layout.

## Presentation and temporarily disabled systems

Gray-rise kill presentation keeps the existing reusable 48-body pool and small
burst, with no new VFX system. Lifetime is **320 → 600 ms**. Immediate pop is
**0 → 0.25 world units**, followed by a front-loaded eased **1.65-unit** rise,
for **1.9 total** versus the old linear **0.55**. Bodies retain full opacity for
180 ms (previously about 70 ms), then fade over 420 ms. At 300 ms their feet are
about 1.49 units above the ground at 71% opacity, clearing nearby normal heads.
Scale shrink and gray materials remain. At 3 Hz this normally means one/two
simultaneous deaths, not a long-lived confetti cloud. Timing lives in the pure
presentation helper `src/presentation/EnemyDeathTiming.ts`; collision/simulation
and snapshots do not depend on it.

Normal Grunt and Heavy assets now reuse the proven Boss helmet-occlusion rule.
The original Archer cap was already stripped, but upper brown hair and side scalp
still protruded through the helmet. UV-identified hidden surfaces are removed or
clipped at model Y=0.725, preserving lower side/back hair, face, ears and neck.
Corrected files: normal idle body, gray death body and all four run frames. Normal
contact uses corrected idle geometry; hit flashes use corrected active run frames.
Player, all Boss files and shared helmet/gear remain byte-identical.

Visual gait changes only presentation: cycle **500 → 360 ms**, frame step
**125 → 90 ms**, baked limb rotations **1.18×**, pose swing **0.35 → 0.43 rad**,
maximum bob **0.038 → 0.052 model units**, and base forward lean
**0.11 → 0.15 rad**. Existing per-enemy phase offsets remain. Gait is independent
of enemy velocity; simulation speeds stay **0.6 / 0.25 / 0.12**.

Six cheap broken pieces per pile form three concrete/machinery/steel wreckage piles
on each side of the beach. They use shared box geometry and two instanced draw calls,
with staggered depths and muted concrete/steel/rust colors. Every piece stays at
least 0.4 units outside the configured track; nothing adds collision/pathfinding.
The central five approaches, player and nearest outer-lane enemies remain clear.
Existing shoreline, smoke, fire and distant atmosphere remain unchanged.

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
Assess that pressure and the 3 Hz rhythm before adding progression to compensate.

## Verification and phone playtest focus

Focused tests cover deterministic three-front priority blocks, exact 8/8/8 budgets,
legal widened lane X bounds and bounded nine-unit depths across density settings,
53-unit defense entry/unchanged legacy horizon, runtime density and snapshot
continuation, 1-HP Grunts, fixed 15-hit Heavies, 3 Hz Rifle, death pop/rise/fade,
and preserved input/exclusions. Normal-lane holdability is checked across four
seeds with Grunt-only composition: continuous fire holds the selected front while
unattended fronts accumulate and eventually cause the fatal leak. The full live
browser run retains sparse Heavies and the authored settings.

The authored wave interval remains six seconds: 3.6 world units / 0.6 internal
approach pace. Eight members/front means 1.33 incoming members/sec versus 3 Rifle
hits/sec. Combined inflow is 4 members/sec before Heavy extra durability. This is
fixed authored balance, not runtime DPS scaling. Initial horizon prefill, priority
handoffs and depth overlap can create bursts; a neglected/Heavy lane may still
become impossible. Other lanes are never cleared automatically.

Run `npm test`, `npm run typecheck` and `npm run build` before delivery. Portrait
browser evidence stays locally in `artifacts/multi-lane-pressure/` at 390×844,
touch enabled and DPR 2. Physical-phone focus: whether a normal lane feels
holdable, whether three fronts force attention changes, how clearly amber Heavies
interrupt that rhythm, and whether raised gray bodies make repeated kills visible
without obscuring the next target. The pressure count stays JSON-only to keep
TUNE narrow; density, Heavy HP/frequency, speeds, Rifle rate and approach pace
remain usable controls. Density changes future groups only; Retry refills.

Delivery checks: 396 tests across 55 files pass, as do typecheck and production
build. Assets/bake pipeline, shoreline, wreckage and gait are unchanged.

Portrait browser evidence uses seed 17, then a normal tuned Retry at seed 18,
390×844 touch viewport, DPR 2 and Chrome software rendering. The authored run
starts with 168 enemies. Holding lane 3 (zero-based 2) for about 21 seconds leaves
the soldier alive: its population falls 56→18 and nearest enemy is ~33.6 units
away. Unattended totals grow 112→160; the closest front reaches ~4.1 units.
Sparse Heavies remain 15 HP, with amber helmets visible in the upper crowds.
The scene retains individual foreground faces and broad loose fronts, though
neglected ranks still overlap substantially and the horizon remains crowded.

Raised gray bodies are visible above living helmets in consecutive live captures;
sample death heights are ~0.43 and ~1.65 units, at full and ~56% opacity.
No enemies are relocated, hidden or culled for screenshots. Around this moment,
active population is 178–199, FPS ~21–22, average frame ~46–47 ms, p95 ~50–67 ms,
and simulation CPU step ~0.1 ms. These software-rendering numbers do not establish
physical-phone performance and did not drive a further density reduction.

TUNE density 60 changes future composition without mutating the 168 active enemies;
reset returns to 24. Keyboard works immediately after closing TUNE. Pause blocks
lane taps; resume accepts one lane per tap. Natural Game Over and Retry work,
with Retry retaining 24 and returning to the middle lane. No browser errors.
Evaluate whether the successful held-lane clearance stays satisfying during
Heavy commitment and whether deaths remain visible without distracting from the
next lane decision on a physical phone.
