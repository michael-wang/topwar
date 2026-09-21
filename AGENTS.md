# AGENTS.md — TopWar

This file contains project rules for coding agents. Treat these as constraints, not suggestions.

## Role

You are an implementation engineer.

The product architecture, scope, and acceptance criteria are defined by the task you are given and by the project documentation. Do not redesign the project unless the task explicitly asks you to.

When requirements are ambiguous, prefer the smallest implementation that satisfies the acceptance criteria and preserves the architecture below.

## Product priorities

TopWar is a gameplay-first, mobile-web-first prototype.

The development loop matters as much as the game itself:

1. A gameplay value should be testable in seconds.
2. Balance data must be adjustable at runtime.
3. The current gameplay state must be easy to save and restore.
4. Gameplay simulation must remain independent from rendering.
5. The project must stay easy to reason about and easy to delete/refactor.

Do not optimize for production backend, monetization, accounts, analytics, stores, or app packaging unless a task explicitly requests it.

## Technical baseline

- TypeScript
- Vite
- Three.js
- Vitest
- Mobile web first
- Portrait gameplay, approximately 9:16
- Desktop mouse support for development
- No backend required for gameplay

Do not replace this stack without an explicit task.

## Architecture boundaries

The intended dependency direction is:

```text
game-data
   ↓
ConfigStore
   ↓
Simulation ← DevTools / SnapshotSystem
   ↓
RenderState
   ↓
Three.js Renderer
```

Rules:

- `simulation/` MUST NOT import Three.js.
- `simulation/` MUST NOT access DOM APIs.
- `simulation/` MUST NOT read localStorage directly.
- `simulation/` MUST NOT call `Math.random()`.
- Rendering may depend on simulation-facing interfaces or render snapshots.
- Dev tools may command the simulation through explicit APIs.
- Persistence must serialize plain data, not Three.js objects.
- Game balance values must come from configuration, not hard-coded gameplay constants.
- Renderer state is disposable. Loading a snapshot must not require serializing GPU/Three.js objects.

## Determinism

Gameplay randomness must come through the project RNG abstraction.

A simulation state should be reproducible from:

- config
- level definition
- seed
- player input sequence

Do not use `Math.random()` in gameplay code.

The simulation should use a fixed timestep. Rendering may run at variable framerate.

## Data-driven gameplay

Do not scatter balance constants through implementation code.

Examples of data that belong in configuration:

- starting squad size
- squad movement speed
- formation spacing
- weapon damage
- fire rate
- projectile speed
- enemy HP
- enemy movement speed
- enemy count/density
- boss HP
- gate rewards
- level section positions

Configuration must be loadable at runtime.

During development, runtime overrides should be possible without rebuilding the project.

## Snapshot requirements

Gameplay state should be serializable when practical.

Snapshot data should eventually include:

- schema/version number
- simulation time/tick
- RNG state
- active level id
- player/squad state
- enemy state
- projectile state
- boss state
- level progression state
- runtime config overrides that affect the restored scene

Do not place DOM nodes, functions, class prototypes, Meshes, Materials, Textures, or other renderer resources into snapshots.

## Dev tools

Development tooling is a first-class feature.

The intended Dev Panel will eventually support:

- pause/resume
- time scale
- runtime config editing
- squad count changes
- enemy spawning
- jump to boss / checkpoints
- snapshot save/load
- snapshot export/import
- seed display/replay
- basic performance counters

Do not ship unfinished fake controls. A visible control must work.

Production builds must be able to disable development-only write/persistence endpoints.

## Performance philosophy

First make behavior correct and measurable. Then optimize proven bottlenecks.

For large visible crowds:

- prefer batched/instanced rendering
- do not create one heavyweight physics body per crowd member
- avoid one independent animation loop per entity
- use pooling where object churn becomes meaningful
- keep simulation data lighter than visual representation

Do not prematurely introduce a generic ECS/framework unless a task explicitly calls for it.

## Scope discipline

For every task:

1. Read the task and relevant project docs.
2. Inspect existing code before editing.
3. Make the smallest coherent change.
4. Do not perform unrelated refactors.
5. Do not rename public interfaces without need.
6. Add or update tests for logic introduced by the task.
7. Run the required checks.
8. Report exactly what changed and any known limitation.

If an acceptance criterion cannot be met, stop and explain the blocker instead of inventing a workaround that violates architecture.

## Quality gates

Before declaring a task complete, run the checks requested by that task.

Unless the task says otherwise, the expected baseline is:

```bash
npm test
npm run typecheck
npm run build
```

Do not claim success if a required command fails.

## Coding style

- Prefer small modules with explicit responsibilities.
- Prefer plain data and functions in simulation code.
- Avoid clever abstractions until there are at least two real use cases.
- Avoid global mutable state.
- Keep interfaces narrow.
- Name units when ambiguity is possible (`seconds`, `unitsPerSecond`, etc.).
- Add comments for invariants and non-obvious decisions, not line-by-line narration.
- Fail loudly on invalid development configuration rather than silently substituting nonsense.

## Forbidden shortcuts

Do not:

- hard-code balance values in gameplay systems
- import Three.js into simulation
- use `Math.random()` for gameplay
- make snapshot files depend on renderer objects
- add a backend because it is "more scalable"
- add authentication
- add monetization
- add a database
- add a generic ECS framework
- do broad cleanup outside the requested task
- silently change game design
- declare a task complete without running its acceptance checks
