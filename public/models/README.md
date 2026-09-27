# Toy Samurai Army assets

Source: [Kenney Mini Forest 1.0](https://kenney.nl/assets/mini-forest),
official archive `kenney_mini-forest_1.0.zip`. Its included `License.txt`
states Creative Commons Zero (CC0). No paid assets or other source family is used.
Archive SHA-256: `8691614018075A66458E35915B8C358C2E6178648AEDADAFCDF313B924AA6581`.

Selected exact source files from `Models/GLB format/`:

- `character-archer.glb`
- `weapon-bow.glb`
- `weapon-arrow.glb`
- `Textures/colormap.png`

Run `python scripts/prepare_character_models.py SOURCE_DIR public/models` with
these four files in SOURCE_DIR. The script needs NumPy and Pillow. It samples
the archer's `idle` animation at 0.2 seconds, bakes the two skinned meshes into
one rigid mesh, places feet at Y=0, centers X/Z, and normalizes body height to
one game unit. It remaps the Kenney swatch texture to fixed warm skin and
neutral underclothes. Chunky kabuto, shikoro, V crest, chest/shoulder/forearm
armor and boots are made from low-poly boxes in the offline script. The boss
uses the same archer body with a broader armor and crest variant. Kenney's bow
and arrow meshes are baked to rigid geometry with dark wood materials.

| Runtime file | Bytes | Use |
| --- | ---: | --- |
| `toy-samurai-body.glb` | 47,008 | Shared fixed body and skin |
| `toy-samurai-armor.glb` | 9,636 | Player and enemy tier armor |
| `toy-samurai-boss-armor.glb` | 11,076 | Broader boss armor |
| `toy-samurai-bow.glb` | 5,252 | Player bow |
| `toy-samurai-arrow.glb` | 4,320 | Projectile arrow |

Runtime files contain no skins or animations. Normal enemies use two shared
`InstancedMesh` layers per palette bucket, one fixed body and one tintable armor,
so there is no mesh or animation mixer per enemy. The bow and arrow use the
original Kenney geometry, while their materials stay neutral across tiers.
