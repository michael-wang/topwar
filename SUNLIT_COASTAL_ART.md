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

E1 adds one two-triangle shoreline overlay spanning Z=46–61 above the sand.
Muted beige/taupe wet sand (`#B3AD97`) occupies a 3.8-unit beach-side band;
alpha feathering preserves the existing dry sand wash. A broad irregular shore
curve (±0.85 plus ±0.25 units) breathes by ±0.4 units over 12 seconds with local
phase variation. Coverage includes the entire beach-side envelope, not only
the old sea plane. Broken incoming foam has variable widths and gaps; thinner,
quieter retreat foam and sparse detached patches share this pass. The 20 static
defense foam strips are removed. These are visual offsets only: simulation
shoreline Z=53, paths, collision, lanes, camera and lighting are unchanged.

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
Enemy health bars use bright coral/red fills with cool navy backing and a thin ivory keyline. Defense HUD and progression
follow the coastal UI rules below, preserving the open center sky.

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

## Coastal UI — PLASTER + SEA + SUNLIGHT

`ART.coastalUi` owns interface and progression-effect tokens; CSS consumes them
through `--coast-*`. Plaster is structure, sea is progression/action, navy gives
legibility, and sunlight/gold is a rare celebration accent. Avoid dominant dark
slabs, ornamental gold borders, metallic bevels or fantasy typography.

| Role | Color |
| --- | --- |
| Structure / paper | plaster `#F1EFE6`, light paper `#F7F4EA` |
| Readability / shadow | navy `#24465A`, cool shadow `#2C4158` |
| Progression | sea `#247E9C`, intermediate cyan `#329DAC`, aqua `#58C8C1` |
| Crest / celebration | crest `#BAE9E0`, foam `#E5F6EE`, cyan-white energy `#C6F4F2` |
| Rare sun accent | `#F7CD76`; never the primary UI identity |

XP/player progression = **SEA / AQUA / SUNLIGHT**; enemy health = **CRIMSON / RED / DEEP
RED**. Never use normal gold enemy health fills. `ART.enemyHealth` owns Heavy coral
`#F2555F`, Giant coral `#EF4D59`, near-white coral hit `#FFE6DF`, and cool navy backing colors.
The fill is brighter than enemy clothing. A 100 ms brightness/12% thickness punch reuses
the existing 250 ms rate-limited elite hit impulse; HP/fraction/collision never changes.
Each pooled bar owns its tint so damage does not flash other enemies. World bars retain shared
rounded geometry; legacy Boss framing is unchanged.

Bottom hierarchy is **LEVEL / XP / LOADOUT**, never one enclosing capsule. XP remains
the widest continuous element; the compact loadout balances the level badge.

R4 makes loadout a horizontal **weapon slot | enhancement slot**, with negative
space and one quiet separator rather than cards or a dark enclosing panel.
The monochrome navy rifle occupies 3.4×1.5 rem (3.1×1.4 on ≤350px), with a
tight 44×20 SVG viewBox and broad stock/receiver/barrel. The enhancement slot
shows three cartridge silhouettes at Lv1–Lv3 (one/two/three filled), then three
soldier silhouettes at Lv4–Lv5 (two/three filled). Filled navy and quiet outline
states remain separate at 350/390 px. The enlarged monochrome Rifle stays unchanged.

P1 enhancement presentation consumes the explicit configured level plan. The first
cartridge is baseline Stage I, not an earned upgrade. Soldier pips show permanent
progression squad stage, not living count: casualties do not unfill them. Lv5 caps
normal progression with a full quiet XP bar and no imminent-level pulse. Levels above
five and Grenade progression remain deferred. No percentage or multiplier text remains.

Future weapons can replace the silhouette map, without implementing those weapons now.
Normal HUD has no RATE/SQUAD labels or numeric XP. Temporary `LEVEL UP` remains compact.

Level is primary information: a compact plaster badge combines a small `LV` with a large
1.9-rem number and aqua underline. The XP container has no outer capsule, border, panel
background or shadow. The track itself is primary, with a responsive 0.85–1-rem interior,
2-pixel navy outline, dark cool-shadow unfilled remainder and modest grounding shadow. No
numeric XP. Its sea-to-aqua gradient is anchored to the **full track width**, progressively
revealed by the fill mask. At 70% aqua glow strengthens; at 90% the leading crest uses
sunlight `#F7CD76`, with a restrained pulse and faster sheen. Normal near-full fill stays
aqua, never foam-white, so the last 2–10% remains dark and visible. Foam/ivory is reserved
for actual Level Up. The 120/260 ms gain reveal, 240 ms full flash, level-label pop and 800
ms beat are preserved; the flash/sweep now belongs to the track and badge, not an enclosing
panel.

Level Up uses an aqua ground ring, ivory-white body/gear flash, eight aqua/foam
motes per member, white/aqua HUD sweep, foam-white text with cool shadows, and
1400 ms cyan-white tracer/muzzle afterglow. Scale pulse, timings and positive
sound stay unchanged. Keep the beat short and energetic rather than a sustained
healing aura. Gold may be a tiny sunlight accent, never a dominant meter/effect.

Defense does not construct the old `DEFEND N / 5` HUD. Keep the top-center sky
empty. Pause uses an icon-only, low-opacity aqua sea-glass surface with no heavy border/shadow.
TUNE is a subordinate icon-only developer hatch with low opacity and no idle backing.
Both retain accessible labels/titles and minimum 44-pixel hit targets; hover/focus/open
clarifies the hatch. The open panel may show TUNE. Pause stays top-right;
development-only TUNE has its own top-left anchor with an authored monochrome screwdriver
SVG. Its scrollable popup opens below/right, constrained to the portrait viewport. TUNE uses
the same
plaster/navy palette, sea-colored range accents and subtle separators; input
and focus ownership are unchanged. Legacy interface styling remains intact.

The lower-left hint has only `A / D or ← / →   STEP LANE` on desktop or
`TAP LEFT / RIGHT` on coarse-pointer devices. Navy text with a pale shadow stays
legible on sand. It holds briefly then fades over a nine-second CSS presentation
animation; Pause suspends that animation. No gameplay/tutorial state is stored.
The **world is full bleed** on portrait/coarse-pointer devices: 100vw × 100dvh.
Camera aspect uses actual dimensions; defense-only vertical FOV expands on taller phones
to preserve authored horizontal lane coverage (48° at 9:16, about 56.9° at 390×844).
Legacy FOV/layout stays intact. Safe area insets UI, never reserves blank world strips.
Desktop retains a centered portrait game with receding deep-sea `#24465A` → navy
`#182F3B` gutters, without mirrored scenery.

The tiny build label is debug metadata, pinned **3px** from the literal viewport
bottom-right corner, independent of safe area. Defense CSS defines `--hud-safe-top/left/right/bottom`
as the respective safe-area inset **plus 0.85rem**, never the maximum of those values.
Shared `--hud-inset-*` inputs default to `env(safe-area-inset-*)`; they can be overridden
for visual QA. Apply the sum to important controls, XP, hint and optional diagnostics;
keep hints above the taller level badge. XP and hints stay pointer-transparent.

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
