# Phase 2.6: Lane Commitment + Assault Presentation

This beachhead-defense prototype tests whether a durable Heavy creates a meaningful
lane commitment while other crowds continue advancing. Horde population, pressure
lanes, speed, targeting and input are held at Phase 2.5 settings. No progression is
added to compensate for a weak loop.

Heavy has a fixed authored **15 base Rifle-hit HP**, with explicit live TUNE edits
up to **40**. It never scales itself from Rifle fire rate, DPS, squad size or weapon
power. Grunt stays exactly **1 HP**. Uninterrupted single-soldier fire needs 15 hits:
roughly five seconds at a manually tuned 3 Hz or three seconds at the authored 5 Hz,
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

Each wave generates ten members at its first row, every six rows. Seeded independent
lateral and depth samples replace paired depth slots, avoiding marching rows/queues.
Overlap and occlusion are intentional human-wave presentation: members need no
personal space and there is no enemy-to-enemy collision avoidance. Lateral samples
stay inside each corridor and track bounds; depth is bounded by the configured
cluster span plus jitter. Adjacent groups may overlap too. Explicit lane identity
keeps targeting independent of crowd geometry. Priority lanes still persist across
three groups; the total group budget is split between one/two pressure lanes.
The old group-row fit validation is only applied outside defense mode.

## Runtime tuning

Edit `public/game-data/game.json` and reload to change authored values; no production
rebuild is needed. The `catharsis` values are included in simulation snapshots.

| Value | Initial setting | Meaning |
| --- | --- | --- |
| `defenseMode` | true | Temporarily enables this focused experiment |
| `laneCount` | 5 | Configurable corridor count; try 3/4/5 |
| `edgeInset` | 0.4 | Centers span ±2.8 on a ±3.2 track; spacing 1.4 |
| `laneSwitchSeconds` | 0.15 | Time to traverse one lane spacing |
| `waveRows` | 6 | Group cadence: 3.6 world units at existing row spacing |
| `priorityWaves` | 3 | Groups before pressure lanes change |
| `groupSize` | 10 | Total members per group, including a possible Heavy |
| `secondLaneChance` | 0.4 | Chance of two priority lanes |
| `lateralSpreadFraction` | 0.26 | Maximum lateral offset as a fraction of lane spacing |
| `memberDepthSpacing` | 0.85 | Cluster span unit: floor((groupSize − 1) / (2 × pressure lanes)) × this value |
| `depthJitter` | 0.35 | Seeded positive/negative depth jitter |
| `heavyChance` | 0.25 | Chance of one Heavy replacing the first group member |
| `gruntSpeed` | 0.25 | Approach speed plus internal forward progression |
| `heavySpeed` | 0.12 | Slower Heavy approach speed |
| `heavyHp` | 15 | Fixed base Rifle-hit durability; TUNE range 2–40; Grunt stays 1 HP |
| `enemyVisualScale` | 1.4 | Retained enlarged Grunt model |
| `heavyVisualScale` | 1.35 | Relative multiplier; Heavy model scale 1.89 |

`player.forwardSpeed` (Approach pace) is **0.6 units/second**. Effective closing
speeds are initially 0.85 for Grunts and 0.72 for Heavies.
`weapon.rifle.fireRate` stays **5 shots/second**. TUNE keeps Fire rate, enemy scale,
Grunt speed, Heavy HP/speed/frequency, bullet speed/range, approach pace and music
volume. Reset Defaults restores authored values. Enemy lookahead remains 96 units,
so Retry is the quickest way to see frequency changes in nearby groups. Lane count,
switch duration and cluster layout are JSON controls. Legacy `groupRowStride` and
reward settings remain stored but are inactive in defense mode.

## Presentation and temporarily disabled systems

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
Assess that pressure and the 5 Hz rhythm before adding progression to compensate.

## Verification and phone playtest focus

Focused tests cover immediate stepping/clamping, hold delay/cadence/cancellation,
opposite direction, TUNE focus release, native editing and UI input isolation,
lane snapshot continuation, same-lane hits despite X spread, deterministic bounded
overlapping dense clusters, preserved population, fixed 15-hit Heavy health across
3/5/10 Hz, explicit live tuning, 1-HP Grunts, 5 Hz defaults, energetic gait, corrected
baked poses and protected asset hashes, side-wreckage bounds,
disabled streams/tier escalation and stationary beach presentation. Legacy system tests remain operational.

Run `npm test`, `npm run typecheck` and `npm run build` before delivery. Mobile browser
evidence is kept locally under `artifacts/lane-commitment/` at 390×844 with touch
enabled (390×693 gameplay area). Emulation does not replace a physical-phone test.
Evaluate corridor readability without bright markers, tap-release responsiveness,
the 150 ms switch, group readability near the horizon, and fixed tracer alignment
when enemies die before arrival.

Phase 2.6 delivery verification: 382 tests across 54 files pass, as do typecheck
and production build. The character bake completes, and a second clean bake
reproduces all 21 GLBs byte-for-byte. Player, Boss and shared equipment assets
retain their previous hashes.

Portrait browser checks inspect all four near-front Grunt/Heavy run poses,
contact/death geometry and the full overlapping crowd. Heavy tuning to 40/reset
to 15, keyboard input after TUNE, mobile stepping, Pause, Game Over and Retry
work. A small Retry fix clears old artillery/flak sprites when presentation time
rewinds instead of extrapolating their flash opacity into the past.

A representative live moment has 175–177 active enemies and approximately
24–25 FPS at DPR 2 using headless Chrome software rendering; simulation steps
cost about 0.1 ms and frame p95 is about 50 ms. These numbers are not physical
phone performance or a GC diagnosis. On a phone, evaluate sustained crowd frame
pacing, whether 15-hit Heavy commitment at roughly 3 Hz makes neglected lanes
costly, and whether the 360 ms gait reads as urgent rather than sliding/comical.
