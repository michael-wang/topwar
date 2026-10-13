# Accepted Beachhead Defense gameplay

This is the current closed-playtest contract. Balance values live in `public/game-data/game.json`; this document does not authorize further tuning.

## Controls and combat

Five stationary lanes; player Z=0. Hold left/right for adjacent lane steps, or use A/D/arrows. Touch uses the most recently pressed finger; releasing it restores the newest remaining finger. Same-direction fingers share one cadence without duplicate steps. Direction changes step immediately, then repeat after 180ms at 120ms intervals. In portrait touch mode, transparent hit areas reach the viewport’s lower corners and safe inset, extend 13px above the visible faces, and cover 20% of each XP end while preserving its center and the unchanged button art. Pause/end/retry, lost focus and page hiding clear held input. The squad fires automatically along its selected corridor. Projectiles, swept collision, damage, targeting and RNG are authoritative Simulation behavior. A direct enemy contact or artillery hit removes one living soldier; losing the last soldier is Game Over. Weapon-stage upgrades do not undo casualties.

## 海防指揮官通訊

The same royal-blue officer uses the fixed upper radio slot: neutral for Command, alert for naval/Tank warnings, and victory for the Stage 1 salute. Opening phrases are 「這裡是海防指揮部。」「其他防線已經失守，灘頭只剩你們這支部隊。」「這裡是港口最後一道防線。」「無論如何，守住它！」. Gameplay begins independently. Approved Commander intro (10.188s) and victory (8.673s) recordings use the existing prefetch/decode/radio pipeline. The optional victory.webp is enabled only when present in the build; absent or failed media uses readable subtitles and neutral art without missing-file requests. Decoded speech duration determines subtitle progression and communication completion, with a short closing margin. Pause freezes the presentation and resumes speech from its offset; restoring a battle never arms a fresh mission introduction.

## Progression

| Level | Weapon | Stage | Authored squad | Hz per soldier | Full-squad Hz |
|---|---|---:|---:|---:|---:|
| 1 | Rifle | 1 | 1 | 3 | 3 |
| 2 | Rifle | 2 | 1 | 3.75 | 3.75 |
| 3 | Rifle | 3 | 1 | 4.5 | 4.5 |
| 4 | Rifle | 3 | 2 | 4.5 | 9 |
| 5 | Rifle | 3 | 3 | 4.5 | 13.5 |
| 6 | MG | 1 | 1 | 18 | 18 |
| 7 | MG | 2 | 1 | 22.5 | 22.5 |
| 8 | MG | 3 | 1 | 27 | 27 |
| 9 | MG | 3 | 2 | 27 | 54 |
| 10 | MG | 3 | 3 | 27 | 81 |

Adjacent-level XP costs are 28 / 60 / 110 / 180 / 220 / 200 / 300 / 350 / 450. Grunts grant 1 XP, Heavies 10, Giants 120. Overflow applies each progression delta once. MG Evolution replaces living Rifles with one specialist. New squad stages add one soldier; casualty loss is otherwise preserved. Lv10 remains a temporary cap. Ink Spear projectile appearance stays stable through Level Up.

## Ordinary pressure and Giant

The dangerous Lv3→4 transition is retained. At Lv4 XP≥35%, ordinary waves contain two Heavies across four pressure lanes; at Lv5 XP≥25%, three Heavies across three lanes. Thresholds do not change wave population or cadence. Giant introduction occurs on the tick reaching Lv4, at the distant spawn position, in a least-crowded interior lane: 172 HP, 0.68 authored speed, 120 XP, once per run. Ordinary combat determines its survival.

Grunts have 1 HP; Heavies have 15 HP. Existing approach rules, lane cursors and stamped Survival speed multipliers are preserved.

## Carnival, naval presence and Survival

Lv6 Evolution admits the one-time 60-enemy release (one Heavy), starts Carnival and introduces the Destroyer without clearing existing enemies. Carnival owns ordinary admissions for 3.2 seconds, retaining its +2-second Grunt opportunity (up to 36, maximum 80 active enemies for Carnival admissions) and accepted lane patterns. There is no parallel ordinary wave stream.

The Observer warning begins at +1.3 seconds. At MG Release +3.2 seconds, Carnival ends as the Destroyer finishes entering, and AHEAD Survival takes over. Its first mixed wave arrives at +4.2 seconds: 26 Grunts and four Heavies across three lanes at Lv6–7, followed by the existing six-second cadence. Higher levels use the profiles below. Barrage activation remains at +8.5 seconds, with a separate two-second initial firing delay; the first attack is at the first fixed tick at +10.5 seconds. The Destroyer remains offshore. Historical checkpoints retain their own Carnival and encounter schedules; the original five scripted launches are historical save behavior only.

