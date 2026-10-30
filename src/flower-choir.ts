import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat } from './models';
import type { PuzzleAudio } from './puzzle-audio';
import type { Settings } from './settings';
import { CHOIR_CUES } from './flower-choir-cues';

type Flower = { root: T.Group; head: T.Group; petals: T.InstancedMesh; eyes: T.InstancedMesh; glints: T.InstancedMesh; lids: T.Group; mouth: T.Mesh; smile: T.Mesh; leaves: T.Mesh[]; height: number };
const COLORS = ['#eca0b8', '#edce62', '#b6a1df', '#edb4c5', '#e8ce73'];
const BEAT = 60 / 115;
const LISTEN_RADIUS = 8;
const SLEEP_DURATION = 2;

export class FlowerChoir {
  flowers: Flower[] = [];
  notes: T.Mesh[] = [];
  rotor = new T.Group();
  status: 'sleeping' | 'playing' | 'dozing' = 'sleeping';
  sleepTime = 0;
  poseAwake: number[] = [];
  sleepSinging: boolean[] = [];
  firstFlower = 0;
  offset = 0;
  startedAt = 0;
  idleTime = 0;
  audio?: PuzzleAudio;
  buffer?: AudioBuffer;
  gain?: GainNode;
  source?: AudioBufferSourceNode;
  envelope: number[] = [];
  caption?: HTMLElement;
  line?: HTMLElement;
  next?: HTMLElement;
  cueIndex = -2;
  nextSnore = 3;
  ducking = false;
  snore?: OscillatorNode;

