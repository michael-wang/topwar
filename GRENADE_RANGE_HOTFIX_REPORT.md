# Grenade shoreline usability hotfix — r3

Baseline: `a6a64e1955fd0dc0764e79bb1a59a0c3c62f60cf`; HEAD and fetched origin/main matched, worktree clean. Release tag: `playtest-2026-10-07-r3`. No deployment.

## Fix

`src/simulation/grenade.ts::grenadeTarget()` previously excluded enemies more than 24 units from player Z. The immediate Lv6 release enters at approximately 38–47 units, so both the shared request guard and button availability incorrectly rejected a held charge.

All living defense enemies on the active battlefield are now eligible. Smallest world Z, then stable enemy ID, still selects the urgent anchor; its radius-four local group supplies the unweighted captured centroid. No selected-lane or densest-cluster targeting was introduced. Empty/dead/paused/pre-start/in-flight guards remain unchanged.

`throwRange` is removed from schema, defaults and runtime JSON. Its former second use in teaching-Supply lane scoring is preserved as `supplyPressureDepth: 24`, which affects only Supply placement and never throw eligibility. No snapshot compatibility shim is needed. Obsolete range claims were removed/corrected in gameplay and phase reports.

Unchanged: capacity 3, damage 9 defense-enemy HP, radius 4, no falloff, flight .65 seconds, analytic arc, captured target, normal victim XP, Supply timing/acquisition/placement, gameplay/HUD/art/controls.

## Validation

- **824 tests / 128 files passed**, typecheck passed, production build passed. Added distance, app button/Q, Supply-placement preservation, shoreline arc, and actual Giant-kill/evolution regressions.
- Focused real combat boundary: Lv5 XP 100, three Rifle soldiers, one held Grenade; ordinary Rifle kills the introduced Giant for 120 XP, evolves to Lv6/one MG specialist and admits exactly **59 Grunts + one Heavy**, all beyond 24 units. Held charge remains usable; valid throw consumes **1 → 0**. Snapshot replay agrees; one flight/detonation only.
- Production browser natural runs used the ordinary Start, progression, Supply and combat paths. The deterministic pilot spent two charges and deliberately held the last for Lv6:

| Viewport / seed | Lv5 | Giant spawn | Giant death | Lv6 | Held Grenade at Lv6 |
| --- | ---: | ---: | ---: | ---: | --- |
| 390×844 / 1 | 68.40s | 74.40s | 88.37s | 90.65s | 1, successfully thrown with Q |
| 350×844 / 17 | 70.20s | 76.20s | 89.78s | 90.98s | 1, successfully thrown with Q |

- Production focused replay at both sizes: real Giant kill → far-only 60-person release; Q and touchscreen activation both enabled and successful. Measured release depths **38.00–46.98 units**. Pause freezes the flight; resume detonates; invalid empty-battlefield requests preserve inventory; Retry clears inventory/flight/release lifecycle.
- `/topwar/` production sanity passed all six routes/viewport cases: current defense-mode JSON, capacity 3, current progression, versioned JSON/model URLs, no errors/404s, no DEV/TUNE controls or 4/5/6 activation. Existing real-gesture startup/audio sanity passed.
- Shoreline before/arc/blast captures inspected at 390×844 and 350×844. Existing analytic arc remains finite and reaches its captured destination, without renderer changes. Local captures/results: `artifacts/r3/far-{390,350}-{Q,touch}-{before,arc,blast}.png`, `artifacts/r3/grenade-smoke.json`, `artifacts/r3/production/production-sanity.json`, `artifacts/r3/audio/audio-start-sanity.json` (ignored QA output).
- Repeated focused throws held GPU resources at **101 geometries / 12 textures**, with the existing **16-instance dust capacity**. Accelerated natural QA skipped redundant GPU draws while retaining fixed simulation steps, input/audio/HUD and scene updates; this is functional QA, not a frame-time benchmark or physical-phone certification.

The initial browser harness checked detonation too soon after resume because the first resumed frame resets its clock. Allowing the full resumed flight interval passed; no game fix or weakened simulation assertion was needed.

Known build warnings remain the existing Zod PURE-comment annotations and >500kB bundle warning. No physical-phone certification. Existing r2 tag must remain unchanged; deployment stays manual-only.
