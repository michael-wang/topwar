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
