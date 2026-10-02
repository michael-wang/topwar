# Visual Cleanup + Giant Difficulty Tuning

This is a focused **progression experiment**, not final progression pacing.
The accepted LV1–LV4 combat baseline stays locked: one defended normal lane is
barely manageable, while three active fronts exceed one soldier's capacity.
Kills now earn automatic Rifle power so previously overwhelming fronts can
become easier. Combat never pauses for a level, and no upgrade choices or support abilities
are introduced. LV7 adds the first earned reinforcement. Ordinary enemy durability and movement remain fixed. New waves gain authored quantity pressure from LV5; this is a level table, not an adaptive DPS/FPS director.

## Focused cleanup

XP now has distinct **pale-blue → cyan-white → warm ivory → bright gold** resource
semantics. Deliberate stops at 0/40/60/70/82/90/100% keep blue and yellow separated
by a near-white bridge, avoiding an obvious green middle. The gradient remains
fixed to the full track and is progressively masked. Its leading-edge glow uses
the same palette stops. The frame, 70/90% anticipation, level-up flash/label pop,
no-numeric-XP rule and underlying XP/progression logic are retained.

The fixed authored Giant HP is now **172**. Isolated seeds 1/17/42, at 44/38/30
units respectively, each measure **24.48 s** from first damage to death at LV6
single-soldier 6.9 Hz. Settled LV7 two-soldier 13.8 Hz measures **12.25 s** in all
three runs. Firing-start-to-death also includes projectile travel (24.98–25.22 s
single, 12.75–12.98 s pair). HP is the only Giant combat change; 120 XP, speed,
spawn timing, appearance, reactions and all player/ordinary-enemy balance stay fixed.
Snapshots retain their saved effective balance; existing snapshots need no migration.

Side scenery has four uneven authored clusters per side, with independently
sampled static offsets, dimensions and rotations. Left/right clusters have
unequal depth gaps and different 3–6-piece densities rather than mirrored piles.
There are still **18 pieces per side / two instanced draws**. The existing
corridor-edge barricades are staggered, independently angled and occasionally
broken (32 beams instead of 36). They remain anchored to lane boundaries; side
wreckage stays at least 0.4 units outside the track. No gameplay collision,
pathfinding or lane changes are introduced. Sampling is stable between runs and
never consumes gameplay RNG. Chipped forms and the existing world palette remain.

## Illustrated battlefield art direction

This is a **presentation-only art direction pass** over the existing animation.
It uses a painted coastal toy-world language: warm ochre/cream sand, cool
blue-gray fog and ruins, ink-blue steel and muted rust/concrete. Cobalt defenders,
crimson Grunts, ochre Heavies and crimson/gold Giant armor share matte surfaces
and broad, quiet tonal washes. The face/leather atlas regions and all baked
character geometry are retained. There is no photorealistic texture noise,
external artwork, postprocess stack or new lighting/shadow pipeline.

`src/art/ArtDirection.ts` is the shared presentation palette. Surface shading
composes with the existing player limb shader rather than replacing animation.
Chipped, beveled prop silhouettes retain normalized placement bounds. The sand
uses a small generated cream/ochre wash texture; corridor scuffs have irregular
soft brush edges instead of rectangular stamps. Warm sunlight/cool hemisphere
fill separates saturated characters from the quieter distance. Shoreline,
lane membership and shoreline remain unchanged; obstacle composition follows the cleanup above.

XP and Heavy/Giant HP now share a **rounded brass-and-ink frame family**: warm
upper rim, dark blue outline/backing, inset fill and restrained depth. World bars
use two shared generated textures, with gold Heavy fill and hot coral Giant fill.
HP truth, placement and update timing remain unchanged. XP retains the full-width
masked blue/white/ivory/gold progression, 70/90% anticipation, flash and label pop.
HUD controls use the same rim/backing and friendly weighted typography; lower-left
instructions remain compact, transparent and pointer-transparent.

Muzzle/tracer/level-up highlights share a warm white core/gold family; Heavy/Giant
impacts use hot coral sparks; death debris mixes warm white/gold/ember and gray
bodies retain their short collapse/fade. Dust/ash use quiet sand/cream tones.
Existing particle budgets, animation timing, hit rate limits and level-up intensity
are retained. Reinforcement arrival, fire scheduling and all combat/progression
values are unchanged except for the explicitly authored Giant HP above. No simulation, snapshot schema
or input edits are part of this pass; LV7 balance work remains deferred.

