# Combat HUD UI pass

Continuation baseline: `e8ed1ca0020e1234abefa3b7c5157e73fc73b905`.
HEAD, origin/main and GitHub main matched; the worktree was clean before edits.
This is a presentation/input-ownership pass. No simulation, config, level data,
combat damage, progression, spawning, accepted character/death/world art or audio-startup
behavior changed. Nothing was deployed.

## Layout and style

- **Top-left:** DEV/tool disclosure. Seven existing deterministic fixture actions
  sit in a three-column grid above the existing balance/audio controls. Selection
  closes the menu and releases focus. Escape and development physical 4/5/6 still
  work. The entire tool disclosure, fixture factory and fixture handlers are
  excluded from production; the former permanent right-side stack is gone.
- **Top-right:** 44-pixel Pause target, visible dark blue backing, light 20-pixel
  icon, border, restrained bevel and focus outline.
- **Left-middle:** Grenade centered at 57.5% viewport height, 86×100 minimum
  (78×94 at ≤370px). Dark warm beveled surface, orange/gold edge, large grenade
  silhouette, charge badge and READY / HELD / EMPTY status. Existing acquisition
  pop and bounded ready glow respect Pause/reduced motion. Q and tap retain the
  original shared guarded gameplay request.
- **Right-middle:** pointer-transparent tactical panel, pale weapon silhouette,
  Rifle/MG identity, separate readable stage label, permanent enhancement pips,
  total shots/sec and living soldier count. No action bevel/glow. Casualties
  reduce living count/rate without erasing unlock pips; MG displays Stage I,
  one cartridge, 18/s and one living specialist. Stable values avoid repeated
  text-node replacement every render frame.
- **Bottom:** a visible movement / progression strip. Steel-blue arrow buttons
  are 64×60px (56×60 at ≤370px), with a depressed warm-edged held state. The
  center has a 24px dark XP track, fixed red `#D83B27` → orange `#F56724` (45%) /
  `#FF972F` (70%) → gold `#FFD066` fill, and outlined centered LV text with a
  34px level number (32px at ≤370px). The level exceeds the bar height.
  Full-track masking, thresholds and capped-level semantics are unchanged.
  Subtle rightward CSS sheen gives flow; a brief flash, warm track pulse/sweep,
  320ms text pop and 800ms announcement emphasize actual level-ups. Pause
  suspends decorative motion; reduced motion removes flow/sweep/text scale.
  Retry/fixture reset presents the fresh XP state immediately.

The visible buttons exclusively own defense touch movement. Press steps once,
then repeats after 180ms and every 120ms, using the existing keyboard cadence.
Release (including outside the button), cancel, lost capture, blur, hidden
document, Pause, death, Retry and disposal clear ownership/timers. At a lane edge
repeats stop while held feedback remains until release. Secondary fingers cannot
multiply moves. Pointer compatibility clicks add no second step; keyboard/assistive
button activation remains available. A/D and arrow-key lane controls are retained.
Defense no longer constructs the old invisible steering band or listens for
viewport tap steering. Legacy input remains behind its existing mode boundary.
Movement buttons suppress native context menus, selection, dragging and callouts
through pointer capture, non-passive touch guards, non-draggable DOM and CSS.

Safe-area inset + 0.85rem remains the control margin; the build label retains
raw inset + 3px, below the strip. The center combat area and Giant bar remain clear in
the reviewed states. World Level-Up VFX retain their accepted aqua/ivory styling.

## Files and boundaries

`src/style.css` owns layout and surface treatments. `src/ui/BattleInfoHud.ts`
separates read-only combat information from `XpHud.ts`; `GameApp.ts` supplies
existing progression, runtime tuning and living count. `TuningPanel.ts` hosts
`EnemyVfxLabControls.ts` and closes on selection. `GrenadeButton.ts` adds status
presentation. `ArtDirection.ts`, `xpPalette.ts` and `ArtTheme.ts` own only the
independent HUD progression palette. This continuation adds `CombatControlStrip.ts`,
extends `input/LaneStepInput.ts` to visible button holds, and changes `GameApp.ts`
input lifecycle/defense-only DOM ownership. `ControlHint.ts` now says HOLD ARROWS
TO MOVE on touch devices. Focused tests, browser input/layout/production checks
and current gameplay/art/QA docs were updated. No renderer or simulation edits.

