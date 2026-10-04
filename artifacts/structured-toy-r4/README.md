# Structured Toy R4 review

Starting HEAD and fetched origin/main verified at
`a4a530447d833ee341805ee6df02f947cd435aa7`. Baseline fixtures read that commit
through a Vite source adapter; the checkout is never reset. All default
portraits are 390×844 CSS / DPR 2 with the shipping camera/lighting.

## Commit 1 — near-field village

`baseline-*` is accepted R3; `environment-*` captures the near houses before
character or HUD edits. Standalone pottery, rope, bench, timber seat and cloth
are removed. Six merged material/side draws replace seven prop draws. Screen-left
house center is X=5.35/Z=7.2 at track half-width 3.2; screen-right is
X=−5.65/Z=11.85. The left house has a cyan shutter, short front stair and
low terrace; right has a plaster arch/cyan recessed doorway, steps and terrace.
All opaque vertices stay outside track edge +0.4 at half-widths 1.5/2.5/3.2/6,
with heights below 2.1 and Z inside 5–17. No collision or upper village changes.
Four focused environment tests and typecheck pass at this checkpoint.

Named `left-house`/`right-house` frames are QA close inspections. `opening`,
`empty` and `outer-lanes` use the actual camera and demonstrate composition.
Final character/HUD comparisons and measurements follow in commits 2/3.
