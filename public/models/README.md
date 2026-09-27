# Toy Samurai Army assets

Source: [Kenney Mini Forest 1.0](https://kenney.nl/assets/mini-forest),
official archive `kenney_mini-forest_1.0.zip`. The included `License.txt`
states Creative Commons Zero (CC0). No paid assets or other character family is used.
Archive SHA-256: `8691614018075A66458E35915B8C358C2E6178648AEDADAFCDF313B924AA6581`.

Exact selected source files from `Models/GLB format/`:

- `character-archer.glb`
- `weapon-bow.glb`
- `weapon-arrow.glb`
- `Textures/colormap.png`

Place those four files in a temporary source directory and run
`python scripts/prepare_character_models.py SOURCE_DIR public/models` with
NumPy and Pillow. The archer's `idle` animation is sampled at 0.2 seconds;
its two skinned meshes are baked to one rigid mesh, centered, grounded, and
normalized to one game unit. The original Kenney colormap is embedded **without
pixel changes** in `toy-samurai-body.glb` for enemies and Bosses. Its SHA-256 is
`319F1087D8ED50A8794F9A8179F64671D5595F2365FDF3E47EC2D4EB74DBA20F`.

The player body uses one additional texture variant. UV inspection of the
source `body-mesh` finds the main tunic swatch at U=0.96875, V=0.775..0.975
(168 vertices). The script paints only the nine-texel-wide sampling footprint
of this swatch blue, retaining its lightness variation. Skin, face, hair,
leather, footwear, and other Kenney swatches are untouched. The baked bow is
rotated to show its curve from the portrait camera; the arrow keeps its source
shape and travel-axis orientation.

The only custom equipment is a shallow eight-sided kabuto with a small rear
skirt and a V crest. The Boss helmet has a wider crown and taller crest. No
chest, shoulder, arm, or boot overlays are baked. The helmet occupies only
Y≈0.78 and above, keeping the face and outfit visible.

| Runtime file | Bytes | Use |
| --- | ---: | --- |
| `toy-samurai-body.glb` | 55,808 | Original fixed Kenney body and texture; enemy/Boss |
| `toy-samurai-player-body.glb` | 49,988 | Blue tunic variant for players |
| `toy-samurai-helmet.glb` | 5,276 | Tier-colored normal/player kabuto |
| `toy-samurai-boss-helmet.glb` | 5,288 | Larger tier-colored Boss kabuto |
| `toy-samurai-bow.glb` | 5,252 | Neutral wooden bow |
| `toy-samurai-arrow.glb` | 4,320 | Projectile arrow |

All runtime files contain rigid geometry without skins or animations. Normal
enemies share **one** textured body `InstancedMesh` and six helmet palette
`InstancedMesh` buckets. Only helmet instance color changes with enemy tier.
Renderer-only size is 0.78 for normal enemies and 0.85 for players; simulation
positions, collision, count, and balance are unchanged. The small squad's
rendered anchors spread within the road for silhouette readability without
changing simulation formation positions.
