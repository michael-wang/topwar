# Modern Toy Soldier character assets

Source: [Kenney Mini Forest 1.0](https://kenney.nl/assets/mini-forest), official archive `kenney_mini-forest_1.0.zip`. Included `License.txt` states Creative Commons Zero (CC0). Archive SHA-256: `8691614018075A66458E35915B8C358C2E6178648AEDADAFCDF313B924AA6581`.

Exact source files from the archive: `Models/GLB format/character-archer.glb` and `Textures/colormap.png`. No other character family or weapon model is used. The toy helmet, vest, rifle and bullet are original low-poly primitives made by `scripts/prepare_character_models.py`.

To reproduce, place those two source files in a temporary directory and run `python scripts/prepare_character_models.py SOURCE_DIR public/models` with NumPy and Pillow. The archer's `idle` animation is sampled at 0.2 seconds; both skinned meshes are baked into one static, centered, grounded, one-unit body. Skins and animations are stripped.

`toy-soldier-body.glb` embeds the original Kenney colormap without pixel changes (PNG SHA-256 `319F1087D8ED50A8794F9A8179F64671D5595F2365FDF3E47EC2D4EB74DBA20F`). The player variant recolors only the UV-identified main tunic swatch at U=0.96875, V=0.775..0.975; skin, face, leather, hair and footwear stay unchanged. The rounded open-face helmet begins above Y=0.8. The compact split-front chest/back vest occupies roughly Y=0.39..0.55, leaving the lower tunic and limbs visible. The rifle and bullet are static generated geometry with fixed charcoal and warm-yellow materials.

| Runtime file | Bytes | Use |
| --- | ---: | --- |
| `toy-soldier-body.glb` | 55,808 | Original Kenney body/texture for enemy and Boss |
| `toy-soldier-player-body.glb` | 49,988 | Blue tunic body for players |
| `toy-soldier-helmet.glb` | 3,540 | Tier-colored rounded helmet |
| `toy-soldier-boss-helmet.glb` | 3,540 | Larger rounded Boss helmet |
| `toy-soldier-vest.glb` | 3,156 | Compact tier-colored vest |
| `toy-soldier-boss-vest.glb` | 3,156 | Broader Boss vest |
| `toy-soldier-rifle.glb` | 4,660 | Fixed charcoal toy rifle |
| `toy-soldier-bullet.glb` | 2,440 | Fixed yellow projectile/tracer |

Normal enemies render as one shared textured body InstancedMesh and six tier buckets each for helmets and vests (13 bounded mesh families). Tier colors apply only to helmet and vest instance colors. Render-only enemy scale is 0.74 and player scale 0.85. Simulation positions, collision and density are unchanged. All URLs go through `publicAssetUrl()` for Vite dev and `/topwar/` production builds.
