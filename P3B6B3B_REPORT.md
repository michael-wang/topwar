# P3-B.6B.3B — Recovery UX and Screen Wake Lock

2026-10-11. Baseline `7d0dd754649ba725f4526646506ff7f20d4789d7`.
Implementation commit: `e08ebd47e64e4c2b28373ccbb02016549613066a`. This report is delivered in a following documentation commit.

No deploy. Frozen `playtest-2026-10-08` remains `59136b49e1328ab754412f7affe90c755c76c0fd`. No Simulation, balance configuration, weapon, rendering, audio or public asset changes. AHEAD/STAGED/EXPERIMENTAL/BASELINE, MG6–10, HP bars and Stage 1 schedules remain unchanged. Checkpoint format/version remains compatible with P3-B.6B.3A.

## Delayed recovery: cause and fix

Previously `main.ts` awaited configuration/level and model loading before constructing GameApp, whose constructor created the recovery dialog after renderer/HUD construction. This explains the delayed choice. It does not establish the cause of the original Android reload.

A small synchronous HTML bootstrap now checks only checkpoint presence in the appropriate DEV/release slot. Before the main module executes, it creates an opaque navy **正在載入上次進度…** surface, marks the viewport inert and sets a pending attribute. `main.ts` adopts that surface before starting asynchronous data/asset work. Full strict checkpoint validation remains in TypeScript; it is not duplicated in HTML. The choice becomes available only after validation and renderer initialization.

Pending gameplay controls are hidden by CSS and excluded from interaction/accessibility by inert. No inputs start, no Simulation ticks advance, and retry/tuning/review/Start/Pause handlers reject pending recovery. Keyboard focus is trapped in the ready dialog. Touches/keys begun before the buttons existed cannot activate a newly created choice. Continue reconstructs the same full authoritative state and remains paused; New Game deliberately clears the saved record. Invalid records offer a safe fresh start. No-checkpoint startup has no persistent cover; data/asset errors remove it and show the existing failure message.

Choices are once-only. A brief **350 ms quiet-input guard** retains the inert surface after the decision, resetting while repeated touches/keys remain held. It prevents a second New Game tap from activating Tap-to-Start underneath, and never replays input later. Blur/hidden/freeze clear stale held input; disposal removes listeners/timers. The simulation remains paused or awaiting Start throughout this guard.

In deliberately delayed tests (700 ms main-module delay, 1,200 ms configuration/model delays), the loading surface was already observed at 120.1 ms / 54.7 ms for 350/390 widths, with no app yet constructed. Ready choice checks occurred at 3,815.6 / 3,743.5 ms. These are DOM probe timestamps, not precise first-paint measurements or claims of faster asset loading. The benefit is blocking interaction during the wait.

## Wake Lock lifecycle

`ScreenWakeLock` owns at most one request/release operation and one sentinel. Eligibility requires started/running gameplay, an unpaused visible document, usable WebGL context, living soldiers and no recovery blocker. Acquisition follows actual Start/Resume or active DEV review initialization. It is optional and never awaited to advance gameplay.

Pause, hidden/pagehide/freeze, context loss, Game Over, stop and disposal release the lock. Return/context restoration keep the game paused; explicit Resume requests another lock. Request epochs invalidate grants arriving after Pause. Rapid Resume during an old request/release waits for cleanup, releasing a stale grant before requesting another. Release failures retain ownership rather than acquiring a second sentinel. System/battery revocation updates status without an automatic retry loop; a later Start/Resume/review gesture can retry.

Missing API, insecure origin and denial/errors cannot crash or block combat. There are no videos, synthetic activation hacks, per-frame requests or permission polling. DEV → SCREEN displays ACTIVE, REQUESTING, RELEASING, RELEASED / PAUSED, UNAVAILABLE — INSECURE ORIGIN, UNSUPPORTED or DENIED / ERROR. ACTIVE requires an acquired unreleased sentinel. The status UI is removed from production; Wake Lock functionality remains there.

[API requirements and revocation behavior](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).

## Secure Pixel 8 testing

ADB was not available on PATH, in the usual Android SDK location or the local development tools inspected. No phone/USB authorization or certificate installation was attempted. Follow [PIXEL8_DEV_TESTING.md](docs/PIXEL8_DEV_TESTING.md):

