# P3-B.3.1 — Runtime hitch and Observer fallback

Baseline: `1a87a42131e595f8463fd9831ac623b757914c83`.
Observer implementation: `aa62da1cddc7c8aac940b363001ca9715f85bba4`.
Runtime implementation: `434a2571ab913154948dbb36c391c65041323d3e`.

## Findings and changes

The reproduced crate freeze had two overlapping presentation costs:

* The moving inline SVG reward's rendering/compositing path produced the largest frame gap. With the aircraft shader fix already applied, hiding the transfer SVG reduced the first-open maximum to 133 ms; suppressing only the button pulse still produced 567 ms, and removing only the SVG shadow filter still produced 600 ms. Retaining compositing layers with `will-change: transform` reduced it to 167 ms while preserving the complete SVG, shadow, sizes and flight path. This isolates the affected browser path; the traces do not resolve the precise driver/raster stage on a physical phone.
* The first background aircraft pass overlapped the reward window. The matched baseline measured 332 ms in its first draw, including 237.5 ms in `getProgramInfoLog` and 90.5 ms in shader diagnostics. It previously introduced a separate `fog:false` basic shader. Aircraft now share the existing basic shader with zero fog weight; frozen before/after canvas captures are pixel-identical at both widths. Shader diagnostics remain enabled.

Crate event dispatch was not a 500 ms JavaScript operation: first CRATE3 transfer initialization was 0.7 ms before / 1.0 ms after; supply audio scheduling and destruction-event presentation were each at most 1 ms. There were **zero network requests** in every crate trace. The golden grenade remains inline SVG. The intentional 90 ms presentation lead, 360 ms staggering, 900 ms flight and existing pulse are unchanged.

The former transfer loop interleaved style writes with viewport/icon measurements. It now measures once on entry, invalidates on resize/visual-viewport/safe-area style changes, and computes the pulsing destination from unscaled bounds. Icon measurements fell from 15 to 1 in the first CRATE3 event window. Grenade HUD writes occur only when values change. This removes recurring layout pressure but was not, by itself, the large freeze: individual baseline Layout/Style/Paint tasks peaked at 3.06/2.85/0.61 ms (after: 4.69/4.14/0.83 ms, with more frames rendered).

Other scoped changes:

* Separate retained opaque/fading crate materials allow fade shader preparation without mutating the active material's transparency mode.
* A finite, cancellable idle queue submits one presentation shader layout per turn after Start on devices supporting `KHR_parallel_shader_compile`, then polls readiness before uniform reflection. Without that extension it skips speculative shader submission entirely: exploratory software-renderer runs did not demonstrate a consistent benefit. Destroyer and artillery construction still move to separate idle turns; on-demand rendering remains valid if gameplay reaches them first.
* Explosion instance colors exist before shader preparation. Existing explosion, scorch, Giant and casualty pools are retained; no effect counts, geometry, resolution or intensity were reduced.
* Grenade/rumble buffers are prepared in 2,048-sample chunks after audio activation. Their deterministic sample arrays are unchanged. Baseline first-use generation cost roughly 10–12 / 3–4 ms, much smaller than the large GPU stalls. Buffers survive Retry; unfinished work cancels on disposal. An unusually early cue still uses the existing synchronous fallback.
* Preparation is presentation-only, never awaited by gameplay, and cancels/restarts on WebGL loss/restoration. No simulation, balance, RNG, public artwork/recording or content-addressed asset path changed.

Observer communication now freezes the visual available at presentation: both decoded expressions normally; one decoded image for both expressions; otherwise a self-contained Command Blue radio/shield SVG in the existing 110×110 breakout slot. A usable image no longer waits for the other decode. Audio readiness is independent of portrait success, with the same bounded intro deadline and offset-zero start. Missing portraits cannot suppress subtitles or a Destroyer warning. Late assets cannot pop into a running sentence.

## Matched crate measurements

Chrome 154, Windows, headless SwiftShader, DPR 2, 350×844 / 390×844, CDP 4× CPU throttling. Gameplay network was local/unthrottled. The same QA instrumentation ran against the exported immutable baseline and current source. Each fixture had its first opening plus two repeated openings in the same page. A fresh browser was used per before/after suite; GPU caches can warm across fixture groups, so only the first group represents a fresh browser shader cache.

