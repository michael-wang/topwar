# Modern Toy Soldier character assets

Source: [Kenney Mini Forest 1.0](https://kenney.nl/assets/mini-forest), official archive `kenney_mini-forest_1.0.zip`. Its included `License.txt` states Creative Commons Zero (CC0). Archive SHA-256: `8691614018075A66458E35915B8C358C2E6178648AEDADAFCDF313B924AA6581`.

Exact source files: `Models/GLB format/character-archer.glb` and `Models/GLB format/Textures/colormap.png`. No other character or weapon source is used. `scripts/prepare_character_models.py` generates the toy steel helmet, compact vests, rifle, and tracer from low-poly primitives. Run it with `python scripts/prepare_character_models.py SOURCE_DIR public/models` after placing those two source files in `SOURCE_DIR`; it requires NumPy and Pillow.

Source GLB mesh nodes are `body-mesh` (mesh `body-mesh`) and `head-mesh` (mesh `head-mesh`); its other nodes are the rig root, legs, torso, arms, and head bones. The green archer headgear is **not** a separate named node: it is 74 triangles within `head-mesh`, mapped to the colormap swatch at U=0.21875, V≥0.824. The bake explicitly accepts those two mesh nodes and omits those headgear triangles from the idle body, player/gray variants, and all four sprint poses. The 32-vertex rear archer shaft is also excluded from every pose using a mask identified from the idle geometry. Face, brown hair, skin, clothing, hands, and footwear remain. No atlas pixels are repainted to hide the headgear.

The player, enemy, and Boss idle bodies sample the Kenney `idle` animation at 0.2 seconds and bake both skinned meshes into one rigid, centered, grounded, one-unit body. Enemy and Boss run frames sample the original `sprint` clip at 0.0625, 0.1875, 0.3125, and 0.4375 seconds. Runtime GLBs have no skeletons or animations. The four run geometries use the original body's shared texture/material in the renderer; the Boss uses its own head-cleaned frames at a slower 1.1-second cycle until it engages, then uses its melee poses.

The Boss-only helmet occlusion cleanup uses the source `head-mesh` UV islands after removing the green cap and rear shaft. In idle and walk poses, **21 upper hair triangles** (`U=0.09375`) lie fully above the helmet rim and are removed; **17 crossing hair triangles** are clipped at model Y=0.725 in each pose. The adjacent side-scalp selection contains **8 upper triangles** and **7 crossing triangles** (`U=0.21875`); those are removed or clipped at the same rim plane. The cut preserves the lower half of long side/back hair and skin faces. The melee clip moves the head ahead of the fixed helmet, so its four poses remove only the **14 closed top-cap hair triangles** hidden in every pose; retaining the lower side/scalp faces avoids an exposed hole beneath the rim. The same UV/geometry rule is applied to every pose in each motion family. Boss hit wash follows the active corrected pose, and Boss death uses the corrected idle body. Face, eyes, eyebrows, nose, moustache, ears, lower side/back hair, and neck remain. The normal enemy, player, and gray enemy death body files are unchanged. If source UVs or topology change, the bake fails instead of silently removing a different surface.

The four Boss-only slam geometries sample `attack-melee-right` at 0.18, 0.29, 0.34, and 0.40 seconds. At each sample, the `arm-left` bone rotation comes from `attack-melee-left`; the `arm-right` bone and torso/legs come from `attack-melee-right`. The first frame moves both arm bones slightly up and forward to make the wind-up readable from the gameplay camera. This combines the source rig's two one-handed attacks into raised hands, downward strike, impact, and recovery poses. The same green cap, rear shaft, and Boss top-hair cap triangles are excluded. Runtime shares the original body material, with no animation system.

`toy-soldier-body.glb` embeds Kenney `colormap.png` without pixel changes (PNG SHA-256 `319F1087D8ED50A8794F9A8179F64671D5595F2365FDF3E47EC2D4EB74DBA20F`). The player variant changes only the UV-identified main tunic swatch at U=0.96875, V=0.775..0.975. Skin, face, hair, leather, and footwear stay intact. The death body has a grayscale copy of the same atlas. Player, enemy, and Boss share the same helmet geometry; the Boss renderer scales its helmet locally to 0.92 around the head and seats the rim with a local Y offset of -0.025 and a forward Z offset of 0.10 model units while retaining the existing whole-body `visualScale`. The Boss plate carrier remains one mesh. Six bounded geometry variants use the baked vertex-color regions: front/back/side plates match the helmet Tier color exactly, while straps and pouches render charcoal (#303238); the renderer selects the variant without per-frame allocations. The rifle barrel points along local +Z, matching projectile travel. The thin tracer is 0.52 body units long, rendered with a bright unlit core and one shared translucent glow layer.

| Runtime file | Bytes | Use |
| --- | ---: | --- |
| `toy-soldier-body.glb` | 44,320 | Kenney body and original texture, without archer headgear/accessory |
| `toy-soldier-boss-body.glb` | 43,760 | Boss idle body with helmet-hidden hair/scalp clipped; original Kenney texture |
| `toy-soldier-player-body.glb` | 38,500 | Blue tunic player body, headgear and rear accessory removed |
| `toy-soldier-gray-body.glb` | 36,900 | Grayscale body for brief enemy fade |
| `toy-soldier-run-0.glb` through `toy-soldier-run-2.glb` | 33,600 each | Three static enemy running poses |
| `toy-soldier-run-3.glb` | 33,596 | Fourth static enemy running pose |
| `toy-soldier-boss-run-0.glb` | 32,628 | First Boss walk pose with helmet-hidden hair/scalp clipped |
| `toy-soldier-boss-run-1.glb` and `toy-soldier-boss-run-2.glb` | 32,056 each | Second/third Boss walk poses with helmet-hidden hair/scalp clipped |
| `toy-soldier-boss-run-3.glb` | 32,628 | Fourth Boss walk pose with helmet-hidden hair/scalp clipped |
| `toy-soldier-boss-slam-0.glb` | 32,304 | Raised hands / wind-up, hidden top cap removed |
| `toy-soldier-boss-slam-1.glb` | 32,300 | Downward strike, hidden top cap removed |
| `toy-soldier-boss-slam-2.glb` | 32,300 | Impact, hidden top cap removed |
| `toy-soldier-boss-slam-3.glb` | 32,300 | Recovery, hidden top cap removed |
| `toy-soldier-helmet.glb` | 5,504 | Tier-colored rimmed helmet |
| `toy-soldier-vest.glb` | 3,156 | Compact tier-colored vest |
| `toy-soldier-boss-vest.glb` | 10,276 | Boxy front/back ballistic plates, shoulder straps, rib plates, and three compact front pouches in one shaded rigid mesh; no pauldrons or hanging chest strip |
| `toy-soldier-rifle.glb` | 4,600 | Fixed charcoal forward-pointing rifle |
| `toy-soldier-bullet.glb` | 1,720 | Slim tracer geometry |

Normal enemies use four shared-texture body InstancedMeshes plus six tier buckets each for helmets and vests (16 bounded families). Phase varies by enemy id. No per-enemy SkinnedMesh or AnimationMixer exists. Death visuals use a capped pool of 48 gray bodies with brief yellow hit confirmation, upward float, and opacity fade. Render-only enemy scale is 0.82 and player scale is 0.85. Simulation collision radii are unchanged. URLs use `publicAssetUrl()` for Vite dev and `/topwar/` production builds.
