# P1.5 — Radius-four Grenade feel and review

Historical phase evidence: measurements below used capacity 1. Current capacity is 3; the defense hint and standalone base-archetype review fixtures have been removed. See `PRE_RELEASE_REPORT.md` for current behavior and validation.

Starting baseline: `3e2b640a78a65b064cf6643ec6dffe0602ef1048`. HEAD, origin/main and live GitHub main matched, with a clean worktree before editing. No deployment.

## Authored behavior and scope

Only the authored Grenade **blastRadius changes from 2 to 4 world units**, in `public/game-data/game.json → catharsis.grenade` and its validated defaults in `src/config/grenadeConfig.ts`. Damage stays **9 defense-enemy HP**, no falloff, capacity1, flight0.65s, forward range24, first supply Lv3+8s, one Rifle hit. Target anchors, nearest-Z/ID ties, capture, deterministic circular victim order and ordinary XP are unchanged. Heavy15 →6 and Giant172 →163. No global difficulty, XP curve, stream, lane composition or death-presentation changes.

`GrenadeRenderer` already uses the authoritative detonation radius for flash scale, ground-ring scale and dust travel. Radius4 therefore doubles all three footprints; a focused test verifies it. The same **16 dust instances**, meshes, geometries and materials are reused. No new effect slots or per-victim allocations were introduced.

## Fast review loop

`src/app/DevReviewFixtures.ts → createDevReviewFixture(..., 'grenade')` creates **Lv3, one Rifle, center lane, one already-acquired charge**, **45 Grunts / three Heavies**, no Giant or Boss. Grunts occupy all five lanes, nine per lane, at fixed uneven depths10–18; Heavies occupy lanes1/2/4 at depths13.3/15/16.7. Lane centers and Heavy HP come from normal configuration. Enemy IDs, depth placement, simulation seed and state repeat exactly. Ordinary stream cursor advances beyond short review range, following the existing Lab pattern. Combat thereafter uses normal firing/movement/HP/damage/XP.

`src/ui/DevReviewControls.ts` adds DEV-only **GRENADE**, restarting through the existing app fixture/reset path. It releases its button focus so **GRENADE → Q → GRENADE** works immediately. Retry preserves the selected fixture. Production tree-shakes the Lab factory/controls, and browser checks confirm no `.dev-review-controls` or `[data-role="grenade"]` control.

`src/app/GameApp.ts → requestGrenade` is now the common button and keyboard callback. `onActiveItemKeyDown` uses physical `KeyQ`, ignores repeat, and excludes interactive/editable targets and TUNE descendants. The callback rejects pre-start/stopped/paused/dead/empty/in-flight/already-queued/no-target states. Simulation remains the final authority for atomic charge consumption on a valid fixed-tick throw. A/D and arrows, P/Space Pause and Escape TUNE retain their existing handlers. The active button exposes Q in title/aria text without a mobile visual cue.

## Representative portrait throw

Run `node scripts/qa/grenade-review-sanity.mjs artifacts/p15-radius4` with Vite running. The script uses the real DEV control, Q at390×844, and the left button at350×844 / DPR2. It lets the ordinary simulation/presentation run340ms before the throw so the crowd is visible; it does not change damage, HP, cooldowns or balance. The 390 check also exercises Pause and TUNE focus before throwing. A first capture attempt stopped before detonation because resume resets the RAF baseline; the harness now allows that zero-delta frame. Runtime flight timing stayed0.65s.

Both portraits give the same central captured anchor near **X0 / Z13.62**:

| Measurement | Result |
| --- | --- |
| Initial composition | 45 Grunts, three Heavies |
| Before screenshot | 44 living Grunts; one ordinary Rifle kill |
| Grenade victims | 37: 35 Grunts killed, two Heavies damaged |
| Grenade XP | 35, exactly once per Grunt |
| Immediate Heavy HP | IDs46/47:6; ID48 outside blast:15 |
| XP before → immediate aftermath | 1→39:35 Grenade XP plus three concurrent Rifle XP |
| Grunts about one second later | Six living; accepted deaths have retired |
| Fraction erased by Grenade | 35/45 =77.8% of initial Grunts, 35/44 =79.5% of pre-throw living Grunts |

This dense, messy five-lane fixture exceeds one-third visibly and reaches the high end of the requested20–35 diagnostic. It is not a fixed fraction rule. No fixture population/depth tuning was performed after seeing the result. The enlarged flash covers the affected battlefield area; the accepted pale death lift/fade remains visible immediately, followed by a broad clear section at+1s. Later Rifle hits can further reduce surviving Heavy HP; the immediate6 HP boundary above isolates Grenade damage.

Inspected captures under ignored `artifacts/p15-radius4/`:

- `grenade-before-390.png`, `grenade-blast-390.png`, `grenade-after-390.png`
- Matching350px before/blast/after frames
- `grenade-lab.json`: full states, victim events, XP and resource cycles

Five repeated real fixture resets/throws retain **77 geometries /11 textures** before and after each explosion, with **16 dust slots**. Each reset restores all48 enemies and the charge deterministically.

