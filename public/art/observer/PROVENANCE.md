# Field Observer assets

`neutral.webp` and `alert.webp` are original portraits generated for TopWar with OpenAI's built-in image generation tool on 2026-10-10. P3-B.2 edits use the accepted original portraits as identity/expression references, retaining the officer selected by the user rather than the discarded simpler toy-figure direction. No stock portrait, real-person reference, existing game character or downloaded art was used. Final in-game presentation remains subject to human playtest review. This records provenance, not a claim of exclusive copyright or public-domain status.

The P3-B.2 transparent PNG masters were resized proportionally to 320×320 and encoded as WebP (quality 88), retaining alpha. Both shipping assets total 49,158 bytes. Local review masters and before/after captures are under `artifacts/p3b2/`; only the lightweight WebPs ship. Both expressions use the same canvas and fixed 110×110 CSS-pixel bust slot. The cap breaks above the plaque and the shoulders below it. The 310×88 panel moves down 14px to clear the existing top controls; extra subtitle inset leaves space beside the bust. No new animation or renderer resources were added.

## Prompt set

Neutral edit (built-in imagegen): Use case: identity-preserve. Edit target: the supplied accepted TopWar Field Observer neutral portrait. Produce ONE transparent-background portrait asset, no UI or background. Preserve this exact young adult female officer identity, face, brown eyes, neat short brown hair, calm professional neutral expression, three-quarter gaze, rounded chibi proportions and soft enamel illustrated Toy Soldier style. This is a subtle polish, not a different character. Recompose as a close head-and-upper-chest bust for a mobile radio panel: face is the centerpiece, hat fully visible near the top, complete shoulder silhouette widening at the lower edge, bottom crop just below the lapels/upper chest (not waist). Tight practical composition with only a small transparent margin. Cap and jacket use a friendlier richer command blue/navy, noticeably clearer mid-blue highlights that belong with bright blue toy infantry, while darker navy outlines and structural panels preserve formality. Retain original small gold cap insignia, gold epaulette trim and buttons, ivory shirt and dark tie. No added props, headset, medals, text, glow, frame or floating accessories. Keep anatomy and facial proportions faithful to the reference. Genuine transparent alpha surrounding the bust. A clean coherent silhouette suitable for breaking slightly above and below a UI plaque.

Alert edit (built-in imagegen): Use case: identity-preserve. Image 1 is the EDIT TARGET: revised TopWar neutral Field Observer command-blue bust. Image 2 is EXPRESSION REFERENCE ONLY: her accepted old alert face. Output one transparent portrait, same canvas and crop as Image 1. Change ONLY the expression of Image 1 to calm professional alert concern: gently lift/draw brows and part the lips just slightly while speaking a focused warning, inspired by Image 2. Preserve all other pixels/forms as closely as possible: exact same character, face proportions, eye size, head position and angle, hair silhouette, cap, gold insignia, brighter command-blue uniform with navy structure, ivory collar, shoulders, light and shading, canvas proportions and transparent margins. No new elements, no wider eyes, no dramatic fear, no smiling, no change in gaze, no rescaling or repositioning. Neutral and alert must register at identical mobile layout coordinates with no portrait jump. Genuine transparent alpha.

## Prerecorded dialogue

Mandarin asset: `public/audio/observer_destroyer_zh-TW.mp3`. Supplied by the project owner and explicitly human-approved as a provisional female Field Observer performance on 2026-10-10. Copied unchanged from the supplied Downloads file; no generation, replacement, trimming, normalization or re-encoding. Performer/service and separate license details were not supplied; approval is recorded from the owner's integration instruction.

- Bytes: 103455.
- SHA-256: `3e54fc46e2efbb050b7cb0ab6d863c4a938e13436214e83ef81d56faf3806ae8`.
- Chrome decoded duration: 5.40734694 seconds, mono (the supplied estimate was approximately 6.48 seconds). The configured 7.2-second window accommodates both.
- Traditional Chinese subtitle: 注意，左前方發現敵方驅逐艦！準備閃避砲擊。完畢！

English has no approved recording and its manifest entry remains null: the English resources remain dormant while the closed playtest always uses Traditional Chinese, with no missing-file request. No SpeechSynthesis or placeholder speech is used.

Mission-intro bytes prefetch before Start without creating an AudioContext or playing. Decoding begins after the Start gesture creates the context; speech waits for successful activation. `publicAssetUrl` supplies the GitHub Pages base path and build cache version. Assets decode once per asset; failures fall back to subtitles. Runtime WebAudio applies mild communication-band filtering and independent music/weapon ducking. Pause resumes from the presentation offset; Retry and locale switches cancel stale playback. Historical snapshots retain their saved encounter schedules; a window shorter than the decoded recording uses subtitles instead of truncating the voice.

The new fixed radio window is 1.3–8.5 seconds, first shot 8.8 seconds. All later attacks and departure shift by three seconds, preserving their spacing; no combat timing depends on playback callbacks.

### Mission introduction

`public/audio/observer_mission_intro_zh-TW.mp3` was supplied by the project owner for provisional P3-B use on 2026-10-10 and copied unchanged. No generated replacement, trimming or re-encoding. Performer/service and separate license details were not supplied.

- Bytes: 107217.
- SHA-256: `8d681e6d96786f1ede9eccca1e455a74f92211f1c0e45ab685c67da2eca6ff84`.
- Supplied duration: approximately 5.64 seconds; Chrome decoded duration: 5.64244898 seconds.
- Intended Chinese transcript supplied by the owner: 「這裡是觀測官。」「敵軍正朝港口逼近！」「請守住防線。完畢！」
- Provisional approved English subtitles: “Field Observer here.” / “Enemy forces are approaching the harbor!” / “Hold the line. Over.” No English speech asset.

The existing radio panel shows one phrase at a time. At mission time 0.2 seconds, the presentation can wait up to 2.5 simulation seconds for voice readiness while gameplay continues. It then begins from offset zero or uses subtitles only. Phrase offsets are 0 / 1.5 / 3.7 seconds in a 6.2-second presentation window. Timing is approximate, not a transcription derived from audio. The supplied script and actual recording need human listening confirmation; no claim is made that they were independently matched by an automated transcript.

Gameplay continues during the introduction. The same voice player, filters, radio beeps and ducking are reused. Fresh missions and Retry arm this presentation; loading snapshots does not arm a new introduction. Isolated DEV scenarios retain their encounter-specific dialogue.