Current Stage 1 salvos contain one or two shells, 50/50, in distinct randomly selected lanes. Only one unresolved salvo is allowed. After its final authoritative impact, draw one floating-point uniform quiet gap in [2,5) seconds from the dedicated naval RNG; launch at the first eligible fixed tick. No repeated draws, catch-up bursts or automatic difficulty mitigation. Historical configurations retain launch-based or discrete-gap semantics. Shell trajectory, collision, damage, impact effects and audio are unchanged.

Warnings begin as fully saturated bright-red inverted triangle outlines with transparent interiors and clear ivory exclamations at fixed overhead lane positions. Red fills inward from the edges toward the center; the filled area directly tracks elapsed flight fraction and is nearly full before impact. Color and opacity stay constant, with the existing scale pulse in the final 150ms. Each lane reflects its earliest incoming impact; multiple threats retain the marker until the last resolves. Pause freezes fill and pulse; restore reconstructs from active shells. Current Stage 1 has no ground warning circles.

## AHEAD Survival before the Tank Boss

| Level | Grunts | Heavies | Pressure lanes | Interval | Ordinary speed multiplier |
|---|---:|---:|---:|---:|---:|
| 6–7 | 26 | 4 | 3 | 6s | 1.0 |
| 8 | 31 | 11 | 4 | 6s | 1.4 |
| 9 | 27 | 15 | 5 | 5s | 1.6 |
| 10 | 23 | 19 | 5 | 4s | 1.6 |

At Lv8 XP≥245/350, future waves retain 31/11 and six seconds but use five lanes and 1.6× ordinary speed. Existing enemies and deadlines are never rewritten. Select profiles by progression level, not surviving squad size. Ordinary admissions cannot push active population above 180; blocked opportunities are consumed without backlog. Giant opportunities occur every 24 seconds, maximum one living Giant, skipped if occupied. Supply opportunities occur every 30 seconds, maximum one active crate. Neither system catches up skipped opportunities. Current runs hand enemy admission to the Tank Boss at Lv9; historical saves without its authored configuration retain their original Lv9–10 Survival profiles above.

## Stage 1 Tank Boss — initial phone playtest

Reaching Lv9 stops new Destroyer launches and ordinary/Carnival/periodic Giant admissions. Airborne shells land normally; Lane 1/5 troops remain. A translucent full-battlefield red pulse and border announce the tank for its 2.5-second entrance, synchronized to the two-tone alarm; reduced-motion uses a steady faint tint. The alerted 海防指揮官 stays in the usual upper communication slot with Traditional Chinese subtitles and Radio Open/Close. Its supplied 4.6-second Mandarin recording is preloaded before landing; speech and the five-second subtitle window begin at entrance +0.3s without delaying combat. Pause/Resume follows the voice offset; restore shows remaining subtitles without replaying speech. Missing audio cannot block gameplay. At about 0.5 seconds the ship doors open and the tank's shockwave clears existing Lane 2/3/4 troops once, with reused knockback/dust and no XP or direct-kill credit. The giant armored tank lands in 2.5 seconds, then immediately attacks. Its numeric HP bar follows the projected turret once active. Central Lane 2/3/4 share one 6500-HP armor rectangle; bullets use their existing damage and stop at the nearest enemy, Supply or armor. Grenades retain their existing targeting, 9-HP damage and radius, and can target/hit armor. The Boss is vulnerable once landed; Lv10 is not required to defeat it.

| Phase | HP | Distinct-lane shells | Post-impact cooldown | Advance units/s | Flanks per Lane 1/5 | Flank interval | Giant |
|---|---|---:|---:|---:|---|---:|---|
| 1 | >70% | 1 | 4s | 0.12 | 3 Heavy + 1 Grunt | 6s | none |
| 2 | >35%–70% | 2 | 3s | 0.16 | 3 Heavy + 1 Grunt | 4s | every 12s |
| 3 | 0–35% | 3 | 2s | 0.16 | 5 Heavy + 1 Grunt | 4s | every 12s |

New Boss flank groups begin at 28 units, retaining row spacing. Heavy speeds are 1.4/1.7/2.0 units/s for phases 1/2/3; Giant speeds are 1.1/1.3 for phases 2/3. Each admission retains its speed through phase changes and checkpoint recovery. Ordinary/AHEAD troops and older checkpoints retain their authored speeds and spawn distances.

An original 116-BPM Tank theme replaces ordinary music: low bass during entrance, a distinct four-bar melody and war drums in phase 1, denser rhythm in phase 2, and octave accents in phase 3. The saved encounter clock anchors music on restore; Pause silences/freezes it and victory stops the Boss theme. After the complete Commander speech (or Skip), results start an original 96-BPM, eight-bar / 20-second F-major victory melody with synthetic brass, warm string-like pads and a resolved soft tail. The results presentation clock follows Pause/Resume and Retry; radio ducking and accepted Boss phase themes remain unchanged.

