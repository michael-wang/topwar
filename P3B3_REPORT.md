# P3-B.3 — Startup and critical asset readiness

Validated 2026-10-10. Baseline was clean `main` at
`3b785fc30d530e1dd3fdafbfdfd526f5732e655b`, also confirmed on origin.
The frozen `playtest-2026-10-08` tag remains
`59136b49e1328ab754412f7affe90c755c76c0fd`. No deployment or P3-C work.

## Measurement method

Production builds under `/topwar/`, Chrome 154.0.8037.98 on Windows, SwiftShader,
mobile/touch emulation at 350×844 and 390×844, DPR 2. CDP applies 150 ms latency,
1.6 Mi-bit/s download, 750 Ki-bit/s upload and 4× CPU throttling. Each width has
three fresh-browser-context cold runs, each followed by a same-context warm
navigation. Local static responses use a 600-second cache lifetime; this is a
representative cache experiment, not a measurement of GitHub's live CDN.

The baseline was captured before shipping-source changes. QA-only Vite transforms
mark config/level loading, GLB parse spans, renderer construction, first scene
update and first render submission. Browser hooks observe image/audio decode and
the first voice source start. HTTP cache remains enabled: the timing harness does
not intercept requests. Timing instrumentation and app access are absent from the
ordinary production bundle. Browser validation/recording runs are separate from
the final timing run.

Tap-to-Start means the overlay is installed; the first rendered scene is reported
separately. Tap latency ends at the first RAF observation of interactive startup.
The automated tap occurs after the first render, with browser actionability delay;
navigation-to-speech therefore includes an artificial user dwell and is available
in the raw JSON rather than presented as a product benchmark. Audio timing measures
source scheduling in a running AudioContext, not physical speaker output.

## Before / after timings

Medians of three runs per cell, in milliseconds:

| Viewport / cache | Navigation → Start before | After | Navigation → first scene before | After | Tap → interactive before | After |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 350×844 cold | 5,682 | 3,517 | 5,929 | 3,729 | 21 | 71 |
| 350×844 warm | 2,003 | 1,508 | 2,185 | 1,668 | 65 | 65 |
| 390×844 cold | 5,674 | 3,516 | 5,915 | 3,726 | 67 | 80 |
| 390×844 warm | 2,115 | 1,543 | 2,300 | 1,702 | 69 | 65 |

Cold navigation-to-Start improved about **38%**; warm medians improved **25–27%**.
Across all widths, cold Start ranges were 5,674–5,695 ms before and 3,508–3,547 ms
after; warm ranges were 1,869–2,379 ms before and 1,366–1,877 ms after. Tap latency
is sensitive to RAF/audio activation scheduling: there is no claimed tap-latency
improvement, and no new asset-readiness wait is on the gameplay path.

| Subresource traffic through the opening sample | Before | After |
| --- | ---: | ---: |
| Resource entries per navigation | 20 | 8 |
| Including the HTML navigation | 21 | 9 |
| Cold transferred bytes | 913,965 | 478,625 |
| Warm transferred bytes | 2,849 | 0 |
| GLB requests | 13 | 1 |
| Cold speech starts with a ready portrait | 0/6 | 6/6 |
| Blank portrait frames per cold run | 2–4 | 0 |

Byte counts are the sum of Resource Timing `transferSize` (including its header
estimate, excluding HTML), sampled 700 ms after the first voice source is observed.
The warm resource entries are mostly cache hits rather than wire requests. The
baseline's later Destroyer MP3 is included because idle sync requested it during
the opening sample; it is absent after the change. The final cold transfer reduction
is **47.6%**. All successful final intro sources start at offset **0**.

Stage medians over six runs (both widths), in milliseconds:

| Stage | Before cold | After cold | Before warm | After warm |
| --- | ---: | ---: | ---: | ---: |
| Config fetch + validation | 258 | 268 | 175 | 72 |
| Level fetch + validation | 164 | 174 | 164 | 71 |
| GLB fetch + parse stage | 1,905 | 205 | 49 | 10 |
| Sum of GLB parse spans | 39 | 9 | 40 | 2 |
| Post-GLB family/simulation setup before renderer | 252 | 189 | 220 | 166 |
| Renderer construction | 1,085 | 852 | 1,035 | 846 |
| First scene update | 31 | 27 | 10 | 8 |
| First render call | 209 | 177 | 173 | 151 |
| Synchronous shader/program calls during sample | 9 | 8 | 8 | 7 |
| Mission audio decode promise elapsed | 212 | 82 | 84 | 78 |
| Tap → decoded mission audio | 244 | 100 | 93 | 89 |
| Tap → first spoken source start | 493 | 483 | 531 | 546 |

Config and level durations now overlap, so they must not be added. Both portrait
decode promises finish at a median 3,736 ms from navigation cold / 482 ms warm,
before speech. The baseline did not explicitly decode portraits: its neutral file
finished transferring only after speech began; five runs observed its first ready
visible frame 298–644 ms after speech. One sample ended before that ready-frame
observation. Alert was not requested in baseline startup at all. Raw request,
decode and source-start timestamps remain in the JSON; absent observations are not
treated as zero or inferred decode timings.

