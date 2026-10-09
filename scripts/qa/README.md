# Stage 1 P1 MG progression

With Vite running, `node scripts/qa/mg-progression-sanity.mjs` checks real kill-driven Lv6/7/8 upgrades at 390×844 and 350×844, one/two/three rendered MG members, individual firing feedback, squad pips, XP cap, HUD bounds/overlap, Pause, touch, deterministic snapshot continuation and normal Retry. It uses a test-side app hook only; no new shipping fixture. PNGs and JSON go to ignored `artifacts/stage1-p1`. Existing browser runtime overrides below apply. Six-level cap expectations in historical reports/scripts are historical; use this check for P1 progression.

# Browser sanity

## Start presentation / control glyphs

`node scripts/qa/start-presentation-sanity.mjs` covers ten real/synthetic Start cases: mouse desktop and coarse, Enter/Space on coarse, touch at 390/350, pen, unknown/empty pointer and assistive click on fine-pointer. It asserts conservative default and mode before audio resolves, unboxed overlays, enlarged arrows, later A/D/Q/touch functionality, Pause and both normal/fixture Retry persistence. Captures/JSON default to `artifacts/start-glyph`. `START_GLYPH_REPORT.md` records current results.

## Final pre-release checks

`node scripts/qa/release-hud-sanity.mjs` checks 390×844 / 350×844 coarse-pointer and 1100×844 fine-pointer layouts: Start-derived A/D/Q overlays (actual mouse versus touch Start), no defense hint, settled acquisition pulse, charges 3→2→1→0 via the shared Q/button path, concurrent-flight blocking, snapshot with two reserves plus flight, flight Pause, invalid target preservation, normal Retry, only four review menu actions and physical 4/5/6. Captures/JSON default to `artifacts/pre-release/browser`.

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
new-pip feedback, real Lv5→Lv6 silhouette pulse, physical 4/5/6, and synthetic safe-area
insets. It captures 390×844 and 350×844 ready/unavailable/empty/paused/menu/Rifle/MG states in
`artifacts/combat-hud`. Pair with `p15-browser.mjs` for actual supply acquisition
and burst XP, `audio-start-sanity.mjs` for real startup gestures, and
`production-sanity.mjs` for shipping DOM/bundle exclusion of the whole DEV menu.
`HUD_UI_REPORT.md` records the compact layout; `PRE_RELEASE_REPORT.md` records the final input/typography/three-charge pass.

## P1.5 Grenade and pressure

`node scripts/qa/grenade-review-sanity.mjs` uses the real DEV **GRENADE** button, deterministic 45-Grunt/3-Heavy fixture and actual Q/button input paths at 390×844 and 350×844. It checks fresh charge/reset determinism, focus release, Pause/TUNE guards, radius-four blast/XP/Heavy results and fixed resources over five three-throw cycles, recording first-use warm-up separately, capturing before/blast/+1-second views. Outputs default to `artifacts/p15-radius4`; `P15_GRENADE_REVIEW.md` records historical one-charge measurements. No fixture damage or balance overrides.

`node scripts/qa/p15-metrics.mjs` runs 200 deterministic comparisons: seeds 1–50, normal/1.8-second Lv3 hesitation, each with/without Grenade use. It loads the actual TypeScript simulation through Vite, needs no browser/server and writes `artifacts/p15/metrics.json` plus detailed seed-1/17/42 timelines. These runs use the current authored capacity. The controls acquire the supply but never throw, isolating use from acquisition cost. The pilot is a diagnostic, not a human-survival guarantee. `P15_REPORT.md` records policy, results and mixed evidence.

With Vite running, `node scripts/qa/p15-browser.mjs` verifies 350/390 portrait, safe-area/touch targets, one-hit acquisition, no-target charge preservation, input isolation, Pause/Retry, ten-kill XP, Heavy/Giant damage, repeated resource reuse and a warmed 200-enemy frame-time sample. Outputs use the same browser environment overrides below. Software Chrome timings are not physical-phone GPU measurements. Unit tests cover pending/spawned/held/in-flight snapshot continuation and exact kill ordering.

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
exactly one build-SHA version, JSON uses `no-store`, fetched data matches authored
data, and defense mode / three Grenades / current progression replace the legacy
bridge HUD. Neither deploys or changes shipping code. Both fail on browser errors.

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

