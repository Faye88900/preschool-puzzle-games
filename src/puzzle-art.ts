import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, orb } from './models';

export const rounded = (w: number, h: number, d: number, radius = .08) => new RoundedBoxGeometry(w, h, d, 2, radius);

export const elbowCurve = new T.CatmullRomCurve3([
  new T.Vector3(-2, 0, 0), new T.Vector3(-.65, 0, 0), new T.Vector3(0, 0, -.65), new T.Vector3(0, 0, -2),
]);

// Scrolling ripples and beads make flow readable through the transparent shell.
export function waterPipe(curve: T.Curve<T.Vector3>) {
  const root = new T.Group();
  const shell = new T.Mesh(new T.TubeGeometry(curve, 28, .36, 12, false), new T.MeshStandardMaterial({
    color: '#128bd6', roughness: .24, transparent: true, opacity: .48, depthWrite: false,
  }));
  root.add(shell);
  const water = new T.Group(); water.name = 'flow'; root.add(water);
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#269ecb'; ctx.fillRect(0, 0, 256, 128);
  for (let i = -1; i < 5; i++) {
    ctx.beginPath();
    for (let y = 0; y <= 128; y++) {
      const x = i * 64 + Math.sin(y / 128 * Math.PI * 2) * 12;
      if (y === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#63d7ed'; ctx.lineWidth = 14; ctx.stroke();
    ctx.strokeStyle = '#c9f7ff'; ctx.lineWidth = 3; ctx.stroke();
  }
  const ripples = new T.CanvasTexture(canvas);
  ripples.colorSpace = T.SRGBColorSpace;
  ripples.wrapS = ripples.wrapT = T.RepeatWrapping;
  water.add(new T.Mesh(new T.TubeGeometry(curve, 28, .24, 10, false), new T.MeshStandardMaterial({
    map: ripples, roughness: .25, emissive: '#67d4ee', emissiveMap: ripples, emissiveIntensity: .25,
  })));
  for (let i = 0; i < 7; i++) {
    const bead = orb('#dcfaff', 0, .1, 0, .1, .07, .1); water.add(bead);
  }
  for (const t of [0, 1]) {
    const rim = part(root, new T.TorusGeometry(.36, .085, 8, 16), '#efc34f');
    rim.material = rim.material.clone();
    rim.name = `mouth-${t}`;
    rim.position.copy(curve.getPoint(t));
    rim.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), curve.getTangent(t).normalize());
  }
  root.userData.curve = curve;
  return root;
}

export function animateWater(root: T.Group, wet: boolean, time: number, reverse = false) {
  const flow = root.getObjectByName('flow')!; flow.visible = wet;
  const curve = root.userData.curve as T.Curve<T.Vector3>;
  const water = flow.children[0] as T.Mesh<T.TubeGeometry, T.MeshStandardMaterial>;
  // Tube UV.x follows the curve; the middle elbow carries water in reverse.
  if (wet) water.material.map!.offset.x = (reverse ? 1 : -1) * (time * .48 % 1);
  if (wet) flow.children.slice(1).forEach((bead, i) => {
    const phase = (time * .48 + i / 7) % 1;
    curve.getPoint(reverse ? 1 - phase : phase, bead.position); bead.position.y += .13;
  });
}

function part(parent: T.Object3D, geometry: T.BufferGeometry, color: string, x = 0, y = 0, z = 0) {
  const mesh = new T.Mesh(geometry, mat(color));
  mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh);
  return mesh;
}

function shapeBadge(parent: T.Object3D, sides: number, width: number, height: number) {
  const outline = new T.Shape(), hole = new T.Path();
  for (let i = 0; i < sides; i++) {
    const angle = Math.PI / 2 + i * Math.PI * 2 / sides + (sides === 4 ? Math.PI / 4 : 0);
    const x = Math.cos(angle) * width / 2, y = Math.sin(angle) * height / 2;
    if (i === 0) { outline.moveTo(x, y); hole.moveTo(x * .72, y * .72); }
    else { outline.lineTo(x, y); hole.lineTo(x * .72, y * .72); }
  }
  outline.closePath(); hole.closePath(); outline.holes.push(hole);
  const badge = part(parent, new T.ShapeGeometry(outline), '#fff0cf');
  badge.name = 'shape-badge'; return badge;
}

