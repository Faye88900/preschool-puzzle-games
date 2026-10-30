# First encounter ruins: local verification

Approved concept: output/art-direction/level3-first-encounter/garden-ruins-v2.png.
Actual result: test-results/first-encounter-ruins/desktop-after.png, mobile-after.png, landscape-after.png, bridge-approach-after.png, through-arch.png.

## Changes
- src/first-encounter-ruins.ts: ivory stone arch, leaf keystone and shield crest, ochre leaf banner, fitted irregular flagstones, leaf medallion, ruined wall fragments, urns, peach flowers and pointed ivy.
- src/maze.ts: place at existing practice encounter; align open arch with original onward corridor; lower only local visual hedge backing and split visual runs where needed while preserving solid blocked coverage; fade arch with existing building occlusion; move one old bush to the edge; pan portrait camera locally so the arch and player fit.
- tests/first-encounter-ruins.mjs: deterministic focused visual/geometry/input regression, no production test hooks.
- dist rebuilt from existing package scripts.
- maze-map.ts and maze-ground.ts remain byte-identical to the pre-edit copies. Knight mechanics, homes, HP, shield states, progression locks, lighting and audio remain unchanged.
- Border run subdivision uses 145 total physics bodies in this current checkout; reset preserves that count. Fixed collider coverage is retained even though renderer runs were subdivided.

## Focused browser result: PASS
Local dev URL http://127.0.0.1:5206/?level=3&lang=zh.
Tests freeze requestAnimationFrame via a test-only intercepted module. Setup teleports place the player near the encounter; actual keyboard/touch/pointer events and existing fixed-step physics drive the tested actions.
- Geometry finite; clear arch rays at player/knight heights and across capsule clearance; paving top 0.044m.
- Keyboard bridge entry and northbound arch traversal; player reaches x40,z20.19.
- Jumping at west/north blocked edges preserves the boundary.
- First knight still one wind hit, death animation completes; mobile wind input works.
- Pointer-driven mobile joystick moves player and releases input; touch pause/resume and reset pass.
- Desktop1280x800, mobile390x844, short-landscape844x390 and bridge approach before/after captures show changed nonblank canvas.
- Browser page, console and HTTP error list is empty.

## Geometry and render budget
New scene 22 meshes, 47,848 triangles, 17 material instances after arch occlusion material copies, no added textures/lights/postprocessing.
Same-runtime visible/hidden comparison, with normal/low local hedge visuals restored per capture, is used below. This is not an old-build memory or real-hardware performance comparison.
| View | Hidden calls | Visible calls | Visible triangles |
| --- | ---: | ---: | ---: |
| Desktop | 288 | 310 | 240094 |
| Mobile portrait | 218 | 240 | 187534 |
| Short landscape | 317 | 339 | 309986 |
| Bridge approach | 304 | 326 | 299170 |

Added 22 calls in these captures; geometry stays under the planned55k new-triangle budget. Current whole-scene calls exceed the skill's advisory300 desktop/150 mobile starting budgets, including the pre-existing scene; short landscape also slightly exceeds the300k mobile triangle starting budget. No physical-phone frame-time claim is made. Existing DPR cap1.5, one2048 shadow map and no postprocessing are retained.

## Other checks
- npm run build: PASS, existing >900kB bundle-size advisory remains.
- git diff --check: PASS, CRLF normalization advisories only.
- tests/maze-browser.mjs: PASS on dev build. Existing full regression covers movement, progression gates, NPC, cart/tool/planting quest, bridge, chest, shield, guardian, key, recovery, exit/win, reset, mobile dialogue and pause. Uses setup teleports as the existing script does. Reported final broad view411calls/442976triangles; this is a different garden view, not the focused encounter above.
- Unmodified production smoke: PASS at http://127.0.0.1:4206/?level=3&lang=zh. Starts the built game, exercises keyboard input and touch pause/resume, captures desktop/mobile at spawn, and has zero page/console/HTTP errors. No module interception in this smoke. See test-results/first-encounter-ruins/production-report.json.
- Production smoke does not constitute a production-build playthrough of the first encounter; focused encounter geometry/action evidence is from the dev browser test.

## Reproduce
Run npm run build; run a Vite dev server on port5206; run tests/first-encounter-ruins.mjs and tests/maze-browser.mjs sequentially. Set PLAYWRIGHT_MODULE and SHARP_MODULE to the bundled runtime ESM entrypoints when not installed locally. For production smoke, run Vite preview on4206 and test-results/first-encounter-ruins/production-smoke.mjs.

## Scope / skipped
No new dependencies, generated runtime texture/model downloads, lighting/audio changes, ZIP, commit, push or deployment. Existing ZIP remains untouched.
No physical-device performance, browser matrix or hosted verification.
Visual harness: focused deterministic scene captures and pixel-difference checks added; no new baseline framework. Bot testing: actual input/physics focused actions plus existing level flow regression, no new general bot.
Skill phases: graphics delegated to a focused scene worker under loaded graphics references; parent owns topology integration and QA. Gameplay systems/UI/audio broad upgrades skipped because not part of this scene change.
Reference and source ledger: see IMPLEMENTATION.md. Imagegen concept -> authored geometry; no new external generator call or missing-key claim.

