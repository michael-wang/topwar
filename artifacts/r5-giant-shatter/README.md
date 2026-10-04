# R5 Giant + grounded shatter review

Starting HEAD and fetched origin/main verified at
`4c7c0a709f1d047dad6c0658fbe5aceb5b8c1268`. The QA baseline adapter reads
that commit without resetting the checkout; it also intercepts game.json with
the pinned baseline so scale/config changes cannot contaminate comparisons.
Portrait evidence is 390×844 CSS / DPR 2, through the actual app renderer,
camera, coastal lighting and Level-7 state. QA hooks are route interceptions only.

## Commit 1 — scale/proportion checkpoint

`baseline-*` is R4, `scale-*` is the scale/head correction before weapon or
shatter edits. `scale-exploration.json` records the pre-edit measurements.
At 2000ms, equal-depth Z16 crown heights are 4.34× Heavy at old scale 3.6,
2.79× at 2.4 and 2.18× at 1.9. Review depths Z12/Z22 give 3.10×, 2.01×
and 1.57× respectively. Chosen width multiplier 0.94 gives 1.56× Heavy body
width at equal depth. The lower schema minimum 1.8 is visual-only; an identical
input simulation comparison proves movement/targeting/HP/XP/RNG are unchanged.

Head width/depth shrink another 14%, vertical radius 10%. Crown stays 1.355;
the 0.4555 head zone yields 2.975 head zones / 33.62% of standing height.
Body, boots, belt and satchel stay R4. The single crest is slightly proportional
at width 0.162. HP remains its dedicated 6:1 billboard, without squashing.
All 593 tests / 87 files and typecheck pass at this checkpoint.

`opening`, `same-depth`, `review-depth`, `giant-proportions` and `hp-*` are
the primary size evidence. Isolated black silhouettes use the actual projection.
Other captured baseline/scale fixtures support final guards and performance.

Weapon/grip and grounded-shatter checkpoint facts follow in the next commits.

## Commit 2 — hand/weapon ownership

`grip-*` shows the coupling checkpoint, before grounded-debris changes. One
skin-colored grip sphere is merged into the same weapon geometry as the shaft,
olive head and stone accent; it is absent from every Giant body/run pose.
Grip (0.60,0.40,0.08) is explicit family data and the weapon's rotation pivot.
The offhand remains body-owned. Contact includes the composed whole silhouette.

The grip translates ±0.015/0.009/0.075 authored X/Y/Z; delayed angular swing
remains ±0.14 pitch / ±0.045 roll on the unchanged 850ms gait. Translation
leads pitch by 0.55 radians (~74ms), providing maul inertia about the hand.
During the fall, translation freezes at its last live value and the hand/maul
remain one assembly. Added skin is a vertex-color region, not another draw.
The primary Giant triangle total remains 4400: the same hand is relocated.
