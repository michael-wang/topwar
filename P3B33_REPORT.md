# P3-B.3.3 — mobile projectile variant review

Baseline: `79c6bf33644f0451523617e3e6f24d9f9d815369`. This is an evaluation build, not a final projectile selection. P3-B.3.2's visual direction remains rejected.

## Phone review

Open the in-game **DEV** panel and tap **P1**, **P2**, or **P3**. The panel shows `TRACER: Pn`, highlights the active button, and closes after selection so combat is visible immediately. Buttons are 48 CSS pixels high. The choice survives fixture changes, Pause/Resume, Retry, and snapshot restores until the page reloads; P1 is the DEV default.

| Variant | Appearance |
|---|---|
| P1 — Ivory dart | Broad warm ivory/yellow body, strong near-black outline, pointed head and tail; shortest of the three. |
| P2 — Red tracer | Saturated orange-red body, near-black outline, longest pointed tracer. |
| P3 — Ink spear | Dominant near-black silhouette, narrow and shorter warm-white core, long tapered tail. |

Quick entries: **LV1 RIFLE** (ordinary authored Lv1 with a fixed review seed), **GRENADE** (Lv3 Rifle), **MG** (Lv6), and **MG8** (Lv8). Existing CURVE/EVOLVE/MG7 reviews remain available. Start with LV1 RIFLE; switching the variant does not restart the run.

The selector, presets, and pointed geometry are DEV-only and absent from production bundles. Production retains the fixed ivory/navy tracer pending the phone decision. Level Up no longer changes projectile color, glow, size, opacity or blending in either mode. XP/soldier feedback, firing cadence and progression remain intact.

## Implementation

Two pooled instanced batches and existing basic materials remain. All variants share a six-vertex/four-triangle pointed shape; no textures, asset downloads, postprocessing, per-shot meshes or per-frame scratch allocations were added. Selection changes parameters on the existing renderer. Renderer disposal owns the review geometry; Retry retains it.

The initial camera-facing experiment clipped longer tails against the sand. Review tracers now follow the travel plane at muzzle height, with a bounded perspective length calculation. Heads remain anchored and tails extend behind shots. Depth testing and the ordering beneath enemy HP indicators remain. World-space limits prevent horizon scaling and muzzle tails through the squad.

No simulation, collision, balance, RNG, public asset, observer/audio, asset-loading, supply-transfer or cache-versioning source was changed. Legacy ordinary geometry, color and transforms remain unchanged.

## Browser evidence

Local output: `artifacts/p3b33/visual/` (ignored by Git; regenerate with `node scripts/qa/projectile-variants.mjs`). Each variant has screenshots at Lv1/3/6/8 plus a short recording at both 350×844 and 390×844:

- `P1-350.webm`, `P2-350.webm`, `P3-350.webm`
- `P1-390.webm`, `P2-390.webm`, `P3-390.webm`
- `P{1,2,3}-lv{1,3,6,8}-{350,390}.png` and control-panel captures.

Captures show intact pointed silhouettes and readable enemy HP bars at Lv8. Distant MG shots can form a dense trail, especially P3; this is a phone-review tradeoff, not a selected final direction. Recordings are visual evidence, not performance samples. All six recordings were decoded and seeked at 2 and 10 seconds. Captures were made before commit, so their build label still shows the baseline SHA.

## Validation and measurements

Chrome on Windows uses SwiftShader; mobile viewport emulation and 4× CPU throttling do not measure a physical phone's GPU or touch/display experience.

Lv8 benchmark: DPR 2, seed 17, real RAF, 2.5 seconds warm-up then six seconds sampled, three runs per viewport/presentation, no recording or concurrent browser workload. The baseline freezes the `79c6bf3` projectile modules, with the current DEV UI mounted and inert. All runs retain approximately 54 shots per simulation second.

| Presentation | 350 px mean frame ms (run range) | 390 px mean frame ms (run range) | Projectile update CPU ms, 350 / 390 |
|---|---:|---:|---:|
| Rejected baseline | 20.84 (20.76–20.99) | 22.33 (22.18–22.41) | .169 / .168 |
| P1 | 20.31 (19.43–21.01) | 22.47 (22.41–22.52) | .203 / .237 |
| P2 | 20.51 (20.42–20.55) | 22.83 (22.35–23.46) | .210 / .189 |
| P3 | 21.60 (21.52–21.68) | 24.11 (24.06–24.16) | .191 / .186 |

