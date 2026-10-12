import * as T from 'three';
import { createPlayerCharacter, type Expression } from './character';

export type GuidePose = 'idle' | 'point' | 'nod';
const skin = new T.MeshStandardMaterial({ color: '#afe1be', roughness: .65 });
const boots = new T.MeshStandardMaterial({ color: '#285862', roughness: .6 });
const yellow = new T.MeshStandardMaterial({ color: '#ffd029', roughness: .32 });
const band = new T.MeshStandardMaterial({ color: '#65746c', roughness: .8 });
const faces = new Map<Expression, T.Material>();

export function setGuideExpression(root: T.Group, expression: Expression) {
  if (root.userData.expression === expression) return;
  if (!faces.has(expression)) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 768;
    const c = canvas.getContext('2d')!;
    const oval = (x: number, y: number, rx: number, ry: number, color: string) => {
      c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
    };
    for (const x of [215, 809]) oval(x, 454, 82, 43, '#f0b69e');
    for (const x of [360, 664]) {
      if (expression === 'happy') {
        c.strokeStyle = '#332337'; c.lineWidth = 22; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x - 48, 336); c.quadraticCurveTo(x, 250, x + 48, 336); c.stroke();
      } else {
        oval(x, 310, 60, 100, '#332337'); oval(x - 13, 266, 18, 26, '#fffdf8');
      }
    }
    c.fillStyle = '#5a2529'; c.beginPath();
    if (expression === 'surprised') c.ellipse(512, 479, 36, 46, 0, 0, Math.PI * 2);
    else { c.moveTo(458, 449); c.quadraticCurveTo(512, 471, 566, 449); c.bezierCurveTo(570, 553, 454, 553, 458, 449); }
    c.fill();
    if (expression !== 'surprised') oval(512, 517, 33, 15, '#e98d77');
    const map = new T.CanvasTexture(canvas); map.colorSpace = T.SRGBColorSpace;
    faces.set(expression, new T.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: .65, polygonOffset: true, polygonOffsetFactor: -1 }));
  }
  (root.getObjectByName('face') as T.Mesh).material = faces.get(expression)!;
  root.userData.expression = expression;
}

export function createWorkshopGuide() {
  const root = createPlayerCharacter(); root.name = 'workshop-guide';
  root.remove(root.getObjectByName('player-marker')!);
  const avatar = root.getObjectByName('avatar')!;
  const torso = new T.Group(); torso.name = 'guide-torso'; avatar.add(torso);
  for (const name of ['body', 'face', 'arm-1', 'arm1']) torso.add(root.getObjectByName(name)!);
  (root.getObjectByName('body') as T.Mesh).material = skin;
  for (const side of [-1, 1]) {
    avatar.remove(root.getObjectByName('ear' + side)!);
    const arm = root.getObjectByName('arm' + side)!;
    const hand = arm.children[0] as T.Mesh; hand.material = skin; hand.scale.set(.17, .22, .17);
    (root.getObjectByName('foot' + side) as T.Mesh).material = boots;
  }
  const helmet = new T.Group(); helmet.name = 'hard-hat'; torso.add(helmet);
  const part = (name: string, geometry: T.BufferGeometry, material: T.Material, position: number[], scale = [1, 1, 1]) => {
    const mesh = new T.Mesh(geometry, material); mesh.name = name; mesh.position.fromArray(position); mesh.scale.fromArray(scale);
    mesh.castShadow = true; helmet.add(mesh); return mesh;
  };
  part('helmet-shell', new T.SphereGeometry(1, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), yellow, [0, .34, 0], [.63, .43, .60]);
  const rim = part('helmet-rim', new T.TorusGeometry(.63, .035, 8, 64), yellow, [0, .34, 0]);
  rim.rotation.x = Math.PI / 2; rim.scale.y = .96;
  part('helmet-brim', new T.SphereGeometry(1, 40, 12), yellow, [0, .335, -.49], [.54, .035, .30]);
  // Curved ribs follow the shell rather than cutting through the dome as straight bars.
  for (const x of [-.40, 0, .40]) {
    const arc = Math.sqrt(1 - (x / .63) ** 2), shape = new T.Shape();
    for (let i = 0; i <= 32; i++) {
      const a = i / 32 * Math.PI, z = Math.cos(a) * .605 * arc, y = Math.sin(a) * (.43 * arc + .042);
      if (i === 0) shape.moveTo(z, y); else shape.lineTo(z, y);
    }
    for (let i = 32; i >= 0; i--) {
      const a = i / 32 * Math.PI; shape.lineTo(Math.cos(a) * .60 * arc, Math.sin(a) * .425 * arc);
    }
    shape.closePath();
    const width = x === 0 ? .10 : .035;
    const rib = part(x === 0 ? 'helmet-center-ridge' : 'helmet-side-rib' + x,
      new T.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .006, bevelThickness: .006 }), yellow, [x - width / 2, .34, 0]);
    rib.rotation.y = Math.PI / 2;
  }
  part('helmet-adjustment-band', new T.SphereGeometry(1, 24, 12), band, [0, .28, .52], [.22, .055, .035]);
  for (const x of [-.14, -.047, .047, .14]) part('helmet-band-stud', new T.SphereGeometry(.018, 10, 8), band, [x, .28, .557]);
  setGuideExpression(root, 'neutral');
  return root;
}

