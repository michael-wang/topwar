# TopWar Character Visual System

## Canonical direction — Rounded Toy Soldiers

R1 supersedes incremental primitive/faceted character-shape polish. Characters
are purpose-designed rounded toy figurines with a war theme: plump, short,
soft, friendly and extremely simple. The design test is: **would this still
look charming as a small physical toy?**

The supplied handmade miniature reference informs form, not surface. No yarn,
crochet or texture noise is introduced. Do not copy a proprietary character,
face, exact proportion, uniform, helmet or footwear. TopWar geometry is original.

[SUNLIT_COASTAL_ART.md](SUNLIT_COASTAL_ART.md) and
[COASTAL_GREEK_OBJECT_LANGUAGE.md](COASTAL_GREEK_OBJECT_LANGUAGE.md) continue to
own the frozen coastal environment, lighting and naval language. R1 does not
change the world, UI, ships, camera, gameplay, balance or snapshots.

## Target proportions and materials

Keep the approximate two-head base family and current battlefield occupancy;
R5 moves Giant to a 2.9–3.1-head war-chief with a body-dominant silhouette. Use a
large rounded helmet/head zone, one small plump torso, detached simple hands
and short rounded shoes. Avoid anatomical shoulders, elbows, knees and long
limbs. Spheres, ellipsoids, capsules, beans and soft barrels dominate; hard
functional equipment may use softly structured canvas forms, never hard chest slabs.

Heads are smoothly shaded spheres/beans with enough segments for close review.
Faces use two tiny dark eyes and optionally a neutral mouth. No eyebrows,
realistic nose, teeth or aggressive expression. Hands are small spheres or
squashed spheres, without fingers; movement communicates the absent arms.

Bodies are **one primary soft volume**: egg, bean, pear or squashed capsule.
Clothing is conveyed by broad color regions, not stacked waist blocks, boxy
chest armor or layered hard costume masses. Matte standard materials retain
roughness near 1, metalness near 0 and broad vertex colors, without textures.

## Palette and footwear

Player remains the organized blue defender family. Enemies remain human coastal
raiders in the accepted non-red olive/slate/limestone family: helmet #6F7C5A,
body #61704F (Giant may use #536246), lower cloth #62727A, limestone #C6B68C,
hardware #49555C. Coral/red HP and blood semantics remain independent of costume.
Tier/progression rules are unchanged.

Footwear must stop reading as bricks. Use a short bean/ellipsoid with a rounded
toe, wider than long, slightly flattened bottom and a quiet upper/sole boundary.
Detached shoes remain visible in motion. Rounded rectangular blocks are not
acceptable as the primary shoe form. Neither white nor near-black may dominate:
Player uses muted blue-gray, enemies muted sage/slate, with a slightly darker
companion sole. No strong black/white split.

## Player target

An organized blue defender toy: close-wrapping rounded helmet, spherical head,
one compact bean torso, simple hand balls and soft bean shoes. The separate
chunky rifle remains directional and gains softer toy proportions. Preserve
weapon-local muzzle coordination, controlled plant/fire/recover motion, hand
tracking, reinforcement, tier colors and Level-Up remain; R7 updates casualty and impact presentation.
The body must no longer look like a beveled tunic box.

## Grunt target

A tiny round enemy toy that runs hard. Keep the simplest olive helmet/head,
one shirt/trouser bean with plain color division, tiny ball hands and soft shoes.
One broad belt and one rounded canteen add light-infantry identity. No armor,
weapon, camouflage or additional gear. Preserve four static
locomotion poses, asynchronous 360 ms gait, foot lift, support-side transfer,
hand counter-swing, instancing and bounded hit/contact/death presentation.

## Heavy target

A short, wide, plump brawler toy. One padded cylindrical/vertical drum torso, huge separated
spherical fists, large rounded shoes and a broad planted stance distinguish it.
One broad diagonal cloth harness and two flapped canvas waist pouches distinguish the assault
brawler. No torso plate or weapon. It is only moderately taller than
Grunt and must not steal Giant's vertical scale.

Heavy's unique deep steel-helmet abstraction must wrap the head. Use a thick
rounded crown, clear front-to-back depth, short front projection, lowered cheek
sides and rear skirt, with the face recessed inside a clear front opening.
No wide flat cylinder rim, mushroom cap, stretched Grunt helmet, eye band,
insignia or realistic hardware. Front, side and three-quarter views must prove
shell depth. Preserve 650 ms shift/lift/plant/push and absorbed hit feedback.

## Giant target

