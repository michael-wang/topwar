# TopWar — Game Spec

Status: prototype direction  
Codename: TopWar  
Primary target: mobile web

## 1. Fantasy

Make the game implied by those satisfying mobile ads:

> Start tiny. Grow into a ridiculous squad. Carve a path through a dense enemy army. Take greedy recruitment choices. Reach the boss with enough firepower to erase it.

The prototype is about immediate tactile fun, not meta systems.

## 2. Session shape

Target run length:

- approximately 30–60 seconds for early levels

Flow:

```text
Start
→ move by horizontal dragging
→ squad auto-fires
→ kill dense enemies
→ choose recruitment opportunities
→ grow stronger
→ survive larger enemy sections
→ boss
→ win or die
→ immediate retry
```

No lobby is required for the first playable version.

## Pacing and escalation

The advertisement is a visual and gameplay reference, not a pacing reference. Real gameplay starts with low pressure so one soldier and small early gains such as +1 or +2 feel meaningful. Enemy count, HP, density, speed, and player growth can all shape difficulty. Large crowds and huge recruitment numbers are escalation rewards. Levels should include rises, relief, decisions, and climaxes instead of constant maximum pressure. Pacing and encounter quantities must remain data-driven.

## 3. Controls

Primary:

- drag left/right

Behavior:

- the squad follows horizontal input
- forward progression is automatic
- firing is automatic

Development desktop control:

- mouse drag uses the same Pointer Event path

The game should be playable one-handed on a phone.

## 4. Squad

The player controls a squad rather than an individual soldier.

Initial prototype:

- start with configurable soldier count
- squad members form a compact readable formation
- squad count is visible
- adding soldiers changes the visual formation quickly
- losing soldiers visibly shrinks the formation

The precise formation algorithm is an implementation detail, but it must be tunable.

Important tunables:

- start count
- horizontal move speed
- formation spacing
- formation width/depth behavior

## 5. Weapon

Initial weapon:

- automatic rifle
- auto-fire forward
- each soldier contributes firepower

Initial model may use either:
- one projectile/shot per active firing soldier, or
- an equivalent batched simulation

Choose the simplest model that preserves the feeling that more soldiers means more firepower.

Tunables:

- damage
- fire rate
- projectile speed
- range
- spread if introduced later

No reload mechanic initially.

## 6. Enemies

Base enemy:

- moves toward/blocks the squad
- has HP
- dies under fire
- is visually represented as a red low-poly/simple unit during grey-box development

The important visual outcome:

> Sustained fire should visibly carve holes/corridors into dense enemy groups.

Tunables:

- HP
- movement speed
- contact behavior
- density/count
- spawn shape

## 7. Enemy crowd

The crowd is a hero feature.

It should support formations such as:

- rectangle/block
- wall
- dense blob
- corridor
- split groups

A later version may support authored shapes/masks.

The first version only needs enough formation control to reproduce a dense wall and visibly destroy parts of it.

## 8. Contact/death

Initial simple rule:

- an enemy reaching the squad removes soldiers or otherwise deals deterministic squad damage

Exact contact model is open to tuning.

It must be easy to change without rewriting rendering.

## 9. Recruitment gates

Gates are a major decision point.

Examples:

- +1
- +5
- +20
- +99

Initial gate behavior:

- crossing a gate changes squad count
- value is data-driven
- visual label is large and immediately readable

Later we can test:

- additive gates
- multipliers
- weapon upgrades
- risk/reward lanes

For now, additive gates are enough.

## 10. Level design

Levels are authored from data.

A level should describe ordered content such as:

- starting squad
- enemy groups
- gates
- obstacles
- boss trigger
- end condition

Example conceptual structure:

```json
{
  "id": "level-001",
  "startSquad": 1,
  "sections": [
    {
      "z": 12,
      "type": "enemyGroup",
      "enemy": "grunt",
      "count": 60
    },
    {
      "z": 24,
      "type": "gateChoice",
      "gates": [
        { "x": -1.5, "add": 5 },
        { "x": 1.5, "add": 20 }
      ]
    },
    {
      "z": 40,
      "type": "enemyGroup",
      "enemy": "grunt",
      "count": 300
    }
  ]
}
```

This is illustrative, not a schema commitment.

## 11. Boss

First boss:

- large/simple visual
- configurable HP
- moves or threatens the squad
- visible HP bar
- final DPS check

Win:

- boss HP reaches zero

Lose:

- squad reaches zero

The first boss does not need complex attack patterns.

## 12. Failure and retry

Failure should be cheap.

On loss:

- show a very short result state
- retry should restart immediately

Do not force a menu round trip.

## 13. Visual direction for prototype

Prototype art may closely reference the supplied ad for speed.

Grey-box palette/concepts:

- blue player soldiers
- red enemies
- green grass
- light/white road
- yellow/orange projectiles/muzzle flashes
- large bright gate numbers
- simple boss health bar

The point is to validate the advertised fantasy.

If the project is prepared for public release, visual identity and IP-sensitive assets/naming will be revisited.

## 14. Camera/composition

Portrait framing.

Desired composition:

- squad in lower area
- enough forward visibility for decisions
- enemy mass clearly readable
- growth in squad size visually obvious
- boss feels large at the top/end of the run

Do not chase cinematic camera work before the loop is fun.

## 15. Game feel priorities

In order:

1. movement feels immediate
2. adding soldiers feels good
3. more soldiers clearly means more firepower
4. enemy crowd visibly erodes under fire
5. impacts/deaths are readable
6. retry is instant
7. boss defeat feels like a payoff

Later feel tools may include:

- recoil
- hit flash
- tiny camera impulse
- particles
- death knockback
- damage numbers
- vibration
- sound

Use restraint. Readability wins.

## 16. Development UX requirements

This is part of the game spec.

We need to be able to tune gameplay while playing.

Eventual Dev Panel capabilities:

- pause
- time scale
- player/squad values
- weapon values
- enemy values
- enemy spawn buttons
- level jump
- boss jump
- snapshot save/load
- import/export
- seed replay
- performance stats

Runtime changes should apply without rebuilding the app.

## 17. Snapshot use cases

Examples:

- save just before a 500-enemy crowd
- save with 12 soldiers before boss
- save immediately before a +99 gate
- export a bug state for another developer
- compare two balance variants from the same starting state

Snapshots are an essential iteration tool.

## 18. Prototype success questions

The first playable versions should answer:

- Is horizontal movement pleasant?
- Is squad growth immediately satisfying?
- Does a larger squad feel dramatically stronger?
- Is carving a tunnel through enemies satisfying?
- Are gate choices legible at speed?
- Does the player want to hit Retry?
- How many visible enemies can we support before performance hurts?

We should not build meta systems until these answers are encouraging.

## 19. First playable milestone

A rough playable scene is enough:

- portrait browser canvas
- 1+ blue squad units
- horizontal drag
- automatic forward fire
- a dense group of red enemies
- enemies take damage/die
- squad visibly grows through one gate
- basic lose state
- basic boss
- instant retry
- runtime tuning for key values
- snapshot save/load

Art can remain primitive.

Fun cannot.
