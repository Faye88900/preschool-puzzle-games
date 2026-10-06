# 第二关音效来源

Checked and downloaded on 2026-10-06. All sources below explicitly identify these assets as **CC0**. Audio is bundled locally; the game makes no requests to the source websites.

## Publishers and original downloads

- **Kenney, Impact Sounds 1.0**: https://kenney.nl/assets/impact-sounds
  - Download: https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip
  - Original license: `LICENSE-Kenney-impact.txt` in this directory.
- **Kenney, Interface Sounds 1.0**: https://kenney.nl/assets/interface-sounds
  - Download: https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip
  - Original license: `LICENSE-Kenney-interface.txt`.
- **Kenney, Music Jingles**: https://kenney.nl/assets/music-jingles
  - Download: https://kenney.nl/media/pages/assets/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip
  - Original license: `LICENSE-Kenney-jingles.txt`.
- **Kenney, RPG Audio**: https://kenney.nl/assets/rpg-audio
  - Download: https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip
  - Original license: `LICENSE-Kenney-rpg.txt`.
- **Umplix, Victory**: https://opengameart.org/content/victory-4
  - Download: https://opengameart.org/sites/default/files/victory_0.wav
  - CC0; attribution is optional. Original recording is 12.632 seconds, stereo 44,100 Hz, 24-bit PCM. The first 7 seconds retain the complete approximately 5-second fanfare and its audible decay; the remaining low-level reverb tail is omitted.
- **Joseph SARDIN / BigSoundBank, Chick that chirp #0672**: https://bigsoundbank.com/chick-that-chirp-s0672.html
  - Download: https://bigsoundbank.com/UPLOAD/mp3/0672.mp3
  - Source page: CC0 (public domain), permits editing and redistribution, including commercial games.
- **Joseph SARDIN / BigSoundBank, Small Stream #4 / #1354**: https://bigsoundbank.com/small-stream-4-s1354.html
  - Download: https://bigsoundbank.com/UPLOAD/mp3/1354.mp3
  - Source page: CC0 (public domain), permits editing and redistribution, including commercial games.
- **Joseph SARDIN / BigSoundBank, Raw rice poured into a saucepan / #0201**: https://bigsoundbank.com/raw-rice-poured-into-a-saucepan-s0201.html
  - Download: https://bigsoundbank.com/UPLOAD/mp3/0201.mp3
  - CC0. The author describes the recording as suitable for small seeds being poured into a pan.
- **Joseph SARDIN / BigSoundBank, Metal barrier: Opening #1 / #2355**: https://bigsoundbank.com/grinding-metal-barrier-opening-1-s2355.html
  - Download: https://bigsoundbank.com/UPLOAD/mp3/2355.mp3
  - CC0. A real metal barn barrier opening.
- **Joseph SARDIN / BigSoundBank, Water bubbles / #0150**: https://bigsoundbank.com/water-bubbles-s0150.html
  - Download: https://bigsoundbank.com/UPLOAD/mp3/0150.mp3
  - CC0. Water bubbles made with a straw in a mug.

License: https://creativecommons.org/publicdomain/zero/1.0/
BigSoundBank license information: https://bigsoundbank.com/licenses.html
Attribution is optional under CC0; this ledger credits the authors voluntarily.

## Files and actual game triggers

| Local WAV | Original file within source pack | Duration | Trigger |
| --- | --- | ---: | --- |
| pickup.wav | Interface / Audio/pluck_001.ogg | 0.100 s | Pick up a workshop block |
| drop.wav | Impact / Audio/impactWood_light_000.ogg | 0.263 s | Put down a block, including unmatched shapes |
| switch.wav | Interface / Audio/switch_004.ogg | 0.497 s | Square block presses the plate |
| gate.wav | BigSoundBank / 2355.mp3, 0.15–1.65 s | 1.500 s | Workshop opens after the plate click; final key opens exit |
| pipe.wav | RPG / Audio/creak1.ogg + Audio/metalLatch.ogg | 0.500 s | Rotate a pipe: short friction followed by a latch |
| grain.wav | BigSoundBank / 0201.mp3, 1.00–1.90 s | 0.900 s | Pick up or place grain |
| flow.wav | BigSoundBank / 0150.mp3, 5.40–6.05 s | 0.650 s | Water first reaches a new connected pipe prefix |
| stepGrass0.wav, stepGrass1.wav, stepGrass2.wav | Impact / Audio/footstep_grass_000.ogg, 001.ogg, 002.ogg | 0.775, 0.671, 0.690 s | Grounded walking over grass; cycle three variations |
| stepStone0.wav, stepStone1.wav, stepStone2.wav | Impact / Audio/footstep_concrete_000.ogg, 001.ogg, 002.ogg | 0.103, 0.105, 0.110 s | Grounded walking over existing cobblestone tiles |
| bloom.wav | Jingles / Audio/Pizzicato jingles/jingles_PIZZI03.ogg | 1.147 s | Water first reaches the flower |
| key.wav | Interface / Audio/confirmation_004.ogg | 0.490 s | Collect any key |
| win.wav | Umplix / victory_0.wav, 0.00–7.00 s | 7.000 s | Walk through the exit to complete the level |
| jump.wav | Interface / Audio/maximize_001.ogg | 0.258 s | Successful jump |
| land.wav | Impact / Audio/impactSoft_medium_000.ogg | 0.115 s | Return to ground after falling/jumping |
| hint.wav | Interface / Audio/question_001.ogg | 0.491 s | Request a hint |
| chick.wav | BigSoundBank / 0672.mp3, 3.00–4.25 s | 1.250 s | Chicken responds, enters coop, returns, or newly waits/is blocked |
| water.wav | BigSoundBank / 1354.mp3, 12.00–20.00 s | 7.700 s, loop | Completed water path, fades with player distance from pond |

