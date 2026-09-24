# TopWar — Game Spec

## Core fantasy

Start with a tiny squad, steer horizontally, and auto-fire into endless dense enemy pressure. Divert fire toward risky side rewards to recruit soldiers and grow into stronger player tiers while increasingly dangerous, color-coded enemies enter the stream. A giant Boss guards the first tier handoff.

## Current session model

- The current prototype is endless survival. The player advances in simulation Z but stays near the bottom of the portrait view. Enemy positions remain stationary in gameplay coordinates; their visual walk cycle makes the crowd look as though it approaches.
- The player steers horizontally by touch drag, desktop mouse, or keyboard. Rifle fire is automatic. Uncleared enemies cause contact or defense-line casualties.
- The run ends when visible squad count reaches zero. Game Over offers immediate Retry. There is no required win state or fixed session length.

## Enemy stream and normal tiers

The deterministic endless stream generates seven-enemy rows ahead of the player, without preallocating the entire future field. Enemy lookahead is 96 world units. Tier rolls depend on authored data and row/slot, not gameplay RNG or earlier kills. Normal enemies share one humanoid visual scale and radius **0.30**: **color indicates tier; size indicates role**. Larger bodies are reserved for specials and Bosses.

| Normal tier | HP | Color | Current progression |
| --- | ---: | --- | --- |
| Tier-1 grunt | 3 | Muted brick red | Opening fodder |
| Tier-2 brute | 300 | Saturated red | Guaranteed first reveal at row 48; quadratic ramp reaches full probability at row 144 |
| Tier-3 | 3000 | Magenta | Guaranteed first reveal at row 360; quadratic ramp fully saturates at row 1320 |

Tier-3 takes precedence when both tier rolls would select the same slot. After row 144, non-Tier-3 enemies are Tier-2; from row 1320, all new normal enemies are Tier-3. Future normal tiers should retain color-not-size unless playtesting changes that rule; their HP, colors, and timing are undecided.

## Player progression and combat

- Level 001 starts with one Tier-1 rifle soldier. Each Tier-1 rifle projectile deals **3 damage**. The squad uses a compact circular formation and fires at the normal rifle cadence.
- Every **10 Tier-1 rifles** automatically normalize into **one Tier-2 rifle**. A Tier-2 rifle is one larger visible squad body that fires one **300-damage** heavy rifle projectile at the same cadence.
- A heavy rifle shot pierces up to **10 Tier-1 enemies**, spending one penetration point per enemy. A Tier-2 or Tier-3 enemy stops it; a full-health Tier-3 takes ten heavy hits. Tier-1 shots also damage higher tiers normally and stop on impact.
- One Tier-2 rifle has **10 Tier-1-equivalent defensive points**. A one-point casualty can demote one Tier-2 rifle into nine Tier-1 bodies. Tier-2 and Tier-3 enemy contact or breach currently each costs ten defensive points; Tier-1 costs one. Rockets are consumed last under the current casualty policy.
- Player Tier-3 does not exist yet. Rocket specialist combat exists as prototype infrastructure but is not a Level 001 progression route.

## Stream rewards

- Every eight-row block contains **exactly one** authored reward opportunity. Its row and left/right side look random but are deterministic. A reward sits at X = **±2.2**; all seven enemies remain in its row.
- Rewards materialize only **30 world units** ahead, independent of the enemy lookahead of 96. Each target needs **10 valid rifle-tier hits**. Unlocking adds one soldier immediately; ignored targets expire harmlessly behind the defense line.
- Before row 144, targets grant one Tier-1 rifle. From row 144 onward, they grant one Tier-2 rifle. No Tier-3 reward exists.
- Any rifle tier progresses any current stream reward by one hit; the reward tier determines the soldier awarded, not the required rifle tier. Tier-1 shots are consumed by either reward tier. A Tier-2 heavy shot is consumed by a Tier-2 reward but continues through a Tier-1 reward without spending enemy penetration. Rockets pass through rewards without progress.

The player must notice a side target, steer, and spend fire on it while the full enemy row remains threatening. Generic side-armory code exists but is inactive in Level 001.

## Presentation and feel

Players and enemies use primitive humanoid silhouettes. Player soldiers hold a planted firing pose with recoil and a small muzzle flash; enemies visually walk while remaining stationary in simulation. Enemy hits flash yellow, deaths turn gray and flip backward with a brief tier-colored burst, reward hits pulse, removed rewards pop, newly recruited soldiers pop in, Tier-2 upgrades pulse with a ground ring, and player damage flashes the screen red. Audio intentionally plays only a reward-acquisition chime and throttled enemy-death yelps.

The next product pass focuses on the payoff of repeated actions: **enemy kill, reward acquisition, and player Tier-up**. Prove that a few seconds of shooting and destroying enemies feels satisfying before widening progression.

## First Boss encounter

Level 001 has one giant Tier-1-colored Boss at **row 136**, late in the Tier-1 to Tier-2 transition and eight rows before full Tier-2 probability. It has visual scale **7**, gameplay radius **2.0**, and HP derived from Tier-1 HP × the authored **5000** multiplier (currently 15000 HP). The Boss replaces only its own seven-enemy row; normal enemies and rewards continue materializing behind it while it lives. Boss contact is fatal. The Boss has no attacks or reward. Later tier Bosses are not implemented and will be designed only after this encounter is validated.

## Development principles

Keep fixed-step deterministic gameplay separate from disposable rendering and audio. Load balance data at runtime and keep gameplay state serializable. Make changes quick to test and easy to delete or refactor. Prioritize a satisfying few seconds of play before expanding the number of tiers or encounters.
