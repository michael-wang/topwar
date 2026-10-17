# Explosion Lab — accepted production references

Reference tool retained during P4.24 promotion. The owner physically approved B-fast and Hybrid D on Pixel 8. B-fast now drives Tank/Destroyer gameplay impacts and Hybrid D drives real airstrikes. The original B-fast was accepted on Pixel 8; production now uses a lighter, earlier-fading artillery-only aftermath (1.05s) for readability review. The Lab keeps its original reference unchanged. Hybrid D production acceptance (#12) remains open. Grenades, cannon muzzles, tracers, gameplay and saves are unchanged.

Run `npm run dev -- --host 0.0.0.0`, then open the terminal's Local or Network URL with `?explosion-lab` appended. On Pixel 8, use the Network URL on the same Wi-Fi. Alternatively, the DEV advanced testing menu has **爆炸視覺比較（DEV）**, opening the lab in a separate tab. Production `/topwar/` has neither this link nor the lab; it cannot be reviewed on Pages.

Choose Tank/Destroyer impact or Airstrike, then a look. Both artillery sources use the same production impact class; this lab isolates that shared effect rather than simulating firing weapons. All looks share Camera B, fixed beach/environment time, anchors and impact clocks. The airstrike sample uses nine fixed impacts over 3.1 seconds to compare overlapping aftermath, without aircraft or gameplay. It is a presentation sample, not the authoritative raid schedule.

| Group | Looks | Useful ages |
| --- | --- | --- |
| Tank/Destroyer impact | Control / A / B / B-fast | .03 / .18 / .35 / .65 / .90 / 1.20 / 1.50s; original .45 / 2.1s also available |
| Airstrike | Control / B / C / Hybrid D | .03 / .18 / .45 / .90 / 1.50 / 1.80 / 2.00 / 2.50 / 4.00s; original 1 / 6.5 / 8.9s also available |

- **Control:** the pre-promotion effects retained unchanged; airstrike Control is frozen in DEV-only LabAirstrikeControl.
- **A:** immediate black core, short bright internal flash, wider gray envelope.
- **B:** interlocking rolling cloud with charcoal, intermediate gray and a soft outer envelope.
- **C:** broader, lower, darker bombardment bank; pale smoke is secondary.
- **B-fast:** the preferred B impact cloud with faster expansion, wind starting at .08s, dispersal/stretch from .35s and a steep fade from .9s to disappearance at 1.5s. Keeps B's brief internal orange fire and three tonal bands.
- **Hybrid D:** Control's hot white circular flash geometry/pose and ground ring, paired selectively with B's rolling smoke and one restrained orange burst. White flash ends at .15s; the Control ring expands/fades through .6s; orange fire runs .05–.30s. Each impact's smoke fades rapidly from its own age of 1.5s and expires at 2s. It does not copy C's enormous black bank or overlay two complete explosions.

Owner's first physical review preferred B's impact body (requesting faster expansion/dissipation) and Control's flash/ring plus B's airstrike cloud. Both selected Lab designs are promoted; C remains available unchanged as a rejected comparison. **Control/A/B/C remain visually unchanged. B-fast and Hybrid D are owner-approved promotion references; B-fast production is accepted; Hybrid D production acceptance (#12) remains open.** Their fade curves account for stacked transparent lobes, so individual opacity reductions produce visible dispersal. The global nine-second timeline remains: later impacts receive their own complete presentation, and D's final impact expires at global 5.1s rather than a timer measured from the first blast.

Phase buttons and the slider pause at exact ages. Switching looks preserves the age and playback state. Replay starts at zero; Play resumes without catching up hidden time. Leaving the tab pauses. **隱藏面板 / View FX** clears the comparison controls from the image; **顯示比較面板** restores them. Returning to gameplay leaves existing checkpoints intact.

Production comparison evidence: `artifacts/p4.24-a/parity/` contains exact-age B-fast Lab/production frames (14 pixel-identical comparisons); `artifacts/p4.24-b/parity/` contains 20 Hybrid D comparisons (17 identical, three with only one-level 8-bit channel rounding differences). Real naturally fired Tank/Destroyer phase captures and Pause/Continue/Retry evidence are in `artifacts/p4.24-a/`; actual player-called raid captures, active-smoke reconstruction, late expiry and persistent scorches are in `artifacts/p4.24-b/production/`. Both 350×844 and 390×844 are covered. These checks do not replace final integrated Pixel 8 visual/performance acceptance. The Lab remains available as a frozen reference until that review.

Heavy ordinary death (#27) now uses the intact Grunt-style pale lift/fade and is Pixel 8 PASS / CLOSED. Robotic Giant death (#14) remains tracking only.
