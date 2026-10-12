# P3-B.6B.6 — Naval Rhythm, Warning Urgency & Mobile QA

Baseline: `cbd857ac8f24e12ba69f8c49fd17750bc2b913f6`.

Implementation commits:

- `412c333a980b4021ca6d6360521e09fa65dbb903` — post-impact naval scheduling and warning urgency.
- `d02c9472cf4b3ba98c4bff8f230518250f3611b8` — restricted shipping QA hatch, real high-load sleep fixture and recovery safeguards.

The subsequent report/verification commit adds this report and a partial-cancellation regression. Nothing was deployed. Local and remote `playtest-2026-10-08` remain `59136b49e1328ab754412f7affe90c755c76c0fd`.

## Naval rhythm

The previous 2–3-second launch-based interval was largely consumed by approximately 2.1-second shell flights. In the retained B.5 combat artifacts, 1,254 of 1,256 measured impact-to-next-launch gaps were below one second; the mean was 0.386 seconds. Random launch intervals therefore produced relatively little audible/visible quiet time.

Shipping Stage 1 now opts into:

```json
"postImpactCooldown": {
  "initialDelaySeconds": 2,
  "gapsSeconds": [0, 1, 2, 3]
}
```

The array is validated, bounded and equally weighted. One/two shells remain equally likely; lanes are selected without replacement from all five lanes. MG Evolution/Carnival remains +0, Observer communication +1.3–8.5, barrage enable +8.5, first salvo +10.5, Carnival end +24, Survival handoff +27 and first Survival ordinary admission +28. Persistent naval presence and all AHEAD/weapon/HP/XP/flight/damage settings are unchanged. A JSON comparison against the baseline confirmed this optional cooldown object is the only shipping gameplay-configuration change.

After launching, the scheduler saves actual shell IDs and the final authoritative impact deadline. Final resolution draws one gap using the existing dedicated naval RNG. A zero gap can launch in the tick that processes the final impact; positive gaps count from the actual deadline, rather than the quantized processing tick. Partial cancellation updates the final remaining deadline without drawing; last-shell cancellation resolves at the cancellation clock and draws once. Waiting does not draw or queue opportunities.

Stopping clears pending scheduling; restarting uses the separate initial delay without replaying earlier launches, while existing flights continue to resolve. Capacity/absent-ship opportunities consume one pattern and schedule one configured gap from the attempted opportunity, rather than awaiting a nonexistent impact. Large steps attempt at most one salvo. Game Over disables scheduling. No safety-lane or casualty mitigation was added.

### Actual impact-to-next-launch measurements

The existing cohort harness ran 120 matched instrumented/uninstrumented pairs: seeds 1, 17, 42, 99, 2026; natural and isolated Lv8/9/10; competent, slower and fixed-lane policies; barrage enabled/disabled. Runs stop at Game Over or 180 seconds of Survival. There were 14,691 periodic identical-state checks, identical presentation events and identical final snapshots.

| Authored quiet gap | Observed launches after resolution |
|---|---:|
| 0 seconds | 349 |
| 1 second | 310 |
| 2 seconds | 303 |
| 3 seconds | 259 |

All 1,221 samples were within 15.864ms of their discrete gap (less than one 60Hz tick). Sub-picosecond negative zero values are floating-point noise. The sampled mean was 1.399 seconds. These finite, death-censored runs do not imply different authored probabilities. Separate tests exercise 1,000 resolved salvos per seed and check all four buckets and the one/two-shell distribution. Active Destroyer shells never exceeded two in the combat runs; no overlapping unresolved salvos or capacity skips occurred.

Seed 17's first isolated Lv10 gaps were approximately 0.0004, 2.0159, 0.0159, 2.0159 and 1.0159 seconds. Natural competent runs started their first salvo exactly 10.5 seconds after MG release and Survival/its first wave exactly +27/+28 seconds for every seed.

Pilot losses were retained: competent natural Game Over occurred at 146.983 / 218.483 / not within the observation window / 206.483 / 139.100 seconds for the five seeds. Competent isolated Lv10 losses occurred at 52.717 / 127.350 / 148.717 / 113.317 / 78.100 seconds. Slower isolated Lv10 losses were 80.550 / 98.300 / 111.100 / 69.100 / 93.100 seconds. Fixed-lane isolated Lv10 losses were 29.100 / 29.433 / 29.067 / 16.667 / 30.067 seconds. Fixed natural pilots failed before Survival. No difficulty changes were made in response. Raw cohort, casualty, lane, admission and impact data are under ignored `artifacts/p3b6b6/combat/`; aggregates are `combat-summary.json` and `difficulty-summary.json`.

