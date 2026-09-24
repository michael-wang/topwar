# TopWar — Current Roadmap

## Current playable

- Endless deterministic enemy stream. Enemies remain stationary in gameplay coordinates while the player advances; humanoid enemies visually walk toward the squad. The squad holds near the screen bottom, steers horizontally, and auto-fires.
- Normal enemy tiers share one body size and radius (0.30). Color signals tier: Tier-1 is muted brick red (3 HP); Tier-2 is saturated red (300 HP), begins at row 48, and reaches full probability at row 960; Tier-3 is magenta (3000 HP), is guaranteed once at row 360, overlaps the Tier-2 ramp, and fully saturates at row 1320.
- Ten Tier-1 player rifles normalize into one Tier-2 rifle. Its 300-damage heavy shot pierces up to ten Tier-1 enemies and stops on Tier-2 or Tier-3. One Tier-2 rifle has ten Tier-1 defensive points; Tier-3 contact or breach currently costs ten points too.
- Every eight enemy rows offer one deterministic, random-looking side reward. Rewards materialize 30 units ahead while enemies extend 96 units ahead. Rewards are Tier-1 before row 960 and Tier-2 from row 960 onward.
- Primitive humanoids use planted player firing poses, recoil and muzzle flashes, enemy walking, enemy hit flashes, and gray backward deaths. Audio is limited to reward acquisition and throttled enemy death yelps. Game Over leads directly to Retry.

## NOW

**Combat feel vertical slice.** Make enemy kills, reward acquisition, and player Tier-up satisfying in the frequently repeated loop. First prove that a few seconds of shooting and destroying enemies feels good; then expand long-run progression. Detailed effects remain open to playtest.

## NEXT

1. **Tier Boss prototype.** Validate one large, lane-dominating Boss near the end or handoff of a normal enemy tier before generalizing. It uses that tier's color. HP derives from `normalTierHp * bossHpMultiplier`; the initial authored, tunable multiplier is 100. A Boss need not end the run.
2. **Player Tier-3 response.** Design after playtesting where current Tier-3 or Boss pressure becomes unsustainable. Weapon stats remain undecided.
3. **Higher enemy progression.** Tier-4 and Tier-5 normal enemies follow color-not-size. Their values and timing remain unspecified until the preceding loop is validated.

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
