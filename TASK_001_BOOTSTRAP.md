# Codex Task 001 — Bootstrap the TopWar repository

## Context

Read these files first:

- `AGENTS.md`
- `ARCHITECTURE.md`
- `GAME_SPEC.md`

You are implementing only the repository bootstrap.

Do not implement gameplay systems, Dev Panel, snapshots, config editing, enemies, weapons, or level logic in this task.

## Goal

Create the smallest clean Vite + TypeScript + Three.js project that proves:

1. the app boots in browser
2. Three.js renders
3. tests/typecheck/build work
4. the repository is ready for later architecture tickets

## Required dependencies

Runtime:

- `three`

Development:

- `vite`
- `typescript`
- `vitest`
- `@types/three` if required by the selected Three.js version

Do not add React, Vue, Svelte, a physics engine, ECS framework, CSS framework, state-management library, or backend.

## Required scripts

`package.json` must provide:

```json
{
  "scripts": {
    "dev": "...",
    "build": "...",
    "test": "...",
    "typecheck": "..."
  }
}
```

Use normal ecosystem commands.

## Required initial behavior

When `npm run dev` is opened:

- show a Three.js canvas
- use a portrait-oriented gameplay viewport/container that remains usable on desktop
- render a simple neutral ground plane
- render one clearly visible blue placeholder unit
- use a perspective camera
- render continuously using `requestAnimationFrame`
- resize correctly when the browser/container size changes

This is only a rendering smoke test.

Do not add movement, firing, enemies, game loop simulation, or gameplay logic.

## Required code organization

Create only the modules needed for this task.

A reasonable target is:

```text
src/
  main.ts
  app/
    GameApp.ts
  rendering/
    GameRenderer.ts

tests/
```

Do not pre-create many empty files/directories from the future architecture.

### `GameApp`

Responsibility:

- application lifecycle glue
- start/stop/dispose coordination

It must not become a god object.

### `GameRenderer`

Responsibility:

- create Three.js scene/camera/renderer
- create the smoke-test ground + placeholder unit
- render frames
- respond to resize
- dispose owned Three.js resources

This task has no simulation.

## Portrait viewport

The page should make the intended target obvious.

Requirements:

- mobile browser: use available width naturally
- desktop: center a portrait gameplay area rather than stretching to ultrawide
- approximate 9:16 presentation
- no horizontal page scrolling
- canvas should resize with the container
- account for normal mobile browser resizing; do not hard-code a single device resolution

Keep styling minimal.

## Lifecycle

Avoid leaking animation frames/listeners.

`GameApp.stop()` / `dispose()` should leave no active RAF loop or resize listener.

Implement lifecycle in a way that can later accommodate a fixed-step simulation loop without rewriting the renderer.

Do NOT implement the fixed-step loop in this task.

## Tests

Add focused tests for any pure helper logic you introduce.

Do not write brittle Three.js pixel/render snapshot tests.

At minimum, ensure the test command is wired and contains one meaningful smoke/unit test for pure logic if pure logic exists.

If this task genuinely introduces no useful pure helper, a minimal test for an extracted viewport/aspect helper is acceptable.

Do not test implementation trivia just to inflate test count.

## README

Create a concise `README.md` containing:

- what TopWar currently is
- prerequisites
- install
- dev command
- test command
- typecheck command
- build command

Do not write a giant future product document; the other docs already cover that.

## Acceptance criteria

The task is complete only if all are true:

- [ ] Vite + TypeScript project boots successfully.
- [ ] Three.js renders a ground plane and one blue placeholder unit.
- [ ] Desktop presentation is visibly portrait-oriented.
- [ ] Mobile layout uses available screen width without horizontal scrolling.
- [ ] Resize works.
- [ ] There is exactly one active render loop.
- [ ] Render loop can be stopped/disposed.
- [ ] Renderer-owned Three.js resources are disposed.
- [ ] No gameplay system has been added.
- [ ] No React/UI framework/physics/ECS/backend dependency has been added.
- [ ] `npm test` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.

## Before finishing

Run:

```bash
npm test
npm run typecheck
npm run build
```

If any command fails, fix it before reporting completion.

## Final report

Keep the final report short and include:

1. files/modules added
2. commands run and whether they passed
3. any small limitation discovered

Do not propose unrelated refactors or start Task 002.
