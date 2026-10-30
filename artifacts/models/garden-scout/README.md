# Garden scout: Sprout

The chest-side scout shares the existing player's round body and curved face, with a cream/mint palette, leaf hood, cape, sprout tips and wooden pinwheel staff. `src/garden-scout.ts` reuses `src/character.ts` and the existing treasure leaf geometry. No external asset, generator, dependency, light or physics body was added. The runtime uses the procedural model; the GLB here is an inspection export. The transparent dialogue portrait is rendered from the actual model by `tests/garden-scout-model.mjs`.

Model: 24 meshes, 13,764 triangles, unscaled bounds 1.626 × 1.680 × 1.126. Scene scale 0.9; foot contact y=0 at root y=0.612. Breathing and pinwheel motion, a greeting pose and near-player facing use the existing game clock. Pause holds the pose; reduced motion makes idle motion static.

The existing dialogue runner chooses a clue for closed chest, available crystal, pickup, dock, uncollected key, key acquired and open exit, without revealing the quiz answer. The nearby hint button uses the same clue. Talk-to-heal behavior is retained. Chinese, English and Malay strings are provided.

Validation: finite geometry, GLB roundtrip, pose/reduced motion; keyboard interaction, portrait loading, seven clue states, healing without quest rewards, nearby hint, pause/reset; desktop 1280×800, portrait 390×844 and landscape 844×390 browser layouts. `tests/garden-scout.mjs` covers source and built preview and checks the gardener/player portrait branches. Captures and JSON results are in `scene/` and `production/`. `npm run build` passes with the existing chunk-size warning. Chest quiz and reward animation have separate regressions.

The tests place the player on the path beside the scout. They do not constitute a full level playthrough, physical-device benchmark or hosted deployment check. No delivery ZIP was produced.