The bevels add approximately **6,200 fixed environment triangles**, and sand,
scuffs and bars add **four shared small textures**. Crowd instancing, pooled
feedback, geometry count and draw-call structure are retained. Software-rendered
portrait checks cover 50/100/150/200 enemies; they are not physical-phone FPS
claims. Matching before/after portrait evidence covers early play, Grunts/Heavy,
Giant and HUD details. Distant cranes remain deliberately simple silhouettes;
the small atlas accessories and faceted Giant ornaments remain visible style
limitations for a future asset-authoring pass.

## Retained animation presentation

The animation system remains unchanged. Apart from authored Giant HP above,
pressure tables, population, damage, Rifle rates, XP thresholds/rewards, Giant timing and the exact LV7 two-soldier
DPS/arrival behavior are unchanged. The acknowledged LV7 screen-clearing balance
issue is deferred.

Character motion is procedural over the existing baked meshes. Player geometry
now carries four original limb-weight channels, consumed by a small vertex shader;
its positions/normals/UVs/indices/atlas are byte-identical to the previous surface.
No runtime skeleton, AnimationMixer, physics or CPU vertex rewriting is added.
Boss, normal enemy and shared equipment assets remain byte-identical.

* Lane locomotion lasts **220 ms**, overlapping the unchanged **150 ms** simulation
  lane interpolation. A tiny initial counter-lean leads into two quick steps,
  travel lean, weapon/upper-body lag and settle. Rapid destinations retain the prior
  lean briefly, avoiding an abrupt pose reset. Input and logical lane truth are immediate.
* Firing adds weapon, weighted arm, shoulder and torso impulses with **38 ms decay**,
  a small spring overshoot and a **150 ms** cutoff (previous weapon-only recoil was
  85 ms). Repeated shots blend with a bounded 1.35-strength envelope. Each member
  observes its own existing projectile memberIndex; DPS and alternating phase are untouched.
* Two members have independent idle/step phases and a tiny recoil-amplitude difference.
  Original two-member spacing/stagger and same-lane targeting remain unchanged.
* Grunt keeps its **360 ms** quick baked gait, with a lighter **0.0416-unit** bounce
  and ~0.032-radian weight roll. Heavy keeps **650 ms**, with **0.0198-unit** bounce
  and ~0.077-radian alternating weight roll. Helmet/vest roll follows at 82%/92%
  of body roll. All bodies still use four shared InstancedMesh pose batches.
* Giant keeps **850 ms** visual cadence and its existing crimson/gold dimensions.
  Up to **1.8%** presentation compression marks landing; maximum bounce is 0.022
  units, sway 0.026 radians. Arms, separate forearms, shoulders and mace have small
  asynchronous delayed motion. Movement, collision and bar are unchanged.
* Heavy/Giant hits remain rate-limited additive impulses over ongoing gait.
  Grunt/Heavy gray deaths retain their **480 ms** fade/pop/shrink/burst, adding a
  quick 0.55-radian collapse with small roll (65/110 ms response respectively).
  Giant staggers briefly, then falls ~1.1 radians before disappearing at **650 ms**;
  its expanding ring and existing 36 debris points remain stronger than ordinary hits.
* Reinforcement still takes exactly **1.1 seconds**. Weighted limbs run during
  arrival, decelerate and settle, with smooth arm/weapon readiness in the final
  quarter. LV7 keeps LEVEL UP but no explanatory reinforcement subtitle; existing
  ring/wash/motes, label pop, positive audio and weapon afterglow are preserved.
* Air adds **24 sparse warm motes** and **24 pooled dust slots**, four points per
  Giant footfall lasting **420 ms**. These are two shared point batches, not
  per-character emitters. The existing hit/death/level-up particle budgets are unchanged.
  A Giant removal adds only a **0.025-unit / 240 ms** camera lift; there is no
  continuous footfall shake, extra player-camera motion or fullscreen effect.

All animation/particle clocks and resources are renderer-owned and cleared on
Retry/restore. Nothing new is serialized or consumes gameplay RNG. There are no
simulation/input changes. The only balance JSON edit is the authored Giant HP above. Presentation tests cover timing,
independent phases/recoil, hit layering, physical death, bounded dust buffers and
asset surface preservation. Large-crowd CPU and portrait capture evidence is
recorded separately; physical-phone feel remains the final check.

## Earned progression

