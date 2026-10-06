// Run with the local Vite server available: node scripts/prepare-puzzle-audio.mjs
// Native browser decoding keeps asset preparation free of extra dependencies.
import { chromium } from '@playwright/test';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';

const clips = [
  ['pickup', 'interface/Audio/pluck_001.ogg'],
  ['drop', 'impact/Audio/impactWood_light_000.ogg'],
  ['switch', 'interface/Audio/switch_004.ogg'],
  ['gate', 'gate.mp3', .15, 1.5],
  ['pipe', 'rpg/Audio/creak1.ogg', 0, .5],
  ['grain', 'rice.mp3', 1, .9],
  ['flow', 'bubbles.mp3', 5.4, .65],
  ...[0, 1, 2].flatMap(i => [
    [`stepGrass${i}`, `impact/Audio/footstep_grass_00${i}.ogg`],
    [`stepStone${i}`, `impact/Audio/footstep_concrete_00${i}.ogg`],
  ]),
  ['bloom', 'jingles/Audio/Pizzicato jingles/jingles_PIZZI03.ogg'],
  ['key', 'interface/Audio/confirmation_004.ogg'],
  ['win', 'umplix-victory.wav', 0, 7],
  ['jump', 'interface/Audio/maximize_001.ogg'],
  ['land', 'impact/Audio/impactSoft_medium_000.ogg'],
  ['hint', 'interface/Audio/question_001.ogg'],
  ['chick', 'chick.mp3', 3, 1.25],
  ['water', 'water.mp3', 12, 8],
];
const destination = 'public/audio/puzzle';
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage();
  await page.goto(process.env.AUDIO_PREP_URL || 'http://127.0.0.1:5188');
  const report = [];
  for (const [id, file, start = 0, length] of clips) {
    const decoded = await page.evaluate(async ({ id, file, start, length }) => {
      const rate = 22050;
      const decoder = new OfflineAudioContext(1, 1, rate);
      const response = await fetch(`/artifacts/audio-sources/${file}`);
      if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
      const original = await decoder.decodeAudioData(await response.arrayBuffer());
      const duration = Math.min(length ?? original.duration, original.duration - start);
      const ctx = new OfflineAudioContext(1, Math.ceil(duration * rate), rate);
      const source = ctx.createBufferSource(); source.buffer = original;
      const filter = ctx.createBiquadFilter();
      filter.type = id === 'chick' ? 'highpass' : 'lowpass';
      filter.frequency.value = id === 'chick' ? 1200 : ['gate', 'pipe', 'flow'].includes(id) ? 5000 : 9000;
      source.connect(filter).connect(ctx.destination); source.start(0, start, duration);
      if (id === 'pipe') {
        const latch = ctx.createBufferSource(), gain = ctx.createGain();
        const response = await fetch('/artifacts/audio-sources/rpg/Audio/metalLatch.ogg');
        if (!response.ok) throw new Error(`metalLatch.ogg: HTTP ${response.status}`);
        latch.buffer = await ctx.decodeAudioData(await response.arrayBuffer());
        gain.gain.value = .35; latch.connect(gain).connect(filter); latch.start(.35, 0, .15);
      }
      let data = (await ctx.startRendering()).getChannelData(0);
      const mean = data.reduce((sum, sample) => sum + sample, 0) / data.length;
      data = data.map(sample => sample - mean);
      if (id === 'water') {
        // Overlap the ends so repeated playback has no discontinuity.
        const overlap = Math.round(rate * .3), n = data.length;
        const loop = data.slice(overlap);
        for (let i = 0; i < overlap; i++) {
          const t = i / (overlap - 1);
          loop[loop.length - overlap + i] = data[n - overlap + i] * (1 - t) + data[i] * t;
        }
        data = loop;
      } else {
        const fade = Math.min(Math.round(rate * .012), Math.floor(data.length / 2));
        for (let i = 0; i < fade; i++) {
          data[i] *= i / fade; data[data.length - 1 - i] *= i / fade;
        }
      }
      const peak = data.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
      const scale = .7 / Math.max(peak, .001);
      const bytes = new Uint8Array(data.length * 2), view = new DataView(bytes.buffer);
      for (let i = 0; i < data.length; i++) view.setInt16(i * 2, Math.round(data[i] * scale * 32767), true);
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      return { pcm: btoa(binary), seconds: data.length / rate, rate, originalDuration: original.duration };
    }, { id, file, start, length });
    const pcm = Buffer.from(decoded.pcm, 'base64'), header = Buffer.alloc(44);
    header.write('RIFF'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8);
    header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
    header.writeUInt32LE(decoded.rate, 24); header.writeUInt32LE(decoded.rate * 2, 28);
    header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
    await writeFile(`${destination}/${id}.wav`, Buffer.concat([header, pcm]));
    report.push({ id, original: file, start, seconds: +decoded.seconds.toFixed(3), bytes: 44 + pcm.length, loop: id === 'water', ...(id === 'pipe' ? { layer: 'rpg/Audio/metalLatch.ogg at 0.35 s, gain 0.35' } : {}) });
  }
  for (const name of ['impact', 'interface', 'jingles', 'rpg']) await copyFile(`artifacts/audio-sources/${name}/License.txt`, `${destination}/LICENSE-Kenney-${name}.txt`);
  await writeFile('artifacts/audio-sources/preparation.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
