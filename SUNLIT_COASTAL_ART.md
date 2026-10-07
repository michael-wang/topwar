# Sunlit Coastal Battlefield

Art Phase 1.4 finalizes **defense-mode hierarchy, civilian village composition and viewport behavior**.
R3 refines authored openings; R4 extends village side framing and separates loadout information. Camera and lighting remain fixed. The direction is a
sunlit stylized Mediterranean coastal diorama: **a beautiful coast under
violent assault**. The supplied reference informs color, shape hierarchy and
breeze, not its village, assets, layout or identity. All scenery is original
procedural geometry/shading. No reference pixels or downloaded textures ship.

Character proportions and archetype construction are now defined by
[CHARACTER_VISUAL_SYSTEM.md](CHARACTER_VISUAL_SYSTEM.md), superseding the earlier
shared legacy body assumptions: Player/Grunt/Heavy use rounded two-head forms,
while Giant uses a body-dominant approximately three-head form.
Reusable non-character object design, including future naval and defensive
forms, is defined by [COASTAL_GREEK_OBJECT_LANGUAGE.md](COASTAL_GREEK_OBJECT_LANGUAGE.md).
This document remains canonical for coastal palette, lighting, environment
composition and UI guardrails. The implemented naval palette and R4 near-field
foreground follow the object language without changing gameplay.

Visual QA output is now local and ignored under `artifacts/`; historical evidence
references in this document are recoverable from Git history. Reusable browser
sanity scripts live in `scripts/qa/`, with correctness tests in `tests/`.

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
cyan doors, stair/terrace silhouettes and open arches. Smaller staggered facades
show roofs and windows rather than giant cropped slabs. No static military machinery,
fallen parapets or pre-broken concrete edges populate the civilian village. Layout is asymmetric,
stable between runs and adapts outward from the configured track edge.

R3 openings use plaster jambs/lintels, a broad cyan painted door leaf and a
smaller #405A6D inner core (0.42×1.16). Windows use quiet 0.60×0.73 cores with
plaster surrounds and partial shutters. Large painted side planes remain cool
plaster, lifted from the former deepest navy slab; lighting is unchanged.

Environment surfaces use `illustratedMaterial()` with roughness 1 / metalness 0
and broad tonal washes. `paintedBlockGeometry()` supplies restrained bevels and
chips. Sand retains the generated quiet cream/ochre wash. No photorealism,
texture-noise layers, full-screen postprocessing or per-enemy shadow maps.

Defense lighting uses warm sunlight from (-8,12,-6), intensity 2.2, sky fill
`#C5E5F2` / cool ground fill `#405A6D`, hemisphere intensity 1.65. Renderer output
is explicitly sRGB; defense uses ACES filmic highlight rolloff at exposure 1.35.
Legacy mode restores its original lights and NoToneMapping. Hero water/sky and
painted cool-plaster wall faces bypass filmic mapping so their authored color blocks
stay clear. Static navy ground patches suggest building, arch, cloth and olive
shadows. Existing character contact shadows remain; no new shadow render pass.

R6.1 adds four distant cloud cards with a deterministic painted-density atlas:
soft irregular white silhouettes, sunlit tops and cool undersides, without
sphere assemblies or cartoon outlines. One instanced draw shares one 1024×128
RGBA texture. Slow lateral drift stays below 0.1 world units/second, with tiny
vertical motion; clouds are defense-only atmosphere behind village/combat.

