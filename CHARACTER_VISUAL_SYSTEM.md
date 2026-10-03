# TopWar Character Visual System

## Status

This document defines the canonical character-art direction for TopWar's
Beachhead Defense presentation.

Phase 0 freezes the visual direction and future asset contract only. Shipping
assets, runtime rendering and gameplay are unchanged. Phase 1 requires a separate
instruction; the plan below does not authorize implementation.

It supersedes the earlier three-head designer-toy direction while preserving the
existing gameplay model, faction semantics and Sunlit Coastal Battlefield
environment.

Implementation is staged. This document defines the target system; it does not
mean every character family already uses it.

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
with slightly absurd effort within the two-head system. Exposed warm skin and
simple human anatomy make that humanity readable beneath oversized helmets;
avoid monsters, robots and anonymous armored blobs.

Derive an original visual family. Do not copy Republic of China Marine Corps
uniforms, real unit insignia or patches, exact helmet models, exact camouflage
patterns, rank markings or identifiable contemporary military loadouts.
Camouflage uses only a few broad original shapes that read at mobile scale.
Helmet-first identity matters more than uniform detail.

Faction contrast is intentional: Player is the organized, clothed coastal
defender; enemies are improvised, aggressive amphibious landing infantry. Both
sides remain visibly human, cute and absurd rather than a realistic war simulation.
Exposed enemy skin must retain enough value / hue separation from warm sand under
the actual coastal lighting.

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
the enemy bare-torso language. Use only a few broad armor / clothing forms.

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

## Grunt

### Intent

Grunts are numerous, eager and absurdly cute rather than realistically
menacing.

They are the primary crimson intrusion into the beautiful coast.

### Form

- Approximately two-head proportion.
- Proportionally large helmet.
- Small compact body with a generally bare upper torso.
- Original, simplified camouflage shorts.
- Large active shoes.
- Readable detached hand motion.

### Helmet

The Grunt helmet should use an oversized rounded or pot-like family.

Dense groups should first read as a wave of moving crimson helmets.

### Face

The face may be slightly blank or awkward.

Do not communicate threat through evil facial expressions.

### Equipment

Use an exposed skin torso, simplified camouflage shorts, large shoes and
simplified / detached hands beneath the oversized helmet. Do not cover Grunt in
a conventional military vest unless a later gameplay role requires it.

Keep equipment minimal. Shorts should read as "camouflage shorts" through a few
broad patches, without historical or national identification.

Do not add a prominent firearm while the gameplay archetype remains a
contact / charging threat.

### Palette

Use the existing raspberry / crimson enemy family as the starting point.

The color hierarchy is helmet / enemy-role color, warm human skin, camouflage
shorts, then dark shoes / small equipment. Keep exposed skin readable against sand.

Avoid dirty military browns and global desaturation.

### Motion

Grunt motion is:

**swing → stomp → hurry**

Use fast hand rhythm and fast alternating shoes to communicate effort.

Hands swing fore/aft; shoes alternate clearly. Slight delayed helmet motion may
reinforce urgency. The body can be smaller and simpler than the Player's.

The crowd should remain lively without requiring a high-cost skeletal hierarchy
per enemy.

## Heavy

### Intent

Heavy is a priority pressure threat and must become a separate visual archetype.

The final Heavy must not be a Grunt body enlarged through XYZ scaling.

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

It may use a broad brim, thick side protection, ridge, crest block or similarly
large geometric features.

Use one or two unmistakable large forms rather than many small decorations.

### Body

Heavy belongs to the same landing force and retains visible human skin beneath
large equipment. It must not become a large bare-chested Grunt or a fully enclosed
armored fantasy unit.

A broad harness, one or two heavy straps, partial chest plate, heavy waist armor
/ belt and reinforced short camouflage trousers may surround a substantially
exposed torso. Larger gloves / hands and shoes support its independent silhouette.
Prefer a few large forms over conventional detailed tactical kit.

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

### Ownership and role selection

The future contract is renderer-owned presentation data, versioned independently
of gameplay snapshots. Logical role identifiers are `player`, `grunt`, `heavy`,
and, when implemented, `giant` and `boss`. Tank uses the world-object contract,
not a humanoid role by default.

Each role resolves a named visual family. Runtime selection must use names, not
positions in an asset array. Sharing is an explicit asset reference, not a
fallback inferred from another role's geometry. Phase 1 may explicitly alias
Heavy to the existing Grunt family to preserve shipping appearance; Phase 4
must replace that alias with dedicated Heavy body and helmet geometry.

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
timing in matching 50/100/150/200-enemy portrait fixtures. Include two live legacy
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

Its future silhouette should introduce a new large-form hierarchy while
retaining the common face, material and motion grammar.

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

Refactor asset loading / renderer selection so Player, Grunt and Heavy can own
separate visual families while the current shipping appearance remains intact.

Introduce named role resolution and centralized legacy metadata for attachments,
bounds and feedback. Preserve Player's current `_MOTION` shader, shared
Grunt/Heavy batches, and Giant/Boss legacy dependencies, including shared helmet,
gray materials and feedback geometry. No new silhouette,
palette, cadence, source bake or gameplay change belongs to this phase.

### Phase 2 — Player

Introduce the new Player family and recalibrate weapon, muzzle, shadow,
Level-Up, reinforcement and casualty presentation.

Replace the Player's old anatomy-dependent pivots/weights only with the selected
new family's motion strategy. Validate the weapon and its muzzle together.

### Phase 3 — Grunt

Introduce the new Grunt family while preserving crowd batching and portrait
readability.

Keep the legacy Heavy, Giant and Boss families pinned to their existing geometry
until their own approved replacement. Changing Grunt must not silently restyle
those consumers. Include role-correct hit, death and contact representations.

### Phase 4 — Heavy

Introduce dedicated Heavy geometry, helmet and motion.

Heavy must no longer depend on scaled Grunt geometry as its final presentation.

Recalibrate its HP-bar, shadow and feedback from Heavy metadata. Visual width
does not authorize new collision or lane behavior.

### Phase 5 — Limited world-language pass

Apply the Coastal Greek Object Language to the clearest mismatched non-character
object family without reopening the whole environment.

Giant, Boss and Tank redesign remain deferred until the base visual grammar is
stable.

The Phase 0-5 order is unchanged. The only planning clarification is to isolate
legacy dependencies in Phase 1 before replacing the Grunt. Each later phase
requires explicit authorization and its own acceptance checks; stop after
Phase 0 for the current task.