## DEV Review

Development defense builds put four fixture actions inside the top-left **DEV**
tool disclosure, above the existing balance/audio controls. Click DEV (or Escape),
then choose a fixture; selection closes the menu and returns focus to gameplay.
No permanent right-side fixture stack remains. Browser scripts use
`selectDevFixture` from `dev-fixture-controls.mjs` to follow this same path:

- **CURVE:** Lv4 / 150 of 180 XP / two Rifles / center, two seeded late-Lv4 groups (46 Grunts, two Heavies). Normal streams remain active. Review real XP into Lv5, its six-second natural Giant, real XP into Lv6, immediate release crowd and subsequent 60-person groups.
- **EVOLVE:** Lv5 / 210 of 220 XP / three Rifles, center selected, 18 Grunts (12 center) and two side-lane Heavies across five lanes. Ordinary auto-fire earns ten Grunt XP and crosses into Lv6 within 1–3 seconds, including its immediate 59-Grunt/one-Heavy release; no timer promotion or Grenade dependency. No Giant/Boss or ordinary stream refill.
- **MG:** Lv6 / one specialist, 60 Grunts and five Heavies across five lanes at scattered depths 8–24. Center lane has 12 Grunts and one Heavy; ordinary HP/collision/XP, no Giant/Boss, no stream refill. MG resets the crowd; focus returns for lane keys.
- **GRENADE:** 45 Grunts / three Heavies across five uneven lanes, Lv3 / one Rifle / three held Grenades. Press Q or the left active button, then GRENADE to restart. The fixture button releases focus for immediate Q; Q otherwise ignores interactive/TUNE focus.

Buttons restart deterministic validated fixtures using real HP, damage and P1
progression. Switching roles clears projectiles and all presentation feedback;
Retry restarts the selected fixture. Repeated restarts vary only the development
visual salt. The review set is presentation QA, not gameplay configuration or a saved
simulation mode. Normal `/` remains Lv1 until a button is used;
`?review=threats` remains a separate art fixture. Production excludes review controls
and fixture code behind `import.meta.env.DEV`.

Physical **4** restarts CURVE, **5** restarts EVOLVE and **6** restarts MG through the button reset path.
These DEV shortcuts ignore repeats, Ctrl/Alt/Meta modifiers, interactive/editable/TUNE focus
and input before Tap-to-Start or after the app stops. Fixture buttons release
focus for immediate lane keys and the `4 → 5 → 6 → 6 → 4` loop. They also work as
restarts while paused. Production excludes both controls and key handlers.

`node scripts/qa/evolution-fixture-sanity.mjs` checks the real button/key paths
at 390×844 and 350×844, ten ordinary kills into Lv6, specialist/HUD/first-shot
transition, exact reset, Pause/Retry, focus/repeat guards and bounded resources
over six alternating EVOLVE/MG cycles. Captures/results default to ignored
`artifacts/evolve-review`. It accepts the same browser environment overrides.
The current authored fixture evolves at **1.00 second** in both widths, after
exactly ten ordinary Grunt kills. Six alternating review cycles held steady at
85 geometries, 11 textures and a 32-slot projectile pool. These
software-rendered captures verify the review loop, not physical-phone performance
or the human judgment that evolution feels like a power upgrade.

## P2A Machine Gun

`node scripts/qa/p2a-metrics.mjs` extends the P1.5 normal/hesitation pilot through Lv6 for seeds 1–50 (100 runs), with unchanged Grenade policy. It reports Lv2–6 times, Lv5 duration, evolution counts/pressure, casualties and controlled three-Rifle vs one-MG cadence, 30-Grunt pack clear and Heavy TTK. `node scripts/qa/machine-gun-sanity.mjs` checks real MG controls, 390/350 portrait, HUD/firing, lane changes, Pause/Retry, casualty-state evolution, snapshot family restore, repeated resources and warmed real-RAF audio/frame diagnostics against the same Lv5 crowd. Results/captures default to ignored `artifacts/p2a`; durable evidence is in `P2A_REPORT.md`. SwiftShader measurements are not physical-phone certification.

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

`node scripts/qa/threat-ladder-sanity.mjs` exercises real CURVE/physical 4 at
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
