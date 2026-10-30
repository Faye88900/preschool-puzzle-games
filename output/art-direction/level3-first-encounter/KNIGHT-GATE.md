# 小骑士岗哨与战后开门

## Implemented
- Add a spare leaf shield on the existing curved bench and paired patrol scuffs on the paving.
- Add a half-height, two-leaf sage/brass gate under the existing first-encounter arch. Closed collider spans the 5m corridor and blocks walking/jumping; wind targeting and knight pathing also respect the closed gate.
- First knight retains one-hit tutorial health. After its 1.25s defeat animation, the seal releases, gate swings open, keystone leaf lights up and six leaves guide the player onward.
- Opening takes 1.3s, or .4s with reduced motion; reduced motion disables leaf lift. Collision releases after the gate is fully open.
- Opening uses fixed simulation progress, so the existing pause/dialogue handling freezes it. Recovery preserves progress and defeat; restart restores closed gate, original emblem and no victory trail.
- The bridge remains available for retreat. Final guardian, golden key and final exit remain separate.
- Reuse existing Three.js batching, Rapier bodies, audio cues and localized prompt system. No new dependency, texture, light or downloaded asset.

## Verification
- `npm run build`: PASS (existing large-chunk advisory).
- `tests/first-encounter-ruins.mjs`: PASS. Actual keyboard/touch input and Rapier steps; setup teleports and frozen render loop.
- Gate blocks walking/jumping, wind sight and knight pathing; death-animation delay, gradual opening, open collision, recovery and restart assertions pass.
- Existing bridge entry and onward arch traversal, bench/column collisions, mobile controls and no browser errors pass.
- Zero hedge-embedded vertices in ruins, gate and guard traces.
- Geometry: 48 merged meshes / 69,682 triangles, below focused limits 52 / 80,000. Physics: 156 bodies, stable across restart.
- Closed-gate desktop: 334 draw calls; portrait: 261. Existing scene exceeds advisory mobile draw budgets; these checks do not establish real-device frame rate.
- Captures: `test-results/first-encounter-ruins/user-view-after.png`, `knight-cleared.png`, `mobile-victory.png`, `bench-mobile-after.png`.
- `tests/maze-browser.mjs`: PASS with the normal render loop, including gardener/tool/planting, bridge, first knight and gate, pause during opening, chest, final guardian/key, recovery, final exit, reset and portrait dialogue/pause. Teleports position the player for each section; actions and animation run normally.
- Node syntax and changed-source whitespace checks: PASS. One earlier full run was interrupted by a source-save/Vite reload; the clean rerun passed.
- Unmodified `dist` preview at port4206: PASS for start, keyboard input, desktop/portrait rendering and touch pause/resume, with no page/console/HTTP errors. Production smoke captures are at spawn; encounter behavior was verified in the dev browser tests above.

Local verification only. No ZIP, hosted deployment or physical-device performance claim.
