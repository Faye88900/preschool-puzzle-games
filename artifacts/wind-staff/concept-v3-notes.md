# Wind staff concept v3

Status: the user selected option B on 2026-10-20. Its simplified runtime model is implemented in `src/wind-wand.ts`; option A remains an unused concept.

Generated with the built-in image generation tool on 2026-10-20. Output: `concept-v3-in-context.png`.

Local reference inputs:
- `test-results/plaza-after/desktop.png`: existing garden, palette, and runtime shape language.
- `public/images/player-dialogue/curious.png`: existing white player with lavender and mint wing ears.

Game research:
- Kirby Star Rod: simple identifiable magic head, broad colors. https://www.mariowiki.com/Star_Rod_%28Kirby%29
- Animal Crossing star wand: compact handheld prop and readable head. https://nookipedia.com/wiki/Item:Star_wand_(New_Horizons)
- Fantasy Life i Magician: friendly staff structure and character-relative scale. https://www.fantasylife.jp/fli/en/life/

Generation brief: show two original staffs next to the existing character in its sunny hedge garden. Preserve the character identity. Use rounded low-detail forms, matte broad color blocks, honey wood, cream, lavender, and mint. A has a floating wind pearl inside a cream open curl; B has a simple cyan crystal held by a rounded fork. Exclude fan blades, ornate metalwork, realistic bark, filigree, and fine runes. Show full staffs and full characters; only A/B labels.

The generated comparison illustrates design direction, not runtime rendering. Option A's enlarged head needs size normalization before modeling. Option B includes a separate enlarged prop alongside its handheld version.

## Option B runtime implementation

The existing Three.js factory interprets the concept with a light wood shaft, mint grip, lavender band and rounded fork, cream collars, a cyan faceted crystal with blunted ends, and one mint wind spiral. It uses geometry and shared materials without new textures or external model downloads. The grip attaches at the right hand; its orientation compensates for the carrying arm pose. Existing wind effects start at the crystal. Casting raises its emissive intensity and accelerates the spiral; pause and reduced motion stop rotation.

Technical frame: preserve the existing camera, lighting, physics, quest gates and controls. Aim for fewer than 24 prop draw calls and 12,000 triangles; the model uses 18 meshes and 4,532 triangles. Actual scale and grip are checked by `tests/wind-wand.mjs`; evidence is under `test-results/wind-wand/`, including `held-detail.png`. The focused browser test covers reward acquisition, four facing directions, walking grip, windmill/bridge, shielded versus exposed guardian casts, keyboard/touch casting, pause, reduced motion and reset. The guardian phases are set explicitly in this focused test; it is not a fresh combat playthrough. The build is updated; the ZIP is unchanged. These are automated desktop browser checks including mobile viewports, not physical-device or fresh human playthrough evidence.

The additional `maze-browser.mjs` full progression run was stopped after the quest/bridge checkpoint because its live-rendered run was slow. It did not verify the remaining guardian/key/exit sequence. The focused sample scene reports 810 calls and 674,530 triangles including the existing world; this task does not establish physical mobile performance or an improvement against an old-wand baseline.
