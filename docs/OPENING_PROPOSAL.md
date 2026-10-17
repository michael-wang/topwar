# Opening experience — PROPOSED — NOT APPROVED FOR PRODUCTION

Design preparation for #22 / #23 / #28. No Attract, Red Alert, Commander or public fullscreen changes are implemented. GIANT review is a separate DEV tool.

## Two attract concepts

Both follow the existing honest loading cover. Keep a large centered **「開始遊戲」** in navy/gold/ivory above the scene, inside safe areas, throughout the loop. No audio, authoritative Simulation, gameplay RNG, XP, damage or checkpoint reads/writes belong to the demonstration. Use a fixed presentation timeline and decorative actors. Demonstration bombing must never imply automatic support in real Stage 1.

| | A — Battle Showcase | B — Animated Battlefield Diorama (recommended) |
|---|---|---|
| Composition | Camera B beach; blue squad low foreground; enemy action behind the centered Start. Keep the CTA visually clear. | One fixed beach tableau: blue squad foreground, small distant enemy formations near the horizon, sea/architecture framing centered Start. |
| Loop | Silent 14s: 0–4s MG defense and advancing Grunts/Heavies; 4–8s mechanical GIANT advance; 8–11s distant Tank silhouette; 11–13s brief bomber pass; 13–14s settle/crossfade to opening pose. Spectacle stays behind the CTA. | Silent 14s: slow cloud/sea movement, subtle squad breathing, occasional distant MG flashes, distant formations shifting slightly; return seamlessly to the initial poses. No recurring large explosions. |
| Pixel 8 cost | More animated geometry, transparent smoke/overdraw and continuous GPU work; the higher idle battery/heat risk. Existing effects are bounded, but full combat rendering should not run idle. | Fewer animated actors and little transparency; mostly static framing, so lower expected idle GPU/battery cost. Start with a capped 30Hz presentation and render only when needed. This is a proposal, not a measured device budget. |

Recommend **B first** for phone idle use; reserve A for a later owner-selected showcase if desired. Both stop rendering while hidden, respect reduced motion with a still composition, and dispose/reuse their bounded resources at Start. Actual Pixel 8 idle heat, battery and resume testing must decide the budget; desktop screenshots cannot establish it.

## Proposed Red Alert opening

Current facts: `main.ts` shows loading/recovery before `GameStartOverlay`; one Tap-to-Start calls `GameAudio.activate()`, then combat begins. `FieldObserver.startMission(0)` currently schedules the intro at combat +0.2s, waits up to 2.5s for voice/portraits and **does not gate gameplay**. The approved `commander_stage1_intro_zh-TW.mp3` is **10.188s** (mono 44.1kHz, unchanged owner recording); decoded duration +0.35s gives a **10.538s** presentation window, approximately the 10.54s subtitle fallback. Source: `public/art/observer/PROVENANCE.md`, `ObserverTimeline.ts`, `observerLocale.ts`.

Proposed first-New-Game storyboard, relative to activated presentation time; **holding combat for the briefing requires owner approval**:

| Time | Picture / audio |
|---|---|
| Start gesture | Latch once; initiate audio activation and optional supported fullscreen in this same event before awaiting either. Remove attract CTA; no second Start gesture. Failed audio/fullscreen must still permit play. |
| 0–1.2s | Short approved Red Alert cue, restrained red border/steady warning; reveal large distant formations. These are visual actors only, never Simulation admissions. No rapid strobe. |
| ~1.2–11.74s | Existing Commander portrait/subtitles and the **one complete existing recording**. Siren ends before speech. Do not layer, truncate, restart or replace it. Keep distant formation tableau quiet. Actual start follows readiness, with bounded subtitle-only fallback. |
| After briefing | Explicit visual handoff to real Lv1 combat at simulation time zero. Release decorative formations; ordinary enemies admit on their existing schedules. No bonus early wave, damage, XP or automatic support. |

Existing subtitle phrases, relative to voice start (current portrait timing scales by the complete presentation window):

| Offset | Existing subtitle |
|---|---|
| 0 | 這裡是海防指揮部。 |
| 2.06s | 其他防線已經失守，灘頭只剩你們這支部隊。 |
| 6.14s | 這裡是港口最後一道防線。 |
| 8.48s | 無論如何，守住它！ |

Moving this one briefing into pre-combat presentation would require separately approved clock ownership: suppress its ordinary combat-time duplicate, keep all original simulation-relative teaching/encounter clocks, and retain radio priority. No historical checkpoint schema or saved event clock should change. Backgrounding pauses the opening; return requires explicit Resume and continues its presentation/audio offset. If audio fails, complete the existing subtitle window once, then hand off.

## Reuse, approvals and recovery

- Reuse procedural Blue/Grunt/Heavy/GIANT families, authored Tank/bomber geometry, Camera B, coastal scene/clouds, pooled tracers and existing poses. Reuse neutral/alert Commander portraits, approved Mandarin mission audio/subtitles, startup cover, protected recovery dialog and Pause/lifecycle infrastructure. Do not add a video, duplicate live game, full audio decode or new asset bundle just for idle display.
- **Missing approval/assets:** opening-only Red Alert siren (no dedicated approved asset exists; do not revive the removed per-shell warning siren). Approve duration/mix and whether procedural synthesis suffices. No new Commander recording is needed for this proposal; any script/voice rewrite belongs to #24. Exact attract choreography and any new scene art need owner approval before creation.
- Continue keeps the current guarded recovery choice, loads the embedded historical state **paused**, and bypasses attract/Red Alert/mission replay. Explicit Resume owns audio; never reset encounter clocks. New Game keeps the deliberate checkpoint replacement and repeated-input protection, then enters attract with one Start. Merely displaying attract must never erase a save. Reload before combat may restart the unsaved presentation; no cinematic checkpoint migration is proposed. DEV Explosion Lab/GIANT review bypass this public opening.
- Fullscreen remains **DEV trial only**, now accepted by the owner on Pixel 8; observed Android/Chrome edge-gesture exits are expected platform behavior. HTTPS and production startup integration remain separate. Future integration should call `audio.activate()` first synchronously, then `requestFullscreen()` in that same gesture before any `await`, and handle both results independently. Fullscreen consumes transient activation; never wait for audio decoding/network first. Observe actual fullscreenchange/rejection, resize Camera B/HUD/safe areas, retain playable browser fallback and ordinary Pause/Wake Lock/context-loss behavior. Origin changes do not carry local saves. Sources: [Fullscreen standard](https://fullscreen.spec.whatwg.org/#dom-element-requestfullscreen), [Chrome audio activation policy](https://developer.chrome.com/blog/autoplay/), [local trial checklist](FULLSCREEN_TRIAL.md). The combined gesture still needs a physical test and approval before shipping.

## Owner decisions before implementation

1. Select A or recommended B and approve its silent scene content/idle budget.
2. Approve the short siren and full ~12s pre-combat opening, or choose combat handoff during the final line; decide Skip/reduced-motion treatment and whether Retry keeps today's immediate combat/one briefing rather than replaying the prelude.
3. Complete the existing Pixel 8 fullscreen trial; then approve optional single-Start/Resume fullscreen behavior and fallback. No PWA/iPhone infrastructure is proposed here.
