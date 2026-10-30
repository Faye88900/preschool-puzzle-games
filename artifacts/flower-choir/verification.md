# Flower choir — 2026-10-22

## Implemented experience

The player uses the existing wind action beside the five front-facing flowers at the choir bed (75, -4.4). The flower nearest the player wakes first; awakening spreads to its neighbours. The supplied recording loops continuously while the player remains within 8 world units. Flowers stay awake through each loop. Leaving that listening area stops audio and captions immediately, then flowers gradually settle into sleep over two seconds: sway slows, petals gather, heads lower and eyes close. Pause freezes this transition; wind during the transition wakes them from their current pose. Level reset still restores the sleeping pose immediately. The listening area is deliberately smaller than the distance to the pavilion chest, so the song has stopped at the chest approach. Pause and mute remain available.

Swaying, leaf movement, gentle squash/stretch and petal flutter run throughout the music, including the instrumental intro and break. Facial expressions include staggered blinks, larger eyes with highlights, a curved smile between vocal turns and a wider singing mouth. Fourteen timed lines (twelve lyrics plus two closing lines) receive progressive character highlighting. The opaque cream subtitle band has two rows: large current lyric and smaller next lyric. Desktop maximum width is 520px, current lyric up to 36px and next lyric 18px. Portrait/landscape font sizes also increase while preserving room for controls and the player. While captions are visible, desktop keyboard help is hidden and its place is restored after leaving. Touch actions and player movement stay available.

The small pinwheel is the visual clue. Sleeping flowers breathe gently and occasionally make a quiet synthesized sleeping sound. There is no fail state or compulsory wait for this optional performance. The existing quest, ferry, combat, exits and flowerbed collider are preserved.

## Audio and timing

- User recording: `public/audio/maze/flower-choir.mp3`, 1,015,241 bytes, 41.96 seconds.
- SHA-256: `5CC81ED57112E7E62979275037C18953BFEF19A9E1760E507525B5FDB215A68B`.
- Original Downloads file, public copy and built copy match.
- Embedded lyrics confirm the approved text. Local Whisper base analysis identified syllable timing; homophones were corrected against the embedded text. This was local analysis, with no upload of the recording. Analysis scripts and transcript are in this folder; temporary Python dependencies/model are outside the repository.
- First sung line: 10.44 seconds. Instrumental gap: 27.24–29.04 seconds. Closing lines: 37.30–41.24 seconds. The recording itself is not trimmed or altered.
- One decoded buffer and one active looping source; pause stops the source and preserves its exact total offset. Resuming uses the offset modulo the recording duration. Both animation and lyrics read the audio context clock; lyric cues and mouth energy wrap each pass while the wake-up progression stays complete. Reawakening reuses the decoded buffer.
- Song uses the music preference and a dedicated gain: .85 nearby, fade from 6 to 8 world units, stop beyond 8. Background music ducks from .22 to .035 during the nearby performance. Breathing uses the existing effects bus/preference.
- User gesture: existing start/wind/touch action resumes the existing AudioContext. Dialogue, pause, window blur, hidden page and level reset suspend or stop the performance appropriately.
- Audio generation credential probe: `ELEVENLABS_API_KEY=MISSING`. No new provider-generated assets were needed; the user supplied the finished music.

## Verification

