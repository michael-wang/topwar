# Modern Toy Soldier character assets

Source: [Kenney Mini Forest 1.0](https://kenney.nl/assets/mini-forest), official archive `kenney_mini-forest_1.0.zip`. Its included `License.txt` states Creative Commons Zero (CC0). Archive SHA-256: `8691614018075A66458E35915B8C358C2E6178648AEDADAFCDF313B924AA6581`.

Exact source files: `Models/GLB format/character-archer.glb` and `Textures/colormap.png`. No other character or weapon source is used. `scripts/prepare_character_models.py` generates the toy steel helmets, compact vests, rifle, and tracer from low-poly primitives. Run it with `python scripts/prepare_character_models.py SOURCE_DIR public/models` after placing those two source files in `SOURCE_DIR`; it requires NumPy and Pillow.

The player and Boss body sample the Kenney `idle` animation at 0.2 seconds and bake both skinned meshes into one rigid, centered, grounded, one-unit body. Enemy run frames sample the original `sprint` clip at 0.0625, 0.1875, 0.3125, and 0.4375 seconds. Runtime GLBs have no skeletons or animations. The four run geometries use the original body's shared texture/material in the renderer.

`toy-soldier-body.glb` embeds Kenney `colormap.png` without pixel changes (PNG SHA-256 `319F1087D8ED50A8794F9A8179F64671D5595F2365FDF3E47EC2D4EB74DBA20F`). The player variant changes only the UV-identified main tunic swatch at U=0.96875, V=0.775..0.975. Skin, face, hair, leather, and footwear stay intact. The death body has a grayscale copy of the same atlas. The helmet has a hard dome and a continuous thick rim above the face. The rifle barrel points along local +Z, matching projectile travel. The narrow tracer is rendered with an unlit pale-gold runtime material.

| Runtime file | Bytes | Use |
| --- | ---: | --- |
| `toy-soldier-body.glb` | 55,808 | Original Kenney body and texture; Boss and shared enemy material |
| `toy-soldier-player-body.glb` | 49,988 | Blue tunic player body |
| `toy-soldier-gray-body.glb` | 48,388 | Grayscale body for brief enemy fade |
| `toy-soldier-run-0.glb` through `toy-soldier-run-3.glb` | 45,100 each | Four static enemy running poses |
| `toy-soldier-helmet.glb` | 5,504 | Tier-colored rimmed helmet |
| `toy-soldier-boss-helmet.glb` | 5,500 | Larger rimmed Boss helmet |
| `toy-soldier-vest.glb` | 3,156 | Compact tier-colored vest |
| `toy-soldier-boss-vest.glb` | 3,156 | Broader Boss vest |
| `toy-soldier-rifle.glb` | 4,600 | Fixed charcoal forward-pointing rifle |
| `toy-soldier-bullet.glb` | 1,720 | Slim tracer geometry |

Normal enemies use four shared-texture body InstancedMeshes plus six tier buckets each for helmets and vests (16 bounded families). Phase varies by enemy id. No per-enemy SkinnedMesh or AnimationMixer exists. Death visuals use a capped pool of 48 gray bodies with brief yellow hit confirmation, upward float, and opacity fade. Render-only enemy scale is 0.74 and player scale is 0.85. Simulation positions, collision, counts, and density are unchanged. URLs use `publicAssetUrl()` for Vite dev and `/topwar/` production builds.