  constructor(public root: T.Group) {
    const sphere = new T.SphereGeometry(1, 8, 5), transform = new T.Object3D();
    const glintGeometry = new T.SphereGeometry(1, 6, 4);
    const smileGeometry = new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-.13, -.08, .282), new T.Vector3(0, -.17, .287), new T.Vector3(.13, -.08, .282)]), 7, .018, 4);
    const mesh = (parent: T.Object3D, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      const m = new T.Mesh(sphere, mat(color)); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
      m.castShadow = m.receiveShadow = true; parent.add(m); return m;
    };
    for (let i = 0; i < 5; i++) {
      const flower = new T.Group(), head = new T.Group(), lids = new T.Group();
      flower.name = `choir-flower-${i}`; head.name = 'flower-head'; lids.name = 'closed-eyes';
      const height = 1.15 + i % 2 * .25;
      flower.position.set(-2.15 + i * 1.05, .04, -.1 + Math.sin(i * 1.7) * .5);
      head.position.y = height; flower.add(head); root.add(flower);
      const stem = new T.Mesh(new T.CylinderGeometry(.06, .09, height, 7), mat('#658b57'));
      stem.position.y = height / 2; stem.castShadow = true; flower.add(stem);
      const leaves = [-1, 1].map(side => {
        const leaf = mesh(flower, '#739d55', side * .25, .4, .04, .34, .11, .18);
        leaf.rotation.z = side * .28; return leaf;
      });
      const petals = new T.InstancedMesh(sphere, mat(COLORS[i]), 6); petals.name = 'flower-petals';
      for (let p = 0; p < 6; p++) {
        const a = p * Math.PI / 3; transform.position.set(Math.cos(a) * .44, Math.sin(a) * .44, 0);
        transform.scale.set(.32, .35, .16); transform.updateMatrix(); petals.setMatrixAt(p, transform.matrix);
      }
      petals.castShadow = petals.receiveShadow = true; head.add(petals);
      mesh(head, '#fff0b6', 0, 0, .14, .34, .34, .14);
      const eyes = new T.InstancedMesh(sphere, mat('#514b43'), 2); eyes.name = 'open-eyes';
      const glints = new T.InstancedMesh(glintGeometry, mat('#fffbed'), 2); glints.name = 'eye-highlights';
      for (const [j, side] of [-1, 1].entries()) {
        transform.position.set(side * .12, .055, .278); transform.scale.set(.043, .079, .021);
        transform.updateMatrix(); eyes.setMatrixAt(j, transform.matrix);
        transform.position.set(side * .12 - .011, .081, .3); transform.scale.set(.014, .021, .009);
        transform.updateMatrix(); glints.setMatrixAt(j, transform.matrix);
        const curve = new T.CatmullRomCurve3([new T.Vector3(side * .12 - .055, .045, .28), new T.Vector3(side * .12, .015, .29), new T.Vector3(side * .12 + .055, .045, .28)]);
        lids.add(new T.Mesh(new T.TubeGeometry(curve, 5, .014, 4), mat('#5f5149')));
      }
      const mouth = mesh(head, '#795444', 0, -.115, .279, .073, .028, .016); mouth.name = 'singing-mouth';
      const smile = new T.Mesh(smileGeometry, mat('#795444')); smile.name = 'happy-smile';
      head.add(eyes, glints, lids, smile); this.flowers.push({ root: flower, head, petals, eyes, glints, lids, mouth, smile, leaves, height });
    }
    const noteParts = [new T.SphereGeometry(.09, 8, 5).scale(1.3, .7, .6), new T.BoxGeometry(.035, .36, .035).translate(.09, .16, 0), new T.BoxGeometry(.16, .045, .035).translate(.15, .32, 0)];
    const noteGeometry = mergeGeometries(noteParts)!; noteParts.forEach(p => p.dispose());
    for (let i = 0; i < 5; i++) {
      const note = new T.Mesh(noteGeometry, new T.MeshBasicMaterial({ color: i % 2 ? '#fff0b6' : '#c3f3d1', transparent: true, depthWrite: false }));
      note.name = `choir-note-${i}`; note.visible = false; root.add(note); this.notes.push(note);
    }
    const pinwheel = new T.Group(); pinwheel.name = 'choir-pinwheel'; pinwheel.position.set(3.25, .05, .1); root.add(pinwheel);
    const post = new T.Mesh(new T.CylinderGeometry(.035, .045, 1.3, 6), mat('#ae7e49')); post.position.y = .65; pinwheel.add(post);
    this.rotor.position.y = 1.3; pinwheel.add(this.rotor);
    const blades = new T.InstancedMesh(new T.BoxGeometry(.35, .13, .045), mat('#b7d3a0'), 4);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2; transform.position.set(Math.cos(a) * .2, Math.sin(a) * .2, 0);
      transform.scale.set(1, 1, 1); transform.rotation.z = a + .45; transform.updateMatrix(); blades.setMatrixAt(i, transform.matrix);
    }
    this.rotor.add(blades); mesh(this.rotor, '#edce73', 0, 0, .055, .065, .065, .04);
    this.animate(0, false);
  }

  async load(audio: PuzzleAudio) {
    this.audio = audio; this.gain = audio.context.createGain(); this.gain.gain.value = 0;
    this.gain.connect(audio.context.destination);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}audio/maze/flower-choir.mp3`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.buffer = await audio.context.decodeAudioData(await response.arrayBuffer());
      const samples = this.buffer.getChannelData(0), stride = Math.floor(this.buffer.sampleRate * .04);
      for (let i = 0; i < samples.length; i += stride) {
        let energy = 0, count = 0;
        for (let j = i; j < Math.min(i + stride, samples.length); j += 8) { energy += samples[j] ** 2; count++; }
        this.envelope.push(Math.min(1, Math.sqrt(energy / count) * 5));
      }
    } catch (error) { console.warn('Cannot load flower choir', error); }
  }

  mount(parent: HTMLElement) {
    this.caption = document.createElement('div'); this.caption.className = 'choir-lyrics'; this.caption.hidden = true;
    this.caption.setAttribute('role', 'group'); this.caption.setAttribute('aria-label', '花儿合唱团歌词');
    this.caption.innerHTML = '<p class="choir-line" aria-live="polite"></p><p class="choir-next" aria-hidden="true"></p>';
    this.line = this.caption.querySelector('.choir-line')!; this.next = this.caption.querySelector('.choir-next')!;
    parent.append(this.caption);
  }

  get elapsed() { return this.source && this.audio ? this.audio.context.currentTime - this.startedAt : this.offset; }
  get performing() { return this.status === 'playing'; }

  start(index: number) {
    if (!this.buffer || !this.audio || this.performing) return false;
    this.poseAwake = this.flowers.map(f => 1 - f.head.rotation.x / .55); this.sleepTime = 0;
    this.firstFlower = index; this.offset = 0; this.status = 'playing'; this.cueIndex = -2;
    this.play(); return true;
  }

  play() {
    if (this.source || !this.buffer || !this.audio || !this.gain) return;
    const source = this.audio.context.createBufferSource(); source.buffer = this.buffer; source.loop = true;
    source.connect(this.gain); this.startedAt = this.audio.context.currentTime - this.offset; this.source = source;
    source.start(0, this.offset % this.buffer.duration);
  }

  pause() {
    this.offset = this.elapsed;
    if (this.source) { this.source.onended = null; this.source.stop(); this.source.disconnect(); this.source = undefined; }
  }

  reset() {
    this.pause(); this.status = 'sleeping'; this.offset = this.idleTime = 0; this.nextSnore = 3;
    this.sleepTime = 0; this.poseAwake = []; this.sleepSinging = [];
    this.snore?.stop(); this.snore = undefined;
    this.cueIndex = -2; if (this.caption) this.caption.hidden = true;
    if (this.audio && this.ducking) this.audio.music.volume = .22;
    this.ducking = false; this.animate(0, false);
  }

  update(dt: number, running: boolean, distance: number, settings: Settings, reducedMotion: boolean) {
    if (running) this.idleTime += dt;
    if (this.performing && distance > LISTEN_RADIUS) {
      this.poseAwake = this.flowers.map(f => 1 - f.head.rotation.x / .55);
      this.sleepSinging = this.flowers.map(f => f.mouth.visible && !f.smile.visible);
      this.pause(); this.status = 'dozing'; this.sleepTime = 0; this.nextSnore = this.idleTime + 3;
    } else if (this.status === 'dozing' && running) {
      this.sleepTime = Math.min(SLEEP_DURATION, this.sleepTime + dt);
      if (this.sleepTime === SLEEP_DURATION) this.status = 'sleeping';
    }
    if (this.performing) {
      if (running) this.play(); else this.pause();
    }
    const level = T.MathUtils.clamp((LISTEN_RADIUS - distance) / 2, 0, 1);
    this.gain?.gain.setTargetAtTime(settings.music ? level * .85 : 0, this.audio!.context.currentTime, .12);
    const duck = this.performing && running && distance <= LISTEN_RADIUS && settings.music;
    if (this.audio && duck !== this.ducking) { this.audio.music.volume = duck ? .035 : .22; this.ducking = duck; }
    if (running && this.status === 'sleeping' && distance < 11 && settings.effects && this.idleTime >= this.nextSnore && this.audio?.context.state === 'running') {
      this.nextSnore = this.idleTime + 7;
      const ctx = this.audio.context, breath = ctx.createOscillator(), gain = ctx.createGain(), now = ctx.currentTime;
      breath.type = 'sine'; breath.frequency.setValueAtTime(90, now); breath.frequency.exponentialRampToValueAtTime(60, now + .6);
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.018, now + .2); gain.gain.linearRampToValueAtTime(0, now + .8);
      breath.connect(gain).connect(this.audio.effects); breath.start(); breath.stop(now + .8);
      this.snore = breath;
      breath.onended = () => { breath.disconnect(); gain.disconnect(); if (this.snore === breath) this.snore = undefined; };
    }
    const settlingTime = this.status === 'dozing' ? this.sleepTime - this.sleepTime ** 2 / (2 * SLEEP_DURATION) : 0;
    this.animate(this.elapsed + settlingTime, reducedMotion);
    if (this.caption) {
      this.caption.hidden = !running || !this.performing;
      if (!this.caption.hidden) this.updateLyrics(this.elapsed % this.buffer!.duration);
    }
  }

  updateLyrics(time: number) {
    const index = CHOIR_CUES.findIndex(cue => time >= cue.start && time < cue.end), cue = CHOIR_CUES[index];
    if (index !== this.cueIndex) {
      this.cueIndex = index; this.line!.replaceChildren();
      if (cue) {
        this.line!.setAttribute('aria-label', cue.text);
        for (const char of cue.text) { const span = document.createElement('span'); span.textContent = char; span.setAttribute('aria-hidden', 'true'); this.line!.append(span); }
      } else {
        this.line!.removeAttribute('aria-label'); this.line!.textContent = '♫ 跟着音乐摇一摇';
      }
      this.next!.textContent = (CHOIR_CUES.find(c => c.start > time)?.text) ?? '';
    }
    if (cue) Array.from(this.line!.children).forEach((child, i) => {
      const start = cue.words[i], end = cue.words[i + 1] ?? cue.end;
      (child as HTMLElement).style.setProperty('--sung', `${T.MathUtils.clamp((time - start) / Math.max(.04, end - start), 0, 1) * 100}%`);
    });
  }

  animate(time: number, reducedMotion: boolean) {
    const songTime = this.buffer ? time % this.buffer.duration : time;
    const dozing = this.status === 'dozing', active = this.performing || dozing;
    const settle = dozing ? T.MathUtils.smoothstep(this.sleepTime, 0, SLEEP_DURATION) : 0;
    const movement = this.performing ? 1 : dozing ? 1 - settle : 0;
    const cue = CHOIR_CUES.findIndex(c => songTime >= c.start && songTime < c.end);
    const beat = (time - CHOIR_CUES[0].start) / BEAT * Math.PI * 2;
    const energy = active ? this.envelope[Math.min(this.envelope.length - 1, Math.floor(songTime / .04))] ?? 0 : 0;
    this.rotor.rotation.z = reducedMotion ? 0 : this.idleTime * .45 + (active ? time * 2 : this.offset * 2 + this.sleepTime);
    this.flowers.forEach((f, i) => {
      const delay = Math.abs(i - this.firstFlower) * .48;
      const awake = dozing ? this.poseAwake[i] * (1 - settle) : this.performing ? T.MathUtils.lerp(this.poseAwake[i] ?? 0, 1, T.MathUtils.smoothstep(time - delay, 0, .8)) : 0;
      const lead = cue < 2 ? this.firstFlower : cue < 4 ? (this.firstFlower + 1) % 5 : cue < 8 ? cue % 5 : -1;
      const singing = dozing ? this.sleepSinging[i] && settle < .8 : this.performing && cue >= 0 && (lead === -1 || lead === i || cue >= 4 && i % 2 === cue % 2);
      const bounce = reducedMotion ? 0 : Math.abs(Math.sin(beat + i * .24)) * awake * movement;
      const sway = reducedMotion ? 0 : T.MathUtils.lerp(Math.sin(this.idleTime * 1.4 + i * .24) * .028, Math.sin(beat / 2 + i * .24) * (.07 + awake * .09), movement);
      f.root.rotation.z = sway;
      f.root.scale.set(1 - bounce * .02, 1 + bounce * .035, 1);
      f.head.position.y = f.height - (1 - awake) * .14 + (reducedMotion ? 0 : T.MathUtils.lerp(Math.sin(this.idleTime * 1.6 + i) * .018, bounce * .055, movement));
      f.head.rotation.set((1 - awake) * .55, 0, reducedMotion ? 0 : T.MathUtils.lerp(Math.sin(this.idleTime + i * .24 - .4) * .012, Math.sin(beat / 2 + i * .24 - .4) * .075, movement));
      f.petals.scale.setScalar(.75 + awake * .25 + (singing && !reducedMotion ? energy * .035 : 0));
      f.petals.rotation.z = reducedMotion ? 0 : Math.sin(beat + i * .24 - .3) * .045 * awake * movement;
      const blink = !reducedMotion && ((active ? time : this.idleTime) + i * .43) % 3.6 < .14;
      const eyeOpen = dozing ? 1 - T.MathUtils.smoothstep(this.sleepTime, .25, 1.35) : 1;
      f.eyes.visible = (dozing ? this.poseAwake[i] > .65 && eyeOpen > .1 : awake > .65) && !blink;
      f.glints.visible = f.eyes.visible && eyeOpen > .4; f.lids.visible = !f.eyes.visible;
      f.eyes.scale.y = (1 + bounce * .13) * eyeOpen; f.glints.scale.y = f.eyes.scale.y;
      f.mouth.visible = singing || awake < .2; f.smile.visible = !singing && awake >= .2;
      f.mouth.scale.x = singing ? T.MathUtils.lerp(.09 + energy * .025, .073, settle) : .073;
      f.mouth.scale.y = singing ? T.MathUtils.lerp(.045 + energy * .14, .025, settle) : .025;
      f.smile.scale.set(1 + bounce * .08, (1 + bounce * .12) * (1 - settle * .8), 1);
      f.leaves.forEach((leaf, j) => { leaf.rotation.z = (j ? 1 : -1) * (.28 + (reducedMotion ? 0 : T.MathUtils.lerp(Math.sin(this.idleTime * 1.4 + i * .24 + j * Math.PI) * .035, Math.sin(beat + i * .24 + j * Math.PI) * (.12 + awake * .16), movement))); });
      const note = this.notes[i], age = (time - delay) % 2;
      note.visible = active && !reducedMotion && awake > .1 && age < 1.5;
      note.position.set(f.root.position.x + Math.sin(age * 2 + i) * .18, f.height + .7 + age * .5, f.root.position.z + .25);
      (note.material as T.MeshBasicMaterial).opacity = Math.max(0, 1 - age / 1.5) * (1 - settle);
    });
  }
}
