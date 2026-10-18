# AGENTS.md — TopWar

## Scope and acceptance
- Fun First: portrait mobile-web Beachhead Defense; prioritize fun, clear feedback, satisfying combat and fast iteration. Owner controls direction and physical Pixel 8 acceptance. Screenshots, pilots and benchmarks are diagnostics; never claim device acceptance without owner evidence.
- Implement only the requested task with the smallest coherent change. No unrelated refactors, speculative features or unnecessary flags. Preserve accepted gameplay; no surprise balancing, difficulty mitigation or invented restrictions. Grenades have no artificial inventory cap.
- Agent owns routine setup, dependencies/tooling and Git. Ask for missing credentials, required privileges, risky machine-wide actions or materially ambiguous product requirements. Update explicitly superseded contracts directly.

## Read and validate selectively
- Start with the task; use `rg -n` (limit long matching lines) and narrow line ranges before full-file reads. Do not load the whole spec stack. Read [current state](docs/CURRENT_STATE.md) only when status/navigation matters, not for trivial tasks.
- Consult relevant sections: GAME_SPEC.md for gameplay; ARCHITECTURE.md for engineering; ART_DIRECTION.md for visuals. Update affected contracts when intentionally changed; remove contradictions.
- Code changes require `npm run typecheck`, `npm run build` and focused tests for affected logic/contracts. Add tests for meaningful regressions. Full tests suit broad/central simulation, persistence/restore or working-code removal changes, or explicit requests; not every visual/audio/balance tweak.
- Docs-only: check diff, links and status consistency; no build/tests without concrete reason. Never report unrun/failed checks as passed.
- Summarize test counts and actionable failures; keep long logs/screenshots in ignored `artifacts/`. Inspect failures narrowly, not successful log dumps. No large simulation batches, benchmark suites, one-off QA scripts or evidence reports without demonstrated need/request.

## Engineering protections
- TypeScript, Vite, Three.js, Vitest; no backend, accounts, monetization, database or generic ECS unless requested. Defense is current; retired runner/Tier Merge/old Boss prototypes need no compatibility.
- Simulation is authoritative, fixed-step and deterministic. Use project RNG, never gameplay `Math.random()`; rendering must not affect determinism. Keep balance in authored configuration/supported overrides.
- `simulation/` cannot import Three.js, use DOM/storage or serialize renderer objects. Renderer consumes plain state and owns GPU disposal.
- Preserve released Defense checkpoints, RNG and gameplay state. Keep production DEV exposure narrow and controls functional; no silent public-interface breaks.
- Respect mobile CPU/GPU/memory, per-frame allocations and disposal. Optimize demonstrated problems; never reduce accepted VFX or rebalance for synthetic metrics.

## Documentation and delivery
- ROADMAP: current NOW, at most three NEXT items, broad LATER. GAME_SPEC: accepted gameplay. ARCHITECTURE: durable constraints, not diaries. Handoffs: brief change, checks, limitations and SHA; do not repeat history.
- Only on owner wrap-up requests, perform small safe cleanup around that day's changes: clearly dead code/assets/tests/tools, stale docs/comments/flags. Preserve active behavior and Defense saves; defer larger audits. No unattended cleanup.
- Commit/push only requested, checked changes. Never deploy automatically: Pages requires explicit manual owner authorization/action; pushing main is not publishing permission.
- Never alter or move frozen tag `playtest-2026-10-08`. Future directions do not authorize implementation.
