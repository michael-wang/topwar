# P2A — First Weapon Evolution: Machine Gun

Historical phase evidence: measurements below used capacity 1. Current capacity is 3; the defense hint and standalone base-archetype review fixtures have been removed. See `PRE_RELEASE_REPORT.md` for current behavior and validation.

Starting baseline verified: HEAD, origin/main and live GitHub main were
`ff017d042e5d41e6d5aa703d75d197dfa1e3e8c2`; tracked and untracked worktree clean.
No deployment. This report describes the P2A commit containing this file.

## Accepted implementation

- XP costs **[28, 60, 110, 180, 220]**, temporary natural cap **Lv6**.
- Lv1–5 preserve Rifle I/II/III/III/III, 3/3.75/4.5 Hz per member and Lv4/Lv5 +1 rewards. Lv5 remains three staggered Rifles, 13.5 Hz total before casualties.
- Lv6 is **Machine Gun I / exactly one living specialist / 18 Hz**. Projectile speed **60**, range **80**, one projectile/event, **1 defense-enemy HP** per bullet. No AoE, penetration, knockback, stun, suppression or archetype multiplier. Full-health Heavy requires 15 hits; Giant requires ordinary one-HP hits.
- Crossing the family boundary replaces 3/2/1 living Rifles with one Tier-1 specialist. It neither heals a dead squad nor emits casualties, death visuals, damage flashes or XP changes. Old-family bullets are discarded and primary/member clocks reset to 1/18 second. Actual contact events in the same render frame retain damage feedback. Held/in-flight Grenade is independent and preserved.
- Natural Giant unlock **6→7**, beyond cap. HP 172 and its DEV/review fixture unchanged; reinforcement and disabled landing assault remain deferred. Existing quantity multipliers are unchanged, including Lv6 1.35 (32-member future groups). No global difficulty edit.
- Accepted Grenade unchanged: capacity 1, damage 9 HP, radius 4, no falloff, flight .65 s, first supply Lv3+8 s, one-hit acquisition, current-lane targeting/ties, Q and ordinary kill XP.

## Engineering and presentation

`src/config/progressionConfig.ts::ProgressionConfigSchema` validates XP count = plan length minus one, explicit `rifle`/`machineGun`, family-local non-regressive stages and the Rifle→MG Stage-I transition. Authored data lives in `public/game-data/game.json`; MG values are validated by `src/config/catharsisConfig.ts`. Complete legacy Rifle-only five-stage snapshot plans remain valid with their own authored cap; no silent snapshot migration.

`src/simulation/progression.ts::effectivePrimaryFireRate` dispatches the authored family. `Simulation.step` shares projectile scheduling/collision and `damageEnemy`/`awardKill` with Rifle; MG only adds a presentation kind. Snapshot validation preserves the one-specialist invariant. `setCatharsisBalance` also handles a live XP/plan edit that enters MG coherently. Existing primary composition/clock fields retain their Rifle names for compatibility; there is no generic inventory/framework.

`projectRenderState` derives family from authoritative progression/configuration. `ChibiPlayerFamily` adds one merged rounded MG receiver, belt box, stock and thick ribbed barrel, sharing the Rifle material, grips and muzzle anchor. Accepted body/face/uniform are untouched. `SquadRenderer` swaps the held geometry and reuses its bounded muzzle: MG 70 ms / 1.45× versus Rifle 50 ms / 1×. Existing level-up afterglow remains. `ProjectileRenderer` reuses tracer batches. Enemy hit/death rendering and coastal scene are unchanged.

`GameAudio::AudioCueObserver` samples MG at at most nine cues/second; each 105 ms single voice has two short envelope pulses. Rifle sound behavior and activation architecture are unchanged. `GameApp` excludes intentional evolution from defense-loss feedback. `GameIcons`, `loadoutPresentation` and `XpHud` switch to the MG/belt-box silhouette and one filled cartridge pip (Stage I), without permanent weapon-name text.

