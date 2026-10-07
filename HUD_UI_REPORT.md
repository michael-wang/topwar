# Combat HUD UI pass

Starting baseline: `7009741aba78f6f102b888e73d8bcf4d7b11a838`.
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
- **Bottom:** large level number on a dark badge with orange underline; XP now
  spans the space freed by loadout. Dark track, fixed red `#D83B27` → orange
  `#F56724` (45%) / `#FF972F` (70%) → gold `#FFD066` fill. Full-track masking,
  thresholds, gain/level-up timing and capped-level semantics are retained.
  First update after Retry/fixture reset is immediate, preventing an old full
  bar briefly animating backwards into a fresh run.

Safe-area inset + 0.85rem remains the control margin; the build label retains
raw inset + 3px. The center, lower movement area and Giant bar remain clear in
the reviewed states. World Level-Up VFX retain their accepted aqua/ivory styling.

## Files and boundaries

`src/style.css` owns layout and surface treatments. `src/ui/BattleInfoHud.ts`
separates read-only combat information from `XpHud.ts`; `GameApp.ts` supplies
existing progression, runtime tuning and living count. `TuningPanel.ts` hosts
`EnemyVfxLabControls.ts` and closes on selection. `GrenadeButton.ts` adds status
presentation. `ArtDirection.ts`, `xpPalette.ts` and `ArtTheme.ts` own only the
independent HUD progression palette. Focused UI tests, existing browser fixture
access helpers, production checks and current gameplay/art/QA docs were updated.

## Validation

- **779 tests / 126 files passed**, TypeScript check passed, production build
  passed (239 modules). Existing large-bundle/Zod annotation warnings remain.
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
  First audio signal measured 30ms after activation in this software-browser run.
- `production-sanity.mjs`: default, threats and normal-review routes at both
  widths; zero DEV menus/fixture controls, absent fixture strings/key codes in
  shipping JS, and no menu activation through Escape/4/5/6.
- All browser checks completed without console/page errors. Captures and JSON
  evidence are local under ignored `artifacts/combat-hud/`.

## Visual review and limits

Reviewed ready/empty/paused/menu states, Lv5 with a held Grenade, real Lv6 evolution,
MG mowing, and visible Giant HP at both widths. The warm rounded skill surface
reads as pressable; the square muted information panel reads as passive. Pause is
visible against sky, and the level/XP treatment shares the warm action accents.

EVOLVE/MG cycles held **85 geometries / 11 textures / 32 projectile slots**;
Grenade/Giant cycles held **85 geometries / 12 textures / 16 dust instances**.
No resource growth was observed. A warmed 200-enemy SwiftShader diagnostic was
slow: mean frame interval about **125ms without / 122ms with blast**, p95 133ms
in both; app CPU p95 2.2/2.6ms. This compares current no-blast/blast samples,
not old/new HUD performance, and cannot certify physical-phone frame time.

Remaining human checks: left-middle thumb reach/comfort, text legibility on
physical small phones, and edge-lane visibility during moving near-contact crowds.
Reviewed fixtures show no critical overlap, but side HUD necessarily covers some
peripheral battlefield area. No balance values were adjusted for the captures.