The two-triangle shoreline overlay spans seven units beachward and eight units
seaward from the canonical visual shore (E1.1: Z=45, overlay Z=38–53).
Muted beige/taupe wet sand (`#B3AD97`) occupies a 3.8-unit beach-side band;
alpha feathering preserves the existing dry sand wash. A broad irregular shore
curve (±0.85 plus ±0.25 units) breathes by ±0.4 units over 12 seconds with local
phase variation. Coverage includes the entire beach-side envelope, not only
the old sea plane. E1.1 uses two travelling fronts: +2.25 to −0.25 units relative
to the irregular shore, with a 6.4-second cycle staggered by half a cycle (one
new front every 3.2 seconds). Small X phase offsets break lockstep. Broken
incoming crests broaden from 0.40 to 0.80 units and brighten toward a 0.90
ivory foam mix, then fade at the wet edge. The stationary lap is quieter;
post-arrival retreat foam drifts softly seaward/fades, with sparse detached
patches in the same overlay. Caustic strength and the 3.8-unit wet band stay
unchanged. There are still just one sea and one shore draw. The 20 static
defense foam strips are removed. These are visual offsets only: simulation
shoreline offsets never move paths, collision or lanes; camera and lighting
are unchanged. The visual anchor is Z=45 after the Z=49/47/45 portrait review.
Z=45 gives approximately 6.9 pixels of wet band and 3.4 pixels of crest travel
at 390×844, while preserving a substantial combat beach. Sand's far edge and
the landing craft's arrival endpoint derive from this same visual anchor.
Only defense enemy buffering follows it: `defenseSpawnAheadDistance=47`
(two units seaward), down from 53. Crowd row offsets are beachward-only, so
the rear of new rows stays in the surf/shallow entry envelope. Stream
`startZ=30` is unchanged, preserving earliest-row timing. No spawn cadence,
population-per-group, speeds, XP, progression or difficulty compensation changes.

## Composition and gameplay readability

E1 uses three depth zones: strongest village framing near the defenders,
lighter side facades and vegetation in the middle, then open beach/sea.
Full-height village masses end before Z=24 and must not interrupt the primary
surf sightline at 390×844. E1.1 removes the Z=35 house; the old Z=24 left house
becomes a smaller cropped 2.7×2.1×3.0 mass at Z=18, farther outside the track.
The compact Z=20 house and R4 foreground corners remain. The arch moves to
Z=18 at 60% height; Z=26–29 side stairs/parapet stay below 0.7 units.
Only two shorter olives remain at Z=19/21, with trunks,
forks and ground shadows; the Z=30 olive moves to Z=21 beside the compact house
so its foot/trunk are visible, and the Z=39/53 trees are removed. The village opens onto
the beach rather than occupying the surf. Camera, lighting and collision stay fixed.
Climbing foliage is refitted to the shorter near facades, without more cards or
trees. The complete legacy burning-site actors (wreck, fire core, glow and
smoke) are hidden in defense; legacy mode retains them. Artillery, aircraft,
flak, Mediterranean transports and combat blood stains remain.

Dark/detail-rich side frame → open bright sand combat channel → turquoise sea
and pale horizon. All opaque architecture/gear stays at least 0.4 world units
outside the track; foliage/cloth also stay outside. Review this from the actual
portrait camera, not only a wide desktop view. Never cover defenders, nearby
outer-lane enemies, health bars or the XP spectacle with environment props.

The settlement was civilian and did not expect war. The central five corridors
keep only quiet sand scuffs: no X-shaped anti-landing obstacles or prepared beach
fortifications. R4 replaces standalone R3 props with two small cropped village
corners: screen-left whitewashed house/stairs/cyan shutter near Z=6–11;
screen-right facade/arched cyan door/steps near Z=11–16. Flat roofs, parapets
and cool plaster shading visually continue the distant settlement. Opaque
geometry stays outside track edge + 0.4 at four tested widths, adapts outward
with track width and introduces no collision. Six merged material/side draws
replace the seven prop draws; no new textures, tall vegetation or decorative pot row.
**Beauty is the canvas. War is the violation. Toy soldiers are the contradiction.**
Static village architecture is mostly intact, beautiful and sunlit; smoke, fire and impacts
are active contamination. Future residue/damage may tell consequences, but no persistent
damage system is introduced here. Sand scuffs remain driven by lane centers. Do not draw bright road
lane markings or add decorative clutter to sell the art. Keep olive/slate Grunts,
blue defenders and deeper-olive Heavy/Giant threats with restrained stone/khaki accents as clear
foreground masses; character roles follow the Character Visual System.
Enemy health bars use bright coral/red fills with cool navy backing and a thin ivory keyline. Defense HUD uses the independent combat treatment below, preserving the open center sky.

## Water and environmental life

