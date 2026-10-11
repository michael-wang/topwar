# P3-B.6B.5 — Naval Cadence & Persistent Lane Warnings

Starting revision: `6b6c23e0b72623b0dce42e15074558654c09ac2b`.
Implementation revision: `64ae34ed114b36fd2b44c1d0538e6df866eafee6`.
No deployment or frozen-tag update is part of this task.

## Shipping behavior

Production Stage 1 now opts into three optional serialized configuration fields:

- `destroyer.attackPolicy: "barrage"`, with an empty `shotTimes` array.
- `navalBarrage.overlapPolicy: "waitForImpact"`, with 2–3-second intervals.
- `artillery.warningPresentation: "overheadLanes"`.

The existing modular encounter actions remain independent. AHEAD, weapon progression, artillery flight/damage/collision, Giant/Supply scheduling and all Grenade feedback are unchanged.

| Offset from Lv6 MG release | Event |
| --- | --- |
| +0s | Unchanged MG release, Carnival and Destroyer entrance |
| +1.3s | Unchanged Observer introduction begins |
| +3.2s | Destroyer reaches offshore station |
| +8.5s | Authored radio window ends; barrage enabled |
| +10.5–11.5s | First randomized salvo, subject to fixed-tick quantization |
| +23s | Ship stays offshore |
| +24s | Carnival completes |
| +27s | Intro completes; Survival starts without resetting barrage |
| Approximately +28s | First Survival ordinary-wave opportunity |
| Thereafter | Independent Survival admissions and persistent offshore barrage |

There are no new-policy scripted launches at +8.8/+12/+16/+17.3/+21. The first attack follows the radio window rather than competing with it. Historical saves retain those five attacks when their saved configuration authors them.

## Cadence, ownership and determinism

Each opportunity uniformly draws one or two shells, distinct lanes without replacement from the existing five lanes, then the next nominal interval from 2–3 seconds. The existing dedicated naval RNG stream is preserved; enemy, Giant and Supply randomness is not consumed by naval scheduling.

A due opportunity waits while any Destroyer-source shell remains airborne. Its deadline, RNG and opportunity counter remain unchanged while waiting. Impact processing precedes barrage processing, so the last impact tick can immediately launch the next salvo if its nominal deadline has passed. There is no fresh post-impact delay, catch-up queue or repeated random draw. Existing whole-salvo capacity/absent-source skips remain deterministic and bounded by the eight-shell engine.

An optional validated `heldAtSeconds` field records the first held tick. It also makes cancelling the final shell while paused safely restorable: the held opportunity is consumed on the next legal simulation tick. Disabling the barrage clears it. Invalid policy/clock combinations are rejected. Snapshot version remains unchanged.

Enemy admissions, naval presence and barrage retain separate ownership. No safe-lane guarantee, invulnerability or casualty-based tuning was added.

## Warning presentation

Three pooled `InstancedMesh` batches render the navy outline, saturated coral triangle and ivory exclamation. Capacity is bounded by the existing eight-shell maximum; there are no textures, downloads, per-shell Mesh allocations or unbounded history.

The warning band is fixed at world Y 2.05 and the shell's locked target Z. Its horizontal coordinate is the render-space target X multiplied by 0.72. Raising the camera-facing icon expands its apparent horizontal spacing; that fixed presentation spacing keeps all five outer ink edges inside both portrait frames. It does not alter shell impact coordinates or collision.

Measured centers for the five lanes at 350×844 are approximately X 45/110/175/240/305, Y 519 CSS pixels. At 390×844 they are approximately X 50/123/195/267/340, Y 530. Icons are about 55–61 CSS pixels wide. All five full geometry bounds are tested at both sizes. The band sits above the squad and outside the unchanged bottom controls.

Materials are opaque: coral `#ff4a23`, ink `#111b28`, ivory `#fff3c9`. A bounded size pulse uses authoritative simulation time; it never fades the warning and freezes while paused. Lane markers are reconstructed every render from active shell state. Same-lane shells share one marker until the last relevant shell resolves; distinct lanes retain separate markers. Moving the squad does not move these markers.