A giant rounded war-chief toy: one tall padded barrel/capsule body, a smaller deep olive
helmet with one thick limestone crest and one enormous blunt maul. No billboard
chest plate or collar. One broad flat waist belt and one structured canvas satchel opposite
the maul leave the torso uninterrupted. Hands are enormous spheres,
feet are scaled soft toy shoes. The maul head is a rounded drum/capsule, not a
sharp cuboid or spiked mace. Preserve the 850 ms stepping and delayed weapon
inertia, reveal/haze, weighty surviving hits and the unified lethal timeline.

Giant HP is a dedicated major-threat bar. Explicit width **and height** must
produce an outer ratio around 5.5–6.5:1; do not flatten a normal bar with extreme
X scaling. Keep a comfortable inner-track thickness, rounded outline, centered
anchor and contained coral fill at full/half/low/zero. R1 retains the inner-track
clipping correction while correcting the squashed presentation.

## Carry-over acceptance items

- Footwear: replace brick geometry and overly light/dark color dominance.
- Heavy: prove deep curved shell, cheek/rear skirt and a visible recessed face.
- Giant HP: dedicated width/height, robust thickness and clipping at every fraction.
- **Boss Rounded Toy migration**: explicitly deferred. Boss stays legacy in R1;
  its future migration includes head, body, footwear and motion language.

## Runtime asset contract and ownership

Named Player, Grunt, Heavy, Giant and Boss visual families remain explicit.
Changing one role must not implicitly replace another. Dedicated procedural
families own their geometry/materials; renderers borrow family resources and
own disposable instance/effect materials. Disposal must occur exactly once.
Only 13 legacy GLBs remain: Boss idle/run/slam/vest, its gray atlas body,
the shared Boss/reward helmet and bullet. `CharacterAssets.LEGACY_MODEL_FILES`
is the explicit load manifest. Obsolete Player/normal-enemy GLBs, their bake
paths, rollback family builders and legacy Player limb-motion class are removed.
Git history provides rollback; current role-isolation and resource tests remain.
No Kenney UV/_MOTION assumptions enter the four new procedural families.

Player keeps one merged body with authored moving-part regions for detached
hands/shoes and an explicit motion factory. Keep weapon/muzzle anchors and
presentation-only shadow/effect metadata, without combat data. No skeleton,
AnimationMixer or general character engine. Crowd roles retain four static
poses and instancing; Giant has bounded dedicated slots for two live Giants
plus a recent lethal freeze. Feedback/contact/death use the owning role's geometry.

A small shared ellipsoid/shoe/shell geometry helper is appropriate. Shoes may
accept dimensions, upper/sole colors and pose offsets; helpers contain no role
combat or simulation rules. Helmets remain explicitly authored per role,
especially Heavy's unique deep shell. Keep bounded effects and low draw counts.

HP, targeting, movement speed, collision, damage, XP, progression, population,
reinforcement and serialized state remain simulation truth. Visual metadata
contains only geometry, motion strategy, materials and presentation anchors.

## Review workflow and current shipping

Visual/performance evidence is generated locally under ignored `artifacts/`.
Historical phase paths below describe evidence recoverable from Git history,
not shipping dependencies. Current correctness tests remain in `tests/` and
reusable live/production checks in `scripts/qa/`.

**CURRENT SHIPPING:**

- Player = R1 rounded toy base + R2 combat identity.
- Grunt = R1 rounded toy base + R2 combat identity.
- Heavy = R4 padded drum, diagonal webbing and flapped canvas pouches.
- Giant = R5 approximately 3-head padded colossus with flat belt and canvas satchel.
- Boss = legacy, deferred. **Boss Rounded Toy migration** remains outstanding.

R1 follows separately revertable documentation, base-role and threat-role commits.
The Player/Grunt checkpoint was captured and reviewed before rebuilding threats;
actual portrait composition retained clear feet, weapon direction and two defenders.

### Retained rounded foundation

`ToyGeometry` provides smooth ellipsoids, colored bean shoes and curved thick
helmet shells. Shoe uppers/soles share one merged vertex-colored geometry. The
lowest 12% of the underlying ellipsoid is flattened; dimensions/pose offsets
are rendering-only. Player shoes are muted blue-gray #778E9C / #647B88;
new enemy shoes are muted sage/slate #7D8B84 / #667770. Boss retains Phase 4C
footwear pending its deferred migration.

