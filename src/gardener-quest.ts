import * as T from 'three';
import R from '@dimforge/rapier3d-compat';
import { mat, orb } from './models';
import { gardenFlowerBed } from './puzzle-art';
import { createFlowerCart } from './flower-cart';
import { createGardenTrowel } from './garden-trowel';
import { createGardenSeedling } from './garden-seedling';
import { setGardenerExpression } from './gardener';
import { animateGuideWalk, animateWorkshopGuide } from './workshop-guide';
import { at } from './maze-map';
import { animateWalk } from './movement';
import type { MazeText } from './maze-text';

type Stage = 'search' | 'moving' | 'tool' | 'carrying' | 'handoff' | 'walking' | 'digging' | 'plant' | 'planting' | 'watering' | 'grown';

export class GardenerQuest {
  stage: Stage = 'search';
  elapsed = 0;
  hints = 0;
  pinwheelTime = 0;
  cart = createFlowerCart(true);
  pushPoint = new T.Vector3();
  bed = gardenFlowerBed('#f2bd75');
  flower = createGardenSeedling();
  seedling = createGardenSeedling();
  pinwheel = new T.Group();
  rotor = new T.Group();
  trail = new T.Group();
  drops = new T.Group();
  heldTool = createGardenTrowel();
  can = new T.Group();
  private pushArms = new T.Group();
  private cartBody: R.RigidBody;
  private cartBounds: T.Box3;
  private cartOffset: T.Vector3;
  private walkCorner = new T.Vector3();
  private walkLeg = 0;
  private guideGait = 0;
  private giver?: T.Group;
  private giverBody?: R.RigidBody;
  private giveFrom = new T.Vector3();
  private giveTo = new T.Vector3();
  private pushFrom = new T.Vector3();
  private pushBody?: R.RigidBody;
  private pushPlayer?: T.Group;
  private plantFrom = new T.Vector3();
  private gripFrom = new T.Vector3();
  get busy() { return ['moving', 'handoff', 'planting', 'watering'].includes(this.stage); }
  get returned() { return ['handoff', 'walking', 'digging', 'plant', 'planting', 'watering', 'grown'].includes(this.stage); }

