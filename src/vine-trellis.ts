import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rounded } from './puzzle-art';

let template: T.Group | undefined;

export function createVineTrellis(): T.Group {
  if (template) return template.clone(true);
  const root = new T.Group(); root.name = 'garden-vine-trellis';
  const pixels = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const shade = Math.sin(y * .37 + Math.sin(x * .04) * 2) * 4 + Math.sin(y * .13 + x * .016) * 3;
    pixels.set([247 + shade, 229 + shade, 204 + shade, 255], (y * 128 + x) * 4);
  }
  const grain = new T.DataTexture(pixels, 128, 128); grain.colorSpace = T.SRGBColorSpace;
  grain.magFilter = T.LinearFilter; grain.needsUpdate = true;
  const material = (name: string, color: string, map?: T.Texture) => {
    const surface = new T.MeshStandardMaterial({ color, roughness: .84, map }); surface.name = name; return surface;
  };
  const timber = material('trellis-frame', '#bd8245', grain), lattice = material('trellis-lattice', '#ce9858', grain);
  const honey = material('trellis-dowels', '#e1ad69', grain), vine = material('trellis-vines', '#5b7a2f');
  const green = material('trellis-leaves', '#6b963e'), lime = material('trellis-young-leaves', '#8fae49');
  const cream = material('trellis-petals', '#fff2d0'), gold = material('trellis-flower-centers', '#efb537');
  const add = (geometry: T.BufferGeometry, surface: T.Material, x: number, y: number, z: number) => {
    const mesh = new T.Mesh(geometry, surface); mesh.position.set(x, y, z); root.add(mesh); return mesh;
  };
  const box = (w: number, h: number, d: number, surface: T.Material, x: number, y: number, z: number) =>
    add(rounded(w, h, d, Math.min(.014, w / 3, h / 3, d / 3)), surface, x, y, z);
  const peg = new T.SphereGeometry(1, 10, 6);
  for (const x of [-.83, .83]) {
    box(.15, 1.60, .15, timber, x, .99, 0);
    box(.205, .10, .205, honey, x, 1.84, 0);
    const stake = new T.CylinderGeometry(.098, .041, .22, 4); stake.rotateY(Math.PI / 4);
    add(stake, timber, x, .11, 0);
    for (const y of [.36, 1.69]) {
      box(.18, .14, .18, timber, x, y, 0);
      add(peg, honey, x, y, .097).scale.set(.025, .025, .012);
    }
  }
  for (const y of [.36, 1.69]) box(1.66, .13, .12, timber, 0, y, .007);
  // Clip both diagonal layers to the frame, leaving the diamond openings genuinely empty.
  for (const slope of [-1, 1]) for (let b = -1.26; b < 2.9; b += .34) {
    const left = Math.max(-.755, slope === 1 ? .425 - b : b - 1.625);
    const right = Math.min(.755, slope === 1 ? 1.625 - b : b - .425);
    if (right - left < .025) continue;
    const a = slope * left + b, c = slope * right + b;
    const slat = box(.046, Math.hypot(right - left, c - a) + .018, .035, lattice, (left + right) / 2, (a + c) / 2, slope * .023);
    slat.rotation.z = -Math.atan2(right - left, c - a);
  }
  for (let b = .10; b < 2.5; b += .34) for (let c = -.24; c < 2.5; c += .34) {
    const x = (c - b) / 2, y = (b + c) / 2;
    if (Math.abs(x) < .73 && y > .45 && y < 1.60) add(peg, honey, x, y, .049).scale.set(.012, .012, .007);
  }

  const leaf = new T.SphereGeometry(1, 10, 6), vertices = leaf.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const y = (vertices.getY(i) + 1) / 2;
    vertices.setXYZ(i, vertices.getX(i) * .46, y, vertices.getZ(i) * .10 + Math.sin(y * Math.PI) * .11);
  }
  leaf.computeVertexNormals();
  const stem = (points: T.Vector3[], radius: number, segments: number) => {
    const curve = new T.CatmullRomCurve3(points);
    add(new T.TubeGeometry(curve, segments, radius, 6, false), vine, 0, 0, 0); return curve;
  };
  const points = (values: number[][]) => values.map(([x, y, z]) => new T.Vector3(x, y, z));
  const climb = (side: number, low: number, high: number) => Array.from({ length: 29 }, (_, i) => {
    const t = i / 28, angle = t * Math.PI * 3.5;
    return new T.Vector3(side * .83 + Math.cos(angle) * .108, low + (high - low) * t, Math.sin(angle) * .108);
  });
  const curves = [
    stem(climb(-1, .15, 1.82), .023, 92),
    stem(points([[-.87, .30, .11], [-.59, .51, .10], [-.27, .88, .13], [.13, 1.12, .10], [.49, 1.48, .13], [.78, 1.76, .11]]), .025, 72),
    stem(points([[-.84, .59, .10], [-.50, .75, .11], [-.20, .73, .12], [.06, .86, .11], [.31, 1.01, .10]]), .015, 40),
    stem(climb(1, .73, 1.83), .018, 72),
  ];
  for (let branch = 0; branch < curves.length; branch++) {
    const curve = curves[branch], count = branch === 0 || branch === 1 ? 14 : 9;
    for (let i = 0; i < count; i++) {
      const t = .04 + i / count * .91, anchor = curve.getPoint(t), side = i % 2 ? 1 : -1;
      const tip = anchor.clone().add(new T.Vector3(side * .048, .014, .018));
      stem([anchor, anchor.clone().lerp(tip, .5).add(new T.Vector3(0, .012, 0)), tip], .004, 4);
      const blade = add(leaf, (i + branch) % 3 ? green : lime, tip.x, tip.y, tip.z);
      const size = .17 + (i % 4) * .017; blade.scale.set(size, size, size);
      blade.rotation.set(.12 * (i % 3 - 1), side * .45, -side * (.65 + (i % 3) * .24));
    }
  }
  const petal = new T.SphereGeometry(1, 10, 6);
  for (const [branch, t] of [[0, .22], [0, .63], [1, .48], [1, .90], [3, .31]]) {
    const anchor = curves[branch].getPoint(t), center = anchor.clone().add(new T.Vector3(.032, .012, .045));
    stem([anchor, center], .006, 4);
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      const bloom = add(petal, cream, center.x + Math.sin(angle) * .043, center.y + Math.cos(angle) * .043, center.z);
      bloom.scale.set(.028, .049, .014); bloom.rotation.z = -angle;
    }
    add(petal, gold, center.x, center.y, center.z + .014).scale.set(.024, .024, .016);
  }

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
    const merged = mergeGeometries(geometries)!;
    const mesh = new T.Mesh(mergeVertices(merged), surface); merged.dispose(); mesh.name = surface.name;
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); geometries.forEach(g => g.dispose());
  }
  originals.forEach(g => g.dispose()); template = root;
  return root.clone(true);
}
