# Sword grip correction

Historical comparison: the user clarified that the reference concerned the hand and cutting-plane orientation, not a chest-level sword position. Current source and evidence are documented in `../upright-grip/`.

The user's Kirito image replaces the previous raised-arm stance with a bent elbow and a fist wrapped around the hilt in front of the waist. The ready blade slopes across the chest without covering the eyes. The model retains its approved proportions, shoulder-side crest and residual orange flame.

`src/ember-guardian.ts` now has separate upper arm, elbow and wrist pivots, four curled fingers and an opposing thumb. The sword is a child of the gripping wrist at the same origin. `src/guardian-combat.ts` rotates that shared wrist during all three attacks instead of rotating a blade inside a static fist.

The forged blade has a closed six-sided cross-section: front and back central ridges, four bevel surfaces and narrow edges. Heat fissures follow those surfaces. This replaces the overlapping flat blade faces. No additional dependency or runtime model download was introduced.

## Visual reference ledger

- User-supplied Kirito image: grip placement and elbow bend.
- Bandai Namco, Sword Art Online: Fractured Daydream official Kirito character art: https://en.bandainamcoent.eu/sword-art-online/sword-art-online-fractured-daydream
- Nintendo, Meta Knight amiibo official figure photos: https://www.nintendo.com/us/amiibo/detail/meta-knight-amiibo-kirby-series/

External art was inspected for hand/hilt alignment and readable solid blade facets. Local copies in `references/` are research only, outside the shipped `public/` directory. No external character or weapon mesh is included in the game.

## Evidence

- `model-result.json`: 64 meshes, 50,266 triangles, 1.735-unit solid height; finite geometry, waist-level grip, elbow bend, sword thickness, floor clearance during all three attacks, continuous wrist orientation during the overhead cut and GLB export/reload checks passed.
- `front.png`, `side.png`, `back.png`, `three-quarter.png`, `grip-closeup.png`: actual source-factory renders.
- `warn.png`, `lunge.png`, `rest.png`, `stun.png`: posed renders; `comparison.png`: ordinary knight scale comparison.
- Residual fire pixel changes and reduced-motion stillness passed. The reference GLB omits runtime shader flames.
- `npm run build` passed. Production combat checks passed for all three attacks, actual hits, locked warning direction, dodge, counters, pause, reduced motion, pursuit, key collection, reset and touch input. Results are stored in `../production/result.json`; its mobile recovery view has 116 render calls and 121,524 triangles, with no browser/page/network errors.

Desktop browser evidence does not establish physical-device frame rates or player-study results. No deployment or ZIP packaging was requested.
