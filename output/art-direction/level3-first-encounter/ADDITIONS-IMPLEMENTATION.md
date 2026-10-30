# 古花园遗迹：断柱、弧形石凳与远景残亭

Approved concept: garden-ruins-additions-v1.png. This is a scoped scene implementation, not a whole-game graphics rewrite.

## Implementation
- src/first-encounter-ruins.ts: add ruins-columns, ruins-bench and ruins-pavilion using the existing stone/leaf palette and static material batching.
- Two chipped octagonal columns near practice +(-2.4,-6.0) and +(10.6,-4.2), ~2.3/3.8m high.
- Crescent bench lies in local x[-6.981,-3.867], z[-6.381,-3.267], with rounded segmented seat, low back and supports. It remains in the left corner.
- Pavilion center world(48.8,11.5), bounds x[45.68,51.92], z[8.38,14.62], top7.205m. Broken colonnade/beam and a partly missing sage roof with ivy sit on existing lawn outside all walkable cells.
- Existing actual-bounds hedge clearances also cover new props. Hedge cutting now applies to intersecting hedge runs beyond the first courtyard for the distant pavilion.
- src/maze.ts: integrate10 fixed collision boxes (2 per column,6 around bench), extend the existing knightClear clearance to these obstacles, and use existing occlusion fading for tall columns/pavilion. Portrait camera reduces rightward exit bias when approaching the left bench.
- Map cells, spot positions, ground, bridge locks, other quests, knight health/damage, lighting, UI and audio unchanged. No new dependencies or textures.

## Source and technical budget
Built-in imagegen concept -> authored Three.js geometry in the existing factory. No imported runtime model download or missing-key claim.
Existing director/graphics/QA workflow and previously loaded references apply; graphics model work was delegated, parent owns integration and QA.
New scene additions +14 static mesh batches/+11620 triangles.
Total ruins factory36 meshes/59468 triangles; target<=40mesh/80000triangles. Base13 shared materials; live copies for camera occlusion bring measured instances to28. No new textures/lights/postprocessing. Existing DPR1.5/shadows retained.
Existing advisory mobile draw budgets were already exceeded; focused portrait now254calls/202154triangles vs prior240calls/189934triangles. No real-device FPS claim.

## Focused verification: PASS
tests/first-encounter-ruins.mjs runs on local dev5206 with test-only intercepted initialization/frozen render loop and setup teleports; actual input and fixed-step physics drive actions.
- Finite geometry, budgets and .044m maximum floor height.
- Real hedge-surface ray checks: zero embedded vertices for arch/walls/planters/paving/columns/bench/pavilion.
- Pavilion sampled bounds outside every walkable cell and within island x52.5.
- Column physically stops keyboard-driven player at x44.375. Bench has real physics ray contact.
- Chasing knight travels2.462m with zero penetration into new proxy volumes.
- Bridge entry, arch passage, jump boundary, first wind hit/death, mobile touch wind, pointer joystick/release, pause/resume and reset pass.155 bodies remain constant after reset.
- Desktop1280x800, portrait390x844, landscape844x390, user-wide1906x921, bridge approach and bench-mobile captures.
- Full bench fits portrait camera on approach; path/player/knight stay readable.
- Browser page/console error/HTTP error lists empty.
- npm run build:PASS; existing large-chunk advisory unchanged.
- git diff --check and node --check:PASS; CRLF normalization advisories only.
- maze-map.ts and maze-ground.ts hashes unchanged.

Structured report: test-results/first-encounter-ruins/report.json.
Actual scene: test-results/first-encounter-ruins/user-view-after.png.
Bench portrait: test-results/first-encounter-ruins/bench-mobile-after.png.

## Remaining checks and scope
tests/maze-browser.mjs:PASS on dev5206. Existing scripted regression with setup teleports covers movement, progression gates, NPC, cart/tool/planting quest, bridge, chest, shield, guardian, key, recovery, exit/win, reset, mobile dialogue and pause. It runs the real update loop. Reported final broad garden view411calls/442976triangles is a different view from the focused encounter captures.
No ZIP, deployment, commit/push, physical-device or hosted verification. No sitting interaction or new quest is added.
Production smoke:PASS at http://127.0.0.1:4206/?level=3&lang=zh. Unmodified dist starts, accepts keyboard input, renders desktop/mobile and supports touch pause/resume with zero page/console error/HTTP errors. Captures are at spawn, not a production-build encounter playthrough; focused scenery/collision evidence comes from the dev browser check. See test-results/first-encounter-ruins/production-report.json.
Focused visual harness extended; no new baseline framework or general bot.

