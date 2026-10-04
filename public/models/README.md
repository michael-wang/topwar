# Current character asset boundary

Player, Grunt, Heavy and Giant are original deterministic procedural runtime
families. They do not load body, locomotion or weapon GLBs. Their geometry,
materials and motion ownership are documented in `CHARACTER_VISUAL_SYSTEM.md`.

The 13 static GLBs below remain for legacy Boss, the shared Boss/reward helmet
and bullet. `src/rendering/CharacterAssets.ts` exports the exact
`LEGACY_MODEL_FILES` load manifest; all files are requested once. Run poses borrow
the Boss body material. The gray atlas supplies Boss death material while the
renderer preserves the active body pose. Boss migration remains deferred.

## Source and regeneration

Source: [Kenney Mini Forest 1.0](https://kenney.nl/assets/mini-forest), official
archive `kenney_mini-forest_1.0.zip`. Its included `License.txt` states Creative
Commons Zero (CC0). Archive SHA-256:
`8691614018075A66458E35915B8C358C2E6178648AEDADAFCDF313B924AA6581`.

The only external inputs are `Models/GLB format/character-archer.glb` and
`Models/GLB format/Textures/colormap.png`. Place both in `SOURCE_DIR`, then run:

```sh
python scripts/prepare_character_models.py SOURCE_DIR OUTPUT_DIR
```

The script requires NumPy and Pillow and generates exactly the current 13 files.
Use a temporary output directory and compare before replacing `public/models`.
R6 regeneration from the available source fixture reproduced all 13 files
byte-for-byte. Obsolete Player/normal-enemy bake paths are removed; Git history
retains prior assets and evidence.

Boss idle samples `idle` at 0.2 seconds, and its four walk frames sample `sprint`
at 0.0625, 0.1875, 0.3125 and 0.4375 seconds without amplified limb rotations.
The four two-handed slam poses sample `attack-melee-right` at 0.18, 0.29, 0.34
and 0.40 seconds, with the left arm drawn from `attack-melee-left`. Runtime GLBs
have no skeletons or animations; Boss retains its 1.1-second walk cycle.

The bake removes the source green headgear and rear archer shaft. Idle/walk
hair and side-scalp faces hidden above the helmet rim are clipped at Y=0.725;
slam poses remove the closed top hair cap while preserving visible side skin.
These UV/topology guards and the current asset hashes remain tested. The Boss
body embeds the unchanged source PNG (SHA-256
`319F1087D8ED50A8794F9A8179F64671D5595F2365FDF3E47EC2D4EB74DBA20F`);
the gray body uses a grayscale copy. No procedural role uses Kenney UV selectors.

The shared helmet and Boss vest are generated primitives. Boss retains its
local helmet fit: scale 0.92, seat offset Y=-0.025 and forward offset Z=0.10
around the existing pivot. Vest tier variants remain bounded, with colored
plates and charcoal detail. The bullet is a 0.52-unit tracer with shared core
glow presentation. URLs use `publicAssetUrl()` for dev and `/topwar/` builds.

## Shipping files

| File | Bytes | Current use |
|---|---:|---|
| `toy-soldier-boss-body.glb` | 43,760 | Boss idle/reference; original Kenney atlas |
| `toy-soldier-boss-run-0.glb` | 32,628 | Boss static walk pose |
| `toy-soldier-boss-run-1.glb` | 32,056 | Boss static walk pose |
| `toy-soldier-boss-run-2.glb` | 32,056 | Boss static walk pose |
| `toy-soldier-boss-run-3.glb` | 32,628 | Boss static walk pose |
| `toy-soldier-boss-slam-0.glb` | 32,304 | Boss static two-handed slam pose |
| `toy-soldier-boss-slam-1.glb` | 32,300 | Boss static two-handed slam pose |
| `toy-soldier-boss-slam-2.glb` | 32,300 | Boss static two-handed slam pose |
| `toy-soldier-boss-slam-3.glb` | 32,300 | Boss static two-handed slam pose |
| `toy-soldier-boss-vest.glb` | 10,276 | Boss tier-colored vest with charcoal strap/pouch regions |
| `toy-soldier-bullet.glb` | 1,720 | Projectile tracer geometry |
| `toy-soldier-gray-body.glb` | 36,340 | Boss death gray atlas (active-pose geometry supplied by renderer) |
| `toy-soldier-helmet.glb` | 5,504 | Shared Boss/reward helmet |

Total GLB payload: **356,172 bytes / 13 requests**.
