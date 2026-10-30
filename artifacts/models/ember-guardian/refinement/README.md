# Model refinement against concept 04

User requirements: the first model lacked detail and differed from the concept, especially persistent sword fire and the side-facing arm crest.

This revision:

- Places the diamond crest on the outward-facing left shoulder/upper-arm plate. The model test checks its world-space facing direction.
- Replaces the flat front chest panel with a compound curved breastplate and overlapping waist lames; adds gauntlet knuckles, vambrace bands, shaped shin plates, boot lames, blade fissure branches, wrapped grip and mantle clasp.
- Rebuilds the low leaf-shaped helmet ridge and adds tessellated cloth folds, irregular torn hem, holes and darker scorched cloth shading.
- Adds persistent orange flame tongues using the free CC0 Kenney texture, independent of the existing on-swing Ember weapon trail. Details and hash are retained at `public/textures/ember-guardian/SOURCES.md`.

Runtime remains driven by the source factories. This folder's GLB is a reference export of the rigid model only. Shader fire is intentionally omitted from the GLB and reconstructed by `guardian-flames.ts` in the actual game. Model screenshots include it.

## Asset sourcing and technical frame

Hybrid path: approved built-in ImageGen concept `artifacts/concepts/final-boss/ember-guardian-slim-04.png` → controlled revision of the existing named rigid assemblies → imported CC0 flame mask → native Three.js runtime fire. Existing arm/sword pivots and attack logic remain in use; no paid model-generation job or whole-character rig replacement was introduced for this correction. The Tripo credential probe returned `TRIPO_API_KEY=SET`; lack of credentials was not used as a reason to skip it.

The pass uses existing charcoal steel, silver trim, burgundy cloth, amber eyes and local daylight. Target model budget remains below 65,000 triangles and 70 meshes; fire adds one texture and one draw call. Scene lighting, island size, combat timing and collision rules remain unchanged. Physical-device performance is not inferred from the desktop browser checks.

## Checks

`tests/ember-guardian-model.mjs` measures finite geometry, visible-model proportions, crest direction, rendered fire pixels and pixel changes, reduced-motion stillness, named poses and static GLB roundtrip. `tests/guardian-sword.mjs` checks the built `dist` game, including fire loading and pause clock, along with the existing sword battle/reward flows. New views are saved here; the initial model previews remain in the parent directory for comparison.

Reference ledger: game-asset creation, Three.js model recipes, graphics implementation, render recipes, technical art, shader cookbook, procedural-model/material/performance checklists. No global visual overhaul, new input scheme or new boss attacks were added.

Final checks passed: model/export/fire pixel test and production sword combat test, with no collected browser errors. Model report: 58 meshes, 48,878 triangles (the rigid-model diagnostic counts the billboard's base quad once), 1.735 units tall, 3,288,972-byte reference GLB. Fire test: 8,349 visible changed pixels against fire-off, 12,837 changed pixels between two fire times, exact reduced-motion stillness, nine instances sharing one 512 × 512 texture. Production mobile recovery view: 105 calls, 120,216 rendered triangles and 26 textures. The whole scene retains 588 loaded geometries, above the generic skill's starting budget; this pass does not attempt to unload the rest of the level, and hardware frame time remains unmeasured.