1. Connect the Pixel with USB debugging and authorize it; confirm `adb devices` reports `device`.
2. Reuse/start normal Vite on 5173, run `adb reverse tcp:5173 tcp:5173` and open `http://localhost:5173` on Pixel Chrome.
3. Inspect through desktop `chrome://inspect/#devices`; verify `window.isSecureContext === true`, `navigator.wakeLock`, and SCREEN ACTIVE after Start/Resume.
4. Check asset responses and Vite WebSocket/HMR; play AHEAD Lv10 untouched for >30 seconds with the phone timeout at 15 seconds. Pause must release; sleep/reopen/Continue must restore paused progress; Resume reacquires.

The guide includes multi-device/cleanup commands and an optional trusted HTTPS LAN server (`scripts/dev/https.mjs`) using supplied certificate/key paths. It changes no default Vite setup and installs/trusts nothing automatically. No certificate-warning bypass or unsafe-origin flags are recommended. **LAN HTTP, localhost HTTP and HTTPS are different storage origins: old checkpoints do not automatically move.**

Native desktop Chrome at localhost reported secure context, API support, a real granted sentinel and release after Pause. Vite's HMR connected message and the expected one GLB/two portraits/intro audio loaded successfully. A genuine non-secure named HTTP origin, served through QA response forwarding without overriding secure context, reported `isSecureContext:false`, no Wake Lock API, and harmless insecure status while assets/combat remained usable. The proxy test is not a physical LAN/USB test. Desktop HMR transport checks do not certify Android USB HMR or actual source updates on the phone.

## Performance evidence

Matched warmed rendering: Chrome SwiftShader, CPU 4×, DPR 1; separate before/current renderer contexts, sixty warm RAFs then three five-second blocks per width. Both use the same real deterministic AHEAD Lv10 snapshot at tick 960: 171 enemies (81 Heavies), three soldiers, 100 projectiles. QA alone freezes simulation stepping and cancels optional idle preparation consistently, so workload/deaths/XP and pool preparation do not confound presentation cost. Current samples hold a real native Wake Lock. This is a warmed presentation comparison, not advancing 81Hz combat or phone GPU certification.

| Width/version | Mean frame ms | Block mean range ms | p95 range ms | Max ms | >100 ms total | >200 ms |
|---|---:|---|---|---:|---:|---:|
| 350 baseline | 116.89 | 113.57–120.42 | 116.8–133.4 | 183.4 | 113 | 0 |
| 350 current | 118.70 | 118.70–118.70 | 133.3–133.4 | 133.4 | 122 | 0 |
| 390 baseline | 122.69 | 122.09–123.08 | 133.4 | 149.9 | 119 | 0 |
| 390 current | 120.68 | 119.52–121.67 | 133.3–133.4 | 183.4 | 119 | 0 |

Mean differences are approximately +1.6% / −1.6%; no consistent regression or performance gain is established. The many >100 ms frames reflect the known dense software-rendering cost and are not evidence of Pixel 8 smoothness. All samples match 301–303 draw calls / 518,614–518,792 triangles, 66 geometries, nine textures, stable body/tier pools and projectile pool 128. No quality/HP-bar reduction was made. A preliminary UI-driven preparation probe had differing pool/prewarm states; it is retained under `performance/`, but this table uses the corrected `performance-matched/` evidence. The subsequent quiet-input guard is recovery-only and adds no active rendered-frame work.

Startup: three cold/warm repeats per width, empty checkpoint, CPU 4×, DPR 2, 150 ms latency, 1.6 Mb/s download / 750 kb/s upload. Baseline is reconstructed from Git in QA transforms, including HTML. Serial host/driver/thermal variation remains; QA marks add equal measurement overhead. An adjacent baseline was repeated after the final current sample to expose order/host drift.

| Width/cache | Initial baseline Tap-to-Start median (range), ms | Current median (range), ms | Adjacent baseline median (range), ms |
|---|---|---|---|
| 350 cold | 3847.0 (3825.0–3859.7) | 4091.5 (4055.2–4110.3) | 3964.8 (3962.9–4008.0) |
| 350 warm | 1726.9 (1656.1–1742.9) | 1856.0 (1804.6–1873.9) | 1835.7 (1829.0–1838.5) |
| 390 cold | 3821.8 (3807.6–3832.0) | 3950.3 (3931.9–4045.9) | 3999.6 (3975.4–4027.1) |
| 390 warm | 1693.9 (1636.2–1736.2) | 1782.0 (1687.9–1929.1) | 1755.0 (1754.7–2004.6) |

