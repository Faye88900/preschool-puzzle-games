# Treasure chest and sail crystal

Original local Three.js models, 2026-10-22. No external meshes, textures or new dependency.

- `treasure-chest.glb`: independent chest model, Open and Close lid animation clips; 852,680 bytes.
- `sail-crystal.glb`: independent crystal model; 75,632 bytes, 916 triangles, three material batches.
- `models-closed.png` and `models-open.png`: actual rendered model views.
- `game-*.png`: actual Level-3 game-camera captures.
- `metrics.json`: geometry, render calls, triangles, nonblank canvas sampling and browser errors.

Runtime uses `src/treasure-chest.ts` and `src/sail-crystal.ts` directly. The GLBs are standalone exports, not additional runtime downloads. The decorated chest alone has 11 batches; the reward crystal and ring bring its total to 15 and 12,704 triangles. The closed instance measures approximately 1.94 x 1.58 x 1.52 including the hidden reward geometry. Crystal bounds are approximately 1.05 x 1.44 x 0.73. Models use +Y up; the chest front faces -Z and origin sits at ground level.

## Scope and behavior

Player promise: recognize a special treasure and see the sail crystal when opening it. Core interaction remains approach -> E/touch interaction -> reward and full health -> dock. The chest stays at its existing spot; routes, colliders, combat, rewards and controls retain their existing behavior. New presentation opens the lid to 1.65 radians and raises the crystal from 0.45 to 1.5 world units with a gentle rotation/bob. Pause freezes it; reset closes it and removes rewards; reduced motion uses an immediate reveal and static crystal. The boat mast uses a 0.4-scale copy of the same crystal.

## Verification

Passed: `npm run build`, `tests/treasure-models.mjs`, `tests/boat-crossing.mjs`, `tests/maze-browser.mjs`, and `git diff --check`. The focused test captured no page, console or HTTP errors. Build retains the existing large-chunk warning. Main-flow regression covers movement, progression gates, gardener/tool/bridge, knight, chest, guardian/key, recovery, exit/win, reset, mobile dialogue and pause. Boat regression covers crystal prerequisite, boarding/sailing/landing, pause, early return, guardian/key, touch return, reset and reduced motion. These are local development/browser checks; the built `dist` was regenerated but not separately browser-tested.

Run with a local Vite server and existing Playwright installation:

```powershell
$env:TEST_URL='http://127.0.0.1:5212/'
node tests/treasure-models.mjs
node tests/boat-crossing.mjs
node tests/maze-browser.mjs
npm run build
```

The focused model test exports both GLBs, reloads them, checks finite geometry and animation clips, opens with actual keyboard and touch input, verifies partial-open pause, reset, reduced motion, mast model and the unchanged interaction radius. Viewports: 1280x800, 1024x768, 390x844, 844x390. It captures browser page/console/HTTP errors and samples canvas colors. Test-only interception exposes the instance and stops its automatic tick; explicit calls drive the normal render path. Boat and main-flow tests use their existing harnesses. Focused captures are deterministic state snapshots, not a physical-device performance benchmark or an image-difference baseline suite.

Measured focused views: closed desktop 168 calls / 135,854 triangles; open desktop 174 / 137,686; open portrait 100 / 113,336. No before-state performance comparison is claimed. Geometry factories reuse material batches. No new lights, textures, postprocessing or physics bodies.

## Skill reference ledger

All references below were read; no required reference failed to load.

- `threejs-gameplay-systems`: `references/gameplay-workflows.md`, `references/game-feel.md`.
- `threejs-qa-release`: `references/qa-release-checklists.md`, `references/checklists/visual-verification.md`.
- Procedural model checks: `threejs-aaa-graphics-builder/references/checklists/procedural-model-quality.md`, `material-lighting-quality.md`, `performance-safe-visual-detail.md`.
- `ponytail`: preserve existing callers and progression; reuse Three.js and current geometry batching; one focused functional/geometry test.

Broad level redesign, new quest/puzzle rules, audio, deployment, delivery ZIP changes and physical-device tests are outside this pass.