`DevReviewFixtures::createDevReviewFixture` / `DevReviewControls` add DEV **MG**: Lv6, one center specialist, 60 Grunts + five full-health Heavies, all five lanes, fixed uneven depths 8–24. Center has 12 Grunts and one Heavy. No Giant/Boss or charge requirement. Stream cursor is advanced beyond short review. MG/reset restores identical combat state; ordinary HP, collision, XP and deaths apply. Control focus releases for immediate lane keys. Production excludes all Lab controls and fixture factory.

## Controlled Lv5 vs Lv6

Real simulation, 60 Hz, same ordinary enemies/movement and authored weapons. Cadence is counted after a one-second warmup over ten seconds. Grunt pack = 30 center-lane Grunts at depths 12–12.58. Heavy = one center-lane full-health Heavy at depth 12. No balance overrides.

| Metric | Lv5: three Rifles | Lv6: one MG |
| --- | ---: | ---: |
| Observed projectile cadence | 13.5 Hz | 18 Hz (+33.33%) |
| Clear 30 Grunts, including travel | 2.317 s | 1.783 s |
| Average pack kills/sec, including travel | 12.95 | 16.82 |
| Full-health Heavy death, from encounter start | 1.217 s | .967 s |
| Heavy first-hit→death span | 1.017 s | .767 s |

First impact is .200 s in both cases. The Heavy receives exactly 15 one-HP hits; first-hit→last-hit spans 14 shot intervals, explaining the ~.77 s rather than 15/18=.833 s value. Fixed-step rounding and moving-target projectile travel apply. No projectile-speed increase.

Ordinary 12-Grunt Grenade burst at Lv5/215 XP crosses 220 once into one MG, cap XP0, with 12 nominal ordinary XP. A much larger grant crossing Lv3/Lv4/Lv5/Lv6 also produces one coherent specialist. Concurrent Rifle/MG lethal hits cannot award duplicate XP. Cap overflow is discarded by the existing `grantXp` behavior.

## Natural seed measurements

`scripts/qa/p2a-metrics.mjs` extends the existing P1.5 pilot, with its Grenade policy, to Lv6. It selects nearest threat every 200 ms, prioritizes supply; the hesitation variant holds lane 1.8 seconds starting Lv3+3 s. No global overrides. Times are simulation seconds. Normal and hesitation give the same milestone times for the three required seeds:

| Seed | Lv2 | Lv3 | Lv4 | Lv5 | Lv6 | Lv5 duration | Active at Lv6 | Near-defense |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 9.33 | 26.63 | 49.93 | 70.88 | 103.85 | 32.97 | 26 | 0 |
| 17 | 12.93 | 30.23 | 48.55 | 70.30 | 98.08 | 27.78 | 23 | 0 |
| 42 | 10.97 | 26.95 | 48.53 | 70.55 | 93.18 | 22.63 | 11 | 0 |

Near-defense means depth ≤10. At Lv6, per-lane remaining hit debt is
`[10,0,0,6,10]`, `[0,10,3,10,0]`, `[0,0,1,10,0]`; near-lane debt is all zero.
Nearest threat distances are 37.98/39.56/36.83, approximate contact times
44.07/45.92/42.72 s, and active Heavy overlap zero. Each evolves 3→1 from XP219;
none has contact casualties/failure. These metrics do not infer pressure from enemy count alone.

Broader batch: **100 runs**, seeds 1–50 × normal/hesitation. All reach Lv6 with
zero casualties/failures. Lv5 duration 21.75–38.38 s; medians 29.88 s normal,
29.77 s hesitation. Lv6 arrival 93.10–105.75 s, active counts 2–29, near-defense
zero at evolution. The competent pilot is unusually efficient; identical
required-seed hesitation timings are a limitation, not proof that real hesitation
is costless. **220 XP remains unchanged**, pending human playtest.

