# TopWar — Game Spec

## Core loop

Steer a tiny auto-firing squad through an endless deterministic enemy stream. Side rewards ask the player to divert fire while all seven enemies in each row remain. Soldiers merge into stronger tiers; giant Bosses mark each tier handoff. The run ends when the visible squad reaches zero, followed by immediate Retry. The player advances in simulation Z while staying near the bottom of the portrait view; normal enemies remain stationary in gameplay coordinates and visually walk toward the squad.

## Formula-driven tiers

Level 001 authors a first transition start at row **48**, **96** transition rows, **96** stable rows, and quadratic probability. The cycle is 192 rows: the transition into Tier N starts at `48 + (N - 2) × 192` and fully saturates 96 rows later. During a transition only the established tier and its next tier coexist. The center-most slot guarantees a reveal on the exact start row. Slot rolls use deterministic content inputs, independently of gameplay RNG. There is no authored tier maximum.

Normal enemy HP and player rifle damage share one power rule: Tier-1 = **3**, Tier-2 = **300**, and each tier after Tier-2 multiplies power by **10**. Thus a same-tier rifle shot kills a full-health normal enemy. Normal enemies all use radius **0.30** and the same humanoid body size. Tier is color, not size. Enemy body/head colors cycle through six palettes: muted brick red, saturated red, magenta, violet, orange, and olive. Player rifle bodies cycle through five separate cool-color palettes; all use the same normal body scale. Weapon and projectile visuals stay bounded rather than growing forever.

## Player combat and defense

Level 001 starts with one Tier-1 rifle soldier. Every **10** rifle soldiers of a tier automatically merge into one of the next tier, cascading as needed. Only the highest two adjacent rifle tiers remain active, visible, and firing. Lower-tier leftover exchange value is preserved exactly as a non-firing rifle remainder: it contributes to defense and future normalization, but not visible count or offense. If casualties lower the highest active tier, lower-tier bodies may become visible again. All tiers share the authored rifle fire rate, projectile speed, and range. A Tier N soldier has `10^(N - 1)` Tier-1-equivalent defense points. A Tier N projectile has the same penetration budget: each lower-tier normal enemy costs its tier's defense value, then the shot continues while budget remains. Same-tier or higher-tier normal enemies stop the shot; every Boss stops it. Casualties consume rifle defense first and can demote a high-tier body into lower-tier bodies. Rocket specialists remain last-loss prototype infrastructure and are not Level 001's current progression route.

## Rewards

Every eight-row block has exactly one deterministic, random-looking side reward at X = **±2.7**. Reward lookahead is **30** world units; enemy lookahead remains **96**. Rewards do not replace enemies. A reward's tier follows the highest fully saturated enemy tier: Tier-1 before row 144, Tier-2 from row 144, Tier-3 from row 336, and so on by formula. Every rifle tier can progress every reward tier by one hit; each valid hit consumes the projectile, making reward pursuit an offensive tradeoff. Ten hits grant one soldier of the reward tier and normalize the squad. Rockets pass through without reward progress. Ignored rewards expire harmlessly. Generic side-armory code exists but is inactive in Level 001.

## Boss handoffs

A Boss of Tier N replaces one normal row eight rows before Tier N+1 fully saturates. The Tier-1 Boss is row **136**, with HP `3 × 4000 = 12,000`. Each later Boss has HP equal to its tier's normal power times **1000**. Bosses share visual scale **7** and collision radius **2.0** at every tier, using the same cycling enemy palette as their normal tier. Enemy and reward streams continue behind a living Boss. Boss contact or defense-line crossing is fatal. Bosses have no attacks or special rewards.

## Presentation

The top HUD displays the highest enemy tier introduced at the player's current progression row.

Primitive humanoid players hold a planted firing pose with recoil and muzzle flashes. Enemies use a visual walking cycle, a yellow hit flash, tier-colored death burst, and gray backward death motion. Reward hits pulse, reward removal and recruited soldiers pop, and tier-ups glow with a short ring. Boss hits pulse, and player damage flashes red. Audio remains sparse: quiet reward-hit ticks, reward-acquisition chimes, throttled Boss-hit thuds, and throttled enemy-death yelps. Automatic gunfire is silent.

## Development principles

Keep deterministic fixed-step gameplay separate from disposable rendering and audio. Load balance and progression inputs at runtime. Serialize plain gameplay state, including generic tiers and stream cursors. Prioritize fast iteration and long-run playtest evidence before tuning the infinite loop.
