# TopWar Coastal Greek Object Language

## Status

This document defines the reusable object language for the Sunlit Coastal
Battlefield.

It expands the existing environment direction beyond architecture so that
civilian objects, ships, military intrusion and future defensive structures
belong to one visual world.

Phase 0 establishes design rules only. Current environment layout, ships,
camera, UI and gameplay remain unchanged. This document does not introduce
defense structures, vehicles, persistent damage or new simulation systems.

[SUNLIT_COASTAL_ART.md](SUNLIT_COASTAL_ART.md) remains canonical for the coastal
palette, lighting, composition and UI guardrails.
[CHARACTER_VISUAL_SYSTEM.md](CHARACTER_VISUAL_SYSTEM.md) defines the original
helmet-first, two-head character family and the implementation sequence.

## Core idea

**Civilian Mediterranean first. War second.**

The settlement existed before the battle.

Its native language is bright, calm, sunlit and civilian.

War enters that language through occupation, improvisation, smoke, fire,
weapons, damage and enemy color.

Military objects should therefore feel like they belong to, entered or were
adapted to this particular coast.

They should not resemble generic assets imported from an unrelated military
game.

## Visual pillars

The world is built from:

- warm white plaster;
- pale stone and sand;
- turquoise water;
- blue-painted accents;
- cool navy shadows;
- olive vegetation;
- natural wood;
- rope;
- light canvas and cloth;
- strong sun;
- simple large geometry.

The first visual read should remain bright and beautiful.

War is the visual interruption.

## Shape language

Prefer a few large readable forms.

Native architectural shapes include:

- thick rectangular plaster masses;
- flat roofs;
- low parapets;
- short terraces;
- steps;
- inset doors;
- recessed windows;
- simple arches;
- small platforms;
- chunky retaining walls;
- simple timber braces.

Edges may be slightly softened or irregular, but objects should not dissolve
into noisy hand-weathered detail.

Silhouette matters more than surface complexity.

## Material language

### Plaster / masonry

Warm off-white, matte and sunlit.

Use restrained chips or worn edges.

Do not make the village broadly ruined or dirty.

### Pale stone / sand

Use for ground interfaces, improvised barriers and heavier local construction.

Keep it warm and light.

### Painted coastal surfaces

Sea blue, aqua and cyan may appear on:

- doors;
- shutters;
- trim;
- small boat structures;
- cloth;
- selected utility objects.

### Wood

Simple sun-dried timber.

Use as:

- braces;
- poles;
- crates;
- temporary supports;
- barricade elements.

### Rope

Use selectively as a coastal / harbor construction cue.

It should support silhouette, not become small decorative noise.

### Cloth / canvas

Use pale ivory, muted cyan or related coastal colors.

Appropriate for:

- awnings;
- temporary shade;
- improvised defensive covers;
- supply wrapping.

### Metal

Use only where function requires it.

Prefer dark navy-charcoal or restrained painted metal rather than dominant
industrial gray.

Metalness and high-gloss response should remain low.

## Color hierarchy

### Native world

- warm plaster / ivory;
- pale sand;
- turquoise;
- sea blue;
- navy shadow;
- olive green;
- natural wood;
- rope tan.

### Secondary accents

- cyan cloth;
- blue-painted doors / shutters;
- small flower accents outside combat space.

### War intrusion

- enemy crimson;
- charcoal smoke;
- localized scorch;
- fire orange;
- blood / impact residue where appropriate.

These are visual vocabulary for separately scoped work, not a requirement to add
gore or a residue/damage system. Enemy health remains crimson/red; sunlight/gold
is a rare positive accent governed by the existing coastal UI rules.

Do not introduce unrelated strong industrial palettes.

Avoid:

- broad military olive-green scenes;
- yellow / black hazard striping;
- large generic steel-gray objects;
- neon sci-fi colors.

## Damage philosophy

The world is not ruined by default.

Damage is local and narrative.

Use:

- fresh impact chips;
- scorch;
- smoke;
- fire;
- small localized cracking;
- displaced objects;
- temporary debris.

Do not apply a global grunge layer.

Do not convert intact Mediterranean architecture into universal rubble merely
to communicate war.

Beauty remains the canvas.

War remains the violation.

## Architecture

Architecture remains the clearest expression of the world language.

Continue using:

- white / warm plaster;
- thick walls;
- compact asymmetric building masses;
- exterior steps;
- small terraces;
- low parapets;
- blue / cyan openings;
- selective arches;
- cool shadows.

Buildings should feel civilian and inhabited, not like military structures
disguised with white paint.

## Naval object language