All files: mono, 22,050 Hz, 16-bit PCM WAV. Short effects do not loop. Original excerpts were converted using native browser decoding, DC removal, peak normalization to 0.7, and short edge fades. Chick recording has a 1,200 Hz high-pass filter to reduce box/handling noise. Gate, pipe and flow have a 5,000 Hz low-pass filter; other files use 9,000 Hz. Pipe combines the first 0.5 seconds of creak1 with the first 0.15 seconds of metalLatch, starting at 0.35 seconds with layer gain 0.35. Water has a 300 ms overlap crossfade at the loop seam. No generated audio or API credentials were used.

Only raw sources used by `scripts/prepare-puzzle-audio.mjs`, their licenses and verification metadata are kept in `artifacts/audio-sources/`; unused recordings and promotional shortcuts were removed. Run with a Vite server at port 5188, or set `AUDIO_PREP_URL`. Metadata: `artifacts/audio-sources/preparation.json`.

## Runtime behavior

The existing Start button unlocks Web Audio. A small second-level-only player decodes local files, routes effects and ambience through the shared mute gain, and suspends/resumes its context with game pause and page visibility. Restart stops old sources before resuming. Only one source per effect and one water loop may run; repeated chirps have a 2.5-second cooldown. Speech reduces effect gain and water gain. Water remains silent away from the pond and ends on completion. Pipe guidance is spoken once per run; later rotations retain the visible text and rotation sound.

The completion fanfare is a one-shot at gain 0.65, routed directly to the shared master gain so speech does not duck it. Existing background music and other sounds stop at completion; restarting stops the fanfare, and master mute still silences it. This replaces the previous 1.002-second cue. The design references the dedicated Course Clear fanfare in Super Mario World and the clear-dance fanfare in Kirby; no Nintendo recordings or melodies were imported:
- https://www.mariowiki.com/Course_Clear_(Super_Mario_World)
- https://www.ssbwiki.com/Fanfare

Footfalls follow the shared walking animation's lowest body positions, require real horizontal displacement and ground contact, and stop while idle or airborne. Road bounds come from the actual existing paving meshes; curved tile interiors are approximated by their bounds. Footsteps are quiet, cycle three samples per surface, and have small pitch variations. Progress bubbles wait for the actual pipe rotation/flow connection, play only when water reaches farther than before in the current run, and rise slightly in pitch with progress. Reconnecting an already reached prefix does not repeat the cue; restart resets progress.

Reference used for integration: `C:/Users/yongting/.codex/skills/threejs-audio-generator/references/audio-workflows.md`. Asset sourcing followed the user's request to find recordings online; ElevenLabs generation and credential probing were unnecessary.

## First-pass local verification, 2026-10-06

- TypeScript and Vite production build passed.
- Five selected Playwright checks passed: complete audio/key/exit flow, mobile audio controls, pond flow/pause/reset, square-only pressure plate, and mobile exploration. The audio control check was additionally rerun with a mobile browser context (`hasTouch`, `isMobile`) and actual touchscreen taps; passed.
- All 14 WAV files decoded in Chrome. The asset check found non-silent PCM, peaks below 0.71, and recorded SHA-256 hashes in `artifacts/audio-sources/asset-check.json`. Runtime audio totals 632,534 bytes.
- Water loop stayed a single source across an entire loop, pause and resume. Mute blocked new effects and silenced the master gain. Restart/completion removed the old loop. No audio load/decode or page errors occurred in the full-flow check.
- These are local browser and signal checks. Subjective listening on speakers/headphones and testing on physical mobile devices remain unverified.

## Footstep/foley pass verification, 2026-10-06

- TypeScript and Vite production build passed. Four selected Playwright checks passed: full audio/puzzle/exit flow, mobile touchscreen controls, footsteps plus water-prefix progress, and pond flow/pause/reset.
- Verified stone and grass footstep variations, no footsteps at rest or in midair, mute blocking new sounds, dry downstream pipes making no progress sound, no repeated reward for reconnecting an old prefix, and progress resetting on restart.
- All 21 PCM WAV files are non-silent and have normalized peaks below 0.71. Total runtime audio is 852,738 bytes. Updated duration/RMS/SHA-256 records are in `artifacts/audio-sources/asset-check.json`.
- Physical-device and subjective speaker/headphone listening remain unverified.

## User-provided background music

- Puzzle Time.mp3: provided by the user on 2026-10-06; copied without modification. Not part of the CC0 sound-effect collection above.

## Completion fanfare verification, 2026-10-06

- TypeScript/build and the full audio/puzzle/exit Playwright check passed. The completion panel triggered win once, the decoded clip was 7 seconds and remained active after 2.5 seconds, existing music was stopped, and restarting stopped the old fanfare.
- Updated win.wav has non-silent musical content at 2–4 seconds, normalized peaks below 0.71, and SHA-256 recorded in `artifacts/audio-sources/asset-check.json`. It is 308,744 bytes. Subjective speaker/headphone listening remains unverified.

