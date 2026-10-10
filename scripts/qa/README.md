# Stage 1 P1 MG progression

With Vite running, `node scripts/qa/mg-progression-sanity.mjs` checks real kill-driven Lv6/7/8 upgrades at 390×844 and 350×844, one/two/three rendered MG members, individual firing feedback, squad pips, XP cap, HUD bounds/overlap, Pause, touch, deterministic snapshot continuation and normal Retry. It uses a test-side app hook only; no new shipping fixture. PNGs and JSON go to ignored `artifacts/stage1-p1`. Existing browser runtime overrides below apply. Six-level cap expectations in historical reports/scripts are historical; use this check for P1 progression.

# Browser sanity

## Start presentation / control glyphs

`node scripts/qa/start-presentation-sanity.mjs` covers ten real/synthetic Start cases: mouse desktop and coarse, Enter/Space on coarse, touch at 390/350, pen, unknown/empty pointer and assistive click on fine-pointer. It asserts conservative default and mode before audio resolves, unboxed overlays, enlarged arrows, later A/D/Q/touch functionality, Pause and both normal/fixture Retry persistence. Captures/JSON default to `artifacts/start-glyph`. `START_GLYPH_REPORT.md` records current results.

## Final pre-release checks

`node scripts/qa/release-hud-sanity.mjs` checks 390×844 / 350×844 coarse-pointer and 1100×844 fine-pointer layouts: Start-derived A/D/Q overlays (actual mouse versus touch Start), no defense hint, settled acquisition pulse, charges 3→2→1→0 via the shared Q/button path, concurrent-flight blocking, snapshot with two reserves plus flight, flight Pause, invalid target preservation, normal Retry, only four review menu actions and QA-only CURVE/EVOLVE/MG selection. Captures/JSON default to `artifacts/pre-release/browser`.

`node scripts/qa/grenade-capacity-metrics.mjs` compares capacity 1 versus 3 with all other current values identical: seeds 1–50, normal and 1.8-second hesitation pilots, one adjacent lane step per 200ms and the existing crowd/emergency throw policy. It records every valid launch/detonation, per-throw kills/ordinary XP and pressure, Lv3/acquisition/Lv4 clocks, overflow, failures and unfinished flights through two seconds after Lv6. Duration averages exclude runs that fail before Lv4; those failures remain in the report. Outputs default to `artifacts/pre-release/capacity-metrics.json`. These are diagnostic policies, not human-play certification. See `PRE_RELEASE_REPORT.md` for results and mixed evidence.

## Combat HUD layout

`node scripts/qa/bottom-strip-sanity.mjs` checks visible movement / central XP / movement
layout at 390×844 and 350×844. Real Chrome CDP touch streams hold each arrow for 1.3 seconds,
reach the lane edge with the existing 180/120 ms repeat timing, retain held feedback,
release outside capture, and verify no duplicate tap, selection or scroll. It checks
touch cancellation, lost capture, blur, Pause, death and Retry cleanup, pre-start guards,
keyboard button activation, removal of invisible steering DOM/viewport taps, native
context/selection/drag default prevention, exact XP fill, real Lv5→Lv6 emphasis and
reduced-motion behavior. Captures/results default to `artifacts/bottom-strip`.
Chrome emulation does not certify physical iOS/Safari long-press or thumb comfort.

`node scripts/qa/combat-hud-sanity.mjs` checks the top-left DEV disclosure and all
four deterministic fixture resets, menu close/Escape/focus ownership, Pause,
lower-left icon/charge Grenade via Q/tap, lower-right transparent weapon telemetry,
all six authored pip stages, casualty-independent unlocks, real kill-driven Lv1→5
new-pip feedback, real Lv5→Lv6 silhouette pulse, QA-only CURVE/EVOLVE/MG selection, and synthetic safe-area
insets. It captures 390×844 and 350×844 ready/unavailable/empty/paused/menu/Rifle/MG states in
`artifacts/combat-hud`. Pair with `p15-browser.mjs` for actual supply acquisition
and burst XP, `audio-start-sanity.mjs` for real startup gestures, and
`production-sanity.mjs` for shipping DOM/bundle exclusion of the whole DEV menu.
`HUD_UI_REPORT.md` records the compact layout; `PRE_RELEASE_REPORT.md` records the final input/typography/three-charge pass.