Current Phase 4B landing craft and three distant transports use the painted-boat
palette: sea-blue hulls, ivory upper sides/cabins, blue-gray wells/openings, small
aqua bevel accents and a sun-worn timber ramp. Existing low functional masses,
placement and approach timing remain; no architectural geometry is reused.

Ships and landing craft must belong to the same world while remaining clearly
functional military objects.

Do not literally reproduce architectural shapes on ships.

Instead transfer the higher-level rules:

- few large masses;
- simple silhouette;
- painted surfaces;
- restrained industrial detail;
- sun-readable planes;
- Mediterranean-compatible palette.

Useful conceptual vocabulary includes:

- island ferry;
- harbor patrol craft;
- coastal workboat;
- supply vessel;
- simplified landing craft.

Avoid the silhouette language of a highly detailed generic modern battleship
unless gameplay specifically requires it.

### Hulls

Use broad clean hull shapes.

Avoid dense panel seams, rail forests and mechanical clutter.

### Superstructure

Use a few large cabins / blocks.

Pale painted surfaces, navy / sea-blue secondary forms and restrained dark
hardware are preferred.

### Military conversion

Weapons, ramps and assault equipment may be added as clear functional forms,
but should not overwhelm the coastal design language.

The viewer should read:

"an invasion craft from this world"

rather than:

"a generic warship asset placed in this level."

R3 hides the old dark `BridgeEnvironment.buildActivity()` warship unconditionally
in coastal defense; it remains available with its existing activity/occlusion in
legacy mode. Aircraft/flak and the Mediterranean `OffshoreTransports` landing
craft/carriers remain. Openings use plaster frames and painted cyan leaves with
small secondary-navy cores, rather than large deepest-shadow slabs.

## Future defensive structures

Defenses should feel locally improvised or integrated into the settlement.

Useful visual vocabulary:

- whitewashed low wall;
- pale stone emplacement;
- sand-colored block;
- firing step;
- reused terrace;
- timber brace;
- rope;
- canvas;
- blue awning;
- local crate stack;
- harbor object repurposed as cover.

Avoid defaulting to:

- modern military-base bunker kits;
- green sandbag fields;
- corrugated industrial compounds;
- generic gray pillboxes;
- hazard-striped barriers.

A defense should look as if the village built it with materials already present
on the coast.

## Supply objects and barriers

Future crates, barriers and pickups should derive from the same local palette
and materials.

Good starting materials:

- pale wood;
- plaster;
- pale stone;
- rope;
- canvas;
- navy / blue paint;
- warm sand tones.

Avoid making military-green steel boxes the universal supply language.

Gameplay readability remains more important than strict realism.

## Vehicles

Future vehicles should inherit the same large-form discipline.

A vehicle may use metal because it is a vehicle, but should still use:

- few large shapes;
- broad painted color regions;
- low microdetail;
- coastal palette compatibility;
- strong silhouette;
- sunlight-readable surfaces.

Do not add photoreal military vehicles to a stylized civilian coast.

## Tank extension

A future Tank should feel like a chunky war machine from this visual universe.

It should not be a realistic scale model.

Prefer:

- oversized readable tracks / wheels;
- one strong hull mass;
- one strong turret mass;
- simplified barrel;
- broad painted surfaces;
- minimal small hardware.

The Tank must still read instantly as a Tank.

Style should simplify function, not obscure it.

## Relationship to character art

Characters and world objects share these principles:

- large readable forms;
- low visual noise;
- matte materials;
- strong color grouping;
- readable silhouettes;
- exaggerated function;
- mobile-scale clarity.

They do not need identical geometry.

Characters are rounder, cuter and more animated.

Architecture and props are more structural.

The same sunlight, palette discipline and simplification make them belong
together.

## Relationship to UI

UI remains governed by Plaster + Sea + Sunlight.

Do not redesign UI as part of this object-language pass.

The connection is semantic:

- plaster = structure;
- sea / aqua = player progression;
- navy = readability / shadow;
- sunlight = rare positive accent;
- crimson = enemy pressure.

## Scope

This document defines rules for future work.

It does not authorize an immediate full environment rebuild.

Current architecture and UI remain provisional baseline.

The first implementation pass beyond characters should target the most visibly
mismatched object family, likely ships / landing craft, and should remain a
small independently revertable phase.

Phase 5 follows the Player, Grunt and Heavy pivots and requires a separate task.
Select one object family after reviewing it in the actual portrait camera;
ships/landing craft are the likely candidate, not an instruction to rebuild
all naval assets now. Keep existing function, timing and gameplay unchanged.

Future defenses are conditional vocabulary. The current civilian beach remains
unprepared, with no added fortifications or central-corridor clutter. Review any
later props against existing track clearance, enemy/defender visibility and HP/
XP presentation. Giant, Boss and Tank rules remain extensions, not active work.
