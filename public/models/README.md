# Modern Toy Soldier character assets

Source: [Kenney Mini Forest 1.0](https://kenney.nl/assets/mini-forest), official archive `kenney_mini-forest_1.0.zip`. Its included `License.txt` states Creative Commons Zero (CC0). Archive SHA-256: `8691614018075A66458E35915B8C358C2E6178648AEDADAFCDF313B924AA6581`.

Exact source files: `Models/GLB format/character-archer.glb` and `Models/GLB format/Textures/colormap.png`. No other character or weapon source is used. `scripts/prepare_character_models.py` generates the toy steel helmet, compact vests, rifle, and tracer from low-poly primitives. Run it with `python scripts/prepare_character_models.py SOURCE_DIR public/models` after placing those two source files in `SOURCE_DIR`; it requires NumPy and Pillow.

Source GLB mesh nodes are `body-mesh` (mesh `body-mesh`) and `head-mesh` (mesh `head-mesh`); its other nodes are the rig root, legs, torso, arms, and head bones. The green archer headgear is **not** a separate named node: it is 74 triangles within `head-mesh`, mapped to the colormap swatch at U=0.21875, V≥0.824. The bake explicitly accepts those two mesh nodes and omits those headgear triangles from the idle body, player/gray variants, and all four sprint poses. The 32-vertex rear archer shaft is also excluded from every pose using a mask identified from the idle geometry. Face, brown hair, skin, clothing, hands, and footwear remain. No atlas pixels are repainted to hide the headgear.

The player and Boss body sample the Kenney `idle` animation at 0.2 seconds and bake both skinned meshes into one rigid, centered, grounded, one-unit body. Enemy run frames sample the original `sprint` clip at 0.0625, 0.1875, 0.3125, and 0.4375 seconds. Runtime GLBs have no skeletons or animations. The four run geometries use the original body's shared texture/material in the renderer; the Boss reuses these same frames at a slower 1.1-second cycle until it engages, then uses its melee poses.

The four Boss-only slam geometries sample `attack-melee-right` at 0.18, 0.29, 0.34, and 0.40 seconds. At each sample, the `arm-left` bone rotation comes from `attack-melee-left`; the `arm-right` bone and torso/legs come from `attack-melee-right`. The first frame moves both arm bones slightly up and forward to make the wind-up readable from the gameplay camera. This combines the source rig's two one-handed attacks into raised hands, downward strike, impact, and recovery poses. The same green cap triangles and rear archer accessory are excluded. Runtime shares the original body material, with no animation system.

`toy-soldier-body.glb` embeds Kenney `colormap.png` without pixel changes (PNG SHA-256 `319F1087D8ED50A8794F9A8179F64671D5595F2365FDF3E47EC2D4EB74DBA20F`). The player variant changes only the UV-identified main tunic swatch at U=0.96875, V=0.775..0.975. Skin, face, hair, leather, and footwear stay intact. The death body has a grayscale copy of the same atlas. Player, enemy, and Boss share the same helmet geometry; the Boss renderer scales its helmet locally to 0.80 around the head and seats it 0.03 model units lower while retaining the existing whole-body `visualScale`. The Boss plate carrier has one mesh with vertex-color shading for darker straps, side plates, and pouches; its runtime material blends each Tier color 88% toward charcoal gunmetal. The rifle barrel points along local +Z, matching projectile travel. The thin tracer is 0.52 body units long, rendered with a bright unlit core and one shared translucent glow layer.

| Runtime file | Bytes | Use |
| --- | ---: | --- |
| `toy-soldier-body.glb` | 44,320 | Kenney body and original texture, without archer headgear/accessory |
| `toy-soldier-player-body.glb` | 38,500 | Blue tunic player body, headgear and rear accessory removed |
| `toy-soldier-gray-body.glb` | 36,900 | Grayscale body for brief enemy fade |
| `toy-soldier-run-0.glb` through `toy-soldier-run-2.glb` | 33,600 each | Three static enemy running poses |
| `toy-soldier-run-3.glb` | 33,596 | Fourth static enemy running pose |
| `toy-soldier-boss-slam-0.glb` | 33,560 | Raised hands / wind-up |
| `toy-soldier-boss-slam-1.glb` | 33,556 | Downward strike |
| `toy-soldier-boss-slam-2.glb` | 33,556 | Impact |
| `toy-soldier-boss-slam-3.glb` | 33,556 | Recovery |
| `toy-soldier-helmet.glb` | 5,504 | Tier-colored rimmed helmet |
| `toy-soldier-vest.glb` | 3,156 | Compact tier-colored vest |
| `toy-soldier-boss-vest.glb` | 10,276 | Boxy front/back ballistic plates, shoulder straps, rib plates, and three compact front pouches in one shaded rigid mesh; no pauldrons or hanging chest strip |
| `toy-soldier-rifle.glb` | 4,600 | Fixed charcoal forward-pointing rifle |
| `toy-soldier-bullet.glb` | 1,720 | Slim tracer geometry |

Normal enemies use four shared-texture body InstancedMeshes plus six tier buckets each for helmets and vests (16 bounded families). Phase varies by enemy id. No per-enemy SkinnedMesh or AnimationMixer exists. Death visuals use a capped pool of 48 gray bodies with brief yellow hit confirmation, upward float, and opacity fade. Render-only enemy scale is 0.82 and player scale is 0.85. Simulation collision radii are unchanged. URLs use `publicAssetUrl()` for Vite dev and `/topwar/` production builds.
