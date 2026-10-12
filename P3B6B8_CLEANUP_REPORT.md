# P3-B.6B.8 — Legacy retirement and repository cleanup

## Starting point and delivery

Started only after B7 was completed, committed, pushed and reported. Fetched origin/main, verified a clean working tree and started at **cbccb8c8a3cef762ba4e6aa8813d94ea93ca13d0** (B7 implementation: 3ef95bcf72ec8f4c26f97e1352dd14320e42d0ac). No concurrent task changed this checkout.

Implementation commits:

| Commit | Responsibility | Validation |
|---|---|---|
| 172bd31068cd632569c7b92f2f9917b5f20006b7 | Retire bridge/Tier/Boss/Gates/Rocket/Landing runtime and exclusive presentation/tests | 1052 tests, typecheck, build; original full state/event traces identical |
| ffa68d19220c88f61527376f91619474db0b90eb | Simplify Defense contracts, formulas, render state and tuning | 1048 tests, typecheck, build; combat traces identical |
| f8d11038f9d5bb2fe9aee0ec42cd6bc1b577e300 | Consolidate QA, remove unused assets, atlas/finite-formation/ambient legacy paths | 1032 tests, typecheck, build and mobile browser regressions |
| f7ffbd52750c86c66df8c8853856b4feae142046 | Verify the actual currently published checkpoint generation as well as B7 | Three exact released-checkpoint tests; complete suite 1033 tests |
| a9b4b343f058fd132f29f57e54ef6c747c4f36b4 | Remove hidden blue bridge corridor allocations and unused DEV anchors/comparison branches | 57 focused tests, typecheck, full 1032-test suite, build, mobile production and six Golden Grenade scenarios |

Documentation and the complete machine-readable audit are delivered in the following documentation commit. Its delivery SHA is reported with the final response rather than self-referencing a commit from inside its own file.

No deployment was dispatched. The manual workflow is unchanged. Frozen playtest-2026-10-08 remains **59136b49e1328ab754412f7affe90c755c76c0fd**.

## Measured inventory

The complete original and final file inventories, all 1296 original test-case classifications/actions, all current cases, QA files, public assets and document actions are in [docs/cleanup-inventory.json](docs/cleanup-inventory.json). Source LOC counts text lines under src, including DEV modules and CSS, with the same inventory tool before/after; they are not a count of minified shipping code. Test counts come from Vitest assertion results, including parameterized cases.

| Measure | B7 baseline | Cleaned implementation | Change |
|---|---:|---:|---:|
| Source files | 201 | 176 | −25 |
| Source LOC | 19046 | 15061 | −3985 (20.9%) |
| Test files | 170 | 143 | −27 net |
| Test cases | 1296 | 1032 | −264 net |
| QA files, including README/helpers | 113 | 29 | −84 |
| Checked-in test fixture files | 8 | 10 | +2 net, including exact released-save replay and accepted ambient sequence |
| Public files | 21 | 7 | −14 |
| Public bytes | 635090 | 274811 | −360279 |
| Art-showcase tree/export bytes | 936877 | 0 | −936877 |
| Production JS bytes | 1193420 | 1018121 | −175299 (14.7%) |
| Production JS gzip bytes | 327005 | 279559 | −47446 (14.5%) |
| Production CSS bytes | 33019 | 31480 | −1539 |
| Production CSS gzip bytes | 7456 | 7169 | −287 |

Before deletion, npm test passed all 1296 tests, npm run typecheck passed, and npm run build passed. Baseline Vitest elapsed time was 17.690s (npm wall time 18.357s). Three isolated final runs pass all 1032 tests in 16.789 / 16.947 / 16.931s; the last two npm wall times are 17.804 / 17.645s. Final median is 16.931s, 0.759s below the single measured baseline.

Timing is evidence, not a target test count. Earlier isolated cleanup runs ranged from 22.379–23.074s despite fewer cases; the latest final run was 16.789s. Long retained deterministic Survival tests dominate and machine scheduling varies. This cleanup does not claim a reliable proportional test-runtime speedup. Assertions and simulation durations were not shortened to obtain a number.

An independent matched CPU benchmark replays the same 18159 seed-42 inputs through original B7 and cleaned engines without per-tick snapshot hashing. Four original runs took 784.84 / 593.33 / 499.20 / 477.41ms; cleaned runs took 688.48 / 521.21 / 457.97 / 425.67ms. All produce final hash a2fe40a9a67adb695e48efd302a136fd3d8e55f30155743fa7ef0a3117ea0542. This is Simulation CPU work, not browser rendering or phone FPS.

## Runtime retirement and retained responsibilities

