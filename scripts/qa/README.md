# Current QA tools

Run from the repository root after npm ci. Generated JSON, screenshots, traces and recordings belong under ignored artifacts/. QA is not imported by the shipping game.

## Browser prerequisites

Browser scripts use Playwright and Chrome from the existing QA runtime. Set TOPWAR_PLAYWRIGHT_MODULE to an importable Playwright module if its default runtime path is unavailable. Some tools also accept TOPWAR_CHROME_PATH. Do not add a production browser-automation dependency.

DEV checks require a separate Vite server; use `npm run dev -- --host 127.0.0.1 --port 5175 --strictPort` and `$env:TOPWAR_QA_URL='http://127.0.0.1:5175/'`. Do not stop another developer's server. Production checks start/close their own strict-port Vite preview and require a fresh npm run build. Run performance tools alone, without another Chrome/test load.

Local Vite and closed-playtest Pages share 驅逐艦進場, BOSS 進場, 勝利結算 and 空中支援, plus 返回一般遊戲. Selection closes the menu. DEV-only 進階調校 starts folded and contains balance/audio and sleep/checkpoint QA. Victory uses the real Tank finale and marked sample results. MG/Supply/Survival/phase presets still support regression checks through `selectDevFixture`; they are not visible controls. Only the four approved initializers ship in Production; engineering QA and other presets do not. Switching scenes replaces the current run, as the menu explains.

Temporary P4.2: local Vite's first-level **🎥 鏡頭 A/B 測試** starts the unchanged Lv8 AHEAD fixture (seed 17) in A. The top-center 44px A/B buttons also work while paused. B dollies back 4 units toward `(0, 7.61, -13.84)`, keeps the original target, and matches the near soldier's body projection with an approximately 36.3° reference FOV; the existing tall-phone FOV adaptation remains active. Leaving or Retry resets A. Checkpoints retain only the underlying Survival fixture; reload restores gameplay with the original camera and no experiment controls. B is unaccepted: compare distant lanes, near soldier, horizon and coast on Pixel 8 before any production decision. `node scripts/qa/camera-perspective.mjs` (fresh build + DEV server above) captures identical-state A/B at 350×844 and 390×844, including existing Boss/barrage fixtures through test-only access, and checks production exclusion. Captures hide the Pause veil for readability; separate captures verify the visible Pause switch.

## Regression commands

| Tool | Current purpose |
|---|---|
| production-sanity.mjs | Shipping /topwar/ assets, startup, current AHEAD policy and approved four-scene playback/voice/music/checkpoint recovery, plus exclusion of engineering QA; both widths |
| production-resume.mjs | Real production Pause → reload → Continue, identical state/continuation, Retry |
| instant-recovery.mjs | DEV delayed-config recovery choice before assets, blocked inputs, repeated reloads |
| recovery-wake.mjs | Wake Lock grant/denial/deferred races, Pause/hidden/recovery and disposal |
| wake-origins.mjs | Genuine trustworthy localhost vs insecure proxied HTTP, HMR/asset checks |
| naval-mobile-sleep.mjs | Own DEV server/advanced QA stress fixture, valid recovery, sleep suppression, lifecycle and WebGL context restore, warning recording |
| grenade-inventory.mjs | Exact +1 accumulation through large counts/MAX_SAFE_INTEGER, count bounds, one real throw and reload |
| golden-grenade.mjs | Normal/dense launch, explosion, HUD/trail/audio and in-flight restoration |
| mobile-mg-test.mjs | Retained MG6–10 fixture/Retry regressions, authored firing rates and four-button menu bounds |
| survival-pressure-browser.mjs | All four comparison modes, Lv7–10, Retry/continuation and optional recordings/performance |
| supply-fixtures-sanity.mjs | CRATE3/CRATE8 three-stage destruction, reward transfer, Pause/restore and destination alignment |
| naval-lane-warnings.mjs | Dense Lv8–10 authoritative lane warnings, full flight, pause/restoration and no ground circles |
| naval-barrage-performance.mjs | Production barrage on/off fresh/warm contexts, resource/frame statistics |
| hp-bar-audit.mjs | QA-only body/bar/pulse rendering attribution without changing accepted visuals |

Examples:

```powershell
node scripts/qa/production-sanity.mjs artifacts/qa/production
node scripts/qa/production-resume.mjs artifacts/qa/resume
node scripts/qa/naval-mobile-sleep.mjs artifacts/qa/sleep
node scripts/qa/grenade-inventory.mjs artifacts/qa/grenades
node scripts/qa/mobile-mg-test.mjs artifacts/qa/mg
node scripts/qa/survival-pressure-browser.mjs artifacts/qa/survival --ui-only
node scripts/qa/naval-barrage-performance.mjs artifacts/qa/perf --only=350-on-warm
```

Golden Grenade accepts --no-record. Survival browser checks accept --profile=ahead, --seconds=90, --measure-only, --record-only and --trace. Performance variants must use matched conditions; SwiftShader and CPU throttling do not measure phone GPU performance. Media recording uses bounded canvas/video/audio hooks in the test response.

## Deterministic and repository diagnostics

- `determinism.mjs capture <output> [--revision=<SHA>]` captures fixed-input seeds 1/17/42/99/2026, natural and isolated Lv8/9/10. `compare <output>` verifies full combat state/events at each tick. It explicitly excludes only documented inert retired authored metadata. Historical source is read from Git, not copied into production.
- `naval-barrage-metrics.mjs <output> [--seeds=1,17] [--scenario=natural,lv10] [--seconds=180] [--config=<JSON>]` runs competent/slower/fixed-lane policies with barrage on/off. Each instrumented state/event is checked against uninstrumented control outcomes. Cohorts include same-tick admissions/kills, XP, distance crossings, future-level observations, casualties and real quiet gaps. Defaults cover five seeds/four scenarios/three policies for 180 Survival seconds or Game Over.
- `cleanup-inventory.mjs <output>` records source/test/QA/assets/workflow and production JS/CSS/gzip inventory. Build first.

Active shared helpers: DefensePilot.ts (adjacent movement, threat and Grenade decisions), difficultyPilot.ts, carnivalPilot.ts, survivalPilot.ts, navalBarrageRun.ts. survivalDiagnosis.ts/Hooks and survival-diagnosis-transform.mjs provide observation outside production code. browser-recording.mjs records/inspects bounded media. dev-fixture-controls.mjs uses retained human buttons or test-only fixtures; production-app-hook.mjs is the single shared response interceptor for private production app access. Historical weapon-comparison/retired-menu scenarios needed by regression tests live under tests/helpers/; no corresponding shipping menu is exposed.

## Save and physical-device limits

Published B6B5 and completed B7 checkpoints have a checked-in replay fixture and strict validation regression. DEV/release and HTTP/HTTPS/localhost origins have separate storage slots. Corrupt/unsupported prototype saves offer New Game. Pixel instructions are in docs/PIXEL8_DEV_TESTING.md.

Desktop automation validates lifecycle signals and controllable Wake Lock sentinels, not Android's physical 15-second timeout or real tab discard. No script deploys, changes frozen tags or tunes difficulty based on pilot deaths.
