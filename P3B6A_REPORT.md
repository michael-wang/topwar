# P3-B.6A Machine Gun progression to Lv10

Implementation: 34934468f75f03b39bdce07fc32bc3f0897f6144. Baseline: f1d843a25b7644bfa2ee1062398bdf31b24e3ada. Validation date: 2026-10-11 (Asia/Taipei).
Frozen playtest tag: 59136b49e1328ab754412f7affe90c755c76c0fd. No deployment, Survival tuning, enemy recoloring or P3-C.

## Authored progression and implementation

Lv1–5 are unchanged. The current game.json explicitly authors ten stages; compatibility defaults remain the old eight-stage plan.

| Level | MG stage | Hz per living soldier | Squad unlock | Full-squad Hz | Cartridge/soldier HUD pips | XP to next |
| --- | --- | --- | --- | --- | --- | --- |
| 6 | I | 18 | 1 | 18 | 1 / hidden | 200 |
| 7 | II | 22.5 | 1 | 22.5 | 2 / hidden | 300 |
| 8 | III | 27 | 1 | 27 | 3 / hidden | 350 |
| 9 | III | 27 | 2 | 54 | 3 / 2 | 450 |
| 10 | III | 27 | 3 | 81 | 3 / 3 | cap |

The original XP prefix remains 28/60/110/180/220/200/300. Only 350/450 are appended. MG Stage I retains its authored base rate; stages II/III use the shared 1.25/1.5 multipliers. This also preserves historical flat MG rates when old Rifle multipliers were edited independently. Damage, projectile speed 60/range 80, hitboxes, lane targeting, player controls, enemy HP/speeds, Grunt/Heavy/Giant XP and all Survival admissions/opportunities remain unchanged.

Every crossed level applies a squad-stage delta once. Rate-only Lv7/Lv8 cannot recruit or reverse casualties. Same-tick fatal contacts do not revive an MG soldier even if the projectile earns the next level. Lv9/10 recruitment adds only the reward delta to survivors. Surviving member clocks retain their phase; faster stages clamp the next deadline before inserting new members into unused phases. This also fixes duplicate phases when one XP burst skips Evolution and both subsequent rate/squad stages. Live threshold edits follow the same rule. Tests count steady ten-second firing per member: 180/225/270 shots, or 540/810 total at full Lv9/Lv10.

The existing loadout/XP HUD derives stages and cap from the saved plan, so no new HUD widgets or visual art are needed. MG cartridge upgrades pulse at Lv7/8; squad pips appear at Lv9/10. Ink Spear geometry/colors/scaling and its two pooled batches are unchanged; Level Up never changes projectile appearance. Existing automatic-fire audio sampling remains bounded.

Human DEV remains LATE/CRATE3/CRATE8/NAVAL. LATE is immediate Lv10 three-MG Survival with the existing 42-enemy group; NAVAL is the same isolated three-MG artillery review at Lv10. CRATE3 remains Lv3 Rifle; CRATE8 now correctly has one Stage III MG at Lv8. Test-only MG7/8/9/10 match their named level, LATE retains its old Lv6 QA entry, CRATE10 preserves three-MG crate testing, and SHELL uses the saved three-MG cap. Historical fixture goldens explicitly freeze their original eight-level configuration.

## Natural and isolated combat measurements

Exact baseline source/config and final code use the same 60Hz combat pilot, seeds 1/17/42/99/2026, adjacent decisions every 200ms with ordinary emergency Grenades. Natural runs begin at Lv1. Isolated starts are ordinary real combat at the requested level and continue normal progression; they are not frozen-level survival tests. Historical Lv9/10 requests clamp to old Lv8, preserving54Hz rather than inventing a historical ten-level plan. Each primary run reaches 180s Survival alive, with zero Survival casualties. Additional 600ms and fixed-lane/no-Grenade pilots avoid claiming that one perfect policy establishes human balance.

All natural level entry times through Lv7 and the +27-second Survival activation are identical to baseline. The new plan changes combat after entering Lv7. Times are absolute simulation seconds:

