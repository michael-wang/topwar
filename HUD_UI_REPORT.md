# Combat HUD correction — compact lower slots

Baseline: `a591f4d9cadabbe1a569450e6edf26fa181c08e8`.
HEAD, origin/main and GitHub main matched and the worktree was clean before edits.
This is UI/presentation only. No gameplay, configuration, progression values,
combat, movement timing, Grenade request/targeting, character/death/world art or
Tap-to-Start architecture changed. Nothing was deployed.

## Visible content and layout

- Top-left DEV menu and top-right backed Pause remain unchanged.
- Lower-left Grenade is a **64×64px button containing only its icon and a charge
  badge (1 or 0)**. No GRENADE, READY, EMPTY or HELD labels remain. Title/ARIA keep
  the accessible name, charge, Q shortcut and temporary-unavailability description.
  Ready uses orange/gold contrast and restrained glow; held but unusable is muted;
  empty is further subdued, shows zero and has no ready animation. Acquisition
  uses a single 550ms pop. Existing Q/button guards and request path are unchanged.
- Lower-right primary telemetry has **one authored Rifle/MG silhouette + three
  cartridge pips**, with **a separate three-slot soldier row only at Rifle Lv4/5**.
  No card, background, border, visible weapon/stage names, numeric rate or living
  count. Dark icon outlines/shadows provide contrast; the whole HUD is pointer-transparent.
- Slots share a safe-area-aware bottom anchor **16px above the unchanged 74px
  movement/XP strip**. Grenade's left edge aligns with the left arrow; telemetry's
  right edge aligns with the right arrow. The fading movement hint fits between them.
- Bottom arrows, immediate / 180ms / 120ms holds, native long-press protections,
  central warm-gradient XP/LV, level-up flash/pop/sheen and build label are retained.

Keep persistent combat HUD out of the upper/middle enemy approach area. Cover lower
player space first. At 390×844 the prior Grenade occupied y435–535 and the prior dark
primary card y406–565. The new Grenade occupies y676–740; primary telemetry y712–740
(or y691–740 with the squad row). Both slots leave the former middle region clear.
The 350px version uses the same vertical anchors. These are element bounds, not
claims about exact opaque-pixel counts.

## Graphical progression

| Level | Weapon | Cartridge pips | Separate squad row |
| --- | --- | --- | --- |
| 1 | Rifle silhouette | 1/3 | omitted |
| 2 | Rifle silhouette | 2/3 | omitted |
| 3 | Rifle silhouette | 3/3 | omitted |
| 4 | Rifle silhouette | 3/3 | 2/3 soldiers |
| 5 | Rifle silhouette | 3/3 | 3/3 soldiers |
| 6 | MG silhouette | 1/3 | omitted |

`loadoutPresentation` derives weapon and squad stages separately from the existing
plan. Casualties do not change these unlocks. `BattleInfoHud` uses the app presentation
clock: only newly filled pips pop/flash for **480ms**; Rifle→MG swaps and pulses the
silhouette for **480ms**, resets cartridges and hides the squad row. First display,
Retry and fixture reset do not fake upgrades. Pause freezes the clock/CSS animations;
reduced motion suppresses them. No timers, new rendering resources or generic weapon
framework were added; stable pip classes avoid redundant DOM writes.

## Validation

- **797 tests / 127 files passed**, typecheck passed, production build passed:
  **240 modules**, 20.48kB CSS / 1,056.89kB JS before gzip. Existing bundle-size/Zod
  annotation warnings remain.
- `combat-hud-sanity.mjs`: 390×844 / 350×844; all six stage mappings, no visible
  primary text/card, icon/charge-only Grenade, ready/unavailable/empty/paused states,
  Q and tap, charge preservation, casualty-independent pips, all seven deterministic
  DEV menu reset actions, physical 4/5/6, and real XP evolution. Eight single-kill
  upgrades (Lv1→5 at both widths) animate only the expected new cartridge/soldier;
  actual Lv5→6 pulses the changed MG icon. Pause freezes evolution animation.
  Synthetic top/left/right/bottom insets 28/18/18/24px keep controls/label in bounds.
- `bottom-strip-sanity.mjs`: real CDP touch holds for 1.3 seconds in both directions
  at both widths, existing 180/120ms cadence, edge feedback, release/cancel/lost
  capture/blur/Pause/death/Retry cleanup, no duplicate tap, native context/selection/
  drag prevention, no old invisible steering, exact XP fill and central level-up.
- `evolution-fixture-sanity.mjs`: actual ten-kill Lv6 at 1.00s in both widths,
  three Rifles→one MG, Pause/Retry, focus/repeat guards, six repeated EVOLVE/MG cycles.
  Resources remained **85 geometries / 11 textures / 32 projectile slots**.
- `production-sanity.mjs`: default, normal-review and threat-review starts at both
  widths; zero DEV menu/fixture DOM, absent fixture/key-handler markers in shipping
  JS, no Escape/4/5/6 fixture activation, two visible arrows and no hidden steering.
- `p15-browser.mjs`: real Lv3 +8s supply and one-hit acquisition, no-target charge
  preservation, Q/button activation, Pause/Retry, ordinary ten-victim XP, Heavy
  6 HP / Giant 163 HP, and bounded repeated explosion resources (85 geometries /
  12 textures / 16 dust instances).
- `audio-start-sanity.mjs`: real touch/mouse/Enter/Space activation, zero pre-start
  clocks/audio, 350px startup, Pause/Retry and post-start menu fixture access.
  All browser runs completed with zero console/page errors.

Browser captures and JSON are under ignored `artifacts/hud-correction/`:

- `rifle-lv3-390.png`, `rifle-lv3-350.png`
- `rifle-lv5-390.png`, `rifle-lv5-350.png`
- `mg-lv6-390.png`, `mg-lv6-350.png`, `mg-evolution-390.png`, `mg-evolution-350.png`
- `grenade-ready-390.png`, `grenade-ready-350.png` (charge 1)
- `grenade-empty-390.png`, `grenade-empty-350.png` (charge 0)
- `grenade-unavailable-390.png`, `grenade-unavailable-350.png` (held charge 1)
- `giant-350.png`, `giant-390.png`, `safe-area-350.png`, stage-upgrade captures
- `movement/`, `evolution/`, `production/`, `grenade/`, `audio/` regression evidence

## Human review and limits

Reviewed the required Rifle/MG/charge states and Giant at both sizes. Upper/middle
approaching enemies and Giant HP are materially clearer than the baseline. Grenade
still reads as a pressable warm button; the small floating primary icons read as
passive telemetry. No collision with movement, central XP/LV or build label was seen.
The player's own outer-lane squad can pass behind lower slots by design. Small empty
pip outlines and thumb reach still deserve physical-phone review, especially in
bright light. Chrome touch emulation cannot certify iOS/Safari long-press behavior
or physical-phone frame time; no physical-device certification is claimed.
