# Flower choir

- `flower-choir.mp3`: user-supplied original song, copied byte-for-byte from `Downloads/花儿醒来了.mp3` on 2026-10-22. Embedded title: 花儿醒来了. Duration: 41.96 seconds. The original MP3 remains unchanged.
- Embedded lyrics match the approved three verses and two closing lines. Local Whisper base analysis supplied syllable times; `src/flower-choir-cues.ts` corrects transcription homophones against those embedded lyrics. Timing analysis is in `artifacts/flower-choir/`.
- No additional music or voice was generated. The quiet sleeping breath is synthesized locally through the existing effects bus.
- Movement reference: https://tenor.com/view/sunflower-pvz-plants-vs-zombies-gif-15949532. The implementation animates the game's existing flower design; it does not ship the reference image.