`CoastalWater` uses an opaque two-triangle sea and the narrow shore overlay.
Color implies depth/clarity: light `#9BDED0` at the visual edge, existing turquoise
in the first seven units, richer `#389EAF` in the middle, then existing deep blue.
Three unequal slow sine phases create restrained crossing shallow-light ridges;
their 8.5% highlight contribution vanishes by 24 units offshore. Two broader
low-contrast ripples replace the repetitive stripe pattern; a sparse 2.5% glint
is shallow-only. Both passes share the color/motion functions to avoid seams.
A separate gradient sky plane and the accepted drifting clouds are unchanged.
No generated water texture, reflection/refraction target, additional camera,
CPU geometry deformation or physical ocean simulation is used. Time is a
render clock uniform, so reset/rewind is deterministic and never moves simulation
coordinates. E1 does not change progression, difficulty or combat.

`CoastalVegetation` uses two olives with simple trunks/forked branches and four
crossed, depth-offset alpha foliage cards per crown, plus five climbing cards
per side. A generated 256×128 sRGB texture layers broad oval brush masses into
porous/scalloped silhouettes; no external imagery or individually modeled leaves.
Cutouts use alpha test 0.4, double sides and depth writing without transparent
sorting. Painted, unlit foliage preserves dark/light coastal greens and avoids
hard planar lighting seams. Eight instanced draws / 50 instances include sparse blossom cards and ground
shadow patches. Blossoms use a generated 128×128 cutout texture with eleven tiny
four-petal specks per card, attached to the climbing vine locations. No blossom
approaches soldier-helmet size; no magenta sphere/icosahedron flower masses. Wind has asynchronous phase and at most
0.044 lateral / 0.024 depth local displacement; no CPU vertex updates. Magenta
flowers remain confined to side facades and separate from enemy olive/slate and coral HP.

`CoastalCloth` has two low-segment sloping, sagging awnings (36 vertices each),
one cyan and one ivory. Wind is soft, continuous, asynchronous and anchored at
one edge; maximum procedural displacement is 0.155 units. No cloth physics or
per-frame CPU vertex updates. Water, foliage and cloth use renderer clocks only.


## Faction presentation — Rounded Toy baseline

`ART.faction`, `ART.raider`, `ART.footwear` and role-authored combat-gear colors
define the current rounded-toy Player/Grunt/Heavy/Giant. Form, equipment budgets
and pale-shatter lethal presentation are governed by `CHARACTER_VISUAL_SYSTEM.md`.
Enemy costume is olive/slate/stone; enemy HP remains coral/red.

| Family | Colors |
| --- | --- |
| Player | blue `#287FC6`, highlight `#67B9E3`, dark equipment `#243B4A` |
| Grunt | olive helmet `#6F7C5A`, quiet shirt/slate trousers, simple belt/canteen |
| Heavy | deep olive helmet `#626F51`, shirt `#59674C`, slate trousers `#4E6067`, khaki harness `#989077` |
| Giant | deep olive body `#536246`, olive helmet, limestone crest `#C6B68C`, slate trousers |
| Skin / weapon | warm skin `#E4AD8A`, navy-charcoal weapon `#263A43` |

The four procedural roles use matte vertex-color regions without legacy UV
selectors. Boss remains legacy and its migration is deferred. Muted bean shoes
keep motion readable without white/black dominance. Side flower magenta #C51E67,
impact orange/red and coral HP remain separate semantic accents.

## Combat HUD and coastal presentation

Combat HUD uses independent slate surfaces and red/orange/gold action/progression
accents. It must remain readable across future environments. `ART.coastalUi` and
`--coast-*` retain coastal gutters, hints, legacy surfaces and accepted world
Level-Up effects; they no longer dictate defense XP or active-button identity.

| Role | Color |
| --- | --- |
| Combat surfaces / readability | dark slate `#172331`, pale text `#FFF3DC` |
| Active skill | warm orange `#FF7A27`, gold `#FFD066` |
| XP | red `#D83B27`, orange `#F56724` / `#FF972F`, gold `#FFD066` |
| Coastal gutters / hints | navy `#24465A`, cool shadow `#2C4158` |
| World Level-Up | aqua/foam, cyan-white energy `#C6F4F2` |

HUD XP/player progression = **RED / ORANGE / GOLD**; enemy health = **CRIMSON / RED / DEEP
RED**. Never use normal gold enemy health fills. `ART.enemyHealth` owns Heavy coral
`#F2555F`, Giant coral `#EF4D59`, near-white coral hit `#FFE6DF`, and cool navy backing colors.
The fill is brighter than enemy clothing. A 100 ms brightness/12% thickness punch reuses
the existing 250 ms rate-limited elite hit impulse; HP/fraction/collision never changes.
Each pooled bar owns its tint so damage does not flash other enemies. World bars retain shared
rounded geometry; legacy Boss framing is unchanged.

