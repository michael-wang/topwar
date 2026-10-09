# TopWar Architecture

Status: initial architecture contract  
Target: gameplay prototype, mobile web first

## 1. Product goal

Build the fun version of the "mobile game ad" fantasy:

- a growing squad
- automatic forward fire
- dense enemy crowds
- visible holes carved through those crowds
- recruitment/risk choices
- endless survival pressure
- instant retry
- strong numerical and visual escalation

The first engineering goal is not content volume. It is a playground where gameplay can be tuned very quickly.

## 2. Primary engineering goal

The time between:

> "What if enemy HP were 14 instead of 10?"

and:

> actually feeling that change in the running game

should be a few seconds.

This drives the architecture.

## 3. Stack

- Vite
- TypeScript
- Three.js
- Vitest
- plain HTML/CSS for game UI and dev tooling

No React is required for the first prototype. The UI is intentionally small, and avoiding a second application framework keeps the project easier for coding agents to reason about.

A UI framework may be reconsidered only if the UI becomes complex enough to justify it.

## 4. Source layout

```text
src/
  app/
    GameApp.ts
  core/
    FixedStepLoop.ts
    Rng.ts
    ids.ts
  config/
    ConfigStore.ts
    configTypes.ts
    configValidation.ts
  simulation/
    Simulation.ts
    SimulationState.ts
    input/
    squad/
    combat/
    enemies/
    level/
  rendering/
    GameRenderer.ts
    camera/
    squad/
    enemies/
    projectiles/
    effects/
  devtools/
    DevPanel.ts
    DevCommands.ts
  snapshots/
    SnapshotCodec.ts
    SnapshotStore.ts
  ui/
    Hud.ts
    ResultScreen.ts

public/
  game-data/
    game.json
    weapons.json
    enemies.json
    bosses.json
    levels/
      level-001.json

tests/
```

This structure may grow gradually. Do not create empty architecture theater. Add directories/modules when a task actually needs them.

## 5. Simulation/render separation

### Simulation

Owns gameplay truth:

- positions
- HP
- squad count
- projectiles
- enemy alive/dead state
- boss state
- level progression
- timers
- RNG state

It runs on a fixed timestep.

It cannot know that Three.js exists.

### Rendering

Consumes simulation state and makes it visible.

It owns:

- Scene
- Camera
- Meshes
- InstancedMesh
- Materials
- lights
- visual interpolation
- particles/effects

Renderer resources are not gameplay state.

A renderer may be fully destroyed and reconstructed without changing the outcome of the simulation.

## 6. Fixed timestep

Initial target:

```text
simulation: 60 ticks / second
rendering: requestAnimationFrame
```

A loop accumulates real elapsed time and advances simulation by a fixed `dt`.

Clamp extreme frame gaps to prevent a backgrounded browser tab from trying to simulate thousands of ticks on resume.

Time scale belongs above simulation stepping so DevTools can request:

- pause
- 0.25x
- 0.5x
- 1x
- 2x

Exact implementation comes in its own task.

## 7. Deterministic RNG

Use a tiny explicit seeded PRNG with serializable state.

Requirements:

```ts
interface GameRng {
  nextFloat(): number;      // [0, 1)
  nextInt(maxExclusive: number): number;
  getState(): number;
  setState(state: number): void;
}
```

The exact algorithm is less important than:

- determinism
- serializable state
- tests

Gameplay may not use `Math.random()`.

## 8. Configuration

### Base configuration

Base game data lives under `public/game-data/` and is loaded at runtime with `fetch`.

This deliberately avoids importing balance JSON into the JS bundle.

Production runtime public URLs go through `publicAssetUrl()`, which preserves the
Pages base path and adds one `v` query parameter from the injected build SHA.
This keeps config, level data and GLB cache entries aligned with the JS build.
Production config/level JSON fetches additionally use `cache: 'no-store'`;
development retains unversioned URLs and its normal fetch behavior.

Examples:

```json
{
  "player": {
    "startSquad": 1,
    "moveSpeed": 5.0,
    "formationSpacing": 0.45
  }
}
```

```json
{
  "weapon": {
    "rifle": {
      "fireRate": 10,
      "projectileSpeed": 60,
      "range": 80
    }
  }
}
```

### Runtime overrides

`ConfigStore` maintains:

```text
base config
+ runtime overrides
= effective config
```

Dev Panel edits runtime overrides.

Changing a runtime value should affect the running game according to the semantics of that value.

Examples:

- weapon damage: next shot uses new value
- fire rate: next fire scheduling uses new value
- default enemy HP: newly spawned enemies use new value
- current enemy HP: explicit runtime tuning command preserves each active health fraction

This distinction avoids spooky implicit state mutation.

### Development persistence

