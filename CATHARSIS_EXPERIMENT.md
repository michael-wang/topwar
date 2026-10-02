# Phase 3.0: Earned Power Loop

This is the first **progression experiment**, not final progression pacing.
The accepted naked-combat baseline stays locked: one defended normal lane is
barely manageable, while three active fronts exceed one soldier's capacity.
Kills now earn automatic Rifle power so previously overwhelming fronts can
become easier. Combat never pauses for a level, and no choices or support systems
are introduced. Enemy durability, density and speeds do not scale with player power.

## Earned progression

Defense runs start at **LV1 / XP0**. XP measures progress within the current level.
`requiredXp(level) = firstLevelXp + xpRequirementStep * (level - 1)`:
**16, 28, 40, 52…** XP. A player-caused Grunt death awards **1 XP**; a Heavy
awards **10 XP**. Hits, contact casualties and leaks award nothing. Rifle penetration
can award each kill; retained rocket kill resolution uses the same award boundary.
Overflow repeatedly advances levels and retains the remainder; there is no authored cap.

Effective Rifle rate is **base + (level - 1) × fireRatePerLevel**. Authored base is
3 Hz and bonus is 1 Hz per gained level: **3 / 4 / 5 / 6 / 7… Hz**. TUNE controls
**Base fire rate** independently (2.5 base at LV3 gives 4.5 Hz). Levels shorten
the pending Rifle cooldown when necessary and affect subsequent scheduling without
resetting combat. No projectile damage, enemy HP or wave tuning is changed.

The bottom XP HUD shows level, current/required XP and a fill bar. It ignores pointer
input and respects safe-area insets; the tap hint sits above it. Level gains trigger
an **800 ms** warm bar glow and `LEVEL UP · FIRE RATE +N`, plus a short ascending
two-tone Web Audio cue. No combat interruption or new VFX framework.

Progression and progression balance are plain snapshot data. Validation checks current-level
XP and positive integer level. Older defense snapshots without progression initialize
at LV1/XP0; non-defense runs remain without XP. Retry resets level/XP and feedback,
while retaining existing runtime TUNE values. Edit `catharsis.progression` in runtime
JSON for `firstLevelXp=16`, `xpRequirementStep=12`, `gruntKillXp=1`,
`heavyKillXp=10` and `fireRatePerLevel=1`.

## Heavy lane leader

When a defense group contains a Heavy, it is centered at the beachward edge
of its own lane volume. Its same-group, same-lane Grunts are deterministically
redistributed behind **2.5 units** of clearance (`heavyFrontClearance`). Total
population, wave interval, pressure lanes and bounded nine-unit footprint remain.
This is a leader staging rule, not enemy collision avoidance; adjacent waves and
Grunts may overlap. Existing Heavy proportions remain after portrait inspection:
its silhouette already occupies most of one corridor. Complete body/gear, feedback
and contact shadow retain their shared non-uniform scales.

Grunts keep **360 ms** urgent gait; Heavies use **650 ms** deliberate gait, including
baked frame progression and bob/sway. Entity phase offsets remain asynchronous.
This changes presentation only; Heavy simulation additional speed stays 0.12.

Heavy-only camera-facing health sprites use dark backing and amber fill. Reusable
bar pairs share materials, follow measured model height and remain visible through
crowd occlusion. Fill is live HP divided by `maxHp` projected from effective
Catharsis Heavy HP; no redundant maximum is stored in enemy simulation state.
Explicit TUNE Heavy HP edits immediately update both HP and the projected maximum.

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
Grunts stay at 1.4, and Heavy HP=15, additional speed=0.12, lane/damage
and collision radius=0.30 remain unchanged. New multipliers are catharsis JSON;
snapshot defaults of 1 preserve old visual proportions. No assets were rebaked.

Normal Grunt and Heavy assets now reuse the proven Boss helmet-occlusion rule.
The original Archer cap was already stripped, but upper brown hair and side scalp
still protruded through the helmet. UV-identified hidden surfaces are removed or
clipped at model Y=0.725, preserving lower side/back hair, face, ears and neck.
Corrected files: normal idle body, gray death body and all four run frames. Normal
contact uses corrected idle geometry; hit flashes use corrected active run frames.
Player, all Boss files and shared helmet/gear remain byte-identical.

Grunt visual gait changes only presentation: cycle **500 → 360 ms**, frame step
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

No upgrade choices, squad growth, additional weapons/enemies, backend, framework or deployment.
The single-soldier opening remains unforgiving; evaluate whether earned fire rate changes
the pressure/release loop before designing further progression.

## Verification and phone playtest focus

Focused checks cover player kill awards/contact exclusions, duplicate prevention,
penetration and retained rocket kills, XP curve/overflow, effective scheduling,
base-rate composition, snapshot validation/restore, new-run reset, deterministic
Heavy staging, render max HP, gait independence, health-bar reuse and HUD feedback.
Existing baseline/input/death checks remain in place.

Portrait evidence and measurements are saved locally under `artifacts/earned-power/`.
Physical-phone playtesting should evaluate the first few earned levels, whether
Heavy leads remain visible as different waves overlap, the 650 ms lumbering gait,
HP bar legibility at the shoreline, low vaporization visibility and whether the
800 ms level beat is rewarding during sustained fire. Performance is measured;
no adaptive density or hidden scaling is used.

Delivery checks: **415 tests / 57 files pass**, plus typecheck and production build.
Portrait Chrome at **390×844, DPR2** shows the unobstructed XP bar, readable
near/mid Heavy silhouette and live amber health fill; no extra size increase was
needed. The hint hides during the level-up beat. XP-HUD taps step lanes, Pause
suppresses taps, closing TUNE restores keyboard input, and Retry returns LV1/XP0
while retaining a tuned 2.5 Hz base. Three natural level-up cues were observed;
no browser errors. Audio playback uses the existing gesture unlock and remains
optional if Web Audio is denied.

A scripted nearest-threat lane pilot reached LV2/3/4 at **5.4 / 13.9 / 22.4 s**
in the live seed-17 run; LV4 had 13/52 XP with ~185 active enemies at ~25 s.
Three deterministic fixed-step pilots (seeds 1/17/42) reached LV2 at **5.3–7.0 s**,
LV3 at **13.2–14.0 s**, LV4 at **21.8–22.1 s**, and LV5 at **31.4–31.7 s**.
Seed 17 reached LV2/3/4/5 after **16 / 35 / 75 / 118 kills**, including
**0 / 1 / 1 / 2 Heavies** respectively. These are automated lane choices, not human pacing evidence. The first thresholds
represent 16/44/84 total XP (up to that many Grunt kills; Heavies reduce kill count).
All three pilots survived 100 s and reached LV10 with ~19–20 active enemies:
automatic power objectively outgrows unchanged pressure, which requires phone
playtesting before selecting a final curve.

The live software-rendered run reported **23 FPS**, average **42.9 ms**, p95
**50.1 ms**, with simulation ~0.2 ms and ~209 draw calls. This is Chrome SwiftShader,
not target-phone performance. No density reduction or optimization was applied.
Heavy leaders can still be occluded by older overlapping waves despite clearance
within their own group; bars remain visible. Evaluate this limitation and whether
the first levels arrive too quickly on a physical phone.
