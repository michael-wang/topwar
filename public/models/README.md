# Character assets

These three models are by Quaternius and are published as CC0. The playable files
are baked derivatives of only the selected characters. No source animation,
skeleton, or unused kit character/weapon is shipped at runtime.

| Runtime file | Selected source | Creator's CC0 model page | Original Quaternius kit |
| --- | --- | --- | --- |
| `soldier.glb` | Character Soldier | [Character Soldier](https://poly.pizza/m/PpLF4rt4ah) | [Toon Shooter Game Kit](https://quaternius.com/packs/toonshootergamekit.html) |
| `zombie-basic-static.glb` | Zombie Basic | [Zombie](https://poly.pizza/m/VlXjG0N8Eg) | [Zombie Apocalypse Kit](https://quaternius.com/packs/zombieapocalypsekit.html) |
| `giant.glb` | Giant | [Giant](https://poly.pizza/m/BldaiPtyJa) | [Cube World Kit](https://quaternius.com/packs/cubeworldkit.html) |

The kit pages state CC0, and each linked individual model page identifies
Quaternius as creator and marks that model CC0. The official kit Drive folders
list the exact files `Character_Soldier.gltf`, `Zombie_Basic.gltf`, and
`Giant.gltf`. The Drive downloads returned a quota error during preparation,
so the input GLBs came from Quaternius's individual model pages linked above.
The individual Zombie page labels the model `Zombie`; its identification as
the kit's Basic variant follows the official folder listing and the source
model's plain `Zombie` mesh name. It was not byte-compared with the Drive file.
Do not use the license of a multi-model bundle in place of these individual
CC0 pages; bundles can mix licenses.

Source GLBs, in `soldier.glb`, `zombie.glb`, `giant.glb` order, were downloaded
from the individual pages' model files. Their SHA-256 hashes are:

```text
06597E2CD20840EEE8BED03790F32138E379BA3D6C7F61EB87E29F0C672D4D54
3AFD2837B117F264AFD037A350759B96D6F837FC9B381CCA35CF6796B4BAB09D
09F2FC7A7D8E9504BEA781DF0730DE0F9E479D04BE10AF134AE618A158F7ABB1
```

To reproduce, place those input files in a temporary directory with the names
above and run `python scripts/prepare_character_models.py SOURCE_DIR public/models`.
The script needs NumPy and Pillow. It samples `Idle_Shoot` for Soldier,
`Run_Attack` at 0.22 seconds for Zombie, and `Idle` for Giant; bakes skin
deformation into rigid geometry; strips animations, skins, joints, and unused
mesh parts; centers X/Z; places the lowest vertex on the ground; normalizes
height to one game unit; and rotates Zombie and Giant to face the player. The
Zombie and Giant atlases are converted to grayscale so tier color can come from
the existing enemy palette. Soldier keeps its material regions so body and
head can use blue tier colors while skin and weapon colors stay separate.

The runtime loader shares geometry and source textures. Normal Zombies use one
`InstancedMesh` per tier palette bucket with per-instance color and transform;
they do not use a skeleton or `AnimationMixer`. Soldier instances share one
geometry and a set of materials per blue tier. Giant shares one geometry and
uses a material derived from the active Boss tier.