For the new opt-in, all ground ring/fill/countdown groups and the old player-following alert are hidden. Ground countdown geometry updates are skipped. Existing incoming shells, muzzle flashes, trails, impact explosions and audio remain. Restoring existing flight IDs suppresses muzzle-flash replay; restoration generates no launch events or audio.

## Combat measurements

Final QA ran 120 scenarios: naval on/off × natural/Lv8/Lv9/Lv10 × competent/slower/fixed × seeds 1, 17, 42, 99, 2026. Each observed run was compared with an uninstrumented Simulation using identical inputs, events every tick, full state every second and at completion. All matched. A repeat after the held-state compatibility addition reproduced all 120 final hashes and salvo sequences.

Competent/slower policies move at most one adjacent lane every 200/600ms, exclude currently warned lanes when selecting an adjacent step, and otherwise prefer Supply, a distant Giant or the nearest threat. Grenades use the existing six-target/near-line HP-debt predicate. Fixed-lane runs do not move or throw Grenades. No perfect aiming, invulnerability or artificial damage was used. Runs end at Game Over or 180 seconds of Survival; pre-Survival deaths are reported as such.

Across the on runs: 1,313 launched salvos, 710 singles and 603 pairs; mean actual launch interval 2.501s, range 2.117–3.000s. One hundred opportunities waited beyond normal tick quantization; total held time was 8.083s and the maximum observed hold was 0.133s. No normal-play capacity skips or inter-salvo overlap occurred. Maximum airborne shells was two, versus four in the retained B.4 results. Separate 25,000-opportunity tests verify uniform count/interval/lane distributions; short life-limited prefixes need not be exactly 50/50.

Natural competent results:

| Seed | Lv6 release | Survival starts | Survival until Game Over | Final level | Lost soldiers | Salvos |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 94.917s | 121.917s | 81.617s | 10 | 3 | 39 |
| 17 | 94.183s | 121.183s | 79.550s | 10 | 3 | 39 |
| 42 | 95.650s | 122.650s | 103.167s | 10 | 3 | 48 |
| 99 | 94.267s | 121.267s | 161.550s | 10 | 3 | 71 |
| 2026 | 93.433s | 120.433s | 76.300s | 10 | 3 | 38 |

| Entry / policy | B.4 mean Survival seconds | B.5 mean Survival seconds |
| --- | ---: | ---: |
| Natural / competent | 49.32 | 100.44 |
| Lv8 / competent | 43.59 | 69.06 |
| Lv9 / competent | 62.41 | 85.90 |
| Lv10 / competent | 64.81 | 85.25 |
| Lv8 / slower | 62.09 | 47.03 |
| Lv9 / slower | 75.84 | 65.23 |
| Lv10 / slower | 69.96 | 66.70 |
| Lv8 / fixed | 6.52 | 9.51 |
| Lv9 / fixed | 11.69 | 18.09 |
| Lv10 / fixed | 13.84 | 21.64 |

These are seed-matched complete policies, not isolated damage comparisons: changing attack times/lanes changes pilot movement, kills and XP. Slower policies can die earlier despite the reduced overlap. All isolated naval-on runs eventually lost; no balance was altered in response. Natural slower runs reached Survival in four of five seeds (mean 92.8s among those four); fixed-lane natural pilots all died before Survival. All five competent naval-off natural controls completed 180 seconds, reaching Lv10 with no casualties.

Natural competent on runs averaged 108.16 active enemies during Survival, peaked at 180, averaged 18.4 admitted ordinary waves and 2.8 blocked opportunities. Isolated Lv10 competent runs averaged 108.07 active enemies, peaked at 177, with 19.6 waves and 2.2 blocked opportunities. Wave/Giant/Supply clocks, cohorts, impacts, target lanes and XP timelines are retained in the raw metrics.

## Browser evidence and recovery

