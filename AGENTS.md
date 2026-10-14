# AGENTS.md — TopWar

These are binding instructions for coding agents working on TopWar. The user owns product direction and playtest acceptance. Implement only the task actually requested.

## Product north star: Fun First

TopWar is a mobile-web-first, portrait Beachhead Defense game. Optimize for **fun, clear feedback, satisfying combat, and fast iteration**—not maximum engineering ceremony.

Priorities, in order:

1. Make the requested player-visible improvement work and feel good.
2. Get feedback from real play, especially the user's physical Pixel 8.
3. Iterate quickly on that feedback.
4. Keep the active codebase small, understandable, and healthy.

Treat automated pilots, survival rates, screenshots, and benchmarks as diagnostic tools, **not substitutes for player experience**. Do not silently rebalance difficulty to make automated tests survive.

Do not invent player-protection rules, arbitrary inventory limits, automatic difficulty mitigation, or other gameplay restrictions. Preserve already accepted mechanics; change game design only when explicitly asked. In particular, Grenades accumulate without an artificial inventory cap (ordinary numeric safety still applies).

Do not build speculative features, future-proof unused systems, or keep retired gameplay "just in case." The current game is Defense, not the retired runner / Tier Merge / old Boss prototype. Preserve released **Defense** save compatibility, not obsolete prototype gameplay.

## Work on small, explicit tasks

1. Read the task and inspect only the relevant code and current project contracts.
2. Make the smallest coherent change; avoid unrelated refactors and abstractions.
3. Keep balance in authored configuration and supported runtime overrides, not scattered magic constants.
4. Validate in proportion to the actual risk (see below).
5. Report what changed, what was checked, and remaining limitations **briefly**.

Do not expand a short work order into a broad research, QA, optimization, or redesign project without a concrete reason. Prefer a small experiment players can try over an elaborate speculative system. Do not create temporary feature flags without a real need; remove them once they are obsolete.

The coding agent owns routine development setup: dependencies, Node/tooling alignment, builds, relevant tests, and ordinary Git work. Ask the user for intervention only when credentials, elevated privileges, or genuinely risky machine-wide actions are necessary.

## Practical quality gates

For **code changes**, ensure the project typechecks and a production build succeeds before reporting completion. The default is:

```bash
npm run typecheck
npm run build
```

Run **focused tests** for logic or contracts actually affected by the change. Add or update tests when they protect meaningful behavior or a regression, not merely to inflate the test count. Full `npm test` is appropriate for broad changes, central simulation logic, persistence/restore changes, cleanup that removes working code, or when explicitly requested; it is **not an automatic ritual** for every small visual/audio/balance tweak.

For documentation-only changes, no build or test run is required unless there is a concrete reason. For visual, audio, readability, difficulty, and performance judgments, phone playtesting is the acceptance signal; desktop captures and scripts help diagnose issues but cannot replace physical-device feedback. Never claim a Pixel 8 test unless the user actually performed it.

Avoid new large simulation batches, benchmark suites, golden traces, one-off QA scripts, and lengthy evidence reports unless a real risk or a specific request justifies them. Preserve existing useful tests; delete obsolete tests and tools when safe. Never report a check as passed if it was not run or failed.

## Engineering contracts worth protecting

- Stack: TypeScript, Vite, Three.js, Vitest; portrait mobile web first, desktop controls for development. No backend, accounts, monetization, database, or generic ECS unless explicitly requested.
- Simulation is authoritative and fixed-step. Gameplay RNG uses the project RNG abstraction, never `Math.random()`; determinism must not depend on rendering.
- `simulation/` must not import Three.js, use DOM/storage APIs, or serialize renderer objects. The renderer consumes plain simulation-facing state and owns disposable GPU resources.
- Existing active Defense checkpoints must continue to save/restore correctly, including their RNG and gameplay state. Do not preserve old prototype gameplay that has been intentionally retired.
- Keep production DEV/debug exposure narrow; no fake or broken controls.
- Be sensible about mobile CPU, GPU, memory, per-frame allocations, and cleanup/disposal. Optimize demonstrated problems rather than guessing; do not reduce accepted VFX simply to satisfy a synthetic metric.
- Do not silently break accepted gameplay or change public interfaces without a task-driven reason.

The current accepted contracts are in `GAME_SPEC.md` and `ARCHITECTURE.md`. When a new instruction intentionally changes one of them, update the affected contract rather than retaining contradictory text.

When product requirements are materially ambiguous or conflict with existing specifications without clearly superseding them, ask the user rather than invent behavior. Update explicitly superseded requirements directly, without unnecessary clarification.

## End-of-day lightweight cleanup

When the user asks to wrap up the day's work, **check for and perform a small, safe cleanup** around what changed that day:

- Unused code, imports, assets, tests, and QA scripts.
- Stale comments, temporary debug paths, and obsolete feature flags.
- Outdated or duplicate documents and instructions.

Keep it lightweight: remove clearly dead material, preserve active functionality and Defense saves, and use only checks proportionate to the cleanup. Do not turn a nightly tidy-up into hours of auditing, mass deletion, or architectural refactoring. If a larger cleanup is truly warranted, report it separately for the user to prioritize; **do not start it automatically**.

Daily cleanup is triggered by the user's wrap-up request, not an unattended background task. A short summary of removals, checks, and anything deferred is enough.

## Documentation and delivery discipline

- `ROADMAP.md` records the **current** NOW, at most three concrete NEXT items, and broad LATER possibilities—no historical milestone accumulation.
- `GAME_SPEC.md` records accepted gameplay, not imagined future mechanics.
- `ARCHITECTURE.md` records durable engineering constraints, not a project diary.
- Remove superseded instructions instead of stacking contradictory documents; Git history retains the past.
- Keep Codex handoffs concise. No large cleanup reports or machine-readable inventories unless requested.
- Commit and push only the requested, checked changes as appropriate. State the commit and any relevant limitations.

## Release protection — non-negotiable

- **Never deploy automatically.** GitHub Pages publishing requires the user's explicit manual authorization/action.
- **Never alter or move the frozen tag `playtest-2026-10-08`.**
- A push to `main` is **not** permission to publish.
- Do not start unrequested gameplay features, even if they are mentioned as possible future directions.
