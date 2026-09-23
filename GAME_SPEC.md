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

The advertisement is a visual and opening-pacing reference. The player starts small but sees a sustained enemy threat ahead. Enemy count, HP, density, and player growth can shape later difficulty; pacing and encounter quantities remain data-driven.

The player is forced forward toward stationary basic grunts. Pressure comes from visible enemy mass ahead and from the risk of reaching enemies before clearing them. The enemy field begins relatively close and extends deep into the level. It should read as an irregular, continuous mob with breathing room between grunts, not orderly ranks.

Level 001 opens with one long, denser enemy stream rather than an isolated blob. Slower forced progression gives the player time to invest in persistent side armories. This level deliberately embraces exaggerated advertisement-style squad growth.

## 3. Controls

Desktop is mouse-first: moving inside the gameplay viewport steers relatively without a button. The cursor stays visible for boundary awareness and indicates left or right steering, returning to neutral when movement stops. A/D and Left/Right arrows are equivalent alternatives. Mobile is touch-first: drag from any comfortable point without a jump on touch-down. Switching controls should be frictionless; Pointer Lock is not required for the first playable prototype.

The squad follows horizontal input and progresses forward automatically. Firing is automatic when implemented. One-handed movement should feel immediate and low-friction.

## 4. Squad

The player controls a squad rather than an individual soldier.

The squad may contain rifle soldiers and rocket specialists. Rifle soldiers provide dense direct fire; rocket specialists fire slowly but deal high-damage area attacks. Rocket combat remains implemented, although Level 001's current armories both recruit rifle soldiers.

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

- remains stationary and blocks the squad's path
- has HP
- dies under fire
- is visually represented as a red low-poly/simple unit during grey-box development

Basic grunts are low-HP fodder and may die from one base rifle hit. Tougher, multi-hit enemies should look distinctly different rather than making every grunt spongey.

Moving or chasing enemies, if introduced later, should be visibly distinct special enemy types.

The important visual outcome:

> Sustained fire should visibly carve holes/corridors into dense enemy groups.

Tunables:

- HP
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

Base contact is an event, not damage every frame: a basic grunt trades itself for its configured squad casualties.

A surviving enemy left behind the advancing player crosses a defense line at `player.z - defenseLineOffset` and costs one soldier. Contacted or shot enemies cannot also breach. When the squad reaches zero, the run ends.

It must be easy to change without rewriting rendering.

## 9. Recruitment gates

Gates are a major decision point.

Examples:

- +1
- +5
- +20
- +99

Two independent armories persist beside the advancing player, and both walls retain damage while the player fights elsewhere. Breaking the left 100 HP wall unlocks automatic +1 rifle recruitment every 2 simulation seconds, indefinitely while the run lives. Breaking the right 1000 HP wall immediately grants +99 rifle soldiers once. Both paths remain available throughout the run; the player decides how much firepower to invest while surviving the enemy stream. Wall HP and rewards are authored level data.

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
      "type": "sideArmory",
      "zOffset": 8,
      "reward": { "kind": "rifle", "amount": 1, "count": 5 }
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

## Upgrade choices

- Present two clearly different options by default; add more only when later design calls for them.
- One path may offer clear quantitative growth, such as more soldiers, projectiles, or firing volume.
- Another may offer strong specialization with an obvious cost, such as high damage with slow fire, broad damage with low frequency, or piercing power with a readable tradeoff.
- Make choices understandable in roughly one or two seconds. Favor visible gameplay changes over small hidden percentage bonuses.
- Keep both options satisfying and viable; avoid hidden traps.
- Let strategy give each run character without interrupting action or requiring a complex build system.
