# Explosion comparison — P4.23

Experiments only. No public effect is promoted by this batch. Grenades, cannon muzzles, tracers, gameplay and saves are unchanged.

Run `npm run dev -- --host 0.0.0.0`, then open the terminal's Local or Network URL with `?explosion-lab` appended. On Pixel 8, use the Network URL on the same Wi-Fi. Alternatively, the DEV advanced testing menu has **爆炸視覺比較（DEV）**, opening the lab in a separate tab. Production `/topwar/` has neither this link nor the lab; it cannot be reviewed on Pages.

Choose Tank/Destroyer impact or Airstrike, then a look. Both artillery sources use the same production impact class; this lab isolates that shared effect rather than simulating firing weapons. All looks share Camera B, fixed beach/environment time, anchors and impact clocks. The airstrike sample uses nine fixed impacts over 3.1 seconds to compare overlapping aftermath, without aircraft or gameplay. It is a presentation sample, not the authoritative raid schedule.

| Group | Looks | Useful ages |
| --- | --- | --- |
| Tank/Destroyer impact | Control / A / B | .03s flash, .18s growth, .45s smoke, .9–1.5s rightward drift, 2.1s expired |
| Airstrike | Control / B / C | .03s flash, 1s transition, 2.5–4s buildup, 6.5s late drift, 8.9s expired |

- **Control:** the existing production classes, with no copied or retuned settings.
- **A:** immediate black core, short bright internal flash, wider gray envelope.
- **B:** interlocking rolling cloud with charcoal, intermediate gray and a soft outer envelope.
- **C:** broader, lower, darker bombardment bank; pale smoke is secondary.

Phase buttons and the slider pause at exact ages. Switching looks preserves the age and playback state. Replay starts at zero; Play resumes without catching up hidden time. Leaving the tab pauses. **隱藏面板 / View FX** clears the comparison controls from the image; **顯示比較面板** restores them. Returning to gameplay leaves existing checkpoints intact.

Local evidence: `artifacts/p4.23/lab/` contains 54 matched 350×844 / 390×844 captures and `results.json`; `artifacts/p4.23/capture.mjs` reproduces them against the local DEV port (5174 in this run). Automated visual checks do not establish physical Pixel 8 acceptance. Compare impact punch, dark-core timing, tonal structure, cloud cohesion and wind dispersal on the device before choosing a direction. This isolated scene is not a combat-performance benchmark.

Heavy death (#27, compact rising puff like Grunt) and robotic Giant death (#14, disassembly/explosion) remain tracking only.
