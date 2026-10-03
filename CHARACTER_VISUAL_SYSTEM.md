# TopWar Character Visual System

## Status

This document defines the canonical character-art direction for TopWar's
Beachhead Defense presentation.

Phase 0 and its Phase 0.1 amendment freeze the visual direction and future asset
contract. Phase 1 added named runtime role families while preserving shipping
assets, appearance and gameplay. Phase 2A introduced the accepted original
procedural Player prototype. Phase 2B's refined Player grammar is accepted.
Phase 3A established an amphibious Grunt prototype that was not accepted as
the final direction. Phase 3B's clothed rounded Grunt is accepted as good enough
for now. Phase 4A introduces dedicated Heavy and Giant threat prototypes and an
explicit Level-7 review boot path. Further polish requires human review; the
complete system is not final.

It supersedes the earlier three-head designer-toy direction while preserving the
existing gameplay model, faction semantics and Sunlit Coastal Battlefield
environment.

**TARGET:** the full two-head character system described below.

**CURRENT SHIPPING:** Player retains the accepted Phase 2B two-head refinement.
Grunt remains the accepted Phase 3B rounded shirt/shorts figurine. Heavy and Giant
use Phase 4A procedural prototypes. Boss retains its explicit legacy resources
and presentation. Player/Grunt polish and Boss/world redesign are outside Phase 4A.

[SUNLIT_COASTAL_ART.md](SUNLIT_COASTAL_ART.md) remains canonical for coastal
palette, lighting, composition and UI guardrails.
[COASTAL_GREEK_OBJECT_LANGUAGE.md](COASTAL_GREEK_OBJECT_LANGUAGE.md) defines the
reusable non-character object language.

The inspiration is the mobile readability principle of Pawapuro-style
super-deformation. Do not copy any proprietary character, face, helmet, uniform,
asset, exact proportion or franchise-specific design. TopWar's designs must be
original.

## Core idea

TopWar characters are original super-deformed battlefield figurines designed
for mobile portrait readability.

Their defining structure is:

**large helmet + large head + short body + abstracted hands and shoes**

The target is roughly a two-head character:

- the head / helmet zone occupies approximately half of total height;
- the compact body occupies approximately the other half.

This is a visual proportion target rather than a rigid numeric requirement.

Hands and feet may be visually detached from the torso. Anatomical continuity is
less important than readable motion.

At small screen sizes the viewer should infer locomotion and effort from moving
shoes and swinging hands even if conventional arms and legs are absent.

## Readability hierarchy

Characters must communicate information in this order:

1. Helmet silhouette.
2. Whole-character silhouette and width.
3. Faction color.
4. Motion personality.
5. Equipment.
6. Face.

Helmet identity is therefore a gameplay-facing visual system rather than a
decorative accessory.

The long-term goal is that helmet shape can help communicate faction, role and
relative threat before the viewer reads fine detail.

## Shared geometry language

Character parts have different responsibilities:

| Part | Primary job |
| --- | --- |
| Helmet / head | Identity |
| Body | Faction and supporting role |
| Hands | Action and rhythm |
| Shoes | Locomotion and weight |
| Weapon | Attack direction and weapon identity |
| Face | Personality |

Anatomical realism is not a goal.

Avoid realistic fingers, long limbs, dense tactical gear, thin straps, small
pouches, detailed firearm furniture and fine insignia.

Prefer a few large volumes, broad color regions, strong negative space and
silhouettes that remain readable when reduced to black.

## Face language

Faces are intentionally subordinate to helmet and motion.

Use:

- small dark eyes;
- a minimal nose / wedge;
- a short mouth mark;
- simple cheek / jaw volume.

Do not use realistic eyes, teeth, detailed lips or exaggerated villain faces.

Player and enemy characters belong to the same toy-like visual universe.

## Helmet system

Helmet shape is the primary role identifier.

Useful large-scale variables include:

- width;
- height;
- brim profile;
- cheek / side plates;
- rear block;
- ridge;
- crest;
- top block;
- broad stripe or panel regions.

Critical identity must never depend on tiny decals, readable text or miniature
insignia.

Future tiers and archetypes should extend this grammar rather than introducing
an unrelated style.

## Enemy family: amphibious landing infantry

The enemies across the sea are still human beings. TopWar's original sea-borne
landing troops should feel human, physical, vulnerable, numerous and determined,
with slightly absurd effort within the two-head system. Visible warm faces and
hands make that humanity readable beneath oversized helmets;
avoid monsters, robots and anonymous armored blobs.

