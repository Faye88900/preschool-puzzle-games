import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rounded } from './puzzle-art';

const end = T.MathUtils.degToRad(62), radius = 2.69;
export const treeBenchColliders = [0, Math.PI].flatMap(turn => [
  ...Array.from({ length: 10 }, (_, i) => {
    const angle = turn - end + (i + .5) * end / 5;
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, width: 1.1, depth: .72, angle: -angle };
  }),
  ...[-end, end].map(a => {
    const angle = turn + a;
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, width: 1.08, depth: .46, angle: -angle };
  }),
]);

let template: T.Group | undefined;

export function createTreeBench(): T.Group {
  if (template) return template.clone(true);
  const root = new T.Group(); root.name = 'garden-tree-bench';
  const material = (name: string, color: string, roughness = .8) => {
    const surface = new T.MeshStandardMaterial({ color, roughness }); surface.name = name; return surface;
  };
  const wood = material('tree-bench-wood', '#c9883e', .68), frame = material('tree-bench-frame', '#9c652f');
  const stone = material('tree-bench-stone', '#eadcc0', .92), brass = material('tree-bench-brass', '#d5a349', .35);
  brass.metalness = .5;
  const teal = material('tree-bench-leaf', '#389a8c', .56), vein = material('tree-bench-veins', '#a2c9a6');
  const texture = (grain: boolean) => {
    const size = 128, pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const bend = Math.sin(x * Math.PI / 64) * 1.8 + Math.sin(x * Math.PI / 32) * .6;
      const shade = grain ? 243 + Math.sin((y + bend) * Math.PI / 32) * 4 + Math.sin((y + bend) * Math.PI / 8) * 1.5
        : 243 + Math.sin(x * .045 + Math.sin(y * .035)) * 4 + Math.sin(x * .09 - y * .05) * 3;
      pixels.set([shade, shade - 2, shade - 5, 255], (y * size + x) * 4);
    }
    const map = new T.DataTexture(pixels, size, size); map.colorSpace = T.SRGBColorSpace;
    map.wrapS = map.wrapT = T.RepeatWrapping; map.magFilter = T.LinearFilter;
    map.minFilter = T.LinearMipmapLinearFilter; map.generateMipmaps = true; map.needsUpdate = true; return map;
  };
  wood.map = frame.map = texture(true); stone.map = texture(false);
  const add = (parent: T.Object3D, geometry: T.BufferGeometry, surface: T.Material, x = 0, y = 0, z = 0) => {
    const mesh = new T.Mesh(geometry, surface); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  const arc = (inner: number, outer: number, y: number, height: number, surface: T.Material, bevel: number) => {
    const shape = new T.Shape();
    shape.absarc(0, 0, outer, -end, end, false);
    shape.lineTo(Math.cos(end) * inner, Math.sin(end) * inner);
    shape.absarc(0, 0, inner, end, -end, true); shape.closePath();
    const geometry = new T.ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 20, steps: 1 });
    geometry.rotateX(-Math.PI / 2);
    const p = geometry.attributes.position, uv = geometry.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, Math.atan2(p.getZ(i), p.getX(i)) * 1.7, (Math.hypot(p.getX(i), p.getZ(i)) - inner) / (outer - inner));
    return add(segment, geometry, surface, 0, y, 0);
  };
  const segment = new T.Group(); root.add(segment);
  for (let i = 0; i < 3; i++) arc(2.16 + i * .365, 2.49 + i * .365, .645, .12, wood, .035);
  for (const r of [2.22, 3.11]) arc(r, r + .08, .31, .29, frame, .02);
  add(segment, rounded(.68, .54, .22, .035), frame, radius, .27, 0);
  const foot = rounded(1.08, .62, .46, .075), cap = rounded(1.08, .19, .26, .045);
  const bolt = new T.SphereGeometry(1, 12, 6);
  const leafShape = new T.Shape(); leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(.16, .08, .12, .27, 0, .38);
  leafShape.bezierCurveTo(-.12, .27, -.16, .08, 0, 0);
  const leaf = new T.ExtrudeGeometry(leafShape, { depth: .018, bevelEnabled: true, bevelSize: .008, bevelThickness: .008, bevelSegments: 2, curveSegments: 8, steps: 1 });
  for (const angle of [-end, end]) {
    const terminal = new T.Group(); terminal.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius); terminal.rotation.y = -angle; segment.add(terminal);
    add(terminal, foot, stone, 0, .31, 0); add(terminal, cap, wood, 0, .715, 0);
    for (const x of [-.31, .31]) add(terminal, bolt, brass, x, .819, 0).scale.set(.048, .018, .048);
    const badge = new T.Group(); if (angle < 0) badge.rotation.y = Math.PI; terminal.add(badge);
    add(badge, leaf, teal, 0, .22, .237).scale.setScalar(.88);
    for (const side of [-1, 1]) {
      const blade = add(badge, leaf, teal, side * .035, .20, .24); blade.rotation.z = -side * .8; blade.scale.setScalar(.67);
    }
    add(badge, new T.CylinderGeometry(.012, .016, .34, 6), vein, 0, .27, .27);
  }
  const opposite = segment.clone(true); opposite.rotation.y = Math.PI; root.add(opposite);
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
    mesh.name = surface.name; mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    geometries.forEach(geometry => geometry.dispose());
  }
  originals.forEach(geometry => geometry.dispose()); template = root;
  return root.clone(true);
}
