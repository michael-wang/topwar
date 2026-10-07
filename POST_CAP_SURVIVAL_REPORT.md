# Temporary Post-Cap Survival — closed playtest

Baseline verified clean: HEAD / fetched origin/main `898b0f13edfa1ef598f75b1479cd2616913c46cc`. Intended frozen tag: `playtest-2026-10-08`. No deployment.

## Authored behavior and removal

`public/game-data/game.json → catharsis.postCapSurvival` enables the optional layer at level 6. Dedicated files: `src/config/postCapSurvivalConfig.ts` and `src/simulation/postCapSurvival.ts`.

| Value | Authored |
| --- | --- |
| enabled / startLevel | true / 6 |
| ordinaryGroupSize / pressureLaneCount / heavyCount | 3 / 3 / 3; zero Grunts |
| Giant interval / simultaneous cap | 24 simulation seconds / 1 living Giant |
| Supply interval / amount | 30 simulation seconds / +1, clamped at held capacity 3 |

The unchanged one-time 60-person MG release (59 Grunts / one Heavy / three fronts) is admitted first. Activation records that frame's simulation timestamp; subsequent ordinary stream groups use the temporary composition, retaining the existing six-second cadence. The consumed release row means the first following group may be 6–12 seconds later. No existing enemies are converted.

Giant and Supply opportunities use fixed activation-relative slots. Occupied Giant slots, full-inventory Supply slots and slots with an existing crate are skipped, not queued. A surviving Lv5 Giant counts. Spending/defeating later does not trigger catch-up. Supplies reuse the existing lane/depth placement, stay shootable, and grant +1 only on a primary-firearm hit; MG acquisition is explicitly tested. Teaching Supply still fills to three once at Lv3 +8 seconds. Its pending/uncollected encounter takes precedence. Legacy capped snapshots missing its clock get a fresh teaching timer only when the optional layer activates.

Only `startedAtSeconds`, `nextGiantAtSeconds`, `nextGrenadeSupplyAtSeconds` are serialized for the layer. A recurring crate carries `rewardAmount: 1` in the existing plain Grenade Supply data. Filling reserves to three during an existing flight is valid; overlapping throws remain forbidden. First-acquisition time is retained rather than overwritten on each pickup, keeping flight snapshot chronology valid.

**Disable/removal evidence:** setting `postCapSurvival.enabled = false` restores the retained sixty-person capped ordinary groups and stops both recurring schedules; tests cover initial and runtime disable, including stale invalid temporary schedule data. Missing config defaults off; missing state defaults fresh. Removal requires deleting the small config/helper and their group-settings/scheduler/snapshot hooks, with no progression, MG, archetype, Grenade combat or UI redesign. This is explicitly temporary, independent of Lv7/landing assault. GRENADE/EVOLVE/MG isolated DEV reviews disable it; CURVE follows natural continuation. No new review control exists.

Unchanged: Lv1–Lv6 progression/XP costs, first Giant, Heavy/Giant values and XP, MG 18 Hz / speed 60 / range 80 / damage 1, Grenade capacity 3 / damage 9 / radius 4 / .65s / no throw-distance cap, controls, HUD/CSS, art, VFX and audio startup. Post-cap XP still enters normal kill handling and is discarded at Lv6; no score, currency, Lv7 or reinforcement becomes reachable.

## Deterministic evidence

`node scripts/qa/postcap-metrics.mjs` runs seeds 1–10, 17, 42 for **150 post-cap seconds**, plus seed 1 for **360 seconds**, a separate seed-42 recurring-use run for **180 seconds**, and disabled comparisons. Natural progression is used throughout. Enabled/disabled milestone times through Lv6 match exactly for seeds 1/17/42. Detailed JSON includes admissions, fixed slots/skip reasons, Giant deaths, acquisitions, reserve changes, per-throw nominal XP, pressure/hit debt, casualties and failure times.

| Seed | Activation | Post-cap measured | Ordinary groups | Giant opportunities | Supply spawned / skipped full | Acquired +1 | Casualties / failures |
| --- | ---: | ---: | ---: | ---: | --- | ---: | --- |
| 1 | 90.22s | 150s | 24 | 6 | 3 / 2 | 3 | 0 / 0 |
| 17 | 88.33s | 150s | 24 | 6 | 3 / 2 | 3 | 0 / 0 |
| 42 | 89.20s | 150s | 24 | 6 | 2 / 3 | 2 | 0 / 0 |