Raw outputs: ignored `artifacts/p2a/metrics.json`, `timelines.json`. The shared
P1.5 diagnostics still stop at Lv5 by default; P2A explicitly requests Lv6.

## Validation and resource evidence

- **728 tests / 122 test files passed**; typecheck passed; production build passed (237 modules). Existing dependency-annotation and >500 kB bundle warnings remain; no new package/dependency.
- Focused tests cover family-local schema, unchanged stages, 18 Hz/shared damage/lane behavior, 15-hit Heavy, ordinary Giant damage, burst overflow, 3/2/1 evolution, before/after snapshot continuation, held Grenade, live config transition, no casualty feedback, shared XP and deterministic fixture/reset.
- `machine-gun-sanity.mjs`: 390×844 and 350×844, real MG button, distinct HUD and held gun, center mowing, lane changes, Pause, fixture Retry and normal Lv1 Retry. Browser evolution variants 3/2/1→1 report zero damage/fatal cues and retained snapshot MG state. Center clears its 12 Grunts and one Heavy within the three-second observation. Captures `mg-firing-*` / `mg-after-*` in `artifacts/p2a` were visually inspected.
- Existing `audio-start-sanity.mjs` and `live-sanity.mjs` pass: frozen pre-start, real touch/mouse/keyboard start, native audio activation, Pause/Retry, normal/review starts and lane controls. `production-sanity.mjs` passes default, normal and threat-review routes: zero Lab/GRENADE/MG controls and no browser errors; bundle scan excludes Lab code.
- Existing `p15-browser.mjs` also passes one-hit supply, empty-lane charge retention, SafeArea/input isolation, Pause/Retry, ten-kill ordinary XP, Heavy 6 HP / Giant 163 HP and repeated burst resources.
- Accepted GRENADE fixture regression passes at both widths: representative blast 35 Grunts / 35 XP; Heavy HP 6/6/15; Q/button/focus guards and repeat resources stable. Grenade-specific gameplay values unchanged.
- Five warmed MG resets remain **86 geometries / 11 textures / 32 projectile slots**; no reset growth. Sustained empty-center MG reaches 24 live tracers, versus 18 for Lv5. Existing enemy death pools retire normally.

Warmed native-RAF comparison at 350×844 / DPR2 / Chrome SwiftShader, six-second
measurement after 2.2-second warmup, last 120 frames:

| Diagnostic | Lv5 | MG |
| --- | ---: | ---: |
| Frame average / p95 | 49.31 / 50.10 ms | 47.92 / 50.10 ms |
| Simulation average | .277 ms | .304 ms |
| Renderer submission average | 1.475 ms | 1.525 ms |
| Audio observer average | .071 ms | .076 ms |
| Peak observed active SFX sources (100 ms sampling) | 4 | 4 |
| Peak draw calls | 160 | 148 |

Native audio context stays running; 37 MG cues over the six-second sample, no
Rifle cue replacement in Lv5. Crowd starts from identical fixture placement;
the final warm window peaks at 53→52 enemies for Lv5 and 52 for MG, so this is a resource sanity
comparison, not a statistically controlled hardware benchmark. The software
renderer is already slow (~20–21 FPS); CPU submission excludes GPU completion.
An earlier warm run measured 46.25 ms vs 45.00 ms frames and .252 vs .229 ms simulation; the final run above shows small CPU increases for MG but lower frame time, illustrating software-renderer variability. There is no obvious material MG regression in these samples, **no physical-phone certification**.

## Human review questions

- Does the ~22–38 s Lv5 wait at 220 XP feel right after the third Rifle reward?
- Does one concentrated specialist feel stronger and read as a clear evolution at portrait size, despite intentionally returning to one living body?
- Does sampled two-pulse audio convey satisfying sustained fire on phone speakers without harshness or overlap?
- Does natural Lv6 remain engaging without the Giant, which P2B must deliberately reintroduce?

No requested balance value differs. No new enemy or later weapon was added.