Production checks covered Lv8/Lv9/Lv10 at 350×844 and 390×844, DPR 2. They verified two different locked lanes, identical paused checkpoint recovery, no restored muzzle flash, hidden-page pause/save/frozen state, visible-page remaining paused, stable marker anchors after steering, and removing only the cancelled shell's marker. Per-frame recording instrumentation checks that marker count equals unique active lanes, opacity remains 1 and ground-warning count remains zero through the complete first salvo.

Evidence is ignored local QA output under `artifacts/p3b6b5/`:

- `mobile-final/350-warning-lifetime.webm` and `390-warning-lifetime.webm`: real composited gameplay/audio, launch through impact, with steering.
- `mobile-final/*-lv*-two-lanes.png`, `*-restored.png` and decoded `*-warning-lifetime-video-*.png` frames.
- `mobile-final/results.json` and `*-warning-lifetime.json`: authoritative lane/warning/restore checks.
- `combat-final/*.json`, `analysis.json`: complete deterministic outcomes and cohort metrics.
- `historical-b4-recovery/results.json`: old B.4 saved configuration with a shell in flight restored unchanged in the shipping build at both sizes, with identical input/tick/event continuation.

Historical optional-field absence preserves scripted intro, timed retreat, sequential/concurrent policies, ground presentation and overlapping barrage. Earlier eight/ten-level plans and saved AHEAD settings are not migrated. Existing historical regression assertions were retained using a test-only exact pre-B.5 config rather than rewriting their expected five shots. Main NAVAL remains its established intro review; NAVAL BARRAGE exercises the new shipping policy. Human DEV controls and comparison enemy settings are unchanged and excluded from production.

## Performance

Chrome on this Windows host, SwiftShader, 4× CPU throttle, DPR 1, separate renderer contexts, seed 42 Lv10, real adjacent movement every 200ms and no Grenades. Fresh samples last 10s; warmed samples last at least 90s. Cache/startup measurements are local browser diagnostics, not physical Pixel 8 GPU measurements.

| View / mode / sample | Mean / p95 / max frame ms | >100 / >200ms | Peak enemies / projectiles / shells |
| --- | --- | --- | --- |
| 350 / off / fresh | 38.91 / 66.7 / 333.3 | 4 / 2 | 52 / 61 / 0 |
| 350 / on / fresh | 37.80 / 50.1 / 233.3 | 8 / 2 | 59 / 107 / 1 |
| 390 / off / fresh | 36.15 / 50.1 / 266.7 | 4 / 2 | 52 / 61 / 0 |
| 390 / on / fresh | 37.78 / 50.1 / 266.6 | 7 / 2 | 59 / 107 / 1 |
| 350 / off / warm | 51.36 / 83.3 / 200.0 | 8 / 0 | 117 / 76 / 0 |
| 350 / on / warm | 74.68 / 116.7 / 283.3 | 214 / 4 | 180 / 107 / 2 |
| 390 / off / warm | 51.67 / 83.3 / 283.4 | 7 / 2 | 117 / 76 / 0 |
| 390 / on / warm | 75.18 / 116.7 / 283.3 | 210 / 3 | 180 / 107 / 2 |

Retained B.4 warm on samples were 80.02/80.12ms mean, 116.7ms p95, 316.7/566.7ms max at 350/390, ending at Game Over after 76.35s with peaks 168/167 enemies and four shells. B.5 completed 90s at both sizes with two shells maximum. Different casualties/populations and session variance prevent treating this as a pure warning-rendering speedup.

A matched presentation-only benchmark freezes the same authoritative dense scene (176 enemies, 75 Heavies, 36 projectiles, two shells) and compares historical ground versus overhead warnings in separate warmed contexts, three five-second samples per view. Simulation is deliberately held for this cost isolation, not used as a gameplay outcome:

| View | Ground means (ms) | Overhead means (ms) | Ground / overhead draw-call range | >200ms |
| --- | --- | --- | --- | --- |
| 350 | 114.76 / 114.67 / 114.34 | 115.88 / 114.69 / 114.73 | 321–323 / 310–312 | 0 / 0 |
| 390 | 115.08 / 114.73 / 114.35 | 113.18 / 113.18 / 113.57 | 321–323 / 310–312 | 0 / 0 |