Removed the actual original gameplay engine, not just its tests: forward movement, infinite Tier merge/power, Tier-N enemies, formula Boss spawning/melee/showdown, Rocket weapons, upgrade Gates/recruitment pickups, stream rewards, deferred reinforcement and Landing Assault. Simulation is now Defense-only and rejects unsupported non-Defense runs safely. Retired modules include tierRules/exactValue/rifleHitRadius/streamRow/enemyFormation/streamRewards/landingAssault; BossRenderer/CameraFraming/Footwear/DeathTiming; UpgradeGateRenderer/UpgradePickupRenderer/StreamRewardRenderer; ReinforcementArrival; TierHud/ControlHint/ThreatReview and three obsolete analog steering implementations. Old Boss/Rocket/reward audio, Boss music harmonies, renderer branches, Tier colors/scaling, Rocket squad effects and the unrestricted old runtime balance API are removed.

Current shared functions remain focused on their active uses: physical squad composition/casualty handling, fixed steps, seeded RNG, single-hit projectile collision/index parity, lane generation, authored progression, strict configuration, pooled character rendering and current damage feedback. The collision loop has no unused piercing cursor; released projectile state still strictly permits only the inert zero penetration field.

BridgeEnvironment is retained because it renders the accepted coastal game. Its unused bridge deck/rails/ocean/Boss scenery/burning bases/warship paths are removed. AttackLaneRenderer retains the exact coastal sand scuffs but no longer allocates hidden blue bridge planes. Accepted offshore transport positions/bobbing remain, while Landing input is removed. Current aircraft/flak/distant artillery are preserved. Removing an unused ambient ship actor deliberately retains its three entropy draws and timing cadence so accepted aircraft/flak motion remains identical; a golden released sequence verifies this invariant.

CharacterAssets now prepares only accepted procedural Blue Squad/Grunt/Heavy/Giant families. No GLTF loader or obsolete atlas bake pipeline remains. Ink Spear stays the exact permanent two-batch presentation; current character materials, Heavy HP bars, motion, casualties, VFX and disposal remain covered. Tuning retains current Defense controls only. Local DEV groups and restricted shipping QA keep their existing behavior.

## Complete test audit

Every original assertion has an explicit classification and action in the inventory; no UNCERTAIN cases remain. Classification totals describe original cases, not merely deleted cases:

| Classification | Original cases |
|---|---:|
| ACTIVE | 878 |
| SHARED ENGINE | 108 |
| SAVE COMPATIBILITY | 47 |
| HISTORICAL | 249 |
| OBSOLETE IMPLEMENTATION DETAIL | 13 |
| DUPLICATE | 1 |

The remaining 1032 cases are 879 ACTIVE, 101 SHARED ENGINE and 52 SAVE COMPATIBILITY. Some active/shared assertions were consolidated or rewritten around current observable contracts, and new exact save/ambient regressions were added; totals are therefore not simple subtraction by classification.

Removed exclusive files: infiniteSimulation, infiniteTiers, bossShowdown, UpgradeGates, LandingAssault, Reinforcement, StreamRewardRenderer, UpgradeGateRenderer, UpgradePickupRenderer, TierHud, BossCameraFraming, BridgeEnvironment, CatharsisLoop, CharacterAssetBake/Manifest, ControlHint, KeyboardSteeringInput, PointerDragInput, TouchSteeringInput, ProjectilePresentation, RewardLaneAlignment, RifleFireCorridor, ThreatReview, artShowcase, enemyFormation, longRunDiagnostic, ReviewFixtureMigration and survivalPressureDiagnosis. P15Pilot was migrated to DefensePilot, not discarded.

Mixed GameApp, PresentationMotionAudio, LevelDefinition, Progression, StationaryDefense and rendering/audio tests were reviewed individually. Retired Tier/Boss/reward/analog assertions were removed or replaced; meaningful current controls, progression/casualties, fatal artillery feedback, strict validation, collision, rendering and lifecycle assertions remain. Current long seeded Survival/Carnival/naval tests were not replaced by a superficial smoke test. Obsolete fixture hashes now give way to authored loadout/clock/Retry assertions and complete B7 deterministic traces.

## QA, fixtures, assets and documents

QA shrank from 113 files to 29. Historical P15/P2/P3 experiment wrappers, projectile comparisons, old audio/art investigations and redundant difficulty/performance collectors are removed. Active P15 movement/threat/Grenade policy was extracted to DefensePilot; the historical weapon comparison helper now lives under tests/helpers/WeaponComparison. One production-app-hook helper replaces repeated response interception in browser tools. No private app hook ships in production.

