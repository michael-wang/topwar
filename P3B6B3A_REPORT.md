# P3-B.6B.3A — Mobile resume reliability and readable FPS

Date: 2026-10-11. Baseline: `94d0fe38bb839e39480511fd2b539530b4071d25`.
Implementation commit: `67972dacef0607ef03ce18e6ede357b0313ab10f`.
The report is delivered in a subsequent documentation commit.

No deployment. Frozen `playtest-2026-10-08` remains `59136b49e1328ab754412f7affe90c755c76c0fd`. Weapons, AHEAD/other balance presets, enemy visuals, Simulation logic, Stage 1 schedules and public assets are unchanged. AHEAD remains available through the existing DEV comparison controls; production difficulty is unchanged.

## Outcome and lifecycle evidence

Manual Pause and background suspension now save a complete authoritative checkpoint. A fresh page with a valid checkpoint offers **繼續上次遊戲** / **重新開始**. Continue restores the battlefield, loadout, selected fixture and clocks, and remains paused until Resume. A readable DEV FPS counter measures actual RAF intervals.

The Pixel 8 reset could not be reproduced here. Desktop tests observed a normal `reload` navigation, `wasDiscarded:false`, a valid saved record and previous paused/hidden state. That establishes recovery after a reload, not the original Android cause. DEV diagnostics retain navigation type, available `document.wasDiscarded`, saved-session metadata and at most 32 lifecycle events. There is one startup console record, no continuous logging or polling. `vite:beforeFullReload` is recorded when available. Source edits did invalidate an early QA benchmark through DEV/HMR; it was discarded and rerun with stable source. This does not establish HMR as the cause on the phone.

Listeners cover visibilitychange, pagehide/pageshow, freeze/resume and WebGL loss/restoration. Hiding an active run pauses it, clears held controls and Grenade requests, resets fixed-step/RAF timing, silences/suspends audio and saves. Return keeps the same Simulation paused; elapsed sleep time never enters gameplay. WebGL restoration retains Three.js resource restoration and presentation preparation. Audio resumes through a real Continue/Resume gesture. No unload/beforeunload dependency or speculative browser-discard prevention was added.

## Checkpoint contract and recovery

One origin-local localStorage slot per DEV/release build (`topwar:session:v1:dev` / `topwar:session:v1:release`). Version 1 records game/mode, simulation contract version, informational build SHA, saved time, pause/hidden/reason metadata, DEV fixture identity, saved level/configuration/tuning and the full Simulation state. This includes entity positions/HP, live projectiles, weapon cooldowns, RNG, progression, Grenades and encounter clocks. No renderer objects are serialized.

The JSON is bounded to 1,048,576 characters before parsing/writing (nominal UTF-16 storage bound 2 MiB). Reads validate the strict envelope and reconstruct through existing strict `Simulation.restoreState`, including historical migrations. A newer commit SHA alone does not invalidate a compatible save; there is no expiry. Historical progression/Survival settings retain their saved values. A mode incompatible with the currently loaded mode offers a safe fresh-game choice. Corrupt/incompatible saves do not crash or auto-start; an invalid-record dialog offers New Game. Valid saves remain pending until the user chooses.

Saves occur on Pause, hidden, pagehide, freeze and context loss, never every frame. Storage denial/quota/oversize failures show a truthful notice without stopping gameplay. Failed writes attempt to remove an older record so it cannot masquerade as the latest pause. Retry/New Game invalidate the old run; Game Over clears it once. Recovery seeds presentation observers and acquisition state, suppressing original Mission Intro, old shots/kills and one-shot upgrades. Existing Giants are primed as already revealed so paused recovery does not leave them in a new entrance fade. Observer dialogue audio itself is presentation state, not persisted mid-sentence.

Dense real AHEAD Lv10 seed-17 sample: 171 living enemies (90 Grunts, 81 Heavies), three soldiers, 100 projectiles at 16 simulation seconds. Checkpoint: **52,375 characters**, approximately 51.1 KiB for this ASCII JSON / 102.3 KiB nominal UTF-16. Twenty-five writes per condition included state cloning, JSON serialization and setItem:

| Viewport | CPU | Mean write ms | p95 ms | Max ms |
|---|---|---:|---:|---:|
| 350×844 | native | 0.108 | 0.2 | 0.4 |
| 350×844 | 4× | 0.688 | 1.2 | 1.3 |
| 390×844 | native | 0.120 | 0.2 | 0.4 |
| 390×844 | 4× | 0.560 | 0.8 | 1.2 |

Ten unthrottled read/strict-validation/reconstruction samples averaged 0.84/0.80 ms (350/390), maxima 2.8/2.7 ms. Browser clock granularity and desktop storage limit these numbers; they do not measure phone flash durability/fsync or recovery after an actual OS process kill.