Derive an original visual family. Do not copy Republic of China Marine Corps
uniforms, real unit insignia or patches, exact helmet models, exact camouflage
patterns, rank markings or identifiable contemporary military loadouts.
The basic Grunt wears plain graphic clothing, without camouflage or tactical
detail. Helmet-first identity matters more than uniform detail.

Faction contrast is intentional: Player is the organized, clothed coastal
defender; enemies are improvised, aggressive amphibious landing infantry. Both
sides remain visibly human, cute and absurd rather than a realistic war simulation.
Grunt's cool muted shirt must separate from warm sand under the actual coastal
lighting. Visible skin remains a human cue, not a faction color code.

## Player

### Intent

Player soldiers should feel controlled, stable and native to the coastal world.

### Form

- Approximately two-head proportion.
- Large but clean helmet.
- Short compact body.
- Large readable shoes.
- Large simplified hands.
- Detached hands and feet are allowed.
- Weapon silhouette remains clearly visible.

### Helmet

The standard defender helmet should be rounded and compact with a clean,
recognizable profile.

It should feel simpler and calmer than specialist enemy helmets.

Keep the minimal face neutral and focused; facial acting is not required to
communicate control, aiming or power.

### Body

Remain clothed and organized, with a clean uniform / body treatment. Do not adopt
bare-torso styling. Use only a few broad armor / clothing forms.

Avoid realistic tactical equipment.

### Weapon

The rifle remains the Player's gameplay weapon identity.

Its replacement visual should be chunky, simplified and readable at mobile
scale. It should not depend on thin barrels, rails, scopes or realistic
mechanical detail.

### Palette

Player remains in the coastal defender family:

- sea blue;
- lighter blue accents;
- navy equipment;
- warm skin;
- restrained ivory where separation from sea backgrounds is useful.

### Motion

Player motion is:

**plant → fire → recover**

Locomotion should feel controlled and deliberate. Recoil should be crisp.
Normal idle motion should remain restrained so that firing and Level-Up events
have contrast.

Hands communicate firing and recovery; large shoes communicate lane movement
through firm planting. Detached parts must still read as one controlled soldier.
Level-Up may briefly exaggerate the silhouette without changing normal motion.

### Current Phase 2B Player

`ChibiPlayerFamily` deterministically builds original low-segment ellipsoids,
rounded blocks and cylinders at runtime. No external authoring tool, texture,
Kenney geometry, UV selector or `_MOTION` attribute is required. Legacy Player
GLBs remain in the repository for rollback but are no longer downloaded by the
shipping loader.

Four primary meshes remain per defender:

- one merged body containing the head, clothed tunic, small face marks, two
  disconnected mittens and two disconnected navy shoes;
- a rounded blue helmet with a modest thicker rim and one simple rear panel;
- one shallow lower uniform wrap panel, using the existing tier colors;
- an original short, thick rifle with a directional barrel.

The helmet crown is 1.025 authored units and root scale remains 0.85. The
head/helmet zone begins at 0.505 (about 51% of standing height). Total projected
height matches Phase 2A exactly in the deterministic 390×844 portrait fixture.
This Player retains the legacy
authoring height while the future shared-unit convention awaits enemy migration.

The tunic is a short, broadly beveled soft trapezoid with a gentle top taper;
its normals follow the taper without introducing faceted shading. The lower
wrap panel replaces the inset front rectangle and reads from the rear camera.
The head sits slightly lower with a deeper rounded rear contour; the dome is
slightly smoother and the rim modestly thicker. No tactical detail is added.
Hands are flattened rounded mittens with a cheap thumb lobe and navy cuff,
all merged into the existing body draw and assigned the same moving part region.

`PlayerPresentation` selects a motion factory explicitly. `ChibiPlayerMotion`
uses the body mesh's `playerPart` attribute to translate whole shoes alternately
fore/aft and upward, counter-swing mittens and move both hands with recoil and
reinforcement readiness. Shoe centers sit slightly farther apart with a small
rest fore/aft stagger. Stride translation is 0.22 units fore/aft, up to 0.075
units upward, and up to 0.035 units outward per shoe. The head and torso stay rigid within that mesh; existing
restrained root/helmet lean and plant/fire/recover timing remain. No skeleton or
general animation framework is introduced. The legacy anatomical motion factory
is retained only in the explicit rollback/test adapter.