Retained reusable tools are documented in scripts/qa/README.md: shipping sanity/recovery, delayed recovery, Wake Lock/origin tests, mobile MG and Survival controls, crate/Golden Grenade/inventory checks, lane warning/sleep QA, artillery and HP-bar performance, deterministic full-state replay, cohort diagnostics and inventory/recording helpers. Current observation hooks stay QA-only; 12 competent/slower/fixed-lane natural/Lv10 runs with barrage on/off also verified instrumented/plain state and event parity.

Deleted all 13 unused GLBs and their manifest (360177 bytes), the unused bake/export script, showcase runtime/HTML/docs and 24 showcase JPEGs. Current production and DEV renderers were checked before deletion: accepted characters and weapons are procedural, while the leftover bullet GLB was downloaded but never used by the accepted Ink Spear renderer. Its 1720-byte startup request is gone. Current startup fetches the authored config/level plus the unchanged two Observer portraits and two recordings when prepared. All remaining asset URLs use content hashes and /topwar/ paths. Config/level hashes change only because inert retired metadata was removed; portrait/audio hashes and contents remain unchanged. No missing asset or replacement art was introduced.

Removed 33 historical root documents, including phase reports and superseded visual contracts; models/showcase READMEs were removed with their trees. Git history is the archive. README, GAME_SPEC, ARCHITECTURE, ROADMAP, Pixel testing, QA instructions and current ART_DIRECTION now describe Lv1–10, AHEAD, independent naval components, continuous quiet gaps, accumulated Grenades and recovery. ROADMAP has exactly one NOW and three NEXT items. This cleanup report and the machine-readable audit are current review evidence.

## Released-save support boundary

Read-only live GitHub Pages inspection on 2026-10-12 found index-CW7QC6uI.js with build marker cbd857a, matching the successful manual B6B5 deployment. B7 is completed on main but was not deployed by this cleanup. The deployment history and observed live marker are recorded under artifacts/p3b6b8/deployments.json and live-build.json.

Both exact formats are protected by checked-in released-pages-checkpoint.json and released-b7-checkpoint.json. Tests restore their original authoritative state and configuration, queue no one-shot presentation events, then replay 600 recorded inputs and compare the final state against the original engine's SHA. All three released-checkpoint cases pass. Focused eight-/ten-level Defense, sequential/concurrent encounter, historical timed retreat, launch-based/discrete/continuous scheduling and current inventory tests remain.

Small inert compatibility fields remain strictly validated: empty Boss/gate/reward/pickup state, Tier-1 physical roster, zero Rocket clocks, inactive landing/reinforcement and old stream cursors. Optional old config/tuning metadata is retained only to parse real Defense saves; it does not execute retired gameplay. Historical capacity:3 is a teaching-reward alias and never clamps a continuing Grenade inventory. Future Supply accumulation remains B7 behavior.

Ancient non-Defense bridge/Tier-N/Rocket/Boss/Gate/finite-formation saves are explicitly unsupported. They produce safe New Game recovery, not a crash or silent reinterpretation. No complete Legacy engine is retained for those prototypes. Normal deployed Defense checkpoints, AHEAD/MG10 state, enemies, shells, RNG, Grenade inventory and deadlines remain recoverable.

## Deterministic gameplay comparison

Original B7 source was read from Git, without overwriting the working tree. Compared all events, inputs, RNG and authoritative combat state for seeds 1/17/42/99/2026 in natural and isolated Lv8/9/10 runs: **20 traces, 218918 ticks, all identical**. Original full serialized state matched during the first retirement. Final comparisons normalize only five inert authored metadata keys removed from configuration: landingAssault (configuration only), memberDepthSpacing, depthJitter, groupRowStride and rewardAimRadius. These keys did not affect accepted Defense simulation; live wire state is not excluded. Hashes and milestone evidence are in normalized-traces/compare-summary.json.

Natural pilot milestones, identical before/after, in simulation seconds:

| Seed | Lv6 | Survival | Lv8 | Lv9 | Lv10 | End |
|---|---:|---:|---:|---:|---:|---|
| 1 | 94.92 | 121.92 | 132.65 | 160.85 | 174.78 | Game Over 263.53 |
| 17 | 94.18 | 121.18 | 129.30 | 159.48 | 169.12 | Game Over 269.73 |
| 42 | 95.65 | 122.65 | 127.65 | 150.30 | 163.38 | 3 soldiers after 180 Survival seconds |
| 99 | 94.27 | 121.27 | 130.45 | 155.30 | 166.35 | 3 soldiers after 180 Survival seconds |
| 2026 | 93.43 | 120.43 | 124.40 | 155.00 | 163.57 | Game Over 243.77 |

Deaths are ordinary accepted combat outcomes and were not used to tune balance. MG rates, AHEAD profiles, Giant/Heavy ramp, Carnival, naval clocks/damage, Grenade rewards/throws, RNG and current art are unchanged.

