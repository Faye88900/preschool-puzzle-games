# Ember weapon trail

`weapon-smear.js` is the original `createWeaponSmearEffect` function delivered inside the site's standalone export source, retrieved on 2026-10-28:

- Gallery: https://ember-three-vfx.pages.dev/zh-TW/#effects
- Effect: `weapon-smear`
- Publisher: 00GameDevs (@00vchannel)
- License: MIT, retained in the JS header and `LICENSE.txt`.

Only the exported asset function is included. Site UI, branding and promotional images are not included. The function is unchanged apart from adding its ES module export. The small `.d.ts` file describes the API used by this project.

The runtime attaches the effect to the actual sword base/tip, uses an orange palette, and shows its bounded 64-sample trail during strikes. It needs no remote requests, external textures, scene capture or extra animation loop. Reduced motion hides the trail while keeping attack timing and warnings.