Matched triangles were approximately 528k ground versus 527.7k overhead; textures stayed at nine and uploaded geometry counts at 80 versus 78. Existing ambient effects account for small within-mode draw/triangle variation. Warning geometry is two shared shapes and three bounded instance buffers.

In sustained on runs, sampled resources plateaued at 115 uploaded geometries / 12 textures from approximately 30s through 90s; off plateaued at 107/12. Artillery capacity stays eight, projectile pools remain bounded, and no additional asset requests are introduced by warning appearance. Sampled peak submission work was 280.7/276.5ms in warm on runs; mean submission 12.62/12.53ms and p95 16.1/15.8ms are much lower than total frame intervals. Instrumented `compileShader`/`linkProgram` calls individually measured at most 0.3ms, which does not establish the cost of deferred driver compilation. The >200ms outliers remain unattributed by these measurements; the matched warning test does not identify the new icons as their cause. Dense software rendering remains a known risk, and no art, HP bars, resolution, enemy population or combat effects were reduced.

## Verification and remaining review

- Full suite: 165 files / 1,238 tests passing; typecheck and production build passing. Existing large-bundle build warning remains.
- New cadence/held-clock/cancellation/snapshot/configuration validation and full-flight lane-warning tests.
- Historical five-shot/concurrent/sequential, snapshot, deterministic RNG, Legacy, artillery capacity/collision, recovery, Wake Lock, Observer and Grenade unit coverage retained.
- Final production smoke validates authored JSON, `/topwar/` content-addressed URLs, unchanged approved voice bytes and absence of DEV controls/factories.
- Production Defense/Legacy checkpoint tests and six production lane-warning/recovery cases pass at both sizes.
- Existing early recovery: six delayed-asset cases pass; choice availability 121–303ms versus asset readiness 3.868–4.053s, remaining paused after restoration.
- Golden Grenade: six cases across CRATE3 and AHEAD Lv8/Lv10 at both sizes pass, including one launch/impact cue and safe in-flight restoration.
- Observer: sixteen mission/naval captures across both widths and 0/34px safe-area cases pass, preserving portrait breakout, Traditional Chinese subtitles and Pause/Resume.
- DEV naval review: all twelve Lv8/Lv9/Lv10 on/off cases pass, with ≥44px touch targets, identical checkpoint recovery, retained selection and Retry.
- One intermediate Grenade browser run was interrupted by an intentional source edit causing Vite HMR; its complete rerun passed with edits stopped.

Reproduction commands (generated artifacts stay ignored):

```sh
npm test
npm run typecheck
npm run build
node scripts/qa/naval-barrage-metrics.mjs artifacts/p3b6b5/combat-final
node scripts/qa/naval-barrage-metrics.mjs artifacts/p3b6b5/historical-combat --config=tests/fixtures/pre-b6b5-game.json
node scripts/qa/naval-lane-warnings.mjs artifacts/p3b6b5/mobile-final
node scripts/qa/naval-barrage-performance.mjs artifacts/p3b6b5/performance
node scripts/qa/naval-barrage-matched-render.mjs artifacts/p3b6b5/matched-warnings --warnings
node scripts/qa/production-sanity.mjs artifacts/p3b6b5/production-final
node scripts/qa/production-resume.mjs artifacts/p3b6b5/production-recovery-final
```

The historical-combat command reproduces the original B.4 config on this implementation; the before comparisons above use the retained B.4 measured artifacts. DEV browser scripts use the task-owned Vite server on port 5175. Production scripts start their own local previews.

Browser visibility events and reloads exercise recovery contracts; they do not reproduce an Android process discard. Pixel 8 review must confirm warning prominence/lane interpretation during real dense combat, audio balance, new cadence feel and sustained hardware performance. No deployment, frozen tag change, Tank Boss, Giant Air Drop or enemy-art work was performed.