## Validation

- **795 tests / 127 files passed**, TypeScript check passed, production build
  passed (240 modules; 20.46kB CSS / 1,056.60kB JS before gzip). Existing
  large-bundle/Zod annotation warnings remain.
- `bottom-strip-sanity.mjs`: real Chrome CDP touch streams hold both buttons for
  1.3 seconds at 390×844 and 350×844. Four moves cross all lanes, with measured
  initial/repeat intervals consistent with 180/120ms; edge scheduling stops,
  pressed feedback persists, and outside release stops immediately. Tap is one
  move. Keyboard hold and Enter activation work. Touch cancel, lost capture,
  blur, Pause, death and Retry leave no held state or stale repeats. No old
  invisible steering DOM/viewport behavior, scroll or selection. Native menu,
  select, drag and touch defaults are prevented. Pre-start/dead/paused buttons
  are disabled. Exact 210/220 fill, central level sizing, actual evolution
  flash/pop, build-label separation and reduced-motion behavior pass.
- `combat-hud-sanity.mjs`: 390×844 and 350×844; seven fixture action/reset pairs,
  menu auto-close/Escape/focus, no permanent stack, Q/tap, empty/paused states,
  real XP evolution and carried-charge visibility, living-rate readouts,
  physical 4/5/6, and synthetic top/left/right/bottom insets 28/18/18/24px.
- `evolution-fixture-sanity.mjs`: ordinary ten-kill XP evolution at 1.00 second
  in both widths, three Rifles → one MG, HUD/first-shot transition, Pause/Retry,
  focus/repeat guards and six repeated EVOLVE/MG cycles.
- `p15-browser.mjs`: actual eight-second supply / one-hit acquisition, invalid
  target preserves charge, input isolation, Pause/Retry, ten ordinary kill XP,
  Heavy 6 HP / Giant 163 HP, and repeated bounded explosion resources.
- `audio-start-sanity.mjs`: touch/mouse/Enter/Space, 350px touch, review startup,
  zero pre-start clocks/audio, Pause/Retry and post-start menu fixture access.
  First browser audio signal measured 20ms after audio activation in this run;
  this does not measure device/speaker latency.
- `live-sanity.mjs`: default, normal-review and threats startup, keyboard/visible
  touch movement, firing, Pause/Retry, and no browser errors.
- `production-sanity.mjs`: default, threats and normal-review routes at both
  widths; zero DEV menus/fixture controls, absent fixture strings/key codes in
  shipping JS, and no menu activation through Escape/4/5/6. Both visible movement
  buttons exist in all six cases; no legacy hidden steering band/zones exist.
- All browser checks completed without console/page errors. Captures and JSON
  evidence are local under ignored `artifacts/bottom-strip/` (HUD, audio,
  evolution, Grenade, live and production subdirectories).

## Visual review and limits

Reviewed ready/empty/paused/menu states, Lv5 with a held Grenade, real Lv6 evolution,
MG mowing, and visible Giant HP at both widths. The warm rounded skill surface
reads as pressable; the square muted information panel reads as passive. Pause is
visible against sky. The bottom arrows read as movement controls, distinct from
the warm Grenade; the centered LV/XP is prominent even at 350px. Actual evolution
captures show a strong brief gold flash and readable LEVEL UP announcement.
Synthetic 28/18/18/24px top/left/right/bottom insets keep controls and label clear.

EVOLVE/MG cycles held **85 geometries / 11 textures / 32 projectile slots**;
Grenade/Giant cycles held **85 geometries / 12 textures / 16 dust instances**.
No resource growth was observed. A warmed 200-enemy SwiftShader diagnostic was
slow: mean frame interval about **132ms without / 128ms with blast**, p95
133/150ms; app CPU p95 2.3/2.6ms. Other browser QA ran concurrently, so these
are sanity observations, not a controlled old/new HUD performance comparison.
The new input has one hold timer and CSS-only XP motion, with no added GPU resources.
These results cannot certify physical-phone frame time.

Remaining human checks: physical iOS/Safari long-press behavior and thumb reach,
text legibility on small phones, and edge-lane visibility during near-contact crowds.
Reviewed fixtures show no critical overlap, but side HUD necessarily covers some
peripheral battlefield area. No balance values were adjusted for the captures.