export function workshopBlock(kind: 'cube' | 'cylinder' | 'triangle' | 'rectangle', color: string) {
  let geometry: T.BufferGeometry;
  if (kind === 'triangle') {
    const shape = new T.Shape();
    shape.moveTo(-.67, -.51); shape.lineTo(.67, -.51); shape.lineTo(0, .51); shape.closePath();
    geometry = new T.ExtrudeGeometry(shape, { depth: 1.02, bevelEnabled: true, bevelThickness: .04, bevelSize: .04, bevelSegments: 2, steps: 1 });
    geometry.translate(0, 0, -.51);
  } else geometry = kind === 'cylinder' ? new T.CylinderGeometry(.62, .62, 1.2, 24)
    : kind === 'cube' ? rounded(1.3, 1.3, 1.3, .09) : rounded(1.9, .9, 1.1, .08);
  const root = new T.Mesh(geometry, mat(color)); root.name = `workshop-${kind}`;
  if (kind === 'cube' || kind === 'rectangle') {
    const w = kind === 'cube' ? 1.3 : 1.9, h = kind === 'cube' ? 1.3 : .9, d = kind === 'cube' ? 1.3 : 1.1;
    for (const side of [-1, 1]) {
      part(root, rounded(w - .24, h - .24, .018, .008), '#dbb886', 0, 0, side * (d / 2 + .002));
      const badge = shapeBadge(root, 4, (w - .42) * 1.4, (h - .42) * 1.4);
      badge.position.z = side * (d / 2 + .014); badge.rotation.y = side < 0 ? Math.PI : 0;
      part(root, rounded(.018, h - .24, d - .24, .008), '#dbb886', side * (w / 2 + .002));
    }
    const top = shapeBadge(root, 4, (w - .32) * 1.4, (d - .32) * 1.4);
    top.rotation.x = -Math.PI / 2; top.position.y = h / 2 + .003;
  } else if (kind === 'cylinder') {
    part(root, new T.CylinderGeometry(.49, .49, .018, 24), '#dbb886', 0, .604);
    const top = shapeBadge(root, 32, .79, .79); top.rotation.x = -Math.PI / 2; top.position.y = .616;
    for (const side of [-1, 1]) {
      const badge = shapeBadge(root, 32, .73, .73);
      badge.position.z = side * .624; badge.rotation.y = side < 0 ? Math.PI : 0;
    }
  } else {
    for (const side of [-1, 1]) {
      const badge = shapeBadge(root, 3, 1.1, 1.1);
      badge.position.set(0, -.14, side * .553); badge.rotation.y = side < 0 ? Math.PI : 0;
    }
  }
  root.traverse(node => { if (node instanceof T.Mesh) node.castShadow = node.receiveShadow = true; });
  return root;
}

export function workshopPressurePlate() {
  const base = new T.Group(); base.name = 'workshop-plate-base';
  part(base, rounded(2.8, .26, 2.8), '#dbb886', 0, .13);
  part(base, rounded(2.35, .08, 2.35, .03), '#685b48', 0, .265);
  for (const x of [-1.19, 1.19]) for (const z of [-1.19, 1.19])
    part(base, rounded(.42, .41, .42), '#438f86', x, .205, z);
  const indicator = part(base, rounded(.85, .07, .018, .008), '#557c70', 0, .15, 1.405);
  indicator.name = 'plate-indicator';
  const top = new T.Mesh(rounded(2.1, .14, 2.1, .04), mat('#ffd15a'));
  top.castShadow = top.receiveShadow = true;
  const badge = shapeBadge(top, 4, 2.02, 2.02); badge.rotation.x = -Math.PI / 2; badge.position.y = .074;
  return { base, top, indicator };
}