## P1.5 Grenade and pressure

`node scripts/qa/grenade-review-sanity.mjs` uses the test-only **GRENADE** helper, deterministic 45-Grunt/3-Heavy fixture and actual Q/button input paths at 390×844 and 350×844. It checks fresh charge/reset determinism, focus release, Pause/TUNE guards, radius-four blast/XP/Heavy results and fixed resources over five three-throw cycles, recording first-use warm-up separately, capturing before/blast/+1-second views. Outputs default to `artifacts/p15-radius4`; `P15_GRENADE_REVIEW.md` records historical one-charge measurements. No fixture damage or balance overrides.

`node scripts/qa/p15-metrics.mjs` runs 200 deterministic comparisons: seeds 1–50, normal/1.8-second Lv3 hesitation, each with/without Grenade use. It loads the actual TypeScript simulation through Vite, needs no browser/server and writes `artifacts/p15/metrics.json` plus detailed seed-1/17/42 timelines. These runs use the current authored capacity. The controls acquire the supply but never throw, isolating use from acquisition cost. The pilot is a diagnostic, not a human-survival guarantee. `P15_REPORT.md` records policy, results and mixed evidence.

With Vite running, `node scripts/qa/p15-browser.mjs` verifies 350/390 portrait, safe-area/touch targets, historical one-hit fixture acquisition, no-target charge preservation, input isolation, Pause/Retry, ten-kill XP, Heavy/Giant damage, repeated resource reuse and a warmed 200-enemy frame-time sample. Outputs use the same browser environment overrides below. Software Chrome timings are not physical-phone GPU measurements. Unit tests cover pending/spawned/held/in-flight snapshot continuation and exact kill ordering.

## Intentional web audio start

Web builds require one real user activation before audible gameplay because of
browser audio policy. TopWar holds simulation and presentation at time zero until
a viewport tap/click or Enter/Space activates audio. Gameplay then starts even if
audio is unavailable or denied; a pending browser resume is bounded to one second.
Retry in the same page session restarts immediately without another start gesture.
After backgrounding, a suspended context is resumed on the next real gesture;
this does not reset gameplay/music clocks. Browser permission to resume remains
outside the app's control. A page reload requires a new start gesture.

Run from the repository root with the existing Playwright/Chrome QA runtime:

```sh
node scripts/qa/live-sanity.mjs
node scripts/qa/production-sanity.mjs
node scripts/qa/audio-start-sanity.mjs
```

The first script requires the Vite development server and checks review/normal
starts, firing, keyboard/touch input, pause and Retry. The second requires a
current `npm run build` and opens a temporary local preview for production start
guards. It verifies actual config/level/model requests under `/topwar/` carry
content-addressed filenames, Defense loads only the bullet GLB, fetched data matches authored
data, and defense mode / three Grenades / current progression replace the legacy
bridge HUD. Neither deploys or changes shipping code. Both fail on browser errors.

## P3-B.3 startup and readiness

`node scripts/qa/startup-profile.mjs before` / `after` builds an instrumented production
copy under `artifacts/p3b3/<phase>/dist` and measures three cold/fresh-context and warm/same-context
navigations at each of 350×844 and 390×844. Run `before` on the baseline before editing
shipping source. No request interception disables the HTTP cache. The local preview uses a
600-second static cache lifetime, CDP 1.6 Mbps / 150 ms latency and 4× CPU throttling;
the browser is desktop Chrome/SwiftShader with DPR 2. Run performance captures alone.
JSON includes resource timing/bytes, config/level marks, GLB parse spans, renderer/first
scene timing, decode completion, first voice offset and blank-portrait frames.

