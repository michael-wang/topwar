# Coastal R3 presentation review

Verified starting HEAD/origin/main: `17fffdcac3abde4c08492cc66ab271c8cf777ad2`.
Baseline captures load that commit read-only through Vite; QA never resets the checkout.
390×844 CSS portrait, DPR 2, actual shipping lighting/camera except named close inspections.

## Commit 1 checkpoint — pale shatter

`baseline-*.png` captures the accepted R2 baseline. `death-*.png` captures R3 death
before either environment commit. Grunt/Heavy preserve the last drawn run pose,
drain naturally lit albedo to plaster by 80 ms, hide at 110 ms, then shatter into
six/eight rounded fragments for 280 ms. One 384-instance mesh bounds normal
fragments; 48 reusable intact-body slots remain. Colors are #D8D9D1 / #E7E4D9 /
#BFC5C1, independent of faction and tier. No glowing corpse or rising dissolve.

Giant drains color over 120 ms, keeps its 90–520 ms fall and breaks at the
520 ms crash. Twelve larger pale fragments per existing bounded slot replace
colored armor rubble and the 36-point burst. Sand ring/dust remain; fade starts
1550 ms and clears at 2400 ms. Ordinary R2 surviving hits remain unchanged.
All role geometry, Player/Boss and gameplay are unchanged.

Sequence sources include alive, pale, initial shatter, spread and cleared states
for Grunt/Heavy and lethal/fall/crash/shatter/cleared for Giant. QA refreshes
renderer feedback per fixture and keeps original simulation/config untouched.
Final environment comparisons, temporal media and performance follow in commits 2/3.

## Commit 2 checkpoint — openings and legacy naval boundary

`openings-*.png` records the coast before foreground dressing. The exact
screen-right foreground house is the negative-X building at Z=24 (QA close
camera is labeled; runtime framing is unchanged). Broad deep-shadow door/window
blocks now have plaster jambs/lintels/surrounds, cyan painted leaves/shutters and
small secondary-shadow inner cores. The broad navy painted side plane is lifted
to cool plaster. Materials are still merged per side; lights remain unchanged.

The dark ship came from `BridgeEnvironment.buildActivity()` (#303B40 hull,
#39474B fittings), not the Mediterranean fleet. `updateActivity()` now gates
whole-ship visibility on legacy mode. Schedule, rewind and mode-switch tests
keep it hidden in defense while preserving legacy activity/fade/bridge masking.
Aircraft/flak and `OffshoreTransports` are retained. Fifteen focused environment
tests and typecheck pass at this checkpoint.