The compact tuning panel keeps overrides in memory only. Retry retains them; reload returns to authored JSON defaults. Persistence infrastructure may be used by later development tools, but is not used by this panel.

Later, local development may add a Vite-only dev endpoint that writes approved config changes back to disk. That endpoint must never exist in production.

Do not block the first playable build on "write JSON to disk from Safari".

## 9. Config validation

Configuration is external input and must be validated.

Initial recommendation: Zod.

Reject invalid values with a useful development error.

Examples:

- HP must be > 0
- fire rate must be > 0
- enemy count must be an integer >= 0
- movement speed must be >= 0

Do not silently turn invalid configuration into `NaN`.

## 10. Snapshot system

A snapshot is an engineering time machine, not a user-facing save game.

Proposed format:

```ts
interface GameSnapshotV1 {
  version: 1;
  createdAt: string;

  levelId: string;
  seed: number;

  simulation: {
    tick: number;
    rngState: number;
    state: SimulationState;
  };

  configOverrides: unknown;
}
```

The exact `SimulationState` evolves with gameplay systems.
Squad `rifleRemainder` and projectile `penetrationRemaining` are JSON numbers
while safely representable, then canonical decimal strings above
`Number.MAX_SAFE_INTEGER`. Simulation converts them to `bigint` for exact
exchange arithmetic; snapshots never contain a JavaScript `bigint`.
An active Boss stores `engaged`, `slamCooldownRemainingSeconds`, and `slamCount`
as plain JSON data. Simulation alone advances the cooldown and applies casualties;
the renderer uses these fields only to select baked attack poses and impact feedback.
Simulation also owns a bounded transient queue of contact/slam presentation events.
GameApp consumes it once per render; events are excluded from snapshots and cleared
when a state is restored or a run is restarted. Runtime Boss HP scale defaults to
3 in GameApp and rescales a living Boss by its remaining HP ratio.
Contact/slam events carry ordered affected old roster indices; rifle casualty
presentation consumes low-tier members before higher tiers. The exact result
still comes from BigInt exchange-value subtraction. Initial runs and Retry draw
an unsigned 32-bit browser-crypto seed. Simulation mixes that stored run seed
with authored enemy and reward salts for deterministic stream generation;
restoring a snapshot derives the same effective seeds from its saved run seed.

The optional Catharsis experiment state stores its validated balance and track
half-width as plain data. Normal enemies carry a `grunt` or `heavy` archetype.
The existing row cursor reconstructs deterministic lane compositions without a
second director clock or mutable RNG. Experiment snapshots retain live movement,
Heavy HP, composition overrides and reward density, so restore also reproduces future spawns.
Legacy states without experiment fields remain valid. Simulation supplies lane
positions; render projection supplies configured visual scales. Neither depends
on renderer resources. Normal movement stops during an engaged Boss showdown.

Authored MG progression derives its allowed living count from the saved level plan's squad stage. Each member has a serialized weapon clock; casualties preserve surviving MG phases. Six-level snapshots retain their embedded plan and Lv6 cap rather than silently upgrading to the eight-level plan. Legacy delayed reinforcement/landing assault is restricted to levels beyond the saved authored plan. The Lv6 release timestamp remains one-shot even when a single XP burst crosses several levels.

### Snapshot invariant

Defense snapshots carry a narrow `grenade` state: Lv3 entry and supply/acquisition clocks, one supply, an integer 0–3 inventory and at most one captured flight. Teaching acquisition fills the authored capacity (3); an explicitly additive recurring crate grants +1, clamped at capacity. A valid throw consumes one charge; an existing flight blocks another throw and may coexist with remaining reserves. Validation checks reserves against the snapshot's configured capacity; older capacity-1 snapshots remain valid. Flight stores its own damage in defense-enemy HP, radius and duration so a live configuration edit cannot rewrite a launched throw. `SimulationInput.throwGrenade` is consumed on a fixed tick. The shared `grenadeTarget` resolver preserves nearest-threat/centroid targeting and falls back to the configured defense-line-relative center when no eligible enemy exists. Target selection, circular damage, stable victim order and XP stay in simulation. Rifle, rocket and Grenade damage share the same lethal-removal/XP boundary. A separate disposable Grenade event queue presents acquisition and detonation (including empty blasts); it is cleared on restore and never serialized. Existing contact/slam presentation contracts are unchanged. Detonation events capture victim X/Z, role and lethal status before removal. EnemyRenderer uses those events to select at most eight radial airborne Grunt deaths from its existing death-body pool, and bounded temporary Heavy/Giant reactions; ordinary death paths remain unchanged. SupplyCrateRenderer owns attached damage stages and gravity-driven fragment poses, while GrenadeExplosion owns two preallocated instanced effect slots. Renderer-only arcs, reactions and burst resources contain no gameplay truth. All use the pausable presentation clock and reset independently of snapshots.