Current startup is 3–7% slower than the initial baseline, which itself slowed on the adjacent repeat. Compared with the adjacent baseline, current cold startup differs by +126.7 ms (+3.2%) at 350 and −49.3 ms (−1.2%) at 390; warm differs by +20.3 / +27.0 ms (+1.1% / +1.5%). This does not prove zero overhead or attribute all variation to the host. No consistent large regression is established; physical startup still needs confirmation. Current median navigation-to-first-interactive frame is 4383.1 / 2072.2 ms at 350 cold/warm and 4250.5 / 2023.7 ms at 390. Tap-to-first-interactive medians are 62.6 / 25.9 and 67.5 / 66.4 ms respectively. All raw repeats are retained, including the initial current probe, under `startup-before/`, `startup-after/`, `startup-after-final/` and `startup-before-final/`.

Eight ResourceTiming requests remain throughout, one Defense GLB and unchanged public hashes/`/topwar/` paths; warm transfer is zero. Final cold resource transfer is 486,687 bytes versus baseline 485,118 (+1,569; ~0.32%). ResourceTiming excludes the document itself. Final shipping HTML adds ~1.24KB raw/~0.62KB gzip, JS ~6.25KB/~1.51KB gzip and CSS ~0.21KB/~0.06KB gzip. No new asset request or shader/material was introduced. Startup checks retain zero blank intro portrait frames and speech starts at offset zero.

## Validation and evidence

- **1,199 tests / 160 files pass**, typecheck and production build pass. Existing nonfatal Zod annotation/chunk-size warnings remain.
- Eleven controllable Wake Lock tests cover ownership, deferred grants/releases, rapid toggles, denial, unavailable/insecure APIs, system release, disposal and failed release. Checkpoint presence tests prove no parse/mutation during early detection.
- Both mobile sizes pass delayed loading, attempted controls/shortcuts, touch held across loading, once-only decisions, real repeated touch/key rejection, exact paused restore, deliberate New Game, invalid storage, Wake Lock lifecycle and pending-grant cleanup.
- Existing mobile resume/FPS tests pass after the guard: regular play and AHEAD Lv10, in-flight Grenade/partial HP exact continuation, hidden/no reload, reload, pagehide/pageshow/freeze, WebGL loss/restoration, Retry, corrupt/quota/unavailable storage, selected AHEAD/LV10 and historical snapshot checks.
- Shipping Defense/Legacy recovery passes both widths with exact full state and deterministic continuation. Production sanity rejects DEV FPS/Wake status, diagnostics, review fixtures and QA markers. Natural Lv1–10 and Legacy Boss/Pause/Retry/Snapshot browser regression checks pass. `?perf=1` and existing FPS behavior remain intact.
- `git diff --check` passes; no Simulation/balance configuration/rendering/audio/public files changed. Optional HTTPS helper syntax passes; no trusted phone certificate setup was claimed. DEV Wake status is available in both Defense DEV and Legacy TUNE panels.

Ignored local evidence under `artifacts/p3b6b3b/`: `browser/results.json`, `resume/results.json`, `production-resume/results.json`, `production/production-sanity.json`, `modes/results.json`, `origins/results.json`, `performance-matched/results.json`, and startup JSON/logs. Reusable commands are in `scripts/qa/README.md`.

Screenshots: [350 early blocker](artifacts/p3b6b3b/browser/350-early-loading.png), [390 early blocker](artifacts/p3b6b3b/browser/390-early-loading.png), [restored paused Lv10](artifacts/p3b6b3b/browser/390-recovered-paused.png), [DEV Wake ACTIVE](artifacts/p3b6b3b/browser/350-wake-active.png). ACTIVE screenshots use a controllable mock sentinel for deterministic UI checks; real native grants are verified separately in `origins/results.json` and the matched performance runs. These local artifacts are ignored, not committed.

## Physical acceptance still required

Desktop emulation cannot certify Android's actual 15-second timeout, USB forwarding, phone certificate trust or battery-driven revocation. Pixel 8 must verify screen stays awake while ACTIVE, Pause releases, recovery blocks immediately on reload, repeated taps do not enter gameplay, and Continue/Resume preserve the accepted AHEAD run. Lock denial/revocation may still permit sleep; durable checkpoint recovery remains the fallback. The cause of the original Android page reload remains unresolved. Stop here for physical review; no art/boss/balance follow-on is started.
