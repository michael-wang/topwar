# TopWar — Current Roadmap

## Current playable

- Endless deterministic seven-enemy rows, horizontal steering, automatic rifle fire, stationary gameplay enemies, and visual enemy walking. Game Over leads directly to Retry.
- Formula-driven normal tiers have no authored ceiling. Each 96-row quadratic transition is followed by 96 stable rows; Tier-2 starts at row 48, Tier-3 at 240, and later tiers follow the same cycle. Normal bodies share radius 0.30 and one visual size; tier color cycles through six enemy colors.
- Enemy HP and player rifle damage are 3 at Tier-1, 300 at Tier-2, then multiply by 10 per tier. Ten rifle soldiers merge into one at the next tier. Defense and lower-tier piercing use the same 10:1 exchange ladder. Player colors cycle through five cool palettes without permanent body growth.
- One deterministic side reward appears per eight-row block, 30 units ahead against a 96-unit enemy horizon. It grants the fully established enemy tier after ten rifle hits. Enemies remain in reward rows.
- A giant Boss replaces one row eight rows before each next-tier saturation. Tier-1 Boss is row 136 with 15,000 HP; later Boss HP uses 1000 times its normal tier power. Enemy and reward streams continue behind Bosses.
- Humanoid recoil, muzzle flash, walking, hit/death feedback, reward and tier-up payoff remain. Audio is limited to reward ticks/chimes, Boss hit thuds, and throttled enemy death yelps; gunfire is silent.

## NOW

**Formula-driven infinite progression validation.** Playtest sustained handoffs, reward acquisition, and the unbounded tier loop.

## NEXT

1. Tune the infinite progression formula from long-run playtest.
2. Improve high-tier readability and feel where playtest shows a need.
3. Profile sustained high-tier runs.

## LATER

- Dev Panel and snapshot tooling/UI
- Additional Boss variations
- Mobile polish

## Explicitly inactive / rejected

- Normal tier does not change body size; basic enemies do not pursue the player in simulation.
- No finite level or permanent side-armory economy is active.
- Rocket specialist code remains prototype infrastructure outside Level 001's rifle progression.