  constructor(scene: T.Scene, world: R.World, private guide: T.Group, tool: T.Group) {
    this.cart.name = 'quest-tool-cart'; this.cart.scale.setScalar(1.3);
    this.cart.position.set(at('cart').x, 0, at('cart').z); scene.add(this.cart);
    const bounds = new T.Box3().setFromObject(this.cart), size = bounds.getSize(new T.Vector3());
    this.cartBounds = bounds;
    this.pushPoint.set(bounds.min.x - .42, .65, this.cart.position.z);
    this.cartOffset = bounds.getCenter(new T.Vector3()).sub(this.cart.position);
    this.cartBody = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
    world.createCollider(R.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2).setFriction(.1), this.cartBody);
    // Leave the blade under the near wheel and the wooden grip visible outside it.
    tool.rotation.y = Math.PI;
    tool.position.set(this.cart.position.x + .23 * 1.3 - .4, 0, this.cart.position.z + .695 * 1.3 + .1);
    this.bed.name = 'quest-flowerbed'; this.bed.position.set(at('flowerbed').x, .02, at('flowerbed').z);
    this.bed.scale.setScalar(.9);
    this.bed.children.filter(child => child.name === 'garden-bed-flower').forEach(child => this.bed.remove(child));
    this.flower.position.set(-1.7, .05, 0); this.bed.add(this.flower); scene.add(this.bed);
    this.seedling.name = 'quest-seedling';
    this.seedling.position.copy(this.bed.position).setY(.04).add(new T.Vector3(-2.9, 0, 1.55)); scene.add(this.seedling);
    const hole = new T.Mesh(new T.CircleGeometry(.42, 24), mat('#483824'));
    hole.name = 'planting-hole'; hole.rotation.x = -Math.PI / 2; hole.position.set(-1.7, .21, 0); this.bed.add(hole);
    const pole = new T.Mesh(new T.CylinderGeometry(.045, .06, 1.7, 8), mat('#b88a56'));
    pole.position.y = .85; this.pinwheel.add(pole); this.rotor.position.set(0, 1.65, .1);
    for (let i = 0; i < 4; i++) {
      const blade = orb(['#f4c85e', '#a6d2a5', '#f1b2bb', '#9acddd'][i], 0, .28, 0, .15, .35, .045);
      const arm = new T.Group(); arm.rotation.z = i * Math.PI / 2; arm.add(blade); this.rotor.add(arm);
    }
    this.rotor.add(orb('#fff1bd', 0, 0, .07, .1)); this.pinwheel.add(this.rotor);
    this.pinwheel.position.set(at('pinwheel').x, 0, at('pinwheel').z); scene.add(this.pinwheel);
    // Follow the existing eastern loop; the cart blocks the shorter western entrance.
    const steps = [[-32, 37], [-30, 33], [-30, 29], [-30, 25], [-30, 21], [-30, 17], [-32, 13], [-35, 11]];
    const print = new T.CircleGeometry(.18, 12), wet = new T.MeshStandardMaterial({ color: '#597e78', roughness: .35 });
    const footprints = new T.InstancedMesh(print, wet, steps.length * 2), foot = new T.Object3D();
    let index = 0;
    for (const [x, z] of steps) for (const side of [-1, 1]) {
      foot.rotation.x = -Math.PI / 2; foot.scale.y = 1.8;
      foot.position.set(x + side * .24, .04, z + side * .35); foot.updateMatrix(); footprints.setMatrixAt(index++, foot.matrix);
    }
    this.trail.add(footprints);
    this.trail.name = 'quest-wet-footprints'; scene.add(this.trail);
    this.holdTool(this.guide, -1);
    const canBody = new T.Mesh(new T.CylinderGeometry(.19, .22, .3, 12), mat('#83b4a3'));
    this.can.add(canBody);
    const spout = new T.Mesh(new T.CylinderGeometry(.045, .065, .4, 8), mat('#83b4a3'));
    spout.rotation.z = -.85; spout.position.set(.25, .08, 0); this.can.add(spout);
    const handle = new T.Mesh(new T.TorusGeometry(.2, .025, 6, 16), mat('#c7dfb7'));
    handle.position.set(-.1, .1, 0); this.can.add(handle); scene.add(this.can);
    for (let i = 0; i < 8; i++) this.drops.add(orb('#b9f3ff', 0, 0, 0, .055));
    scene.add(this.drops); this.reset();
    const sleeve = new T.CapsuleGeometry(.10, .8, 3, 8);
    for (let i = 0; i < 2; i++) {
      const arm = new T.Mesh(sleeve, mat('#f2eaf7')); arm.castShadow = arm.receiveShadow = true; this.pushArms.add(arm);
    }
    scene.add(this.pushArms);
  }

  reset() {
    this.releasePlayer();
    this.releaseGiver(); this.holdTool(this.guide, -1);
    this.walkLeg = this.guideGait = 0;
    animateWorkshopGuide(this.guide, 'idle', 0, 1, true); animateGuideWalk(this.guide, 0, 0, 1, true);
    for (const side of [-1, 1]) {
      const arm = this.guide.getObjectByName('arm' + side)!;
      arm.rotation.set(0, 0, side * .35); arm.children[0].position.set(side * .11, 0, -.015);
    }
    this.stage = 'search'; this.elapsed = this.hints = this.pinwheelTime = 0;
    this.cart.position.set(at('cart').x, 0, at('cart').z); this.syncCart();
    for (const side of [-1, 1]) this.cart.getObjectByName('cart-wheel' + side)!.rotation.z = 0;
    this.flower.visible = false; this.flower.scale.setScalar(1);
    this.flower.getObjectByName('rootball')!.visible = false;
    this.flower.getObjectByName('petals')!.scale.setScalar(.01);
    this.flower.getObjectByName('bud')!.scale.setScalar(1);
    this.seedling.position.copy(this.bed.position).setY(.04).add(new T.Vector3(-2.9, 0, 1.55));
    this.seedling.getObjectByName('petals')!.visible = false;
    this.seedling.getObjectByName('rootball')!.visible = true;
    this.seedling.visible = this.trail.visible = true;
    this.bed.getObjectByName('planting-hole')!.visible = false;
    this.heldTool.visible = this.can.visible = this.drops.visible = false; this.rotor.rotation.z = 0;
  }
  private syncCart() { this.cartBody.setTranslation(this.cart.position.clone().add(this.cartOffset), true); }
  cartAction(x: number, z: number): 'pushCart' | 'inspect' | undefined {
    if (this.stage !== 'search') return;
    const bounds = this.cartBounds;
    const dx = Math.max(bounds.min.x - x, 0, x - bounds.max.x);
    const dz = Math.max(bounds.min.z - z, 0, z - bounds.max.z);
    if (Math.hypot(dx, dz) > 2) return;
    // The two handles point along -X; accept a wide stance beside their tips.
    return x <= bounds.min.x + .2 && Math.abs(z - this.cart.position.z) < 1.7 ? 'pushCart' : 'inspect';
  }
  push(body: R.RigidBody, player: T.Group) {
    this.stage = 'moving'; this.elapsed = 0; this.pushBody = body; this.pushPlayer = player;
    this.pushFrom.copy(body.translation());
  }
  private releasePlayer() {
    this.pushArms.visible = false;
    if (this.pushPlayer) {
      if (this.seedling.parent === this.pushPlayer) this.bed.parent!.attach(this.seedling);
      const avatar = this.pushPlayer.getObjectByName('avatar')!; avatar.rotation.x = avatar.rotation.z = 0; avatar.position.y = 0;
      for (const side of [-1, 1]) {
        const arm = this.pushPlayer.getObjectByName('arm' + side)!;
        arm.rotation.set(0, 0, side * .35); arm.children[0].position.set(side * .11, 0, -.015);
        const foot = this.pushPlayer.getObjectByName('foot' + side)!;
        foot.position.set(side * .30, -.535, -.13); foot.rotation.set(0, 0, 0);
      }
    }
    this.pushBody = undefined; this.pushPlayer = undefined;
  }
  private connectHands(player: T.Group) {
    const avatar = player.getObjectByName('avatar')!;
    player.updateMatrixWorld(true);
    for (const side of [-1, 1]) {
      const shoulder = avatar.localToWorld(new T.Vector3(side * .35, .12, -.36));
      const hand = player.getObjectByName('arm' + side)!.children[0].getWorldPosition(new T.Vector3());
      const sleeve = this.pushArms.children[side === -1 ? 0 : 1];
      sleeve.position.copy(shoulder).lerp(hand, .5); sleeve.scale.y = shoulder.distanceTo(hand);
      sleeve.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), hand.sub(shoulder).normalize());
    }
  }
  private holdTool(holder: T.Group, side: number) {
    const arm = holder.getObjectByName('arm' + side)!;
    arm.add(this.heldTool); this.heldTool.scale.setScalar(.42); this.heldTool.rotation.set(0, 0, 0);
    this.heldTool.position.copy(arm.children[0].position).add(new T.Vector3(0, -.59, 0));
  }
  take(player: T.Group) { this.stage = 'carrying'; this.holdTool(player, 1); this.heldTool.visible = true; }
  give(body: R.RigidBody, player: T.Group) {
    this.stage = 'handoff'; this.elapsed = 0; this.giver = player; this.giverBody = body;
    this.giveFrom.copy(body.translation());
    this.giveTo.copy(this.giveFrom).sub(this.guide.position).setY(0);
    if (this.giveTo.lengthSq() < .01) this.giveTo.set(0, 0, 1);
    this.giveTo.normalize().multiplyScalar(1.3).add(this.guide.position).setY(.65);
    this.walkCorner.set(this.bed.position.x - 2.95, .68, this.guide.position.z); this.walkLeg = 0;
  }
  private releaseGiver() {
    if (this.giver) {
      const arm = this.giver.getObjectByName('arm1')!;
      arm.rotation.set(0, 0, .35); arm.children[0].position.set(.11, 0, -.015);
    }
    this.giver = undefined; this.giverBody = undefined;
  }
  plant(body: R.RigidBody, player: T.Group) {
    this.stage = 'planting'; this.elapsed = 0; this.pushBody = body; this.pushPlayer = player;
    this.pushFrom.copy(body.translation()); this.plantFrom.copy(this.seedling.position);
  }
  hint(): MazeText {
    if (this.stage === 'search') return ++this.hints === 1 ? 'trailHint' : 'wellHint';
    return this.stage === 'tool' ? 'takeTools' : this.stage === 'carrying' ? 'returnTools' : this.stage === 'walking' ? 'gardenerFollow' : this.stage === 'digging' ? 'gardenerDig' : 'plantHint';
  }

  update(dt: number, reduced: boolean, player: T.Group): MazeText | undefined {
    this.elapsed += dt; this.pinwheelTime = Math.max(0, this.pinwheelTime - dt);
    if (this.pinwheelTime > 0) this.rotor.rotation.z += dt * 8;
    this.trail.visible = !this.returned;
    if (this.stage === 'moving') {
      const distance = 5.5 * T.MathUtils.smoothstep(this.elapsed, .25, 1.75);
      this.cart.position.set(at('cart').x + distance, 0, at('cart').z);
      this.syncCart();
      player.position.lerpVectors(this.pushFrom, this.pushPoint.clone().add(new T.Vector3(distance, 0, 0)),
        T.MathUtils.smoothstep(this.elapsed, 0, .25));
      this.pushBody!.setTranslation(player.position, true);
      player.rotation.y = -Math.PI / 2;
      const effort = T.MathUtils.smoothstep(this.elapsed, 0, .25) * (1 - T.MathUtils.smoothstep(this.elapsed, 1.75, 2));
      animateWalk(player, -Math.PI / 2, distance * 4, effort * 3.6, true, reduced, dt);
      const avatar = player.getObjectByName('avatar')!;
      avatar.rotation.x = -.18 * effort; avatar.rotation.z = 0; avatar.position.y = 0;
      this.pushArms.visible = effort > .02;
      for (const side of [-1, 1]) {
        this.cart.getObjectByName('cart-wheel' + side)!.rotation.z = -distance / (.46 * 1.3);
        const arm = player.getObjectByName('arm' + side)!;
        arm.rotation.set(0, 0, side * .35 * (1 - effort)); player.updateMatrixWorld(true);
        const grip = this.cart.localToWorld(new T.Vector3(-1.94, .91, side * .43));
        arm.children[0].position.set(side * .11, 0, -.015).lerp(arm.worldToLocal(grip), effort);
      }
      this.connectHands(player);
      if (this.elapsed >= 2) { this.releasePlayer(); this.stage = 'tool'; return 'cartOpened'; }
    }
    if (!this.returned) return;
    const bed = this.bed.position, destination = new T.Vector3(bed.x - 2.95, .68, bed.z);
    const torso = this.guide.getObjectByName('guide-torso')!;
    animateWorkshopGuide(this.guide, 'idle', this.elapsed, dt, reduced);
    setGardenerExpression(this.guide, 'happy');
    if (this.stage === 'handoff') {
      player.position.lerpVectors(this.giveFrom, this.giveTo, T.MathUtils.smoothstep(this.elapsed, 0, .3));
      this.giverBody!.setTranslation(player.position, true);
      this.guide.rotation.y = Math.atan2(this.guide.position.x - player.position.x, this.guide.position.z - player.position.z);
      player.rotation.y = this.guide.rotation.y + Math.PI;
      const reach = T.MathUtils.smoothstep(this.elapsed, 0, .35) * (1 - T.MathUtils.smoothstep(this.elapsed, .85, 1.2));
      for (const [actor, side] of [[player, 1], [this.guide, -1]] as const) {
        const arm = actor.getObjectByName('arm' + side)!; arm.rotation.set(0, 0, side * .35 * (1 - reach));
        arm.children[0].position.set(side * .11, .12 * reach, -.015 - .54 * reach);
      }
      this.holdTool(this.elapsed < .6 ? player : this.guide, this.elapsed < .6 ? 1 : -1);
      torso.rotation.x = reduced ? 0 : -.13 * Math.sin(T.MathUtils.smoothstep(this.elapsed, .65, 1.2) * Math.PI);
      animateGuideWalk(this.guide, this.guideGait, 0, dt, reduced);
      if (this.elapsed >= 1.2) { this.releaseGiver(); this.stage = 'walking'; this.elapsed = 0; return 'gardenerFollow'; }
      return;
    }
    let speed = 0;
    if (this.stage === 'walking') {
      const target = this.walkLeg === 0 ? this.walkCorner : destination, delta = target.clone().sub(this.guide.position).setY(0);
      const distance = delta.length();
      if (distance > .01) {
        const yaw = Math.atan2(-delta.x, -delta.z), turn = Math.atan2(Math.sin(yaw - this.guide.rotation.y), Math.cos(yaw - this.guide.rotation.y));
        this.guide.rotation.y += turn * (dt ? 1 - Math.exp(-10 * dt) : 0);
        const travel = Math.min(distance, dt * 1.65 * Math.max(0, Math.cos(turn)));
        this.guide.position.addScaledVector(delta, travel / distance); this.guideGait += travel * 7; speed = dt ? travel / dt : 0;
      } else if (this.walkLeg === 0) this.walkLeg = 1;
      else { this.stage = 'digging'; this.elapsed = 0; return 'gardenerDig'; }
    } else this.guide.rotation.y = -Math.PI / 2;
    animateGuideWalk(this.guide, this.guideGait, speed, dt, reduced);
    const working = this.stage === 'walking' || this.stage === 'digging';
    if (working) {
      const arm = this.guide.getObjectByName('arm-1')!;
      const stroke = this.stage === 'digging' ? Math.sin(this.elapsed * Math.PI * 3 - Math.PI / 2) * .5 + .5 : 0;
      torso.rotation.x = this.stage === 'digging' ? -.22 - .2 * stroke : -.06;
      arm.rotation.x = .25 + stroke * .8; arm.rotation.z = -.1;
      arm.children[0].position.set(-.11, -.08 * stroke, -.16 - .18 * stroke);
      this.holdTool(this.guide, -1);
    }
    if (this.stage === 'digging' && this.elapsed >= 2) {
      this.stage = 'plant'; this.heldTool.visible = false;
      this.guide.getObjectByName('arm-1')!.children[0].position.set(-.11, 0, -.015);
      this.bed.getObjectByName('planting-hole')!.visible = true;
      return 'plantHint';
    }
    if (this.stage === 'planting') {
      const t = this.elapsed, planted = this.bed.localToWorld(this.flower.position.clone());
      const pickup = this.plantFrom.clone().add(new T.Vector3(0, .65 - this.plantFrom.y, .72));
      const stand = planted.clone().add(new T.Vector3(0, .82 - planted.y, 1.1));
      const carry = T.MathUtils.smoothstep(t, 1, 1.9), back = T.MathUtils.smoothstep(t, 2.95, 3.2);
      player.position.lerpVectors(this.pushFrom, pickup, T.MathUtils.smoothstep(t, 0, .35));
      player.position.lerp(stand, carry).lerp(stand.clone().add(new T.Vector3(0, -.17, .55)), back);
      this.pushBody!.setTranslation(player.position, true);
      const delta = stand.clone().sub(pickup), walkYaw = Math.atan2(-delta.x, -delta.z);
      const heading = walkYaw * T.MathUtils.smoothstep(t, .9, 1.15) * (1 - T.MathUtils.smoothstep(t, 1.75, 2));
      const moving = t > 1 && t < 1.9 || t > 2.95 && t < 3.2;
      animateWalk(player, heading, (carry * delta.length() + back * .55) * 8, moving ? 2 : 0, true, reduced, dt);
      const crouch = T.MathUtils.smoothstep(t, .2, .55) * (1 - T.MathUtils.smoothstep(t, .65, 1))
        + T.MathUtils.smoothstep(t, 1.9, 2.25) * (1 - T.MathUtils.smoothstep(t, 2.9, 3.2));
      const avatar = player.getObjectByName('avatar')!;
      avatar.position.y = -.16 * crouch; avatar.rotation.set(-.28 * crouch, 0, 0);
      if (t >= .55 && t < 2.55) {
        if (this.seedling.parent !== player) { player.attach(this.seedling); this.gripFrom.copy(this.seedling.position); }
        this.seedling.position.lerpVectors(this.gripFrom, new T.Vector3(0, -.18, -.65), T.MathUtils.smoothstep(t, .55, 1));
        this.seedling.position.lerp(player.worldToLocal(planted.clone()), T.MathUtils.smoothstep(t, 2, 2.55));
      } else if (t >= 2.55) {
        if (this.seedling.parent === player) this.bed.parent!.attach(this.seedling);
        this.seedling.position.copy(planted); this.seedling.rotation.set(0, 0, 0);
        this.seedling.getObjectByName('rootball')!.visible = false;
      }
      const reach = T.MathUtils.smoothstep(t, .1, .5) * (1 - T.MathUtils.smoothstep(t, 2.95, 3.2));
      this.pushArms.visible = reach > .02;
      for (const side of [-1, 1]) {
        const arm = player.getObjectByName('arm' + side)!; arm.rotation.set(0, 0, side * .35 * (1 - reach));
        player.updateMatrixWorld(true);
        const grip = this.seedling.localToWorld(new T.Vector3(side * .24, .12, 0));
        if (t >= 2.55) grip.y += .10 + Math.abs(Math.sin((t - 2.55) * Math.PI * 5)) * .08;
        arm.children[0].position.set(side * .11, 0, -.015).lerp(arm.worldToLocal(grip), reach);
      }
      this.connectHands(player);
      if (t >= 3.2) {
        this.releasePlayer(); this.seedling.visible = false; this.flower.visible = true;
        this.flower.scale.setScalar(1 / this.bed.scale.x);
        this.stage = 'watering'; this.elapsed = 0; return 'wateringFlowers';
      }
      return;
    }
    this.can.visible = this.drops.visible = this.stage === 'watering';
    if (this.stage === 'watering') {
      const planted = this.bed.localToWorld(this.flower.position.clone());
      this.can.position.copy(this.guide.position).add(new T.Vector3(.55, .4, 0)); this.can.rotation.z = -.35;
      this.drops.children.forEach((drop, i) => {
        const t = (this.elapsed * 1.6 + i / 8) % 1;
        drop.position.lerpVectors(this.can.position.clone().add(new T.Vector3(.35, 0, 0)), planted.clone().setY(.3), t);
      });
      const growth = reduced ? 1 : T.MathUtils.smoothstep(this.elapsed, .6, 2.4);
      this.flower.scale.setScalar((1 + .2 * growth) / this.bed.scale.x);
      this.flower.getObjectByName('petals')!.scale.setScalar(.01 + .99 * growth);
      this.flower.getObjectByName('bud')!.scale.setScalar(1 - .99 * growth);
      if (this.elapsed >= (reduced ? .8 : 2.8)) {
        this.stage = 'grown'; this.can.visible = this.drops.visible = false;
        this.bed.getObjectByName('planting-hole')!.visible = false; return 'gardenerThanks';
      }
    }
  }
}
