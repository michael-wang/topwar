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
- short runs
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
  "rifle": {
    "damage": 3,
    "fireRate": 7,
    "projectileSpeed": 28,
    "range": 18
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
- current enemy HP: separate explicit dev command if we want to mutate existing enemies

This distinction avoids spooky implicit state mutation.

### Development persistence

Runtime overrides can be persisted in localStorage.

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

### Snapshot invariant

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
- gate trigger regions
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
- speed
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

Mobile:

- pointer/touch horizontal drag

Desktop development:

- mouse horizontal drag
- optional A/D or arrow keys later, if useful

Use Pointer Events so touch and mouse share one path.

Input is converted into a simulation-friendly command/state.

Do not let simulation read DOM events directly.

## 16. Coordinate model

Initial gameplay coordinates:

- X: horizontal lane movement
- Y: vertical/up if needed for visuals
- Z: forward progression

The player primarily controls X.

Avoid coupling gameplay distances to pixels.

## 17. Camera

Portrait perspective camera.

The camera is not gameplay truth.

Initial camera should clearly show:

- squad at lower part of screen
- upcoming threats/gates
- enough forward distance to make route decisions

Exact art direction comes after the grey-box loop feels good.

## 18. Development roadmap

Keep tickets small.

### 001 — Bootstrap
Vite + TS + Three + Vitest, one visible test scene, quality scripts.

### 002 — Fixed-step loop + RNG
Pure core utilities with unit tests.

### 003 — ConfigStore
Runtime JSON loading, validation, overrides, local persistence.

### 004 — Minimal simulation
Player X position, forward progression, stable state shape.

### 005 — Squad rendering
Render N simple blue units from simulation state.

### 006 — Input
Pointer drag controls X.

### 007A — Level pacing data
Runtime-authored level definition and encounter pacing. No enemies yet.

### 007B — Enemy simulation/rendering
Consume level data to create visible enemy groups. No combat.

### 008 — Combat
Automatic firing and enemy damage/death.

### 009 — Dev Panel v1
Pause/time scale and selected runtime tuning.

### 010 — Snapshot v1
Named save/load slots + export/import.

### 011 — Crowd optimization
Instancing/performance pass with measurable target.

### 012 — Gates
Additive squad gates.

### 013 — Expanded level content
Build gates, sections, and progression on the level data from 007A.

### 014 — Boss
Boss HP, movement, win/lose.

### 015 — Feel pass
Hit feedback, death motion, muzzle flash, numbers, sound hooks.

Every ticket should be independently reviewable.

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
