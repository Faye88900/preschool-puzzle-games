import * as T from 'three';
import { createSneezeFlower, SNEEZE_FLOWER_CLIPS } from './sneeze-flower';
import { BOSS_ARENA, BOSS_ISLAND_OFFSET_X } from './ferry-shore-layout';

type Phase = keyof typeof SNEEZE_FLOWER_CLIPS;
type Flower = { root: T.Group; head: T.Object3D; mixer: T.AnimationMixer; actions: Record<Phase, T.AnimationAction>; phase: Phase; cooldown: number; used: boolean; cue: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>; zone: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>; edge: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>; petals: T.MeshStandardMaterial; emitter: T.Object3D };
const EMIT_TIME = SNEEZE_FLOWER_CLIPS.windup + .14, FLIGHT_TIME = .85, COOLDOWN = 12;
export const SNEEZE_FLOWER_REACH = 3.8;
const POLLEN_RANGE = 5.6, HALF_ANGLE = Math.PI * 65 / 180, PUFF_HALF_ANGLE = Math.PI * 25 / 180;

function sunlightTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const glow = ctx.createRadialGradient(128, 128, 40, 128, 128, 126);
  glow.addColorStop(0, '#fff7a6'); glow.addColorStop(.45, '#ffdf6199'); glow.addColorStop(1, '#ffce3100');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 256, 256);
  ctx.translate(128, 128); ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const angle = i * Math.PI / 12 - Math.PI / 2, radius = i % 2 ? 61 : 94;
    if (i === 0) ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    else ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  ctx.closePath(); ctx.fillStyle = '#ffe163'; ctx.strokeStyle = '#e9a730'; ctx.lineWidth = 4; ctx.fill(); ctx.stroke();
  const core = ctx.createRadialGradient(-18, -22, 4, 0, 0, 58);
  core.addColorStop(0, '#fffbd3'); core.addColorStop(.6, '#fff17c'); core.addColorStop(1, '#ffc83e');
  ctx.beginPath(); ctx.arc(0, 0, 56, 0, Math.PI * 2); ctx.fillStyle = core; ctx.fill();
  ctx.strokeStyle = '#fff4a2'; ctx.lineWidth = 5; ctx.stroke();
  ctx.beginPath(); ctx.arc(-5, -7, 37, Math.PI * 1.1, Math.PI * 1.7); ctx.strokeStyle = '#fffce2'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke();
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; return texture;
}

export class SneezeFlowers {
  root = new T.Group();
  flowers: Flower[] = [];
  active?: { flower: Flower; elapsed: number; emitted: boolean; hit: boolean; aim: number };
  private sunlight = new T.Group();
  private suns: T.Sprite[] = [];
  private start = new T.Vector3();

  constructor() {
    this.root.name = 'boss-sneeze-flowers'; this.sunlight.name = 'sneeze-flower-sunlight';
    this.sunlight.visible = false; this.root.add(this.sunlight);
    const sunMap = sunlightTexture();
    for (let i = 0; i < 9; i++) {
      const sun = new T.Sprite(new T.SpriteMaterial({ map: sunMap, transparent: true, depthWrite: false, toneMapped: false }));
      sun.name = 'flower-sun-' + i; this.suns.push(sun); this.sunlight.add(sun);
    }
    const x = (BOSS_ARENA.left + BOSS_ARENA.right) / 2 + BOSS_ISLAND_OFFSET_X, z = (BOSS_ARENA.top + BOSS_ARENA.bottom) / 2;
    const ring = new T.RingGeometry(1.45, 1.53, 40);
    const soil = new T.MeshStandardMaterial({ color: '#78573c', roughness: 1 });
    const sector = new T.RingGeometry(.95, POLLEN_RANGE, 40, 1, -Math.PI / 2 - HALF_ANGLE, HALF_ANGLE * 2);
    const border = new T.RingGeometry(POLLEN_RANGE - .055, POLLEN_RANGE, 40, 1, -Math.PI / 2 - HALF_ANGLE, HALF_ANGLE * 2);
    for (const [i, [dx, dz]] of [[-11, -4], [0, 9], [11, -4]].entries()) {
      const root = createSneezeFlower(); root.name = 'boss-sneeze-flower-' + i; root.position.set(x + dx, 0, z + dz); this.root.add(root);
      const bed = root.getObjectByName('flower-base-flower-soil') as T.Mesh;
      bed.scale.set(3.1, 1.15, 3.4); bed.material = soil;
      const mixer = new T.AnimationMixer(root), actions = Object.fromEntries(root.animations.map(clip => [clip.name, mixer.clipAction(clip)])) as Record<Phase, T.AnimationAction>;
      const cue = new T.Mesh(ring, new T.MeshBasicMaterial({ color: '#ffdf94', transparent: true, opacity: .65, side: T.DoubleSide, depthWrite: false, toneMapped: false }));
      cue.name = 'sneeze-flower-ready'; cue.rotation.x = -Math.PI / 2; cue.position.y = .055; root.add(cue);
      const zone = new T.Mesh(sector, cue.material.clone()), edge = new T.Mesh(border, cue.material.clone());
      zone.name = 'sneeze-flower-range'; edge.name = 'sneeze-flower-range-edge';
      for (const mesh of [zone, edge]) { mesh.rotation.x = -Math.PI / 2; mesh.position.y = .045; root.add(mesh); }
      const petals = (root.getObjectByName('flower-petals')!.children[0] as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>).material.clone();
      petals.emissive.set('#ffc78c'); root.traverse(node => { if (node instanceof T.Mesh && node.material.name === 'flower-petals') node.material = petals; });
      this.flowers.push({ root, head: root.getObjectByName('flower-head')!, mixer, actions, phase: 'idle', cooldown: 0, used: false, cue, zone, edge, petals, emitter: root.getObjectByName('pollen-emitter')! });
    }
    this.reset();
  }

