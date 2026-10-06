# Level 2 model sources and licenses

Checked and downloaded on 2026-10-02 via each asset page's signed-in official Free download link. All GLBs are unmodified originals. The six models named in the supplied design reference are included: Bld General Store 01, Home Cottage 01, Home Thatched House 01, Tree Oak 01, Bush Round 01, and Water Pond 01. Additional Free props match its benches, streetlamps, fences, paving, crates and barrel; existing apple trees and chickens remain in use. The streetscape update adds the Free Road Cobble Corner 01 (Cozy Village) and Fire Hydrant (Suburban Signature) models, plus joined ivory picket fences and corner returns.

| Local file | Source URL | Verified tier | License | Bytes | SHA-256 |
| --- | --- | --- | --- | ---: | --- |
| apple-tree.glb | https://threejsassets.com/assets/apple-tree | Free | Free Commercial License | 6888 | c0db3fce105e33d58d40e18f5d068ed57e8e8586b626c59e2522fab445f9c79e |
| barrel-01.glb | https://threejsassets.com/assets/barrel-01 | Free | Free Commercial License | 3784 | dc80c9c83985c1bbfb78ee6a573cf341be2d06d5abbc7aae9b6a8b643031d0e1 |
| bench-01.glb | https://threejsassets.com/assets/bench-01 | Free | Free Commercial License | 37464 | f8de886fb9beb6b5cdf779da8a90cdceefeda325716796b6b5e47609417f8fab |
| bld-general-store-01.glb | https://threejsassets.com/assets/bld-general-store-01 | Free | Free Commercial License | 6716 | 9abd69020bfe126c439d8caf7ea5ad3b794fcfaf9558f85a52a4457ccbe62fb0 |
| bush-round-01.glb | https://threejsassets.com/assets/bush-round-01 | Free | Free Commercial License | 5324 | d3dbf037ca645d2e84f80402d98daac376d0a838cf9870bbd8ca263252825c4b |
| chicken.glb | https://threejsassets.com/assets/chicken | Free | Free Commercial License | 4124 | 5f0cb784f9ac8b7105abb7e27947ff36c8ab80ed5bc8bf1cce0c38566ae647a5 |
| crate-01.glb | https://threejsassets.com/assets/crate-01 | Free | Free Commercial License | 2320 | d271e0fb89236a590d180d1231c26671380f4094fe8bdc03900619c0164fefe6 |
| home-cottage-01.glb | https://threejsassets.com/assets/home-cottage-01 | Free | Free Commercial License | 7804 | 9e265f5a39f56425b180c2988d1868ebaa79837bcaa5b1c3874c05f82e3f49cf |
| home-thatched-house-01.glb | https://threejsassets.com/assets/home-thatched-house-01 | Free | Free Commercial License | 6708 | 76f8fa588f49beb591a44a3b30f20457e71b3df7961ae2a5ae6dfe04088cf98c |
| picket-fence-01.glb | https://threejsassets.com/assets/picket-fence-01 | Free | Free Commercial License | 4768 | 36ba0bf84e792bd6e61c47eaa9b8a72cc087c0e50caff91cb90e6d8a842e4807 |
| road-cobble-straight-01.glb | https://threejsassets.com/assets/road-cobble-straight-01 | Free | Free Commercial License | 7840 | e8962000911c83080eeed300724173c4f81ede0410b2bbf824cff2b22d6043c5 |
| streetlamp-01.glb | https://threejsassets.com/assets/streetlamp-01 | Free | Free Commercial License | 2988 | b8fc0b2168c4de65296849f881682a057ab3ab5aafc39c923365a1ad51dbb65e |
| tree-oak-01.glb | https://threejsassets.com/assets/tree-oak-01 | Free | Free Commercial License | 6668 | aba3d2e08109d5678baea5da4f6039b476d1ed814f1f94755475deff2b7b7d0c |
| water-pond-01.glb | https://threejsassets.com/assets/water-pond-01 | Free | Free Commercial License | 5132 | 63afddc211720d3a7ecd7581b34106346799084711019b265a98c8148d15c2ef |

| fire-hydrant.glb | https://threejsassets.com/assets/fire-hydrant | Free | Free Commercial License | 6688 | bd17ef27a9c821d41288eb79bcb2c67493126fa5faf509a072c60159f209cdcc |
| road-cobble-corner-01.glb | https://threejsassets.com/assets/road-cobble-corner-01 | Free | Free Commercial License | 7204 | b9d457d4c6cc11d37dcf830166ec80880a8519af9e31a93540cd357b5681272a |

| terrain-grass-01.glb | https://threejsassets.com/assets/terrain-grass-01 | Free | Free Commercial License | 2888 | 52907abee0ff351d8709705c0588dc8421f8f8ad7dba15801bfd3224446015cf |

License: https://threejsassets.com/license#free-asset-license (v1, updated 2026-07-08).

The license permits educational and commercial end-product use, modification and embedding without attribution. It prohibits standalone asset redistribution, mirroring, resale, asset packs, downloadable templates and starter kits. Preview access alone does not grant production-use or download rights. These files were obtained using the authenticated download flow, not extracted from previews.

Placement and lighting: src/puzzle.ts. Models are centered and grounded using their bounding boxes, cloned with shared geometry/materials, and lit with warm directional sunlight plus sky/ground hemisphere fill. Buildings, benches, fences and hydrants have simple box colliders. Paving is flattened and tinted light gray; fences are tinted ivory in memory. The pond collider follows its current placement; foliage and dressing are decorative.

The local Draco WASM decoder and wrapper are copied from the installed Three.js package. Its Apache 2.0 license is retained in draco/LICENSE.txt. Source: https://github.com/google/draco/blob/main/LICENSE

Terrain Grass 01 was verified Free and downloaded from the official signed-in link on 2026-10-02. Its soil strata sit below ground so the grass cap joins the existing paths. Flower Bed 01 from the reference was not downloaded or used because it is marked paid. Puzzle flowers, beveled block/plate, pipe bases, gates, padlocks, lanterns and floral entrance arch are locally authored Three.js geometry in src/puzzle-art.ts and src/puzzle.ts; no external model license applies to those shapes. Existing road models, colors and placement are unchanged in this update.

2026-10-05 pond design: reused the original pond, bushes, grass, apple trees, picket fences, bench and chicken GLBs. The pond now sits beside the intake at (17, -21.5), width 6 and depth 7. Three custom transparent elbows retain the original interaction coordinates and solution; turf turntables, gold couplings, animated water beads, a flower basin, bloom and splash feedback are authored locally. Cattail Reed Clump (https://threejsassets.com/assets/cattail-reed-clump) was verified on its live page as Free / Free Commercial License, 544 triangles, 5 KB. The user supplied the official download from Downloads/cattail-reed-clump.glb on 2026-10-05. The original GLB is now loaded with the existing GLTFLoader/DRACOLoader and cloned into three waterline clumps, width 1.25, grounded at y=0.35. All six reference model types are now included.

| cattail-reed-clump.glb | https://threejsassets.com/assets/cattail-reed-clump | Free | Free Commercial License | 4968 | a5b0469149e154c6712878491df022b264976b45a2afe7761d21bb03a244ea5f |

