# Sword residual fire

- Creator: Kenney Vleugels (Kenney.nl); Particle Pack 1.1.
- Original pack page: https://kenney.nl/assets/particle-pack
- Author's OpenGameArt publication: https://opengameart.org/content/particle-pack-80-sprites
- Download mirror: https://github.com/Calinou/kenney-particle-pack/tree/master/addons/kenney_particle_pack
- Direct source: https://raw.githubusercontent.com/Calinou/kenney-particle-pack/master/addons/kenney_particle_pack/flame_01.png
- Retrieved: 2026-10-28.
- License: Creative Commons Zero (CC0); original notice retained as `LICENSE.txt`.
- Local file: `flame_01.png`, 512 × 512 pixels, 51,191 bytes.
- SHA-256: `e9a3b7f44defc34251eccca5f54ad719765fe25b5266df7eb0906cd859076a43`.

Original downloaded PNG bytes are unchanged. The runtime interprets its grayscale image as a flame-opacity mask and tints it orange, using nine small instanced billboards anchored along the sword. Fire persists at rest, updates only from simulation time, and has a static reduced-motion pose. It uses one additional draw call and one local texture, with no external runtime requests or postprocessing.

The main Kenney ZIP endpoint returned HTTP 403 in this environment, so the matching CC0 pack mirror above supplied the texture and original license. `flame_02.png` was inspected as an alternative and retained only in research artifacts; it is not included in runtime assets.