Presentation metadata contains only root scale, motion/material preparation,
weapon transform, muzzle anchor, tracer origin, shadow footprint and Level-Up
envelope. The rifle sits closer to the torso and has an 8° presentation yaw,
remaining forward-facing. Weapon-local grip anchors drive both hands through
the rendered weapon matrix, expressed in body-local coordinates to account for
body lean. The support hand absorbs less shot recoil and temporarily
counter-swings during lane movement. No connecting arms are introduced.
The muzzle flash is a rifle child at the barrel tip, so it follows
recoil, roll and lowering. Rifle tracer height and lateral offset derive from
the same rotated rest anchor; trajectory and projectile simulation are unchanged.
The dormant rocket member still uses its previous enlarged-rifle fallback.

Level-Up retains its aqua ring, foam motes, body/gear wash and weapon afterglow,
with radius 0.51 and a rising envelope covering the enlarged crown. Existing
800 ms burst, 1400 ms afterglow, tier and reinforcement timing remain unchanged.
One renderer-owned shared weapon material gives the rifle the main foam wash
and a smooth aqua afterglow without adding a mesh. All detached body parts,
including cuffs, share the body wash and hit material. The rifle deliberately
keeps its normal material during hit feedback. Casualties retain the refined
parts and the same weapon cant, with no ragdoll or duration change.
Player contact shadows use a 0.64×0.46 footprint to ground the shoes. Hit and
bounded casualty presentation reuse the new parts, preserving the 130 ms hit
and 360 ms knockout timing and fade semantics.

The family owns four source geometries and three materials; `CharacterAssets`
disposes them. `SquadRenderer` borrows those resources and owns its per-member
motion materials, tier/effect variants (including the weapon wash) and casualty
materials. Detached parts add no mesh draws. At the Phase 2B checkpoint,
relative to Phase 2A, matching one-defender fixtures retained 138 draws,
61 GPU geometries and 9 textures while
adding 316 triangles. Character downloads remain 19 legacy requests totaling
532,448 bytes; no texture or asset is added.

Review evidence lives in `artifacts/player-chibi-polish/`, with direct Phase
2A→2B comparisons and deterministic six-frame lane/recoil strips. The full
Level-Up/afterglow sequence and two-defender firing/movement are also sampled.
The head remains subordinate from the rear, hands remain abstract mittens, and
the forward shoe is partly occluded by the tunic at peak lifted stride. These
remain known visual compromises. Phase 2B is accepted and unchanged by Phase 3B.
Player remains unchanged by Phase 4A.

## Grunt

### Intent

Grunts are numerous, eager and absurdly cute rather than realistically
menacing.

They are the primary crimson intrusion into the beautiful coast.

### Form

- Approximately two-head proportion.
- Proportionally large helmet.
- One short, rounded egg/bean body with a simple shirt.
- Plain shorts as a darker lower color block.
- Large active detached shoes.
- Small detached spherical hands with readable swing.

### Helmet

The Grunt helmet should use an oversized rounded or pot-like family.

Dense groups should first read as a wave of moving crimson helmets.

### Face

The face may be slightly blank or awkward.

Do not communicate threat through evil facial expressions.

### Equipment

Use one main rounded body volume with a broad plain shirt and coordinated
plain shorts. The basic Grunt is clothed; bare torso and camouflage shorts are
superseded. No anatomical chest, layered costume masses, tactical vest, pouches,
straps or military detail. Hands are small spheres without thumbs or arms;
large shoes remain detached. Avoid a belt unless it clearly improves the read.

Do not add a prominent firearm while the gameplay archetype remains a
contact / charging threat.

### Palette

Use the existing raspberry / crimson enemy family as the starting point.

The color hierarchy is crimson helmet, cool muted shirt, darker companion
shorts, navy-charcoal shoes, then warm skin. The shirt must separate from sand
without becoming Player-blue or competing with the helmet. Each garment uses
one broad color: no patches, camouflage, texture noise or realistic folds.

### Motion

Grunt motion is:

**swing → stomp → hurry**

Use fast hand rhythm and fast alternating shoes to communicate effort.

Hands swing fore/aft; shoes alternate clearly. Slight delayed helmet motion may
reinforce urgency. The body can be smaller and simpler than the Player's.

