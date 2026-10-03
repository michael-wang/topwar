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

Keep the approximate two-head family and current battlefield occupancy. Use a
large rounded helmet/head zone, one small plump torso, detached simple hands
and short rounded shoes. Avoid anatomical shoulders, elbows, knees and long
limbs. Spheres, ellipsoids, capsules, beans and soft barrels dominate; hard
boxes are reserved for an indispensable small weapon feature.

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
tracking, reinforcement, tier colors, Level-Up, hit and casualty timings.
The body must no longer look like a beveled tunic box.

## Grunt target

A tiny round enemy toy that runs hard. Keep the simplest olive helmet/head,
one shirt/trouser bean with plain color division, tiny ball hands and soft shoes.
One broad belt and one rounded canteen add light-infantry identity. No armor,
weapon, camouflage or additional gear. Preserve four static
locomotion poses, asynchronous 360 ms gait, foot lift, support-side transfer,
hand counter-swing, instancing and bounded hit/contact/death presentation.

## Heavy target

A short, wide, plump brawler toy. One deeper/wider oval barrel, huge separated
spherical fists, large rounded shoes and a broad planted stance distinguish it.
One broad diagonal cloth harness and two hip pouches distinguish the assault
brawler. No torso plate or weapon. It is only moderately taller than
Grunt and must not steal Giant's vertical scale.

Heavy's unique deep steel-helmet abstraction must wrap the head. Use a thick
rounded crown, clear front-to-back depth, short front projection, lowered cheek
sides and rear skirt, with the face recessed inside a clear front opening.
No wide flat cylinder rim, mushroom cap, stretched Grunt helmet, eye band,
insignia or realistic hardware. Front, side and three-quarter views must prove
shell depth. Preserve 650 ms shift/lift/plant/push and absorbed hit feedback.

## Giant target

A giant rounded war-chief toy: one huge smooth pear/bell/bean body, a deep olive
helmet with one thick limestone crest and one enormous blunt maul. No billboard
chest plate or collar. One broad curved waist sash and one side satchel opposite
the maul leave the torso uninterrupted. Hands are enormous spheres,
feet are scaled soft toy shoes. The maul head is a rounded drum/capsule, not a
sharp cuboid or spiked mace. Preserve the 850 ms stepping and delayed weapon
inertia, reveal/haze, weighty hit, fall/crash timing and bounded debris.

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
Legacy GLBs remain for Boss, shared legacy presentation and rollback protection.
No Kenney UV/_MOTION assumptions enter the four new procedural families.

Player keeps one merged body with authored moving-part regions for detached
hands/shoes and an explicit motion factory. Keep weapon/muzzle anchors and
presentation-only shadow/effect metadata, without combat data. No skeleton,
AnimationMixer or general character engine. Crowd roles retain four static
poses and instancing; Giant has bounded dedicated slots for two live Giants
plus a recent collapse. Feedback/contact/death use the owning role's geometry.

A small shared ellipsoid/shoe/shell geometry helper is appropriate. Shoes may
accept dimensions, upper/sole colors and pose offsets; helpers contain no role
combat or simulation rules. Helmets remain explicitly authored per role,
especially Heavy's unique deep shell. Keep bounded effects and low draw counts.

HP, targeting, movement speed, collision, damage, XP, progression, population,
reinforcement and serialized state remain simulation truth. Visual metadata
contains only geometry, motion strategy, materials and presentation anchors.

## Review workflow and current shipping

**CURRENT SHIPPING:**

- Player = R1 rounded toy base + R2 combat identity.
- Grunt = R1 rounded toy base + R2 combat identity.
- Heavy = R1 rounded toy base + R2 assault-brawler identity.
- Giant = R1 rounded toy base + R2 war-chief waist equipment.
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

Heavy has a 0.68×0.48×0.55 barrel, 0.13-radius spherical fists centered at ±0.495,
and wide rounded shoes. Its unique shell has radii 0.425/0.225/0.37 centered at
Y=0.765; crown remains 0.99. Opening angles front/side/rear are 1.30/2.05/2.30
radians, making the front opening higher than cheek sides and rear skirt.
Shell thickness is 0.02. There is no cylinder brim, facial band, chest plate or
weapon. Eye sightlines are tested, including legitimate rear-shell geometry
behind the head. The 0.80 visual Y compression, 650 ms clock, 0.09 shoe lift,
0.045 lateral step and weight transfer/hit/contact/death timings remain.

Giant uses smooth 24×12 primary body/head, an olive deep shell, one soft
limestone fin (0.18 wide, crown 1.355), large spheres for hands and a rounded
ellipsoidal maul head with one soft limestone end accent. There is no chest or
collar geometry: the secondary adapter is empty/hidden. It has three primary
mesh draws per live Giant. R3 replaces colored debris with twelve pale rounded
fragments at the existing crash. Four 850 ms poses, 0.085 foot lift, lateral transfer and
weapon inertia are unchanged. Full motion-envelope/ownership tests remain.

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

Development default and `?review=threats` retain deterministic Level 7, XP 0,
two defenders, reinforcement arrived and immediately visible Grunt/Heavy/Giant.
`?review=normal` gives Level 1; production defaults Level 1. Retry preserves mode.

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

`ToyCombatGear` creates low-segment curved cloth bands on each body's ellipsoid;
the diagonal Heavy strip wraps the curved surface. Pouches/canteen/cuffs use
8–10 radial segments and 4–5 rings. All are merged into reference/run bodies:
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

Ordinary surviving feedback remains independently controlled from lethal/crash
presentation. R3 supersedes the former core-color/0.6 emissive lethal wash with
the naturally lit pale-shatter language below. Reveal, surviving-hit impulse,
compression and the R1 Giant HP bar remain unchanged.

Evidence and performance comparisons belong in `artifacts/rounded-toy-r2/`,
including equal-height Grunt/Heavy color/silhouette comparisons and R1/R2
Giant peak/50 ms/settled impact captures.

## R3 canonical lethal language — Pale Shatter

**Color → warm gray-white → shatter.** A defeated enemy briefly becomes a lit
plaster/stone toy, then breaks into rounded pale pieces. No blood, faction/tier
fragment colors, emissive white corpse, long corpse or rising ghost dissolve.
Surviving hits and Player Level-Up remain separate semantics.

Grunt/Heavy freeze the last drawn role-owned run geometry and planted root pose.
Albedo drains to #D8D9D1 within 80 ms; the intact silhouette hides at 110 ms.
Six Grunt/eight Heavy rounded fragments then move ballistically for 280 ms,
with a quick final fade/shrink: total 390 ms. No upward corpse launch. Forty-eight
reusable intact slots and one shared 384-instance fragment pool bound dense kills.
Fragment velocity is deterministic from enemy ID/index; palette alternates
#D8D9D1 / #E7E4D9 / #BFC5C1 and uses matte, non-emissive standard lighting.
Materials/uniforms belong to renderer slots; role geometry is borrowed.

Giant drains albedo over 120 ms without lethal emission. Its existing 90–520 ms
heavy fall, 520 ms crash, sand dust/ring and 2400 ms clear clock remain. The
intact Giant now breaks at crash, into twelve larger pale rounded fragments per
bounded slot, replacing both colored armor rubble and the 36-point burst.
Fragments settle rapidly, fade from 1550 ms and clear at 2400 ms. Reveal timing,
ordinary R2 hits, HP layout and gameplay removal are unchanged. Boss is excluded.

R3 evidence belongs in `artifacts/coastal-r3/`. Stop after R3 for human review.
