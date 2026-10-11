# P3-B.6B.3C — Instant recovery choice and Golden Grenade feedback

Baseline: `ea6994470b6c8d6ab8e0eb6e9739362ddd17e047`. Implementation commit: `067aad691ae1f739cd96fc0ca6d8ced853e75e9f`. This report follows in a separate documentation commit so the measured implementation can be identified exactly.

## Recovery ordering

The B3B HTML cover blocked interaction early, but the choice was constructed inside `GameApp`, after configuration, models and renderer initialization. The delay was initialization ordering, not evidence of a new download or Android/WebGL fault.

`main.ts` now reads and strictly validates the checkpoint before its first asynchronous data load. Validation uses the saved configuration and existing `Simulation.restoreState` contract; it does not need a renderer, images or audio. A valid checkpoint immediately offers **繼續上次遊戲 / 重新開始**. Invalid/corrupt checkpoints offer only **重新開始**. Validation cannot precede downloading/executing the page's JavaScript, but does precede configuration/model requests.

The same dialog captures one decision while one set of assets initializes. Continue changes the cover to **正在恢復遊戲…**; New Game deliberately clears storage at the gesture and changes it to **正在開始遊戲…**. There is no `GameApp`, simulation loop, input controller or gameplay control behind the pending decision. The viewport remains inert and the dialog guards repeated taps, keys and held pointers until initialization is complete plus the existing 350ms quiet-input interval. Only one app and renderer are created.

Continue restores the full authoritative state, selected DEV fixture/configuration and saved clocks. It remains paused, skips Mission Intro and old acquisition/level-up/throw effects, and resets frame timing. Continue does not try to activate an as-yet unavailable AudioContext; the later real Resume gesture activates audio and reacquires the existing Wake Lock. A same-page visibility return still uses the existing paused app and never creates a new recovery dialog. A current default-mode mismatch found after config loading offers a safe fresh-start path rather than restoring into an incompatible mode.

## Recovery measurements

Three reloads per size/revision, same local Chrome/SwiftShader setup and saved dense AHEAD Lv10 state. QA delays config by 1500ms and GLB delivery by 2200ms; the saved-config validator runs independently. Values are median [min–max], milliseconds from navigation unless specified. See ignored `artifacts/p3b6b3c/recovery-before/results.json` and `recovery-after/results.json`.

| Width | Metric | B3B baseline | Final |
|---|---|---:|---:|
| 350 | First blocking surface paint proxy | 216 [40–808] | 192 [32–240] |
| 350 | Choice available | 4337 [4234–4970] | **332 [184–361]** |
| 350 | Strict validation duration | 1.8–3.1 | 3.8–5.9 |
| 350 | GLB/character assets ready | 4071 [3975–4696] | 4096 [3949–4127] |
| 350 | Continue gesture → observed paused battlefield | 829 [825–840] | 4412 [4393–4430] |
| 390 | First blocking surface paint proxy | 224 [44–828] | 176 [48–240] |
| 390 | Choice available | 4377 [4201–4970] | **311 [184–365]** |
| 390 | Strict validation duration | 1.8–2.8 | 3.2–5.0 |
| 390 | GLB/character assets ready | 4107 [3940–4715] | 4080 [3951–4130] |
| 390 | Continue gesture → observed paused battlefield | 825 [371–827] | 4421 [4407–4432] |

The first-paint proxy is FCP with the existing opaque HTML checkpoint cover, not a GPU screenshot timestamp. Choice availability is observed DOM availability, and strict validation is measured around `readCheckpoint`. Assets-ready is the character loader resolution, before renderer construction; portrait/audio preparation proceeds concurrently. Paused-battlefield completion is sampled after the cover detaches and a paused render is submitted, not exact physical display time. Automated tapping/screenshots and the 350ms guard contribute to the last metric. Navigation → observed restored battlefield medians were 6126→4819ms (350) and 6039→4799ms (390).

The remaining asset wait moves **after** the choice; it has not become a faster download. Every current choice was available before assets and before any app existed. Exact restored state, one GLB request and one canvas were asserted on all six current reloads. Cold module execution, storage size and network delivery of the app itself can still affect how quickly the choice appears.

## Successful throw feedback

The only gameplay-system addition is a transient `grenadeThrown` event immediately after Simulation consumes one inventory item and creates `grenade.flight`. It is not saved and does not change authoritative state, input, RNG, trajectories, damage, XP, schedules or configuration. Restoring a snapshot clears transient events as before. Empty inventory, invalid targets and an existing flight produce no event.