Defense runs start at **LV1 / XP0**. XP measures progress within the current level.
Authored per-level requirements are **28 / 60 / 110 / 180 / 280 / 420** XP for
LV1→2 through LV6→7. These are current-level costs, not cumulative totals.
After the table, each requirement is **ceil(previous × 1.45)** (609, 884…);
`xpFallbackMultiplier` is configurable and there is no authored cap.
The old linear formula/fields are removed.
A player-caused Grunt death awards **1 XP**; a Heavy
awards **10 XP**. Hits, contact casualties and leaks award nothing. Rifle penetration
can award each kill; retained rocket kill resolution uses the same award boundary.
Overflow repeatedly advances levels and retains the remainder; there is no authored cap.

Effective Rifle rate adds authored level bonuses to the independent TUNE base.
LV1–4 remain **3 / 4 / 5 / 6 Hz**. From `fireRateTaperStartLevel=5`, the first gain
is `fireRateTaperFirstGain=0.5` Hz; each subsequent gain is multiplied by
`fireRateTaperDecay=0.8`. LV7 is now the configurable **reinforcementLevel=7**, so that level skips its
per-soldier rate gain. Thus LV5–9 are **6.5 / 6.9 / 6.9 / 7.22 / 7.476 Hz** per
soldier, with diminishing gains resuming at LV8. `fireRatePerLevel=1` controls the earlier gains.
TUNE still edits **Base fire rate**, never the level bonus (2.5 base at LV5 gives
6 Hz). These values are runtime-loaded and retained/validated in snapshots.
Levels shorten the pending Rifle cooldown when necessary; no damage, XP costs or enemy HP changes.

The bottom HUD shows **LV N only**, with no routine numeric XP. Its shaped dark
track keeps beveled warm borders and inset depth. The pale-blue→white→gold
**gradient spans the full track width**, progressively revealed with a clip mask;
it is never stretched across the filled segment. At 20% pale blue is revealed,
50% is brighter blue/cyan, 75% reaches warm ivory, and 90–100% reveals bright yellow/gold. The leading-edge glow follows that progression.
The traveling sheen remains subtle. At 70% glow strengthens; at 90% it pulses.
Forward mask/edge updates interpolate over 120 ms. Large same-level gains
(at least 20% of the requirement) use a brief **260 ms** reveal so the Giant
reward is visible; XP and level power are granted immediately in simulation.

One disposable `progressionLevelUp` event coordinates the entire presentation:
**800 ms** HUD gold/white pulse, track sweep and `LEVEL UP` / `FIRE RATE ↑` message
(the reinforcement unlock omits the explanatory subtitle).
For the first **240 ms** the bar flashes full, then resets immediately to actual
new-level overflow; the old level label becomes the new one with a pop at 120 ms.
Combat does not pause. Multi-level grants carry a from/to range and share one
coherent beat instead of stacking duplicate visual/audio bursts.

Each visible soldier gets an **800 ms** expanding warm ground ring, emissive
body/helmet/vest wash, a brief 20% presentation scale pulse, and eight rising
energy motes. A reusable pool covers up to 24 members, sharing geometry/materials;
the current single soldier and multiple-member fixtures are verified. Rifle tiers
and gameplay hitboxes are untouched. The next **1400 ms** uses a 1.9× brighter
warm muzzle flash (90 ms rather than 50 ms) and stronger tracer glow (.55 opacity
versus .28, 1.2× Rifle width). Damage, range and the weapon model stay unchanged.
The existing modest ascending two-tone audio cue remains at its prior volume.

Progression and progression balance are plain snapshot data. Validation checks
current-level XP, positive integer level, nonempty positive requirement table and
finite fallback multiplier >1. Phase 3.0 snapshots carrying explicit linear
`firstLevelXp`/`xpRequirementStep` balance are **intentionally rejected**, not
silently reinterpreted; save a new snapshot for this pacing experiment. Older
pre-XP defense snapshots without progression initialize LV1/XP0 and use current
balance defaults; non-defense runs remain without XP. Retry resets level/XP,
observer, HUD beat, soldier burst and weapon afterglow, retaining runtime TUNE.
Edit `catharsis.progression.xpRequirements` / `xpFallbackMultiplier` in runtime JSON.
Kill awards remain `gruntKillXp=1`, `heavyKillXp=10`; `fireRatePerLevel=1`.

## LV7 reinforcement

LV6→LV7 still costs **420 current-level XP** (1,078 XP cumulatively from LV1).
This unlock replaces the usual per-soldier fire-rate gain: after arrival, both
Tier-1 Rifle soldiers fire at **6.9 Hz each**, exactly **13.8 shots/second total**.
There is no hidden damage bonus or extra rate gain at LV7. TUNE Base fire rate
remains independent; each member receives the same base plus level bonus.
LV8 resumes the small diminishing per-soldier gain (7.22 Hz each).