| Role | Nominal shoe width × height × depth |
|---|---|
| Player | 0.27 × 0.14 × 0.23 |
| Grunt | 0.26 × 0.12 × 0.22 |
| Heavy | 0.34 × 0.15 × 0.27 |
| Giant | 0.40 × 0.18 × 0.32 |

Player uses a 0.48×0.38×0.33 bean torso, smooth 20×12 head, ball hands and
ellipsoidal receiver/stock/grip with a directional cylindrical barrel. A thin
uniform color surface follows the same torso curvature in the existing tier
accent slot; it adds no hard body mass. Existing four primary meshes, moving
part regions, motion factory, grips, 8° rifle cant, muzzle anchor, root scale,
shadow and Level-Up/tracer metadata remain. Hit/casualty use the new parts.

Grunt uses one 20×12 rounded shirt/trouser body, smooth head and tiny ball hands.
The helmet is a curved shell without hard cylinder rims. Its secondary adapter
remains explicitly empty/hidden. Crown 1.025, four 360 ms poses, 0.11 shoe lift,
0.035 outward swing and 0.18 hand swing are preserved.

Heavy has a 0.68×0.48×0.55 padded capsule barrel with a straight 0.28-high middle,
0.10-high rounded caps, 0.13-radius spherical fists centered at ±0.495,
and wide rounded shoes. Its unique shell has radii 0.425/0.225/0.37 centered at
Y=0.765; crown remains 0.99. Opening angles front/side/rear are 1.30/2.05/2.30
radians, making the front opening higher than cheek sides and rear skirt.
Shell thickness is 0.02. There is no cylinder brim, facial band, chest plate or
weapon. Eye sightlines are tested, including legitimate rear-shell geometry
behind the head. The 0.80 visual Y compression, 650 ms clock, 0.09 shoe lift,
0.045 lateral step and weight transfer/hit/contact timings remain.

Giant uses a 24-radial padded barrel and smooth 24×12 head, an olive deep shell, one soft
limestone fin (0.162 wide, crown 1.355), large spheres for hands and a rounded
ellipsoidal maul head with one soft limestone end accent. There is no chest or
collar geometry: the secondary adapter is empty/hidden. It has three primary
mesh draws per live Giant. Death retains the intact role geometry through
the shared blood/reaction/progressive-pale/breakup/fade timeline. Four 850 ms poses, 0.085 foot lift, lateral transfer and
weapon inertia are unchanged. Full motion-envelope/ownership tests remain.

R5 removes the grip hand from body/reference/run/death geometry and merges it
with the maul shaft/head/stone accent into the existing single weapon mesh.
The other hand remains pose-baked. A typed character-space grip anchor
(0.60,0.40,0.08) drives the weapon group pivot; no family-ID branching, skeleton,
additional mesh/material or draw is introduced. The whole assembly translates
±0.015 X, ±0.009 Y and ±0.075 Z at the 850ms gait phase offset 0.3 radians.
Existing ±0.14 pitch / ±0.045 roll retain their delayed response; pitch lags
grip translation by 0.55 radians (about 74ms). Lethal presentation freezes the last
grip/maul transform together during the initial freeze, then reacts as one assembly. Contact also borrows
the complete composed body + hand/maul reference. Tests verify coupling and
shaft/head clearance across all four poses and the lethal freeze.

The dedicated Giant bar defines authored billboard width 1.20 and height 0.20,
both scaled by projected X scale: exactly 6:1. Two-Giant layout scales both
by 0.8. It stays centered on lateral weight transfer and uses the existing
rounded inner-track clipping at full/half/low/zero. Heavy bars retain their
original layout. Frame/fill textures and coral semantics are unchanged.

Smooth key forms use 20–24 radial segments, 10–12 head/body rings, 16 shoe
segments and smooth normals. Existing resource counts and instancing remain;
no GLB, texture, external art tool, skeleton or runtime package is introduced.
The smoother curves substantially increase triangle counts; the review report
records that cost rather than changing enemy population to hide it.

Explicit `?review=threats` uses deterministic P1 Level 5, XP 0,
three defenders and forced visible Grunt/Heavy/Giant; late reinforcement is dormant.
`/` and `?review=normal` gives Level 1; production defaults Level 1. Retry preserves mode.

Evidence belongs in `artifacts/rounded-toy-r1/`: four-role beauty sheet, front
three-quarter and side views, helmets, shoes, black silhouettes, actual 390×844
review/normal battlefields, complete gait strips, Giant HP states and matched
Phase 4C comparisons. Measure normal/mixed/50/100/150/200/two-Giant draws,
triangles, resources and bundle bytes. Preserve gameplay/role-isolation/Boss
asset protections; run tests, typecheck, build and live/production sanity.

