# Product roadmap

## NOW

GIANT physical-readability refinement (#33) supersedes the prior #14 presentation details. Arrival is now immediately opaque/original-color, with no emergence haze or HP-bar delay; GIANT hit sparks use larger 300ms upper-armor streaks and a brief ivory center, now varying across seven nearby chest contacts. Eleven original-colored mechanical pieces now collapse into a tighter footprint with less horizontal travel/skid, retaining ground contact and their 1.9–2.6s fade. Persistent wreck fire is removed; eight denser charcoal/gray lobes now have 1.8× radius, over 3× projected area and stronger upward emergence for .30s, then gently drift right and fade near the wreck by roughly 2.15s. Arrival, spark variation, tight footprint and no persistent fire are Pixel 8 accepted. Only amplified smoke awaits owner review. The isolated [GIANT quick review](docs/GIANT_REVIEW.md) (#31) now exercises real MG hits/death and deterministic repeat without touching normal saves. New review-control phone usability remains pending.

Opening (#22): the silent Concept B Battlefield Diorama now reuses the existing coastal renderer at ≤30Hz with one centered 「開始遊戲」 button. It is isolated from Simulation/RNG/audio/checkpoints; Continue bypasses it paused and Retry remains immediate. The base Diorama, clearer Greek houses and enemy landing-craft styling are owner-accepted. The latest composition pulls village/tree framing toward the foreground, retaining the seaward house shadow, and stages smaller, more orderly near-shore craft plus subtle distant fleet silhouettes. The ordinary combat composition remains unchanged. This follow-up awaits Pixel 8 review. Optional mobile portrait fullscreen (#28) now shares the real Start/audio gesture, with one first-Resume attempt after Continue and an explicit menu re-entry action; failure stays playable. Red Alert/Commander changes in the [proposal](docs/OPENING_PROPOSAL.md) remain unapproved.

Enemy artillery impact smoke now reads lighter gray with lower opacity, fade from .25s and expiry at 1.05s. Initial fire/flash and wind remain; all other VFX families are unchanged. Pixel 8 readability acceptance is pending.

Defeat’s 「作戰失敗」 poster now echoes victory with left-side results, lower-right battle-worn characters and 「再試一次」. The soldier is discouraged and the tired Commander supports his shoulder; a darker cool vignette reinforces the mood. The battlefield freezes after final casualty feedback; victory and saves retain their existing flow. Pixel 8 presentation acceptance is pending.

The navy/gold immediate loading cover and honest four-stage bar (#21) are Pixel 8 PASS. Protected recovery, the single Start gesture and Reload recovery remain. [Startup measurements](docs/STARTUP_PERFORMANCE.md) (#32) identify renderer CPU work: one byte-identical flower-atlas optimization saves ~87ms construction time and ~17% cold-ready latency under desktop 4× CPU slowdown. Native cold-ready improvement is not established; physical Pixel 8 measurements remain pending. No loading-stage timing is simulated.

Fullscreen (#28): the DEV trial remains Pixel 8 accepted. Production Start/first restored Resume now initiate audio then optional fullscreen synchronously; external exits are respected without automatic re-entry. Desktop/unsupported/denied modes remain playable. [Combined-gesture physical/HTTPS acceptance](docs/FULLSCREEN_TRIAL.md) is pending.

Wreck smoke (#29) and Heavy death (#27) are Pixel 8 PASS / CLOSED; The original B-fast impact approval is retained as the reference for the new artillery-only readability follow-up. Hybrid D production acceptance (#12) and Tracer V5 acceptance (#25) remain open. Preserve those results, Hybrid D, Grenade/cannon visuals, four shared entries, historical checkpoints and manual deployment. Keep the DEV Explosion Lab as a reference tool.

## NEXT

1. Owner reviews foreground Greek framing, open coastline, compact near-shore landing row, distant fleet and retained idle cost/reduced motion on Pixel 8 (#22).
2. Validate authorized combined Start/audio/fullscreen and restored Resume on Pixel 8 (#28); keep fallback playable.
3. Owner reviews GIANT refinement/QA usability, startup performance/defeat and pending artillery/Hybrid D/tracer, Boss/Victory warning/music presentation on Pixel 8; preserve accepted gameplay and VFX.

## LATER

- Red Alert/siren/briefing (#23) remain design-only pending owner approval; no Commander timing changes. PWA/installed mode remains a separate future decision.

- Heavy readability in Grunt crowds: consider a modest height increase.
- Pixel 8 heat after prolonged play: measure on the device before targeted optimization.
- Targeted first-load and idle-performance improvements after device measurements.
- Further authored encounters, stages and art when explicitly requested.