export function workshopGate(width: number) {
  const frame = new T.Group(), panel = new T.Group(); frame.name = 'workshop-gate-frame';
  for (const x of [-width / 2, width / 2]) {
    part(frame, rounded(.6, 3.65, .6), '#dbb886', x, 1.825);
    part(frame, rounded(.74, .68, .72), '#dfad44', x, 3.4);
    const badge = shapeBadge(frame, 4, .65, .65); badge.position.set(x, 3.4, .367);
  }
  part(frame, rounded(width - .6, .3, .5), '#dbb886', 0, 3.8);
  for (const y of [.24, 2.84]) part(panel, rounded(width - .6, .22, .24), '#438f86', 0, y);
  for (let x = -width / 2 + .7; x < width / 2 - .5; x += .72)
    part(panel, rounded(.15, 2.6, .18, .055), '#438f86', x, 1.54);
  return { frame, panel };
}

export function gardenFlower(symbol?: number) {
  const root = new T.Group();
  part(root, new T.CylinderGeometry(.12, .16, .75, 10), '#518345', 0, .65);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2, leaf = orb('#609747', Math.cos(a) * .48, .38, Math.sin(a) * .48, .6, .13, .3);
    leaf.rotation.y = -a; leaf.castShadow = true; root.add(leaf);
  }
  const petals = new T.Group(); petals.name = 'petals'; root.add(petals);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3, petal = orb('#b5b8b2', Math.cos(a) * .65, 1.05, Math.sin(a) * .65, .52, .22, .37);
    petal.rotation.y = -a; petal.castShadow = true; petals.add(petal);
  }
  const center = part(root, new T.CylinderGeometry(.47, .5, .18, 24), '#fff4ca', 0, 1.24);
  center.name = 'flower-center';
  if (symbol === 0 || symbol === 2) {
    const shape = new T.Shape(), count = symbol === 0 ? 10 : 3;
    for (let i = 0; i < count; i++) {
      const a = Math.PI / 2 + i * Math.PI * 2 / count, r = symbol === 0 && i % 2 ? .22 : .46;
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    const icon = part(root, new T.ExtrudeGeometry(shape, { depth: .1, bevelEnabled: true, bevelSize: .035, bevelThickness: .025, bevelSegments: 2, steps: 1 }), '#6d746d', 0, 1.36);
    icon.rotation.x = -Math.PI / 2; icon.name = 'flower-symbol';
  } else if (symbol === 1) {
    const icon = part(root, new T.CylinderGeometry(.34, .34, .13, 24), '#6d746d', 0, 1.4); icon.name = 'flower-symbol';
  }
  return root;
}

export function pondFlower() {
  const root = new T.Group(); root.name = 'water-flower';
  part(root, new T.CylinderGeometry(.18, .23, .94, 16), '#528d38', 0, .61);
  const leaves = new T.Group(); leaves.name = 'leaves'; root.add(leaves);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const leaf = orb(i % 2 ? '#6fa943' : '#609b39', Math.cos(a) * .57, .28, Math.sin(a) * .57, .64, .23, .46);
    leaf.rotation.y = -a; leaf.castShadow = leaf.receiveShadow = true; leaves.add(leaf);
  }
  const petals = new T.Group(); petals.name = 'petals'; root.add(petals);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const petal = orb('#fff5de', Math.cos(a) * .65, 1.10, Math.sin(a) * .65, .59, .23, .45);
    petal.rotation.set(0, -a, 0, 'YXZ'); petal.castShadow = petal.receiveShadow = true;
    const inset = orb('#f6d979', .12, .84, 0, .65, .18, .62);
    petal.add(inset); petals.add(petal);
  }
  const center = orb('#edbf43', 0, 1.22, 0, .48, .11, .48);
  center.name = 'flower-center'; center.castShadow = center.receiveShadow = true; root.add(center);
  return root;
}

export function colorFlower(root: T.Group, color: string, active: boolean) {
  if (root.name === 'water-flower') {
    const open = active ? T.MathUtils.clamp((root.scale.y - .72) / .83, 0, 1) : 0;
    root.getObjectByName('petals')!.children.forEach(petal => {
      petal.rotation.z = -.65 * (1 - open);
      petal.position.y = .93 + .17 * open;
    });
    return;
  }
  root.getObjectByName('petals')!.children.forEach(petal => (petal as T.Mesh).material = mat(active ? color : '#b5b8b2'));
  const icon = root.getObjectByName('flower-symbol') as T.Mesh | undefined;
  if (icon) icon.material = mat(active ? color : '#6d746d');
}

