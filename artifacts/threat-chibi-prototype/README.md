# Phase 4A threat prototypes — review evidence

Baseline verified: `83234e8877e3dc3803aa9029520aef6317409d6f` (Phase 3B).
Review-preset commit: `ca1b5bebb9f260fed80ea4fbe2cf0e3152f7f9a5`.
Heavy/Giant are prototypes awaiting human review. Player remains Phase 2B,
Grunt remains accepted Phase 3B, Boss stays legacy. No deployment.

## Immediate in-game review

Open the development game at `http://localhost:5173/?review=threats`.
A standard URL remains Level 1 with ordinary random run seeding.

The review adapter restores ordinary validated gameplay state:

- fixed seed `0x4a070`, Level 7 / 0 current-level XP;
- two rifle defenders; reinforcement started at 0 and already arrived;
- simulation elapsed time starts at the configured 1.1-second arrival boundary;
- Grunt: lane 4, x=2.8, z=8, HP=1;
- Heavy: lane 3, x=1.4, z=12, configured HP=15;
- Giant: lane 1, x=-1.4, z=22, configured HP=172;
- lanes are zero-based; positions use the actual five-lane layout;
- ordinary movement, targeting, damage, spawning and the ten-second reinforcement
  power window continue after initialization; no combat cheat or review save flag;
- actual Retry reconstructs the same adapter, seed and composition.

Heavy occupies a neighboring lane so the initial two defenders do not immediately
kill the review subject. Step toward it to test ordinary combat.

## Review images

All full portraits use **390×844 CSS pixels / DPR 2 (780×1688 PNG)**, the shipping
camera and coastal lighting. QA stops the clock only in deterministic render
fixtures; `prototype-live-*` uses the real running app and input.

| Review | Image |
| --- | --- |
| Opening, three roles, Level-7 HUD | [Opening](prototype-review-opening.png) |
| Phase 3B → 4A opening | [Comparison](compare-review-opening.png) |
| Mixed crowd / two defenders | [Mixed threats](prototype-mixed-threats.png), [comparison](compare-mixed-threats.png) |
| Actual live review / normal | [Review](prototype-live-review.png), [normal](prototype-live-normal.png) |
| Four black silhouettes | [Silhouette sheet](silhouette-sheet.png) |
| Helmet identity, black / color | [Black](helmet-sheet.png), [color](helmet-color-sheet.png) |
| Isolated Heavy, front / rear | [Front](prototype-heavy-isolated-front.png), [rear](prototype-heavy-isolated-rear.png), [before/after](compare-heavy-isolated-front.png) |
| Isolated Giant, front / rear | [Front](prototype-giant-isolated-front.png), [rear](prototype-giant-isolated-rear.png), [before/after](compare-giant-isolated-front.png) |
| Complete 650 ms Heavy gait | [Six-frame strip](heavy-gait-strip.png) |
| Complete 850 ms Giant gait | [Six-frame strip](giant-gait-strip.png) |
| Heavy hit / death / contact | [Hit](prototype-heavy-hit.png), [death](prototype-heavy-death.png), [contact](prototype-heavy-contact.png) |
| One Heavy mixed into Grunts | [Crowd](prototype-one-heavy-crowd.png) |
| Giant reveal / hit / bar | [Reveal](prototype-giant-reveal.png), [hit](prototype-giant-hit.png), [HP](prototype-giant-hp.png) |
| Giant fall / crash / debris | [Fall](prototype-giant-fall.png), [crash](prototype-giant-crash.png), [debris](prototype-giant-debris.png) |
| Two simultaneous Giants | [Two Giants](prototype-giants-two.png) |

Silhouette/helmet sheets crop whitespace without rescaling their actual projection
(DPR 2); Player/Grunt/Heavy are measured at depth 7, Giant at its useful review
depth 22. Player uses its shipping 0.85 scale. Heavy at equal Grunt depth measures
79.75 CSS pixels tall / 82.51 wide against Grunt 62.05 / 47.68: **1.28× height,
1.73× width**. Isolated inspections normalize source root scale and use a closer
QA camera to inspect forms; they are supplementary, not the size acceptance view.

