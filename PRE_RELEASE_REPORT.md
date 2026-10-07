# Final pre-release HUD / input / cleanup

Historical HUD hint evidence: the following pass used capability-driven keycaps. `START_GLYPH_REPORT.md` supersedes only that hint selection/artwork with Start-derived presentation and unboxed overlays; three-Grenade measurements remain applicable.

Starting HEAD, fetched origin/main and GitHub main matched `bc3b8f309ff7dc0998ef2967adf9cf42488be3f0`; the tracked and untracked worktree was clean. No deployment was performed.

## Implemented behavior

- The accepted compact lower HUD and bottom strip remain in place. Fine primary pointer **and** hover reveal small **A / D** movement keycaps and **Q** on Grenade. Default/coarse UI has arrows, Grenade icon and charge only. No user-agent detection. Existing A/D, arrows and physical Q handlers are unchanged.
- Defense no longer constructs `ControlHint`; its defense branch, text, fade/layout CSS and tests are removed. Retained legacy play still uses its own keyboard hint.
- The one teaching supply at **Lv3 +8 seconds**, requiring **one Rifle hit**, fills **three charges**, capacity **3**. No recurring supply. A valid throw consumes one; invalid activation consumes none. One flight blocks both request paths, preserving reserves. Inventory 0–3, acquisition and flights with reserves validate/restore deterministically. Older capacity-1 configuration/snapshots remain supported within the narrow 1–3 capacity schema. Normal Retry returns to unacquired Lv1; DEV Retry retains its selected review scenario.
- Grenade retains **9 defense-enemy HP / radius 4 / no falloff / .65-second flight**, global nearest-emergency centroid targeting, ordinary victim XP and supply placement. Full-health Heavy still survives at **6 HP**, Giant at **163 HP**. No other gameplay/configuration numbers changed.
- Acquisition has one **550ms pop**, then static warm ready contrast. No looping ready pulse or visible GRENADE/READY/HELD/EMPTY labels. Unavailable/flight/empty states remain subdued and keep an accurate count.
- Local/system CSS tokens separate combat display, compact HUD and utility typography. Impact/Haettenschweiler/Arial Narrow/heavy fallbacks give LV its strongest condensed, slightly slanted outlined treatment; compact HUD uses Bahnschrift/Arial Narrow/Segoe UI fallbacks. Charge, keycaps, Pause, level-up, game-over and Tap-to-Start share the appropriate token; DEV uses restrained Segoe UI/Arial. No network font dependency. Legacy-only typography is retained.

## DEV cleanup

`src/app/EnemyVfxLab.ts` → `src/app/DevReviewFixtures.ts`; `src/ui/EnemyVfxLabControls.ts` → `src/ui/DevReviewControls.ts`. Type is `DevReviewFixture`; tests and app/QA references follow the rename. The remaining menu is exactly **GRENADE / CURVE / EVOLVE / MG**, with physical **4 / 5 / 6** retained. GRENADE starts with three charges; crowd placements and all other review behaviors are unchanged.

Standalone base-archetype roles, their configuration/depth constants, construction branch, menu buttons and role-specific tests were deleted. The obsolete standalone browser script `scripts/qa/vfx-lab-sanity.mjs` was deleted. Production Grunt/Heavy/Giant systems, natural Giant encounters, ordinary hit/death VFX and the separate threat-art review remain. Camera/death tests now construct ordinary authoritative enemy state rather than obsolete DEV roles; visual-salt testing uses the retained MG review.

`grenade-lab-sanity.mjs` is now `grenade-review-sanity.mjs`. Current README, QA, architecture, game specification, roadmap and art/HUD contracts remove obsolete fixture/hint instructions and capacity-one claims. Historical milestone reports explicitly identify their one-charge measurements rather than presenting them as current evidence. No dead visible battle-info metrics remain: telemetry still contains only weapon/cartridge pips and meaningful unlocked squad pips.

## Deterministic progression impact

`node scripts/qa/grenade-capacity-metrics.mjs` compares **200 runs**: seeds **1–50**, normal/hesitation and capacity **1 versus 3**, with every other current configuration value identical. Fixed 60Hz; one adjacent lane step per 200ms toward nearest threat/supply; prioritize Giant when ordinary urgency permits. Hesitation holds the lane for **1.8s at Lv3 +3s**, leaving auto-fire unchanged. The existing emergency/crowd policy can spend every reserve, one flight at a time. Runs end two seconds after Lv6, death or 180s. This is a policy comparison, not a human-skill ranking.

