# Mobile fullscreen — production startup and DEV trial (#28)

The owner accepted the DEV Pixel 8 trial. Production now initiates audio activation followed synchronously by optional mobile portrait fullscreen from the same native 「開始遊戲」 click, before awaiting audio. First restored Resume gets one attempt; later Resume/Retry and Android system exits never force re-entry. Unsupported/denied modes remain playable. Combined production Start/Resume and HTTPS acceptance remain **pending**.

## Combined startup — physical Pixel 8 acceptance

Use the existing local DEV network URL **http://192.168.1.106:5174/** (same Wi-Fi; PC address may change). Check an existing server before starting one; if stopped, run `npm run dev -- --host 0.0.0.0 --port 5174`. Owner alone may manually deploy and repeat on Pages HTTPS; this batch does not publish.

1. Fresh visit: observe honest loading → silent Diorama. Wait 30–60s: no battle/audio; review framing, motion, heat and battery. Tap 「開始遊戲」 once: audio and supported fullscreen begin, then ordinary Lv1 combat with existing Commander timing. Test rapid double taps and hardware keyboard/assistive activation; no second Start.
2. Pause/reload: protected Continue restores paused, without Diorama/audio/fullscreen request. First explicit Resume may enter fullscreen and unlock audio; subsequent Pause/Resume must not force it. Explicit New Game shows the Diorama after replacing the save; Retry stays immediate.
3. Inward Android edge swipe may expose the system bar; another may exit fullscreen. This is expected. Verify play continues with aligned lane controls, red warnings/emergency glyph, Grenade/support and safe areas. Re-enter explicitly using 「全螢幕」 in the upper-left existing menu, then Resume. Never automatic re-entry.
4. Test background/return (remains paused), Wake Lock only during active play, portrait viewport changes, touch positions, Victory/Defeat/Retry and all four shared scenes. Repeat reduced-motion and rejected/unsupported conditions where possible; desktop and unsupported iPhone browsers stay in ordinary mode.
5. Record phone/Chrome/URL, immersive bar visibility, combined audio behavior, clipping/input offsets and sustained idle cost. LAN HTTP is not HTTPS and may lack Wake Lock. No installed/PWA behavior is required.

## Preserved DEV trial

The existing advanced QA control remains DEV-only and separate from the public Start/menu action. It supports explicit enter/exit/re-enter and reports actual state. Android edge exits are expected, with no gesture interception. No shared scene, PWA or service worker is added.

## Physical Pixel 8 steps

1. Keep the phone and development PC on the same Wi-Fi. With the existing Vite server running, open **http://192.168.1.106:5174/** in Android Chrome. This is the current PC address; it may change on another network. If the server is stopped, run `npm run dev -- --host 0.0.0.0 --port 5174` from the repository. Do not start a duplicate server.
2. Use 「開始遊戲」, or Continue then explicit Resume. Open the upper-left testing hatch, **進階調校 → 熄屏與存檔 QA**. Opening the menu pauses play as before.
3. Tap **進入全螢幕（DEV）**. Expect `Fullscreen: ON`, with a button to exit. The real tap calls `requestFullscreen({ navigationUI: 'hide' })` immediately. Record whether Chrome address/status/navigation bars disappear and which system bars remain; the option is a browser hint, not proof of physical immersive behavior.
4. Tap **離開全螢幕（DEV）**, then enter again. Separately use **Android Back/system exit**; expect `OFF` and a usable entry button. Do not trap Back or require fullscreen to play.
5. Resume with the existing upper-right button. Move across lanes with touch; check outer soldiers, cyan position tint, red artillery lanes, emergency glyph, Grenade/support buttons and safe-area spacing. Test the shared **驅逐艦進場** and **BOSS 進場** entries, Pause/Resume and Retry while fullscreen. Retry should retain the browser's current fullscreen state.
6. Background Chrome, return, and verify the game remains paused until Resume. Check Wake Lock status in QA: LAN HTTP normally reports `UNSUPPORTED — INSECURE ORIGIN`; this must not block gameplay. Where available, use desktop keyboard movement with battlefield focus; native menu/button focus keeps its existing keyboard exclusions.
7. Check the isolated **爆炸視覺比較（DEV）** link and return path. It must not consume the saved game or display a recovery/loading cover permanently.
8. Report phone/Chrome version, URL, ON/OFF transitions, bar visibility, orientation/viewport changes, any HUD clipping or input offset, audio/resume behavior and rejection text. A failed request should leave ordinary play available and allow another attempt.

## Browser evidence and limits

The automation exercises the real Fullscreen API from real Chrome click gestures on loopback HTTP (a secure context) and LAN HTTP (an insecure context), at 350×844, 390×844 and desktop size. It checks enter/exit/re-entry, external API exit/fullscreenchange, viewport resize/Camera B, unchanged paused player position, touch/keyboard input, Pause/Resume/Retry and actual WebGL context loss/restore. Rejection feedback uses an explicitly injected rejected API promise; an API-disabled test checks unsupported fallback. Headless Chrome accepted a request without transient activation, so that negative attempt does not establish the physical browser's activation policy.

Headless tab backgrounding may not generate native visibility changes; where unavailable, the diagnostic dispatches a clearly identified synthetic visibility event. This does not establish Android lifecycle behavior. Browser automation also cannot establish Android Back, physical safe areas, thermal behavior or immersive bar removal.

**HTTPS has not been exercised with this DEV control.** Loopback's secure context is not HTTPS. The deployed Pages build intentionally has no trial control, and no certificate/proxy or deployment infrastructure is added for this batch. Combined production HTTPS startup still requires owner physical validation. The owner’s physical technical-trial acceptance is recorded above; browser automation alone does not establish physical-device behavior.

Local captures/results: `artifacts/p4.26-b/`. Production checks must continue rejecting `dev-fullscreen-trial` and its button labels in built JavaScript.

P4.36 browser evidence: `artifacts/p4.36-a/` (Diorama, recovery, idle resources) and `artifacts/p4.36-b/` (combined gesture, fallbacks, lifecycle, production/historical regressions). Real Chrome API entry is automated; denial/unsupported/audio absence are explicit fault injections and visibility may be synthetic. These are desktop results, not physical Pixel 8 or HTTPS acceptance.
