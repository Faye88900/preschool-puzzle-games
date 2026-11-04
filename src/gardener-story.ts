import * as T from 'three';
import { at, walkable } from './maze-map';
import { setGardenerExpression } from './gardener';
import { animateGuideWalk, animateWorkshopGuide } from './workshop-guide';

export class GardenerStory {
  stage = -1;
  elapsed = 0;
  introduced = false;
  mutter = 0;
  private noticed = false;
  private searchTime = 0;
  private gait = 0;
  private home = new T.Vector3(at('gardener').x, .68, at('gardener').z);
  private from = new T.Vector3();
  private fromLook = new T.Vector3();
  get active() { return this.stage >= 0; }
  get canAdvance() { return this.elapsed >= (this.reduced ? .2 : [1.3, .7, 1.6, 1.5][this.stage] ?? 0); }
  private reduced = false;

  constructor(private guide: T.Group, private player: T.Group, private camera: T.PerspectiveCamera,
    private look: T.Vector3, private onMutter: () => void, private onFinished: () => void) {}
  reset() {
    this.stage = -1; this.elapsed = this.searchTime = this.gait = this.mutter = 0;
    this.introduced = this.noticed = false;
    this.guide.position.copy(this.home); this.guide.rotation.y = Math.PI;
    setGardenerExpression(this.guide, 'neutral');
    this.player.getObjectByName('player-marker')!.visible = true;
  }
  setStage(stage: number) {
    this.stage = stage; this.elapsed = 0; this.mutter = 0;
    this.from.copy(this.camera.position); this.fromLook.copy(this.look);
  }
  finish(completed: boolean) { this.setStage(completed ? 4 : 5); }
  private turnTo(point: T.Vector3, dt: number) {
    const yaw = Math.atan2(this.guide.position.x - point.x, this.guide.position.z - point.z);
    const turn = Math.atan2(Math.sin(yaw - this.guide.rotation.y), Math.cos(yaw - this.guide.rotation.y));
    this.guide.rotation.y += turn * (this.reduced ? 1 : 1 - Math.exp(-7 * dt));
  }
  private walkTo(target: T.Vector3, dt: number) {
    const delta = target.clone().sub(this.guide.position); delta.y = 0;
    const distance = delta.length();
    if (distance < .02) return 0;
    const travel = Math.min(distance, dt * .8), next = this.guide.position.clone().addScaledVector(delta, travel / distance);
    this.turnTo(target, dt);
    const rack = Math.abs(next.x - (this.home.x - 2.4)) < 1.3 && Math.abs(next.z - (this.home.z - 2.1)) < .65;
    if (rack || !walkable(next.x, next.z, false, false, false) || Math.hypot(next.x - this.player.position.x, next.z - this.player.position.z) < 1.15) return 0;
    this.guide.position.copy(next); this.gait += travel * 7;
    return dt ? travel / dt : 0;
  }
  update(dt: number, paused: boolean, reduced: boolean, roaming: boolean,
    followPosition: T.Vector3, followLook: T.Vector3, canSearch = true) {
    this.reduced = reduced;
    this.player.getObjectByName('player-marker')!.visible = !this.active;
    if (paused) return;
    this.elapsed += dt; this.mutter = Math.max(0, this.mutter - dt);
    let speed = 0, searching = false;
    const well = new T.Vector3(at('tools').x + 1.4, .68, at('tools').z - 1.5);
    if (!this.active || this.stage >= 4) {
      if (canSearch && (roaming || this.stage >= 4)) {
        this.searchTime += dt;
        const phase = this.searchTime % 16;
        const rack = this.home.clone().add(new T.Vector3(-2.4, 0, -1));
        const ground = this.home.clone().add(new T.Vector3(.8, 0, -.9));
        const target = phase < 8 ? rack : ground;
        speed = this.walkTo(target, dt); searching = this.guide.position.distanceTo(target) < .12;
        if (searching) this.turnTo(target.clone().add(new T.Vector3(0, 0, -1)), dt);
        if (!this.introduced && !this.noticed && this.player.position.distanceTo(this.guide.position) < 9) {
          this.noticed = true; this.mutter = 4; this.onMutter();
        }
      }
    }

    const pose = this.stage === 2 ? 'nod' : 'idle';
    animateWorkshopGuide(this.guide, pose, this.elapsed, dt, reduced);
    animateGuideWalk(this.guide, this.gait, speed, dt, reduced);
    const torso = this.guide.getObjectByName('guide-torso')!;
    const blend = reduced ? 1 : 1 - Math.exp(-10 * dt);
    const leftHand = this.guide.getObjectByName('arm-1')!.children[0];
    leftHand.position.y = T.MathUtils.lerp(leftHand.position.y, 0, blend);
    leftHand.position.x = T.MathUtils.lerp(leftHand.position.x, -.11, blend);
    for (const side of [-1, 1]) {
      const hand = this.guide.getObjectByName('arm' + side)!.children[0];
      hand.position.z = T.MathUtils.lerp(hand.position.z, -.015, blend);
    }
    if (searching) torso.rotation.x = T.MathUtils.lerp(torso.rotation.x, -.35, blend);
    if (this.stage === 0 && this.elapsed < 2.2) {
      const side = Math.cos(this.guide.rotation.y) * 2.7 - Math.sin(this.guide.rotation.y) * 3.4 >= 0 ? 1 : -1;
      const hand = this.guide.getObjectByName('arm' + side)!.children[0];
      const reach = reduced ? 1 : T.MathUtils.smoothstep(this.elapsed, .05, .6);
      hand.position.y = (.27 + (reduced ? 0 : Math.sin(this.elapsed * 7) * .015)) * reach;
      hand.position.x = side * .11;
      hand.position.z = -.015 - .25 * reach;
    }
    setGardenerExpression(this.guide, this.introduced || this.stage >= 3 || (this.stage === 2 && this.elapsed > .7) ? 'happy' : this.stage === 0 || searching ? 'surprised' : 'neutral');
    if (!this.active) return;

    const portrait = innerWidth < innerHeight;
    const position = this.guide.position.clone().add(new T.Vector3(portrait ? 3.5 : 2.7, 1.9, portrait ? 5.0 : 3.4));
    const aim = this.guide.position.clone().add(new T.Vector3(0, -.18, 0));
    if (this.stage <= 2) {
      const middle = this.player.position.clone().add(this.guide.position).multiplyScalar(.5);
      const side = new T.Vector3(this.player.position.z - this.guide.position.z, 0, this.guide.position.x - this.player.position.x);
      if (side.lengthSq() < .01) side.set(1, 0, 0);
      side.normalize(); if (side.dot(this.from.clone().sub(middle)) < 0) side.negate();
      const span = this.player.position.distanceTo(this.guide.position) + 2;
      const distance = Math.max(portrait ? 8.5 : 5.3, span / (2 * Math.tan(T.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect) * 1.2);
      position.copy(middle).addScaledVector(side, distance); position.y = middle.y + 2;
      aim.copy(middle); aim.y -= .3;
    } else if (this.stage === 3) {
      const shortScreen = innerHeight < 550;
      aim.copy(well).add(new T.Vector3(0, shortScreen ? -7.68 : -3.68, shortScreen ? 8 : 6));
      position.copy(aim).add(new T.Vector3(portrait ? 7 : 8, portrait ? 23 : shortScreen ? 25 : 20, portrait ? 26 : 18));
    } else if (this.stage >= 4) { position.copy(followPosition); aim.copy(followLook); }
    const blendTime = this.stage === 4 ? 2.7 : this.stage === 5 ? .8 : .95;
    const t = reduced ? 1 : T.MathUtils.smoothstep(this.elapsed, 0, blendTime);
    this.camera.position.lerpVectors(this.from, position, t); this.look.lerpVectors(this.fromLook, aim, t);
    if ((this.stage === 4 && this.elapsed >= (reduced ? .2 : 3)) || (this.stage === 5 && this.elapsed >= (reduced ? .2 : .8))) {
      const completed = this.stage === 4; this.stage = -1;
      if (completed) this.introduced = true;
      this.player.getObjectByName('player-marker')!.visible = true;
      this.onFinished();
    }
  }
}
