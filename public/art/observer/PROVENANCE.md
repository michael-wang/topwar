# Field Observer assets

`neutral.webp` and `alert.webp` are original portraits generated for TopWar with OpenAI's built-in image generation tool on 2026-10-10. No stock portrait, real-person reference, existing game character or downloaded art was used. The user compared a simpler toy-figure revision and selected the original portrait direction. Final in-game presentation remains subject to human playtest review. This records provenance, not a claim of exclusive copyright or public-domain status.

The transparent PNG masters were resized to 256px and encoded as WebP (quality 88), retaining alpha. Both shipping assets total approximately 32 KB. The discarded revision is not shipped.

## Prompt set

Neutral: Original compact transparent radio portrait of a young adult female Field Observer. Rounded Toy Soldier / Handcrafted Military Arcade, cute rounded chibi but calm, professional and confident. Focused dark eyes, relaxed mouth, neat short dark brown hair, blue military cap with small gold insignia, clean navy uniform and ivory collar. Dark ink contours, simple mobile-readable shapes, soft painted enamel toy finish, restrained warm skin/navy/ivory/amber palette, slight asymmetry. Head and shoulders with generous margins, slight three-quarter pose. No hands, accessories, text, frame or scenery; no existing character resemblance. Readable at 72px, without exaggerated eyelashes or makeup.

Alert edit: Preserve identity, crop, uniform, cap, palette and transparent background. Change only the brows, eyes and mouth to calm, focused concern while delivering a professional warning. Do not exaggerate fear or excitement.

## Optional prerecorded dialogue

**No speech recordings are bundled or approved yet.** `src/audio/ObserverVoice.ts` has explicit null asset entries for both locales. Null entries perform no fetch. The game presents localized subtitles and procedural radio opening/completion beeps. It never uses SpeechSynthesis or fabricated placeholder speech.

To integrate approved recordings, place compressed local audio in `public/audio/observer/`, record the performer/generation service, permission/license, approval date and exact line here, then set the corresponding manifest path. `publicAssetUrl` supplies the GitHub Pages base path and build cache version. Assets load once per locale; decoding/network failures fall back silently to subtitles. Use a clear young adult female voice: calm professional Taiwanese Mandarin for zh-TW and comparable English delivery. Recordings must fit the configured radio window (currently 4.2 seconds); review pacing and adjust the authored intro/first-shot timing together if approved performances require more time. Do not speed up an unsuitable performance to meet this provisional window.

The WebAudio player applies mild communication-band filtering, resumes from the presentation offset after Pause, cancels on Retry/language change, and ducks music/weapons through independent gain stages. Natural pronunciation, intelligibility and final loudness with real recordings remain acceptance items.