| Seed | Lv2 / 3 / 4 / 5 / 6 / 7 (unchanged) | Old/new Lv8 | New Lv9 | New Lv10 | Survival activation |
| --- | --- | --- | --- | --- | --- |
| 1 | 10.32 / 30.23 / 47.42 / 83.12 / 94.92 / 110.92 | 131.02 / 131.28 | 155.73 | 173.97 | 121.92 |
| 17 | 12.60 / 27.85 / 44.98 / 83.50 / 94.18 / 108.72 | 128.55 / 130.07 | 153.50 | 172.32 | 121.18 |
| 42 | 10.95 / 28.32 / 46.35 / 83.77 / 95.65 / 110.87 | 126.70 / 132.02 | 156.22 | 174.75 | 122.65 |
| 99 | 10.95 / 26.92 / 45.03 / 82.55 / 94.27 / 107.07 | 118.48 / 124.25 | 153.70 | 166.47 | 121.27 |
| 2026 | 10.33 / 27.88 / 49.07 / 81.63 / 93.43 / 107.62 | 119.12 / 127.35 | 152.78 | 172.37 | 120.43 |

The first natural Survival wave remains activation+1.00s. The same Lv6 release starts Carnival and Destroyer, with no duplicated release, ordinary backlog or enemy clearing. Their duration/ownership and warning/shell timings are unchanged.

A separate 240-second artillery-aware natural run per seed confirms the complete overlap. All five runs survive with zero casualties. Shells remain entrance+8.8/12.0/16.0/17.3/21.0s, Carnival ends at+24s and Destroyer/Survival at+27s. First Giant HP172, depth38, spawn/death and pre-MG crowd peaks match baseline exactly:

| Seed | First Giant spawn / death | Survival duration | Whole-run peak enemies old/new | Old/new projectiles |
| --- | --- | --- | --- | --- |
| 1 | 47.42 / 83.12 | 35.70 | 184 / 184 | 72 / 108 |
| 17 | 44.98 / 83.50 | 38.52 | 178 / 178 | 72 / 108 |
| 42 | 46.35 / 83.77 | 37.42 | 183 / 183 | 72 / 108 |
| 99 | 45.03 / 82.55 | 37.52 | 172 / 172 | 72 / 108 |
| 2026 | 49.07 / 81.63 | 32.57 | 177 / 177 | 72 / 108 |

The 172–184 whole-run peaks occur before Survival and are distinct from its 180-admission soft cap. No new population rule is introduced.

Each table row below is 180s of active Survival; peaks are every tick, mean active/HP/lane populations are one-second samples. Kills include same-tick kills of newly allocated admissions. Raw metrics retain every wave/opportunity/sample.

