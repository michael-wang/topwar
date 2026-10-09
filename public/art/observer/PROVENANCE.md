# Field Observer assets

`neutral.webp` and `alert.webp` are original portraits generated for TopWar with OpenAI's built-in image generation tool on 2026-10-10. No stock portrait, real-person reference, existing game character or downloaded art was used. The user compared a simpler toy-figure revision and selected the original portrait direction. Final in-game presentation remains subject to human playtest review. This records provenance, not a claim of exclusive copyright or public-domain status.

The transparent PNG masters were resized to 256px and encoded as WebP (quality 88), retaining alpha. Both shipping assets total approximately 32 KB. The discarded revision is not shipped.

## Prompt set

Neutral: Original compact transparent radio portrait of a young adult female Field Observer. Rounded Toy Soldier / Handcrafted Military Arcade, cute rounded chibi but calm, professional and confident. Focused dark eyes, relaxed mouth, neat short dark brown hair, blue military cap with small gold insignia, clean navy uniform and ivory collar. Dark ink contours, simple mobile-readable shapes, soft painted enamel toy finish, restrained warm skin/navy/ivory/amber palette, slight asymmetry. Head and shoulders with generous margins, slight three-quarter pose. No hands, accessories, text, frame or scenery; no existing character resemblance. Readable at 72px, without exaggerated eyelashes or makeup.

Alert edit: Preserve identity, crop, uniform, cap, palette and transparent background. Change only the brows, eyes and mouth to calm, focused concern while delivering a professional warning. Do not exaggerate fear or excitement.

## Prerecorded dialogue

Mandarin asset: `public/audio/observer_destroyer_zh-TW.mp3`. Supplied by the project owner and explicitly human-approved as a provisional female Field Observer performance on 2026-10-10. Copied unchanged from the supplied Downloads file; no generation, replacement, trimming, normalization or re-encoding. Performer/service and separate license details were not supplied; approval is recorded from the owner's integration instruction.

- Bytes: 103455.
- SHA-256: `3e54fc46e2efbb050b7cb0ab6d863c4a938e13436214e83ef81d56faf3806ae8`.
- Chrome decoded duration: 5.40734694 seconds, mono (the supplied estimate was approximately 6.48 seconds). The configured 7.2-second window accommodates both.
- Traditional Chinese subtitle: 注意，左前方發現敵方驅逐艦！準備閃避砲擊。完畢！

English has no approved recording and its manifest entry remains null: English subtitles and radio beeps only, with no Mandarin substitution or missing-file request. No SpeechSynthesis or placeholder speech is used.

Playback preloads after Tap-to-Start activation without playing. `publicAssetUrl` supplies the GitHub Pages base path and build cache version. Assets decode once per locale; failures fall back to subtitles. Runtime WebAudio applies mild communication-band filtering and independent music/weapon ducking. Pause resumes from the presentation offset; Retry and locale switches cancel stale playback. Historical snapshots retain their saved encounter schedules; a window shorter than the decoded recording uses subtitles instead of truncating the voice.

The new fixed radio window is 1.3–8.5 seconds, first shot 8.8 seconds. All later attacks and departure shift by three seconds, preserving their spacing; no combat timing depends on playback callbacks.
