# P3-B.6B.7 — Naval rhythm, minimal warnings, FPS and Grenade reserves

Implementation commit: `3ef95bcf72ec8f4c26f97e1352dd14320e42d0ac`.
Starting commit: `e5006d0b09b9f5f407b305e065e5734d61f1c7c5`.
QA scripts and this report are delivered in a subsequent commit. No deployment was performed. The frozen `playtest-2026-10-08` tag remains `59136b49e1328ab754412f7affe90c755c76c0fd`.

## Shipping changes

- Post-impact quiet gaps now use continuous uniform naval RNG samples from 2–5 seconds. The first firing delay remains two seconds after the 1.3–8.5-second Observer window: first natural salvo at MG Evolution +10.5 seconds. Carnival ends at +24; Survival starts at +27, with its first wave at +28. Persistent naval presence and independent enemy scheduling are unchanged.
- Overhead warnings are simple red exclamations. Triangle, outline and ivory badge materials are removed. No ground warning circles render for current Stage 1.
- Grenade inventory has no gameplay maximum. The teaching reward is still +3, recurring Supplies still +1, and throwing still consumes one charge with one flight at a time.
- Local DEV FPS uses bold 14px ivory text immediately right of the quiet hatch, without backing, border or padding. RAF measurement, update frequency and pause/sleep resets are unchanged. Shipping retains its restricted QA hatch and excludes local DEV FPS, tuning and fixtures.

All other shipping balance fields compare identical to the starting configuration after excluding only the teaching-field rename and post-impact cooldown object. AHEAD, MG6–10, enemy HP/speeds, artillery collision/damage/flight, Golden Grenade feedback, Observer recordings/art and accepted Ink Spear rendering were not retuned.

## Naval timing and determinism

```json
"postImpactCooldown": {
  "initialDelaySeconds": 2,
  "minimumGapSeconds": 2,
  "maximumGapSeconds": 5
}
```

`quietGap = minimum + navalRng.nextFloat() * (maximum - minimum)`. One draw occurs when the final owned shell resolves, including explicit last-shell cancellation. The saved cooldown records its actual resolution time, sampled gap, deadline and RNG state. Waiting does not redraw. Capacity/absent opportunities remain deterministic consumed skips, with no partial launch or backlog. Stop/restart retains the existing independent component contract.

The five seeds 1, 17, 42, 99 and 2026 were run with natural and isolated Lv8/9/10 combat, competent/600ms slower/fixed-lane policies, barrage on/off: **120 runs**, **16,051 periodic deterministic state comparisons**, plus matching input/event checks every tick. Runs stop after 180 seconds of Survival or real Game Over; fixed-lane natural pilots died before Survival. No survivability tuning was applied.

Across **1,033 measured impact-to-next-launch intervals**:

| Measurement | Result |
|---|---:|
| Saved sample minimum / maximum | 2.001492 / 4.963049 s |
| Actual launch-gap minimum / maximum | 2.013454 / 4.965863 s |
| Samples in [2,3) / [3,4) / [4,5) | 359 / 353 / 321 |
| Largest fixed-tick quantization error | 0.016561 s |
| Peak active shells | 2 |

Example sampled → actual gaps: **3.338853 → 3.346787**, **2.884514 → 2.896787**, **4.315279 → 4.316667**, **2.872016 → 2.880121** seconds. Unit tests additionally sample 1,000 successive salvos per seed and verify range coverage, noninteger samples, exactly one RNG advance, fixed-tick quantization, saved deadlines, invalid ranges, cancellation, capacity skipping and no catch-up burst.

Natural competent runs provide context, not a balance acceptance gate:

| Seed | Survival activation | End time | End level / soldiers | Peak Survival enemies | Salvos |
|---:|---:|---:|---:|---:|---:|
| 1 | 121.917 | 263.533 | 10 / 0 | 180 | 29 |
| 17 | 121.183 | 269.733 | 10 / 0 | 179 | 32 |
| 42 | 122.650 | 302.650 | 10 / 3 | 174 | 34 |
| 99 | 121.267 | 301.267 | 10 / 3 | 174 | 35 |
| 2026 | 120.433 | 243.767 | 10 / 0 | 180 | 26 |

Times are absolute simulation seconds. Zero soldiers means actual Game Over; surviving runs are censored at the diagnostic limit.

## Warning and FPS evidence

The warning uses one eight-slot InstancedMesh, one glyph geometry/material, preallocated instance colors and opacity. The alpha attribute and fixed shader layout are allocated before existing bounded idle shader preparation. There are no new textures or per-shell/per-frame objects. Compared with the previous badge, two warning draw calls and its triangle geometry are removed.

Lane anchors remain `(-target.x × 0.72, 2.05, target.z)`, billboarded toward the camera. Each lane selects its earliest active impact and that shell's launch time. Smooth opacity rises from 0.15 to 1 with increasing red saturation. Final 150ms uses full danger red, alpha 1 and a 1.10–1.38 scale punch; it never blinks off. Simulation time freezes urgency during Pause. Same-lane threats remain until the last shell resolves; lane movement does not move warnings.

