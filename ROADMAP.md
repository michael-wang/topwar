# Product roadmap

## NOW

P4.46 (#1): [Public Playtest Gate](docs/PUBLIC_PLAYTEST_GATE.md) technical checks PASS. Credits #15 (`eef2c09`), combined Start/fullscreen/Resume #28 and normal Stage-1 Pixel 8 play are Owner PASS. The remaining focused Boss-warning/Commander overlap fix is Julia `dc497c4` (one CSS rule); Owner Pixel 8 visual acceptance and a reviewed release SHA are pending. No deployment.

P4.44g (#23): Owner/Julia-approved P4.44f opening promoted to normal production/DEV Start without query; canonical voice, centered Commander, red alert and 16 real landings. Continue preserves history; Retry is immediate. Production code implemented; manual Pages deployment pending. Lower Lv1–3 pressure is temporarily accepted, with no rebalance in this release.

P4.40c lightweight UI (#36) is implemented and owner Pixel 8 PASS. Preserve its accepted Start, Pause, Boss warning and Retry/Replay treatment.

GIANT physical-readability refinement (#33) supersedes the prior #14 presentation details. Arrival is now immediately opaque/original-color, with no emergence haze or HP-bar delay; GIANT hit sparks use larger 300ms upper-armor streaks and a brief ivory center, now varying across seven nearby chest contacts. Eleven original-colored mechanical pieces now collapse into a tighter footprint with less horizontal travel/skid, retaining ground contact and their 1.9–2.6s fade. Persistent wreck fire is removed; eight denser charcoal/gray lobes now have 1.8× radius, over 3× projected area and stronger upward emergence for .30s, then gently drift right and fade near the wreck by roughly 2.15s. Arrival, spark variation, tight footprint and no persistent fire are Pixel 8 accepted. Amplified smoke is also Owner PASS. The isolated [GIANT quick review](docs/GIANT_REVIEW.md) (#31) now exercises real MG hits/death and deterministic repeat without touching normal saves. The review-control usability is Owner PASS.

Opening P4.43 (#22): Owner accepts the current Aegean Scenic Readability / Diorama composition for the first public playtest. P4.42 shared-coast/transition architecture is retained; further attract-mode art is a separate future decision. Shared side architecture gains asymmetric upper rooms, clear blue windows and stone terraces/steps; olive crowns, sparse flowers, sand/wet-shore shading and sea layers improve scenic readability. Decorative sentries now read nearer the player at the side edges and still leave behind facades. Camera B, Z45, gameplay, initial enemies, HUD and audio remain unchanged. No Pages deployment.

Enemy artillery impact smoke now reads lighter gray with lower opacity, fade from .25s and expiry at 1.05s. Initial fire/flash and wind remain; all other VFX families are unchanged. Owner Pixel 8 smoke readability is PASS.

Defeat’s 「作戰失敗」 poster now echoes victory with left-side results, lower-right battle-worn characters and 「再試一次」. The soldier is discouraged and the tired Commander supports his shoulder; a darker cool vignette reinforces the mood. The battlefield freezes after final casualty feedback; victory and saves retain their existing flow. Owner accepts the defeat results presentation for public playtest (PASS).

The navy/gold immediate loading cover and honest four-stage bar (#21) are Pixel 8 PASS. Protected recovery, the single Start gesture and Reload recovery remain. [Startup measurements](docs/STARTUP_PERFORMANCE.md) (#32) identify renderer CPU work: one byte-identical flower-atlas optimization saves ~87ms construction time and ~17% cold-ready latency under desktop 4× CPU slowdown. Native cold-ready improvement was not established by desktop measurements; Owner subsequently accepted observed Pixel 8 startup/performance for this release (#32 PASS). No loading-stage timing is simulated.

Fullscreen (#28): Owner reports production combined Start/audio/fullscreen and restored Resume work normally on Pixel 8 (PASS); external exits remain respected without automatic re-entry. Desktop/unsupported/denied modes remain playable. Final publicly hosted HTTPS smoke follows manual deployment.

Wreck smoke (#29) and Heavy death (#27) are Pixel 8 PASS / CLOSED; The original B-fast impact approval is retained as the reference for the new artillery-only readability follow-up. Hybrid D production (#12) is Owner Pixel 8 PASS. Orange Tracer B and shoreline range (#25) are Owner PASS. Preserve those results, Hybrid D, Grenade/cannon visuals, four shared entries, historical checkpoints and manual deployment. Keep the DEV Explosion Lab as a reference tool.

## NEXT

1. Owner verifies the focused BOSS warning / Commander clearance fix (`dc497c4`) on Pixel 8 in the natural and shared Boss entry (#34). Preserve accepted typography and encounter.
2. Confirm the final candidate SHA and CI result; keep Credits, opening, saves and approved art frozen.
3. With explicit Owner publication authorization, dispatch the existing manual Pages workflow for that exact SHA, then smoke-check the actual HTTPS Start/Continue/audio/assets.

## LATER

- Holistic difficulty review, including temporarily accepted Lv1–3 pressure. PWA/installed mode remains a separate future decision.

- Heavy readability in Grunt crowds: consider a modest height increase.
- Pixel 8 heat after prolonged play: measure on the device before targeted optimization.
- Targeted first-load and idle-performance improvements after device measurements.
- Further authored encounters, stages and art when explicitly requested.