`GameApp` consumes that event once:

- A 235ms procedural launch cue combines a 55ms descending mechanical snap, 100ms low release tone and delayed rising golden shimmer. It creates no downloaded asset or lazy buffer. Existing acquisition and explosion sounds remain unchanged.
- Existing weapon audio alone is reduced to 25% for 160ms and returns by 260ms. Observer/warning buses are untouched; launch cue volume is reduced to 65% while radio communication is active. Audio gesture restrictions and Pause/Retry source cancellation remain unchanged.
- The HUD inventory decrements from simulation state, then displays a 420ms gold/orange backing, outward ivory/gold ring and compact **已投出** label. It is distinct from the existing acquisition/transfer pulse, remains visible when the last grenade is consumed, freezes with presentation time on Pause and clears on Retry/restore.
- The original Golden Grenade geometry/palette is retained, displayed at 1.75× its former size with mild amber emission. A short tapered gold/orange tail follows its existing analytic arc behind the shot. Neither model nor tail moves the authoritative anchor or blast. No fullscreen flash or lane-covering text is added.

The final tail is one reusable 56-vertex / 96-triangle mesh sharing the existing orange basic material/program. Seven fixed rings and reused vectors update one fixed buffer; there are no per-frame allocations, accumulating segments, new textures or network requests. It is included in existing bounded, post-start presentation preparation and is disposed with its geometry. An initial instanced-tail experiment added a shader variant, so it was replaced before delivery with this shared-program mesh. Retained `initial-instanced-*` artifacts are development comparisons, not the final result.

## Performance

### Dense rendering comparison

`golden-grenade-performance.mjs` reconstructs baseline runtime files from Git in a private QA server. Identical authoritative states are asserted before measuring each current scene. A real AHEAD Lv10 fixture is advanced with actual 81Hz simulation fire to 171 enemies (81 Heavies), 100 live projectiles and three soldiers; the flight comparison uses a real throw at tick 972, 170 enemies/80 Heavies and 84 projectiles. Simulation is then frozen only in the QA browser to isolate rendering, not to represent sustained combat. Both revisions use DPR1, CPU4×, SwiftShader, separate contexts, 60 warm RAFs and three five-second blocks. Recording is separate. Existing idle preparation is cancelled equally to isolate the visible flight.

| Width / scene | Mean frame ms, baseline→final | Block p95 ms, baseline→final | Maximum ms, baseline→final |
|---|---:|---:|---:|
| 350 idle | 115.48→118.97 (+3.0%) | 116.8→133.3–133.4 | 133.3→166.7 |
| 350 flight | 110.90→113.83 (+2.6%) | 116.7→116.7–116.8 | 116.8→116.8 |
| 390 idle | 114.72→115.23 (+0.4%) | 116.7–116.8→116.7–116.8 | 133.3→133.4 |
| 390 flight | 111.59→111.15 (−0.4%) | 116.7–116.8→116.8 | 133.3→166.7 |

No >200ms frame occurred across these 24 blocks. Many frames exceed 100ms in **both** revisions: this intentionally dense software-rendering workload is slow. Idle draw calls/triangles/resources are identical: 301–303 calls, 518614–518792 triangles, 66 uploaded geometries, 9 textures. Flight adds exactly **one call / 96 triangles / one uploaded geometry**: 304–306→305–307 calls, 515544–515722→515640–515818 triangles, 68→69 geometries; textures stay at 9. Three repeated blocks plateau with body pools 8×32, Grunt/Heavy tier pools 128 and projectile pool 128. The extra flight geometry is bounded and disposed. Native Wake Lock remained active in both revisions.

### Live first throw / blast windows

Separate unthrottled real-combat checks include a first throw and impact, live simulation, actual sound and a screenshot in both revisions; no recording runs in this comparison. One window per size/profile is diagnostic evidence with host/automation variance, not a statistically established frame-time improvement.