export function animateWorkshopGuide(root: T.Group, pose: GuidePose, elapsed: number, dt: number, reducedMotion: boolean) {
  const torso = root.getObjectByName('guide-torso')!;
  const blend = reducedMotion ? 1 : 1 - Math.exp(-10 * dt);
  // Look first, extend, hold, then release; elapsed is time since this pose began.
  const turn = pose === 'point' ? reducedMotion ? 1 : T.MathUtils.smoothstep(elapsed, 0, .2) * (1 - T.MathUtils.smoothstep(elapsed, 1.9, 2.2)) : 0;
  const reach = pose === 'point' ? reducedMotion ? 1 : T.MathUtils.smoothstep(elapsed, .2, .55) * (1 - T.MathUtils.smoothstep(elapsed, 1.55, 1.9)) : 0;
  torso.rotation.x = T.MathUtils.lerp(torso.rotation.x, pose === 'nod' && !reducedMotion ? -.09 - Math.sin(elapsed * 4) * .09 : 0, blend);
  torso.rotation.y = T.MathUtils.lerp(torso.rotation.y, -.65 * turn, blend);
  torso.rotation.z = T.MathUtils.lerp(torso.rotation.z, -.06 * reach + (reducedMotion ? 0 : Math.sin(elapsed * 1.7) * .025 * (1 - turn)), blend);
  torso.position.y = reducedMotion ? 0 : Math.sin(elapsed * 2) * .008;
  const arm = root.getObjectByName('arm1')!;
  // Rotate the long axis out from the shoulder, leaving a connected, readable silhouette.
  arm.rotation.y = T.MathUtils.lerp(arm.rotation.y, 1.05 * reach, blend);
  arm.rotation.z = T.MathUtils.lerp(arm.rotation.z, -1.45 * reach, blend);
  arm.position.y = T.MathUtils.lerp(arm.position.y, -.13 + .17 * reach, blend);
  const hand = arm.children[0];
  hand.position.x = T.MathUtils.lerp(hand.position.x, .11 * (1 - reach), blend);
  hand.position.y = T.MathUtils.lerp(hand.position.y, .22 * reach, blend);
  hand.scale.x = hand.scale.z = T.MathUtils.lerp(hand.scale.x, .17 - .035 * reach, blend);
  hand.scale.y = T.MathUtils.lerp(hand.scale.y, .22 + .18 * reach, blend);
  root.userData.pose = pose;
}

export function animateGuideWalk(root: T.Group, gait: number, speed: number, dt: number, reduced: boolean) {
  const blend = 1 - Math.exp(-18 * dt);
  const amount = T.MathUtils.clamp(speed / .8, 0, 1);
  for (const side of [-1, 1]) {
    const phase = gait + (side === 1 ? Math.PI : 0);
    const stride = Math.sin(phase), lift = Math.max(0, Math.cos(phase));
    const foot = root.getObjectByName('foot' + side)!;
    // Move the shoe itself: rotating the bean's short, rounded foot alone is barely visible.
    foot.position.z = T.MathUtils.lerp(foot.position.z, -.13 - stride * .24 * amount, blend);
    foot.position.y = T.MathUtils.lerp(foot.position.y, -.535 + lift * .16 * amount, blend);
    foot.rotation.x = T.MathUtils.lerp(foot.rotation.x, -stride * .3 * amount, blend);
    const arm = root.getObjectByName('arm' + side)!;
    arm.rotation.x = T.MathUtils.lerp(arm.rotation.x, stride * .28 * amount, blend);
  }
  const torso = root.getObjectByName('guide-torso')!;
  torso.position.y += reduced ? 0 : (1 - Math.cos(gait * 2)) * .025 * amount;
}
