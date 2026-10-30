import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rounded } from './puzzle-art';
import { createSailCrystal } from './sail-crystal';

const wood = new T.MeshStandardMaterial({ color: '#aa7149', roughness: .65 });
const lightWood = new T.MeshStandardMaterial({ color: '#c8915a', roughness: .6 });
const dark = new T.MeshStandardMaterial({ color: '#593e32', roughness: .8 });
const gold = new T.MeshStandardMaterial({ color: '#e6bf70', roughness: .35, metalness: .48 });
const green = new T.MeshStandardMaterial({ color: '#527d69', roughness: .72 });
const ivory = new T.MeshStandardMaterial({ color: '#fff0c6', roughness: .45 });
const box = rounded(1, 1, 1, .06);

export function createTreasureChest(): T.Group {
  const root = new T.Group(); root.name = 'garden-treasure-chest';
  const body = new T.Group(); body.name = 'chest-body'; root.add(body);
  const lid = new T.Group(); lid.name = 'lid'; lid.position.set(0, .91, .59); root.add(lid);
  const add = (parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material,
    x: number, y: number, z: number, sx = 1, sy = sx, sz = sx) => {
    const mesh = new T.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
    parent.add(mesh); return mesh;
  };
  const plank = (parent: T.Object3D, material: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) =>
    add(parent, box, material, x, y, z, w, h, d);
  // Four walls and a lined floor keep the opened chest visibly hollow.
  plank(body, dark, 0, .19, 0, 1.8, .2, 1.18);
  plank(body, green, 0, .3, 0, 1.55, .035, .95);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      plank(body, i % 2 ? wood : lightWood, 0, .39 + i * .2, side * .55, 1.8, .19, .12);
      plank(body, i % 2 ? lightWood : wood, side * .85, .39 + i * .2, 0, .12, .19, 1);
    }
    plank(body, gold, 0, .88, side * .55, 1.88, .09, .14);
    plank(body, gold, side * .86, .88, 0, .14, .09, 1.1);
    for (const x of [-.68, .68]) {
      plank(body, gold, x, .57, side * .627, .13, .61, .045);
      plank(body, dark, x, .095, side * .41, .22, .19, .23);
      for (const y of [.34, .77]) add(body, new T.SphereGeometry(.035, 8, 5), ivory, x, y, side * .655);
    }
    const handle = add(body, new T.TorusGeometry(.16, .035, 6, 12, Math.PI), gold, side * .939, .56, 0);
    handle.rotation.set(0, Math.PI / 2, Math.PI);
  }
  // Half-cylinder sections make a curved lid with a real rear hinge.
  for (let i = 0; i < 9; i++) {
    const cap = add(lid, new T.CylinderGeometry(.59, .59, .194, 16, 1, false, 0, Math.PI),
      i % 2 ? wood : lightWood, -.8 + i * .2, 0, -.59);
    cap.rotation.z = Math.PI / 2;
  }
  plank(lid, green, 0, -.015, -.59, 1.7, .045, 1.02);
  for (const x of [-.68, .68]) {
    const band = add(lid, new T.TorusGeometry(.606, .045, 6, 20, Math.PI), gold, x, 0, -.59);
    band.rotation.y = Math.PI / 2;
    const hinge = add(body, new T.CylinderGeometry(.07, .07, .26, 10), gold, x, .91, .6);
    hinge.rotation.z = Math.PI / 2;
  }
  for (const z of [-1.19, .01]) plank(lid, gold, 0, .015, z, 1.9, .075, .07);
  const clasp = plank(lid, gold, 0, -.10, -1.235, .36, .4, .085);
  clasp.rotation.z = Math.PI / 4;
  const seal = add(lid, new T.SphereGeometry(1, 12, 8), green, 0, -.10, -1.295, .115, .16, .035);
  seal.rotation.z = -.35;
  plank(lid, ivory, 0, -.10, -1.333, .016, .19, .014).rotation.z = -.35;
  for (const side of [-1, 1]) {
    const curl = add(lid, new T.TorusGeometry(.18, .018, 5, 16, Math.PI * 1.25), gold, side * .39, .22, -1.14);
    curl.rotation.y = side * .18; curl.rotation.z = side < 0 ? Math.PI : 0;
  }
  for (const group of [body, lid]) {
    group.updateMatrix();
    const batches = new Map<T.Material, T.BufferGeometry[]>();
    for (const node of group.children) {
      const mesh = node as T.Mesh; mesh.updateMatrix();
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrix); geometry.deleteAttribute('uv');
      if (!batches.has(mesh.material as T.Material)) batches.set(mesh.material as T.Material, []);
      batches.get(mesh.material as T.Material)!.push(geometry);
    }
    group.clear();
    for (const [material, geometries] of batches) {
      const mesh = new T.Mesh(mergeGeometries(geometries)!, material); mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh); geometries.forEach(g => g.dispose());
    }
  }
  const reward = createSailCrystal(); reward.name = 'chest-crystal'; reward.visible = false; root.add(reward);
  const glow = new T.Mesh(new T.RingGeometry(.23, .76, 32), new T.MeshBasicMaterial({
    color: '#a5f5dc', transparent: true, opacity: .3, side: T.DoubleSide, depthWrite: false,
  }));
  glow.name = 'chest-reward-glow'; glow.rotation.x = -Math.PI / 2; glow.position.y = .93; glow.visible = false; root.add(glow);
  return root;
}

export function animateTreasureChest(root: T.Group, opened: boolean, dt: number, time: number, reducedMotion: boolean) {
  const lid = root.getObjectByName('lid')!, crystal = root.getObjectByName('chest-crystal')!;
  const glow = root.getObjectByName('chest-reward-glow')!;
  const target = opened ? 1.65 : 0;
  lid.rotation.x = reducedMotion || !dt ? target : T.MathUtils.lerp(lid.rotation.x, target, 1 - Math.exp(-dt * 5));
  const reveal = T.MathUtils.smoothstep(lid.rotation.x, .65, 1.65);
  crystal.visible = glow.visible = opened && reveal > 0;
  crystal.position.y = .45 + reveal * 1.05 + (reducedMotion ? 0 : Math.sin(time * 2) * .06 * reveal);
  crystal.rotation.y = reducedMotion ? .35 : time * .45;
  crystal.scale.setScalar(.65 + reveal * .2);
  glow.scale.setScalar(.6 + reveal * .6);
}