| Width / profile | Mean / p95 / max ms, baseline | Mean / p95 / max ms, final | >200ms frames baseline→final |
|---|---:|---:|---:|
| 350 Rifle/CRATE3 | 36.3 / 133.3 / 166.6 | 52.7 / 166.6 / 166.7 | 0→0 |
| 350 AHEAD Lv8 | 39.6 / 100.0 / 150.1 | 52.8 / 150.0 / 166.6 | 0→0 |
| 350 AHEAD Lv10 | 138.2 / 500.1 / 500.1 | 152.2 / 516.8 / 516.8 | 3→3 |
| 390 Rifle/CRATE3 | 45.2 / 150.0 / 200.1 | 45.6 / 133.3 / 166.6 | 1→0 |
| 390 AHEAD Lv8 | 60.7 / 166.7 / 183.4 | 56.3 / 166.6 / 166.7 | 0→0 |
| 390 AHEAD Lv10 | 136.3 / 516.7 / 516.7 | 143.8 / 366.7 / 366.7 | 3→3 |

Dense first-visible/blast stalls remain in the baseline and current software backend; this task does not claim to eliminate them. Separate QA wrappers around existing shader operations show baseline and final first-flight work both submit **two shaders / one program link**, with measured shader/query/uniform calls totaling only about 0.1–0.3ms. First-flight JS/render CPU in that separate run was 317.0→308.7ms (350), 309.4→297.5ms (390). These wrappers introduce no extra GPU queries. They support avoiding an extra trail program, but do not attribute the remaining hundreds of milliseconds to shader compilation: other submission/backend work remains unresolved. No new network request occurred when feedback appeared.

### Ordinary startup

Production QA builds reconstruct the baseline runtime from Git; public assets are unchanged. Three cold/warm pairs per size, DPR2, CPU4×, 150ms network latency, 1.6Mbps download / 750Kbps upload, separate cold contexts and warm HTTP cache. The QA preview supplies a fixed cache header for matched warm measurements; it is not a claim about all deployed cache headers. No checkpoint is present in these fresh-start tests.

| Width / cache | Navigation→Tap-to-Start median [range] ms, baseline→final | Tap→interactive median [range] ms, baseline→final |
|---|---|---|
| 350 cold | 4037 [4027–4043]→3962 [3962–3979] | 68 [61–238]→69 [60–71] |
| 350 warm | 1740 [1723–1793]→1842 [1831–1960] | 76 [61–89]→70 [61–75] |
| 390 cold | 4067 [4010–4110]→3959 [3955–3973] | 62 [57–64]→71 [21–78] |
| 390 warm | 1910 [1752–1952]→1765 [1716–1793] | 65 [62–66]→72 [65–87] |

Navigation→first submitted render medians: 4328→4254ms / 1940→2060ms at 350 cold/warm; 4360→4249ms / 2144→1983ms at 390. Cold measured subresource transfer bytes are 486687→487822 (+1135 including QA build instrumentation), warm 0→0; eight resource entries in every run. No new asset or extra request exists. All current runs have zero blank Observer frames, one prepared Mandarin intro source starting at offset zero and a ready portrait. Small warm/startup timing differences vary by size; there is no consistent regression or claim of improved downloads. The shipping build grows from 316.54KB to 317.51KB gzip JS and 7.07KB to 7.23KB gzip CSS; geometry preparation remains post-start.

## Validation and evidence

Full final source: **1203 tests / 161 files pass**, typecheck passes, production build passes. Added tests cover authoritative success/blocked/restore events, procedural cue scheduling/ducking/radio attenuation/source cleanup, HUD presentation clocks/reset/restore, fixed trail bounds and disposal. Existing grenade event assertions were updated explicitly rather than relaxed.

Browser evidence lives under ignored `artifacts/p3b6b3c/`; scripts under `scripts/qa/` reproduce it without shipping telemetry or endpoints. All phone-sized checks use 350×844 and 390×844.

