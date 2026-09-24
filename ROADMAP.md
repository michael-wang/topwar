# TopWar — Current Roadmap

## Current playable

- Endless deterministic enemy stream. Enemies remain stationary in gameplay coordinates while the player advances; humanoid enemies visually walk toward the squad. The squad holds near the screen bottom, steers horizontally, and auto-fires.
- Normal enemy tiers share one body size and radius (0.30). Color signals tier: Tier-1 is muted brick red (3 HP); Tier-2 is saturated red (300 HP), begins at row 48, and reaches full probability at row 144; Tier-3 is magenta (3000 HP), is guaranteed once at row 240, and fully saturates at row 336.
- Ten Tier-1 player rifles normalize into one Tier-2 rifle; ten Tier-2 rifles normalize into one Tier-3 rifle. Player rifle tiers share one body size and differ by color, modest weapon scale, and projectile. Tier-3 has 100 defensive points and a 3000-damage shot that spends 100 penetration points across lower tiers, stopping on Tier-3 or Boss. Tier-3 enemy contact or breach currently costs ten points.
- Every eight enemy rows offer one deterministic, random-looking side reward. Rewards materialize 30 units ahead while enemies extend 96 units ahead. Rewards are Tier-1 before row 144 and Tier-2 from row 144 onward.
- Giant handoff Bosses replace rows 136 (Tier-1, 15,000 HP) and 328 (Tier-2, 300,000 HP). Both use scale 7 and radius 2; enemy and reward streams continue behind them. Any rifle tier can progress either current reward tier.
- Primitive humanoids use planted player firing poses, recoil and muzzle flashes, enemy walking, enemy hit flashes, and gray backward deaths. Quiet reward-hit ticks and throttled Boss-hit thuds join reward acquisition and enemy death yelps; gunfire remains silent. Game Over leads directly to Retry.

## NOW

**Tier-2 Boss and Tier-3 handoff validation.** Playtest the second Boss against player Tier-3 progression.

## NEXT

1. **Tier-4 progression.** Extend enemy and player tiers only after the Tier-3 loop is validated; stats remain unspecified.
2. **Tier-3 Boss.** Add when the Tier-4 handoff exists.
3. **Later feel and pacing refinements.** Respond to observed playtest results.

## LATER

- Dev Panel and snapshot tooling/UI
- Profiling and stress pass
- Richer audio or VFX where playtest shows value
- Additional Boss variations
- Mobile polish

## Explicitly inactive / rejected

- Normal enemy tiers do not grow physically larger, and basic enemies do not pursue the player in simulation.
- No finite 30–60 second level requirement or permanent side-armory economy is active.
- A Boss is not restricted to the end of the entire run. Tier-4 and Tier-5 stats are not defined.
- Rocket specialist code remains prototype infrastructure, outside Level 001's current progression route.
