# Field Observer assets

`neutral.webp` and `alert.webp` are original portraits generated for TopWar with OpenAI's built-in image generation tool on 2026-10-10. P3-B.2 edits use the accepted original portraits as identity/expression references, retaining the officer selected by the user rather than the discarded simpler toy-figure direction. No stock portrait, real-person reference, existing game character or downloaded art was used. Final in-game presentation remains subject to human playtest review. This records provenance, not a claim of exclusive copyright or public-domain status.

The P3-B.2 transparent PNG masters were resized proportionally to 320×320 and encoded as WebP (quality 88), retaining alpha. Both shipping assets total 49,158 bytes. Local review masters and before/after captures are under `artifacts/p3b2/`; only the lightweight WebPs ship. Both expressions use the same canvas and fixed 110×110 CSS-pixel bust slot. The cap breaks above the plaque and the shoulders below it. The 310×88 panel moves down 14px to clear the existing top controls; extra subtitle inset leaves space beside the bust. No new animation or renderer resources were added.

## Prompt set

Neutral edit (built-in imagegen): Use case: identity-preserve. Edit target: the supplied accepted TopWar Field Observer neutral portrait. Produce ONE transparent-background portrait asset, no UI or background. Preserve this exact young adult female officer identity, face, brown eyes, neat short brown hair, calm professional neutral expression, three-quarter gaze, rounded chibi proportions and soft enamel illustrated Toy Soldier style. This is a subtle polish, not a different character. Recompose as a close head-and-upper-chest bust for a mobile radio panel: face is the centerpiece, hat fully visible near the top, complete shoulder silhouette widening at the lower edge, bottom crop just below the lapels/upper chest (not waist). Tight practical composition with only a small transparent margin. Cap and jacket use a friendlier richer command blue/navy, noticeably clearer mid-blue highlights that belong with bright blue toy infantry, while darker navy outlines and structural panels preserve formality. Retain original small gold cap insignia, gold epaulette trim and buttons, ivory shirt and dark tie. No added props, headset, medals, text, glow, frame or floating accessories. Keep anatomy and facial proportions faithful to the reference. Genuine transparent alpha surrounding the bust. A clean coherent silhouette suitable for breaking slightly above and below a UI plaque.

Alert edit (built-in imagegen): Use case: identity-preserve. Image 1 is the EDIT TARGET: revised TopWar neutral Field Observer command-blue bust. Image 2 is EXPRESSION REFERENCE ONLY: her accepted old alert face. Output one transparent portrait, same canvas and crop as Image 1. Change ONLY the expression of Image 1 to calm professional alert concern: gently lift/draw brows and part the lips just slightly while speaking a focused warning, inspired by Image 2. Preserve all other pixels/forms as closely as possible: exact same character, face proportions, eye size, head position and angle, hair silhouette, cap, gold insignia, brighter command-blue uniform with navy structure, ivory collar, shoulders, light and shading, canvas proportions and transparent margins. No new elements, no wider eyes, no dramatic fear, no smiling, no change in gaze, no rescaling or repositioning. Neutral and alert must register at identical mobile layout coordinates with no portrait jump. Genuine transparent alpha.

## Prerecorded dialogue

Historical C recording (replaced byte-for-byte by the 2026-10-22 approved take below): `public/audio/observer_destroyer_zh-TW.mp3`. Supplied by the project owner and explicitly human-approved as a provisional female Field Observer performance on 2026-10-10. The retired take remains recoverable in Git history. Performer/service and separate license details were not supplied; approval is recorded from the owner's integration instruction.

- Bytes: 103455.
- SHA-256: `3e54fc46e2efbb050b7cb0ab6d863c4a938e13436214e83ef81d56faf3806ae8`.
- Chrome decoded duration: 5.40734694 seconds, mono (the supplied estimate was approximately 6.48 seconds). The configured 7.2-second window accommodates both.
- Traditional Chinese subtitle: 注意，左前方發現敵方驅逐艦！準備閃避砲擊。完畢！

English has no approved recording and its manifest entry remains null: the English resources remain dormant while the closed playtest always uses Traditional Chinese, with no missing-file request. No SpeechSynthesis or placeholder speech is used.

Mission-intro bytes prefetch before Start without creating an AudioContext or playing. Decoding begins after the Start gesture creates the context; speech waits for successful activation. `publicAssetUrl` supplies the GitHub Pages base path and build cache version. Assets decode once per asset; failures fall back to subtitles. Runtime WebAudio applies mild communication-band filtering and independent music/weapon ducking. Pause resumes from the presentation offset; Retry and locale switches cancel stale playback. Historical snapshots retain their saved encounter schedules; a window shorter than the decoded recording uses subtitles instead of truncating the voice.

The new fixed radio window is 1.3–8.5 seconds, first shot 8.8 seconds. All later attacks and departure shift by three seconds, preserving their spacing; no combat timing depends on playback callbacks.

### Commander introduction and victory

The officer is now presented as 戰區指揮官, retaining her existing identity, uniform and art style. Command uses neutral; Victory uses neutral until the owner supplies art/observer/victory.webp. No new portrait has been generated.

