# Botanical treasure models and explicit pickup

2026-10-27. Runtime meshes are authored in Three.js from the approved chest/crystal three-view concepts. No external model, dependency or new light is used. The prior implementation is preserved under before/ and the previous model exports remain in ../treasure/.

## Player flow

Collection animation update: manual pickup now flies the crystal toward the character and shrinks it over 0.7 seconds before awarding ownership. See ../treasure-animation/README.md and open-to-pickup.webm. Reduced motion retains immediate collection.

Update 2026-10-27: a retryable three-choice sail question now precedes opening. Only Wind opens the chest. See ../chest-quiz/README.md for current question UI and verification; the reveal/pickup flow below still applies after the answer.

Approach -> open chest -> lid swings and crystal rises for 1.2 seconds -> choose Pick up crystal -> crystal and reward ring disappear, health restores and inventory confirms ownership -> boat becomes available. The chest remains open and empty. The mounted boat crystal is a separate installed representation of the acquired power source.

E/F and the existing action button open/collect; clicking or tapping the actual visible 3D crystal also collects while in the same 2.7-unit interaction radius. Early, repeated, distant, paused or dialogue-time input cannot collect it. Opening alone grants neither the item nor healing. Leaving an uncollected chest does not destroy its reward. Restart closes the chest and clears ownership; recovery retains it through the existing game rules. Reduced motion uses an instant reveal followed by explicit pickup.

## Models and budget

- treasure-chest.glb: standalone closed box with Open/Close hinge animation clips. The runtime chest assembly includes the reward/glow and totals 16 material batches / 27,288 triangles; bounds approximately 2.59 x 2.12 x 1.94 including the hidden reward geometry.
- sail-crystal.glb: four batches / 1,308 triangles; approximately 1.25 x 1.76 x 0.53. Faceted semi-transparent shell, enclosed dark teal core, curved gold leaf mount, single rear crescent.
- Models use +Y up. Chest front is -Z; both origins are at the lower tip/feet. The crystal shape is genuinely narrower in side view. Surfaces use shared geometry/material batches; wood grain is a small local CanvasTexture.
- PNGs are actual rendered models, including front/side/back views; game-* captures show normal game cameras. metrics.json contains finite geometry, nonblank canvas colors and renderer diagnostics.
- Focused open desktop: 174 calls / 151,482 triangles; portrait: 103 / 128,048. No physical-device FPS claim. The new boat crystal adds 392 triangles over the previous model; the existing garden component test budget increases from 100,000 to 101,000 to account for it.

## Reference and scope

The approved visual references are in ../../concepts/treasure-crystal-2026-10-27/. Interaction research: Zelda's staged chest reveal (https://zeldadungeon.net/wiki/Opening_a_Treasure_Chest), and Genshin Impact's explicit Pick Up/Interact action (https://genshin-impact.fandom.com/wiki/Controls). These are design principles; no copied UI, animation, audio or model is imported.

Changed runtime reach: model factories and shared botanical details; MazeAdventure state, objective, input, reset, fixed-step timing and render; three-language pickup guidance. Boat ownership still uses the existing treasure flag. No level topology, collider, combat, save format or production debug API changes.

## Verification and reproduction

Final result: PASS build, focused model/pickup test, boat crossing, wind garden map/traversal, full maze browser regression, production preview with real tick, and git diff --check. Focused, garden and production runs captured no page/console/HTTP errors. Build retains the existing large-chunk warning. Standalone exports are 1,984,008 bytes for the chest and 104,548 bytes for the crystal. Production ready/collected screenshots and result.json are in production/.

With existing Playwright and a local Vite server:

```
node tests/treasure-models.mjs
node tests/boat-crossing.mjs
node tests/wind-garden-map.mjs
node tests/maze-browser.mjs
npm run build
node tests/treasure-production.mjs
```

Set TEST_URL for dev or production preview. The focused test injects a test-only instance reference and stops tick, then advances the actual 1/120-second game step. The production test only exposes the instance, preserving the real tick/render loop. No test hooks are added to the shipped source. GLB exports reload successfully and retain their material geometry and animation clips. Keyboard open, rising reward, explicit pickup, direct 3D click, touch pickup, disappearance across subsequent renders, distance/boat gating, pause, reset and reduced motion are asserted. Screenshots cover 1280x800, 1024x768, 390x844 and 844x390. Controlled state captures are appropriate here; a new image-difference baseline system is not added.

## Skill reference ledger

Read: threejs-gameplay-systems SKILL, references/gameplay-workflows.md and game-feel.md; threejs-aaa-graphics-builder SKILL, references/model-recipes.md, render-recipes.md, technical-art.md and checklists/procedural-model-quality.md and performance-safe-visual-detail.md; threejs-qa-release SKILL, references/qa-release-checklists.md and checklists/visual-verification.md; ponytail instructions remain active. Asset strategy is hybrid approved generated concepts + original controllable Three.js geometry, as the user requested Three.js implementation. No new generated external 3D asset is needed to control the hinge/reward separately. No premium/AAA or release claim is made.

Deployment, ZIP delivery and physical-device testing are outside this pass.
