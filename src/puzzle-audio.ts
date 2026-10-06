// Local CC0 recordings and cues; sources and processing are in audio/puzzle/SOURCES.md.
const levels = {
  pickup: .32, drop: .4, switch: .35, gate: .2, pipe: .24, grain: .26, flow: .24,
  bloom: .38, key: .4, win: .65, jump: .22, land: .2, hint: .24, chick: .32, water: .16,
  stepGrass0: .1, stepGrass1: .1, stepGrass2: .1, stepStone0: .12, stepStone1: .12, stepStone2: .12,
};
export type PuzzleSound = keyof typeof levels;

export class PuzzleAudio {
  music = new Audio(`${import.meta.env.BASE_URL}audio/puzzle/Puzzle Time.mp3`);
  context = new AudioContext();
  master = this.context.createGain();
  effects = this.context.createGain();
  waterGain = this.context.createGain();
  buffers = new Map<PuzzleSound, AudioBuffer>();
  sources = new Map<PuzzleSound, AudioBufferSourceNode>();
  plays: Partial<Record<PuzzleSound, number>> = {};
  lastPlay = new Map<PuzzleSound, number>();
  ducked = false;
  muted = false;
  stepIndex = 0;

  constructor() {
    this.music.loop = true; this.music.volume = .22; this.music.preload = 'auto';
    this.effects.connect(this.master); this.waterGain.connect(this.master);
    this.master.connect(this.context.destination);
    this.waterGain.gain.value = 0;
  }
  async load() {
    await Promise.all(Object.keys(levels).map(async key => {
      const id = key as PuzzleSound;
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}audio/puzzle/${id}.wav`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        this.buffers.set(id, await this.context.decodeAudioData(await response.arrayBuffer()));
      } catch (error) { console.warn(`Cannot load puzzle sound ${id}`, error); }
    }));
  }
  resume() {
    void this.context.resume().catch(error => console.warn('Cannot resume puzzle audio', error));
    void this.music.play().catch(error => console.warn('Cannot play puzzle music', error));
  }
  pause() {
    this.music.pause();
    void this.context.suspend().catch(error => console.warn('Cannot pause puzzle audio', error));
  }
  mute(muted: boolean) {
    this.muted = muted;
    this.music.muted = muted;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setValueAtTime(muted ? 0 : 1, this.context.currentTime);
  }
  play(id: PuzzleSound, rate = 1) {
    const buffer = this.buffers.get(id), now = this.context.currentTime;
    const cooldown = id === 'chick' ? 2.5 : .08;
    if (this.muted || !buffer || this.context.state !== 'running' || now - (this.lastPlay.get(id) ?? -Infinity) < cooldown) return;
    this.lastPlay.set(id, now);
    this.sources.get(id)?.stop();
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = buffer; source.loop = id === 'water'; gain.gain.value = levels[id];
    source.playbackRate.value = rate;
    if (['drop', 'pipe', 'grain', 'jump', 'land', 'chick'].includes(id) || id.startsWith('step')) source.playbackRate.value *= .96 + Math.random() * .08;
    source.connect(gain).connect(id === 'water' ? this.waterGain : id === 'win' ? this.master : this.effects);
    source.onended = () => {
      source.disconnect(); gain.disconnect();
      if (this.sources.get(id) === source) this.sources.delete(id);
    };
    this.sources.set(id, source); this.plays[id] = (this.plays[id] ?? 0) + 1; source.start();
  }
  footstep(stone: boolean) {
    this.play(`${stone ? 'stepStone' : 'stepGrass'}${this.stepIndex++ % 3}` as PuzzleSound);
  }
  water(level: number, speaking: boolean) {
    if (this.context.state !== 'running') return;
    if (speaking !== this.ducked) {
      this.ducked = speaking;
      this.music.volume = speaking ? .07 : .22;
      this.effects.gain.setTargetAtTime(speaking ? .55 : 1, this.context.currentTime, .06);
    }
    if (level > 0 && !this.sources.has('water')) this.play('water');
    this.waterGain.gain.setTargetAtTime(level * (speaking ? .3 : 1), this.context.currentTime, .18);
  }
  stop() {
    this.music.pause(); this.music.currentTime = 0; this.music.volume = .22;
    this.sources.forEach(source => source.stop()); this.sources.clear(); this.lastPlay.clear();
    this.stepIndex = 0;
    this.waterGain.gain.cancelScheduledValues(this.context.currentTime); this.waterGain.gain.value = 0;
    this.effects.gain.cancelScheduledValues(this.context.currentTime); this.effects.gain.value = 1; this.ducked = false;
  }
}