The earlier 10.188s mission recording (SHA-256 57accbe2425b421369639802e15da432c9cf241fd538a51f129fbdaf8a377506) is retired from shipping by P4.44g and remains recoverable in Git history. Victory remains unchanged: public/audio/commander_stage1_victory_zh-TW.mp3, 155,700 bytes, 8.673s, SHA-256 d25277d0217f81128fde4f00246b0ee4f330f507343fa68a589ed1f2c9e2a81b; captions at 0/3.76/5.56/7.38s. Both communications use decoded duration +.35s; failed media uses subtitles. The opening gates combat until completion/Skip; Victory follows Tank explosions.

Tank-intro asset: `public/audio/observer_stage1_boss_intro_zh-TW.mp3`, supplied by the project owner in the P3-B.9B.5 handoff on 2026-10-13 and copied unchanged. 90,498 bytes; SHA-256 `51e007a7e927e6eb54903524f9c13ef027597ee0747dc9d92892aa91618aebb6`. Supplied duration approximately 4.6 seconds, 44.1 kHz mono. Subtitle: 警告！發現敵軍超重型坦克！正朝我方防線推進！ Speech begins at Tank entrance +0.3s in a five-second window; the 2.5-second landing and combat schedule remain independent. Existing radio filters, music/weapon ducking and Pause/Resume are reused; restoring an already-triggered message keeps remaining subtitles without replaying speech. No English recording.

### P4.44d approved Commander recordings

Owner supplied and listening-approved two ElevenLabs Mandarin takes in the handoff ZIP. Original MP3 bytes copied unchanged, mono 44.1kHz; no trimming, normalization or re-encoding. The recurring role is 戰區指揮官. Owner/Julia Pixel 8 opening acceptance is complete.

- P4.44g canonical production selection: public/audio/commander_stage1_intro_zh-TW.mp3, 174925 bytes, SHA-256 f5b80857ad41dfd1fd97f16210f319b3a8b41b106a7f8998b7d6d2b28c912a1f. Chrome decoded 9.874270833s; complete window 10.224270833s. Four captions at 0 / 1.88 / 5.12 / 7.63s relative to actual speech start; Chrome PCM silence boundaries corroborate the supplied estimates. Promoted byte-for-byte from the approved review MP3; the duplicate review filename is retired.
- GIANT: public/audio/commander_giant_warning_zh-TW.mp3, 86736 bytes, SHA-256 60c991c1d29632fd809343cec61b26c3aa691e183cf61855f05b1294b7b32db9. Chrome decoded 4.3624375s; window 4.7124375s. Existing combined two-sentence subtitle retained throughout. Integrated into the existing radio filter/ducking and bounded readiness/priority queue, without changing simulation.

The canonical observerMissionDialogue and missionIntroTiming now use these approved four lines and offsets; all other approved recordings/timings remain. New files use the existing content-addressed build manifest; dormant English has no voice.

### 2026-10-22 Owner-approved C/E/F recordings

Owner supplied `topwar_commander_CEF_approved_audio_2026-10-22.zip`, with `CODEX_HANDOFF.md` mapping the chronological generation/attachment order to C, E, F. Source: ElevenLabs, approved Chinese female Commander voice, v4, 2026-10-22. All three takes are Owner listening-approved. Codex verified hashes and Chrome decoding, but did not independently listen/transcribe the content; mapping follows the approved handoff. This records provenance, not a separate voice license or copyright claim. Original MP3 bytes are copied unchanged; no generation, re-encoding, normalization, gain changes or trimming of the files.

| Cue | Shipping MP3 under `public/audio/` | Bytes | SHA-256 | Chrome decoded at 48 kHz |
|---|---|---:|---|---:|
| C | `observer_destroyer_zh-TW.mp3` | 90497 | `22a7500e1e5462b1ab2a83df0e524cbe7b599b3d061ef3fa1ecb46b1eadc1ae8` | 4.597541667 s |
| E | `commander_air_support_ready_zh-TW.mp3` | 76287 | `a8a9461c0d2ed08a4c505b970531b4cabf586120a3702f1c662ed6ce125c655e` | 3.709375 s |
| F | `commander_air_support_called_zh-TW.mp3` | 72525 | `7b242728f1afe037862be0077205535c597eb442924c686d9f275e478f91cf00` | 3.474270833 s |

- C: 「注意，左前方發現敵方驅逐艦！準備閃避砲擊」. Existing saved Destroyer radio/attack schedules are unchanged; the normal 7.2-second communication window accommodates the full take.
- E: 「空中支援已經待命！隨時可以下令！」. New manual support uses its own file from offset 0; READY unlock follows the complete decoded duration + .35s (fallback 4.059375s).
- F: 「轟炸編隊正在進場！準備進行打擊！」. Plays only after an actual player call, from offset 0; complete decoded duration + .35s (fallback 3.824271s). The 7.5s call-to-first-bomb delay and six-round sequence remain unchanged.

The original `commander_air_support_zh-TW.mp3` remains byte-identical (SHA-256 `82d89bc1d88ea44a8226255a8de74af3896f1e46b905c5d15f49bc1347c7faea`). Historical automatic-support checkpoints retain its original two subtitles, 3.05s phrase boundary and 6.95s window. Current manual E/F never seek those legacy offsets. All existing radio gain/filter/ducking, Pause/Resume/Restore/Retry and A/B/D/G assets remain unchanged. Missing, denied or late manual voice uses its matching subtitle window without delayed partial speech. Integrated phone voice/subtitle/READY synchronization awaits Owner Pixel 8 PASS; Issue #24 stays open. No Pages deployment.
