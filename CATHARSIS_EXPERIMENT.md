# Phase 3.0.5 — Progression Feel Pass

Focused follow-up: fixed-width XP color reveal, Heavy hit feedback and LV5 Rifle taper.

This is the first **progression experiment**, not final progression pacing.
The accepted naked-combat baseline stays locked: one defended normal lane is
barely manageable, while three active fronts exceed one soldier's capacity.
Kills now earn automatic Rifle power so previously overwhelming fronts can
become easier. Combat never pauses for a level, and no choices or support systems
are introduced. Enemy durability, density and speeds do not scale with player power.

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
`fireRateTaperDecay=0.8`. Thus LV5–8 are **6.5 / 6.9 / 7.22 / 7.476 Hz**, with
diminishing gains thereafter. `fireRatePerLevel=1` controls the earlier gains.
TUNE still edits **Base fire rate**, never the level bonus (2.5 base at LV5 gives
6 Hz). These values are runtime-loaded and retained/validated in snapshots.
Levels shorten the pending Rifle cooldown when necessary; no damage, XP costs,
enemy HP or wave tuning changes.

The bottom HUD shows **LV N only**, with no routine numeric XP. Its shaped dark
track keeps beveled warm borders and inset depth. The red→orange→hot-yellow
**gradient spans the full track width**, progressively revealed with a clip mask;
it is never stretched across the filled segment. At 15% only red is revealed,
50% remains mostly red with a warming edge, 75% reaches orange, and 90–100%
reveals bright yellow/gold. The leading-edge glow follows that progression.
The traveling sheen remains subtle. At 70% glow strengthens; at 90% it pulses.
Forward mask/edge updates interpolate over 120 ms; simulation remains truth.

One disposable `progressionLevelUp` event coordinates the entire presentation:
**800 ms** HUD gold/white pulse, track sweep and `LEVEL UP` / `FIRE RATE ↑` message.
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

Focused tests cover authored table/fallback/overflow, strict snapshot format,
unchanged awards/contact exclusions, effective scheduling/base independence,
HUD percentages and anticipation, full flash/reset/label pop, one-shot/coalesced
presentation events, reusable multi-member bursts, tier independence, afterglow
expiry and Retry cleanup. Existing combat baseline and input tests remain.

Portrait evidence is local under `artifacts/progression-feel/`, at 390×844/DPR2
Chrome SwiftShader. Captures include normal/70%+/90%+ fill, a full-density staged
lethal hit at 27 XP, and render-timed flash/sparks/reset/afterglow/expiry. Only one
Grunt is repositioned for the staged hit; crowd population is retained. The warmer
HUD and prominent ring/wash/motes are readable below combat without covering the
soldier. XP taps still step a lane, Pause suppresses taps, and closing edited TUNE
restores keys. Retry resets LV1/XP0 and visible bursts while retaining base 2.5 Hz.
No browser errors. Audio remains the existing gesture-unlocked positive cue.

The same fixed-step nearest-threat pilot selects lanes every 90 ticks (1.5 s).
**Seed 17:**

| Level | Time | Total kills | Heavy kills included | Effective Rifle |
| --- | --- | --- | --- | --- |
| LV2 | 13.3 s | 28 | 0 | 4 Hz |
| LV3 | 27.8 s | 79 | 1 | 5 Hz |
| LV4 | 49.7 s | 180 | 2 | 6 Hz |
| LV5 | 82.6 s | 342 | 4 | 6.5 Hz |

Across seeds 1/17/42, LV2 arrives at 9.4–13.3 s, LV3 at 25.6–27.8 s,
LV4 at 49.7–49.9 s and LV5 at 81.7–82.6 s. All three pilots survive 300 s
and reach LV7 (~205 s). Seed-17 active population is 199 at 30 s,
181 at 60 s, 105 at 120 s, 23 at 180 s and 11 at 300 s: power eventually
outgrows unchanged pressure. These are scripted decisions, not human pacing evidence.

Physical-phone playtests should judge whether the first reward still arrives too
soon or feels delayed, whether the bold soldier wash preserves its silhouette,
whether near-full anticipation is noticeable without distracting from lane choice,
and whether the brief afterglow makes the new rhythm feel earned. Heavy leaders
can still be obscured by adjacent waves; their existing bars/readability are retained.
No adaptive density, hidden scaling or unrelated optimization is applied.

Focused follow-up portrait captures are local under `artifacts/xp-color-heavy-hit/`:
15/50/75/90/99% masks, Heavy hit/settle at 3 and 15 Hz, and a live ~200-enemy run.
Percentage captures use presentation-only fixtures for exact progress, retaining
the crowd. One Heavy is repositioned for close hit inspection. At 3 Hz all eight
staged hits react; at 15 Hz only two of eight react, with visible settle gaps.
No browser errors. The existing level-up ring/wash/motes, audio, label pop,
800 ms full-flash sequence and 1400 ms weapon afterglow are unchanged.

An additional fixed-LV5 seed-17 comparison disables XP awards **only in the test
fixture** to isolate 7 versus 6.5 Hz. Both pilots visit all five lanes, switching
to the nearest threat every 1.5 seconds, and survive 300 seconds. At 90 seconds
7 Hz leaves 23 enemies versus 57 at 6.5 Hz; at 180 seconds both have only ~11–12.
**6.5 Hz delays cleanup but still eventually covers all five lanes comfortably
in this scripted test.** Lane choice is still required to execute the pilot;
this does not prove human triviality, nor eliminate the physical-playtest concern.
No additional combat rebalance is applied. Evaluate this specifically on a phone.

Delivery checks: **426 tests / 59 files pass**, plus typecheck and production build.
A separate ~22-second live portrait browser pilot (without synchronous offline
simulation) reports **23 FPS**, average **44.2 ms**, p95 **50.1 ms**, with 199 active
enemies under Chrome SwiftShader/DPR2. The prior comparable check was 21 FPS /
47.9 ms at 200 enemies; variation does not establish a performance improvement.
No obvious new hitch was observed; this is software-rendered desktop evidence,
not physical-phone performance. Screenshot PERF counters from offline fixtures
are stale and are not used as FPS measurements. Existing build warnings concern
bundle size and third-party Zod annotations; no density reduction or optimization.