| Initial scenario | Seed | Old/new peak enemies | Old/new peak projectiles | Old/new kills | New mean active | New longest target gap |
| --- | --- | --- | --- | --- | --- | --- |
| natural | 1 | 61 / 96 | 72 / 108 | 1243 / 1255 | 24.04 | 3.12 |
| natural | 17 | 58 / 87 | 72 / 108 | 1247 / 1248 | 18.55 | 3.52 |
| natural | 42 | 55 / 97 | 72 / 108 | 1256 / 1255 | 21.79 | 3.23 |
| natural | 99 | 62 / 99 | 72 / 108 | 1267 / 1276 | 19.35 | 3.27 |
| natural | 2026 | 63 / 95 | 72 / 108 | 1267 / 1262 | 20.00 | 3.22 |
| lv6 | 1 | 62 / 95 | 72 / 108 | 1201 / 1190 | 28.29 | 3.22 |
| lv6 | 17 | 62 / 122 | 72 / 108 | 1198 / 1190 | 30.62 | 3.40 |
| lv6 | 42 | 59 / 119 | 72 / 108 | 1201 / 1190 | 29.63 | 3.28 |
| lv6 | 99 | 62 / 113 | 72 / 108 | 1200 / 1190 | 30.47 | 3.03 |
| lv6 | 2026 | 62 / 98 | 72 / 108 | 1200 / 1191 | 28.58 | 3.35 |
| lv7 | 1 | 62 / 80 | 72 / 108 | 1213 / 1201 | 22.93 | 3.22 |
| lv7 | 17 | 62 / 81 | 72 / 108 | 1210 / 1200 | 24.60 | 3.40 |
| lv7 | 42 | 59 / 83 | 72 / 108 | 1211 / 1203 | 24.30 | 3.27 |
| lv7 | 99 | 62 / 90 | 72 / 108 | 1212 / 1202 | 25.76 | 3.03 |
| lv7 | 2026 | 62 / 78 | 72 / 108 | 1212 / 1202 | 22.98 | 3.37 |
| lv8 | 1 | 62 / 63 | 72 / 108 | 1274 / 1273 | 20.88 | 3.22 |
| lv8 | 17 | 62 / 59 | 72 / 108 | 1272 / 1272 | 21.29 | 3.42 |
| lv8 | 42 | 57 / 51 | 72 / 108 | 1271 / 1274 | 20.50 | 3.18 |
| lv8 | 99 | 62 / 51 | 72 / 108 | 1272 / 1275 | 20.71 | 3.17 |
| lv8 | 2026 | 62 / 62 | 72 / 108 | 1273 / 1276 | 20.83 | 3.38 |
| lv9 | 1 | 62 / 60 | 72 / 108 | 1274 / 1273 | 18.55 | 3.22 |
| lv9 | 17 | 62 / 52 | 72 / 108 | 1272 / 1272 | 18.14 | 3.42 |
| lv9 | 42 | 57 / 45 | 72 / 108 | 1271 / 1274 | 18.54 | 3.18 |
| lv9 | 99 | 62 / 42 | 72 / 108 | 1272 / 1274 | 18.67 | 3.17 |
| lv9 | 2026 | 62 / 53 | 72 / 108 | 1273 / 1276 | 18.33 | 3.38 |
| lv10 | 1 | 62 / 43 | 72 / 107 | 1274 / 1273 | 17.63 | 3.38 |
| lv10 | 17 | 62 / 43 | 72 / 107 | 1272 / 1272 | 17.46 | 3.40 |
| lv10 | 42 | 57 / 43 | 72 / 107 | 1271 / 1275 | 17.97 | 3.18 |
| lv10 | 99 | 62 / 42 | 72 / 107 | 1272 / 1275 | 18.20 | 3.55 |
| lv10 | 2026 | 62 / 49 | 72 / 107 | 1273 / 1273 | 17.86 | 3.37 |

Natural peaks rise from 55–63 to 87–99 as one MG persists through Lv8; new Lv8 arrives at 124.25–132.02s and Lv10 at 166.47–174.75s. These are progression/loadout consequences, not enemy tuning. At sustained cap, moving-pilot mean active falls from 22.84–23.42 to 17.46–18.20, peak 42–49 vs 57–62, and target gaps lengthen to 3.18–3.55s vs 2.65–2.83s. Kills remain about 7.07/s because existing wave opportunities limit targets. Near-defense populations within 10/20 units are zero with these informed pilots: they clear at distance, which is an optimistic result rather than proof of moderate human difficulty.

The 600ms Lv10 pilot also survives 180s with zero casualties, 42–63 peak enemies and 16.38–18.45 mean active. Holding one lane without Grenades still loses through ordinary contacts:

| Seed | Old/new failure age | Old/new peak enemies | New near10 peak | Casualties |
| --- | --- | --- | --- | --- |
| 1 | 49.62 / 49.62 | 163 / 162 | 67 | 3 |
| 17 | 49.87 / 49.87 | 152 / 151 | 89 | 3 |
| 42 | 50.62 / 50.62 | 165 / 162 | 69 | 3 |
| 99 | 50.03 / 50.03 | 161 / 162 | 63 | 3 |
| 2026 | 50.28 / 50.28 | 163 / 161 | 68 | 3 |

There is no scripted survival or Game Over. The unchanged cap/skip policy bounds neglected-lane buildup, but 81Hz does not defend ignored lanes. Longer single-soldier naval exposure is a balance risk: a real direct shell hit can still be fatal. No artillery was disabled or weakened for the pilots.

## Historical snapshots and lifecycle