## Bottlenecks and resource audit

The baseline serialized config → level → thirteen GLBs → procedural families →
renderer → first scene. It requested the portrait only when showing the panel.
All six cold runs began speech before the image was ready and showed 2–4 blank
portrait frames. Warm-cache runs hid that race. Idle radio synchronization also
started loading the later Destroyer recording immediately after Start.

GLB fetch/parse wall time was primarily a network cost: the cold stage took about
1.9 seconds, while its warm stage took roughly 50 ms. Individual parse spans include
embedded-image preparation and can overlap; their sum is not pure CPU time.
Renderer construction and first draw remain measurable CPU/graphics costs after
network removal. First draw includes program preparation, buffer/texture uploads
and draw submission. Timed compile/link/program-query calls cover only their
synchronous JS-visible time, not asynchronous driver/GPU work; this experiment
cannot reliably attribute the entire first-draw duration to shader compilation.
Likewise, image `decode()` elapsed time includes download and main-thread scheduling,
not just the image codec. Resource response-end and decode-completion timestamps
are recorded separately for that reason.

All original model files remain in `public/models` and in production output:

| GLB (prefix `toy-soldier-`) | Bytes | Startup use |
| --- | ---: | --- |
| `bullet.glb` | 1,720 | Required tracer geometry; Defense and legacy |
| `helmet.glb` | 5,504 | Legacy recruitment reward and Boss helmet |
| `boss-vest.glb` | 10,276 | Legacy Boss gear |
| `gray-body.glb` | 36,340 | Legacy Boss death material |
| `boss-body.glb` | 43,760 | Legacy Boss idle |
| `boss-run-0.glb` | 32,628 | Legacy Boss gait |
| `boss-run-1.glb` | 32,056 | Legacy Boss gait |
| `boss-run-2.glb` | 32,056 | Legacy Boss gait |
| `boss-run-3.glb` | 32,628 | Legacy Boss gait |
| `boss-slam-0.glb` | 32,304 | Legacy Boss slam |
| `boss-slam-1.glb` | 32,300 | Legacy Boss slam |
| `boss-slam-2.glb` | 32,300 | Legacy Boss slam |
| `boss-slam-3.glb` | 32,300 | Legacy Boss slam |

Defense uses the existing procedural Player/Grunt/Heavy/Giant families and has no
recruitment stream or legacy Boss. It now loads one GLB (1,720 raw bytes) instead
of thirteen (356,172 raw bytes), and constructs neither legacy renderer. Legacy
startup still loads all thirteen. Partial loading failures settle all concurrent
loads before releasing collected geometry/material/texture resources. Disposal is
idempotent. Config and level requests now overlap.

## Critical presentation readiness

Both unchanged portrait files and compressed Mandarin intro bytes start preparing
before GLB loading and renderer construction. The existing `ObserverVoiceFiles` /
`ObserverVoice.prepare` cache is extended, not replaced. AudioContext creation and
resume remain inside the real Start gesture; decoding can proceed while resume is
pending. Gameplay does not await portrait or MP3 readiness.

Both images decode once. FieldObserver inserts the prepared image elements when
switching expressions, without changing a visible image's source. The approved
110×110 breakout composition and all CSS/art/audio bytes are unchanged. The
existing 2.5-simulation-second intro readiness window now includes portraits.
The same presentation clock starts the portrait, subtitles, radio cue and speech
at offset zero; Pause freezes it and Retry resets it while retaining prepared assets.

Image preparation and voice fetches have eight-second wall-time bounds. A single
decoded portrait substitutes for a failed expression. If neither is available by
the intro deadline, the whole communication stays hidden/silent for that attempt.
Available images are frozen per communication, preventing late pop-in. Late
recordings still cannot start mid-sentence. A later Retry can reuse a preparation
that completed after the previous presentation deadline; a terminal failure stays
failed for the page session. Destroyer voice preparation starts at encounter entry.

## Cache behavior

The build emits each JSON/GLB/WebP/MP3 once under a filename containing the first
16 hexadecimal digits of its SHA-256. `publicAssetUrl()` uses the manifest embedded
in that JS build and preserves `/topwar/`. Unchanged bytes keep their URLs across
commits; changed bytes get new filenames. Config and level JSON can now use ordinary
HTTP caching instead of `no-store`. Development URLs stay editable and unversioned.

This uses filenames rather than content-hash query strings: a stale client cannot
fetch newly replaced bytes under an old logical filename/hash query. The JS build
names its matching config, level and assets. A removed historical hash can 404
during a deployment transition; refresh is then necessary, rather than silently
mixing versions. No old-version retention, Service Worker or offline cache was added.
The build-label Git SHA remains separate from asset identity. No public source
asset changed, and no duplicate unhashed shipping copies are emitted.

## Validation and evidence

- `npm test`: **146 files / 1,049 tests passed**. Includes mode-specific model loading,
  partial-failure disposal, portrait decode/fallback/deadline, no late pop-in,
  hung audio cancellation, content manifest/URL behavior and existing gameplay tests.
