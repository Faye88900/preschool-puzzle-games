# Upright blade and low one-handed grip

The user confirmed: preserve a single sword held at the side, tip down near the ground; use the supplied wooden-sword grip photo to correct the wrist and the blade's cutting-plane orientation. The reference does not request two-handed combat or a sword held across the chest.

`src/ember-guardian.ts` fixes the sword one quarter turn around its handle relative to the gripping hand, so its cutting plane follows the knuckles instead of lying parallel to the back of the hand. The shared ready pose lowers the arm and rolls the wrist into the grip. The existing sword dimensions, closed bevels, shoulder emblem and residual fire remain intact. `src/guardian-combat.ts` already uses that shared pose for idle, chase, recovery and stun, with all three attacks preserving the fixed hand/hilt relationship.

Actual source renders: `three-quarter.png`, `side.png`, `front.png`, `back.png` and `grip-closeup.png`. The static `ember-guardian.glb` export omits animated shader flames, as before.

`tests/ember-guardian-model.mjs` checks low grip height, downward tip clearance across four poses, blade/knuckle alignment during all three attacks, floor clearance, continuous overhead wrist rotation, finite geometry, visible animated fire, reduced-motion stillness and GLB export/reload. The report is `model-result.json`. Production combat verification is recorded in `../production/result.json`.

No new assets or dependencies. Desktop checks do not constitute physical-phone performance validation.
