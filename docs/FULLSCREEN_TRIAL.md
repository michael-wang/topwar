# DEV fullscreen technical trial (#28)

This optional trial does not integrate fullscreen into public Start/Continue and is absent from production. It adds no shared scene, PWA or service worker. Accepted gameplay, VFX and Camera B are unchanged.

## Physical Pixel 8 steps

1. Keep the phone and development PC on the same Wi-Fi. With the existing Vite server running, open **http://192.168.1.106:5174/** in Android Chrome. This is the current PC address; it may change on another network. If the server is stopped, run `npm run dev -- --host 0.0.0.0 --port 5174` from the repository. Do not start a duplicate server.
2. Use the existing Tap-to-Start, or Continue then explicit Resume. Open the upper-left testing hatch, **進階調校 → 熄屏與存檔 QA**. Opening the menu pauses play as before.
3. Tap **進入全螢幕（DEV）**. Expect `Fullscreen: ON`, with a button to exit. The real tap calls `requestFullscreen({ navigationUI: 'hide' })` immediately. Record whether Chrome address/status/navigation bars disappear and which system bars remain; the option is a browser hint, not proof of physical immersive behavior.
4. Tap **離開全螢幕（DEV）**, then enter again. Separately use **Android Back/system exit**; expect `OFF` and a usable entry button. Do not trap Back or require fullscreen to play.
5. Resume with the existing upper-right button. Move across lanes with touch; check outer soldiers, cyan position tint, red artillery lanes, emergency glyph, Grenade/support buttons and safe-area spacing. Test the shared **驅逐艦進場** and **BOSS 進場** entries, Pause/Resume and Retry while fullscreen. Retry should retain the browser's current fullscreen state.
6. Background Chrome, return, and verify the game remains paused until Resume. Check Wake Lock status in QA: LAN HTTP normally reports `UNSUPPORTED — INSECURE ORIGIN`; this must not block gameplay. Where available, use desktop keyboard movement with battlefield focus; native menu/button focus keeps its existing keyboard exclusions.
7. Check the isolated **爆炸視覺比較（DEV）** link and return path. It must not consume the saved game or display a recovery/loading cover permanently.
8. Report phone/Chrome version, URL, ON/OFF transitions, bar visibility, orientation/viewport changes, any HUD clipping or input offset, audio/resume behavior and rejection text. A failed request should leave ordinary play available and allow another attempt.

## Browser evidence and limits

The automation exercises the real Fullscreen API from real Chrome click gestures on loopback HTTP (a secure context) and LAN HTTP (an insecure context), at 350×844, 390×844 and desktop size. It checks enter/exit/re-entry, external API exit/fullscreenchange, viewport resize/Camera B, unchanged paused player position, touch/keyboard input, Pause/Resume/Retry and actual WebGL context loss/restore. Rejection feedback uses an explicitly injected rejected API promise; an API-disabled test checks unsupported fallback. Headless Chrome accepted a request without transient activation, so that negative attempt does not establish the physical browser's activation policy.

Headless tab backgrounding may not generate native visibility changes; where unavailable, the diagnostic dispatches a clearly identified synthetic visibility event. This does not establish Android lifecycle behavior. Browser automation also cannot establish Android Back, physical safe areas, thermal behavior or immersive bar removal.

**HTTPS has not been exercised with this DEV control.** Loopback's secure context is not HTTPS. The deployed Pages build intentionally has no trial control, and no certificate/proxy or deployment infrastructure is added for this batch. Physical LAN testing comes first; HTTPS/public startup integration requires a later authorized task. No Pixel 8 acceptance is claimed.

Local captures/results: `artifacts/p4.26-b/`. Production checks must continue rejecting `dev-fullscreen-trial` and its button labels in built JavaScript.