- `npm run build`: TypeScript and Vite passed. Existing large-chunk warning remains.
- `node tests/flower-choir.mjs`: passed. Wind targeting, first-flower propagation, all fourteen lyric cues, progressive character fill, animation variation/idempotence, background ducking, free movement, pause/resume, independent music preference, reduced motion, automatic looping, third-pass lyric timing, leave/stop/sleep, touch reawakening and reset. The audio source is unchanged across a loop boundary.
- Desktop overlap regression: a real fine-pointer/mouse configuration asserts keyboard help is visible before the performance, hidden while lyrics are visible, and visible again after leaving. Portrait/landscape cases then enable touch emulation. This covers the keyboard-guide collision that earlier touch-only screenshots missed.
- Chest-approach regression: place the player two units in front of the actual chest position. Assert the current interaction target is `chest`, the choir source is stopped, flowers begin dozing without snapping, captions are hidden and background music has returned to .22. Both source and built-game tests use the authored chest position rather than an arbitrary distant point. Source tests assert intermediate head, petal and eye positions, a frozen transition during pause, completed sleep, reawakening from a partial pose and reset during dozing. Production tests check intermediate and completed sleep with the real runtime clock.
- Silent rendered animation preview: `artifacts/flower-choir/falling-asleep.gif`, generated from 30 game frames by `artifacts/flower-choir/capture-sleep.mjs`. Capture assertions verify the awake, intermediate and final sleeping poses, with audio stopped.
- Follow-up animation checks: with idle time held fixed, poses vary at 4.0/4.3 seconds (intro) and 27.7/28.1 seconds (instrumental break). Blinks hide the eye highlights; smiles and open singing mouths alternate with the correct cue. These checks prevent reverting to vocal-only dance motion.
- Viewports: 1280×800, 1024×768, 390×844, 844×390, 667×375. Caption bounds, text width, touch-control separation and player clearance asserted. Portrait singing framing was adjusted after the first screenshot exposed player overlap.
- `node tests/wind-garden-map.mjs`: passed. Route traversal, bed collision, shield combat, key/exit progression and reset retained. Static garden batching stays below 60 meshes; dynamic flower rig checked separately within the total mesh budget. Instance counts are included in the geometry triangle budget.
- `node tests/flower-choir-production.mjs`: uses the unmodified runtime loop and real audio clock against the built files at `http://127.0.0.1:5209/?level=3&lang=zh`, with test-only instance exposure and placement at the choir. It plays the full recording through the loop boundary and verifies the same source keeps playing, awake flowers, caption continuity, departure stopping/sleep, return and touch reawakening, keyboard movement, pause/resume and sound controls. The song is fetched once, with nonzero decoded Web Audio signal. Results are in the production report.
- Evidence: `test-results/flower-choir/`, `test-results/flower-choir-production/`, and `test-results/wind-garden-expanded/report.json`.
- Representative desktop chorus after the expression update: 166 render calls, 127,832 triangles. Portrait chorus: 133 calls, 103,100 triangles. The garden root totals 120 meshes and 98,922 triangles including instances. Finite geometry and nonblank, varied canvas pixels verified.
- `artifacts/flower-choir/instrumental-dance.gif`: silent close-up preview made from 30 rendered game frames during the instrumental intro (before the first vocal). The source capture asserts visible stem motion with a rotation range greater than .25 radians.

## Reference ledger

Read and applied from `C:/Users/yongting/.codex/skills/`:

- `threejs-gameplay-systems/SKILL.md`, `references/gameplay-workflows.md`, `references/game-feel.md`.
- `threejs-audio-generator/SKILL.md`, `references/audio-workflows.md`.
- `threejs-qa-release/SKILL.md`, `references/qa-release-checklists.md`, `references/checklists/visual-verification.md`, `references/checklists/playtest-qa.md`, `references/checklists/release.md`, `references/visual-test-harness.md`, `references/checklists/visual-test-harness.md`.
- `threejs-game-ui-designer/references/checklists/game-ui-quality.md`, `hud-readability.md`, `responsive-ui-fit.md`.
- `threejs-game-ui-designer/SKILL.md`, `references/ui-patterns.md`, `references/checklists/mobile-input.md`.
- `threejs-aaa-graphics-builder/references/checklists/procedural-model-quality.md`, `material-lighting-quality.md`, `performance-safe-visual-detail.md`.
- Ponytail: `C:/Users/yongting/.codex/plugins/cache/ponytail/ponytail/5.3.2/skills/ponytail/SKILL.md`.
- Motion reference inspected in browser: https://tenor.com/view/sunflower-pvz-plants-vs-zombies-gif-15949532. Applied stem sway/head follow/leaf motion to the existing flower design; no reference art is shipped.
- Subtitle/HUD references: https://www.playstation.com/en-us/games/god-of-war-ragnarok/accessibility/ and https://blog.playstation.com/2022/02/10/accessibility-features-in-horizon-forbidden-west/. Applied readable subtitle backing and context-dependent HUD visibility using the game's existing cream/green palette.

Visual harness extended with controlled audio-time poses, responsive bounds assertions and screenshots. Pixel baselines are deferred while the new performance is under user review; song-clock phase continues during live captures, so the automated acceptance checks use explicit pose/lyric/layout assertions. No new general bot harness: the existing route regression plus targeted wind/touch and real-clock production tests cover this local interaction.

No physics-engine, progression, camera-control, audio-provider, deployment or packaging redesign was needed. No new application dependency was added. Timing is derived from automatic alignment rather than a supplied official LRC; perceptual syllable alignment and sound balance have not been checked on physical devices. ZIP and online deployment are unchanged.