The four roles communicate clean dome/rifle, pot helmet/small round body, wide
low double-rim wall, and large crest/body/maul. Known prototype compromises:
four rigid poses remain visibly quantized; Heavy's subtle planting may need
human motion review; the longitudinal Giant crest looks thin head-on; fists can
partly merge into the body in black projection; chest guards remain simple
convex masses. These are left for feedback, not automatically polished.

## Performance: Phase 3B → Phase 4A

Chrome headless SwiftShader, identical portrait fixtures and capture order.
GPU counts are warmed resource counts after the same preceding fixture sequence,
not total repository resource counts. These measurements are not phone FPS.
No population reduction; mixed crowds contain **20% Heavy** (10/20/30/40).

| Fixture | Draws before → after | Triangles before → after | GPU geometries | GPU textures |
| --- | ---: | ---: | ---: | ---: |
| 35 Grunts, one defender | 135 → 135 | 35,236 → 35,236 | 66 → 66 | 7 → 6 |
| 35 Grunts + Heavy + Giant, two defenders | 190 → 150 | 39,068 → 39,358 | 71 → 72 | 10 → 9 |
| 50 mixed enemies, two defenders | 165 → 165 | 47,518 → 52,100 | 86 → 90 | 12 → 11 |
| 100 mixed | 186 → 186 | 84,718 → 93,882 | 86 → 90 | 12 → 11 |
| 150 mixed | 205 → 205 | 121,901 → 135,660 | 86 → 90 | 12 → 11 |
| 200 mixed | 225 → 225 | 159,086 → 177,440 | 86 → 90 | 12 → 11 |
| Two Giants, two defenders | 226 → 146 | 13,396 → 13,044 | 91 → 90 | 13 → 12 |

Heavy keeps its own bounded instanced body/helmet/guard batches: approximately
458 extra triangles per member, with no draw increase in matched crowd fixtures.
Giant uses four primary mesh draws instead of its old many-part assembly, saving
40 draws per live Giant. Three slots still support two live and one collapsing.
No external texture is added; the GPU loses an unused legacy atlas texture.

Character GLB downloads: **19 / 532,448 bytes → 13 / 356,172 bytes**, a reduction
of six requests / 176,276 bytes. Superseded normal body, four runs and normal vest
remain in the repository for history/rollback. Boss, reward and bullet resources
are still named, protected and loaded once. Matched JS sizes are in
[bundle-comparison.json](bundle-comparison.json).

## Validation and reproducibility

- `npm test`: **553 tests, 76 files passed**.
- `npm run typecheck`: passed.
- `npm run build`: passed, 205 transformed modules.
- Existing warnings: two Zod annotation warnings and the >500 kB chunk warning.
- Actual browser: normal Level 1 / review Level 7, correct reinforcement/roles,
  keyboard and touch lane input, continuing firing, pause/resume, actual Retry.
  See [live-sanity JSON](prototype-live-sanity.json).
- Eight protected screenshots are pixel-identical: Player; Grunt idle/hit/death/
  contact; Boss active/death; world-only. [Guard results](pixel-guards.json).
- Current-family tests cover dedicated resources, no atlas selectors, deterministic
  poses/materials, Heavy hit/contact/death/HP, Giant envelope/reveal/hit/crash/contact,
  two independent slots, ownership/disposal, shadows and no combat metadata.
- Existing Player/Grunt, Phase-1 role isolation, legacy Boss/bake, gameplay and
  snapshot protections remain. No simulation/config/snapshot file is changed.

From the repository root with Node 24 / Chrome installed:

```powershell
node artifacts/threat-chibi-prototype/capture.mjs baseline
node artifacts/threat-chibi-prototype/capture.mjs
python artifacts/threat-chibi-prototype/review.py
node artifacts/threat-chibi-prototype/live-sanity.mjs
node artifacts/threat-chibi-prototype/compare-bundles.mjs
```

`baseline-server.mjs` overrides only Phase-3B source modules in a temporary Vite
server. It never resets the checkout or replaces shipping files. The preset-only
commit's legacy evidence is `preset-live-*`; the new-art evidence is
`prototype-*`. Build labels show the checkout revision at capture time.
Stop after Phase 4A; no automatic Heavy/Giant polish, Boss or ship work.