`startup-readiness.mjs before` reuses that saved baseline build; `startup-readiness.mjs after`
uses the current production `dist`. Both record 350/390 introductions with audio. The after
run also covers delayed/hung image decode, partial/total image failure, Pause/Resume and Retry
reuse. `startup-modes.mjs` checks production natural Lv1–8, retained legacy Boss startup,
Pause/Retry and deterministic snapshot continuation at both widths. Only test-side responses
expose the app or select legacy config; no shipping debug API is added. Run `p3b-browser.mjs`
and `p3b2-observer.mjs after` against Vite for NAVAL and expression/composition checks.
These captures do not establish physical-phone rendering or speaker latency.

An optional first argument sets the output directory (default `artifacts/sanity`).
`TOPWAR_QA_URL` overrides the development URL. `TOPWAR_PLAYWRIGHT_MODULE` may
point to another installed Playwright module URL, and `TOPWAR_CHROME_PATH` to
another Chrome executable; defaults use the existing local QA runtime.
Historical phase-specific capture/baseline scripts remain in Git history.

The audio-start check waits five seconds without input, then uses real touch,
mouse and keyboard activation. It checks zero pre-start clocks/cues, running
audio before the first volley, Retry, Pause and post-start review access. It saves
timestamped browser-screen frames and native master-bus audio for local recording
QA. The original speaker connection is preserved; no autoplay exemption is used.
Audio capture measures the browser signal, not physical device/speaker latency.

## DEV Review and test-only scenarios

The human DEV menu contains exactly **LATE, CRATE3, CRATE8, NAVAL**, above the
existing balance/audio controls. Selection closes the menu and retains ordinary
Retry behavior. Buttons are at least 44px tall. The obsolete 4/5/6 shortcuts and
projectile selector are removed; production contains none of these controls.

Browser scripts use `selectDevFixture(page, role)` from `dev-fixture-controls.mjs`.
For retained roles it clicks the actual menu. For removed roles it imports
`tests/helpers/ReviewFixtures.ts` into the QA browser and installs a test-side
simulation factory on the existing test-side app exposure. Application code does
not import or expose these helpers. Retry continues the QA scenario; clearing
`app.devReviewFixture` restores the ordinary application factory. SHELL's tick
schedule is injected by the helper into simulation input, outside GameApp.

The migrated scenarios preserve the baseline state and behavior:

- RIFLE: seeded ordinary Lv1, normal progression.
- GRENADE: Lv3 with three charges, 45 Grunts and three Heavies.
- CURVE: Lv4 / 150 XP / two Rifles, natural progression and Giant introduction.
- EVOLVE: Lv5 / 210 XP / three Rifles; ten ordinary kills earn Lv6.
- MG: isolated Lv6 crowd of 60 Grunts and five Heavies.
- MG7/MG8: playable two/three-MG late states with ordinary scheduling.
- CARNIVAL: pending Lv6 release and the full accepted 24-second gameplay phase.
- SHELL: independent artillery singles and overlapping flights.

`ReviewFixtureMigration.test.ts` compares all thirteen initial state hashes
against baseline 2081abe, including the four retained runtime entries. Existing
combat, snapshot and deterministic continuation tests still exercise each scenario.

The migrated browser checks retain their scenario assertions:

- `evolution-fixture-sanity.mjs`: ten real kills into Lv6, first MG fire, inert removed keys, Pause/Retry, focus guards and six bounded-resource reset cycles.
- `late-dev-sanity.mjs`: four menu buttons fit both mobile widths, then LATE/MG7/MG8 progression, Grenades, snapshots and 150 seconds of ordinary combat per entry.
- `carnival-sanity.mjs`: full 24-second Carnival concurrent with Destroyer, snapshot replay and Pause, then the 27-second naval completion before temporary Survival; exact Retry.
- `p3a-browser.mjs`: test-only SHELL launches, overlapping flights, dodge/impact, Pause/Retry and snapshot continuation.

