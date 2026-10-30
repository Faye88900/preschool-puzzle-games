# Open-to-pickup runtime animation

The existing correct-answer gate, 65 percent chest scene scale, 1.2-second lid/rise animation and explicit pickup are retained. Clicking pickup now starts a 0.7-second flight: the existing crystal follows a smooth arc toward the character, turns and shrinks, then disappears. Only arrival grants treasure/health and permits sailing. Existing pickup/key sounds are reused. No camera change, new model, particle system or dependency.

The flight start is captured once in chest-local space; the current character destination is converted from world space to account for chest rotation and scale. Arc height is 0.5 world units. Repeated input cannot restart or duplicate the collection. The pickup action shows Collecting while flight is active; movement remains available. Pause freezes its transform/time exactly; reset clears it without a delayed reward. Reduced motion completes collection immediately.

PASS: npm run build; updated tests/treasure-models.mjs (moving/shrinking crystal, delayed inventory, repeated input, pause/resume, reset during flight, reduced motion and responsive captures); tests/treasure-production.mjs (actual built loop and mobile pickup); tests/boat-crossing.mjs (unlock after flight, crossing/return/reset); tests/treasure-animation.mjs (real built loop and normal game camera recording); git diff --check. No captured page/console/HTTP errors. Build retains the existing large-chunk warning.

open-to-pickup.webm is a silent recording of the real game canvas, 1280x800, produced with browser captureStream and MediaRecorder. The built scene runs its normal tick; only the test exposes the instance and places the character at the chest. No runtime debug interface is added. The recording is 16.3 seconds because this headless environment renders slowly; this is not a physical-device FPS measurement. ready.png, flying.png and collected.png include the actual DOM HUD as well.

Changed files: src/maze.ts, src/maze-text.ts, tests/treasure-models.mjs, tests/boat-crossing.mjs, new tests/treasure-animation.mjs. The standalone chest/crystal GLBs are unchanged; the collection flight is a gameplay animation targeting the current player, not a baked model clip.

References followed: existing threejs-gameplay-systems game-feel.md (readable pickup movement and easing), gameplay-workflows.md (input/state/render boundaries); threejs-qa-release qa-release-checklists.md and visual-verification.md; ponytail (reuse existing model/render/state and focused tests). No broad visual baseline framework or unrelated refactor was added.

No deployment, ZIP delivery or physical-device testing in this pass.