The crowd should remain lively without requiring a high-cost skeletal hierarchy
per enemy.

### Current Phase 3B Grunt simplification

`ChibiGruntFamily` builds original deterministic static geometry without GLBs,
textures, external authoring, atlas UV selectors or a runtime skeleton. This is
an original human landing trooper, not a copied uniform or franchise character.
Phase 3A's bare/faceted torso, camouflage and thumb mittens are superseded;
Phase 3B is accepted as good enough for now and is frozen during Phase 4A.

One smooth-shaded ellipsoid (0.50 wide × 0.34 high × 0.38 deep) replaces the
separate torso/shorts masses. A latitude boundary divides this one volume into
plain cool gray-green shirt `#a4bcb6` and darker slate-green shorts `#526967`.
There is no belt or secondary visible gear. The required compatibility `vest`
slot is an explicitly hidden zero-vertex adapter. Live and pooled crowd meshes
honor that secondary visibility, restoring role-specific gear when a feedback slot
is reused by Heavy/Giant. Batch sharing also compares secondary visibility.

The merged body still includes the unchanged large head/tiny neutral face,
two detached spherical hands (radius 0.057), and unchanged large navy shoes.
The pot helmet, thick lip and enemy tier palette are unchanged. Crown remains
1.025 authored units; actual portrait reference height is unchanged from
Phase 3A. Skin remains Player's `ART.faction.skin`. No lighting/world change is
used to create the new clothing contrast.

Four authored rigid poses retain shoe translation up to 0.16 fore/aft and 0.08
upward, hand counter-swing up to 0.125, the 360 ms `enemyRunFrame` clock,
asynchronous ID phase and existing Grunt root lean/bob/sway. No motion timing
or gameplay changes. `CrowdPresentation` retains vertex colors and neutral
white body instance tint. Contact uses these revised reference parts; death
uses their grayscale copy. The 80 ms helmet hit, 240 ms contact, 480 ms death,
48-slot feedback pools and DeathBurst semantics remain. Shadow stays 0.68×0.42.

The family still owns eight source geometries (including the empty adapter)
and three matte materials, disposed by CharacterAssets. EnemyRenderer owns
its instancing buffers/cloned gear and feedback materials. No new texture or
asset download is introduced. Grunt remains unchanged by Phase 4A; Heavy/Giant
now own dedicated procedural resources and Boss remains legacy.

Review evidence lives in `artifacts/grunt-chibi-simplify/`: Phase 3A/3B isolated
and crowd comparisons, Player/Grunt colors and silhouettes, plain clothing
inspection, full gait strip, mixed Heavy, near-contact and outer-lane views,
feedback, untouched-role guards and matching performance metrics. Further Grunt
refinement requires separate authorization.

## Heavy

### Threat review boot path

`?review=threats` is an explicit art-review/debug start, not normal balance.
The app restores validated Level 7 / 0 current-level XP with arrived reinforcement,
two defenders and seed `0x4a070`. Grunt (lane 4, depth 8), Heavy (lane 3, depth 12)
and Giant (lane 1, depth 22) immediately enter ordinary combat. Retry reconstructs
the same initialization. Normal URLs retain Level 1 and normal encounter timing.
No review flag, combat override or new HUD label is serialized or introduced.

### Intent

Heavy is a priority pressure threat: a short, very wide walking wall.
It must remain a distinct archetype rather than an enlarged Grunt.

### Form

Heavy remains part of the same two-head family, but differs primarily through
width and mass.

- only slightly taller than Grunt, if at all;
- significantly wider;
- thicker helmet;
- wider compact torso;
- larger hands;
- heavier shoes.

### Helmet

The Heavy helmet is its strongest identifier.

Use a wide, low crimson dome, thick double-layer rim and one broad muted-ochre
brow. Keep the profile compressed and heavy, without tactical detail or spikes.

### Body

Heavy belongs to the same landing force, with warm human head and hand cues.
Use one squat rounded drum/bean, simple deep-crimson shirt and plain dark
slate/navy lower region. No bare-torso base, camouflage, straps or pouches.
One broad rounded muted-ochre chest/belly guard is enough. Large hand balls and
wide shoes carry the mass; avoid long legs or enclosed fantasy armor.

The silhouette priority is helmet → width → body mass → hands / shoes → equipment.

Do not simply enlarge the Grunt torso.

### Palette

Heavy remains visibly enemy-aligned.