## Permanent Ink Spear validation

`node scripts/qa/projectile-finalization.mjs` checks normal DEV and actual shipping
production bundles at 350×844 / 390×844, including exact selected P3 colors/geometry,
no selector, four working DEV entries, inert 4/5/6, stable Level Up appearance,
Pause, Retry and snapshot presentation. PNGs and decoded WebM recordings are
written to `artifacts/p3b34/visual`. Shipping observation is injected by the browser;
it does not alter the renderer or add a shipping app hook.

`node scripts/qa/projectile-performance.mjs before` replays the exact selected
P3 renderer from 2081abe; `after` uses the current implementation. Both use the
same migrated MG8 scenario at DPR2 / 4× CPU, three measured six-second runs at
each mobile size. Use `TOPWAR_PROJECTILE_OUT` to select the output directory.
The older `projectile-readability.mjs` remains a historical comparison to P3B32.


## P2A Machine Gun

`node scripts/qa/p2a-metrics.mjs` extends the P1.5 normal/hesitation pilot through Lv6 for seeds 1–50 (100 runs), with unchanged Grenade policy. It reports Lv2–6 times, Lv5 duration, evolution counts/pressure, casualties and controlled three-Rifle vs one-MG cadence, 30-Grunt pack clear and Heavy TTK. `node scripts/qa/machine-gun-sanity.mjs` checks the test-only MG fixture and real gameplay controls, 390/350 portrait, HUD/firing, lane changes, Pause/Retry, casualty-state evolution, snapshot family restore, repeated resources and warmed real-RAF audio/frame diagnostics against the same Lv5 crowd. Results/captures default to ignored `artifacts/p2a`; durable evidence is in `P2A_REPORT.md`. SwiftShader measurements are not physical-phone certification.

## P2B Pressure Comeback

The P2B composition below is historical; P2C replaces its late Heavy chances and Lv5 fronts.

`node scripts/qa/p2b-metrics.mjs` uses the saved pre-change
`artifacts/p2b/baseline/metrics.json` (generated with `p2a-metrics.mjs` at the
starting commit), when present, alongside 300 current runs: seeds 1–50, normal/hesitation,
historical multi-step lane pilot and adjacent-step pilots with/without the ramp.
Both adjacent controls use the same global emergency Grenade behavior. Results
include level times, phase pressure/debt/Heavy peaks, first ramp thresholds,
future group populations/fronts/Heavies and the battlefield at Lv6.

`node scripts/qa/p2b-pressure-sanity.mjs` checks global Q/button activation in
390/350 portrait with an empty selected lane, a small near cluster and a much
denser distant crowd. It checks centroid capture, three ordinary Grunt kills/XP,
Heavy survival, flight snapshot continuation, Pause/Retry and repeated resources.
Captures/results default to ignored `artifacts/p2b`; it accepts the browser
environment overrides above. `grenade-lab-sanity.mjs` now measures emergency
targeting without asserting the superseded maximum-crowd target. A no-enemy or
out-of-range state preserves the charge. `P2B_REPORT.md` records mixed pressure
evidence; software renderer results are not physical-phone certification.

## P2C Threat Ladder

`node scripts/qa/p2c-metrics.mjs artifacts/p2c/current` runs seeds 1–50 with
normal and 1.8-second Lv3 hesitation pilots, both nearest-threat and proactive
Giant-priority policies (200 runs). It follows ten seconds beyond Lv6 and records
level times, phase active/near-defense/hit-debt/Heavy peaks, threshold crossings,
ordinary versus release admissions, Giant scheduling/first hit/death/XP and
release composition plus 2/5/10-second MG counts. Baseline measurements were
captured before editing at `53bed55`; the refined pressure counters were also
run with that commit's JSON through the compatible legacy chance/no-Lv6-override
path, reproducing the original timing/cohort results. To repeat that comparison,
save its game JSON then pass `--baseline --baseline-config=path/to/game.json`.