The R1 rounded grammar and R2 combat identity are accepted as the character
baseline. Boss Rounded Toy migration remains deferred.

## R2 combat identity layer

Equipment is subordinate to the rounded silhouette and must read at 390×844.
Each role has a strict detail budget:

- Player: waist belt + one hip ammo/utility pouch, without a tactical vest.
- Grunt: broad belt + one flattened round canteen, without a firearm.
- Heavy: one broad diagonal harness + exactly two large side pouches.
- Giant: broad waist sash + one oversized side satchel opposite the maul;
  crest/body/maul retain priority. No chest gear or harness.

All four have explicit trouser-colored lower volumes and two very short soft
ellipsoidal cuffs, without anatomical legs. R1 detached bean footwear is frozen.
Player trousers are deep blue #365973, belt/pouch #4C6673. Grunt retains olive
shirt/slate trousers, with belt #526358 and canteen #8E9987. Heavy uses deeper
olive #59674C, darker slate #4E6067, deep helmet #626F51, broad muted-khaki
harness #989077 and pouches #7E836A. Giant retains deep olive/slate with sash
#85856D and satchel #747F66. No enemy costume red or bright progression gold.

`ToyCombatGear` retains Player/Grunt's low-segment ellipsoidal cloth and field
items. R4's `StructuredToyParts` fits Heavy webbing to the padded barrel and
builds canvas pouch/satchel bodies with shallow integrated flaps. Soft cuffs and
Grunt canteen retain their low-segment ellipsoids. All are merged into reference/run bodies:
no new Player/Grunt/Heavy/Giant gear draw or material, and role resources remain
independent. Contact/death/hit inherit the owning body's equipment. Player
equipment/cuffs use its fixed torso region; hands/shoes retain their existing
motion regions. Gait clocks, root scales, muzzle, R1 Giant HP, shadow, gameplay
and review/production starts remain unchanged.

### Giant ordinary surviving hits

`SURVIVING_HIT_STYLES` selects explicit Heavy/Giant archetype styles without
family-ID branches or combat data. Giant uses muted peach #DDA999 at 0.24
overlay opacity for the existing 100 ms wash; warm emissive peaks at 0.10
instead of 0.45. Three warm sparks replace six; scale peaks at 0.9 instead
of 1.8, opacity at 0.5 instead of 1, spread at 0.30 instead of 0.50. Sparks
retain their 170 ms decay, 250 ms impact gap and twelve-burst bounded pool.
Each feedback instance owns one shared overlay material per role, reused
across impacts; existing pooled spark materials remain. Heavy retains its
stronger 0.72 core wash and four-spark response.

Ordinary surviving feedback remains independently controlled from lethal
presentation. Lethal color is naturally lit neutral gray, following the unified
timeline below. Reveal, surviving-hit impulse,
compression and the R1 Giant HP bar remain unchanged.

Evidence and performance comparisons belong in `artifacts/rounded-toy-r2/`,
including equal-height Grunt/Heavy color/silhouette comparisons and R1/R2
Giant peak/50 ms/settled impact captures.

## Enemy Kill Feedback (R8)

Current beachhead enemies use **Role Reaction → Integrated 3D Breakup →
Progressive Gray-White → Body Fade + Blood Fall → Persistent Ground Stain**.
Capture the exact last rendered pose/root, including crowd support shift, impact
compression, helmet lag and Giant coupled grip-hand/maul. Roots stay pinned;
two baked reaction poses show a sink/kneel with raised hands before the hold.
No forward fall, rise, shrink, flying body fragments, grounded body debris or crash dust.

Grunt freezes for 35 ms, reaches its final reaction at 130 ms: upper mass sinks
0.09 authored units, hands rise 0.25, shoes widen 0.03 per side, torso tilt 6.3°.
Heavy freezes for 70 ms, settles at 260 ms: 0.11 sink, 0.18 fist lift, 0.035 shoe
widening, tilt 5.2°. Giant freezes for 180 ms and settles at 650 ms: 0.12 sink,
0.24 offhand lift, small coherent maul lift/cant. No live crowd draw or skeleton
is added.

| Role | Logical body / blood pieces | Split begins | Gray complete | Body fade | Total |
| --- | --- | ---: | ---: | --- | ---: |
| Grunt | 8 / 4 | 130 ms | 390 ms | 300–520 ms | 520 ms |
| Heavy | 10 / 5 | 260 ms | 825 ms | 650–1100 ms | 1100 ms |
| Giant | 11 / 7 | 650 ms | 1950 ms | 1550–2600 ms | 2600 ms |