## FPS and mobile presentation

DEV-only 19px bold ivory text on navy backing next to DEV, 44px high, safe-area anchored. Updates approximately three times/second with change-only DOM writes. RAF timestamps provide rendered FPS, independently of the 60Hz fixed simulation. Pause shows PAUSED; start/resume reset the interval accumulator, background/context loss reset timing, and implausible sleep gaps are ignored. No per-frame allocation/query was added. Legacy positioning clears the centered tier HUD and top action controls. Existing `?perf=1` remains available.

At both sizes, automated bounds checks and screenshots confirm separation from DEV, Pause and the Observer breakout portrait; 34px bottom safe area was also exercised. The screenshots show real desktop SwiftShader rates, not an invented Pixel 8 measurement.

Local ignored evidence:

- [350 FPS](artifacts/p3b6b3a/resume/350-fps-ahead10.png), [390 FPS](artifacts/p3b6b3a/resume/390-fps-ahead10.png).
- [Recovery choice](artifacts/p3b6b3a/resume/350-continue.png), [350 restored paused battlefield](artifacts/p3b6b3a/resume/350-restored-ahead10.png), [390 restored paused battlefield](artifacts/p3b6b3a/resume/390-restored-ahead10.png).
- [Legacy FPS](artifacts/p3b6b3a/resume/390-fps-legacy.png), [recovery results](artifacts/p3b6b3a/resume/results.json).

These evidence files are retained locally, not committed. Reproduction commands are in `scripts/qa/README.md`.

## HP-bar audit — measurement only

Matched QA response transforms/mesh toggles never enter application code. Chrome SwiftShader, DPR 1, CPU 4×; the same frozen real dense sample described above, all 171 enemy centers within the camera frustum (not an occlusion-perfect visibility count). Heavy bars use a fixed half-strength flash to stress updates. Ninety warmup RAFs precede three counterbalanced five-second blocks per variant and viewport. No-bar/no-body variants retain setup CPU; they isolate drawing, not the total cost of deleting those systems. Giants and contact shadows are retained.

| Width | QA variant | Mean frame ms | Block mean range ms | p95 range ms | Max ms | >100 ms total | >200 ms | Draw calls | Triangles |
|---|---|---:|---|---|---:|---:|---:|---|---:|
| 350 | Normal | 111.86 | 111.12–112.23 | 116.7–116.8 | 133.3 | 101 | 0 | 311–313 | 518,856 |
| 350 | No Heavy backing/fill | 111.16 | 110.51–111.85 | 116.7 | 116.8 | 104 | 0 | 149–151 | 518,532 |
| 350 | No Heavy flash/pulse | 110.63 | 107.80–112.60 | 116.7–116.8 | 150.0 | 100 | 0 | 311–313 | 518,856 |
| 350 | No ordinary body/gear draws | 17.23 | 16.67–17.67 | 16.7–16.8 | 116.7 | 4 | 0 | 301 | 20,976 |
| 390 | Normal | 111.65 | 110.87–112.60 | 116.7–116.8 | 133.3 | 100 | 0 | 311–313 | 518,856 |
| 390 | No Heavy backing/fill | 109.42 | 109.06–109.79 | 116.7 | 116.8 | 93 | 0 | 149–151 | 518,532 |
| 390 | No Heavy flash/pulse | 110.30 | 108.16–111.86 | 116.7 | 150.0 | 101 | 0 | 311–313 | 518,856 |
| 390 | No ordinary body/gear draws | 17.27 | 16.67–17.79 | 16.8 | 116.7 | 3 | 0 | 301 | 20,976 |

Removing Heavy bars saves **162 calls / 324 triangles**, but total frame time changes only about 0.6%/2.0%. Renderer submission CPU averages drop approximately 1.5–2 ms. Removing flash/pulse gives about 1% total improvement, within block variance. Removing ordinary body/gear drawing saves **497,880 triangles** and approximately 85% frame time. This software-rendering sample supports ordinary body drawing/shading as dominant, and does **not** support HP bars as the principal bottleneck. All accepted body/bar visuals remain unchanged.

Geometry count grows 66→68 initially then plateaus at 68; nine textures remain stable. Projectile pool stays 128 for 100 live shots; shadow capacities 240 enemies / eight soldiers and body/tier pools remain bounded/stable across blocks. Occasional >100ms frames in no-body blocks lack trace attribution; no precise cause is claimed. No >200ms frames appeared in these warmed blocks. This frozen benchmark is not a fresh-shader test, long-duration heap certification or Pixel 8 GPU benchmark. Raw trials, submission CPU and resource counters: `artifacts/p3b6b3a/hp-bars/results.json`.