export function gateMesh(width: number, color: string, arched: boolean) {
  const root = new T.Group(), half = width / 2;
  for (const side of [-1, 1]) {
    const leaf = new T.Group(); leaf.name = side === -1 ? 'left-leaf' : 'right-leaf'; leaf.position.x = side * half; root.add(leaf);
    const points: T.Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const x = i / 12 * half, height = arched ? 3.3 + Math.sin(i / 12 * Math.PI / 2) * 1.05 : 2.8;
      points.push(new T.Vector3(-side * x, height, 0));
    }
    part(leaf, new T.TubeGeometry(new T.CatmullRomCurve3(points), 24, .1, 8, false), color);
    for (let dx = .2; dx < half; dx += .45) {
      const height = arched ? 3.3 + Math.sin(dx / half * Math.PI / 2) * 1.05 : 2.8;
      part(leaf, new T.CylinderGeometry(.065, .065, height - .2, 8), color, -side * dx, (height + .2) / 2);
      if (!arched) part(leaf, new T.SphereGeometry(.11, 8, 6), color, -side * dx, 2.95);
    }
    for (const y of [.35, 1.05]) part(leaf, new T.BoxGeometry(half, .13, .18), color, -side * half / 2, y);
    part(leaf, new T.CylinderGeometry(.11, .11, arched ? 4.4 : 3, 10), color, -side * half, arched ? 2.2 : 1.5);
    if (arched) {
      const scroll = part(leaf, new T.TorusGeometry(.5, .065, 8, 24, Math.PI * 1.5), color, -side * half / 2, 2.1);
      scroll.scale.x = .85;
    }
  }
  return root;
}

export function padlock(color: string) {
  const root = new T.Group();
  part(root, new T.TorusGeometry(.29, .085, 8, 20, Math.PI), '#e9b54b', 0, .44);
  part(root, rounded(.85, .8, .32), color);
  part(root, new T.SphereGeometry(.1, 12, 8), '#343e37', 0, .08, .17).scale.z = .3;
  part(root, new T.BoxGeometry(.09, .25, .035), '#343e37', 0, -.08, .18);
  return root;
}

export function lantern() {
  const root = new T.Group();
  part(root, new T.BoxGeometry(.45, .7, .36), '#eeb451');
  const glass = part(root, new T.BoxGeometry(.34, .53, .38), '#ffeaa0');
  glass.material = new T.MeshStandardMaterial({ color: '#ffe7a0', emissive: '#f5b53f', emissiveIntensity: .4, roughness: .5 });
  for (const x of [-.2, .2]) part(root, new T.BoxGeometry(.055, .72, .42), '#6a4b28', x);
  part(root, new T.ConeGeometry(.4, .25, 4), '#806033', 0, .46).rotation.y = Math.PI / 4;
  part(root, new T.BoxGeometry(.52, .09, .44), '#806033', 0, -.38);
  part(root, new T.TorusGeometry(.1, .03, 6, 12), '#806033', 0, .68);
  return root;
}

export function entranceArch() {
  const root = new T.Group(), points: T.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI * i / 24;
    points.push(new T.Vector3(Math.cos(a) * 3.8, 3.4 + Math.sin(a) * 2, 0));
  }
  part(root, new T.TubeGeometry(new T.CatmullRomCurve3(points), 40, .24, 10, false), '#9d6c35');
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI * i / 24, x = Math.cos(a) * 3.8, y = 3.4 + Math.sin(a) * 2;
    const leaf = orb(i % 2 ? '#508647' : '#78a348', x, y, .12, .45, .28, .3);
    leaf.rotation.z = a; leaf.castShadow = true; root.add(leaf);
    if (i % 3 === 1) {
      const blossom = new T.Group(); blossom.position.set(x, y, .4);
      for (let p = 0; p < 5; p++) blossom.add(orb(i % 2 ? '#fff2c7' : '#ee9db8', Math.cos(p * Math.PI * .4) * .16, Math.sin(p * Math.PI * .4) * .16, 0, .13, .13, .07));
      blossom.add(orb('#ebba4d', 0, 0, .07, .08)); root.add(blossom);
    }
  }
  const plaque = part(root, rounded(1.5, .7, .2, .15), '#d3a466', 0, 4.7, .25);
  for (let p = 0; p < 5; p++) plaque.add(orb('#94612c', Math.cos(p * Math.PI * .4) * .16, Math.sin(p * Math.PI * .4) * .16, .12, .11, .11, .025));
  return root;
}