| Check | Result / evidence |
|---|---|
| Delayed-loading early choice | Six final exact-state restores; choice precedes assets/app; one canvas/GLB; attempted pending inputs cannot change state. `recovery-after/` |
| Rifle and AHEAD Lv8/Lv10 real throws | Button/Q success gives exactly one cue and pulse, one decrement; blocked flight requests give neither; one unchanged impact cue; no asset requests; acquisition preserved. Baseline/current comparison and separate captures. `grenade-before/`, `grenade-after-timing/`, `grenade-after/` |
| In-flight recovery / HMR | Exact paused state, no launch replay or flash, audio not created until Resume, one later impact; Retry clears confirmation. Dense Lv10 uses an actual Vite full-reload message; other fixtures use reload. `grenade-after/` |
| Regular/AHEAD lifecycle | Manual Pause/hidden reload, same-page visibility, pagehide/pageshow, Chromium freeze, WebGL loss/restore, damaged enemies/in-flight Grenade, Giant/Supply clocks, 240 identical continuation ticks, Retry/Game Over, corrupt/quota/unavailable storage and FPS pass. `resume/` |
| Recovery guards / Wake Lock | Duplicate decisions, held touch/key/Tab guards, safe New Game and invalid checkpoints, running/Pause/Resume/hidden/freeze/context/game-over/disposal, deferred request races and denied/unsupported/insecure cases pass. Real localhost Chrome grant also passes; not Android timeout certification. `wake/` |
| Shipping recovery | Both Defense/Legacy at both sizes restore exact state paused and reproduce 120 identical ticks; Retry clears; DEV FPS/diagnostics/tools absent. `production-resume/` |
| Shipping assets / progression | `/topwar/` content-hash assets, untouched 10-level plan, no DEV controls/fixtures/requests, natural level progression and Legacy boss smoke pass. `production/`, `modes/` |
| Supply regressions | CRATE3/CRATE8 destruction stages, deterministic Retry and supply acquisition pass. `supply/` |
| Observer / NAVAL | Mandarin intro and alert warning, stable breakout portrait/subtitles, Pause and DEV panel layout checked at both widths with 0/34px bottom insets. `observer/` |
| Resource / startup | Matched state/render pools and cold/warm checks above; no new download or trail shader program. `performance/`, `grenade-*-gl/`, `startup-*/` |

Six final WebMs contain actual encoded video and decoded 48KHz gameplay audio, 1.68–3.36 seconds long, peak 0.271–0.302 and RMS 0.030–0.045. Extracted frames were inspected at native mobile sizes: HUD confirmation and count are readable without covering steering/loadout; the gold model/tail is visible in Rifle and dense MG scenes. Audio levels/nonempty capture are verified; speaker-level perceptual masking remains for phone review. The capture helper uses a real composited seed frame and 30Hz canvas capture to avoid short empty recordings. The first failed/empty capture was rejected and rerun, never accepted as evidence.

- [350px early choice](artifacts/p3b6b3c/recovery-after/350-choice.png), [390px early choice](artifacts/p3b6b3c/recovery-after/390-choice.png)
- [350px Rifle launch frame](artifacts/p3b6b3c/grenade-after/350-crate3-video-0.png), [390px dense Lv10 launch frame](artifacts/p3b6b3c/grenade-after/390-survival10-ahead-video-0.png)
- [350px Rifle recording with audio](artifacts/p3b6b3c/grenade-after/350-crate3.webm), [350px Lv8](artifacts/p3b6b3c/grenade-after/350-survival8-ahead.webm), [350px Lv10](artifacts/p3b6b3c/grenade-after/350-survival10-ahead.webm)
- [390px Rifle recording with audio](artifacts/p3b6b3c/grenade-after/390-crate3.webm), [390px Lv8](artifacts/p3b6b3c/grenade-after/390-survival8-ahead.webm), [390px Lv10](artifacts/p3b6b3c/grenade-after/390-survival10-ahead.webm)

No game-data, authored balance, player weapon, projectile style, enemy art/HP-bar, Observer, Carnival/Destroyer, Supply, checkpoint format, Wake Lock implementation or public asset changed. Content-hash URLs and `/topwar/` remain intact. The QA recorder captures the actual composited page plus the existing master audio bus; decoded WAVs are exports of recorded gameplay, not replacement audio. Capture/inspection overhead is kept out of the matched rendering benchmark.

## Physical-device review

Desktop Chrome/SwiftShader does not reproduce Pixel 8 GPU performance, Android tab discard, the screen timeout or phone-speaker masking. Please compare a fresh reload with an existing AHEAD Lv10 checkpoint: the decision should be available while assets are still loading; Continue should wait safely and then present the exact paused battlefield. Resume explicitly afterward.

On Pixel 8, test successful button/Q throws in normal play and dense AHEAD Lv8/Lv10, including the last inventory item, Observer warnings, acquisition and explosion. Confirm that the short launch cue is distinct and audible without overwhelming dialogue, and that the gold HUD pulse and in-flight model/tail are easy to see. Existing software-rendering dense-combat long frames are reported below rather than represented as phone results.

No deployment or frozen-tag change (`playtest-2026-10-08` remains `59136b49e1328ab754412f7affe90c755c76c0fd`). Stop after P3-B.6B.3C for physical-phone verification.
