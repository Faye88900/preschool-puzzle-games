# Wind effect: broad cartoon gust

Implemented on 2026-10-20 after the user chose the broad, readable presentation of Kirby's tornado effects, with a mint-green accent. Reference viewed during design: https://www.nintendo.com/ph/switch/arzg/copy/index.html

## Visual and technical brief

- Preserve the garden's rounded shapes, existing camera, lighting, UI and staff model.
- Replace the six thin travelling arcs with one filled teal tapered gust, three broad mint/cream spiral bands with bright edges, and three small leaves.
- A short muzzle pulse marks release; the gust forms quickly, travels, and dissolves. Hits have an expanding two-ring air burst. Empty casts dissipate without pretending to hit something.
- Keep the existing 0.5-second visual lifetime, 0.65-second cooldown, target selection, damage, range and mechanism timing. This is a visual pass; damage remains immediate as in the existing game.
- Build geometry once and reuse it for all casts. No new textures, lights, shadows, bloom, shaders, dependencies or imported models. The complete effect has 13 meshes and 4,332 triangles; visible stages use a subset. The prop budget is at most 16 meshes and 12,000 triangles.
- Animation is derived from the existing timer so repeated renders and pause are stable. Reduced motion retains the essential travelling signal while stopping the gust/leaf spin.

## Verification

`tests/wind-effect.mjs` compares the old six-arc fixture and new effect under the same real game camera, lighting, pose and viewport. It measures pixels that differ from the idle frame by more than 24/255 in any RGB channel. This is a visibility comparison, not a perception or frame-rate measurement. Desktop 1280x800, portrait 390x844 and landscape 844x390 captures and final counts are in `test-results/wind-effect/report.json`.

The same test checks geometry resource counts, finite vertices/normals, travel and hit/empty finish, repeatable updates, reduced motion, pause, keyboard/touch triggering, reset and browser/HTTP errors. `tests/wind-wand.mjs` also passes the existing gardener reward, staff grip/movement, windmill bridge, shield/exposed guardian and reset checks.

The built output is updated. No delivery ZIP was updated. This task does not establish physical-device performance, production deployment or a fresh full-level playthrough. Existing world render costs remain outside this small effect's budget; scene metrics are recorded in the report.
