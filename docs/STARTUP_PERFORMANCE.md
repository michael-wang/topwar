# Startup performance

Measured 2026-10-17 against `0a2b104` and the single flower-texture optimization. **Desktop diagnostics, not physical Pixel 8 results.** The approved loading cover, four real milestones, recovery protection and audio gesture are unchanged.

## Method

Local production Vite previews at `/topwar/`; Windows Chrome 155.0.8059.80, headless SwiftShader, touch viewports 350×844 and 390×844, DPR 2. Five cold/warm pairs per version, size and CPU condition; alternate before/after order. Cold means cleared HTTP cache in a fresh browser context, not a restarted OS/browser/GPU. Warm follows a genuine load in that context; an intervening blank page lets prior WebGL teardown finish outside the measured navigation. Resource Timing confirms cold JS transfer versus warm cache revalidation. No response interception, artificial network prewarming or bandwidth throttle was used in these timing runs.

Read real progress-value changes, navigation/resource timings, FCP and long tasks through browser-only instrumentation. Start-ready means the cover is removed, the viewport is no longer inert and the Start button exists; two further animation frames check presentation. Separate diagnostic CPU profiles locate expensive functions. Phase intervals include paint yields/queueing and are not pure CPU timers. No instrumentation ships.

## Baseline bottleneck

Representative baseline 390×844 cold medians, native desktop CPU:

| Phase | Time / interpretation |
|---|---|
| HTML response / cover | Response complete 2ms; cover DOM 7ms; first contentful paint 36ms from navigation. |
| JS transfer / initialization | ~311kB gzip (~1.13MB decoded); resource duration 25ms, then ~17ms to startup status. Parsing may overlap download. |
| Configuration / level | 27ms stage interval, including processing/queueing; actual parallel JSON requests take ~3ms locally. |
| Character families | 45ms including the preceding paint yield; synchronous procedural geometry, no GLB download. |
| GameApp / renderer | 226ms including a short paint yield. WebGL context creation itself ~3ms; substantial work is CPU-side scene/texture construction. |
| Start installation / final handoff | ~23ms setup/layout, then ~115ms first render/cover handoff. Shader/driver work is significant under SwiftShader. |

The actionable bottleneck is synchronous renderer construction. `flowerSpeckTexture()` alone accounted for ~92ms self time in the diagnostic profile: every atlas pixel recomputed the same petal trigonometry and distances even far outside every blossom. First-frame shader work is a separate remaining cost. Local data transfer is not the dominant measured delay; real Pages/mobile networking may differ.

## One optimization and results

Precompute four petal offsets and skip pixels outside each blossom's conservative zero-alpha bounds. Keep original visible-texel arithmetic, dimensions, colors, filtering and ownership. A regression verifies **all 65,536 RGBA bytes match the accepted texture exactly**. No deferred work, cache, loading-stage change or gameplay/art change is introduced. Native renderer-construction intervals fall from 226–229ms to 138–139ms cold, and 211–213ms to 127–130ms warm.

Navigation → usable Start, **median [min–max] milliseconds**, five runs per cell:

| CPU | Viewport | Cache | Before | After |
|---|---|---|---|---|
| Native | 350×844 | Cold | 493 [486–692] | 496 [454–535] |
| Native | 390×844 | Cold | 485 [483–492] | 489 [434–539] |
| Native | 350×844 | Warm | 704 [668–753] | 661 [624–682] |
| Native | 390×844 | Warm | 715 [671–739] | 640 [572–669] |
| 4× CPU slowdown | 350×844 | Cold | 2020 [1936–2117] | 1664 [1622–1706] |
| 4× CPU slowdown | 390×844 | Cold | 1994 [1936–2027] | 1658 [1638–1678] |
| 4× CPU slowdown | 350×844 | Warm | 1921 [1836–2010] | 995 [973–1386] |
| 4× CPU slowdown | 390×844 | Warm | 1904 [1777–1937] | 1000 [981–1019] |

Native cold end-to-end improvement is **not established**; the saved CPU time is masked by variable first-frame/driver scheduling. Native warm improves 43–75ms. The CPU-bound case demonstrates an actual cold-ready improvement of 336–356ms (~17%), rather than a changed progress animation. Warm runs have a longer first-render/handoff interval despite smaller network transfer; the exact driver/context cause was not isolated. This does not establish phone cache behavior.

Three additional native-speed saved-session pairs per size/cache preserve the immediate protected Continue choice: cold medians 83–87ms before / 82–84ms after; warm 33–34ms / 34–35ms. Choice latency is essentially unchanged. Continue selection → paused usable battlefield improves cold medians 735–745ms → 659–661ms. Warm medians improve 1414–1435ms → 1011–1054ms, but ranges overlap substantially (including an after outlier of 1703ms); do not treat that as a reliable phone speedup. User decision time is excluded; the existing quiet-input guard is retained.

## Validation and remaining checks

106 focused coastal/startup/GameApp/checkpoint/GIANT tests, typecheck and production build pass. Production browser checks cover honest milestones, fresh Start, valid/invalid saves, Continue/New Game, Retry, slow/failed resources, timeout/Reload, historical automatic support, ordinary manual support, four entries, `/topwar/` assets and DEV exclusion. Local evidence and repeat scripts are under ignored `artifacts/p4.31/` (`comparison-native.json`, `comparison-cpu4.json`, `recovery-comparison.json`, startup and production checks); no profiling framework was added to the repository.

SwiftShader, desktop CPU throttling, loopback bandwidth, warmed OS/process caches and a small ordinary checkpoint do not model Pixel 8 hardware, mobile networking or large late-game saves. Measure real phone cold/warm navigation, first Start tap, immediate Commander playback and early combat smoothness on the owner's normal origin, plus a late-game Continue. The owner has since accepted the loading feedback and four-stage bar on Pixel 8 (#21 PASS); performance measurements on the physical phone remain pending. No Pages deployment, frozen-tag movement, further optimization or opening/fullscreen implementation belongs to this pass.
