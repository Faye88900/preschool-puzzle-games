import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, orb } from './models';

export const rounded = (w: number, h: number, d: number, radius = .08) => new RoundedBoxGeometry(w, h, d, 2, radius);

export const elbowCurve = new T.CatmullRomCurve3([
  new T.Vector3(-2, 0, 0), new T.Vector3(-.65, 0, 0), new T.Vector3(0, 0, -.65), new T.Vector3(0, 0, -2),
]);

// Small moving beads make direction readable without a fluid simulation.
export function waterPipe(curve: T.Curve<T.Vector3>) {
  const root = new T.Group();
  const shell = new T.Mesh(new T.TubeGeometry(curve, 28, .36, 12, false), new T.MeshStandardMaterial({
    color: '#128bd6', roughness: .24, transparent: true, opacity: .72, depthWrite: false,
  }));
  root.add(shell);
  const water = new T.Group(); water.name = 'flow'; root.add(water);
  water.add(new T.Mesh(new T.TubeGeometry(curve, 28, .24, 10, false), mat('#45b6db')));
  for (let i = 0; i < 7; i++) {
    const bead = orb('#dcfaff', 0, .1, 0, .1, .07, .1); water.add(bead);
  }
  for (const t of [0, 1]) {
    const rim = part(root, new T.TorusGeometry(.36, .085, 8, 16), '#efc34f');
    rim.position.copy(curve.getPoint(t));
    rim.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), curve.getTangent(t).normalize());
  }
  root.userData.curve = curve;
  return root;
}

export function animateWater(root: T.Group, wet: boolean, time: number) {
  const flow = root.getObjectByName('flow')!; flow.visible = wet;
  const curve = root.userData.curve as T.Curve<T.Vector3>;
  if (wet) flow.children.slice(1).forEach((bead, i) => {
    curve.getPoint((time * .48 + i / 7) % 1, bead.position); bead.position.y += .13;
  });
}

function part(parent: T.Object3D, geometry: T.BufferGeometry, color: string, x = 0, y = 0, z = 0) {
  const mesh = new T.Mesh(geometry, mat(color));
  mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh);
  return mesh;
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

export function colorFlower(root: T.Group, color: string, active: boolean) {
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