The final reaction geometry supplies the exact starting silhouette. Helmet,
head, torso bands, hands, shoes and structured equipment are authored logical
pieces; every vertex in a piece shares a rigid displacement. Three ID-selected
patterns provide lateral, upper/lower and diagonal separation. They reconstruct
the same accepted pose at zero separation. No runtime fracture or independent
triangle motion is used. World-space separation caps are **0.10 / 0.15 / 0.24**
units, compensated for role scale. Body colors progressively drain to
**#B9BEBA** while pieces separate; there is no red body tint or emissive wash.
Giant grip-hand and maul remain one piece through the reaction and breakup.

The 48 preallocated crowd pose holders submit gray/separation/opacity/variant
into per-geometry instanced batches. Three fixed Giant slots use the same piece
semantics. Family-owned tagged geometry and renderer-owned material/batch
resources dispose at their respective ownership boundaries.

Enemy lethal blood uses **3D geometry**, not a camera-facing card. One merged
batch per active role shares **64 total death slots**. Irregular blobs, flattened
masses and tapered droplets begin inside/between the torso bands. The same death
variant controls their internal origin, small static size/orientation variation
and outward pattern. Blood expansion caps are **0.10 / 0.14 / 0.22** world units.
The matte palette remains **#751D27 / #9F2734 / #C93443 / #D94A50** throughout;
blood does not consume the body's gray tint. Normal alpha/depth-tested lighting
keeps these masses spatially integrated rather than drawn over the actor.

Blood releases at 54% of each role clock (281 / 594 / 1404 ms, rounded), then
follows deterministic analytic flight. Mixed small upward/downward velocities,
role gravity and size-aware floor contact keep all blood resolved by the death
clock. X/Z converge near the death point. Only blood falls: body pieces remain
near the defeated silhouette and fade in place. Each blood piece fades over
65 ms at contact. The first major piece activates one stain, which grows from
30% to full size over **110 ms**; it never appears at the initial lethal event.

Enemy ground stains reuse V1's fuller four-mask atlas in **one draw / 1024 slots**.
Base diameters remain **0.34 / 0.64 / 0.95** for Grunt/Heavy/Giant
(1 : 1.88 : 2.79). Deterministic variation selects mask, rotation, ±12% size,
area-preserving aspect 0.85–1.20, opacity 0.50–0.66 and dried-blood tones
**#602327 / #6D2528 / #792A30**. Existing offsets within ±0.035 / 0.055 / 0.08
units receive only a small contact bias (at most 0.025 units).
Y=0.032 keeps marks above dry/wet beach overlays. Stains survive until
Retry/renderer reset/mode change, with oldest-slot reuse only as a safety bound.
Surviving hits never create stains. No gameplay collision.

The large lethal card path, its variation helper and the old per-triangle
breakup helper are removed. V1 surviving-hit cards, every-hit recoil,
rate-limited emphasis, Giant HP layout/reveal, audio, simulation removal,
Player casualty and Boss remain unchanged. Generated V2 evidence is
local/untracked under `artifacts/v2-integrated-death/`. Development `/` and
`?review=normal` start normal Level 1; explicit `?review=threats` uses P1 Level 5
with forced threats. Production root is Level 1. Retry preserves the selected mode.

### R7 Player casualty

An actually removed visible squad member gets the same non-emissive irregular
blood mask (two pulses, 0–220 ms, scale 1.10) and one 0.35-unit dark sand stain.
Remainder damage without a removed soldier creates neither. Player effects own
separate bounded pools (64 splats, 1024 stains) using the common renderer class;
Player stains survive the 700 ms casualty and clear on Retry/reset/mode change.

The intact blue soldier/helmet/gear/rifle recoils for 80 ms, falls backward to
77.3° by 350 ms with deterministic slight left/right roll (about 8–9°), then
holds on the sand. Translation is only about 0.10–0.115 lateral and 0.18 backward
world units. Fade is 450–700 ms. Ground support is sampled from real family
vertices once, including the attached rifle; no airborne arc, gray wash,
fragmentation, separate flying weapon or generic enemy-fall system.

### R7 surviving enemy impact

