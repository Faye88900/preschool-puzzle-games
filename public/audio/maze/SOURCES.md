# Third-level music and flower choir

- `whispering-maze.mp3`: user-supplied exploration BGM, copied unchanged from `Downloads/Whispering Maze.mp3` on 2026-11-02.
- `gust-of-the-crystal-wand.mp3`: user-supplied combat BGM, copied unchanged from `Downloads/Gust of the Crystal Wand.mp3` on 2026-11-02.
- Both BGM tracks loop. Enemy engagement selects combat music; disengagement or defeat resumes exploration music at its previous position. Pause, music settings, dialogue ducking and flower-choir ducking apply to the selected track.

- `flower-choir.mp3`: user-supplied original song, copied byte-for-byte from `Downloads/花儿醒来了.mp3` on 2026-10-22. Embedded title: 花儿醒来了. Duration: 41.96 seconds. The original MP3 remains unchanged.
- Embedded lyrics match the approved three verses and two closing lines. Local Whisper base analysis supplied syllable times; `src/flower-choir-cues.ts` corrects transcription homophones against those embedded lyrics.
- No additional music or voice was generated. The quiet sleeping breath is synthesized locally through the existing effects bus.
- Movement reference: https://tenor.com/view/sunflower-pvz-plants-vs-zombies-gif-15949532. The implementation animates the game's existing flower design; it does not ship the reference image.