Browser checks at both widths passed full-flight warning presence, zero ground warnings, stable lane anchors, individual cancellation, paused/hidden freezing, exact Continue restoration and no replayed muzzle flash. Separate QA-only authoritative launches demonstrate materially different lane deadlines without changing Stage 1's one-unresolved-salvo policy.

Evidence is under ignored local `artifacts/`; it is not bundled or committed. Captures precede the implementation commit and therefore show the starting SHA in the footer, while rendering the implemented changes.

| Evidence | Before | After |
|---|---|---|
| Native 350px early warning | `artifacts/p3b6b6/mobile/350-warning-early.png` | `artifacts/p3b6b7/sleep/350-warning-early.png` |
| Middle / final150 / pulse, both widths | B.6 mobile warning captures | `artifacts/p3b6b7/sleep/{350,390}-warning-{middle,final150,pulse}.png` |
| Distinct lane deadlines | — | `artifacts/p3b6b7/warnings/{350,390}-independent-deadlines.png` |
| FPS | `artifacts/p3b6b6/dev-review/{350,390}-combat-10-on.png` | `artifacts/p3b6b7/dev/{350,390}-combat-10-on.png` |
| Complete flight recordings | `artifacts/p3b6b6/lane-warnings/{350,390}-warning-lifetime.webm` | `artifacts/p3b6b7/warnings/{350,390}-warning-lifetime.webm` |
| Golden Grenade audio/video | Existing accepted feedback | `artifacts/p3b6b7/golden/{350,390}-{crate3,survival8-ahead,survival10-ahead}.webm` |

Native 350×844/390×844 warning phase captures are in `sleep/`; the independent-deadline captures use DPR2 at the same CSS viewports. Frame-level warning data and colors/alphas are retained alongside recordings.

## Grenade accounting and migration

Shipping `grenade.teachingGrantAmount: 3` replaces the misleading `capacity` name. Older configurations with `capacity` remain readable as teaching-reward aliases, without imposing any maximum on inventory. Conflicting aliases are rejected. Historical destruction stages/hit requirements and current stored inventories are retained.

Inventory validation accepts only nonnegative safe integers, through **9,007,199,254,740,991**. Checked addition compares the requested reward against `MAX_SAFE_INTEGER - inventory` before adding. If the whole reward cannot be represented, the crate is consumed, inventory remains exact, and **no acquisition event, transfer or reward sound is emitted**. This is a numeric boundary, not a gameplay capacity. Acquisitions report actual awarded amount; teaching +3 and recurring +1 remain exact.

Recurring Supply opportunities no longer check inventory. They still require the teaching encounter to have started, skip occupied crates, keep the authored 30-second cadence and never bank skipped slots. This intentionally changes future Supply eligibility in old restored games too; their serialized naval/Survival clocks and balance profiles are not reauthored.

Verified accumulation: **0→1→2→3→4→5**, **19→20**, **20→throw→19**, **19→Supply→20**, consecutive acquisition to **21**, and +1 at inventory **1,000**. Existing damaged crates and acquisition during an airborne Grenade retain deterministic accounting. Teaching +3, empty/blocked throws and exactly-once launch/impact feedback pass.

Counts below 10,000 display exactly, including 20/50/99/100/1,000. Larger displays use bounded K/M/B/T/Q notation; accessible labels always announce the exact integer. The icon/button layout remains unchanged. Final browser count tests from 3 through MAX_SAFE_INTEGER retain **four button children**, **175 scene draw calls**, constant **63 geometries** at both widths, and **nine textures**. Badge widths were 26px for one/two digits, 30.4px for 100 and 37.8px for 1,000, with no adjacent-control overlap.

Obsolete capped assertions were replaced with accumulation, overflow and high-inventory Supply assertions in Grenade, Supply destruction/hit and Survival tests. Current browser helpers verify actual awards instead of a fixed full reserve. The historical teaching-reward comparison script now labels its counterfactual correctly. Unrelated regression tests were retained.

## Snapshot, checkpoint and lifecycle results

No snapshot/checkpoint version bump was required. Optional continuous range fields coexist with historical discrete `gapsSeconds`; mixed/reversed/nonfinite ranges are rejected. Historical discrete 0/1/2/3 schedules and older launch-based, five-shot/timed-retreat, sequential/concurrent and eight/ten-level configurations retain saved timing. The B.6 configuration is now an explicit regression fixture.

Exact JSON/checkpoint restoration passed for counts 4/20/50/100/1,000/MAX_SAFE_INTEGER, followed by identical fixed-tick continuation. Reload during flight preserves remaining inventory and does not replay a throw. Normal and Legacy Continue/Pause/Retry passed at both widths; Retry/New Game retain fresh-reset semantics.