Simulation serializes a one-time reinforcement start clock and arrived flag.
At the unlock, Soldier A continues fighting while a disposable Soldier B visual
runs from below the screen into formation, with bob/lean and a lowered Rifle.
The weapon rises during the final quarter of the **1.1-second** entrance. Only
when the arrival finishes does simulation add one Tier-1 soldier and enable its
fire. The world never pauses. The existing warm level-up ring/body wash/motes,
positive audio, level-label pop and 1.4-second weapon afterglow remain intact.
No damage-multiplier text is added; the visible arrival communicates the reward.

Both soldiers share the one selected lane. The two-member formation uses **0.72
units** between centers and **0.18 units** of longitudinal stagger, with the same
explicit lane identity on both members' Rifle shots. There is no independent
lane targeting or wider Rifle targeting. Formation values and unlock/arrival
values are runtime-loaded under `catharsis.progression`:
`reinforcementLevel`, `reinforcementArrivalSeconds`, `reinforcementSpacing`,
`reinforcementStagger`. Other legacy formations and Merge rules remain intact.

Defense Rifle timing uses serialized per-member cooldowns. Soldier B joins with
half a shot interval offset from A's next shot: **~72.46 ms** at 6.9 Hz. Fixed-step
rounding produces alternating **66.7 / 83.3 ms** gaps, without reducing total DPS.
A ten-second check emits 69 shots from each member (138 total), with identical
Tier-1 damage. Projectiles carry optional `memberIndex` so recoil and muzzle
flashes belong to the actual shooter rather than both members of the same tier.
Legacy non-defense firing retains its existing volley behavior.

Snapshots retain pending arrival, completed grant, member clocks and projectile
member identity. Restore mid-entrance resumes from simulation time; pause also
holds that clock. Older defense snapshots without reinforcement state initialize
an unclaimed reward; at/above the unlock it starts once. Missing member clocks
initialize deterministically. Retry resets to LV1/XP0/one soldier, clears arrival
and presentation, and retains existing runtime TUNE semantics. A lost reinforcement
is not repeatedly granted at later levels; Game Over does not resurrect the squad.

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

Heavy-only nonlethal hit feedback adds a **100 ms** warm body/gear flash, a
**0.07-unit** visual recoil and **0.045-radian** tilt that settle within the flash,
and four **170 ms** sparks at the defender-facing Rifle-height impact proxy.
The render state exposes HP deltas, not exact projectile impact coordinates.
A **250 ms per-Heavy cooldown** prevents continuous flashing at high fire rates;
the lightweight pool holds at most 12 simultaneous reactions. Baked body poses
are borrowed, and spark geometry/materials are reused. Death/Retry clears these
visuals. Grunts gain no new hit feedback. This never changes HP, movement,
collision, damage, targeting or knockback. The longer gray vaporizing death and
its existing burst remain stronger than a surviving hit.

## Late pressure and first Giant

One quantity-only mechanism scales **future** defense waves. `pressureMultipliers`
is indexed by player level: **1 / 1 / 1 / 1 / 1.25 / 1.35 / 1.45 / 1.55 / 1.6 / 1.65**.
Beyond the table the last authored value repeats; edit/extend the array for further
experiments. Round(base groupSize × multiplier) gives **24 / 24 / 24 / 24 / 30 /
32 / 35 / 37 / 38 / 40** enemies. Existing wave intervals, three-front priorities,
Heavy frequency, crowd footprint, HP and movement do not change. Existing enemies
are not retroactively multiplied. The initial suggested 1.25/1.5/1.8 profile was
measured and rejected because it left 195–235 active enemies at 300 seconds.

The first Giant is a normal lane-tagged enemy, **not a Boss**, with no special
attack or popup. On reaching LV6 a serialized introduction clock starts; after
**4 seconds**, exactly one Giant enters at the shoreline volume's beachward edge:
53 − 9 = **44 units** ahead. It chooses the least crowded interior corridor,
preferring center on ties; interior placement avoids portrait-edge cropping.
Ordinary waves continue during the delay; no breathing-window density reduction
is applied. The pending time and one-shot flag survive snapshots. Retry resets
both. Old snapshots without this state initialize an untriggered encounter; missing Giant balance defaults disabled, while new authored runs explicitly enable it.

