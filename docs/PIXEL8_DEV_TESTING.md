# Pixel 8 secure development testing

Screen Wake Lock is optional and requires a secure context. HTTP on a LAN IP such as `http://192.168.1.20:5173` normally is insecure. DEV → SCREEN shows **UNAVAILABLE — INSECURE ORIGIN** there. Combat still works; no lock is attempted. HTTPS and Chrome's trustworthy localhost origin support the API when the browser/system grants it. [API requirements and system release](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).

## Preferred: USB localhost forwarding

Use Android SDK [Platform Tools](https://developer.android.com/tools/releases/platform-tools) if ADB is not already installed. No repository configuration change or public deployment is needed.

1. Enable Developer options and USB debugging on the Pixel 8. Connect its USB cable and accept the debugging authorization on the phone.
2. In the repository, start the existing Vite server with `npm run dev -- --port 5173 --strictPort`. An already-running server on 5173 can be reused.
3. Run `adb devices`; confirm the phone is listed as `device`, then `adb reverse tcp:5173 tcp:5173`. With multiple devices, use `adb -s <serial> reverse tcp:5173 tcp:5173`.
4. Open **http://localhost:5173** in Pixel Chrome. Open `chrome://inspect/#devices` on desktop Chrome and inspect that phone tab. Confirm `window.isSecureContext === true` and `'wakeLock' in navigator`.
5. Tap to Start, or Resume a restored paused game. Open DEV → 進階調校 → 熄屏與存檔 QA and inspect **Wake Lock: RELEASED**: opening the testing hatch pauses gameplay and releases the lock. Explicit Resume closes the menu and requests the lock again. ACTIVE reflects a granted, unreleased sentinel. REQUESTING is not a grant. DENIED / ERROR can occur under battery saver, Permissions Policy or system refusal.
6. Select 驅逐艦進場 or BOSS 進場 (the menu closes), and leave the phone untouched for more than 30 seconds with its display timeout set to 15 seconds. The screen should remain awake while SCREEN is ACTIVE. Pause; SCREEN should become RELEASED / PAUSED. Sleep/reopen; Continue restores paused progress. Resume requests a new lock. 勝利結算 previews the full Tank finale and marked sample results; 空中支援 immediately previews the real bomber raid in phase 2; 返回一般遊戲 starts an authored normal run.
7. In remote DevTools Network, confirm config/portrait/audio requests (characters and scenery are procedural; no GLB request is expected) succeed and Vite's WebSocket connects. To verify HMR without changing game logic, temporarily edit an existing CSS color in DevTools Sources/workspace or make a harmless source comment, observe the Vite update/reload, then revert that edit. A full reload must preserve a paused checkpoint. USB disconnect or failed reverse forwarding prevents asset/HMR connections; rerun the reverse command after reconnecting.
8. Remove forwarding when finished with `adb reverse --remove tcp:5173`. Disable USB debugging if it is no longer needed.

[Chrome remote debugging](https://developer.chrome.com/docs/devtools/remote-debugging/) and [localhost forwarding](https://developer.chrome.com/docs/devtools/remote-debugging/local-server/) describe inspecting the phone and reaching the host server. This task's desktop automation cannot verify the phone's USB authorization or physical screen timeout.

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

## DEV advanced QA sleep test

Use the secure DEV origin described above; closed-playtest Pages shares the four approved scene buttons; engineering sleep/checkpoint QA remains DEV-only. Open DEV → 進階調校 → 熄屏與存檔 QA. The panel shows actual Wake Lock and saved-checkpoint status. Deliberately select the 15 秒熄屏 / Resume test and confirm replacement of the current run. It prepares a deterministic AHEAD Lv10 scene, saves full state, freezes simulation, keeps the heavy battlefield rendered and releases Wake Lock. Set Android screen timeout to 15 seconds, leave the phone untouched, then reopen Chrome. A surviving page remains paused; a reload offers Continue/New Game immediately and Continue restores paused. Resume is explicit.

Record whether the page survived, reloaded, lost WebGL context or reported document.wasDiscarded. No browser script can force screen-off or tab discard; unknown causes remain unknown. Exit testing to restore ordinary Wake Lock behavior. Normal saved progress is replaced only after confirmation. No deployment is performed by these instructions.