  nearby(point: { x: number; z: number }) {
    let nearest: Flower | undefined, distance = SNEEZE_FLOWER_REACH;
    for (const flower of this.flowers) {
      const next = Math.hypot(point.x - flower.root.position.x, point.z - flower.root.position.z);
      if (next < distance) { nearest = flower; distance = next; }
    }
    return nearest;
  }

  private play(flower: Flower, phase: Phase) {
    const previous = flower.actions[flower.phase], action = flower.actions[phase]; flower.phase = phase;
    action.reset().setEffectiveWeight(1).setLoop(phase === 'idle' ? T.LoopRepeat : T.LoopOnce, phase === 'idle' ? Infinity : 1);
    action.clampWhenFinished = phase !== 'idle'; action.play();
    if (previous !== action) action.crossFadeFrom(previous, .1, false);
  }

  contains(flower: Flower, point: { x: number; z: number }) {
    const dx = point.x - flower.root.position.x, dz = point.z - flower.root.position.z, distance = Math.hypot(dx, dz);
    return distance >= .95 && distance <= POLLEN_RANGE &&
      dx * Math.sin(flower.root.rotation.y) + dz * Math.cos(flower.root.rotation.y) >= distance * Math.cos(HALF_ANGLE);
  }

  trigger(flower: Flower, boss: { x: number; z: number }) {
    if (this.active || flower.used || flower.cooldown > 0 || !this.contains(flower, boss)) return false;
    flower.cooldown = COOLDOWN; this.play(flower, 'windup');
    this.active = { flower, elapsed: 0, emitted: false, hit: false, aim: 0 }; return true;
  }

  reset() {
    this.active = undefined; this.sunlight.visible = false;
    for (const flower of this.flowers) {
      flower.mixer.stopAllAction(); flower.cooldown = 0; flower.used = false; flower.phase = 'idle';
      flower.root.rotation.y = Math.atan2(this.flowers[1].root.position.x - flower.root.position.x, flower === this.flowers[1] ? -9 : 4);
      flower.head.rotation.y = 0;
      flower.actions.idle.reset().setLoop(T.LoopRepeat, Infinity).play(); flower.mixer.update(0);
      flower.cue.material.color.set('#ffdf94'); flower.cue.material.opacity = .65; flower.cue.scale.setScalar(1);
      flower.zone.visible = flower.edge.visible = true;
      flower.zone.material.color.set('#efc876'); flower.zone.material.opacity = .09; flower.edge.material.color.set('#dfb862'); flower.edge.material.opacity = .55; flower.petals.emissiveIntensity = 0;
    }
  }