All p95 frame intervals were 33.4 ms. One P2/390 sample reached 66.6 ms; no sampled combat frame exceeded 100 or 200 ms. Other maxima were 33.4–33.5 ms. No shader programs were added within any sampled window; both layers shared the same basic-material program. First-draw driver times varied from 1.9 to 74.4 ms for the variants versus 7.6–8.9 ms for the baseline (single observations, not a physical GPU comparison).

P3's initial 390 px series averaged 1.78 ms / 8% slower than baseline despite only .019 ms more projectile JS. A reverse-order recheck (P3 then baseline, three runs each) did not reproduce that difference: **P3 22.55 ms (22.49–22.66), baseline 22.61 ms (22.49–22.75)**; both had 33.4 ms p95, 33.5 ms maximum and zero frames over 50 ms. Recheck projectile CPU was .223 versus .173 ms. The initial difference cannot be confidently attributed to the variant; both series are retained. Physical-phone density and GPU cost still require review. Raw samples: `artifacts/p3b33/performance/`.

- Full suite: **150 files / 1,071 tests passed**.
- Typecheck and production build passed. Existing Zod annotation and large-chunk build warnings remain.
- Projectile and DEV controls tests cover ownership/disposal, pooling, bounded presentation, tail placement, live selection and ordinary Lv1 initialization.
- Mobile browser checks verify every variant at Lv1/3/6/8, unchanged simulation state across switching, stable projectile matrices/materials through a Level Up event, and selection persistence across Pause/Retry/snapshot restore.
- Production checks at both widths pass: normal Lv1–8 progression, retained Legacy Boss mode, Pause/Resume/Retry, deterministic 120-tick snapshot continuation, `/topwar/` content-addressed asset URLs, one Defense GLB / thirteen Legacy GLBs without duplicates, and no DEV controls/presets in shipping JS.
- Runtime readiness checks at both widths pass: Observer fallback with available voice, NAVAL communication, supply-transfer alignment after resize/safe-area changes, unchanged aircraft pixels, WebGL loss/restoration, Retry and disposal. No browser errors.

Production startup was remeasured sequentially against a frozen baseline build, with QA-only marks, 150 ms network latency, 1.6 Mbps throughput, DPR 2 and 4× CPU throttling. Three cold and three warm navigations per width:

| Navigation → Tap-to-Start, median | Before | After |
|---|---:|---:|
| 350×844 cold | 3.738 s | 3.717 s |
| 350×844 warm | 1.824 s | 1.888 s |
| 390×844 cold | 3.700 s | 3.695 s |
| 390×844 warm | 1.849 s | 1.857 s |

Before cold range 3.697–3.779 s / warm 1.647–2.079 s; after cold 3.665–3.734 s / warm 1.798–2.240 s. Tap→interactive after ranged 20–84 ms. Both builds made eight resource requests; warm transfer was zero bytes. Cold measured transfer changed from 481,132 to 481,266 bytes (+134 bytes in the instrumented JS); public asset hashes were unchanged. Every after run had zero blank Observer frames, one intro voice starting at offset zero and a ready portrait. No significant startup regression was observed. Raw results: `artifacts/p3b33/startup-before/` and `startup-after/`.

An additional 350×844 / DPR 2 / 4× CPU crate regression trace retained P1. First/repeated opening maxima: CRATE3 **149.9 / 83.3 / 66.7 ms**; CRATE8 **150.0 / 50.1 / 50.1 ms**. No frame exceeded 200 ms, no asset requests occurred, and each transfer initialized once in .2–.4 ms with one bounds measurement. The first-open residual was the existing fading crate-strap shader draw (130–144 ms, dominated by shader/program diagnostics), not projectile work or network loading. This software-renderer path and the accepted preparation guard remain unchanged. Traces: `artifacts/p3b33/crate-regression/`.

No deployment or frozen-tag change is part of this task. No P3-C work was started.