Deep crimson remains dominant. Ochre / yellow armor may be retained as a muted
role accent, less celebratory than the UI's sunlight / progression gold. This
does not call for noisy grunge or muddy military browns.

### Motion

Heavy motion is:

**shift → plant → push**

Use slower cadence, lower bounce and stronger weight transfer.

Surviving hits should feel absorbed rather than springy.

The face is small and compressed under the helmet, preferably calm or deadpan.
Hands and shoes move more slowly and carry more mass than a Grunt's. Do not add
a large firearm automatically: current Heavy threat comes from its role,
durability and movement, not an invented ranged attack. Death may release that
stored mass through presentation without changing combat resolution.

### Current Phase 4A Heavy prototype

`createChibiHeavyFamily` in `ChibiThreatFamilies` owns a reference body, four
650 ms rigid locomotion poses, grayscale death body, dedicated low double-rim
helmet and one belly guard. The merged body contains one 0.68×0.46×0.47 rounded
drum, human head/tiny eyes, two 0.10-radius hand balls, and two 0.32×0.14×0.38
shoes on a wide stance. There is no weapon or secondary waist gear.

Authored colors are crimson shirt `#9d3045`, slate/navy shorts `#303e4c`,
crimson helmet `#b9324c`, muted ochre `#b09a63`, existing warm skin and navy shoes.
Body and gear use neutral instance tint, preserving their broad vertex regions.
The helmet crown is 0.99; presentation compresses legacy projected Y by 0.80
without changing collision or simulation scale. At equal portrait depth the
standing silhouette measures 1.28× Grunt height and 1.73× width.

The 650 ms asynchronous clock and existing low root bounce/weight transfer
remain. Four poses alternate shoes by up to 0.10 fore/aft and 0.035 upward;
fists counter-swing by 0.085. Rate-limited hits retain 100 ms / 250 ms timing,
using the actual active Heavy pose and a small 2.5% compression. Contact uses
its reference silhouette; death uses its grayscale parts and existing 480 ms
fade. The 48-slot pools rebind explicit role parts. HP layout comes from Heavy
metadata (top 1.025, width 0.78 before projected scale), with existing bar style
and HP fraction. A 0.84×0.44 authored footprint grounds the shoes.

Heavy has a separate instanced batch because its resources differ from Grunt.
Eight geometries and three materials are owned/disposed by CharacterAssets;
renderers borrow them and own instancing/effect resources. No texture, GLB,
Kenney atlas selector, skeleton or per-enemy hierarchy is used.

## Giant

### Target and current Phase 4A Colossus prototype

Giant is not a scaled Heavy. Its three dominant ideas are one huge crest helmet,
one massive rounded clothed body, and one offset blunt maul. One chest plate
supports that hierarchy. No shoulder forest, spikes, little plates or belt kit.

`createChibiGiantFamily` owns dedicated original reference/four locomotion bodies,
grayscale reference, helmet/crest, chest plate, maul, and a merged body/maul
contact adapter: ten geometries and three matte vertex-color materials.
It consumes no Grunt, Heavy or legacy normal-soldier geometry.
The body is one 0.84×0.64×0.58 rounded mass with dark crimson `#862d40` clothing
and the same slate lower block. Head/hands stay human; shoes are structural
0.38×0.17×0.45 blocks. The warm head begins at 0.72, crest crown is 1.355
(approximately 47% head/helmet zone). The helmet has one broad longitudinal
muted-ochre fin and thick rim; the front crest still reads narrower than its side.
The maul has one thick navy handle, broad crimson rounded head and one ochre
hardware band, evoking broad coastal hardware rather than a historical object.

Three dedicated bounded render slots retain two live Giants plus a recent fall.
Each has four primary mesh draws: posed body, crest helmet, chest plate, maul.
The 850 ms asynchronous gait retains `giantWeightPose`, low body compression,
delayed helmet response and maul rotation around a hand-height pivot. Shoes
alternate up to 0.10 fore/aft and 0.035 upward; hands swing more slowly.
The 1.5-second reveal/HP delay remains, with haze heights derived from the new
motion envelope. Hit registration follows the dedicated active body matrix;
body/gear share a restrained emissive response and existing bounded hit timing.

