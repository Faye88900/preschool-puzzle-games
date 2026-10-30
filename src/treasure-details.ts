import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const shape = new T.Shape();
shape.moveTo(0, 0); shape.bezierCurveTo(-.42, .24, -.36, .65, 0, 1);
shape.bezierCurveTo(.36, .65, .42, .24, 0, 0);
export const treasureLeaf = new T.ExtrudeGeometry(shape, { depth: .055, bevelEnabled: true,
  bevelSize: .025, bevelThickness: .018, bevelSegments: 2, steps: 1, curveSegments: 8 });

export function batchTreasureParts(group: T.Group) {
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert(), batches = new Map<T.Material, T.BufferGeometry[]>();
  group.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
    geometry.applyMatrix4(inverse.clone().multiply(node.matrixWorld));
    if (!(node.material as T.MeshStandardMaterial).map) geometry.deleteAttribute('uv');
    if (!batches.has(node.material as T.Material)) batches.set(node.material as T.Material, []);
    batches.get(node.material as T.Material)!.push(geometry);
  });
  group.clear();
  for (const [material, geometries] of batches) {
    const mesh = new T.Mesh(mergeGeometries(geometries)!, material);
    mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); geometries.forEach(g => g.dispose());
  }
}