No schema/version or serialized state-field change. Old six/eight-level plans keep their cap, stage/count unlocks, original 18Hz MG and embedded Carnival/Destroyer/Survival policy. Actual saved eight-level states replay deterministically; historical sequential encounter fixtures remain accepted. Current validation still rejects excess MG members, malformed XP/stages/clocks and invalid phase ownership.

Changing an unrelated DEV tuning slider now starts from the simulation's embedded balance, preventing an old Lv8 three-MG save from being silently assigned the new one-MG plan. Retry starts the selected review or fresh run, Pause freezes simulation/presentation, and snapshot restoration clears transient events without replaying rewards.

## Browser performance and evidence

Matched headless Chrome/SwiftShader, DPR1, CPU4×, seed17 competent adjacent-lane pilot; exact baseline Lv8/54Hz versus final Lv10/81Hz, 90 real seconds each in three continuous 30s windows. No simultaneous Chrome runs or source changes during sampling. These are desktop emulation measurements, not physical-phone GPU timings.

| Plan | Width | Mean ms | p95 ms | Longest ms | >100 / >200ms | Peak live / pool | Peak draws / triangles | Step / render p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | 350 | 23.79 | 33.4 | 183.30 | 3 / 0 | 72 / 128 | 180 / 202894 | 0.80 / 5.50 |
| baseline | 390 | 23.41 | 33.4 | 266.70 | 5 / 1 | 72 / 128 | 181 / 196814 | 0.60 / 5.90 |
| final | 350 | 22.69 | 33.4 | 183.40 | 7 / 0 | 107 / 128 | 186 / 137828 | 0.60 / 5.50 |
| final | 390 | 22.92 | 33.4 | 166.50 | 5 / 0 | 107 / 128 | 186 / 134488 | 0.70 / 6.30 |

Within-run mean variance: baseline35023.13–24.33ms,39022.88–23.70ms; final35022.32–22.99ms,39022.64–23.22ms. Warm windows contain no frame over100ms in either plan. The baseline390 first window has one266.7ms frame; final maxima183.4/166.5ms. Early first-window frames still include bounded presentation preparation, so this does not claim all mobile first-use work is eliminated. At higher rate the pool remains128 and the renderer retains its two projectile draw batches. Total draws include enemies/environment/effects and fluctuate with cleared crowds; faster killing explains fewer triangles and does not establish81Hz as intrinsically cheaper.

Final geometry counts rise76/77→102 and textures11→12 during existing presentation preparation/opportunities, then stay102/12 from30s through84s; baseline stabilizes100/12. No ongoing resource growth, no gameplay asset requests, three living members and90s simulation progression in both final runs. The final historical-clock compatibility adjustment was made after this benchmark; its ordinary active cooldown path is equivalent and deterministic metrics were rerun. The subsequent Stage I historical-custom-multiplier safeguard also leaves both measured configurations unchanged.

Local evidence (ignored artifacts retained in this checkout): `artifacts/p3b6a/{baseline,final}-browser/results.json`,90s resource samples; `final-browser/350-survival.webm` and `390-survival.webm` contain separate30s audio recordings with decoded-frame PNGs. `loadouts/{350,390}-mg-stages.webm` and level6–10 screenshots verify mobile HUD/composition. These screenshots show the accepted P3 geometry without retuning.



The separate unthrottled five-second Carnival smoke sample reports mean 54.5/56.4ms and p95 83.4/133.4ms at 350/390, with 80 enemies, up to 255k triangles, step p95≤0.5ms and submission p951.9ms. It includes dense first-encounter presentation in software WebGL and is not a matched before/after benchmark. Dense crowd/GPU cost remains a phone-validation risk; no claim of universal60fps is made. The authored Lv6 loadout and encounter schedule in this sample are unchanged.

Three cold/warm pairs per viewport, serial Chrome/DPR2/CPU4×,150ms latency,1.6Mbps down/750Kbps up and the same representative static-cache response policy. Before reuses the accepted P3-B.5 instrumented production build (validated before commit9aa1bcc; canonical f1d843a changes only its report). Its pre-commit version badge differs, so it is an accepted-build startup comparison, not a newly rebuilt exact-SHA bundle. After is a fresh instrumented build of final code. Values are milliseconds; navigation-to-start ranges expose variance.

