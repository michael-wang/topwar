# Sunlit Coastal Battlefield

Art Phase 1.1 is a **defense-mode presentation cleanup**. The direction is a
sunlit stylized Mediterranean coastal diorama: **a beautiful coast under
violent assault**. The supplied reference informs color, shape hierarchy and
breeze, not its village, assets, layout or identity. All scenery is original
procedural geometry/shading. No reference pixels or downloaded textures ship.

## Palette and value hierarchy

`ART.coastalDefense` in `src/art/ArtDirection.ts` owns the coastal palette.
Faction colors, XP colors and the legacy bridge palette stay independent.

| Family | Colors |
| --- | --- |
| Plaster / pale concrete | warm off-white `#F1EFE6`, shaded pale concrete `#C5CDD0` |
| Sand | sunlit `#D8C49B`, restrained shade/scuffs `#B69D78` |
| Water | shallow aqua `#58C8C1`, deep sea `#247E9C`, highlights `#C4EFDF`, foam `#E5F6EE` |
| Atmosphere | sky `#78BDE0`, horizon `#B7D8E3` |
| Graphic shadows | navy `#2C4158`, secondary blue-gray `#405A6D` |
| Olive / vines | dark `#294735`, lighter `#507455`, bark `#685A45` |
| Fabric / accent | cyan `#84CBD4`, ivory `#E1E5D6`, side flowers `#C51E67` |
| War damage | rust `#985E49`, charcoal `#3A4348`, scorch `#53606A`, fire `#F58A48` |

The first reading must be sand, off-white architectural masses, turquoise sea
and blue sky. Vegetation provides dark green side framing. Saturation belongs
primarily to water, foliage, sparse fabric/flowers, fire and gameplay entities.
Never place decorative red/magenta inside combat corridors. Avoid pure white
architecture, dead-black building masses, noisy grunge or gray overall grading.

## Shapes, materials and lighting

Use a few large forms that remain recognizable at 390×844: square whitewashed
building masses, low parapets, thick open arches, cyan shutters, short terraces,
broken walls and two wrecked machine silhouettes. Damage is missing edges,
tilted slabs and broken gear, not many tiny rubble cubes. Layout is asymmetric,
stable between runs and adapts outward from the configured track edge.

Environment surfaces use `illustratedMaterial()` with roughness 1 / metalness 0
and broad tonal washes. `paintedBlockGeometry()` supplies restrained bevels and
chips. Sand retains the generated quiet cream/ochre wash. No photorealism,
texture-noise layers, full-screen postprocessing or per-enemy shadow maps.

Defense lighting uses warm sunlight from (-8,12,-6), intensity 2.2, sky fill
`#C5E5F2` / cool ground fill `#405A6D`, hemisphere intensity 1.65. Renderer output
is explicitly sRGB; defense uses ACES filmic highlight rolloff at exposure 1.35.
Legacy mode restores its original lights and NoToneMapping. Hero water/sky and
painted navy wall faces bypass filmic mapping so their authored color blocks
stay clear. Static navy ground patches suggest building, arch, cloth and olive
shadows. Existing character contact shadows remain; no new shadow render pass.

## Composition and gameplay readability

Dark/detail-rich side frame → open bright sand combat channel → turquoise sea
and pale horizon. All opaque architecture/gear stays at least 0.4 world units
outside the track; foliage/cloth also stay outside. Review this from the actual
portrait camera, not only a wide desktop view. Never cover defenders, nearby
outer-lane enemies, health bars or the XP spectacle with environment props.

The settlement was civilian and did not expect war. The central five corridors
keep only quiet sand scuffs: no X-shaped anti-landing obstacles or prepared beach
fortifications. Scorch, wreckage and broken architecture represent consequences
of the assault. Their placement remains driven by lane centers. Do not draw bright road
lane markings or add decorative clutter to sell the art. Keep red Grunts,
ochre Heavies, blue defenders and crimson/gold Giants as clear foreground masses.
Existing rounded brass/ink HP and XP bars and level-up effects are retained.

## Water and environmental life

`CoastalWater` uses one simple shader plane: a depth wash from aqua near the
unchanged Z=53 shore to deeper blue, shallow tonal variation and two slow ripple
bands. A separate gradient sky plane opens the horizon. Shoreline foam remains
bright and restrained. No reflection/refraction targets or ocean simulation.

`CoastalVegetation` uses four olives with simple trunks/forked branches and four
crossed, depth-offset alpha foliage cards per crown, plus five climbing cards
per side. A generated 256×128 sRGB texture layers broad oval brush masses into
porous/scalloped silhouettes; no external imagery or individually modeled leaves.
Cutouts use alpha test 0.4, double sides and depth writing without transparent
sorting. Painted, unlit foliage preserves dark/light coastal greens and avoids
hard planar lighting seams. Eight instanced draws / 50 instances include existing
side flowers and ground shadow patches. Wind has asynchronous phase and at most
0.044 lateral / 0.024 depth local displacement; no CPU vertex updates. Magenta
flowers remain confined to side facades and separate from enemy crimson.

`CoastalCloth` has two low-segment sloping, sagging awnings (36 vertices each),
one cyan and one ivory. Wind is soft, continuous, asynchronous and anchored at
one edge; maximum procedural displacement is 0.155 units. No cloth physics or
per-frame CPU vertex updates. Water, foliage and cloth use renderer clocks only.


## Faction presentation — Phase 1.1

`ART.faction` owns the coastal character swatches. Meshes, UVs, four baked run
poses, proportions, gait and hit/death timing are unchanged.

| Family | Colors |
| --- | --- |
| Player | blue `#287FC6`, highlight `#67B9E3`, dark equipment `#243B4A` |
| Grunt | clean raspberry/crimson `#C83F5A`, highlight `#E46B73` |
| Heavy | gold-yellow helmet/vest `#E7B647`, secondary crimson tunic `#A93449` |
| Skin / weapon | warm skin `#E4AD8A`, navy-charcoal weapon `#263A43` |

The illustrated material remaps the existing tunic, skin and equipment atlas
swatches. Hair is preserved; the hair/leather swatch is recolored only below the
upper body. Enemy body instance color selects the tunic only, so Heavy crimson
never tints its skin. Rifle surfaces retain source tonal detail in navy-charcoal.
Giant crimson/gold identity and all gameplay/HUD/VFX rules remain intact. Side
flower magenta `#C51E67` and impact orange/red remain separate accents.

## Localized catastrophe

Keep smoke, fire, artillery, aircraft, offshore troop carriers and the landing
craft on top of the bright base. Legacy industrial slabs/cranes and blanket
haze are hidden only in defense mode. Two burning machine sites and artillery
sit near side wreckage; dark smoke is localized. Three smaller distant carriers
have asymmetric depths/scales, slow bob and faint wakes. Their landing-craft
assault cue remains. The weather stays beautiful even during heavy combat.

These rules apply to later buildings, supplies, Tanks and Boss art without
authorizing new gameplay. **Simulation, snapshots, balance data, input, enemy
population, XP and player power are unchanged by this art phase.**

Portrait before/after evidence, motion recording and performance observations
are in `artifacts/coastal-cleanup/REPORT.md`. Software-rendered FPS is diagnostic;
physical-phone readability, cloth visibility and contrast still need review.
