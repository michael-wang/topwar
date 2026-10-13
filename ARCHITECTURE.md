# Engineering contracts

## Dependency direction

`game-data → ConfigStore → Simulation → RenderState → Three.js renderer`.

Dev controls and snapshot/checkpoint adapters command Simulation through explicit APIs. Simulation imports neither Three.js nor DOM/storage APIs. Plain-data state is authoritative; renderer state is disposable. No backend, ECS framework or generic plugin system is required.

## Deterministic Defense simulation

The game uses fixed steps, authored five-lane admissions and explicit progression plans. Reproducibility depends on config, level, seed and inputs. Gameplay never uses Math.random(). Enemy composition/placement cursors, Giant and Supply opportunities remain independent of dedicated naval RNG. Presentation schedulers do not consume gameplay RNG.

Enemy waves/Carnival/Survival own enemy admissions; NavalPresence owns ship lifecycle; NavalBarrage owns attacks and clocks; levelEncounters supplies small authored component actions. Artillery owns authoritative flight, impact and casualties. Naval visibility cannot suppress Survival. Profile changes affect future admissions only. Blocked opportunities cannot build backlogs.

Optional authored `defenseTank` owns the Lv9 encounter, a single HP/phase/rectangle, entry/advance, flank admissions and post-impact attack clocks. It suppresses other enemy admission and new naval fire while leaving old shells to resolve. Its own saved RNG supplies distinct attack lanes. Tank shells use ordinary Artillery; renderer resources remain disposable. `combatStats` counts player shots, direct kills and successful throws at authoritative boundaries. Tank clear freezes gameplay and excludes the forced enemy cleanup from direct kills; presentation time owns the bounded explosion finale and clear overlay.

## Configuration and persistence

Optional authored `commanderSupport` and its plain-data state own the first-Giant announcement and one deterministic Boss flank airstrike. A warning locks nearest-first enemy IDs; three fixed-step rounds remove only that quota without kill/XP rewards or schedule changes. Checkpoints capture warning/bomb clocks, pending IDs and round progress. Missing historical state stays absent; restoration never arms retrospective support. Transient bomb events are consumed once and discarded on restore. Commander radio has a small per-attempt priority queue that preserves playing recordings; it cannot gate combat. One disposable aircraft and a four-slot existing explosion pool provide the brief support presentation, without reviving ambient war schedulers.

ConfigStore validates authored JSON and supported runtime overrides atomically. Production public URLs are content-addressed and preserve /topwar/; unchanged portraits/audio retain URLs across commits. Accepted character, weapon and environment meshes are procedural. No retired GLB is downloaded.

Simulation.restoreState performs strict transactional validation. Released Beachhead Defense eight- and ten-level plans preserve their saved progression, movement rules, concurrent/sequential Carnival/Destroyer policy, discrete/continuous naval cooldowns, active shells and Survival deadlines. Grenade capacity in historical config is only a teaching-reward alias; continuing inventory accumulates safely.

Tank state and statistics are optional plain-data checkpoint fields. Historical saves without authored tank configuration keep their original encounters and wire state; no tank or retrospective statistics are injected into them. New checkpoints capture all tank/phase/flank/attack clocks and statistics alongside existing shells and RNG. Boss Heavy/Giant admissions optionally stamp their absolute approach speed on each enemy; unstamped enemies and older configurations retain their existing movement policy. The entrance-cleared flag prevents repeat cleanup; restoring clears disposable impact events and suppresses awarded alarm/radio cues. Older Tank states remain readable. The legacy `boss: null` wire field remains inert.

A small set of inert wire fields (empty Boss/gate/reward/pickup state, zero rocket clocks, Tier-1 roster and stream cursors) remains to avoid breaking released Defense snapshots. Optional historical config/tuning metadata is parsed but has no retired gameplay implementation. Nonempty old Boss/rocket/gate/finite-formation or non-Defense prototype saves are unsupported; recovery offers a safe fresh start rather than reinterpreting them.

SessionCheckpoint uses one localStorage slot per DEV/release origin, format and simulation contract version 1, bounded to 1,048,576 characters before parsing/writing. Pause and hide save full state with caught storage failures. Early SessionRecovery validates and captures Continue/New Game before asset initialization; only one GameApp and asset preparation are created. Continue stays paused; Retry/New Game clears stale progress. No per-frame serialization.

## Rendering and audio

RenderState contains current player/enemy/projectile/Grenade/naval/artillery/progression data, never GPU objects. Instanced projectile and crowd batches, bounded effect pools and idle presentation preparation preserve mobile performance. Heavy HP bars, accepted VFX intensity and rendering resolution are not reduced. Retry/reset clears transient feedback; disposal releases owned resources once. Restoring state initializes observations without replaying launch, acquisition, Level Up or Observer cues.

BridgeEnvironment retains its name but owns the current coastal battlefield, transports, architecture and distant aircraft. WarActivityScheduler schedules aircraft only. Background infernos, random artillery/flak visuals and audio are retired; no associated resources or frame updates remain. BattlefieldAir owns only pooled Giant foot dust. Gameplay artillery and shared combat audio buffers remain independent.

GameAudio uses one browser-activated AudioContext and prepared procedural buffers. Voice readiness is independent of optional portrait success. Pause and lifecycle suspension preserve synchronization; explicit Resume handles browser autoplay restrictions.

## Browser lifecycle and tools

Hidden/pagehide/freeze/context loss suspend simulation and held input, save and release Screen Wake Lock. Returning visible remains paused. Wake Lock acquisition is race-safe, optional and secure-context-only; failures cannot block gameplay. The DEV QA sleep scenario suppresses reacquisition until exited. Historical release QA checkpoints still restore their Defense state; public builds ignore the old armed-test flag and permit ordinary Resume.

The closed-playtest build shares three scene buttons, the menu and minimal Simulation initializers with local Vite. PlaytestScenarios owns only Naval entrance, Boss entrance and Victory; DevTankReview/DevReviewFixtures retain regression presets outside production. QaPanel, diagnostics, stress fixtures and advanced tuning remain compile-time DEV-only. No URL-based scene launcher exists. The existing checkpoint envelope optionally carries Victory-preview explosion/radio progress; normal saves and clocks are unchanged. Browser automation exposes private app references only by intercepting test responses. Retained regression scenarios are installed by the test-side fixture helper. Artifacts are ignored; reviewed reports/inventories are tracked. Deployment remains manual workflow_dispatch.