## Startup comparison

Three repeats per width/cache condition, matched QA-instrumented baseline/current source, fresh empty checkpoint. Chrome CPU 4×, DPR 2, 150ms latency, 1.6Mb/s download, 750kb/s upload. Warm runs reuse HTTP cache after stopping the old app and clearing its checkpoint. Timing scripts/marks add equal QA overhead; serial runs retain host/driver variance.

| Size/cache | Nav→Tap-to-Start median ms (before→after) | Before range | After range | Nav→first rendered frame median ms | Tap→interactive median ms |
|---|---|---|---|---|---|
| 350 cold | 3694.9→3805.6 | 3694.6–3799.1 | 3748.8–3815.2 | 3963.2→4076.0 | 76.6→73.6 |
| 350 warm | 1660.8→1632.6 | 1659.7–1723.5 | 1624.4–1707.7 | 1864.8→1841.6 | 67.0→67.3 |
| 390 cold | 3773.0→3845.3 | 3722.7–3788.2 | 3784.8–3862.5 | 4039.7→4105.2 | 77.1→75.6 |
| 390 warm | 1652.5→1672.1 | 1644.7–1672.1 | 1663.2–1715.3 | 1844.7→1873.7 | 69.8→72.0 |

Cold start adds 110.7/72.3ms (about 3%/2%); warm results are mixed. This is a small measured cold cost, not proof of zero overhead or a statistically significant phone regression. Eight requests throughout, one Defense GLB, no new asset downloads. ResourceTiming cold transfer 482,558→485,117 bytes (+2,559; ~0.53%); warm transfer zero with eight cached requests. Intro blank-portrait frames remain zero, voice starts at offset zero. JS recovery code adds roughly 9.5KB raw/~2.4KB gzip. Public asset content hashes and `/topwar/` paths remain intact. Detailed samples: `artifacts/p3b6b3a/startup-before/startup.json` and `startup-after/startup.json`.

## Verification

- **1,187 tests / 159 files pass**; typecheck and production build pass. Existing Zod annotation/chunk-size warnings remain nonfatal.
- Mobile recovery QA passes both sizes: regular play and AHEAD Lv10 after ~30 simulation seconds; Pause→reload→Continue; running→hidden→reload; same-page visibility/pageshow/freeze; Chromium freeze/active; context loss/restoration; no sleep catch-up or stale controls.
- Exact saved/restored full-state equality, then 240 identical input/ticks with an in-flight Grenade and partially damaged Heavy. No replayed opening/acquisition/audio cues; restored Giant presentation is settled. DEV AHEAD/LV10 selection survives recovery and Retry.
- Checkpoint unit tests additionally replay 70 seconds with identical controls/events/state, exercising future Giant/Supply clocks and all five naval shell launches exactly once. All four Survival modes, Crate/NAVAL and historical eight-level plans/Survival settings are covered.
- New Game/Retry/Game Over invalidation; corrupt/version-incompatible/oversize/mode-invalid records; unavailable storage and quota failure pass without crashes.
- Shipping Defense/Legacy recovery passes at both widths, full-state equality and deterministic 120-tick continuation. DEV FPS/lifecycle/MG/Survival UI/QA markers are absent from the production bundle.
- Production sanity, natural Lv1–10/Legacy Boss, Pause/Retry/Snapshot, all 32 mobile Survival fixtures, MG18/22.5/27/54/81 rates, retained main DEV controls, CRATE3/CRATE8 stages/reward, Observer missing-portrait+voice fallback, transfer resize/safe areas, aircraft parity and WebGL resource disposal pass.
- `git diff --check` passes. No Simulation, balance configuration, weapon, enemy-art or public asset file changes.

QA scripts are reusable; instrumentation is route/SSR transformed or test-only. No shipping inspection endpoint was introduced.

## Pixel 8 review and remaining limits

On the same origin/port, select AHEAD Lv10, play, Pause, sleep the phone and return. If the page reloads, choose Continue, confirm battlefield/Lv10/AHEAD and paused state, then Resume. Also hide an actively running page. Capture the single `[TopWar lifecycle]` startup record when remote debugging is available; navigation/discard/HMR signals are evidence, not guaranteed Android root-cause detection.

Desktop Chromium freeze and WebGL tests do not reproduce Android tab discard or browser process recreation. Origin changes, browser storage clearing/eviction, private-mode policy or storage failure can prevent recovery. The design prioritizes immediate Pause/hidden saves rather than unreliable final-discard events; abrupt termination before either event remains a risk. Audio gesture behavior, actual phone storage durability, safe-area presentation and physical GPU FPS require Pixel 8 confirmation. No automatic follow-on balance, HP-bar redesign or P3-C work is included.
