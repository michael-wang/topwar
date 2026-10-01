# Phase 2.5: Horde Pressure + Lane Input Polish

This beachhead-defense prototype tests many more visible enemies advancing much
more slowly: time to mow down crowds, read danger and choose the next lane. It keeps
Phase 2 lane targeting and beach presentation without adding progression.

## Controls and combat

A/D or Left/Right immediately steps one destination lane. Holding repeats after
350 ms, then every 220 ms using one input timer; OS repeat events do not determine
cadence. Timings are localized in `src/input/LaneStepInput.ts`. The latest pressed
key owns the hold, including opposite-direction presses with a fresh delay.
Releasing it does not resume an older held key. Reaching an edge stops scheduling;
key-up, focus entering a HUD control, window blur, Pause/stop and Retry clear timers.

Mobile remains one tap released on the gameplay area's left/right half = one lane.
Swipes and mobile holds do not steer. HUD, Pause, TUNE and Retry receive their own
input. The compact DEFEND label shows the selected lane immediately. Retry starts
at the middle lane and retains live tuning.

TUNE previously left focus on a hidden slider after closing, so lane input correctly
ignored keys targeting that slider. Closing TUNE now blurs focus inside the panel:
synchronously for Escape/programmatic close and on native details-toggle close.
Arrow-key range/select editing remains native while open; no battlefield click is
required after closing. Focus outside the panel is preserved.

The selected lane is plain serialized player state. Squad X approaches its center
in a configurable 0.15 seconds per lane. Rifle projectiles carry the lane selected
when fired, so changing lanes does not redirect existing shots. Swept forward
collision checks hit enemies of that lane regardless of small lateral offsets.
Tracers take a fixed trajectory toward the nearest same-lane enemy at firing time;
they do not home. An enemy killed before a tracer arrives can leave a tracer that
hits another member without perfect visual alignment. Evaluate this presentation.

Each wave generates ten members at its first row, every six rows. Seeded independent
lateral and depth samples replace paired depth slots, avoiding marching rows/queues.
Overlap and occlusion are intentional human-wave presentation: members need no
personal space and there is no enemy-to-enemy collision avoidance. Lateral samples
stay inside each corridor and track bounds; depth is bounded by the configured
cluster span plus jitter. Adjacent groups may overlap too. Explicit lane identity
keeps targeting independent of crowd geometry. Priority lanes still persist across
three groups; the total group budget is split between one/two pressure lanes.
The old group-row fit validation is only applied outside defense mode.

## Runtime tuning

Edit `public/game-data/game.json` and reload to change authored values; no production
rebuild is needed. The `catharsis` values are included in simulation snapshots.

| Value | Initial setting | Meaning |
| --- | --- | --- |
| `defenseMode` | true | Temporarily enables this focused experiment |
| `laneCount` | 5 | Configurable corridor count; try 3/4/5 |
| `edgeInset` | 0.4 | Centers span ±2.8 on a ±3.2 track; spacing 1.4 |
| `laneSwitchSeconds` | 0.15 | Time to traverse one lane spacing |
| `waveRows` | 6 | Group cadence: 3.6 world units at existing row spacing |
| `priorityWaves` | 3 | Groups before pressure lanes change |
| `groupSize` | 10 | Total members per group, including a possible Heavy |
| `secondLaneChance` | 0.4 | Chance of two priority lanes |
| `lateralSpreadFraction` | 0.26 | Maximum lateral offset as a fraction of lane spacing |
| `memberDepthSpacing` | 0.85 | Cluster span unit: floor((groupSize − 1) / (2 × pressure lanes)) × this value |
| `depthJitter` | 0.35 | Seeded positive/negative depth jitter |
| `heavyChance` | 0.25 | Chance of one Heavy replacing the first group member |
| `gruntSpeed` | 0.25 | Approach speed plus internal forward progression |
| `heavySpeed` | 0.12 | Slower Heavy approach speed |
| `heavyHp` | 5 | Five base Rifle hits; Grunt remains exactly 1 HP |
| `enemyVisualScale` | 1.4 | Retained enlarged Grunt model |
| `heavyVisualScale` | 1.35 | Relative multiplier; Heavy model scale 1.89 |