`node scripts/qa/threat-ladder-sanity.mjs` exercises the test-only CURVE fixture at
390×844 and 350×844, natural XP/Giant/evolution, Pause/Retry, deterministic
continuation, repeated release resources and a warmed native-RAF sample of the
natural MG release state. Captures/results default to `artifacts/p2c/browser`.
Use `TOPWAR_QA_URL`, `TOPWAR_PLAYWRIGHT_MODULE` and `TOPWAR_CHROME_PATH` as with
other browser scripts. `ThreatLadder.test.ts` checks exact composition/debt,
Heavy rotation/clearance, backward compatibility, one-time shoreline release,
consumed rows, ordinary cadence, snapshot clocks and Giant lifecycle across Lv6.
Run the existing evolution, MG, emergency Grenade, audio-start and production
sanity scripts too. Durable results and unresolved human questions are in
`P2C_REPORT.md`; software frame timings are not physical-phone certification.

## Temporary post-cap survival

`node scripts/qa/postcap-metrics.mjs` runs natural progression and 150 post-cap
seconds for seeds 1–10, 17, 42, plus 360 seconds for seed 1. It records fixed
Giant/Supply opportunities and skip reasons, admissions, acquisitions, reserves,
throws, pressure/debt, casualties and empty periods. A separate 180-second
seed-42 policy spends recurring charges to verify continued pickup/use cycles;
three disabled runs verify identical natural progression timing before cap.
`node scripts/qa/postcap-sanity.mjs` reviews the production `/topwar/` build at
390×844 and 350×844 through 150+ post-cap seconds, Q/touch, Pause/Retry,
pending/active Supply snapshots, bounded repeat effects and a software-rendered
native-RAF sample. It exposes the app only through a test-side response hook,
never a shipping debug export. Use the existing browser runtime environment
variables documented above. `PostCapSurvival.test.ts` covers disabled behavior,
exact Heavy groups, skip/no-catch-up scheduling and MG +1 acquisition.

## P2.5 Stationary Defense

`node scripts/qa/stationary-metrics.mjs <output-directory>` runs the same adjacent-lane/Grenade pilot for seeds 1, 17, 42, 99 and 2026 through 240 seconds, plus natural Carnival availability runs. Save baseline output before changing gameplay, or set `TOPWAR_QA_ROOT` to an isolated checkout of the baseline. Controlled no-fire cases also measure enemy arrival at the defense line from 20 units. It records Lv2–8 times, admissions/composition, active-enemy samples, release/phase clocks, casualties/failures, and snapshots at Lv5, airborne Grenade, release, active Carnival and handoff. Availability means at least six living Grunts ahead of the squad within the 47-unit horizon, in any reachable lane; it does not promise selected-lane hits.

`node scripts/qa/stationary-compat.mjs <baseline-output-directory>` rebases those actual baseline snapshots, checks preserved lifecycle/cooldown state and repeats 600 fixed ticks after a JSON round trip. `node scripts/qa/stationary-sanity.mjs` checks CURVE, EVOLVE, CARNIVAL, LATE, MG7 and MG8 at 390×844 and 350×844: Z=0, real touch lane movement/Grenades, Pause, deterministic snapshot continuation and exact selected-entry Retry. Browser runtime overrides match the scripts above. Captures default to ignored `artifacts/stage1-p25`. Run `late-dev-sanity.mjs`, `carnival-sanity.mjs` and `production-sanity.mjs` alongside it for HUD, recurring gameplay, crowd rendering and production DEV exclusion. Software WebGL observations do not certify physical-phone performance.

## P2.6 Supply and button polish