  update(dt: number, time: number, reducedMotion: boolean, boss: T.Group, alive: boolean): 'puff' | 'hit' | undefined {
    for (const flower of this.flowers) {
      flower.cooldown = Math.max(0, flower.cooldown - dt); flower.mixer.update(dt);
      const bearing = Math.atan2(boss.position.x - flower.root.position.x, boss.position.z - flower.root.position.z) - flower.root.rotation.y;
      const aim = Math.atan2(Math.sin(bearing), Math.cos(bearing));
      // Watch the guardian while charging, then keep the emitted puff's direction fixed.
      flower.head.rotation.y = this.active?.flower === flower && this.active.emitted ? this.active.aim : alive ? aim : 0;
      if (reducedMotion) flower.root.getObjectByName('flower-neck')!.rotation.x = 0;
      const ready = alive && !flower.used && flower.cooldown === 0 && !this.active && this.contains(flower, boss.position);
      const resting = flower.used || flower.cooldown > 0;
      flower.cue.material.color.set(ready ? '#b6f294' : resting ? '#9caa80' : '#ffdf94'); flower.cue.material.opacity = ready ? .9 : .3;
      flower.cue.scale.setScalar(ready && !reducedMotion ? 1 + Math.sin(time * 2.5) * .04 : 1);
      flower.zone.visible = flower.edge.visible = alive && !flower.used;
      flower.zone.material.color.set(ready ? '#b6f294' : resting ? '#9caa80' : '#efc876'); flower.zone.material.opacity = ready ? .2 : resting ? .035 : .09;
      flower.edge.material.color.copy(flower.zone.material.color); flower.edge.material.opacity = ready ? .85 : resting ? .18 : .55;
      flower.petals.emissiveIntensity = ready ? .32 : 0;
    }
    if (!alive) { if (this.active) this.reset(); return; }
    const active = this.active; if (!active) return;
    active.elapsed += dt;
    const phase: Phase = active.elapsed < SNEEZE_FLOWER_CLIPS.windup ? 'windup' : active.elapsed < SNEEZE_FLOWER_CLIPS.windup + SNEEZE_FLOWER_CLIPS.sneeze ? 'sneeze' : 'recover';
    if (active.flower.phase !== phase) this.play(active.flower, phase);
    let cue: 'puff' | 'hit' | undefined;
    if (!active.emitted && active.elapsed >= EMIT_TIME) {
      active.flower.root.updateMatrixWorld(true); active.flower.emitter.getWorldPosition(this.start);
      active.aim = active.flower.head.rotation.y;
      active.emitted = true; cue = 'puff';
    }
    if (active.emitted) {
      const age = active.elapsed - EMIT_TIME, t = Math.min(1, age / FLIGHT_TIME), burst = Math.max(0, age - FLIGHT_TIME);
      const reach = .95 + (POLLEN_RANGE - .95) * t;
      this.sunlight.visible = burst < .4;
      for (let i = 0; i < this.suns.length; i++) {
        const sun = this.suns[i];
        const angle = active.flower.root.rotation.y + T.MathUtils.clamp(active.aim + ((i * .618034 % 1) * 2 - 1) * PUFF_HALF_ANGLE, -HALF_ANGLE, HALF_ANGLE);
        const radius = reach * (.35 + (i * .414214 % 1) * .65), size = .68 + i % 3 * .13;
        const lift = reducedMotion ? 0 : Math.sin(t * Math.PI) * (.55 + i % 3 * .15) - t * .45 - burst * .8;
        sun.position.set(active.flower.root.position.x + Math.sin(angle) * radius, this.start.y + lift + (i % 3 - 1) * .22, active.flower.root.position.z + Math.cos(angle) * radius);
        sun.scale.setScalar(size * (reducedMotion ? 1 : 1 + Math.sin(age * 5 + i) * .06));
        sun.material.rotation = reducedMotion ? 0 : Math.sin(age * 2 + i) * .16;
        sun.material.opacity = 1 - Math.min(1, burst / .4);
      }
      const bearing = Math.atan2(boss.position.x - active.flower.root.position.x, boss.position.z - active.flower.root.position.z) - active.flower.root.rotation.y - active.aim;
      if (!active.hit && burst < .4 && Math.cos(bearing) >= Math.cos(PUFF_HALF_ANGLE) && this.contains(active.flower, boss.position) && Math.hypot(boss.position.x - active.flower.root.position.x, boss.position.z - active.flower.root.position.z) <= reach) { active.hit = true; active.flower.used = true; cue = 'hit'; }
    }
    if (active.elapsed >= SNEEZE_FLOWER_CLIPS.windup + SNEEZE_FLOWER_CLIPS.sneeze + SNEEZE_FLOWER_CLIPS.recover) {
      this.play(active.flower, 'idle'); this.active = undefined; this.sunlight.visible = false;
    }
    return cue;
  }
}
