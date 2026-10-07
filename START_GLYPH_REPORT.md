# Start-derived input presentation and control glyphs

Starting HEAD and fetched origin/main matched `8ea4555b6cb684c1567f02f939de54f34415f424`; worktree was clean. No deployment. Gameplay/configuration, three-Grenade balance, primary HUD, XP/LV, DEV menu, Pause and audio activation behavior are unchanged.

## Session classification

`GameApp` initializes viewport `data-input-presentation="touch"`. The existing first `beginGameplay` call sets this presentation value synchronously, before awaiting the existing optional audio activation or dismissing Start:

| Initial Start origin | Presentation |
| --- | --- |
| pointerdown with `pointerType === 'mouse'` | desktop |
| non-repeated Enter or Space keydown | desktop |
| touch / pen pointerdown | touch |
| empty, missing or unknown pointer type | touch |
| click / assistive activation without an originating handled pointer or key | touch |

The existing awaiting-start guard prevents a competing event during activation from replacing the first selection. Started sessions never reclassify. Normal Retry, review-fixture Retry and Pause preserve the viewport attribute. All supported gameplay controls work in either mode; it is neither gameplay state nor a device detector. No user-agent or pointer/hover capability check determines hint visibility. Audio activation, generation/cancellation guards, compatibility-click consumption and failure handling remain the existing path.

## Artwork and CSS

- Movement keeps the same **64×60px** targets (**56×60 at ≤370px**), physical surfaces, disabled and held feedback. Artwork is now a broad filled arrow in a centered **50×50px SVG**, clamped to available width. Explicit zero button padding avoids native padding shrinking the art. No input hit-area change.
- `.combat-keycue` is shared by A/D/Q: compact heavy HUD font, subdued dark color at **.55 opacity**, absolute overlay and pointer-transparent. A/D are **13px**, positioned over the arrow shafts; Q is **12px**, lower within the Grenade silhouette. The existing warm Grenade icon and distinct charge badge remain dominant.
- Removed keycap borders, background, corner placement, padding/minimum-size reservations and the fine-pointer/hover visibility media rule. Only `[data-input-presentation="desktop"]` reveals the glyphs. Touch/default uses `display:none`, with no empty reserved space. Other capability rules retain their unrelated layout/native-input responsibilities.
- `GAME_SPEC.md`, `SUNLIT_COASTAL_ART.md` and QA instructions now describe Start-derived hints. The previous release report identifies its capability-keycap screenshots as historical; its three-Grenade measurements remain applicable.

## Validation

- **806 tests / 127 files passed**; typecheck and production build passed. Build: **240 modules**, **21.19kB CSS / 1,057.14kB JS** before gzip (**5.32 / 288.24kB**). Existing dependency annotation/bundle-size warnings remain.
- Eight added unit cases verify default touch, mouse/Enter/Space/touch/pen/empty/unknown/click selection before audio resolves, a single activation despite competing gestures, and persistence through Pause/Retry/later input.
- `start-presentation-sanity.mjs` passed ten browser cases: desktop mouse at **1100×844**, touch at **390×844 / 350×844**, mouse on coarse, Enter/Space on coarse, pen, empty/unknown pointer, and ambiguous click on desktop/fine pointer. Pen/unknown events are synthetic complete gestures; mouse/touch/keyboard cases use browser input. Every case checks default, immediate attribute selection, cue visibility, transparent/unbordered glyphs, large centered arrows, later A/D/Q functionality, later touch movement where available, Pause, normal and fixture Retry. No page/console errors.
- `release-hud-sanity.mjs` passed desktop and both portrait widths with actual mouse/touch Start, **3→2→1→0** via Q/button, one-flight guard, reserve-flight snapshot, invalid-target preservation, Pause/Retry and four DEV review actions. Representative sequential throws remain **23/23, 12/21, 6/15 kills/XP**.
- `bottom-strip-sanity.mjs` passed both widths: real touch holds, **immediate /180ms delay /120ms repeat**, pointer release/cancel, lost capture, blur, Pause/death/Retry cleanup, context/selection/drag default prevention, callout protections, no hidden steering, XP accuracy and reduced-motion behavior. Input code/timing is untouched.
- `audio-start-sanity.mjs` passed frozen pre-start and native audio activation through real touch/mouse/Enter/Space, narrow touch, Pause/Retry and post-start review access. No new activation path.
- `production-sanity.mjs` passed six default/normal-review/threat-review combinations at 390/350. Actual touch Start selects touch with no visible keyboard glyphs; DEV menu/factories/4/5/6 remain excluded from production. No browser errors.

## Captures and human review

Ignored local evidence:

- `artifacts/start-glyph/mouse-desktop.png`
- `artifacts/start-glyph/touch-390.png`
- `artifacts/start-glyph/touch-350.png`
- `artifacts/start-glyph/{mouse-coarse,enter-coarse,space-coarse,pen,unknown,empty,ambiguous-click}.png`
- `artifacts/start-glyph/start-presentation.json`
- `artifacts/start-glyph/charges/charge-{3,2,1,0}-{390,350,1100}.png`
- `artifacts/start-glyph/{movement,production,audio}/` regression captures/JSON

Inspected desktop and both touch portraits: arrows dominate A/D; Q is subordinate to the Grenade silhouette and inventory; touch has no letters, clipping or leftover badge space. Bottom layout, XP/LV, compact passive weapon telemetry and battlefield clearance remain intact. Chrome touch emulation and synthetic pen/assistive cases do not certify physical iOS/Safari/native-pen behavior. Thumb comfort, bright-light contrast and local font fallback still warrant physical-device review.
