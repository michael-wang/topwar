# Phase 2.9: Combat Baseline Lock

The naked beachhead-defense combat baseline is now accepted:
**one defended normal lane is manageable, all active lanes are not**.
Twenty-four members attack three coherent fronts per wave. Wider/deeper crowds
read as individuals and make repeated gray vaporization kills visible, while
unattended lanes accumulate. The 15-hit Heavy remains the successful tactical
priority threat. No progression or support is added to compensate for the loop.
Phase 2 is ready for progression work; this task adds no XP/progression. Phase 2.8 pressure, archetype gameplay and environment are frozen. Only death/Heavy presentation and keyboard hold cadence change. Performance remains measured without adaptive density.

Heavy has a fixed authored **15 base Rifle-hit HP**, with explicit live TUNE edits
up to **40**. It never scales itself from Rifle fire rate, DPS, squad size or weapon
power. Grunt stays exactly **1 HP**. Uninterrupted single-soldier fire needs 15 hits:
roughly five seconds at the authored 3 Hz,
including small projectile/cooldown timing differences. Later power can outgrow it.

## Controls and combat

A/D or Left/Right immediately steps one destination lane. Holding repeats after
180 ms, then every 120 ms using one input timer; OS repeat events do not determine
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
| `heavyVisualScale` | 1.35 | Retained Heavy base scalar: 1.89 |
| `heavyWidthMultiplier` | 1.05 | Complete model X multiplier: final 1.9845 |
| `heavyHeightMultiplier` | 1.15 | Complete model Y multiplier: final 2.1735 |
| `heavyDepthMultiplier` | 1.15 | Complete model Z multiplier: final 2.1735 |

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

Gray vaporization reuses the existing capped 48-body pool and DeathBurst. Lifetime
is **600 → 480 ms**, immediate pop **0.25 → 0.12 units**, additional eased rise
**1.65 → 0.60**, and maximum height **1.9 → 0.72**. Opacity stays full for 120 ms,
then fades over 360 ms. Death size shrinks **1.07 → 0.55** of the complete live
body scale, versus the old subtle **1.07 → 0.97** shrink. Gray body/gear remain;
the short yellow confirmation stays. This is a low pop, shrink and dissolve,
with no upward spirit-like flight. Pure timing remains in
`src/presentation/EnemyDeathTiming.ts`, independent of simulation/collision.

Heavy uses non-uniform complete-model proportions, including body/helmet/vest,
contact reaction, hit display and pooled death. Relative to the unchanged 1.4
Grunt scale, Heavy is **1.4175× wide / 1.5525× tall / 1.5525× deep**. Final XYZ
scales are **1.9845 / 2.1735 / 2.1735**. The baked swinging arms already have a
broader envelope than the torso/helmet: measured run widths are ~1.49–1.62 world
units on 1.4-unit lane spacing; helmet width is ~1.36 (~97% of one lane). This
uses visual judgment instead of forcing the entire arm envelope into an 80–90%
width target and producing a tall skinny Heavy. The silhouette reads as one
large corridor obstacle, rather than a multi-lane giant. Width/depth shadow
footprint follows the new axes (~1.65×1.11), without height inflating the stamp.
Grunts stay at 1.4, and Heavy HP=15, additional speed=0.12, lane/position/damage
and collision radius=0.30 remain unchanged. New multipliers are catharsis JSON;
snapshot defaults of 1 preserve old visual proportions. No assets were rebaked.

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

Delivery checks: **399 tests / 55 files pass**, as do typecheck and production
build. Tests cover 180/120 ms repeat/cancellation, vaporization rise bounds and
shrink/opacity progression, Heavy axis validation/render projection, shared
body/gear transforms, contact/death proportions and matching shadows. Simulation
outcomes are identical with old/new Heavy visual proportions across the same
30-second fixed-step/input sequence; snapshots still restore. Authored Phase 2.8
balance is explicitly asserted unchanged. No backend/framework or deployment.

Portrait browser evidence is local in `artifacts/combat-baseline-lock/`, at
390×844 touch viewport, DPR 2 and Chrome software rendering. Full-density live
captures show repeated Grunt kills as low gray shrinking silhouettes. Equal-depth
near/mid inspection uses two render-only position changes at Z=6/18, retaining
every other enemy, to compare Heavy and Grunt silhouettes and shadow. Heavy
hit/contact/death proportions are also covered by renderer tests; visual death
captures at 0/160/320 ms show its size preserved through the shrink. The Heavy
stands out amid partially overlapping crowds, while outer-lane/body overlap
remains worth inspecting on physical phones.

Measured held-key traversal from lane 1→5 and 5→1 starts immediately, repeats
at ~181 ms then ~120–122 ms, and stops at the edges. Mobile remains one tap per
lane; Pause suppresses taps and closing TUNE restores keyboard control. No browser
errors. Live population is ~202–205 around 18 seconds, with ~21–22 FPS, average
~46–47 ms and p95 ~50–83 ms under software rendering. No combat tuning changed
for performance. Physical-phone checks should confirm short kill visibility,
Heavy lane footprint, and the more responsive hold while the unchanged 150 ms
visual interpolation catches up to the destination.