Window: 250 ms before `grenadeSupplyOpened` through 1,800 ms after it. Units below are ms. Counts are frames strictly exceeding 50/100/200 ms, not frame-rate estimates.

| Viewport / fixture | First longest, before → after | First counts >50 / >100 / >200, before → after | Repeated longest range, before → after | First max JS callback, before → after |
|---|---:|---|---|---:|
| 350 / CRATE3 | 550.0 → 166.7 | 11/5/2 → 17/3/0 | 66.7–83.4 → 66.7–83.3 | 352.6 → 135.2 |
| 350 / CRATE8 | 133.4 → 116.6 | 9/2/0 → 5/1/0 | 50.1 → 50.1 | 143.4 → 115.6 |
| 390 / CRATE3 | 150.0 → 150.0 | 15/1/0 → 12/1/0 | 66.7–66.8 → 66.7–66.8 | 148.8 → 145.3 |
| 390 / CRATE8 | 150.0 → 133.3 | 10/2/0 → 7/1/0 | 50.1 → 50.1–66.8 | 136.8 → 121.4 |

All 12 after windows had zero frames above 200 ms. The fresh-browser CRATE3 result was also reproduced in exploratory runs: baseline 550–600 ms versus 150–167 ms with the reward/aircraft fixes. Repeated frames vary and are not uniformly faster; these are small samples, not statistical guarantees of a particular mobile frame rate. In the first repeated opening, median frame intervals stayed about 50 ms except 350/CRATE8 (50→33.4 ms); median JS callbacks were 10.2–13.0 ms before and 10.2–14.3 ms after. A remaining first crate-fade draw costs about 100–130 ms on this software renderer.

The first CRATE3 opened at simulation/presentation 2.000 s/2,000 ms in both runs. Raw frame records retain wall, simulation and presentation timestamps. Existing long-frame clamping means a long wall-clock gap need not advance either game clock by the full gap. No simulation timestep or animation delay was changed. JS callback measurements include synchronous WebGL waits; nested trace categories must not be summed as independent CPU costs.

## Other effects and remaining risk

Additional first/repeated fixture traces used the same 350×844, DPR 2, 4× CPU profile and fixture order in fresh before/after browsers. These cover the entire fixture observation window (including ordinary firing and ambient effects), unlike the narrower crate-event window above:

| Fixture | First maximum before → after (ms) | Repeated maximum before → after (ms) |
|---|---:|---:|
| Grenade / scorch | 283.4 → 383.4 | 83.3 → 100.0 |
| Destroyer | 483.4 → 316.6 | 83.3 → 50.0 |
| Artillery | 266.7 → 383.3 | 50.0 → 33.5 |
| Level Up / MG evolution | 366.8 → 383.4 | 83.3 → 100.0 |
| CURVE combat | 350.0 → 433.3 | 83.3 → 83.4 |

These first-use results are mixed, **not evidence that all Stage 1 stalls are eliminated**. Most first samples were worse; repeated samples all remained below 200 ms. Shader-cache state and which early firing work falls inside the recorded window vary. An earlier baseline audit also ranged up to 433 ms in these fixtures. Exploratory speculative compilation did not consistently improve these results and is excluded on this unsupported renderer in the final implementation. Synchronous shader diagnostics/first draws dominate the longest callbacks. Nonblocking shader preparation is unit-tested but its benefit on a supported phone GPU remains unmeasured.

An additional test-side snapshot made 45 Grunts, 3 Heavies and 1 Giant lethal to one grenade, exercising Giant appearance/death, Heavy death, blast/scorch and a major casualty burst without altering shipping HP. Before → after first maxima were 316.7→350.0 ms at 350 px and 300.0→316.7 ms at 390 px; repeat maxima were 83.4→99.9 and 100.0→100.0 ms. Final first windows still had 2/4 frames above 200 ms respectively; repeated windows had none. Lethal events for all three archetypes were asserted. These remaining first-use driver stalls are explicitly unresolved; no quality reduction or blocking startup warm-up was introduced to hide them.

The broad audit found first-use shader reflection/driver waits in tracers, frozen enemy bodies, blood/stains and artillery smoke. Existing meshes/effects are mostly pooled; custom shader first visibility, rather than new asset downloads or large event handlers, dominates these traces. Incremental preparation cannot guarantee zero stalls when an effect is triggered before preparation finishes or when the driver lacks nonblocking completion queries. Three r180 program readiness/reflection access is version-specific and covered by lifecycle smoke tests; revisit it when upgrading Three.

