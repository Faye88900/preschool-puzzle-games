import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat } from './models';

let template: T.Group | undefined;
export function createGardenSeedling() {
  if (template) return template.clone(true);
  const root = new T.Group(); root.name = 'garden-seedling';
  const rootball = new T.Group(), foliage = new T.Group(), bud = new T.Group(), petals = new T.Group();
  rootball.name = 'rootball'; bud.name = 'bud'; petals.name = 'petals';
  bud.position.set(.04, 1.05, 0); petals.position.copy(bud.position);
  root.add(rootball, foliage, bud, petals);
  const ball = new T.SphereGeometry(1, 16, 10);
  const ellipsoid = (parent: T.Group, color: string, position: number[], scale: number[]) => {
    const mesh = new T.Mesh(ball.clone(), mat(color)); mesh.position.fromArray(position); mesh.scale.fromArray(scale);
    parent.add(mesh); return mesh;
  };
  const tube = (parent: T.Group, color: string, points: number[][], radius: number) => {
    parent.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3().fromArray(p))), 12, radius, 5, false), mat(color)));
  };
  ellipsoid(rootball, '#674c34', [0, .12, 0], [.25, .17, .23]);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    tube(rootball, '#bea27b', [[Math.cos(a) * .14, .25, Math.sin(a) * .14], [Math.cos(a) * .245, .13, Math.sin(a) * .22], [Math.cos(a + .35) * .14, .02, Math.sin(a + .35) * .14]], .009);
  }
  tube(foliage, '#4f8147', [[0, .15, 0], [-.06, .45, .01], [.08, .76, .02], [.04, 1.05, 0]], .035);
  for (let i = 0; i < 5; i++) {
    const leaf = new T.Group(), length = i < 2 ? .65 : .48;
    leaf.position.set(i % 2 ? -.015 : .035, .3 + i * .13, 0); leaf.rotation.y = i * 2.4; foliage.add(leaf);
    const positions: number[] = [], indices: number[] = [];
    for (let side = 0; side < 2; side++) for (let row = 0; row <= 10; row++) for (let col = 0; col <= 6; col++) {
      const u = row / 10, v = col / 3 - 1, width = Math.sin(Math.PI * u);
      positions.push(u * length, .16 * Math.sin(u * Math.PI * .8) + .055 * width * (1 - v * v) + side * .012,
        v * .22 * width);
    }
    for (let side = 0; side < 2; side++) for (let row = 0; row < 10; row++) for (let col = 0; col < 6; col++) {
      const a = side * 77 + row * 7 + col;
      indices.push(...(side ? [a, a + 1, a + 7, a + 1, a + 8, a + 7] : [a, a + 7, a + 1, a + 1, a + 7, a + 8]));
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2));
    geometry.computeVertexNormals(); leaf.add(new T.Mesh(geometry, mat(i % 2 ? '#88b75d' : '#62994d')));
    tube(leaf, '#b3cc7d', [[0, .018, 0], [length * .45, .17, 0], [length * .92, .095, 0]], .009);
  }
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    const sepal = ellipsoid(bud, '#62994d', [Math.cos(a) * .075, -.06, Math.sin(a) * .075], [.075, .16, .06]);
    sepal.rotation.z = Math.sin(a) * .35;
    const closed = ellipsoid(bud, i % 2 ? '#efa6b7' : '#f6c5d0', [Math.cos(a) * .065, .07, Math.sin(a) * .065], [.10, .18, .09]);
    closed.rotation.y = -a;
    const petal = ellipsoid(petals, '#f6c5d0', [Math.cos(a) * .25, .03, Math.sin(a) * .25], [.26, .105, .16]);
    petal.rotation.y = -a;
  }
  ellipsoid(petals, '#edbf57', [0, .12, 0], [.18, .08, .18]);
  ball.dispose();
  // Batch the static parts, keeping the bud and blossom separate for growth.
  for (const group of [rootball, foliage, bud, petals]) {
    group.updateMatrixWorld(true);
    const batches = new Map<T.Material, T.BufferGeometry[]>();
    group.traverse(node => {
      if (!(node instanceof T.Mesh)) return;
      const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
      node.updateWorldMatrix(true, false);
      geometry.applyMatrix4(new T.Matrix4().copy(group.matrixWorld).invert().multiply(node.matrixWorld));
      const material = node.material as T.Material;
      if (!batches.has(material)) batches.set(material, []);
      batches.get(material)!.push(geometry); node.geometry.dispose();
    });
    group.clear();
    for (const [material, parts] of batches) {
      const mesh = new T.Mesh(mergeGeometries(parts)!, material); mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh); parts.forEach(part => part.dispose());
    }
  }
  template = root; return root.clone(true);
}