If:

1. snapshot S is loaded
2. no input is provided
3. the same ticks are advanced

then gameplay behavior should be deterministic.

### Snapshot storage

Initial development storage:

- named slots in localStorage
- JSON export
- JSON import

Later:

- shareable fixture files for bug reproduction

## 11. Entity identity

Simulation entities that need persistence get stable numeric IDs.

Do not use references to renderer objects as identity.

Example:

```ts
type EntityId = number;
```

An ID allocator is part of simulation state if IDs affect snapshot restore/replay.

## 12. Crowd representation

The prototype should be designed for hundreds of visible units.

Rendering direction:

- `THREE.InstancedMesh` for soldiers/enemies where practical
- shared geometry/materials
- matrix/color updates per visible unit
- effects may use pools

Simulation direction:

Start simple.

Use lightweight records/arrays and profile before reaching for typed-array ECS complexity.

We do not need 600 heavyweight physics bodies, physics engines, or independent animation loops.

## 13. Collision philosophy

Do not start with a general-purpose physics engine.

This game mainly needs predictable arcade interactions:

- projectile vs enemy
- enemy vs squad danger zone
- reward and optional gate target regions
- obstacle boundaries

Prefer purpose-built spatial tests first.

If crowd size requires acceleration, introduce a simple spatial grid.

## 14. Dev Panel contract

Dev Panel is a first-class subsystem, not debug leftovers.

Initial eventual sections:

```text
Session
- pause/resume
- time scale
- seed
- restart

Squad
- set/add/remove soldiers
- move speed
- formation spacing

Weapon
- damage
- fire rate
- projectile speed

Enemies
- default HP
- spawn 10
- spawn 100
- clear

Level
- checkpoint jump
- boss jump

Snapshots
- save slot
- load slot
- delete slot
- export
- import

Performance
- FPS
- visible soldiers
- visible enemies
- draw calls
```

Build this incrementally. Never add non-functional controls.

## 15. Input

Defense mobile:

- visible bottom left/right buttons call the authoritative `Simulation.stepLane`
- `LaneStepInput` owns a single hold clock: immediate step, 180 ms delay, then 120 ms repeats
- pointer capture keeps the pressed direction; release/cancel/lost capture, blur, hidden document, Pause, death, Retry and disposal clear ownership
- no viewport tap steering or legacy invisible bottom band is constructed in defense mode
- non-passive touch guards and CSS suppress native long-press selection, callouts, menus and dragging on movement buttons

Legacy mobile modes retain touch/pen horizontal drag and their existing steering band behind the mode boundary.

Desktop development:

- A/D or arrow keys
- P or Space to pause/resume

Defense keyboard lane holds share the button hold clock; physical pointer clicks do not add a second move after pointerdown. Keyboard/assistive button activation still performs one step. `CombatControlStrip` owns only DOM layout/buttons; `XpHud` renders inside its center and has no movement logic.

Mouse movement does not steer. Range inputs retain keyboard focus so arrows adjust sliders without steering.

Input is converted into a simulation-friendly command/state.

Do not let simulation read DOM events directly.

## 16. Coordinate model

Initial gameplay coordinates:

- X: horizontal lane movement
- Y: vertical/up if needed for visuals
- Z: battlefield depth; Defense player is fixed at zero, retained non-defense player advances

The player primarily controls X.

Avoid coupling gameplay distances to pixels.

## 17. Camera

Portrait perspective camera.

The camera is not gameplay truth.

Initial camera should clearly show:

- squad at lower part of screen
- upcoming threats and rewards
- enough forward distance to make route decisions

Exact art direction comes after the grey-box loop feels good.

## 18. Product sequencing

Product sequencing lives in ROADMAP.md. This document should remain stable through gameplay pivots. Its contracts are simulation/render separation, deterministic gameplay, runtime-loaded data, serializable state, instanced crowd rendering, and presentation-only visual/audio feedback.

## 19. Early performance target

Not a promise, but an engineering target for the playable prototype:

- modern iPhone/Android browser
- 60 FPS preferred
- 30 FPS minimum acceptable during early stress tests
- hundreds of visible units
- no catastrophic GC churn during normal play

We will measure before optimizing.

## 20. Explicit non-goals for the first playable version

- authentication
- multiplayer
- server-authoritative simulation
- database
- cloud save
- monetization
- app store packaging
- procedural meta game
- gacha
- base building
- inventory system
- generic ECS
- generic physics engine
- production analytics

If the little game is not fun, none of those matter.

