import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rounded } from './puzzle-art';
import { createTreeBench } from './tree-bench';

type EdgingKind = 'straight' | 'curve' | 'end';
const templates = new Map<EdgingKind, T.Group>();
const layout: { kind: EdgingKind; x: number; z: number; angle: number }[] = [
  { kind: 'straight', x: -.9, z: -1.2, angle: 0 },
  { kind: 'curve', x: .9, z: -1.2, angle: 0 },
  { kind: 'curve', x: -2.1, z: 0, angle: Math.PI / 2 },
  { kind: 'curve', x: 2.1, z: 0, angle: -Math.PI / 2 },
  { kind: 'straight', x: .9, z: 1.2, angle: Math.PI },
  { kind: 'curve', x: -.9, z: 1.2, angle: Math.PI },
];
export const flowerbedBorderColliders = layout.flatMap(part => {
  const local = part.kind === 'curve' ? Array.from({ length: 4 }, (_, i) => {
    const angle = (i + .5) * Math.PI / 8;
    return { x: 1.2 * Math.sin(angle), z: 1.2 * (1 - Math.cos(angle)), width: .52, depth: .36, angle: -angle };
  }) : [{ x: part.kind === 'straight' ? .9 : .3, z: 0, width: part.kind === 'straight' ? 1.8 : .6, depth: .36, angle: 0 }];
  return local.map(p => ({ ...p, x: part.x + p.x * Math.cos(part.angle) + p.z * Math.sin(part.angle),
    z: part.z - p.x * Math.sin(part.angle) + p.z * Math.cos(part.angle), angle: p.angle + part.angle }));
});

function batch(root: T.Group) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(), batches = new Map<T.Material, T.BufferGeometry[]>();
  root.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
    geometry.applyMatrix4(inverse.clone().multiply(node.matrixWorld));
    const material = node.material as T.Material;
    if (!batches.has(material)) batches.set(material, []); batches.get(material)!.push(geometry);
  });
  root.clear();
  for (const [material, geometries] of batches) {
    const merged = mergeGeometries(geometries)!, mesh = new T.Mesh(mergeVertices(merged), material); merged.dispose();
    mesh.name = root.name + '-' + material.name; mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    geometries.forEach(geometry => geometry.dispose());
  }
}

export function createFlowerbedEdging(kind: EdgingKind): T.Group {
  const cached = templates.get(kind); if (cached) return cached.clone(true);
  const root = new T.Group(); root.name = 'flowerbed-edging-' + kind;
  const palette = createTreeBench();
  const material = (name: string) => (palette.getObjectByName('tree-bench-' + name) as T.Mesh).material as T.Material;
  const stone = material('stone'), teal = material('leaf');
  const add = (geometry: T.BufferGeometry, surface: T.Material, x = 0, y = 0, z = 0) => {
    const mesh = new T.Mesh(geometry, surface); mesh.position.set(x, y, z); root.add(mesh); return mesh;
  };
  if (kind === 'straight') {
    for (let i = 0; i < 3; i++) add(rounded(.582, .48, .36, .045), stone, .3 + i * .6, .24, 0);
  } else if (kind === 'curve') {
    for (let i = 0; i < 4; i++) {
      const shape = new T.Shape(), start = i * Math.PI / 8 + .025, end = (i + 1) * Math.PI / 8 - .025;
      for (const radius of [1.345, 1.055]) for (let j = 0; j <= 8; j++) {
        const angle = radius > 1.2 ? start + (end - start) * j / 8 : end - (end - start) * j / 8;
        const x = Math.sin(angle) * radius, y = Math.cos(angle) * radius - 1.2;
        if (radius > 1.2 && j === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
      }
      shape.closePath();
      const geometry = new T.ExtrudeGeometry(shape, { depth: .41, bevelEnabled: true, bevelSize: .035, bevelThickness: .035, bevelSegments: 2, curveSegments: 8, steps: 1 });
      geometry.rotateX(-Math.PI / 2); add(geometry, stone, 0, .035, 0);
    }
  } else {
    add(rounded(.6, .48, .36, .075), stone, .3, .24, 0);
    const shape = new T.Shape(); shape.moveTo(0, 0); shape.bezierCurveTo(.1, .05, .1, .18, 0, .28);
    shape.bezierCurveTo(-.1, .18, -.1, .05, 0, 0);
    const leaf = new T.ExtrudeGeometry(shape, { depth: .014, bevelEnabled: true, bevelSize: .006, bevelThickness: .006, bevelSegments: 1, curveSegments: 6, steps: 1 });
    for (const side of [-1, 1]) for (const turn of [-.7, 0, .7]) {
      const blade = add(leaf, teal, .3, .12, side * .185); blade.rotation.set(0, side < 0 ? Math.PI : 0, turn); blade.scale.setScalar(turn ? .72 : 1);
    }
  }
  batch(root); templates.set(kind, root); return root.clone(true);
}

let borderTemplate: T.Group | undefined;
export function createFlowerbedBorder(): T.Group {
  if (borderTemplate) return borderTemplate.clone(true);
  const root = new T.Group(); root.name = 'garden-flowerbed-border';
  for (const part of layout) {
    const module = createFlowerbedEdging(part.kind); module.position.set(part.x, 0, part.z); module.rotation.y = part.angle; root.add(module);
  }
  const emblem = createFlowerbedEdging('end').getObjectByName('flowerbed-edging-end-tree-bench-leaf')!.clone();
  emblem.position.set(-.3, 0, 1.2); root.add(emblem);
  batch(root); borderTemplate = root; return root.clone(true);
}
