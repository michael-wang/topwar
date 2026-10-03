# Coastal R3 presentation review

Verified starting HEAD/origin/main: `17fffdcac3abde4c08492cc66ab271c8cf777ad2`.
Baseline captures load that commit read-only through Vite; QA never resets the checkout.
390×844 CSS portrait, DPR 2, actual shipping lighting/camera except named close inspections.

## Commit 1 checkpoint — pale shatter

`baseline-*.png` captures the accepted R2 baseline. `death-*.png` captures R3 death
before either environment commit. Grunt/Heavy preserve the last drawn run pose,
drain naturally lit albedo to plaster by 80 ms, hide at 110 ms, then shatter into
six/eight rounded fragments for 280 ms. One 384-instance mesh bounds normal
fragments; 48 reusable intact-body slots remain. Colors are #D8D9D1 / #E7E4D9 /
#BFC5C1, independent of faction and tier. No glowing corpse or rising dissolve.

Giant drains color over 120 ms, keeps its 90–520 ms fall and breaks at the
520 ms crash. Twelve larger pale fragments per existing bounded slot replace
colored armor rubble and the 36-point burst. Sand ring/dust remain; fade starts
1550 ms and clears at 2400 ms. Ordinary R2 surviving hits remain unchanged.
All role geometry, Player/Boss and gameplay are unchanged.

Sequence sources include alive, pale, initial shatter, spread and cleared states
for Grunt/Heavy and lethal/fall/crash/shatter/cleared for Giant. QA refreshes
renderer feedback per fixture and keeps original simulation/config untouched.
The final `polish-*` captures below include all three R3 presentation changes.

## Commit 2 checkpoint — openings and legacy naval boundary

`openings-*.png` records the coast before foreground dressing. The exact
screen-right foreground house is the negative-X building at Z=24 (QA close
camera is labeled; runtime framing is unchanged). Broad deep-shadow door/window
blocks now have plaster jambs/lintels/surrounds, cyan painted leaves/shutters and
small secondary-shadow inner cores. The broad navy painted side plane is lifted
to cool plaster. Materials are still merged per side; lights remain unchanged.

The dark ship came from `BridgeEnvironment.buildActivity()` (#303B40 hull,
#39474B fittings), not the Mediterranean fleet. `updateActivity()` now gates
whole-ship visibility on legacy mode. Schedule, rewind and mode-switch tests
keep it hidden in defense while preserving legacy activity/fade/bridge masking.
Aircraft/flak and `OffshoreTransports` are retained. Fifteen focused environment
tests and typecheck pass at this checkpoint.

## Commit 3 checkpoint — civilian side framing

At track half-width 3.2, screen-left (positive world X) has a low plaster bench
at X≈5.05/Z=7.5, vessels at X≈4.32/Z=8.55 and X≈4.95/Z=10.3, and rope at
X≈4.18/Z=9.65. Screen-right has a terrace step at X≈−5.15/Z=12.7, timber seat
with folded cyan cloth at X≈−4.95/Z=13.05, and vessel at X≈−5.8/Z=14.05.
All opaque vertices remain outside track edge + 0.4 at tested half-widths
1.5/2.5/3.2/6. Height stays below 0.75 and Z inside 5–17. These are disposable
defense-only presentation resources, with no collision. Seven merged draws use
five shared matte illustrated materials; no external texture is added.

## Review index

- `portrait-before-after.png`: matched R2/R3 Level-7 portrait.
- `right-house-before-after.png`: exact screen-right house close inspection.
- `warship-mode-proof.png`: defense before/after and legacy-mode retention.
- `foreground-before-after.png`, `foreground-close.png`: empty beach and clusters.
- `polish-dense-mixed.png`, `polish-outer-lanes.png`: mixed battle and outer-lane visibility.
- `grunt-death-sequence.png`, `heavy-death-sequence.png`, `giant-death-sequence.png`:
  alive, pale, shatter/spread and cleared states. Giant includes fall/crash.
- `*-death-before-after.png`: old floating/colored death versus new pale shatter.
- `polish-grunt-death.gif`, `polish-heavy-death.gif`, `polish-giant-death.gif`:
  actual renderer temporal frames at 30/60 ms sampling, played at their sampled
  duration (alive/cleared holds added for review). Matching `baseline-*.gif` is included.
- `r3-live-*.png`, `production-*.png`: real app/input/start-mode sanity.
- `performance-comparison.json`: counters, bundle sizes, pixel guards and sanity checks.

Normal camera, lighting, HUD and fixture state match at 390×844 CSS / DPR 2.
Only the explicitly labeled house/cluster inspections move the QA camera.
Player and Boss isolated guard images are pixel-identical. All living character
geometry, simulation, balance, normal start and review setup remain unchanged.

## Measured R2 → R3 work

| Fixture | Draws | Triangles | Geometries | Textures |
| --- | --- | --- | --- | --- |
| 100 Grunts | 139 → 144 | 268,608 → 270,900 | 66 → 71 | 6 → 6 |
| 100 enemies, 20% Heavy | 184 → 189 | 282,768 → 285,060 | 66 → 71 | 8 → 8 |
| 24 simultaneous deaths, sampled peak | 223 → 227 | 282,702 → 284,992 | 68 → 72 | 8 → 8 |

The seven foreground draws are partially offset by removing legacy Points
draws. Dense living triangle increase is 2,292 (+0.81% in mixed fixture), not
per-enemy growth. Peak resource counters include the warmed shatter geometry;
maximum draws/triangles are sampled independently across the lethal beat.
One shared normal fragment draw remains bounded at 384 instances; Giant chunks
reuse existing per-slot draws (12 pieces × three renderer slots).

JS: 977,736 → 983,898 bytes (+6,162); gzip: 264,444 → 265,755 (+1,311).
Legacy character downloads remain 13 requests / 356,172 bytes. No new textures,
packages or GLBs. SwiftShader counters measure submitted work; mobile hardware
FPS is not measured. Generic rounded fragments are intentionally economical,
not literal fractured role geometry. Side props stay restrained and partly
cropped by the portrait edge, rather than filling the open central sand.

## Validation and reproduction

Final validation: `npm test` **584 tests / 85 files passed**; `npm run typecheck`
passed; `npm run build` passed (**210 modules**, 983.90 kB JS / 265.76 kB gzip).
Existing Rollup Zod annotation warnings and the >500 kB chunk warning remain.
Focused checks cover deterministic bounded pale shatter, role pose ownership,
Giant crash/reset/disposal, defense/legacy naval boundary, smaller lifted
openings, foreground clearance at four widths and exactly-once resource disposal.
Live default dev/review/normal input, combat, pause, Retry and browser-error
checks pass. Production default/normal are Level 1; explicit threats is Level 7.

QA source is local and does not ship. With Vite running at 5173:
`node artifacts/coastal-r3/capture.mjs baseline`, then `... polish` capture
fixtures. `temporal-deaths.mjs baseline` / `... polish` capture raw temporal
frames (ignored after GIF assembly). `review.py` assembles sheets/GIFs and
asserts Player/Boss pixel guards. `compare-bundles.mjs`, `live-sanity.mjs r3` and
`production-sanity.mjs` generate the corresponding JSON. The baseline adapter
uses `git show` from the verified R2 commit without resetting the checkout.

No deployment. Boss Rounded Toy migration remains deferred; stop for R3 human review.