One unresolved tank salvo at a time; cooldown starts at its final impact using the current phase. New Tank shells use Boss-specific Artillery Flight Parameters with a minimum 2.4-second flight in all phases, including near the defense line; Destroyer flight is unchanged. Tank checkpoints without that field receive the same default for future launches; airborne shells retain their trajectories. Tank targeting uses a dedicated saved RNG; all five lanes are eligible. Flank Giants alternate between Lane 1 and 5. These troops grant normal XP and Lv10 squad rewards. Supply retains its existing schedule and uncapped inventory. No admission backlog or automatic difficulty mitigation. The tank's front crossing the defense line ends the run, regardless of surviving squad size. All parameters live in `catharsis.defenseTank`.

At zero HP, stop admissions and attacks immediately, cancel all airborne shells/warnings, and kill remaining troops without crediting them as direct kills. Consecutive explosions culminate in a large finale; an armored wreck remains. After the 3.2-second finale, the wreck remains beneath an upper Commander communication: 「做得好！敵軍超重型坦克已被摧毀！」「你們守住了灘頭。」「各位，辛苦了……」「我以你們為榮！」. Completion or 略過 opens the results; skipping is available only after the explosions. 第一關通關！ shows 通關時間, 擊殺總數, 一般兵／重裝兵／巨人兵, 發射子彈, 命中子彈, 命中率 and 使用手榴彈, with 再玩一次. Results are an arcade victory poster with one black gradient veil and no cards or statistic panels: gold title at 5–17% height; 18–50% stays free of result text for the unchanged wreck/camera; clear time, total kills and accuracy appear directly on the left at 50–88%; a complete transparent Commander/blue-helmet soldier shoulder-touch illustration occupies the right. Kill breakdown and smaller shot/Grenade figures occupy the lower negative space, above the gold Replay CTA at 89–97% with safe-inset support. Combat HUD stays hidden only during results and returns on Retry. Title, main figures, secondary figures, illustration and CTA enter in about 2.4 seconds; reduced-motion shows all content immediately. The existing eight-instance smoke pool rises slowly above the wreck, with three bounded orange/gold local fires and no recurring explosions or movement of authoritative Tank data. Accuracy counts each bullet that hits an enemy or tank once; Supply hits and Grenades do not enter its numerator. Gameplay and final statistics freeze at the lethal tick. Pause freezes the finale and victory presentation; restored encounters do not replay one-shot launch/death cues.

## Golden Grenades

The Lv3 teaching Supply appears after eight seconds and grants three Grenades; recurring Supplies grant one. Three is a teaching reward, never an inventory cap. Inventory is a nonnegative safe integer with checked addition up to Number.MAX_SAFE_INTEGER. The reward event reports only the actual award; numerical overflow cannot produce false acquisition feedback. Holding 20 or 1000 does not block recurring Supplies or allocate proportional resources.

A successful throw consumes one Grenade and creates one authoritative flight. One flight at a time; Q and the HUD use the same input path. Existing global threat selection, 0.65-second flight, 9-HP damage and radius 4 remain unchanged. A blast overlapping active Tank armor applies the same 9 HP once, with a stronger local armor flash and actual damage text beside Boss HP; nearer flank enemies may still be selected as the throw's target. Launch sound and gold HUD pulse occur only for an actual throw. Acquisition transfer, launch and explosion feedback remain distinct. Staged crate destruction retains its three stages and 0.7-second recovery windows.

## Presentation, lifecycle and QA

Accepted Blue Squad, Grunt/Heavy/Giant, coastal scene, Ink Spear, Golden Grenade and Destroyer art are unchanged. Distant infernos, random background artillery/flak visuals and sounds, and ambient ash are retired. Coastal buildings, sea, clouds, aircraft, Giant foot dust and all actual combat effects remain. Traditional Chinese Commander dialogue uses prepared portraits and Mandarin voice; one usable portrait substitutes for both expressions, and failed portraits use a local radio emblem. Warnings are never suppressed by missing portraits.

Tap-to-Start and Resume are real audio activation gestures. Pause/hidden/freeze/context loss suspend simulation, clear held inputs and release Wake Lock. Visibility return never automatically resumes. Full authoritative checkpoints preserve RNG, weapon clocks, enemy HP/positions, projectiles, Grenades, progression and encounter schedules. Continue remains paused and does not replay one-shot feedback.

Local DEV has LATE, CRATE3, CRATE8, NAVAL plus MG TEST, four-mode SURVIVAL TEST, NAVAL BARRAGE and BOSS TEST. The five Boss entries use shipping Tank combat and schedules: INTRO retains an advancing Lv8 AHEAD crowd; PHASE 1/2/3 start at 100%/65%/30% HP; FINISH starts at 2%. Pause/Continue and Retry preserve the selected entry. Shipping exposes only a subtle confirmed QA hatch for Wake Lock/checkpoint status and realistic Lv10 screen-sleep/reload testing. The sleep fixture saves real bounded resources, freezes progression and releases Wake Lock; a page cannot force Android screen timeout or Chrome discard.