Every observed surviving HP decrease (including future multi-HP Grunts) emits
one 170 ms blood pulse without a body tint or ground stain. A separate 128-slot
pool uses one four-cell procedural atlas: broad lopsided, taller diagonal,
compact multi-lobe and wide satellite blots. Six Giant, four Heavy and three
light-role model-local face/shoulder/jacket anchors cycle deterministically by
enemy ID and hit sequence; adjacent anchor and mask never repeat. Emission is
evaluated after rendering the actor transform and follows its recoil/lean, not
an unrelated world-space crown offset. Four masks vary 2–4 satellites and their
placement. Rotation is fixed per hit and mostly lateral, with an asymmetric
side bias; size varies ±15%, aspect 0.82–1.20. Player blood and stains retain
their accepted appearance. Hit card scales remain 0.45 / 0.58 / 0.66 for
Grunt/Heavy/Giant; these are independent of the V2 lethal 3D blood geometry.

`EnemyHitImpulse` snaps back over 20 ms, holds through 70 ms, then smoothly
returns by 250 ms. Single-hit +Z displacement is 0.27 / 0.25 / 0.17 world units
for light / Heavy / Giant; rapid hits preserve current displacement, add one
impulse and refresh the clock, capped at 0.36 / 0.33 / 0.20. Small rearward lean
and compression support the root cue. Simulation position, speed and contact
remain authoritative and unchanged.

Existing Heavy/Giant overlay, sparks, tint and compression remain independently
rate-limited at 250 ms. Their old root translation/lean is replaced by the
every-hit impulse, avoiding double knockback. Lethal removal cancels hit blood,
prunes the impulse, then owns the frame through the captured lethal reaction.

## R4 — rounded organic mass + structured functional gear

Body/head/fists/shoes remain rounded toy abstractions. Functional equipment
should read as equipment: cloth webbing, a waist belt, canvas bags with a broad
body and shallow flap. No sphere-only gear, MOLLE, buckles, tactical vest or
chest plate. Player/Grunt art is frozen; Boss migration stays deferred.

Heavy retains crown 0.99, width, helmet depth, spherical fists, footwear and
0.80 Y compression. Its padded barrel has vertical elliptical walls and soft
caps. The broad diagonal harness conforms to this surface. Exactly two
0.18×0.155×0.10 canvas pouches sit at X=±0.245/Y=0.245/Z=0.235, inside fist
width and near the lower front waist. Trouser boundary is a dedicated existing
ring at Y=0.30, without added body triangles.

Giant retains the R4 structured body/gear, with R5 head radii
0.232716/0.1755/0.204508 at Y=1.075: another 14% less width/depth and 10%
less vertical radius. Shell radii are 0.285606/0.22/0.250346 at Y=1.095;
one proportional limestone crest remains. Crown stays 1.355. The head zone is
0.4555 (33.62% of height), giving approximately 2.975 heads. The R4 torso remains
0.84×0.76×0.58, from Y=0.135 to
0.895, with a straight padded middle. R5 presentation scales are recorded below.
A flat 0.055-high belt wraps the waist; one 0.245×0.275×0.12 flapped canvas
satchel sits opposite the unchanged maul. No center-chest gear.

Canvas forms use eight broad outline corners and one bevel ring, not costly
spheres. Body and flap are merged before each reference/run pose is merged;
no new per-Heavy draw/material or Giant draw is introduced. Role ownership,
hit/contact/death geometry selection, 650/850 ms gait, shoe motion, surviving-hit
styles and Giant HP dimensions remain unchanged. Current lethal clocks are
recorded in the unified death section above.
Evidence belongs in `artifacts/structured-toy-r4/`; stop for human review.

## R5 — Giant hierarchy and presentation correction

Giant presentation multiplier is 1.9 (previously 3.6), with width multiplier
0.94 (previously 0.68). Heavy remains 1.35 with its existing 0.80 Y compression.
At the actual 390×844 portrait camera, the fixed 2000ms review fixture measures
Giant crown height 2.18× Heavy at equal Z=16, and 1.57× at the unchanged
Heavy Z=12 / Giant Z=22 opening. Same-depth body width is 1.56× Heavy.
The suggested 2.4–2.8 exploration remained too tall: 2.4 measured 2.79× / 2.01×.
Only the visual-scale schema floor is lowered from 2.0 to 1.8; combat validation
and HP/speed/collision/targeting/XP/scheduling are unchanged. An identical-input
simulation comparison confirms this boundary. Total authored crown remains
1.355, while head/helmet now occupy approximately one third of standing height.
The separate 1.20×0.20 Giant billboard still scales uniformly at exactly 6:1,
with the accepted contained fill and full/half/low/zero behavior.

R5 evidence belongs in `artifacts/r5-giant-shatter/`.