`node scripts/qa/p26-sanity.mjs` captures lower button edges at 390×844 and 350×844 with simulated bottom safe-area insets 0/20/34px (the 34px case also includes top/side insets). It exercises normal, held left/right, focus-visible and paused/disabled states, checks layout, and captures ten-hit teaching Supply feedback/acquisition. It also checks partial-progress Pause/restore, recurring MG acquisition and selected-entry Retry. Inspect the generated `*-edges.png` images visually; bounds alone do not verify the border. Runtime overrides match the other browser scripts; output defaults to ignored `artifacts/p26/browser`. These are desktop browser checks, not physical-device certification.


## P2.7 staged Supply destruction

`node scripts/qa/p27-sanity.mjs` checks Lv3 Rifle, Lv6 single MG and Lv8 three-MG acquisition at 390×844 and 350×844 (including a 34px simulated bottom inset). It captures each crate stage, three teaching reward items and one recurring reward item; verifies real HUD inventory during immediate throws, sequential arrivals, cue order, Pause during recovery/flight, snapshot restoration and Retry during flight. Test-side response interception exposes the app only to QA; no production debug API is added. Output defaults to ignored `artifacts/p27/browser`. Browser runtime overrides match the scripts above. Inspect stage and flight captures visually. `SupplyDestruction.test.ts`, `SupplyTransfer.test.ts` and the retained `GrenadeSupplyHits.test.ts` cover staged behavior, presentation and historical one-/ten-hit compatibility. Desktop emulation does not certify physical-phone performance or speaker balance.

`node scripts/qa/p27-record.mjs` records the complete composited 390px Rifle sequence with game audio to `artifacts/p27/recording/rifle-supply-390.webm`, using Chrome screencast frames and its built-in MediaRecorder. The accompanying performance sample compares CPU frame cost outside/during the transfer within that recorded scene; it is not a dense-battle benchmark or a baseline-build comparison.

`node scripts/qa/supply-fixtures-sanity.mjs` selects CRATE3/CRATE8 through the existing menu at both portrait widths, including a simulated 34px bottom inset at 350px. It checks real projectile damage, cue order, exact transfer counts/destinations, partial restoration, Pause and Retry. Captures and results go to `artifacts/p27/fixtures`. Record the actual entries with `node scripts/qa/p27-record.mjs artifacts/p27/fixtures crate3 390` and `node scripts/qa/p27-record.mjs artifacts/p27/fixtures crate8 350`; neither command injects fake hits or changes fixture state. `SupplyDevFixtures.test.ts` also verifies independent firing and absence of unrelated admissions after 20 minutes.


## P2.8 Grenade gameplay and presentation

Run `node scripts/qa/p28-perf.mjs artifacts/p28/before` on the baseline, then the same command with `artifacts/p28/after` on the implementation. Each portrait size uses the same seeded GRENADE fixture, real throw and 12 reset/replay cycles (first two warm the pools). It records CPU submission cost, draw calls, triangles, resource plateaus and final authoritative state. Run without concurrent browser captures; these synchronous desktop/software-WebGL measurements do not establish physical-device FPS.

`node scripts/qa/p28-browser.mjs` checks CRATE3, CRATE8, GRENADE and the existing threat review at 390×844 and 350×844. For the threat-only blast it positions the existing Heavy/Giant together and supplies inventory through a validated QA snapshot. It checks three-stage destruction, transfers, button/Q throws, empty-field zero XP, Pause, in-flight restore, casualties and Heavy/Giant HP, then captures uninterrupted repeats with audio. WebM files and frames extracted from those recordings are under `artifacts/p28/browser`; visually inspect the video frames as well as assertions. `browser-recording.mjs` is a QA-only CDP/MediaRecorder helper, not a shipping endpoint.

## Supply readability and Grenade testbeds

