# GIANT quick review (DEV only)

The **#33 refinement awaits physical Pixel 8 review**, superseding the prior #14 presentation approval. This isolated tool exercises immediate original-color arrival, larger upper-armor metallic hits and grounded mechanical death with real MG damage.

1. Run `npm run dev -- --host 0.0.0.0 --port 5174 --strictPort` if the existing DEV server is not running.
2. On Pixel 8, use the same Wi-Fi and open `http://192.168.1.106:5174/` (use the PC's current LAN IP if it changes).
3. Start or Continue/Resume normally. Open the testing hatch → **進階調校 → GIANT 特效測試（DEV）**. It opens a separate tab. Direct access: `http://192.168.1.106:5174/?giant-review`.
4. Tap to Start in that tab. Stay in the center lane: two authored Lv9 MGs shoot one full-HP GIANT with normal damage, movement, XP and weapon cadence. Watch successive nonlethal gold sparks move across nearby upper-armor regions, then the real lethal disassembly and burning wreck. No other troops or encounters interrupt this finite review.
5. **重測 GIANT** repeats the same setup. Pause/Resume and normal lane controls work. Close the review tab to return to the original paused game; Resume there explicitly.

The review never restores, writes or clears the normal checkpoint. The early HTML cover still checks only checkpoint presence; review startup skips validation/recovery entirely. Reload starts a fresh isolated review; it intentionally offers no Continue. Its sleep/checkpoint QA and shared scene selectors are absent to avoid suggesting that it can save. The ordinary hatch still has exactly four shared entries. The review route, entry, fixture and controls are excluded from production; Explosion Lab and fullscreen trial remain DEV tools.

Check both phone widths, several repeated kills and pause during sparks/death. Watch original-colored pieces separate at .12s, fall and land by roughly 1.2s, remain grounded, then fade at 1.9–2.6s. Look for two small fires among the landed torso pieces and fresh smoke rising/drifting right after the blast, then full cleanup at 2.6s. No piece should turn pale or fade while airborne. Chrome automation is supporting evidence only; physical Pixel 8 tool usability remains for owner review. Fullscreen testing stays separate: [trial checklist](FULLSCREEN_TRIAL.md).