## Warning urgency

The accepted warning anchors remain mirrored target X ×0.72, world Y 2.05 and locked target Z. The three existing opaque instanced batches and eight-slot bounds are retained. Colors use per-instance data, with one reusable scratch color and fixed deadline/start arrays; no per-shell meshes or textures are introduced.

- Early: terracotta `#b96e57`, navy outline and ivory glyph.
- Middle: interpolate through orange-red `#ef633a`.
- Late: approach danger red `#ff2518`.
- Final 150ms: full danger red and a rapid bounded scale punch (1.05–1.17), never an opacity blink.

Each lane uses its earliest active shell's own launch/impact times. It remains visible until its last shell resolves. Player movement cannot change target anchors. Instance colors are allocated in the constructor, before the existing bounded material-layout shader-preparation traversal; the instancing/color layout is included in that traversal. Unsupported parallel-compile drivers retain the existing non-speculative preparation policy.

Unit/browser checks cover independent deadlines, same-lane coalescing, cancellation, opaque final pulses, mobile bounds, paused/restored warnings and no replayed muzzle flashes. All recorded active-flight frames matched distinct threatened-lane counts and had zero visible ground warning meshes. Six production viewport/level combinations (350/390 × Lv8/9/10) passed two-lane steering, pause, recovery and partial-cancellation checks. The two-threat screenshot centers at 350px were approximately X45/X240, Y519, above the unchanged bottom HUD.

Evidence (ignored local files):

- [350px early](artifacts/p3b6b6/mobile/350-warning-early.png), [middle](artifacts/p3b6b6/mobile/350-warning-middle.png), [final 150ms](artifacts/p3b6b6/mobile/350-warning-final150.png).
- [390px early](artifacts/p3b6b6/mobile/390-warning-early.png), [middle](artifacts/p3b6b6/mobile/390-warning-middle.png), [final 150ms](artifacts/p3b6b6/mobile/390-warning-final150.png).
- [350px complete real flight](artifacts/p3b6b6/lane-warnings/350-warning-lifetime.webm), [390px complete real flight](artifacts/p3b6b6/lane-warnings/390-warning-lifetime.webm).
- Additional real gameplay/audio recordings: `mobile/350-warning-flight.webm` and `mobile/390-warning-flight.webm`. Exact color samples are in `mobile/*-warning-phases.json`; lifetime frames and locked lanes are in `lane-warnings/*-warning-lifetime.json`.

Phase screenshots deliberately sample the renderer at authoritative shell times without changing simulation outcomes. The separate videos use actual fixed-tick combat, movement, impacts and audio. Screencast/video encoding adds load and is not used for the sustained performance comparison.

## Shipping QA hatch and sleep test

Defense's closed hatch is 44×44 CSS pixels, with transparent backing, a thin ivory outline and a translucent inline construction-tool SVG. Its accessible name/title is `開發測試工具`; there is no prominent DEV text. Safe-area anchors are retained. Local DEV still contains its full tuning/audio functionality, LATE/CRATE3/CRATE8/NAVAL, MG TEST, SURVIVAL TEST, NAVAL BARRAGE, readable FPS and Wake Lock status. Twelve local naval-review combinations passed touch targets, Retry and recovery.

Shipping uses a separate limited `QaPanel`: actual Wake Lock status, checkpoint presence, navigation/discard indicators, sleep test, confirmed checkpoint/reload test, explicit test exit and panel close. Replacing a run requires an explicit confirmation; Cancel preserves the exact run and saved checkpoint. Actions are captured once. There are no sliders, internal preset selectors, arbitrary execution endpoints or unrestricted DEV fixture imports in the shipping JavaScript. Existing optional `?perf=1` remains intact.

The sleep fixture uses seed 42, the shipping Lv10 three-MG loadout and exact shipping AHEAD/ordinary combat. It does not create a fake crowd or fake shots. A bounded adjacent-lane pilot advances real 60Hz ticks in batches, consumes preparation-only presentation events, and freezes once at least 100 enemies, 20 projectiles and an incoming shell are present. The maximum preparation is 3,600 ticks. The reproducible prepared frame occurs at tick 2,232 / 37.2 simulation seconds, with three living soldiers, 104 enemies (41 Heavies), 43 projectiles and one shell.

