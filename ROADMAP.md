# TopWar — Current Roadmap

## Current playable

- Endless deterministic seven-enemy rows, desktop keyboard or mobile touch/pen steering, pause/resume, automatic rifle fire, stationary gameplay enemies, and visual enemy walking. Game Over leads directly to Retry.
- Formula-driven normal tiers have no authored ceiling. Each 96-row quadratic transition is followed by 96 stable rows; Tier-2 starts at row 48, Tier-3 at 240, and later tiers follow the same cycle. Normal bodies share radius 0.30 and one visual size; tier color cycles through six enemy colors.
- Enemy HP and player rifle damage are 3 at Tier-1, 300 at Tier-2, then multiply by 10 per tier by default. Enemy and rifle growth can be tuned independently during a run. Ten rifle soldiers merge into one at the next tier. Only the highest two adjacent player rifle tiers remain active; exact lower-tier remainder value contributes to defense and future merges without firing. Player colors cycle through five cool palettes without permanent body growth.
- One deterministic side reward appears per eight-row block at X = ±2.7, 30 units ahead against a 96-unit enemy horizon. Each rifle hit consumes its shot; ten hits grant the fully established enemy tier. Enemies remain in reward rows.
- A giant Boss replaces one row eight rows before each next-tier saturation. Tier-1 Boss is row 136 with 12,000 HP; later Boss HP uses 1000 times its normal tier power. Enemy and reward streams continue behind Bosses. A small HUD shows the highest enemy tier introduced at the player's current row.
- Humanoid recoil, muzzle flash, walking, hit/death feedback, reward and tier-up payoff remain. Audio is limited to reward ticks/chimes, Boss hit thuds, and throttled enemy death yelps; gunfire is silent. An eight-slider runtime panel provides temporary tuning with Reset Defaults.

## NOW

**Prototype weekly checkpoint / stabilization.** Major gameplay and progression architecture is complete for this checkpoint; validate sustained handoffs, reward choices, and mobile play.

## NEXT

1. Fix blockers discovered in human or mobile long-run playtest.
2. Profile sustained high-tier runs only if performance becomes an issue.
3. Revisit feel and readability only from observed playtest evidence.

## LATER

- Dev Panel and snapshot tooling/UI
- Additional Boss variations
- Mobile polish

## Explicitly inactive / rejected

- Normal tier does not change body size; basic enemies do not pursue the player in simulation.
- No finite level or permanent side-armory economy is active.
- Rocket specialist code remains prototype infrastructure outside Level 001's rifle progression.