Fall/crash timing remains 90–520 ms, crash at 520 ms, breakup at 650 ms and
clear at 2400 ms. The existing impact ring, reused haze/dust, burst and restrained
camera/audio impulse remain. Six broad instanced crest/plate/maul-color chunks
replace twelve miscellaneous fantasy armor pieces. Contact includes the maul
inside its bounded three-mesh representation. HP layout uses a tested full
motion envelope 1.60 wide × 1.43 high × 0.96 deep rather than construction-only
bounds. The shoe/body shadow footprint is 1.02×0.48 authored units.

Phase 4A review evidence is in `artifacts/threat-chibi-prototype/`: 390×844
opening/Level-7 HUD, live normal/review/Retry, side-by-side composition, source
inspection, actual-projection silhouettes and helmet comparison, complete gait
strips, hit/death/contact/reveal/crash/bar views and matching 50/100/150/200
crowd and two-Giant metrics. Player, Grunt and Boss render guards remain
pixel-identical, including protected feedback states and the world-only view.
Heavy/Giant are prototypes pending human review, not a final polished design.

## Animation principles

Motion readability matters more than skeleton realism.

Hands and shoes may act as independent visual punctuation.

The system should preserve bounded mobile rendering cost.

Static pose families, instancing and inexpensive procedural transforms remain
valid strategies.

Do not introduce complex runtime skeletal characters merely because the visual
style changed.

## Material principles

Characters should remain compatible with the coastal scene:

- predominantly matte surfaces;
- broad color regions;
- minimal metallic response;
- strong sunlight readability;
- cool shadow separation;
- little or no fine texture noise.

The visual identity comes from shape, color and motion rather than surface
microdetail.

## Technical asset contract

### Current runtime adapters

`CharacterAssets` assembles explicit procedural `player`, `grunt`, `heavy` and
`giant` families and a named legacy `boss` record. Boss keeps dedicated idle,
run/slam and vest resources, shared legacy helmet and gray-body material;
reward helmets retain a separate legacy reference. The superseded normal idle,
four run GLBs and normal vest are no longer downloaded; repository assets and
legacy rollback/test adapters remain intact. Thirteen required legacy GLBs
remain for Boss, rewards and projectiles.

Crowd batches share resources only when their geometry, materials, tint policy
and secondary visibility match. Distinct Heavy and Grunt resources split cleanly.
Death/contact parts are explicit per role and pooled effects rebind borrowed
resources. Gait, authored gear tint, Heavy Y compression/HP layout, threat shadow
footprints and Giant motion bounds are presentation metadata only. Player uses
its existing specific motion/weapon/effect contract; Boss retains legacy pivots
and atlas handling. No generalized character engine or external manifest exists.

### Ownership and role selection

The future contract is renderer-owned presentation data, versioned independently
of gameplay snapshots. Logical role identifiers are `player`, `grunt`, `heavy`,
`giant` and `boss`. Tank uses the world-object contract,
not a humanoid role by default.

Each role resolves a named visual family. Runtime selection must use names, not
positions in an asset array. Sharing is an explicit asset reference, not a
fallback inferred from another role's geometry. Heavy and Giant now resolve
dedicated procedural resources independently of Grunt. Legacy borrowing remains
only in the explicit rollback/test assembly.

Simulation continues to provide gameplay truth through the existing render
projection. The art contract contains no HP, damage, collision/targeting radius,
speed, fire rate, XP, lane rules, reinforcement grants or progression formulas.
An HP-bar anchor positions a bar; it does not define health or when a bar appears.
Helmet tier appearance consumes an existing presentation selector; it does not
calculate power or introduce tier gameplay.

### Manifest contents

A future role manifest declares the following information. This is a documented
contract, not a manifest loader or new runtime interface in Phase 0.

| Field | Responsibility |
| --- | --- |
| Contract version, role and family identifier | Named selection and validation |
| Parts | Required body and role helmet; optional vest, left/right hand, left/right shoe and weapon |
| Pose families | Named idle/locomotion samples and any explicitly supported action samples |
| Material regions | Faction primary/accent, skin, equipment, weapon, face and other declared visual regions |
| Presentation anchors | Part/action/effect positions in the documented local frame |
| Bounds | Rest bounds, full motion envelope and any distinct corpse envelope |
| Shadow | Ground center and X/Z footprint, independent of character height |
| Feedback representations | Explicit death/contact geometry or reuse policy and pose selection |
| Resource references | Shared geometry/material references and ownership for disposal |