`node scripts/qa/p29-browser.mjs` validates both updated testbeds at 390×844 and 350×844, including a 34px bottom inset: left-side crate acquisition, exact transfers, right-side Grunt multi-kills and surviving Heavy/Giant reactions, partial/in-flight snapshots, Pause and deterministic Retry. It records complete fixture flows with audio, extracts review frames, and captures debris/scorch aftermath. Separate validated QA snapshots put 40 Grunts around the crate for readability and clear surviving targets before an empty-field throw for an unobstructed scorch capture. The shipped fixtures retain their authored right-side formation (now 36 Grunts, one Heavy and one Giant). Output defaults to ignored `artifacts/p29/browser`.

Use `p28-perf.mjs` before and after changes with identical seeded scenes, without simultaneous recording. `GrenadeAftermath.test.ts` verifies fixed debris storage, eight-mark recycling, 12-second hold/6-second fade, Pause/reset/disposal and unchanged input state. The retained `p28-browser.mjs` explicitly clears the revised testbed targets only for its older empty-field regression check. Desktop/software-WebGL QA does not certify physical-phone performance.

## Golden Grenade presentation

`node scripts/qa/p210-browser.mjs` records both 36-Grunt testbeds at 390×844 and 350×844, including a simulated 34px bottom inset. It checks each pooled reward's peak size, full silhouette bounds, final size/position against the real HUD icon, Pause during flight, rewards, partial/in-flight snapshots and exact Retry. Captures include Stage 1/2 and each sequential golden reward at peak, plus real 36-Grunt blasts with surviving Heavy/Giant reactions. Inspect the recordings and extracted frames at native portrait size. Outputs default to ignored `artifacts/p210/browser`. Use the unchanged seeded `p28-perf.mjs` for before/after rendering costs; the crowd increase is restricted to CRATE3/CRATE8, so its ordinary GRENADE benchmark remains comparable.

## P3-B.4 difficulty overlap

`node scripts/qa/difficulty-metrics.mjs artifacts/p3b4/final` runs natural Lv1–8 for seeds 1, 17, 42, 99 and 2026 at 60Hz with an adjacent, artillery-aware 200ms pilot. It records level times, Giant combat, Heavy admissions, release/phase/shell clocks, casualties and peaks; seed 17 includes plain snapshots. `node scripts/qa/difficulty-browser.mjs final` replays its natural Carnival entry at both portrait sizes with three 28-second CPU-4x/DPR-1 samples and separate recordings. It does not add shipping hooks. Historical comparisons may use `revision-server.mjs <revision> --balance` to serve exact historical source and game.json; other public asset changes remain forbidden. Use matched samples without simultaneous browser workloads. SwiftShader does not measure physical-phone GPU performance.

## P3-B.5 post-NAVAL Survival

`node scripts/qa/survival-metrics.mjs artifacts/p3b5/final` measures 180 seconds of natural, isolated Lv7 and three-MG Lv8 Survival for seeds 1,17,42,99,2026. Additional Lv8 pilots react every 600ms or hold one lane without Grenades. Allocated group counts include same-tick projectile kills; sample rows contain lane pressure, HP debt, populations and fixed opportunities. Add a third argument with a Git revision to run exactly that historical source/config with the same QA policies.

`node scripts/qa/survival-browser.mjs final` measures one continuous 90-second Lv8 session per mobile size (three 30-second windows, CPU4×, DPR1) and six-second resource samples, then separately records human LATE and checks its four-button menu, Pause, restore and Retry. For baseline, serve `revision-server.mjs <revision> --balance` and pass `baseline http://127.0.0.1:5174/`. Do not run other Chrome profiles concurrently. Resource counts and SwiftShader timing are browser evidence, not physical-phone GPU certification. LATE in the human menu now starts Lv8; the test-only factory retains its original Lv6 scenario (`selectDevFixture(page, 'late6')` for browser QA).

Add `--fixed` for a separate 45-second lane-2/no-Grenade stress profile (30s + 15s windows, no recording), saved under `artifacts/p3b5/<phase>-fixed-browser`. This exposes neglected-lane buildup before casualties. `--width=350` or `--width=390` selects one viewport without discarding the other saved result; `--evidence-only` recaptures human LATE without replacing timing results.
