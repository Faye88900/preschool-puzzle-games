# First encounter garden ruins implementation

Approved visual: garden-ruins-v2.png. Scope is only the first black-knight clearing in Level 3.
Keep maze cells, spots, bridge locks, knight homes/HP/AI, player physics, UI, lighting, audio and other scenes unchanged.

## Renderable design
Ivory bevelled irregular stone paving with a central leaf medallion, asymmetric old stone arch framing the existing northbound corridor, shallow relief ruined walls, ochre leaf pennant, dark shield crest, broad ivy and peach/cream flower planters.
The arch aligns with actual onward route at practice + (5, -8.3). Structural props remain in existing blocked hedge cells; central paving stays flush. New physics bodies are unnecessary.

## Integration reach
- New src/first-encounter-ruins.ts: one factory with shared static geometry grouped by material.
- src/maze.ts: build placement and existing building-occlusion integration for the tall arch.
- New tests/first-encounter-ruins.mjs: geometry budget, open route, actual keyboard/touch movement, wind defeat, reset/pause, desktop/mobile/landscape, before/after pixels and renderer counts.
- Build dist via existing npm run build.
No new packages, config, exports outside the local import, runtime models or texture downloads.

## Technical budget and source
Source chain: built-in imagegen approved garden-ruins-v2.png -> authored runtime geometry using existing rounded/flower/material conventions.
Target added geometry <55k triangles and ~30 meshes, shared rough materials, no additional lights, shadow maps, postprocessing, texture downloads or animations. Batch static pieces per semantic subgroup/material.
Keep DPR cap 1.5 and current shadows unchanged. Actual diagnostics will be in test-results/first-encounter-ruins/report.json.
Focused deterministic captures are warranted; full screenshot-baseline service is skipped for this one-scene update. Use same camera/time before/after and preserve evidence rather than adding a new framework. No release-ready gameplay claim or whole-game score.

## References loaded
threejs-game-director/SKILL.md and references/phase-playbook.md; threejs-aaa-graphics-builder/SKILL.md and references/model-recipes.md, render-recipes.md, implementation-blueprint.md, visual-scorecard.md, technical-art.md, checklists/performance-safe-visual-detail.md; threejs-qa-release/SKILL.md and references/qa-release-checklists.md, checklists/visual-verification.md, checklists/playtest-qa.md.
External design already generated in this chat; no new external generator or credential requirement is introduced.

