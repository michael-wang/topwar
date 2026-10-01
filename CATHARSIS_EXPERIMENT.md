# Phase 2.7: Overwhelm Threshold

This beachhead-defense prototype deliberately pushes visible Horde pressure to
find when one soldier cannot comfortably cover the assault. It creates the need
for future soldiers, upgrades, supplies or support without implementing them.
Performance is measured honestly but is not yet the design limiter. There is no
adaptive density, FPS-dependent gameplay or population reduction.

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

Each wave generates fifty members at its first row, every six rows. Seeded independent
lateral and depth samples have no unique slots, rows or count-dependent column length.
Overlap and occlusion are intentional human-wave presentation: members need no
personal space and there is no enemy-to-enemy collision avoidance. Lateral samples
stay inside each corridor and track bounds; depth is sampled in **[-5, 0]** units
relative to group entry, independently of population. Ten, fifty and one hundred
members occupy the same bounded volume. Adjacent groups may overlap too. Explicit lane identity
keeps targeting independent of crowd geometry. Priority lanes still persist across
three groups; the total group budget is split between one/two pressure lanes.
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
| `crowdDepthSpan` | 5 | Maximum beachward depth of every group, independent of population |
| `laneCount` | 5 | Configurable corridor count; try 3/4/5 |
| `edgeInset` | 0.4 | Centers span ±2.8 on a ±3.2 track; spacing 1.4 |
| `laneSwitchSeconds` | 0.15 | Time to traverse one lane spacing |
| `waveRows` | 6 | Group cadence: 3.6 world units at existing row spacing |
| `priorityWaves` | 3 | Groups before pressure lanes change |
| `groupSize` | 50 | Total members per group, including a possible Heavy; TUNE 10–100, step 5 |
| `secondLaneChance` | 0.4 | Chance of two priority lanes |
| `lateralSpreadFraction` | 0.26 | Maximum lateral offset as a fraction of lane spacing |
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
volume and **Enemies / wave** (10–100, step 5). Density changes only future groups:
active enemies remain untouched. Retry retains tuning and is the cleanest way to
refill the beach at a new density. Reset Defaults restores authored values. Lane
count, switch duration, entry horizon and crowd span are JSON controls. Balance,
including density/horizon/span, is serialized with stream cursors for deterministic
snapshot continuation. Legacy `groupRowStride`, `memberDepthSpacing`, `depthJitter`
and reward settings remain stored but inactive in this defense layout.

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
Assess that pressure and the 3 Hz rhythm before adding progression to compensate.

## Verification and phone playtest focus

Focused tests cover immediate stepping/clamping, hold delay/cadence/cancellation,
opposite direction, TUNE focus release, native editing and UI input isolation,
lane snapshot continuation, same-lane hits despite X spread, deterministic bounded
overlapping 10/50/100-member clusters, shoreline entry and unchanged legacy horizon,
future-group density tuning/snapshot continuation, fixed 15-hit Heavy health across
3/5/10 Hz, explicit live tuning, 1-HP Grunts, 3 Hz defaults, energetic gait, corrected
baked poses and protected asset hashes, side-wreckage bounds,
disabled streams/tier escalation and stationary beach presentation. Legacy system tests remain operational.

Phase 2.7 verification: **388 tests / 54 files pass**; typecheck and production
build pass. Asset baking/render geometry are unchanged in this phase.

Run `npm test`, `npm run typecheck` and `npm run build` before delivery. Mobile browser
evidence is kept locally under `artifacts/overwhelm-threshold/` at 390×844 with touch
enabled (390×693 gameplay area). Emulation does not replace a physical-phone test.
Evaluate corridor readability without bright markers, tap-release responsiveness,
the 150 ms switch, group readability near the horizon, and fixed tracer alignment
when enemies die before arrival.

Portrait evidence uses seed 17 followed by a tuned Retry (seed 18), DPR 2,
headless Chrome software rendering. Actual fixed-step gameplay is advanced by
12 seconds between live observations to inspect near/mid-beach crowds sooner;
no enemies are relocated, hidden or removed for screenshots. At roughly 24 seconds:

| Enemies / wave | Retry population | Active | Near ≤15 / mid 15–35 / far >35 | FPS | Avg / p95 frame ms | CPU step ms |
| --- | --- | --- | --- | --- | --- | --- |
| 10 | 70 | 95 | 25 / 45 / 25 | 35 | 28 / 33 | 0.1 |
| 50 | 350 | 492 | 137 / 211 / 144 | 10 | 97 / 117 | 0.4 |
| 100 | 700 | 1,027 | 288 / 438 / 301 | 5 | 186 / 217 | 1.0 |

All three densities run without browser errors; tuning leaves existing populations
intact, Retry uses the selected density, and mobile taps still step one lane.
Fifty/one hundred form an almost continuous overlapping helmet mass in pressure
corridors, while ten leaves individual bodies easier to distinguish. Natural
corridor openings and DEFEND remain readable, but overlapping ranks obscure faces
and interior Heavy bodies. Amber Heavy helmets remain visible where unobstructed;
they are easier to find near the front or shoreline than inside the mass.

Software rendering degrades severely at 100; these numbers do not establish phone
performance. Rendering/raster load is the apparent limitation (about 68k/340k/704k
triangles, with low measured JS simulation/render submission cost), without a GPU
profile proving a particular bottleneck or GC issue. No density or detail was reduced.
On a phone, evaluate sustained frame pacing, distinguishing pressure between lanes,
Heavy occlusion, and whether the dense assault makes support feel necessary rather
than simply producing visual congestion. The unchanged priority schedule can show
one strongly dominant corridor in a seeded moment; evaluate several runs.
