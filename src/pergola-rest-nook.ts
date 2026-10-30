import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rounded } from './puzzle-art';
import { createTreeBench } from './tree-bench';

// Local +Z is the open front; collision leaves the floor and entrance empty.
export const pergolaRestNookColliders = [
  ...[-1, 1].flatMap(side => [-1.25, 1.25].map(z => ({ x: side * 1.9, y: 1.55, z, width: .48, height: 3.1, depth: .48 }))),
  ...[-1, 1].map(side => ({ x: side * 2.23, y: .35, z: .8, width: .85, height: .7, depth: 1.7 })),
  { x: 0, y: .5, z: -.85, width: 3.4, height: 1, depth: .82 },
  { x: 0, y: 1.5, z: -1.25, width: 3.8, height: 3, depth: .16 },
  { x: -1.9, y: 1.5, z: 0, width: .16, height: 3, depth: 2.5 },
];

let template: T.Group | undefined;

export function createPergolaRestNook(): T.Group {
  if (template) return template.clone(true);
  const root = new T.Group(); root.name = 'garden-pergola-rest-nook';
  const palette = createTreeBench();
  const shared = (name: string) => (palette.getObjectByName('tree-bench-' + name) as T.Mesh).material as T.MeshStandardMaterial;
  const wood = shared('wood'), frame = shared('frame'), stone = shared('stone'), brass = shared('brass'), teal = shared('leaf');
  const material = (name: string, color: string) => {
    const surface = new T.MeshStandardMaterial({ color, roughness: .86 }); surface.name = name; return surface;
  };
  const green = material('pergola-leaves', '#618d36'), lime = material('pergola-young-leaves', '#8cab49');
  const cream = material('pergola-petals', '#fff4d9'), soil = material('pergola-soil', '#66523b');
  const add = (geometry: T.BufferGeometry, surface: T.Material, x = 0, y = 0, z = 0) => {
    const mesh = new T.Mesh(geometry, surface); mesh.position.set(x, y, z); root.add(mesh); return mesh;
  };
  const box = (w: number, h: number, d: number, surface: T.Material, x: number, y: number, z: number) =>
    add(rounded(w, h, d, Math.min(.045, w / 4, h / 4, d / 4)), surface, x, y, z);
  const orb = new T.SphereGeometry(1, 10, 6);
  for (const x of [-1.9, 1.9]) for (const z of [-1.25, 1.25]) {
    box(.48, .48, .48, stone, x, .24, z);
    box(.31, 2.57, .31, wood, x, 1.765, z);
    box(.36, .13, .36, brass, x, .54, z);
    box(.46, .38, .44, wood, x, 2.98, z);
    add(orb, brass, x, 3.02, z + .23).scale.set(.065, .065, .025);
  }
  for (const z of [-1.25, 1.25]) box(4.5, .26, .28, wood, 0, 3.12, z);
  for (let i = 0; i < 6; i++) box(.18, .19, 3.24, wood, -2 + i * .8, 3.29, 0);
  // Clipped diagonal strips preserve real openings in the lattice.
  const lattice = (width: number, side: boolean) => {
    const slat = (x: number, y: number, length: number, angle = 0) => {
      const mesh = side ? box(.065, length, .065, frame, -1.9, y, x) : box(.065, length, .065, frame, x, y, -1.25);
      if (side) mesh.rotation.x = angle; else mesh.rotation.z = -angle;
    };
    for (const y of [.57, 2.94]) {
      if (side) box(.13, .12, width, wood, -1.9, y, 0);
      else box(width, .12, .13, wood, 0, y, -1.25);
    }
    for (const slope of [-1, 1]) for (let b = -2; b < 5; b += .54) {
      const left = Math.max(-width / 2, slope === 1 ? .64 - b : b - 2.87);
      const right = Math.min(width / 2, slope === 1 ? 2.87 - b : b - .64);
      if (right - left < .04) continue;
      slat((left + right) / 2, slope * (left + right) / 2 + b, Math.SQRT2 * (right - left), Math.atan2(right - left, slope * (right - left)));
    }
  };
  lattice(3.5, false); lattice(2.2, true);
  for (const x of [-1.45, 1.45]) {
    for (const z of [-1.05, -.55]) box(.15, .67, .15, frame, x, .335, z);
    box(.35, .54, .82, stone, x, .79, -.85);
    box(.37, .12, .85, stone, x, 1.09, -.85);
  }
  for (let i = 0; i < 3; i++) box(2.57, .13, .23, wood, 0, .76, -.55 - i * .25);
  for (const y of [1.03, 1.29]) box(2.65, .21, .12, wood, 0, y, -1.10);
  for (const x of [-1.18, 1.18]) box(.11, .9, .13, frame, x, .95, -1.18);
  for (const side of [-1, 1]) {
    const x = side * 2.23;
    box(.85, .7, 1.7, stone, x, .35, .8);
    box(.72, .04, 1.54, soil, x, .711, .8);
    for (const edge of [-1, 1]) {
      box(.12, .13, 1.76, wood, x + edge * .39, .73, .8);
      box(.73, .13, .12, wood, x, .73, .8 + edge * .82);
    }
  }
  const leaf = new T.SphereGeometry(1, 8, 5), vertices = leaf.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const y = (vertices.getY(i) + 1) / 2;
    vertices.setXYZ(i, vertices.getX(i) * .42, y, vertices.getZ(i) * .09 + Math.sin(y * Math.PI) * .09);
  }
  leaf.computeVertexNormals();
  const blade = (x: number, y: number, z: number, size: number, turn: number, surface = green) => {
    const mesh = add(leaf, surface, x, y, z); mesh.scale.setScalar(size); mesh.rotation.set(.35, turn * .7, turn); return mesh;
  };
  const flower = (x: number, y: number, z: number) => {
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      const petal = add(orb, cream, x + Math.sin(a) * .11, y + Math.cos(a) * .11, z);
      petal.scale.set(.073, .12, .035); petal.rotation.z = -a;
    }
    add(orb, brass, x, y, z + .035).scale.set(.07, .07, .04);
  };
  for (const side of [-1, 1]) {
    const points = Array.from({ length: 25 }, (_, i) => {
      const t = i / 24, angle = t * Math.PI * 5;
      return new T.Vector3(side * 1.9 + Math.cos(angle) * .21, .78 + t * 2.6, 1.25 + Math.sin(angle) * .21);
    });
    const curve = new T.CatmullRomCurve3(points);
    add(new T.TubeGeometry(curve, 60, .026, 5, false), green);
    for (let i = 0; i < 21; i++) {
      const p = curve.getPoint(i / 21), turn = (i % 2 ? 1 : -1) * (.7 + i % 3 * .3);
      blade(p.x, p.y, p.z + .03, .28 + i % 3 * .045, turn, i % 4 ? green : lime);
    }
    for (let i = 0; i < 18; i++) {
      const z = -.1 + (i % 6) * .3, x = side * 2.23 + Math.sin(i * 2.3) * .23;
      blade(x, .74 + Math.floor(i / 6) * .07, z, .4, (i % 2 ? 1 : -1) * .9, i % 3 ? green : lime);
    }
    for (let i = 0; i < (side < 0 ? 14 : 6); i++) {
      blade(side * (1.2 + i % 5 * .18), 3.33, .65 + Math.sin(i * 2) * .6, .37, i * 1.7, i % 3 ? green : lime);
    }
    flower(side * 1.98, 1.8, 1.5); flower(side * 2.27, 1.04, 1.48);
    for (const turn of [-.6, 0, .6]) blade(side * 1.9, 2.88, 1.491, .19, turn, teal);
  }
  flower(-1.55, 3.39, 1.48);
  root.updateMatrixWorld(true);
  const batches = new Map<T.Material, T.BufferGeometry[]>(), originals = new Set<T.BufferGeometry>();
  root.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
    geometry.applyMatrix4(node.matrixWorld); originals.add(node.geometry);
    const surface = node.material as T.Material;
    if (!batches.has(surface)) batches.set(surface, []); batches.get(surface)!.push(geometry);
  });
  root.clear();
  for (const [surface, geometries] of batches) {
    const merged = mergeGeometries(geometries)!, mesh = new T.Mesh(mergeVertices(merged), surface); merged.dispose();
    mesh.name = 'pergola-' + surface.name; mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    geometries.forEach(geometry => geometry.dispose());
  }
  originals.forEach(geometry => geometry.dispose()); template = root;
  return root.clone(true);
}