Combat HUD is independent of the coastal palette: dark slate surfaces, bright warm
orange/gold action accents and pale information. The world and character art stay coastal.
Top-left **DEV** opens the existing tool disclosure, with GRUNT / HEAVY / GIANT / GRENADE /
CURVE / EVOLVE / MG in a compact grid above balance/audio controls. Selection closes it;
Escape toggles it and releases hidden focus. No permanent right-side fixture stack remains.
The entire disclosure and fixture shortcuts are excluded from production.

Top-right Pause has a visible dark blue surface, pale icon, clear border and 44-pixel
minimum target. Left-middle Grenade sits at 57.5% viewport height, clear of lower movement
space: an 86×100-pixel minimum warm beveled button (78×94 at ≤370px), with grenade icon,
charge badge and READY / HELD / EMPTY status. It appears on acquisition, has a short
pop followed by restrained ready glow, and becomes subdued when unavailable. Reduced
motion disables the idle animations. Its input/Q request and gameplay guards are unchanged.

Right-middle battle information balances Grenade at the same vertical center, using a
calmer dark translucent panel with no button bevel or action glow. Existing weapon
silhouettes, family/stage, three enhancement pips, total shots/sec and living squad count
remain compact. The panel is pointer-transparent. Pips show permanent progression:
one/two/three cartridges at Lv1/2/3, two/three soldiers at Lv4/5; casualties do not unfill
them. Living count and total firing rate reflect casualties separately. Lv6 replaces Rifle
with MG, resets enhancement to one cartridge / Stage I, and shows 18/s / one living soldier.

Bottom hierarchy is **LEFT MOVEMENT / LEVEL + XP / RIGHT MOVEMENT** inside a dark
safe-area-aware control strip. Steel-blue 64×60-pixel arrow buttons (56×60 at ≤370px)
have depressed held feedback and their own movement input. They are distinct from the
warm active skill and passive battle panel. A centered outlined LV label has a 34-pixel
level number (32 at ≤370px), exceeding the 24-pixel XP track. The track has a dark
remainder and fixed red `#D83B27` → orange `#F56724` / `#FF972F` → gold `#FFD066` gradient.
The gradient is anchored to the **full track width**, revealed by the accurate fill mask,
never resized. At 70% glow strengthens; at 90% the edge becomes gold. No numeric XP.
Existing 120/260 ms reveal, 240 ms full flash, 320 ms level-text pop and 800 ms announcement
combine with a strong warm track pulse/sweep. Subtle rightward sheen uses a CSS transform,
with no new per-frame objects. Pause suspends decorative animation; reduced motion removes
flow/pop/sweep. Lv6's full cap bar has no imminent pulsing.

World Level-Up presentation remains accepted: aqua ground ring, ivory-white body/gear
flash, eight aqua/foam motes per member and 1400 ms cyan-white tracer/muzzle afterglow.
Its scale pulse, timing and sound are unchanged by HUD styling. Defense still omits
the old `DEFEND N / 5` HUD and keeps the top-center sky empty. Legacy interface styling remains intact.

The lower-left hint has only `A / D or ← / →   STEP LANE` on desktop or
`HOLD ARROWS TO MOVE` on coarse-pointer devices. Navy text with a pale shadow stays
legible on sand. It holds briefly then fades over a nine-second CSS presentation
animation; Pause suspends that animation. No gameplay/tutorial state is stored.
The **world is full bleed** on portrait/coarse-pointer devices: 100vw × 100dvh.
Camera aspect uses actual dimensions; defense-only vertical FOV expands on taller phones
to preserve authored horizontal lane coverage (48° at 9:16, about 56.9° at 390×844).
Legacy FOV/layout stays intact. Safe area insets UI, never reserves blank world strips.
Desktop retains a centered portrait game with receding deep-sea `#24465A` → navy
`#182F3B` gutters, without mirrored scenery.