Hands and shoes may be separate parts or integrated into a static pose. The
manifest must say which; do not render both representations. A weapon is
optional, so unarmed Grunts/Heavies do not inherit a Player rifle. An optional
part's absence is deliberate; required geometry or anchors must fail loudly if
missing rather than silently substituting Grunt assets.

Death/contact representations may reuse the role's idle geometry, capture an
active static pose, or name dedicated geometry. The choice must be explicit and
preserve role identity, attachments, palette and scale. Surviving-hit overlays
must follow the resolved active geometry and transforms. Reused geometry remains
borrowed; renderers dispose their owned overlays, pools and material variants.

### Naming and static asset boundary

Suggested future layout is `public/models/characters/<role>/`, with descriptive
names such as `body-idle.glb`, `body-locomotion-0.glb`, `helmet.glb` and
`weapon-rifle.glb`. Pose order is listed explicitly in the manifest; it is not
inferred from filenames. A manifest may reference a shared asset elsewhere.
These paths are reserved examples; no files are created there in Phase 0.

Exports should be static, with transforms baked into the common character frame.
Use one mesh/primitive per intended geometry/material batch. No runtime skeleton
or animation clips are required. Multiple material regions must have a declared
batch or shader strategy; arbitrary GLTF hierarchies and material arrays are not
implicitly supported. URLs continue through the existing public-asset base-path
policy.

Each pose uses the same origin, units, part membership and material-region
meaning. Discrete geometry switching can allow different vertex counts; any
future morph interpolation requires matching topology and is a separate choice.
Do not independently center or normalize poses. Four frames are the legacy
baseline, not a permanent requirement: declare a small pose count per family and
budget its batches before increasing it.

Palette regions should use explicit material/vertex-region information. New
designs must not depend on Kenney-specific UV coordinates or height-based
hair/leather selection. Textured assets are allowed if their region mapping is
declared. Apply the same region meaning to all pose and feedback representations.

## Coordinate convention

Future character assets share this authoring convention:

- origin `(0, 0, 0)` = center of ground contact;
- +Y = up; +Z = forward; +X = character-left when facing +Z;
- one authored unit = the reference Grunt's standing ground-to-helmet-crown
  height, excluding weapons and secondary ornaments;
- Player and Heavy use those same units, with width and small height differences
  authored into their geometry rather than normalizing each part independently;
- body, helmet, hands, shoes and weapon use the common character-local frame;
- renderer placement/facing and whole-character presentation scale are applied
  once at the role root, independently of simulation collision.

The one-unit reference is a technical unit convention, not an exact two-head
ratio or a change to current world sizes. A legacy adapter preserves the existing
assets' coordinates and renderer transforms during Phase 1. Do not rebake or
renormalize shipping files merely to adopt the contract.

Presentation anchors should be centralized rather than scattered through
renderer-specific magic coordinates.

| Anchor | Consumer |
| --- | --- |
| Head/helmet center | Helmet fitting and secondary motion |
| Left/right hand | Action placement and hand rhythm |
| Left/right shoe | Foot planting and optional ground effects |
| Weapon grip and muzzle | Weapon placement, recoil, muzzle flash and tracer presentation |
| HP-bar top | Bar positioning above the full role silhouette |
| Visual hit center | Presentation fallback when exact impact coordinates are unavailable |
| Shadow center and footprint | Grounding stamp placement and size |
| Effect center / Level-Up origin | Body wash, rings and other presentation effects |
| Corpse/fall pivot | Death/contact placement and collapse |

The base anchors and bounds live in one role metadata record. Poses may override
anchors where baked parts move. Independently animated parts bind their anchors
to the same part transform: the muzzle follows weapon recoil/readiness rather
than remaining a separate fixed point. Rotation uses the declared pivot in the
common frame; consumers must not apply the root or part transform twice.

Head, hit, shadow, effect and fall placement are declared for every family.
Hand/shoe anchors are required when those parts animate independently; grip and
muzzle are required when a weapon is present. HP-bar placement is declared when
that role's presentation uses a bar. Ground-ring origins remain on the ground;
body-effect centers can be separate. No anchor modifies projectile simulation.

Record an envelope across all supported poses and independently moving parts,
including helmet/weapon extremes. Use that envelope when validating bars,
framing and occlusion; do not measure only the initial idle mesh. Shadow
footprints are authored separately and do not grow merely because the head is
taller. Corpse bounds cover the fall/collapse presentation where applicable.