Authored `catharsis.giant` values: **172 HP / 120 XP / 0.08 additional speed**, unlock
level 6, delay 4 seconds, visual scale **3.6**, width multiplier **0.68**, visual gait
**850 ms**. HP is fixed, never derived from player fire rate. The retained presentation adds animation, secondary motion and physical defeat. Giant
speed, static silhouette, hit timings, HP bar, appearance timing, pressure curve,
LV1–LV6 Rifle values, XP thresholds and Heavy values remain unchanged.
The Giant uses normal lane targeting, tier-1 contact damage and the existing 0.3
normal collision radius. XP is awarded once by the shared player-kill boundary;
contact/leaks grant none. At fixed LV6 / 6.9 Hz, uninterrupted single-soldier fire
takes **24.48 seconds from first damage to death**. With the two LV7 soldiers it
naturally takes **12.25 seconds** against the same 172 HP.
No armor, phases, regeneration, new damage or special attacks were introduced.
All Giant values and the pressure table are runtime-loaded JSON/snapshot balance.
Explicit live HP edits retain damage fraction, as Heavy does.

The separate Giant renderer reuses the corrected soldier face and run poses, but
adds **crimson armor / warm gold trim**, faceted broad shoulder plates and spikes,
independent thick arms/gauntlets, skin-colored hands, a gold helmet rim/crest,
chest shield/belt and slate boots. A clearly visible **spiked mace** gives the
silhouette character; it is entirely visual, with no weapon mechanics. Dark
materials are secondary leather contrast. Heavy assets are unchanged; player surface is preserved with added limb-weight metadata.
Final XYZ scale is **3.4272 / 5.04 / 5.04**, versus unchanged Grunt 1.4.
Measured full-model envelope is ~**4.16 wide × 5.85 high × 4.44 deep** world units,
including mace and crest: roughly **three 1.4-unit lane spacings** wide. Armor/body
occupies about 2.4 lanes; the weapon extends the envelope. Height exceeds four
Grunt model heights with the crest. Visual intrusion into neighboring lanes is
intentional; targeting/collision still belongs to one logical lane.
The asynchronous 850 ms gait and simulation advance remain unchanged.

The floating HP bar uses measured full-model bounds: ~**3.12 units** of fill track,
0.18 fill height / 0.26 backing height, centered ~0.35 units above the model top.
It has no numbers, remains visible through crowds, and loses ~0.48% per Rifle hit.
Shared surviving-hit rate limiting remains **100 ms flash / 250 ms minimum gap**.
Giant armor adds a brief warm emissive wash; its **0.11-unit recoil / 0.06-radian
tilt** and six larger **170 ms sparks** remain. Sparks move to the defender-facing
surface of the enlarged model so impacts are not hidden inside it. Heavy's four
sparks, flash and jolt are unchanged. Death uses gray body and armor, a **650 ms**
physical stagger/collapse and shrink/fade and proportionally wider expanding ground ring, plus **36 larger
0.34-unit debris points lasting 450 ms** in the existing fixed pool. Normal enemy
deaths stay six points / 260 ms. No collision avoidance or new animation framework is added. The small camera
defeat lift and player limb metadata are presentation only. Renderer-owned geometry/materials reset/dispose;
borrowed soldier geometry remains intact.

The lower-left instruction group now has **transparent backing**, quiet small
text/shadow, and includes the mobile tap hint. The separate bottom-center hint
is removed. Safe-area positioning leaves a gap above the XP bar, and the group
remains pointer-transparent. The existing temporary instruction hide during the
level-up announcement is retained.

The one LV7 reinforcement is the only squad-growth reward. No new player weapon,
upgrade choice or further recruitment is introduced. XP thresholds, Grunt 1 HP /
1 XP, Heavy 15 HP / 10 XP and existing level-up spectacle/audio remain unchanged.

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

Each wave generates the base twenty-four members at its first row, every six rows
through LV4. Later waves multiply this base population using the authored pressure table. Seeded independent
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
| `groupSize` | 24 | Base members per group, including a possible Heavy; TUNE 10–60, step 2; level pressure multiplies this base |
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
active enemies remain untouched; later levels multiply the tuned base. Retry retains tuning and is the cleanest way to
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

Four asymmetric 3–6-piece clusters on each side use shared chipped/beveled
geometry and two instanced draw calls. Depth gaps, rotation, lateral offset and
piece size vary independently, with the retained muted concrete/steel/rust colors. Every piece stays at
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
the authored run starts with one soldier and no battlefield rewards. LV7 is the
one authored reinforcement unlock; no Merge change is introduced.

