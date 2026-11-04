import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

let template: T.Group | undefined;

export function createGardenCottage(): T.Group {
  if (template) return template.clone(true);
  const root = new T.Group(); root.name = 'garden-cottage';
  const grain = new Uint8Array(128 * 128 * 4), plaster = new Uint8Array(grain.length);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const i = (y * 128 + x) * 4;
    const g = Math.sin(x * .39 + Math.sin(y * .035) * 2) * 5 + Math.sin(x * .12 + y * .02) * 3;
    const p = Math.sin(x * .53 + y * .77) * 2 + Math.cos(x * .21 - y * .39) * 2;
    grain.set([245 + g, 228 + g, 201 + g, 255], i); plaster.set([248 + p, 245 + p, 234 + p, 255], i);
  }
  const woodMap = new T.DataTexture(grain, 128, 128), plasterMap = new T.DataTexture(plaster, 128, 128);
  for (const map of [woodMap, plasterMap]) { map.colorSpace = T.SRGBColorSpace; map.magFilter = T.LinearFilter; map.needsUpdate = true; }
  const material = (name: string, color: string, map?: T.Texture) => {
    const surface = new T.MeshStandardMaterial({ color, roughness: .87, map }); surface.name = name; return surface;
  };
  const wall = material('cottage-plaster', '#f1e5c9', plasterMap), timber = material('cottage-timber', '#805635', woodMap);
  const honey = material('cottage-oak', '#bd8a4b', woodMap), dark = material('cottage-recess', '#493e30');
  const tiles = [material('cottage-shingles', '#bb873b', woodMap), material('cottage-shingles-light', '#d0a04e', woodMap), material('cottage-shingles-shade', '#ab7836', woodMap)];
  const stone = material('cottage-foundation', '#b5b4a0', plasterMap), lightStone = material('cottage-stone-light', '#cdc9b4', plasterMap);
  const glass = material('cottage-window', '#6f9fa6'), iron = material('cottage-iron', '#5b6255');
  glass.roughness = .36; iron.metalness = .35; iron.roughness = .6;
  const leaf = material('cottage-sage', '#7d9550'), flower = material('cottage-petals', '#edbc8f');
  const add = (geometry: T.BufferGeometry, surface: T.Material, x: number, y: number, z: number, parent: T.Object3D = root) => {
    const mesh = new T.Mesh(geometry, surface); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  const box = (w: number, h: number, d: number, surface: T.Material, x: number, y: number, z: number, parent: T.Object3D = root) =>
    add(new RoundedBoxGeometry(w, h, d, 1, Math.min(.035, w / 5, h / 5, d / 5)), surface, x, y, z, parent);
  const beam = (a: number[], b: number[], width: number, depth: number, surface = timber) => {
    const start = new T.Vector3(...a), end = new T.Vector3(...b), direction = end.clone().sub(start);
    const mesh = box(width, direction.length(), depth, surface, ...start.add(end).multiplyScalar(.5).toArray() as [number, number, number]);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize()); return mesh;
  };
  const panel = (shape: T.Shape, depth: number) => new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .018, bevelThickness: .018, bevelSegments: 1, curveSegments: 16, steps: 1 });

  box(5.15, 4.3, 5.32, wall, 0, 2.5, 0);
  box(5.44, .24, 5.5, dark, 0, .17, 0);
  for (let row = 0; row < 2; row++) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        box(.76, .22, .24, (i + row) % 3 ? stone : lightStone, -2.32 + i * .77, .11 + row * .24, side * 2.66);
        box(.24, .22, .76, (i + row) % 3 ? lightStone : stone, side * 2.53, .11 + row * .24, -2.32 + i * .77);
      }
    }
  }
  for (const x of [-2.47, 2.47]) for (const z of [-2.65, 2.65]) box(.23, 4.35, .23, timber, x, 2.47, z);
  for (const y of [.58, 3.17, 4.54]) {
    for (const z of [-2.69, 2.69]) box(5.17, .18, .16, timber, 0, y, z);
    for (const x of [-2.59, 2.59]) box(.16, .18, 5.32, timber, x, y, 0);
  }
  for (const side of [-1, 1]) {
    box(.16, 3.82, .16, timber, side * 2.61, 2.53, 0);
    for (const z of [-2.25, .35]) beam([side * 2.61, 3.35, z], [side * 2.61, 4.40, z + 1.1], .13, .12);
  }
  const gable = new T.Shape(); gable.moveTo(-2.57, 4.59); gable.lineTo(2.57, 4.59); gable.lineTo(0, 6.51); gable.closePath();
  for (const z of [-2.65, 2.59]) {
    add(panel(gable, .06), wall, 0, 0, z);
    for (const side of [-1, 1]) beam([side * 2.58, 4.62, z + .06], [0, 6.58, z + .06], .18, .17);
    beam([0, 4.64, z + .06], [0, 6.55, z + .06], .16, .16);
  }

  const front = new T.Group(); front.name = 'cottage-front'; root.add(front);
  front.position.z = 2.66;
  const arch = (half: number, bottom: number, spring: number) => {
    const shape = new T.Shape(); shape.moveTo(-half, bottom); shape.lineTo(half, bottom); shape.lineTo(half, spring);
    shape.absarc(0, spring, half, 0, Math.PI, false); shape.lineTo(-half, bottom); return shape;
  };
  add(panel(arch(.88, .29, 1.98), .045), dark, 0, 0, .018, front);
  const door = arch(.70, .37, 1.98); add(panel(door, .04), honey, 0, 0, .072, front);
  for (let i = -3; i <= 3; i++) {
    const x = i * .185, top = 1.98 + Math.sqrt(Math.max(0, .70 ** 2 - x * x));
    box(.013, top - .4, .012, timber, x, (top + .4) / 2, .122, front);
  }
  const frame = new T.Shape(); frame.moveTo(-.88, .3); frame.lineTo(-.88, 1.98);
  frame.absarc(0, 1.98, .88, Math.PI, 0, true); frame.lineTo(.88, .3); frame.lineTo(.72, .3); frame.lineTo(.72, 1.98);
  frame.absarc(0, 1.98, .72, 0, Math.PI, false); frame.lineTo(-.72, .3); frame.closePath();
  add(panel(frame, .12), timber, 0, 0, .09, front);
  for (const y of [.92, 1.86]) {
    box(.37, .085, .05, iron, -.45, y, .16, front);
    for (const x of [-.57, -.32]) add(new T.SphereGeometry(.025, 8, 6), honey, x, y, .196, front);
  }
  add(new T.TorusGeometry(.085, .022, 8, 20), iron, .42, 1.26, .20, front);
  box(1.92, .14, .26, lightStone, 0, .21, .12, front);

  const window = (parent: T.Object3D, x: number, y: number) => {
    box(1.13, 1.11, .055, dark, x, y, .018, parent);
    box(.92, .89, .035, glass, x, y, .052, parent);
    for (const dx of [-.53, .53]) box(.11, 1.1, .13, honey, x + dx, y, .09, parent);
    for (const dy of [-.5, .5]) box(1.13, .11, .13, honey, x, y + dy, .09, parent);
    box(.052, .92, .08, wall, x, y, .11, parent); box(.99, .052, .08, wall, x, y, .11, parent);
    box(1.34, .14, .38, lightStone, x, y - .62, .10, parent);
    for (const dx of [-.75, .75]) {
      box(.25, 1.04, .10, leaf, x + dx, y, .06, parent);
      for (const dy of [-.33, -.11, .11, .33]) box(.21, .035, .035, timber, x + dx, y + dy, .125, parent);
    }
    const reflection = box(.055, .26, .008, wall, x - .26, y + .22, .074, parent); reflection.rotation.z = -.32;
  };
  for (const x of [-1.63, 1.63]) window(front, x, 4.02);
  for (const side of [-1, 1]) {
    const flank = new T.Group(); flank.position.set(side * 2.58, 0, 0); flank.rotation.y = side * Math.PI / 2; root.add(flank);
    for (const x of [-1.32, 1.32]) window(flank, x, 2.26);
  }
  const vent = add(new T.CylinderGeometry(.34, .34, .055, 24), dark, 0, 5.49, 2.74); vent.rotation.x = Math.PI / 2;
  add(new T.TorusGeometry(.36, .065, 8, 32), honey, 0, 5.49, 2.79);
  for (const x of [-.21, -.07, .07, .21]) box(.055, 2 * Math.sqrt(.30 ** 2 - x * x), .05, honey, x, 5.49, 2.80);

  const pitch = Math.atan2(2.07, 2.85), slope = Math.hypot(2.07, 2.85);
  const shingle = new RoundedBoxGeometry(slope / 6 + .12, .085, .58, 1, .027);
  for (const side of [-1, 1]) {
    box(slope + .1, .14, 5.83, timber, side * 1.425, 5.685, 0).rotation.z = -side * pitch;
    for (let row = 0; row < 6; row++) for (let column = 0; column < 10; column++) {
      const t = (row + .5) / 6, z = -2.60 + column * .578 + (row % 2 ? .055 : -.055);
      const tile = add(shingle, tiles[(row * 7 + column * 3 + (column % 3)) % 3], side * 2.85 * t, 6.81 - 2.07 * t, z);
      tile.rotation.z = -side * pitch;
    }
    for (const z of [-2.86, 2.86]) beam([side * 2.92, 4.70, z], [0, 6.81, z], .17, .18, honey);
    box(.18, .22, 5.86, timber, side * 2.87, 4.64, 0);
    for (const z of [-2.23, -.74, .74, 2.23]) beam([side * 2.5, 4.16, z], [side * 2.87, 4.6, z], .12, .12, honey);
  }
  for (let i = 0; i < 10; i++) box(.28, .18, .60, i % 3 ? tiles[0] : tiles[1], 0, 6.88, -2.60 + i * .578);
  box(.79, 1.21, .76, stone, -1.42, 6.26, -1.34);
  for (const y of [5.82, 6.15, 6.48]) {
    box(.80, .035, .78, lightStone, -1.42, y, -1.34);
    box(.04, .27, .015, lightStone, -1.42 + (y < 6 ? .13 : -.12), y + .14, -.952);
  }
  box(.98, .17, .94, lightStone, -1.42, 6.94, -1.34);
  box(.61, .025, .57, dark, -1.42, 7.038, -1.34);

  const leafShape = new T.Shape(); leafShape.moveTo(0, 0); leafShape.bezierCurveTo(-.13, .14, -.12, .35, 0, .42); leafShape.bezierCurveTo(.15, .3, .14, .09, 0, 0);
  const leafGeometry = panel(leafShape, .025), bloom = new T.SphereGeometry(.065, 8, 6);
  for (const side of [-1, 1]) {
    const pot = box(1.30, .26, .40, honey, side * 1.65, 1.42, side * 2.77); pot.rotation.y = side < 0 ? Math.PI : 0;
    for (let i = 0; i < 6; i++) {
      const x = side * 1.65 - .55 + i * .22, z = side * 2.82;
      const sprig = add(leafGeometry, leaf, x, 1.54, z); sprig.rotation.z = (i % 3 - 1) * .35;
      add(bloom, i % 2 ? flower : honey, x, 1.89 + (i % 2) * .07, z + side * .04);
    }
  }

  // Bake the east-facing entrance into the geometry so placement and birdhouse mounting stay unchanged.
  root.rotation.y = Math.PI / 2; root.updateMatrixWorld(true);
  const batches = new Map<T.Material, T.BufferGeometry[]>(), originals = new Set<T.BufferGeometry>();
  root.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone(); geometry.applyMatrix4(node.matrixWorld); originals.add(node.geometry);
    const surface = node.material as T.Material; if (!batches.has(surface)) batches.set(surface, []); batches.get(surface)!.push(geometry);
  });
  root.clear(); root.rotation.set(0, 0, 0);
  for (const [surface, parts] of batches) {
    const merged = mergeGeometries(parts)!; const mesh = new T.Mesh(mergeVertices(merged), surface); mesh.name = surface.name;
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); merged.dispose(); parts.forEach(part => part.dispose());
  }
  originals.forEach(geometry => geometry.dispose()); template = root;
  return root.clone(true);
}