- `npm run typecheck`: passed. `npm run build`: passed on Node 24.21.0 / npm 11.19.0.
  Existing bundle-size and dependency-comment warnings remain; no build failure.
- `production-sanity.mjs`: default and retained review-query starts at both widths;
  current authored config/progression, correct hashed `/topwar/` URLs, one Defense
  GLB, no duplicate requests, no DEV controls/factories or QA hooks in the bundle.
- `startup-readiness.mjs`: production 350/390 recordings; successful intro and
  Pause/Resume/Retry; 1.8-second decode delay, 5-second late decode, both images
  missing, neutral missing, and permanently pending decode. Zero blank frames in
  every after case; successful starts use offset zero. Retry adds no asset requests.
- `p3b-mission-intro.mjs`: both widths, three phrases, ongoing combat/input,
  Pause/Resume, Retry, snapshot rewinds and forward continuation, missing/delayed audio.
- `p3b-browser.mjs`: NAVAL at 350/390/1100, all five launches, Pause/restore, departure.
- `p3b2-observer.mjs after`: neutral/alert and all phrase lengths at 350/390,
  simulated 0/34px bottom insets, 110px composition, bounds and control separation.
- `p3b-lifecycle.mjs`: NAVAL defeat/Retry with audio enabled and AudioContext/storage denied.
- `startup-modes.mjs`: production natural Lv1–8 from seed 17 at both widths, with
  real kill/XP progression (no XP injection). Lv2–8 at 9.33 / 25.57 / 44.85 / 65.13 /
  87.30 / 100.73 / 140.03 simulation seconds. Legacy config is selected only through
  a test response; a valid snapshot moves its first Boss into lookahead. All thirteen
  models load, the Boss renders, and both modes pass Pause, Retry and identical
  120-tick continuation after JSON snapshot round trips. Intermediate GPU draws are
  omitted during accelerated progression; this is behavioral validation, not FPS.

Local generated evidence is intentionally ignored by Git:

- `artifacts/p3b3/before/startup.json` and `after/startup.json`: all 24 measured navigations.
- `artifacts/p3b3/before-readiness/{350,390}-intro-pause.webm`: baseline production videos.
- `artifacts/p3b3/after-readiness/{350,390}-intro-pause.webm`: final production videos with audio.
- `artifacts/p3b3/after-readiness/*-intro-video-*.png`: extracted frames, visually inspected.
- `artifacts/p3b3/mission/`: phrase screenshots, recordings and snapshot/audio results.
- `artifacts/p3b3/{production,modes,naval,lifecycle}/`: assertions, screenshots and JSON.
- `artifacts/p3b2/after/`: expression/composition screenshots and bounds at both insets.

The recordings use unthrottled desktop Chrome at mobile CSS sizes; the isolated
timing JSON uses the throttling profile above. Their purpose is presentation review,
not a visual FPS comparison. Browser audio is captured from the existing master bus.

## Files changed

Startup/rendering: `src/main.ts`, `src/app/GameApp.ts`,
`src/rendering/CharacterAssets.ts`, `src/rendering/GameRenderer.ts`.

Observer: `src/audio/ObserverVoice.ts`, `src/ui/FieldObserver.ts`,
new `src/ui/ObserverPortraits.ts`. `GameAudio.ts` was inspected and its existing
preparation/activation API reused without editing it.

Caching: `vite.config.ts`, new `scripts/public-assets.mjs`,
`src/buildInfo.d.ts`, `src/core/publicAssetUrl.ts`, `src/config/ConfigStore.ts`,
`src/level/LevelLoader.ts`.

Tests: `tests/CharacterVisualFamilies.test.ts`, `tests/Observer.test.ts`,
new `tests/ObserverPortraits.test.ts`, new `tests/PublicAssetBuild.test.mjs`,
`tests/publicAssetUrl.test.ts`, `tests/ConfigStore.test.ts`, `tests/LevelLoader.test.ts`.

QA/docs: new `scripts/qa/startup-profile.mjs`, `startup-readiness.mjs`,
`startup-modes.mjs`; updated `scripts/qa/production-sanity.mjs`,
`scripts/qa/README.md`, `ARCHITECTURE.md`, `GAME_SPEC.md`, and this report.

## Remaining limits

No physical Android/iPhone or Safari test was available. Desktop CPU throttling,
SwiftShader, synthetic safe areas and recorded browser audio do not certify mobile
GPU performance, memory pressure, autoplay behavior on every OS, actual radio
network conditions, or acoustic first-syllable timing. Portrait decoding may be
evicted under device memory pressure; the page retains prepared image elements,
but browser memory policy is outside app control. Renderer construction and the
large JS bundle still dominate warm startup and remain outside this limited pass.

Gameplay, simulation, progression, weapons, Grenades, Carnival, Destroyer/artillery
rules, controls and accepted art are unchanged. No Giant Air Drop, Tank Boss,
Mission Clear, Survival expansion, deployment or automatic next phase is included.