The tiny build label is debug metadata, pinned **raw safe-area inset + 3px** from the viewport
bottom-right corner, without the normal 0.85rem HUD margin. Defense CSS defines `--hud-safe-top/left/right/bottom`
as the respective safe-area inset **plus 0.85rem**, never the maximum of those values.
Shared `--hud-inset-*` inputs default to `env(safe-area-inset-*)`; they can be overridden
for visual QA. Apply the sum to important controls, XP, hint and optional diagnostics;
keep hints above the movement/progression strip. XP and hints stay pointer-transparent;
only visible movement buttons own bottom movement input. The build label sits below the strip.

## Defense-mode legacy premise audit

Do not apply presentation logic whose world premise no longer exists. Preserve supported legacy rendering behind its mode boundary.

| Assumption / system | Defense handling | Why |
| --- | --- | --- |
| Legacy dark activity warship — `BridgeEnvironment.buildActivity/updateActivity` | **Hidden unconditionally in defense**, including schedule/rewind/mode switches; legacy edge fade and bridge mask retained | `OffshoreTransports` already owns the coastal invasion story |
| Road deck, shoulders, rails and scrolling joints — `BridgeEnvironment` | Already hidden; retained for legacy | Stationary civilian beach replaces bridge travel |
| Industrial slabs/crane, blanket gray haze, old beachhead/island silhouettes — `BridgeEnvironment` | Already hidden only in defense | Sunlit architecture/sea owns the coastal vista |
| Forward-progress parallax — `BridgeEnvironment`, `GameRenderer` projection | Already fixed relative to defender; legacy activity ship is hidden in defense | Internal progression must not move the coastal scene |
| Bridge-width-dependent placement — fires/artillery | Already uses the configured combat edge in defense | Localized damage stays beside outer lanes; width is a valid channel bound, not bridge occlusion |
| Bright road corridor strips/prepared obstacles — `AttackLaneRenderer` | Already hidden/removed in defense; quiet sand scuffs remain | Civilian coast was not fortified |
| Aircraft/flak and legacy ship scheduling — `WarActivityScheduler` | Aircraft/flak retained in defense; ship timing retained for legacy mode | Preserve airborne activity without duplicating the Mediterranean fleet |
| New carriers/landing craft — `OffshoreTransports` | Retained: defense-only, asymmetric offshore positions, bob/wake and shoreward cue; no bridge mask | They tell the current invasion story (`rear-bridge` means ship cabin) |
| Tier HUD / dormant Boss and reward presentation — UI/renderers | Already hidden or inactive in defense; implementations retained | Current experiment disables tier/Boss/reward gameplay, so no extra HUD appears |
| Static steel/rust coastal machinery and burning wreck meshes — `CoastalArchitecture`, `BridgeEnvironment` | **Removed** coastal machinery; hide burning base/slab only in defense, restore in legacy | Peaceful village was not prepared/destroyed by default; active fire/smoke remains |
| Pre-broken edges, fallen wall and oversized facades — `CoastalArchitecture` | **Replaced** with intact compact houses, steps, terrace and arch | Architecture should read as civilian village continuation |
| Fixed 9:16 mobile viewport — CSS / `GameRenderer` | **Replaced** for touch portrait with full bleed and aspect-aware FOV | World must fill tall phones while important UI stays inset |
| Explicit lane number / shared right-side development anchor — UI | Lane HUD already absent; **fixed** TUNE to separate left anchor | Preserve empty center sky and distinguish development control |

Distant inferno/smoke and airborne flashes remain localized battle activity rather than
bridge geometry; no additional environment removal is warranted.

## Localized catastrophe

Keep smoke, fire, artillery, aircraft, offshore troop carriers and the landing
craft on top of the bright base. Legacy industrial slabs/cranes and blanket
haze are hidden only in defense mode. Two active fire/smoke sites and artillery remain beside the beach; their static
wreck geometry is hidden in defense. Dark smoke is localized. Three smaller distant carriers
have asymmetric depths/scales, slow bob and faint wakes. Their landing-craft
assault cue remains. The weather stays beautiful even during heavy combat.

These rules apply to later buildings, supplies, Tanks and Boss art without
authorizing new gameplay. **Simulation, snapshots, balance data, input, enemy
population, XP and player power are unchanged by this art phase.**

Portrait before/after evidence, motion recording and performance observations
are in `artifacts/coastal-finalization/REPORT.md`. Software-rendered FPS is diagnostic;
physical-phone readability, cloth visibility and contrast still need review.