No upgrade choices, additional recruitment, player weapons, backend, framework or deployment. Giant remains the only new archetype.
The single-soldier opening remains unforgiving; evaluate whether earned fire rate changes
the pressure/release loop before designing further progression.

## Verification and phone playtest focus

The same fixed-step nearest-threat pilot selects a lane every 90 ticks (1.5 s).
**Seed 17** retains exact LV2/3/4/5/6 timings:
**13.3 / 27.8 / 49.7 / 82.6 / 128.65 seconds**. Enemy pressure and Giant difficulty
were not changed to accommodate the pilot.

| Seed | First Giant | Giant killed | LV7 reached | Outcome at 400 s / earlier death |
| --- | --- | --- | --- | --- |
| 1 | 134.60 s | 189.83 s | 207.17 s | Alive, 2 soldiers, 32 enemies |
| 17 | 132.67 s | 195.37 s | Not reached | Dies at 198.50 s, LV6 / 377 XP |
| 42 | 133.72 s | 194.67 s | 205.88 s | Alive, 2 soldiers, 42 enemies |

All three kill the Giant and receive exactly **120 XP**; none gets an entire
level from a Giant starting at XP0. Seed 17 still fails just before reinforcement.
These earlier 210-HP pilot results do not drive pressure retuning; the current
Giant HP reduction follows subsequent physical-phone feedback. A supplemental alternating Giant-priority pilot also fails
seed 17; primary benchmark timing above comes from the unchanged nearest-threat
pilot. Seeds 1/42 outgrow the initial backlog after reinforcement. Peaks before
relief are 276 / 303 / 289; no pressure or density was reduced for FPS.

Current isolated seed-1/17/42 checks use a Giant at 44/38/30-unit range, authored HP172,
unchanged damage and speed. **Every run** measures the same focused TTK:

| State | Per-soldier rate | Total rate | First hit to death | Firing start to death |
| --- | --- | --- | --- | --- |
| LV6, 1 soldier | 6.9 Hz | 6.9 Hz | 24.48 s | 24.98–25.22 s |
| LV7, 2 settled soldiers | 6.9 Hz | 13.8 Hz | 12.25 s | 12.75–12.98 s |

Arrival delay is excluded from the settled two-soldier TTK, and no second Giant
is spawned naturally. Both test soldiers target the same lane. Additional tests
cover reward overflow into LV7, no duplicate award/grant, snapshot continuation,
clock validation, retry initialization, exact shot counts, phase offset, same-lane
shots after lane switching, entrance/weapon raising and independent muzzle flashes.

Portrait captures in `artifacts/reinforcement/` use **390×844 / DPR2**. The natural
LV7/arrival/formation/firing sequence is seed 1; seed 17 supplies the crowded
Giant death/reward sequence. A controlled isolated LV7 fixture supplies two soldiers
fighting the same Giant, because there is only one natural introduction per run.
The reward visibly moves the existing red-to-gold bar without numeric XP. The
entrance comes from below the frame, both bodies remain distinct, and no multiplier
label appears. The original level-up spectacle stays readable. Mobile left tap
moves one lane with both members retained; Pause/TUNE respond. Actual Retry returns
LV1, one visible soldier, no pending entrance. No browser errors.

Eight-second live portrait checks restore the same high-pressure state and run
the same pilot; the single-soldier comparison is a fixture, not a gameplay change.
Chrome **SwiftShader software rendering**, not physical-phone GPU performance:

| Soldiers | Active enemy range | FPS | Average frame | p95 | Simulation CPU |
| --- | --- | --- | --- | --- | --- |
| 1 | 239–263 | 18 | 54.2 ms | 66.7 ms | ~0.2 ms |
| 2 | 211–251 | 20 | 49.3 ms | 50.1 ms | ~0.2 ms |

The second soldier reuses geometry/materials and existing effect pools; geometry
count stays 43 and projectile pool stays 8 in these samples. Two-soldier fire also
kills more enemies, so the FPS difference is not a pure render-cost benchmark.
No clear CPU regression or blocking hitch appeared, and no adaptive density or
optimization was added. Phone testing should judge whether the visible arrival
and alternating firing feel like earned reinforcements, while one shared lane
still demands attention elsewhere.

Delivery checks: **446 tests / 62 files pass**, typecheck and production build.
Existing Giant, Heavy, input, snapshot and spectacle tests remain passing.
Build warnings remain third-party Zod annotations and bundle size.
