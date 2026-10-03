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