The shipping sleep test prepared a real seed-42 scene at **61 seconds**: **112 enemies (45 Heavies), 48 projectiles, two shells, three soldiers**. Full checkpoint: **38,698 UTF-8 bytes**, measured unthrottled write approximately **0.3ms**. The changed cadence moved readiness past the previous 60-second preparation bound, so the QA-only bounded preparation window is now 90 seconds; no gameplay balance or synthetic crowd was changed.

Save/Continue restored identical paused state. Controlled hidden/visible, pagehide/pageshow, freeze/resume and actual `WEBGL_lose_context` restoration passed. Wake Lock mocks confirmed released sentinels, suppression during the sleep test and explicit-resume reacquisition, including denied/unsupported/insecure cases. These tests do not reproduce Android tab discard or certify its screen timeout.

## Performance and payload

Matched harness: Chrome/SwiftShader, DPR1, 350×844/390×844, 4× CPU throttle, seed42, adjacent decisions every 200ms avoiding locked artillery lanes, real 81Hz MG fire, no Grenades/invulnerability/quality reductions. B.6 retained artifacts provide the previous baseline. New runs were serial with no competing benchmarks; one run per viewport/profile, so the comparison is descriptive, not a statistical significance claim. Different naval cadence and Supply eligibility also change combat populations.

| Profile | Mean ms before→after | p95 before→after | Max before→after | >100 before→after | >200 before→after |
|---|---:|---:|---:|---:|---:|
| 350, warmed 90s | 75.56→68.72 | 116.7→116.7 | 300.1→283.3 | 197→146 | 3→3 |
| 390, warmed 90s | 75.31→67.72 | 116.7→116.6 | 283.3→283.3 | 206→110 | 2→1 |
| 350, fresh 10s | 43.97→39.74 | 83.3→66.6 | 350.0→383.3 | 8→6 | 2→2 |
| 390, fresh 10s | 44.32→44.52 | 83.4→83.3 | 366.6→366.7 | 8→7 | 2→2 |

Warmed peak enemies fell 173→167, with 107 projectiles and at most two shells in both versions. Sampled peak draw calls were 306/307→310/309; triangles 515,773/515,787→483,910/484,324. Projectile pool remains 128; artillery capacity remains eight. Geometry/texture counts plateau from approximately 30 seconds through 90 at **117/12**, versus **115/12** previously. The warning removes one geometry; newly eligible Supplies exercise the crate's three existing shared geometries. No per-wave or per-inventory resource growth was observed. Frozen sleep-scene resource counts also plateaued; its timings were recorded during functional QA and excluded from the matched comparison.

Fresh attribution repeats showed >200ms submissions before any warning was visible, including dense-scene initialization and presentation preparation. First visible-salvo submissions were **105.1/51.7ms** at 350/390 under 4× CPU throttle. Direct compile/link calls were ≤0.3ms in primary runs; this does **not** measure deferred driver/GPU completion. The trace repeat at 390 had three >200ms intervals versus two in its primary fresh run, demonstrating variance. There is no claim of hitch-free software rendering or proof that warning preparation contributes zero cost.

Harness startup stopwatches were approximately **1.53–1.62s**, versus **1.47–1.60s** in B.6. This is local, unthrottled networking, not a physical-phone Cold/Warm startup study. Critical asset loading is unchanged; no new assets or requests were introduced. `/topwar/` content-hash URLs, the one initial Defense GLB request, unchanged portrait/voice bytes and absence of duplicate requests passed shipping smoke checks.

Committed-implementation production JS: **1,193,420 raw / 327,007 gzip bytes**, compared with B.6 **1,192,166 / 326,758**: +1,254 raw / +249 gzip. CSS: **33,019 / 7,456**, +68 raw / +28 gzip. Existing large-chunk build advisory remains. Restricted shipping QA is unchanged; unrestricted DEV/FPS/lifecycle diagnostics and response-injected QA globals are absent from the bundle.

## Verification and physical review

- Full suite: **1,296 tests / 170 files passed**; typecheck and production build passed.
- Both mobile widths: production smoke/assets, real Lv8/9/10 artillery, whole-flight recordings, cancellation/restoration, retained DEV presets/FPS, large-inventory HUD and rewards, in-flight reload, normal/Legacy recovery and shipping sleep lifecycle passed.
- Six real Grenade audio/video scenarios: one successful launch cue, one explosion, blocked inputs silent, no extra asset requests, and no replay on in-flight recovery.
- Reusable metrics, recordings and screenshots: `artifacts/p3b6b7/`; QA commands are under `scripts/qa/`, with explicit output-directory arguments retained.

Pixel 8 still needs review of the subtler early warning versus the final 150ms punch, the perceptibility of the continuous quiet gaps, accumulated Grenade counts during normal play, and actual HTTPS sleep/Continue behavior. Desktop software rendering cannot certify phone GPU performance, Android's 15-second timeout, process recreation or tab discard. No additional difficulty mitigation, repository cleanup, art, Giant Air Drop or Tank Boss work was started.