Real visible frames render/upload those batches before a full checkpoint is written. Simulation then remains paused while the normal 3D scene remains rendered. Screen Wake Lock acquisition is suppressed; owned pending grants/releases are awaited. The sleep instruction is shown only after owned-sentinel cleanup is confirmed. A four-second unresolved-release timeout reports uncertainty and leaves the game paused/suppressed. Denial, unsupported API and insecure-origin cases are harmless and remain visibly distinguishable.

The checkpoint envelope remains version 1 with optional strict metadata `{version:1, kind:"sleep-lv10", armed:true}`. It requires Defense, seed 42, Lv10, active Survival, no DEV fixture name and the complete existing strict Simulation validation. The prepared checkpoint was 36,299 UTF-8 bytes (also 36,299 characters); one unthrottled measured full save took 0.2ms at both widths. This is not a mobile-storage latency guarantee. Corrupt/version/kind/fixture/state mismatches are rejected, not relaxed.

On same-page return the test reports that no reload occurred and stays paused. Freeze/resume and BFCache/page transitions are identified separately. Actual WebGL extension loss/restoration was tested separately from simulated document lifecycle events. Reload/Continue restores an identical authoritative state, including partial enemy damage, projectiles, shells, RNG and Giant/Supply clocks, with no launch/reward/dialogue replay and no new Wake Lock acquisition. Explicit test exit clears test metadata, keeps the scene paused and returns ordinary Resume/Wake Lock behavior. Retry clears the saved run. A new browser load still uses the existing immediate pre-asset recovery decision.

Browser lifecycle tests use controlled events and controllable Wake Lock sentinels. They do **not** certify an Android timeout, real battery revocation, browser-process kill or tab discard.

Screenshots: [350px hatch](artifacts/p3b6b6/mobile/350-hatch.png), [shipping panel](artifacts/p3b6b6/mobile/350-sleep-panel.png), [prepared scene](artifacts/p3b6b6/mobile/350-sleep-scene.png), [restored](artifacts/p3b6b6/mobile/350-restored.png); matching 390px files are alongside them. Mock denial/unsupported/insecure results and state/resource evidence are in `mobile/results.json`.

### Pixel 8 procedure

1. After a **manual** release update, open the usual GitHub Pages HTTPS `/topwar/` origin. Old checkpoints retain their saved naval policy; choose New Game or explicitly confirm the new sleep fixture to evaluate this rhythm. Continue intentionally does not migrate an old game to new scheduling.
2. Configure Android's screen timeout to 15 seconds. Start gameplay and inspect Wake Lock status through the small hatch.
3. Select `15 秒熄屏 / Resume 測試`, read the replacement warning and confirm. Wait for preparation, AVAILABLE checkpoint and the actual RELEASED status (or an explicit unsupported/denied outcome).
4. When instructed, stop touching the phone. Let Android decide whether/when to sleep. The page cannot force a 15-second timeout or Chrome discard; avoid touching the screen merely to measure the countdown.
5. Wake the phone. A surviving page reports same-page return. A reloaded page offers Continue/New Game; Continue restores the saved paused stress scene. Inspect navigation/discard/context evidence without inferring a process kill from a reload alone.
6. Choose `結束測試（保持暫停）`, then Resume to continue ordinary gameplay and reacquire supported Wake Lock. The confirmed reload test can separately exercise deterministic checkpoint recovery, but is explicitly a reload, not a forced discard.

For local USB development, the existing safe ADB reverse/localhost procedure in `P3B6B3B_REPORT.md` remains applicable. Plain HTTP LAN IPs are normally insecure and cannot grant Screen Wake Lock. Browser storage belongs to the origin; LAN, localhost and GitHub Pages checkpoints do not automatically transfer.

## Performance and resources

Chrome, DPR1, SwiftShader, 4× CPU throttle, same seed-42 adjacent 200ms pilot without Grenades; independent fresh renderer contexts. Warmed runs lasted 90 simulation seconds and retained three soldiers. B.5 rows are retained earlier measurements with the same profile, not simultaneous A/B samples. The new rhythm changes salvo patterns and surviving crowds, so this comparison cannot isolate warning-color cost.