## Existing deterministic pilots at the larger radius

Run `node scripts/qa/p15-metrics.mjs artifacts/p15-radius4`. Same original policy, seeds1–50, normal/1.8-second Lv3 hesitation, use/no-use controls: **200 runs**. No policy changes were made to improve the new radius's results. Generated metrics/timelines are ignored; the original policy and limitations are documented in `P15_REPORT.md`.

| Cohort | Reached Lv5 | Charge used | Median kills / XP when used | Mean kills / XP | Kill range | Near-count drop |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Normal, Grenade | 50/50 | 39 |23 /23 |24.64 /25.10 |9–43 |29/39 |
| Hesitation, Grenade | 50/50 |37 |23 /23 |23.54 /23.78 |6–39 |28/37 |
| Normal, no throw |49/50 |0 |— |— |— |— |
| Hesitation, no throw |49/50 |0 |— |— |— |— |

Both Grenade cohorts have zero contact casualties. No-throw controls still fail on seed35. Each cohort hits13 Heavies; two normal /one hesitation wounded Heavies die through ordinary XP. Larger XP totals reflect those normal rewards, not a damage increase. Seventeen used blasts per cohort fall within20–35 kills; dense higher counts are retained. Unused charges and lower-count throws remain valid outcomes under the unchanged diagnostic policy.

Immediate mean near-defense enemy count falls **8.51→2.15** normal and **8.95→1.86** hesitation. Lv3 remains the highest-or-tied near-count peak in50/50 of each Grenade cohort. Mean Lv3 duration is22.21/22.40s. The original radius-two means were23.77/23.86s; larger AoE also advances progression through normal victim XP.

| Required seed | Normal / hesitation Grunt kills and XP | Near count before→after→+2s, both pilots | Lv4 /Lv5 timestamps, both pilots |
| --- | --- | --- | --- |
|1 |9 /9 |11→5→0 |49.93 /70.88s |
|17 |23 /23 |12→2→0 |48.55 /70.30s |
|42 |20 /20 |8→0→0 |48.53 /70.55s |

These six blasts hit Grunts only. Radius4 does not guarantee a large clear in every scattered state: seed1 still kills nine, and max-count anchors can be deeper than near-line pressure. The unchanged use policy consequently holds some charges longer or never spends them. There is no evidence here requiring a radius reduction or unrelated balance adjustment. Human timing/readability and sustained Lv4 pacing remain the next playtest questions.

## Validation and performance

**710 tests across121 files pass**; typecheck and production build pass. Existing audio-start/live/production sanity, enlarged-crowd portrait QA and existing burst-performance diagnostic pass. Production checks explicitly report zero Grenade Lab controls for normal/default/threat review. Focused tests cover authored radius4, inclusive circular edge versus diagonal/outside points, exactly9 damage, Heavy/Giant survival, 32-victim ordinary XP overflow, concurrent Rifle/blast kills and surviving damage, shared Q/button requests, repeat/focus/start/pause/death/empty-lane guards, DEV-only construction, deterministic fixture and repeated resets. Existing Zod annotation/bundle-size warnings remain.

The existing warmed200-enemy software-renderer diagnostic ran in isolation from other browser checks, four seconds per case, after scene warmup:

| Diagnostic | No throw | Radius4 throw |
| --- | ---: | ---: |
| Sample frames |31 |37 |
| Frame mean /p95 |129.04 /133.40ms |108.56 /133.40ms |
| App CPU mean /p95 /max |2.39 /2.90 /3.50ms |2.13 /2.70 /3.10ms |
| Final living enemies |200 |141 |
| Geometries /textures |85 /12 |85 /12 |

This artificial dense diagnostic removes59 enemies, beyond the normal Lab's35, without resource growth or an obvious frame/CPU spike. Five diagnostic burst cycles also retain85 geometries/12 textures. An earlier sample overlapping other browser checks had blast p95 up to166.7ms; the isolated repeat above avoids that confound. The renderer remains slow in both cases (about8–9 FPS); lower population after the blast also reduces later render cost, so the sample cannot isolate a tiny transient GPU cost or prove an overall optimization. Full output: `artifacts/p15-radius4/burst-performance-isolated/browser.json`.

The software Chrome/SwiftShader diagnostic is not physical-phone certification. Phone feel and GPU/frame pacing remain open; the Lab's large clear is intentionally stronger than the original8–12 target.

## Changed ownership

- Configuration/defaults: `public/game-data/game.json`, `src/config/grenadeConfig.ts`.
- Fixture/control: `src/app/DevReviewFixtures.ts`, `src/ui/DevReviewControls.ts`.
- Shared activation/shortcut: `src/app/GameApp.ts`, `src/ui/GrenadeButton.ts`.
- Focused coverage: `tests/DevReviewFixtures.test.ts`, `GameApp.test.ts`, `Grenade.test.ts`, `GrenadePresentation.test.ts`.
- QA: `scripts/qa/grenade-review-sanity.mjs`, explicit production-control absence check, QA README.
- Current gameplay/roadmap/experiment documentation and original-report historical labeling.