Times below are simulation seconds. Kills/XP lists contain each detonated throw in order, including later-level use; the used column counts valid launches.

| Seed / pilot | Lv3 entry | Supply acquisition | Used | Kills / XP per throw | Lv4 | Lv3 duration, cap1 → cap3 | Failure / casualties |
| --- | ---: | ---: | ---: | --- | ---: | --- | --- |
| 1 normal | 30.23 | 38.80 | 3 | 15/15; 12/21; 19/19 | 47.47 | 21.55 → 17.23 | no / 0 |
| 1 hesitation | 30.23 | 38.80 | 2 | 29/29; 15/15 | 44.03 | 17.10 → 13.80 | no / 0 |
| 17 normal | 27.85 | 36.55 | 3 | 18/18; 9/9; 7/7 | 46.68 | 22.57 → 18.83 | no / 0 |
| 17 hesitation | 27.85 | 35.88 | 3 | 17/17; 6/6; 17/17 | 43.83 | 20.98 → 15.98 | no / 0 |
| 42 normal | 28.32 | 36.80 | 3 | 29/38; 16/16; 12/12 | 46.35 | 20.15 → 18.03 | no / 0 |
| 42 hesitation | 28.32 | 36.80 | 3 | 29/38; 16/16; 12/12 | 46.35 | 20.15 → 18.03 | no / 0 |

Seed 42's final throw occurs at Lv4; charges remain usable through upgrades. Seed 1 hesitation keeps one reserve through the end of this policy run. No throw skips multiple levels. There are 32 level-crossing blasts in the capacity-3 cohort, all Lv3→4; maximum retained overflow is 33 XP. Ordinary overflow is visible: seed 1 normal's final Lv3 blast crosses **104 XP → Lv4 +13 XP**; seed 42 crosses **101 XP → Lv4 +7 XP**. No custom Grenade XP arithmetic was added.

| Cohort / capacity | Lv3 completed | Mean Lv3 duration | Mean throws launched | Mean total Grenade XP | Failures / casualties |
| --- | ---: | ---: | ---: | ---: | --- |
| normal / 1 | 49/50 | 21.71s | .98 | 20.84 | 1 / 1 |
| normal / 3 | 49/50 | 19.03s | 2.16 | 39.48 | 1 / 1 |
| hesitation / 1 | 48/50 | 21.74s | .94 | 19.86 | 2 / 2 |
| hesitation / 3 | 49/50 | 19.08s | 2.10 | 37.70 | 1 / 1 |

Duration means exclude runs failing before Lv4; failures remain counted. For capacity 3, normal usage counts for 0/1/2/3 throws were **1/10/19/20**, hesitation **3/7/22/18**. Normal has **108 launches / 107 detonations**; one flight ends with squad death. Hesitation has **105 / 105**. Completed cap3 throws clear **7–33** victims normal and **3–35** hesitation, with mean **17.02 / 16.92** victims and **7–42 / 3–42 XP** per throw.

Mixed evidence: three charges shorten completed Lv3 by roughly **2.7s / 12%**, and almost double total Grenade XP under this policy. Near-defense count becomes zero immediately after **78/107 normal** and **72/105 hesitation** detonations. Mean peak Lv3 near-defense count falls only slightly (**13.80→13.42 normal; 13.98→13.56 hesitation**), because much pressure precedes recovery. Seed 35 still fails in both pilots; normal acquires too late to survive its first flight, hesitation dies before acquisition. The extra charges rescue seed 29 hesitation but do not guarantee survival. Some hesitation timings improve over normal because the lane lapse changes crowd clustering/pilot decisions. This cannot establish human difficulty by itself. The shorter Lv3 and repeat clears deserve physical human playtest; no XP/spawn/damage compensation was made.

Full per-throw activation/detonation clocks, XP before/after, reserve counts, per-lane Rifle-hit debt, near-defense counts, distance/TTC and +2-second pressure are in ignored `artifacts/pre-release/capacity-metrics.json`.

## Validation and captures