Every post-cap ordinary admission was exactly **3 Heavy / 0 Grunt / 3 lanes**. Each run kept its release exactly 59+1. All six Giant opportunities spawned in these competent-policy runs; five were defeated by the 150-second endpoint, with the sixth still alive. Maximum living Giant count was one.

Across all 12 seeds: no casualties/failures, no permanent empty battlefield. Brief empty windows remain, longest **2.87s**. Seeds 1/17/42 had total empty time **0.47 / 3.53 / 1.58s** and longest windows **0.45 / 2.25 / 1.38s**. Peak active counts **141 / 140 / 152** include the release and surviving Lv5 crowd; peak Heavies were eight. Peak near-defense count was **zero** (10-unit definition). The normal pilot used **no post-cap Grenades** and eventually filled inventory, so later full slots correctly skipped. **Mixed evidence: the competent deterministic pilot can control this loop comfortably; this is not proof of human difficulty. No numbers were retuned to manufacture pressure.**

The 360-second seed-1 run admitted **59** Heavy-only groups, had **15** Giant opportunities and **12** Supply opportunities (three spawned/acquired, nine skipped full), with no failure or permanent empty state. The separate 180-second seed-42 forced-use policy produced six Supply spawns, five +1 acquisitions/uses before the endpoint (the sixth crate had just spawned), plus one retained-at-cap Grenade throw. It verifies continued replenishment, not a balance claim. Normal kill XP remains capped; some throws kill no enemies because MG can clear the captured area during flight.

## Automated / production / mobile validation

- **848 tests / 129 files passed**; typecheck and production build passed. No tests weakened. Focused cases cover disable, release exemption, all-Heavy cadence, occupied/full/existing skips, no catch-up, surviving Lv5 Giant, MG +1/clamp, reserve-three flight snapshots, pending/active Supply continuation across deadlines, legacy defaults, isolated fixtures and capped XP/future systems.
- Production browser: natural Lv1→Lv6 and **150+ post-cap seconds** at **390×844 and 350×844**, continued through the following +1 Supply cycle; Q and touch, Pause during flight, Retry, movement after Retry and snapshot replay passed. HUD rectangles stayed inside the viewport with no Grenade/weapon/movement/XP overlap. Giant/Heavy HP and the existing level-up/MG presentation remained readable. Normal captures hide only the optional PERF overlay.
- Existing startup/audio and six-case `/topwar/` production sanity passed: versioned JSON/models, current defense config, no errors/404s/unhandled rejections, no production DEV/TUNE menu/fixtures or 4/5/6 shortcuts. Workflow remains manual `workflow_dispatch` only.
- Local ignored artifacts: `artifacts/postcap/metrics.json`, `artifacts/postcap/browser/postcap-sanity.json`, `{390,350}-{release,giant,supply,plus120,recurring-supply}.png`, `artifacts/postcap/production/production-sanity.json`, `artifacts/postcap/audio/audio-start-sanity.json`.

Ten repeated flight/explosion snapshot replays retained **12 textures / 32 projectile capacity / 16 dust instances**. Geometry counts settled at **104–105**. A late one-time 104→105 increase was traced to first GPU rendering of the pre-existing `enemy-frozen-body-batch`; subsequent repeated cycles plateaued, rather than allocating an extra geometry per blast. The final four cycles must have identical counts/pool capacity. Enemy/effect pools remain the existing bounded implementations.

The software-rendered native-RAF release sample measured approximately **63.5ms average / 83.4ms p95** over 79 frames in the initial reviewed run. This is a SwiftShader diagnostic, **not physical-phone certification**. Accelerated functional QA skips redundant GPU draws while retaining app fixed steps, input/audio/HUD and scene updates, then draws captures; it is not used as a frame-time benchmark. Existing Zod PURE-annotation and >500kB bundle warnings remain.

QA harness corrections were required: a fast MG could acquire a crate between one-second samples, so review replays its actual recorded spawn snapshot; lane decisions now use a 200ms deadline from the actual Start tick rather than an absolute modulo that could stall after a delayed first frame; resource warm-up now observes ten cycles and identifies first-render geometry before checking a stable plateau. None required a gameplay/control/art change.

Remaining human question: whether sustained play produces the intended recovery pressure, given the competent pilot's zero near-defense pressure and no need to spend post-cap Grenades. Physical-phone sustained Giant/MG/Supply testing remains outstanding. Earlier playtest tags must remain untouched; publishing is manual only.
