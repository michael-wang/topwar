# TopWar

A mobile-first, five-lane Beachhead Defense playtest. TypeScript, Vite, Three.js and Vitest; no backend.

Defeat ends with 「作戰失敗」, survival time, total kills, accuracy and 「再試一次」 over a frozen battlefield, with the discouraged Commander and soldier seated together. This presentation and the lighter, faster-clearing enemy artillery impact smoke await Pixel 8 review; gameplay and other accepted VFX are unchanged.

## Develop and verify

Use the Node version in `.node-version`.

```powershell
npm ci
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
npm test
npm run typecheck
npm run build
```

「開始遊戲」 activates audio. Hold the bottom arrows or use A/D/arrow keys to move between adjacent lanes; Q throws a Grenade. Pause suspends gameplay. Retry starts the selected scenario again.

Local Vite and the GitHub Pages closed-playtest build share one hatch with four one-tap scenes: 🚢 驅逐艦進場 (complete movement, Commander voice and real artillery), 🚨 BOSS 進場 (remaining Lv8 crowd, Tank entrance/voice and real battle), 🏆 勝利結算 (Tank finale, victory communication/music and results marked DEV 範例戰績), and ✈️ 空中支援 (manual Phase-3 review at Lv10 / 3 MG / 2100 Boss HP: the Commander announces readiness, then the player optionally calls the real raid with the aircraft button; manual bombing can finish the Boss). Each selection closes the menu; 返回一般遊戲 resets to the authored normal run. Only DEV includes balance/audio and Wake Lock/checkpoint QA under collapsed 進階調校, including the optional [fullscreen technical trial](docs/FULLSCREEN_TRIAL.md). Older fixture presets remain available to regression scripts, not menu buttons. Production includes only the four approved scene initializers, not the old regression/stress tools. The menu warns that scene changes replace current progress. Each scene supports Pause/Continue/Retry; Victory previews also preserve explosion/radio progress.

## Current game

DEV advanced controls also open an isolated [GIANT effects review](docs/GIANT_REVIEW.md) in a separate tab. It uses real MG damage and leaves the owner's normal checkpoint untouched, including on Pause/Retry/reload. GIANT arrival, hit variation, tight grounded collapse and no persistent fire are Pixel 8 accepted. The #33 amplified localized rising smoke awaits physical review. QA usability review remains separate.

Ordinary New Game now shows the silent Battlefield Diorama and centered 「開始遊戲」. Continue restores paused and bypasses it; Retry restarts immediately. Earlier base/house/craft styling is accepted, but the current P4.39/#22 Diorama composition is implemented and NOT owner-approved. The approved calm Greek coast / distant transports / guarded defenders direction, with invasion only after Start, is NOT implemented. Red Alert and Commander changes remain proposed only.

Rifle levels 1–5 lead to MG levels 6–12. Lv4 introduces the Giant. Lv6 starts the 3.2-second Carnival and persistent Destroyer entrance. AHEAD Survival takes over at +3.2 seconds, with its first mixed wave at +4.2 seconds. At Lv9, the giant Tank Boss lands in 2.5 seconds and takes over with three HP phases, artillery and flank troops. The user-provided family-original 135.302-second `boss-theme.mp3` starts at INTRO and loops continuously through phases 1/2/3 without restarting; defeating it leaves a wreck, plays a skippable upper Commander victory communication after the explosions, then shows 第一關通關！, Traditional Chinese combat results and 再玩一次. Golden Grenades accumulate without a gameplay inventory cap.

Newly authored Stage 1 uses one optional PLAYER-COMMANDED heavy bomber raid. Once the Tank is active in Phase 3 and the Commander's readiness notice completes, the glowing aircraft button above Grenade is ready; the player can call once or never call. There is no HP/ETA automatic fallback. The manually called raid can deliver the Boss's lethal hit (up to 500 HP). The shared ✈️ Air Support quick-test demonstrates the same policy at Lv10 / 3 MG / 2100 Boss HP. Historical checkpoints keep their embedded automatic HP-by-squad or older triggers, 150-HP protection and player final shot.

Boss wreck wind smoke (#29) and compact Heavy death (#27) are Pixel 8 PASS / CLOSED. Hybrid D in-game production acceptance (#12) and Tracer V5 acceptance (#25) remain open.

See [GAME_SPEC.md](GAME_SPEC.md) for the accepted behavior, [ARCHITECTURE.md](ARCHITECTURE.md) for contracts and [ART_DIRECTION.md](ART_DIRECTION.md) for current art. Historical prototype gameplay is retired; Git history is its archive.

## Saves and phone testing

Fresh visits show immediate HTML loading feedback and a four-stage progress bar before modules/data. The bar counts actual completed data, character, battlefield and startup milestones, without simulated percentages; recovery selection rejoins the current stage. Reload recovery for slow/failed resources and the single 「開始遊戲」 gesture remain. Loading feedback/bar (#21) are Pixel 8 PASS; the owner has accepted the DEV fullscreen technical trial (#28), with Android/Chrome edge-swipe exit treated as expected. Supported mobile portrait Start now attempts optional fullscreen in the same gesture as audio; saved Continue remains paused and attempts only on its first Resume. Denial/unsupported browsers stay playable. Use 「全螢幕」 in the existing menu for explicit re-entry after an Android system exit. Combined Start/Resume and production HTTPS acceptance remain pending; see [Pixel 8 steps](docs/FULLSCREEN_TRIAL.md).

Manual Pause and page hiding save a bounded full-state checkpoint. After reload, Continue/New Game is available before asset initialization. Continue restores paused and explicit Resume activates audio and requests Screen Wake Lock. Returning to a surviving hidden page also remains paused.

Released Beachhead Defense eight- and ten-level saves keep their serialized progression, movement and encounter policies; saves authored before the Tank Boss retain their original Survival. Current checkpoints also preserve Tank HP, phase, position, attack/flank clocks and combat statistics. Ancient forward-running/Tier/Boss saves are unsupported and offer a safe fresh-start path. See [Pixel 8 testing](docs/PIXEL8_DEV_TESTING.md) and [current QA tools](scripts/qa/README.md).

## Manual deployment only

Production paths use `/topwar/` and content-addressed public assets. Run the quality gates above, then deliberately dispatch the existing **Deploy TopWar to GitHub Pages** workflow with the reviewed branch/tag/commit. It has no push trigger. No coding task deploys automatically.

The frozen `playtest-2026-10-08` tag must not be moved, deleted or recreated. Historical reports and experiments remain available in Git history.

Boss music asset: `public/audio/boss-theme.mp3` is user-provided family-original music (使用者提供的家人原創配樂). It is used unmodified from the approved handoff; public composer attribution awaits the user's confirmation.

For task-specific status/navigation, consult [CURRENT_STATE](docs/CURRENT_STATE.md) on demand. P4.40c lightweight UI (#36) is owner Pixel 8 PASS.