- **798 tests across 127 files pass**. Typecheck and production build pass (**240 modules**, **21.20 kB CSS / 1,057.03 kB JS**, gzip **5.30 / 288.21 kB**). Existing bundle-size and dependency annotation warnings remain.
- `release-hud-sanity.mjs`: **390×844 / 350×844 coarse, 1100×844 fine**; expected A/D/Q visibility; arrows/keyboard; no defense hint; settled pulse; Q/button three sequential throws; no concurrent flight; snapshot with two reserves + flight; Pause/invalid target/normal Retry; four menu actions; 4/5/6.
- Deliberate GRENADE three-throw review at all three layouts: **23 kills/23 XP → 12/21 → 6/15**, total **41 victims / 59 ordinary XP**. Different kills versus XP include ordinary Heavy rewards. Remaining enemies and concurrent Rifle kills use normal combat. No special fixture damage or XP.
- `combat-hud-sanity.mjs`: both portrait widths, four exact fixture resets, Lv1–6 pips/weapon transition, real single-kill stage upgrades, casualty-independent unlock pips, transparency/placement, Q/tap/focus guards and synthetic SafeArea **28/18/18/24px**. No visible explanatory labels or overlap with arrows, XP or build label.
- `bottom-strip-sanity.mjs`: actual CDP touch holds both ways, retained **immediate /180ms/120ms** behavior, cancellation/lost capture/blur/Pause/death/Retry cleanup, no hidden steering, native context/selection/callout/drag prevention, accurate XP and reduced motion.
- `p15-browser.mjs`: actual Lv3 +8s supply and one-hit fill to three; no-target preservation, ordinary burst XP, Heavy **6 HP**, Giant **163 HP**, Pause/Retry and resource/performance diagnostic.
- `evolution-fixture-sanity.mjs`: EVOLVE crosses through ten ordinary kills at **1.00s** at both widths, three Rifles → one MG, correct HUD, focus/repeat guards and six alternating resets. **85 geometries / 11 textures / 32 projectile slots** remain stable.
- `audio-start-sanity.mjs`: frozen pre-start clocks, real touch/mouse/Enter/Space activation, 350px startup, Pause/Retry and post-start retained review access. No audio/startup architecture changes.
- `production-sanity.mjs`: default / normal-review / threat-review at both widths; zero DEV menu/fixture DOM, absent obsolete/current factory/control/key-handler markers in shipping JS, 4/5/6 do not activate fixtures, only visible movement buttons. Production contains no obsolete standalone review implementation. Browser suites finish without page/console errors.

Screenshot paths (repository-relative, ignored local evidence):

- `artifacts/pre-release/browser/charge-{3,2,1,0}-{390,350,1100}.png`
- `artifacts/pre-release/browser/charge-2-flight-{390,350,1100}.png`
- `artifacts/pre-release/browser/dev-menu-{390,350,1100}.png`
- `artifacts/pre-release/hud/rifle-lv3-{390,350}.png`, `rifle-lv5-{390,350}.png`
- `artifacts/pre-release/hud/mg-evolution-{390,350}.png`, `mg-lv6-{390,350}.png`
- `artifacts/pre-release/hud/upgrade-lv{2,3,4,5}-{390,350}.png`
- `artifacts/pre-release/browser/lv1-{390,350,1100}.png`
- `artifacts/pre-release/{movement,evolution,production,audio,supply,grenade}/` capture/JSON evidence

Inspected mobile and desktop images: no A/D/Q on touch, all keycaps on fine-pointer; LV is stronger/condensed, the middle battlefield is unobstructed, primary info remains passive, and lower controls do not collide. Small cartridge outlines, fallback-font differences, thumb comfort and Safari's physical long-press behavior still need device review. Software Chrome/SwiftShader is not physical-phone certification.

## Resource/performance observations

Five three-throw reset cycles record **87→88 geometries** on the first measured cycle, then **88→88 for all four subsequent cycles**, **11 textures** and **16 dust slots** throughout. A strict pre-warm equality check initially failed on this single registration increase; the diagnostic now records warm-up explicitly and requires the flat subsequent plateau. No enemy-death presentation or allocation code changed. The single-charge diagnostic remains **85 geometries / 12 textures**; different active poses/effect states expose different already-existing render batches.

An isolated warmed 200-enemy SwiftShader sample records:

| Diagnostic | Frame mean / p95 / max | App CPU mean / p95 / max | Geometry / textures |
| --- | --- | --- | --- |
| no blast, 33 frames | 121.22 / 133.40 / 133.40 ms | 1.84 / 2.30 / 2.40 ms | 85 / 12 |
| blast, 34 frames | 118.14 / 150.00 / 166.70 ms | 1.81 / 2.30 / 2.30 ms | 85 / 12 |

The software renderer is slow in both samples (~8 FPS). CPU cost and resources stay flat, but blast p95/max are worse despite the lower mean; this small sample cannot rule out transient frame cost. Later reduced population also confounds comparisons. It is a coarse frame/resource check, not physical-phone certification. Full output: `artifacts/pre-release/supply-isolated/browser.json`. No unrelated renderer optimization or gameplay tuning was made to improve these measurements.