| Build | Width | Cache | Tap overlay median (range) | First render median | Tap→interactive median | Transfer bytes / requests |
| --- | --- | --- | --- | --- | --- | --- |
| before | 350 | cold | 3662.4 (3584.8–3738.5) | 3907.5 | 78.0 | 481848 / 8 |
| before | 350 | warm | 1829.1 (1764.5–1886.2) | 2024.8 | 66.2 | 0 / 8 |
| before | 390 | cold | 3691.9 (3653.9–3695.2) | 3955.6 | 77.1 | 481848 / 8 |
| before | 390 | warm | 1782.4 (1748.6–1815.8) | 1982.7 | 72.8 | 0 / 8 |
| after | 350 | cold | 3679.8 (3652.7–3692.9) | 3929.4 | 67.8 | 481964 / 8 |
| after | 350 | warm | 1901.7 (1894.5–1985.9) | 2138.3 | 68.7 | 0 / 8 |
| after | 390 | cold | 3675.8 (3674.6–3694.2) | 3932.9 | 22.2 | 481964 / 8 |
| after | 390 | warm | 1892.9 (1859.9–1933.8) | 2083.4 | 69.9 | 0 / 8 |

Both sets have zero blank Observer frames; final speech starts once at offset zero with the portrait decoded in all 12 runs. Warm resource transfers are zero with eight cached entries. Cold payload changes by 116 bytes (configuration/JS); content-hashed art/model/audio URLs remain unchanged. Cold medians stay close; warm overlay medians increase modestly in these sequential batches, so a small warm-start change is reported rather than hidden or attributed conclusively to gameplay code. No new startup resource or shader path was added. Local results/screenshots: `artifacts/p3b6a/{before,after}-startup/`.

## Validation

- `npm test`: 153 files / 1,137 tests passed (full suite).
- `npm run typecheck`: passed.
- `npm run build`: passed; existing >500kB chunk warning remains.
- Exact per-stage shots, overflow/release, all-MG-stage same-tick casualties, live threshold/rate edits, old save replay, frozen fixture goldens and DEV tuning compatibility covered.
- Five-seed 240s natural encounter runs plus 40 combat runs per version (30 primary + five slower + five fixed-lane).
- Browser loadout/HUD/history checks at 350/390, actual shipping natural Lv1–10 plus Legacy/Pause/Retry/restore, production content-addressed asset/DEV exclusion checks passed.

- `carnival-sanity`: both widths, exact release60, concurrent boundary ownership, natural progression, readable warning/HUD, Pause/snapshot replay/Retry passed.
- `projectile-finalization`: normal DEV and actual shipping P3 at both widths, stable Level Up appearance, exact four-control menu and no selector passed.
- `p28-browser`: both widths × CRATE3/CRATE8/test-only CRATE10/Grenade/Giant scenarios passed; staged supply, throws, HP/damage, snapshots, Pause/Retry, audio recordings.
- `supply-fixtures-sanity`: both widths, simulated 34px safe area, every transfer arrival, cues, Pause, partial snapshots and Retry passed.
- `p3b-browser`: NAVAL at 350/390/1100, all shell boundaries/targets/effects, Observer, Pause/replay/Retry passed.
- `runtime-readiness`: both widths, missing-portrait Mission Intro/Destroyer fallback with voice offset zero, resize/safe-area reward endpoint, aircraft equivalence and WebGL context/disposal passed.
- Sustained CPU4×81Hz: both 90s runs and separate recorded lifecycle checks passed.
- QA evidence is under `artifacts/p3b6a/{loadouts,production,modes,carnival,projectile,grenade,supply,naval,readiness,final-browser}`.

All profiling exposure, test fixtures, timing/recording code live in test/QA files; no production debug endpoint or per-frame instrumentation is introduced. The human DEV menu remains exactly four entries. Earlier QA-only attempts were rerun after migrating old threshold assertions, waiting out the established HUD label animation, and isolating dependency/file-watcher caches. Failed attempts are not counted as passing measurements.

## Remaining balance/device risks

