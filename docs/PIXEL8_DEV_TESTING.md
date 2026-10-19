# Pixel 8 secure development testing

For accepted GIANT hit/death regression without playing from Lv1, use the isolated [GIANT quick review](GIANT_REVIEW.md). It opens from DEV advanced controls and never replaces the normal checkpoint.

Screen Wake Lock is optional and requires a secure context. HTTP on a LAN IP such as `http://192.168.1.20:5173` normally is insecure. DEV → 進階調校 → 熄屏與存檔 QA shows **Wake Lock: UNSUPPORTED — INSECURE ORIGIN** there. Combat still works; no lock is attempted. HTTPS and Chrome's trustworthy localhost origin support the API when the browser/system grants it. [API requirements and system release](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).

## Preferred: USB localhost forwarding

Use Android SDK [Platform Tools](https://developer.android.com/tools/releases/platform-tools) if ADB is not already installed. No repository configuration change or public deployment is needed.

1. Enable Developer options and USB debugging on the Pixel 8. Connect its USB cable and accept the debugging authorization on the phone.
2. In the repository, start the existing Vite server with `npm run dev -- --port 5173 --strictPort`. An already-running server on 5173 can be reused.
3. Run `adb devices`; confirm the phone is listed as `device`, then `adb reverse tcp:5173 tcp:5173`. With multiple devices, use `adb -s <serial> reverse tcp:5173 tcp:5173`.
4. Open **http://localhost:5173** in Pixel Chrome. Open `chrome://inspect/#devices` on desktop Chrome and inspect that phone tab. Confirm `window.isSecureContext === true` and `'wakeLock' in navigator`.
5. Tap to Start, or Resume a restored paused game. Open DEV → 進階調校 → 熄屏與存檔 QA and inspect **Wake Lock: RELEASED**: opening the testing hatch pauses gameplay and releases the lock. Explicit Resume closes the menu and requests the lock again. ACTIVE reflects a granted, unreleased sentinel. REQUESTING is not a grant. DENIED / ERROR can occur under battery saver, Permissions Policy or system refusal.
6. Select 驅逐艦進場 or BOSS 進場 (the menu closes), and leave the phone untouched for more than 30 seconds with its display timeout set to 15 seconds. The screen should remain awake while Wake Lock is ACTIVE. Pause; Wake Lock should become RELEASED. Sleep/reopen; Continue restores paused progress. Resume requests a new lock. 勝利結算 previews the full Tank finale and marked sample results; 空中支援 opens the manual Phase-3 review: wait for Commander readiness, then optionally call once with the aircraft button; 返回一般遊戲 starts an authored normal run.
7. In remote DevTools Network, confirm config/portrait/audio requests (characters and scenery are procedural; no GLB request is expected) succeed and Vite's WebSocket connects. To verify HMR without changing game logic, temporarily edit an existing CSS color in DevTools Sources/workspace or make a harmless source comment, observe the Vite update/reload, then revert that edit. A full reload must preserve a paused checkpoint. USB disconnect or failed reverse forwarding prevents asset/HMR connections; rerun the reverse command after reconnecting.
8. Remove forwarding when finished with `adb reverse --remove tcp:5173`. Disable USB debugging if it is no longer needed.

[Chrome remote debugging](https://developer.chrome.com/docs/devtools/remote-debugging/) and [localhost forwarding](https://developer.chrome.com/docs/devtools/remote-debugging/local-server/) describe inspecting the phone and reaching the host server. This task's desktop automation cannot verify the phone's USB authorization or physical screen timeout.

## P4.44b — Commander A / A1 / A2 placement comparison

This changes only the existing Commander anchor in DEV. Production ignores the query. No Pages deployment is needed; physical Pixel 8 readability remains for Julia/Owner to judge.

1. In `C:\astra-dev\topwar`, run `npm run dev -- --port 5173 --strictPort` (reuse an already-running server). Connect the phone with USB debugging authorized, then run `adb devices` and `adb reverse tcp:5173 tcp:5173`.
2. In phone Chrome compare `http://localhost:5173/topwar/?commander-placement=a` (64%), `http://localhost:5173/topwar/?commander-placement=a1` (58%) and `http://localhost:5173/topwar/?commander-placement=a2` (56%). Start a new test to see the first and long briefing lines. All retain A's original safe-inset compensation. Original placement is `http://localhost:5173/topwar/` without the query; unknown values also keep original. Reloading retains Continue/New Game; placement itself is not saved.
3. While Commander speaks, use the arrows through all five positions. Compare soldier/weapon visibility and the red personal artillery warning, especially outer lanes. Check XP/LV, arrows, Grenade, Support and loadout; try normal Chrome and the existing fullscreen entry/exit.
4. Use the existing menu entries `🚢 驅逐艦進場`, `🚨 BOSS 進場`, `✈️ 空中支援`, `🏆 勝利結算`; scene selection replaces the current test progress as the menu explains. Check the Boss entrance warning, live Tank, manual support, and Victory's existing `略過`. Pause, reload, Continue (must remain paused), then Resume. For isolated real GIANT review use `http://localhost:5173/topwar/?giant-review&commander-placement=a`; this existing isolated path does not replace the normal save.
5. These are experiments, not readability PASS: A covers soldiers/weapon feedback; A1/A2 reduce that obstruction but can obscure the Boss warning and worsen personal artillery glyph overlap. Record the lane, message and screenshot for Julia/Owner. Remove the query to return to baseline; stop the server and run `adb reverse --remove tcp:5173` when finished.

Desktop evidence can be regenerated with `node scripts/qa/commander-placement.mjs`. Ignored `artifacts/p4.44b/index.html` presents only two contact sheets (normal/upgraded squad and Boss/artillery warnings), with complete 390×844 game frames in A/A1/A2 columns. `results.json` records both 350×844 and 390×844, five settled physical lanes, expanded movement hit areas, and samples through the artillery emergency window. Safe-area checks simulate 24px top / 20px bottom with fullscreen/reduced motion; desktop evidence does not establish physical phone acceptance.

## P4.44c — Storyboard A3 DEV opening

Implemented DEV prototype; Julia/Owner Pixel 8 acceptance is pending. Production ignores this query and retains its original opening and Commander location.

1. In `C:\astra-dev\topwar`, run `npm run dev -- --port 5173 --strictPort`. With USB debugging authorized, run `adb devices`, then `adb reverse tcp:5173 tcp:5173`.
2. Open **http://localhost:5173/?opening-review=1** in Pixel 8 Chrome. Choose `重新開始` if the saved-game chooser appears, then tap the existing `開始遊戲` once. The three ships approach their original offshore anchors and stay; troops begin individually at the surf, building into the exact starting crowd. Full original Commander speech/subtitles use A2 (56%); the short siren ends before speech, while the faint red edge lasts through the briefing. Default is about 12 seconds; missing audio may add up to 2.5 seconds of bounded waiting.
3. Reload/New Game to try `跳過` during the first line: speech, captions and red edge stop immediately, with combat starting after about .2 seconds. Check Pause/Resume, switch apps during speech, return and explicitly Resume. Continue restores paused without the opening; Retry goes straight into combat. An older valid save is retained until a new opening completes/skips.
4. Check 350/390-class portrait widths, safe areas and fullscreen; listen on the physical phone for siren/dialogue balance. Use the existing four review entries and GIANT test to verify bypass and later notices. A2 may still obscure Boss/personal artillery warnings: those accepted warnings were not moved. Record any readability issue for Julia. Removing the query restores baseline behavior.

`node scripts/qa/opening-prototype.mjs` regenerates ignored diagnostics and a continuous visual recording. Playwright video is silent; physical phone audio/motion acceptance is still required. Set `PLAYWRIGHT_BROWSERS_PATH` to the local QA browser-tools directory if its FFmpeg encoder was installed there. No Pages publishing is needed.

## Optional: trusted HTTPS over LAN

Use a development certificate issued by a CA that you deliberately trust on the Pixel, with your exact LAN IP or hostname in its Subject Alternative Names. An existing team/local CA can supply it; [mkcert](https://github.com/FiloSottile/mkcert) is one optional local-development tool. Install its root CA on the phone through Android's certificate settings and retain the CA private key on the development computer. Trust only your own development CA; do not bypass Chrome certificate warnings or enable unsafe-origin flags.

Place the host certificate/key in ignored `artifacts/local-tls/`. Set their paths in PowerShell and run the optional server (stop the normal 5173 server first):

```powershell
$env:TOPWAR_TLS_KEY = 'C:\astra-dev\topwar\artifacts\local-tls\key.pem'
$env:TOPWAR_TLS_CERT = 'C:\astra-dev\topwar\artifacts\local-tls\cert.pem'
node scripts/dev/https.mjs
```

Open `https://<certificate LAN host>:5173` on the phone, with no certificate error. Verify secure context, API availability, SCREEN ACTIVE, asset responses and the `wss` HMR connection as above. The helper does not install certificates, change default Vite settings or deploy anything. A certificate that Chrome does not trust is not a usable test setup.

**Storage origin changes:** LAN-IP HTTP, localhost HTTP and LAN HTTPS are different origins. Checkpoints/config localStorage do not automatically move between them. Start a new test on the secure URL or finish the saved run on its original URL; absence of Continue on a new origin is expected. DEV and release also use separate checkpoint slots.

## Startup and fullscreen review

Fresh visits should show loading feedback immediately, then the existing Tap-to-Start. Check delayed/failing resources and Reload, valid/invalid Continue/New Game and repeated input. Loading (#21) is implemented but physical startup feel remains pending.

The optional DEV fullscreen control is in 進階調校 → 熄屏與存檔 QA. Follow the [fullscreen checklist](FULLSCREEN_TRIAL.md) for the current LAN URL, entry/exit/Android Back, layout and lifecycle checks. This trial does not change public Start/Continue. LAN and loopback desktop automation passed; physical Pixel 8 and HTTPS remain unverified.

## DEV advanced QA sleep test

Use the secure DEV origin described above; closed-playtest Pages shares the four approved scene buttons; engineering sleep/checkpoint QA remains DEV-only. Open DEV → 進階調校 → 熄屏與存檔 QA. The panel shows actual Wake Lock and saved-checkpoint status. Deliberately select the 15 秒熄屏 / Resume test and confirm replacement of the current run. It prepares a deterministic AHEAD Lv10 scene, saves full state, freezes simulation, keeps the heavy battlefield rendered and releases Wake Lock. Set Android screen timeout to 15 seconds, leave the phone untouched, then reopen Chrome. A surviving page remains paused; a reload offers Continue/New Game immediately and Continue restores paused. Resume is explicit.

Record whether the page survived, reloaded, lost WebGL context or reported document.wasDiscarded. No browser script can force screen-off or tab discard; unknown causes remain unknown. Exit testing to restore ordinary Wake Lock behavior. Normal saved progress is replaced only after confirmation. No deployment is performed by these instructions.