// Reference-style timber coop, front facing +Z; raised floor meets the approach ramp.
export function chickenCoop() {
  const root = new T.Group(); root.name = 'chicken-coop';
  const wood = ['#bd945e', '#caa574', '#d1ae7c', '#c09a67'];
  const board = (w: number, h: number, d: number, x: number, y: number, z: number, color = wood[1]) =>
    part(root, new T.BoxGeometry(w, h, d), color, x, y, z);
  for (const x of [-2.7, 2.7]) for (const z of [-2.15, 2.15]) board(.3, .85, .3, x, .425, z, wood[0]);
  board(6, .18, 5, 0, .46, 0, '#98734b');
  for (const x of [-3, 3]) {
    for (let i = 0; i < 12; i++) board(.16, 2.65, .4, x, 1.875, -2.3 + i * .42, wood[i % 4]);
    for (const y of [.7, 2.95]) board(.23, .16, 5.15, x, y, 0);
  }
  for (const z of [-2.5, 2.5]) {
    for (let i = 0; i < 14; i++) {
      const x = -2.785 + i * .4285, top = 5.4 - Math.abs(x) * .733;
      const bottom = z > 0 && Math.abs(x) < .65 ? 1.55 : .55;
      board(.415, top - bottom, .18, x, (top + bottom) / 2, z, wood[i % 4]);
    }
  }
  // A rounded pop-hole is cut into the little front door, rather than painted on it.
  const front = new T.Shape(); front.moveTo(-.66, .55); front.lineTo(-.66, 3.65);
  front.lineTo(.66, 3.65); front.lineTo(.66, .55); front.lineTo(.44, .55);
  front.lineTo(.44, 1.15); front.absarc(0, 1.15, .44, 0, Math.PI, false);
  front.lineTo(-.44, .55); front.closePath();
  part(root, new T.ExtrudeGeometry(front, { depth: .12, bevelEnabled: false }), '#c6a16c', 0, 0, 2.61);
  for (const y of [1.85, 2.45, 3.2]) board(1.32, .09, .16, 0, y, 2.73, wood[0]);
  for (const x of [-.75, .75]) board(.16, 3.15, .22, x, 2.1, 2.64);
  for (const x of [-1.8, 1.8]) board(1.7, .19, .22, x, 1.5, 2.64);
  const slope = Math.atan2(2.5, 3.4), roofLength = Math.hypot(3.4, 2.5);
  for (const side of [-1, 1]) {
    const roof = board(roofLength, .16, 5.8, side * 1.7, 4.15, 0, wood[1]); roof.rotation.z = -side * slope;
    for (let i = 0; i <= 9; i++) {
      const t = i / 9;
      board(.045, .045, 5.82, side * 3.4 * t, 5.51 - 2.5 * t, 0, wood[0]);
    }
    for (const z of [-2.94, 2.94]) {
      const trim = board(roofLength + .15, .2, .17, side * 1.7, 4.22, z, '#dfbc85'); trim.rotation.z = -side * slope;
    }
    for (const z of [-1.5, 1.3]) {
      const hinge = board(.55, .035, .18, side * 1.1, 4.73, z, '#88938d'); hinge.rotation.z = -side * slope;
    }
  }
  board(.3, .22, 6, 0, 5.5, 0, '#dcbc86');
  board(.48, .09, .08, -.35, 2.65, 2.85, '#8c9791');
  const ramp = board(.95, .12, 2.15, 0, .28, 3.5); ramp.rotation.x = .255;
  for (let i = 0; i < 6; i++) {
    const z = 2.55 + i * .37;
    const tread = board(1, .075, .12, 0, .57 - (z - 2.5) * .26, z, '#e0bd85'); tread.rotation.x = .255;
  }
  return root;
}