Rates and thresholds are provisional. Lv7/Lv8 now have fewer living members and less total firepower than the previous 36/54Hz unlocks, increasing crowd pressure and the cost of a single naval hit. Lv10 has 50% more full-squad firepower than old Lv8, reducing sustained clearing pressure. Human phone input, target awareness, graphics drivers and thermal behavior are not reproduced by the automated pilots or desktop SwiftShader. Existing dense/cap-full crowd performance risk remains; no visual quality was reduced and no unrelated renderer work was added. Physical-phone playtesting should decide the next tuning task; this implementation stops here.

## P3-B.6A supplement — Mobile MG Quick Test

Supplement implementation: 2f46d89eaf3260de6b5264a7a4338f8b3705b178. Starting HEAD: bac9a94e4c2b2107a8bb86d31a6a2ce15d253c65. The user requested this temporary human-review tool after the original delivery.

DEV → **MG TEST** expands a separate section beneath the unchanged main LATE / CRATE3 / CRATE8 / NAVAL buttons. Five buttons (MG6–MG10) use the authored level, weapon stage and living squad, highlight the selected preset, close DEV after selection, and preserve it through the existing Retry handler. The section starts collapsed and reuses the existing panel scrolling/safe-area layout. No keyboard shortcuts or production controls were added.

All five start from seed **0x21b600**, center lane and the exact same finite crowd: **60 Grunts + five Heavies** distributed across five lanes at depths 38–46. Existing HP/movement, real simulation firing, selected-lane targeting, damage, XP and ordinary contact casualties apply. There are no fake bullets, invulnerable targets or scripted kills. Teaching encounters are consumed, and recurring Carnival/Destroyer/Survival/admissions are disabled only in these isolated comparison fixtures. Existing human entries and older automated Survival fixtures retain their behavior. All authored production configuration is unchanged by this supplement.

Measured ten-second steady firing after a one-second warm-up, both unit tests and real browser simulation:

| Preset | Stage / squad | Per-member shots | Total shots | Total Hz |
| --- | --- | --- | --- | --- |
| MG6 | I / 1 | 180 | 180 | 18 |
| MG7 | II / 1 | 225 | 225 | 22.5 |
| MG8 | III / 1 | 270 | 270 | 27 |
| MG9 | III / 2 | 270 each | 540 | 54 |
| MG10 | III / 3 | 270 each | 810 | 81 |

Validation: full **154-file / 1,144-test** suite passed, typecheck and production build passed (same existing bundle-size warning). New tests verify identical seed/RNG/enemy placement across presets, real damage/targeting, snapshot continuation, exact rates, factory resets and no mutation of authored data. All original regression tests remain intact.

The actual touch UI passed at **350×844 and 390×844**, including a simulated 34px bottom inset at 350. Buttons are approximately **76.7×48 CSS pixels**, fully inside the viewport; collapse/expand and panel closure work. Every preset was allowed to reach **ordinary contact Game Over**, then the actual Retry button restored its exact initial simulation state. Selecting main LATE clears MG selection and restores its existing 42-enemy Survival group. No page errors. Native screenshots and decoded recording frames were visually inspected.

Production QA passed on the actual shipping build at both mobile sizes, rejecting MG TEST UI and factory strings; existing `/topwar/` content-hashed assets, normal startup/Observer and main DEV exclusion checks remain valid. No rendering, audio or natural simulation code changed, and no new production resource/preparation path was introduced. The original sustained 81Hz and startup measurements above remain the performance evidence for the unchanged production gameplay; they were not rerun solely for this DEV-only supplement. Browser emulation remains distinct from physical-phone verification.

Local evidence: `artifacts/p3b6a/mg-quick-test/results.json`, `{350,390}-{collapsed,expanded}.png`, per-preset screenshots, `{350,390}-mg-test.webm` and decoded-frame PNGs. Production results are under `artifacts/p3b6a/mgquick-production/`; gate logs are `artifacts/p3b6a-mgquick-{tests,typecheck,build,browser,production}.log`.

No deployment, tag modification, Survival tuning or P3-C work. This closes the additional P3-B.6A request.
