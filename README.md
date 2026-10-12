# TopWar

A mobile-first, five-lane Beachhead Defense playtest. TypeScript, Vite, Three.js and Vitest; no backend.

## Develop and verify

Use the Node version in `.node-version`.

```powershell
npm ci
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
npm test
npm run typecheck
npm run build
```

Tap to Start activates audio. Hold the bottom arrows or use A/D/arrow keys to move between adjacent lanes; Q throws a Grenade. Pause suspends gameplay. Retry starts the selected scenario again.

The quiet tool hatch opens local DEV controls: LATE (Lv10), CRATE3, CRATE8, NAVAL; collapsible MG TEST, SURVIVAL TEST, NAVAL BARRAGE and BOSS TEST; authored tuning and audio controls. BOSS TEST offers INTRO (Lv9 landing with a remaining Lv8 crowd), PHASE 1/2/3 (100%/65%/30% HP) and FINISH (2% HP), all playable and recoverable. The small FPS label measures actual rendered RAF intervals. Production ships only the restricted recovery/screen-sleep QA panel, never the full tuning tools or test-only fixtures.

## Current game

Rifle levels 1–5 lead to MG levels 6–10. Lv4 introduces the Giant. Lv6 starts the 24-second Carnival and persistent Destroyer entrance. AHEAD Survival starts at +27 seconds. At Lv9, the giant Tank Boss lands in 2.5 seconds and takes over with three HP phases, artillery and flank troops. Its own battle theme builds across phases; defeating it leaves a wreck, plays a skippable upper Commander victory communication after the explosions, then shows 第一關通關！, Traditional Chinese combat results and 再玩一次. Golden Grenades accumulate without a gameplay inventory cap.

See [GAME_SPEC.md](GAME_SPEC.md) for the accepted behavior, [ARCHITECTURE.md](ARCHITECTURE.md) for contracts and [ART_DIRECTION.md](ART_DIRECTION.md) for current art. Historical prototype gameplay is retired; Git history is its archive.

## Saves and phone testing

Manual Pause and page hiding save a bounded full-state checkpoint. After reload, Continue/New Game is available before asset initialization. Continue restores paused and explicit Resume activates audio and requests Screen Wake Lock. Returning to a surviving hidden page also remains paused.

Released Beachhead Defense eight- and ten-level saves keep their serialized progression, movement and encounter policies; saves authored before the Tank Boss retain their original Survival. Current checkpoints also preserve Tank HP, phase, position, attack/flank clocks and combat statistics. Ancient forward-running/Tier/Boss saves are unsupported and offer a safe fresh-start path. See [Pixel 8 testing](docs/PIXEL8_DEV_TESTING.md) and [current QA tools](scripts/qa/README.md).

## Manual deployment only

Production paths use `/topwar/` and content-addressed public assets. Run the quality gates above, then deliberately dispatch the existing **Deploy TopWar to GitHub Pages** workflow with the reviewed branch/tag/commit. It has no push trigger. No coding task deploys automatically.

The frozen `playtest-2026-10-08` tag must not be moved, deleted or recreated. Historical reports and experiments remain available in Git history.
