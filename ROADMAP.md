# Product roadmap

## NOW

GIANT physical-readability refinement (#33) supersedes the prior #14 presentation details. Arrival is now immediately opaque/original-color, with no emergence haze or HP-bar delay; GIANT hit sparks use larger 300ms upper-armor streaks and a brief ivory center, now varying across seven nearby chest contacts. Eleven original-colored mechanical pieces now collapse into a tighter footprint with less horizontal travel/skid, retaining ground contact and their 1.9–2.6s fade. Persistent wreck fire is removed; compact charcoal/gray smoke rises from two landed sources, then drifts gently right and fades near the wreck by roughly 2.15s. Spark variation is Pixel 8 PASS. Tighter debris and the localized smoke follow-up await owner review. The isolated [GIANT quick review](docs/GIANT_REVIEW.md) (#31) now exercises real MG hits/death and deterministic repeat without touching normal saves. New review-control phone usability remains pending.

Opening experience (#22/#23) has a [design proposal](docs/OPENING_PROPOSAL.md), **PROPOSED — NOT APPROVED FOR PRODUCTION**: silent Battle Showcase versus recommended lower-power Battlefield Diorama, followed by a proposed opening using the existing complete Commander recording. No attract, siren, Commander or production fullscreen code is authorized by that document.

Enemy artillery impact smoke now reads lighter gray with lower opacity, fade from .25s and expiry at 1.05s. Initial fire/flash and wind remain; all other VFX families are unchanged. Pixel 8 readability acceptance is pending.

Defeat’s 「作戰失敗」 poster now echoes victory with left-side results, lower-right battle-worn characters and 「再試一次」. The soldier is discouraged and the tired Commander supports his shoulder; a darker cool vignette reinforces the mood. The battlefield freezes after final casualty feedback; victory and saves retain their existing flow. Pixel 8 presentation acceptance is pending.

The navy/gold immediate loading cover and honest four-stage bar (#21) are Pixel 8 PASS. Protected recovery, the single Start gesture and Reload recovery remain. [Startup measurements](docs/STARTUP_PERFORMANCE.md) (#32) identify renderer CPU work: one byte-identical flower-atlas optimization saves ~87ms construction time and ~17% cold-ready latency under desktop 4× CPU slowdown. Native cold-ready improvement is not established; physical Pixel 8 measurements remain pending. No loading-stage timing is simulated.

Fullscreen (#28) DEV technical trial is accepted by the owner on Pixel 8. Android/Chrome edge-swipe exits are expected platform behavior, not an in-game defect to fix here. [Trial notes](docs/FULLSCREEN_TRIAL.md) remain; production integration belongs to a separate startup/Attract task, with HTTPS validation deferred.

Wreck smoke (#29) and Heavy death (#27) are Pixel 8 PASS / CLOSED; The original B-fast impact approval is retained as the reference for the new artillery-only readability follow-up. Hybrid D production acceptance (#12) and Tracer V5 acceptance (#25) remain open. Preserve those results, Hybrid D, Grenade/cannon visuals, four shared entries, historical checkpoints and manual deployment. Keep the DEV Explosion Lab as a reference tool.

## NEXT

1. Owner selects the attract concept and approves opening content, siren, briefing handoff and Retry/Skip policy (#22/#23) before implementation.
2. Plan the accepted fullscreen trial’s public single-gesture startup integration (#28) with future startup/Attract work after owner design approval; no implementation yet.
3. Owner reviews GIANT refinement/QA usability, startup performance/defeat and pending artillery/Hybrid D/tracer, Boss/Victory warning/music presentation on Pixel 8; preserve accepted gameplay and VFX.

## LATER

- Required before public playtest: production mobile fullscreen (#28), coordinated with arcade 「開始遊戲」 and startup/audio activation UX after the DEV technical trial. PWA/installed mode remains a separate future decision.



- Heavy readability in Grunt crowds: consider a modest height increase.
- Pixel 8 heat after prolonged play: measure on the device before targeted optimization.
- Targeted first-load and idle-performance improvements after device measurements.
- Further authored encounters, stages and art when explicitly requested.