| Width / window | B.5 mean / p95 / max ms | B.6 mean / p95 / max ms | B.6 >100 / >200ms |
|---|---|---|---:|
| 350 / warm 90s | 74.68 / 116.70 / 283.30 | 75.56 / 116.70 / 300.10 | 197 / 3 |
| 390 / warm 90s | 75.18 / 116.70 / 283.30 | 75.31 / 116.70 / 283.30 | 206 / 2 |
| 350 / fresh 10s | 37.80 / 50.10 / 233.30 | 43.97 / 83.30 / 350.00 | 8 / 2 |
| 390 / fresh 10s | 37.78 / 50.10 / 266.60 | 44.32 / 83.40 / 366.60 | 8 / 2 |

Warm means changed by +1.18%/+0.18%. Fresh isolated-entry means were about 16–17% worse and maxima increased; this is a remaining software-rendering risk, not hidden by the warm results. These direct entries fire sooner than the natural +10.5-second opening, and B.6's first ten seconds had two airborne shells versus B.5's one and different crowd outcomes. First-use/pool/driver work remains visible. Direct compile/link calls did not exceed 10ms in the warm traces, but that does not exclude driver completion or GPU stalls; precise attribution of the long frames is unresolved. No art, resolution, enemy density or effects were reduced.

Warm peaks: 173 enemies, 107 projectiles, two shells, projectile pool 128. Sampled draw-call/triangle peaks were 306 / 515,773 at 350 and 307 / 515,787 at 390. Geometry/texture counts plateaued at 115/12 from approximately 40 seconds through the end of both runs. Artillery remains eight slots, warning instances eight per batch, and warnings still cost three batches with no textures.

The frozen sleep fixture's 10-second 4×CPU samples averaged 70.33/70.72ms (p95/max 83.4ms), with no >100/200ms frames. It rendered 247 calls / 319,359 triangles. Prepared geometry/textures remained 95/12 at 350 and 92/11 at 390 through the sample; transient effects/preparation explain differences between contexts. Fresh checkpoint restoration used 76/9 with the same authoritative state and no historical transient cues. This tests a realistic held resource footprint, not resource exhaustion. Raw samples are in `performance/` and `mobile/results.json`.

Production JS: baseline 1,176,850 bytes / gzip 322,343; implementation build 1,192,166 / gzip 326,758. Total feature delta is **15,316 raw bytes / 4,415 gzip bytes** (+1.30%/+1.37%); this includes scheduling, warnings and QA, not a separately isolated QA-only compression estimate. CSS is 32,951 bytes / gzip 7,428. No new downloaded asset files, dependencies or textures were added. Approved models/recordings and content-addressed `/topwar/` asset paths remain unchanged. Local navigation-to-start samples were 1.47–1.60 seconds; no claim of faster phone downloads is made.

## Verification and remaining phone risks

- `npm test`: **1,251 tests / 168 files passed**.
- `npm run typecheck`: passed.
- `npm run build`: passed; existing large-chunk advisory remains.
- Shipping production sanity: approved configuration/recording bytes, correct asset digests/base path, no unrestricted DEV UI/factories/global QA hooks; passed at both mobile widths.
- Production normal/Legacy Pause → reload → identical paused restore and deterministic continuation, then Retry clearing: passed at both widths.
- Shipping sleep QA: confirmed replacement/Cancel, immutable paused state, key/touch resume suppression, actual WebGL loss/restoration, controlled hidden/freeze/page transitions, identical reload recovery, explicit exit/reacquisition and mock unavailable/denied/insecure behavior: passed.
- Deferred Wake Lock cleanup and multiple lifecycle races: unit tests passed, including test-mode release while a grant is still pending.
- Per-lane full warning lifetime, lane steering, two-shell recovery/cancellation, no ground markers and real audio/video: passed at Lv8/9/10 and both widths.
- Local full DEV and gesture-owned audio checks: passed, including existing native audio recording and unchanged retained naval controls.
- Historical launch-based intervals, overlapping policies, scripted five-shot/timed-retreat, sequential/concurrent encounter saves, eight/ten-level snapshots and strict clock/event checks: full regression suite passed. `pre-b6b6-game.json` preserves B.5's authored scheduler as an explicit historical test control; current shipping behavior has separate tests.

Physical Pixel 8 verification remains required for the perceived quiet rhythm, terracotta/final-pulse readability, actual HTTPS Wake Lock grant/release, Android timeout and naturally occurring Chrome discard. Desktop emulation cannot certify any of these platform outcomes. Fresh software-rendering stalls and release denials/timeouts remain explicitly reported risks. No deploy, frozen-tag update, boss/art work or difficulty tuning was performed.