## Mobile/browser and resource verification

Chrome/SwiftShader automation passed at both 350×844 and 390×844:

- Shipping Tap-to-Start, current production AHEAD policy, content-hash URLs, Observer preparation and no missing requests/console errors; no unrestricted DEV controls or private QA hook in the bundle.
- Production Pause/reload/Continue with identical state and deterministic continuation; Retry clears stale progress. Delayed-config recovery choices precede assets and block controls.
- Real Grenade teaching/repeating awards above three, exact HUD counts through MAX_SAFE_INTEGER, constant DOM/GPU resource usage, overflow handling, Q/button launch, explosion and in-flight restoration without duplicate cues. Six normal/dense Golden Grenade scenarios pass.
- LATE/CRATE3/CRATE8/NAVAL retained; MG6–10 authored rates/Retry; all four Survival comparison modes; partially damaged crate recovery/transfer/alignment.
- Wake Lock grant/denial/unavailable/deferred races, lifecycle pause, same-page return, checkpoint restore and actual WebGL loss/restoration.
- Restricted shipping sleep fixture confirmation, prepared bounded scene, full checkpoint, actual sentinel release and paused restoration. Simulation cannot advance while waiting for sleep.

Matched rendering uses the exact same frozen authoritative Lv10 scene: 112 enemies (45 Heavies), 48 projectiles, two shells and three MG soldiers. DPR1, CPU4×, separate renderer contexts, fresh four seconds then three warmed six-second samples. This isolates rendering rather than changing pilot outcomes.

| Width / engine | Fresh mean / p95 / max ms | Three warmed means ms | Warmed p95 ms | Warmed maximum ms | >100 / >200ms frames, all samples |
|---|---|---|---|---|---|
| 350 B7 | 82.31 / 83.40 / 233.40 | 80.45 / 78.58 / 78.57 | 83.40 | 183.40 | 2 / 1 |
| 350 cleaned | 79.41 / 83.40 / 166.60 | 80.45 / 78.36 / 78.36 | 83.40 | 183.30 | 3 / 0 |
| 390 B7 | 80.00 / 83.40 / 183.30 | 79.17 / 78.57 / 78.95 | 83.40 | 150.00 | 3 / 0 |
| 390 cleaned | 79.41 / 83.40 / 183.30 | 79.39 / 79.39 / 77.92 | 83.40 | 149.90 | 3 / 0 |

Both engines issue 296 draw calls / 344146 triangles in the matched scene, with 81 uploaded geometries and 10 textures, stable over all warm samples. Drawn quality and capacity are unchanged; removed hidden allocations do not reduce actual visible triangles. Projectile pool is 64 for 48 live shots, warnings/shells remain bounded at eight. Legacy empty helmet buckets, Boss/reward shadow branches and hidden ship/smoke structures disappear from CPU-side resources. Frame times are essentially unchanged within software-renderer variance. The older repeated benchmark also had an occasional >200ms cleaned warm frame; the final sample's absence is not a guarantee against stalls.

The final shipping sleep fixture separately measures a 38319-byte checkpoint written in 0.2/0.2ms at the two widths. Its prepared scene has 294 draw calls, 344142 triangles, 97/94 uploaded geometries and 13/12 textures; geometry/texture/pool counts plateau during paused rendering. Transient presentation preparation accounts for resource-count variation across fresh contexts. Pause/recovery reconstructs warnings from saved shells without replaying sounds or launch events. Recording increases load and is not mixed into the matched benchmark.

Evidence is ignored, under artifacts/p3b6b8/: baseline/final production screenshots, matched-render before/after captures and JSON, final-sleep warning early/middle/final/pulse screenshots and full-flight WebM recordings, Golden Grenade launch frames, inventory/MG/Survival/save/Wake results, exact traces and CPU metrics. Reusable commands are tracked in scripts/qa/README.md. No artifacts are imported by production.

## Remaining risks and decisions

This is retirement and contract simplification, not a gameplay or art change. No known retired engine path needs restoration. The intentionally retained compatibility aliases/inert wire fields may be removed only after a separate explicit decision to end support for released Defense checkpoints. Temporary comparison tools still have a demonstrated physical-review purpose; removing them needs a product decision rather than this cleanup guessing.

Desktop SwiftShader is not Pixel 8 GPU evidence. Occasional long frames remain in software rendering; no art, HP bars, resolution or difficulty was reduced. Physical screen timeout, process recreation and real tab discard cannot be certified by browser mocks. Continue physical Pixel 8 testing using the current restricted shipping QA flow when the user manually deploys. No automatic deployment, frozen-tag mutation or next gameplay phase is part of this task.