`player.forwardSpeed` (Approach pace) is **0.6 units/second**. Effective closing
speeds are initially 0.85 for Grunts and 0.72 for Heavies.
`weapon.rifle.fireRate` stays **5 shots/second**. TUNE keeps Fire rate, enemy scale,
Grunt speed, Heavy HP/speed/frequency, bullet speed/range, approach pace and music
volume. Reset Defaults restores authored values. Enemy lookahead remains 96 units,
so Retry is the quickest way to see frequency changes in nearby groups. Lane count,
switch duration and cluster layout are JSON controls. Legacy `groupRowStride` and
reward settings remain stored but are inactive in defense mode.

## Presentation and temporarily disabled systems

Defenders stand at the bottom of a sandy beach, with sea and broken shoreline
toward the upper battlefield. Staggered crossed obstacles and muted sand scuffs
suggest corridor openings. Bridge road, rails, road markings and bright corridor
lines are hidden. Existing generic industrial silhouettes, smoke, ships and aircraft
remain. Simulation still advances internally in Z; rendering subtracts player Z
and holds the environment fixed so the player reads as defending a position.

Boss spawning/showdown, normal enemy tier escalation, the ENEMY LV HUD and yellow
recruitment rewards are temporarily disabled. Their implementations remain available
outside defense mode. Irrelevant TUNE controls are hidden. Merge, tier power,
penetration, casualties and higher-tier infrastructure are retained without redesign;
the authored run starts with one soldier and no rewards to grow the squad.

No XP, upgrades, additional weapons/enemies, backend, framework or deployment.
The single-soldier opening is unforgiving: a missed lane can end the run quickly.
Assess that pressure and the 5 Hz rhythm before adding progression to compensate.

## Verification and phone playtest focus

Focused tests cover immediate stepping/clamping, hold delay/cadence/cancellation,
opposite direction, TUNE focus release, native editing and UI input isolation,
lane snapshot continuation, same-lane hits despite X spread, deterministic bounded
overlapping dense clusters, increased population, Grunt/Heavy health, 5 Hz defaults,
disabled streams/tier escalation and stationary beach presentation. Legacy system tests remain operational.

Run `npm test`, `npm run typecheck` and `npm run build` before delivery. Mobile browser
evidence is kept locally under `artifacts/horde-pressure/` at 390×844 with touch
enabled (390×693 gameplay area). Emulation does not replace a physical-phone test.
Evaluate corridor readability without bright markers, tap-release responsiveness,
the 150 ms switch, group readability near the horizon, and fixed tracer alignment
when enemies die before arrival.

Delivery verification: 375 tests in 54 files passed, as did typecheck and production
build. Existing dependency annotation and bundle-size warnings remain. No renderer
optimization or density reduction was made. Beach scenery is unchanged.

The seeded authored opening contains 190 active enemies versus the previous 40
(4.75×; group cadence/density is 5× over complete waves). Portrait browser samples
at 12–28 seconds contained 159–180 active enemies with 6–7 Heavies. Their centers
were inside the camera frustum; overlap and haze mean fewer individually distinct
silhouettes. Near Grunts remained readable and amber Heavies identifiable; distant
crowds obscure members and make corridor separation less clear. Evaluate that on
physical phones rather than treating every active unit as individually readable.

Software-rendered Chrome at DPR 1 observed 36–37 FPS (p95 33.4 ms). A separate
DPR 2 run observed 27–30 FPS, with 153–167 active enemies. A 15-second post-warm-up
sample averaged 34.8 ms, p95 50 ms and maximum 50.1 ms, with no frames above
100 ms. Initial loading had a larger catch-up hitch; no recurring long stall was
observed afterward. GC was not specifically profiled. Simulation CPU was about
0.1 ms and renderer submission about 0.6–0.9 ms. Local software rendering is slower
than the earlier light-crowd check and is not physical-phone GPU evidence.

The browser exercised native slider arrow editing, immediate A/Arrow response after
Escape closed TUNE without a battlefield click, delayed keyboard hold, mobile taps,
Pause, Reset Defaults, natural Game Over and Retry with no browser errors. The run
contained only Tier-1 Grunt/Heavy enemies, no Boss and no recruitment rewards.