This does not require a general-purpose skeletal engine.

## Performance rules

Mobile portrait is the primary target.

Grunt crowds must remain batchable.

A redesign must not casually replace instanced crowd rendering with large
numbers of independent high-draw-call animated objects.

Prefer:

- small static pose sets;
- instanced role parts;
- shared materials;
- simple procedural offsets;
- bounded visual pools.

Batch by role, pose and material/part where needed, not by entity. Detached hands
and shoes do not justify one scene hierarchy or material per Grunt. Consolidate
parts when that preserves motion and reduces draw cost. Phase 1's legacy adapter
must retain the existing shared Grunt/Heavy batches while their assets match;
distinct families can split batches only when required.

Measure readability and cost from the real portrait camera.

Later replacement acceptance includes actual-size black silhouettes, helmet-only
role identification, dense crowds, two defenders, hit/death/contact states,
Level-Up and reinforcement. Compare draws, triangles, textures and frame/CPU
timing in matching 50/100/150/200-enemy portrait fixtures. Include two live
Giants and a recent collapse. Do not change population or gameplay to hide cost;
software-renderer results are not physical-phone performance claims.

Asset validation should cover named roles, required parts/anchors, static mesh
format, pose declarations, finite coordinates, material regions, enclosing
bounds and borrowed-resource ownership. Replace geometry-specific hash/UV tests
only when their visual family is intentionally replaced; retain deterministic,
snapshot and gameplay tests.

## Extension rules

### Giant

Giant must remain in the same super-deformed helmet-first universe.

It must not become a scaled Heavy.

Its crest, bell body and blunt maul establish a distinct large-form hierarchy
while retaining the common face, material and motion grammar described above.

### Boss

Boss remains in the two-head family.

Boss identity may use a more elaborate helmet, weapon and animation hierarchy,
but must not revert to realistic human proportions.

### Tank

Tank should use the same large-shape philosophy as the coastal world.

It should be chunky, simplified and readable rather than a photorealistic
modern military vehicle.

## Implementation phases

### Phase 0 — Visual Bible and asset contract

Freeze this document and the Coastal Greek Object Language.

Define technical ownership and naming without replacing shipping character art.

### Phase 1 — Runtime role separation

Refactor asset loading / renderer selection so Player, Grunt, Heavy, Giant and Boss own
separate visual families while the current shipping appearance remains intact.

Introduce named role resolution and legacy pose, gait and feedback dependencies.
Retain current attachment pivots and bounds calculations. Preserve Player's current `_MOTION` shader, shared
Grunt/Heavy batches, and Giant/Boss legacy dependencies, including shared helmet,
gray materials and feedback geometry. No new silhouette,
palette, cadence, source bake or gameplay change belongs to this phase.

### Phase 2 — Player

Introduce the new Player family and recalibrate weapon, muzzle, shadow,
Level-Up, reinforcement and casualty presentation.

Replace the Player's old anatomy-dependent pivots/weights only with the selected
new family's motion strategy. Validate the weapon and its muzzle together.

Phase 2A's core direction and Phase 2B's refined Player grammar are accepted.
Player remains unchanged during the separately authorized Phase 3 Grunt passes.

### Phase 3 — Grunt

Introduce the new Grunt family while preserving crowd batching and portrait
readability.

Keep the legacy Heavy, Giant and Boss families pinned to their existing geometry
until their own approved replacement. Changing Grunt must not silently restyle
those consumers. Include role-correct hit, death and contact representations.

Phase 3B implements the accepted simplified Grunt described above. It remains
frozen while Heavy and Giant are reviewed.

### Phase 4A — Heavy and Giant prototypes

Dedicated Heavy and Colossus geometry, role metadata and feedback are implemented
with the explicit Level-7 threat review path. Visual dimensions do not authorize
new collision or lane behavior. Stop for human review before further polish.

### Phase 5 — Limited world-language pass

Apply the Coastal Greek Object Language to the clearest mismatched non-character
object family without reopening the whole environment.

Boss and Tank redesign remain deferred. Giant's Phase 4A prototype also requires
human review before further refinement.

Phase 4A explicitly includes Giant alongside Heavy. Legacy dependencies were
isolated in Phase 1 before replacement. Each later phase
requires explicit authorization and its own acceptance checks. Phase 1 does not
authorize Player replacement or any Phase 2+ character art.