No physical device was available in this session. Desktop CPU throttling and SwiftShader do **not** measure phone GPU performance, browser audio output latency or thermal behavior. The original phone's roughly 500 ms symptom was reproduced in this controlled browser path, but physical-device confirmation of the fix remains necessary.

## Startup regression

Production build, three cold/warm pairs per width, 150 ms latency, 1.6 Mbps down / 750 Kbps up, 4× CPU, DPR 2. Same cache policy/profile as the baseline. Navigation-to-Tap-to-Start medians (range), ms:

| Width/cache | Before | After |
|---|---:|---:|
| 350 cold | 3934.8 (3916.5–3965.9) | 3941.8 (3919.3–3957.2) |
| 350 warm | 1910.0 (1904.2–2133.5) | 1979.4 (1850.6–2021.7) |
| 390 cold | 3947.4 (3943.3–3964.0) | 3939.3 (3869.8–3967.3) |
| 390 warm | 1874.9 (1753.0–1955.2) | 1932.9 (1756.2–2283.4) |

Tap-to-interactive medians before → after: 350 cold 65.7→63.4, warm 63.6→59.0; 390 cold 58.8→58.4, warm 67.8→60.5 ms. Eight requests remain; cold transferred resource bytes 478,624→480,384, warm zero. Public asset hashes are unchanged. Cold medians are essentially unchanged; warm medians are 3–4% higher with overlapping ranges, so this small sample does not establish a significant startup regression. These transfer totals exclude the navigation document and include the QA-instrumented production bundle.

## Validation and evidence

Passed: full suite **148 files / 1,059 tests**, typecheck and production build. An intermediate rerun accidentally discovered the profiling baseline's copied tests and timed out under concurrent browser load; that generated duplicate test directory was removed and the suite passed in isolation. Existing Rollup/Zod annotation and bundle-size warnings remain.

Passed browser checks at 350×844 and 390×844: CRATE3/CRATE8 destruction stages, unchanged transfer curve/108 px peak/destination alignment, grenade blast/Heavy and Giant reactions/scorch, Pause/Resume/Retry, snapshot restore, Destroyer entrance/communication/fire/exit, artillery dodge/hit/death, and normal portrait expression/composition with 0/34 px insets. Additional checks passed for denied audio/storage, both-portrait fallback during Destroyer speech, resizing mid-transfer, WebGL restore and disposal. Production tests covered natural Lv1–8 progression, Legacy Mode, deterministic 120-tick snapshot continuation, `/topwar/` hashed assets, no duplicate models and exclusion of DEV/QA hooks. All ten final production Observer scenarios passed: normal at both widths, delayed/late/hung decode, either/both images missing, one image still pending, and missing audio. Available speech began at offset zero; unavailable speech stayed subtitle-only, without late playback.

Reproducible QA scripts are under `scripts/qa/`; profiling hooks are injected by QA and absent from the shipping bundle. Generated evidence is locally retained under `artifacts/p3b31/` (Git-ignored):

* `before-final/` and `after-final/`: summary JSON, raw frame/call records, Chrome `.trace.json` files for all 12 crate runs; load traces in Chrome Performance or Perfetto.
* `audit-matched-before/`, `audit-final/`, `casualty-before/`, `casualty-final/`: other first/repeated effect traces, including remaining shader stalls.
* `startup-before/`, `startup-final/`: all 12 startup samples and screenshots each.
* `crate-browser/350-crate3.webm`, `390-crate8.webm` (plus the other two combinations): short reward/blast recordings with audio and extracted frames.
* `observer-final/`: normal intro recordings, all portrait/audio failure screenshots and results.
* `observer-composition/`: normal Traditional Chinese intro and Destroyer screenshots at both widths, inset 0/34.
* `extra-final/`: fallback Destroyer screenshots, exact aircraft pixel comparisons, resize/safe-area/context/disposal results.
* `modes/`, `production-final/`, `artillery/`, `naval/`, `lifecycle/`: regression results and browser captures.

Frozen tag remains `playtest-2026-10-08` → `59136b49e1328ab754412f7affe90c755c76c0fd`. No deployment or P3-C work.