P2A extends the authored level plan with explicit `rifle` / `machineGun` families. XP count equals plan length minus one; stages are non-regressive within a family, while the Rifle→MG boundary resets stage/count to one. Family is derived from authoritative progression plus snapshot configuration, not duplicated in a weapon inventory. The retained primary-member clocks/composition slots serve both families; MG emits a distinct presentation kind through the existing lane/collision/lethal-XP path. Evolution replaces living members and clears old-family projectiles/clocks without contact events. App defense-loss/audio feedback excludes this transformation, preserving actual same-frame contact events. The renderer swaps one shared held-weapon geometry, reuses muzzle/tracer batches and samples automatic-fire audio at at most nine short two-pulse voices/second. Rifle cues and startup activation are unchanged.

The temporary closed-playtest `postCapSurvival` layer is isolated in its own config/helper. One config switch disables it; missing configuration defaults off. Its integration points are future ordinary-group settings, one post-authored-phase scheduler call, and plain schedule snapshot initialization/validation/copying. It neither changes progression/weapon families nor owns Heavy/Giant/Grenade combat. Removing the helper/config and these hooks restores capped play; UI, archetypes, MG evolution and the one-time release need no redesign. Three clocks record activation and the next fixed Giant/Supply opportunities; occupied/full slots advance without queues. Existing Giant interior placement and shootable Supply collision/acquisition are reused. Supply metadata uses an explicit optional `destruction.mode: staged` record with stage 0/1/2, captured recovery duration and a simulation-time recovery deadline. Only eligible primary projectile collisions advance a stage; recovery collisions are consumed without queued damage. The third eligible hit awards inventory immediately and emits an opening event with world origin and reward amount. Missing destruction metadata retains legacy `hitsRequired`/`hitProgress` behavior; both hit fields absent identify historical one-hit crates. Missing legacy Grenade configuration retains one-hit defaults, and config without `supplyDestruction` continues to create hit-count crates. Mixed legacy/staged metadata and invalid stage/recovery clocks are rejected. Renderer geometry, staged procedural audio and the pooled three-item HUD transfer consume events on the pausable presentation clock. They never own inventory or serialize GPU/DOM state; restore emits no replay events and Retry resets presentation. Supply metadata also distinguishes an additive +1 crate from the teaching fill-to-cap crate; reserve inventory may reach capacity during an existing flight. No landing-assault/reinforcement state is involved.

### Authored Carnival boundary

`simulation/carnival.ts` owns a single deterministic phase with pending/active/complete/skipped status, an activation timestamp, elapsed simulation time and consumed opportunity index. Activation follows the existing one-time MG release; progression does not determine completion. While active, it admits only seeded authored Grunt batches, caps additional admissions, consumes ordinary time slots, and suspends Giant/survival scheduling. Full/missed slots never queue. At completion, `Simulation` hands ownership to the existing temporary survival helper with fresh clocks. That handoff is the extension point for later authored content; no generic campaign system is introduced.

Configuration is snapshot data and defaults disabled when absent. Snapshots predating Carnival skip it once the release/established MG state exists; they never receive retroactive waves. New phase fields are validated and copied as plain data. Existing isolated DEV reviews disable Carnival; post-phase late entries explicitly skip it, while the CARNIVAL entry uses a pending release. Renderer resources and UI selection remain outside simulation snapshots.

### Stationary Defense admission and compatibility

Defense movement keeps authoritative player Z at zero. Enemy speed configuration contains the full approach rates (Grunt .85, Heavy .72, Giant .68); the legacy player `forwardSpeed` remains for non-defense only. Existing enemy-relative contact sweeps and defense-line casualties operate against this stationary position. Rendering continues to consume the same player-relative projection.

`simulation/enemies/defenseWaves.ts` owns one plain `nextAtSeconds` deadline. Configured first delay and interval replace distance admission after the unchanged startup fill; future groups use a fixed defense-relative spawn origin. The row cursor identifies deterministic compositions, not travel. MG release consumes one ordinary slot; active authored/legacy assault phases consume scheduled slots without admitting ordinary groups. Missed slots cannot accumulate a handoff burst. Carnival and temporary survival retain their own lifecycle clocks.

`defenseMotionVersion: 2` marks full enemy approach speeds. Missing version in accepted old Defense config migrates each enemy speed by the former .6 approach contribution exactly once. Restoring an old nonzero-Z Defense snapshot subtracts its player origin from enemies, projectiles and airborne Grenade endpoints, then sets player Z to zero. Already-relative supply/pickup/gate coordinates and progression/weapon/phase clocks stay unchanged. A missing wave deadline is derived once from the old next wave row and remaining distance at the accepted .6 pace; no virtual moving player persists. Both six-level and eight-level plans remain valid. Arbitrary historical forward-speed overrides were not serialized and cannot be reconstructed; compatibility uses the accepted baseline. Non-defense snapshots retain their coordinates and movement.
