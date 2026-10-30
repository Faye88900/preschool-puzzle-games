import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const facets = new T.MeshStandardMaterial({ vertexColors: true, roughness: .22, metalness: .12,
  emissive: '#4cb7ad', emissiveIntensity: .18, flatShading: true });
const gold = new T.MeshStandardMaterial({ color: '#e9c675', roughness: .32, metalness: .55 });
const mint = new T.MeshStandardMaterial({ color: '#e2fff3', roughness: .25, emissive: '#80dbcb', emissiveIntensity: .25 });
const gem = new T.LatheGeometry([
  new T.Vector2(0, 0), new T.Vector2(.04, 0), new T.Vector2(.24, .24),
  new T.Vector2(.29, .93), new T.Vector2(.045, 1.39), new T.Vector2(0, 1.42),
], 6).toNonIndexed();
gem.computeVertexNormals();
const colors: number[] = [], palette = ['#50b6b7', '#83e6d7', '#c0fff0', '#60c6c6', '#9ae9e4', '#61cfb5'];
const positions = gem.getAttribute('position');
for (let i = 0; i < positions.count; i++) {
  const angle = Math.atan2(positions.getZ(i), positions.getX(i));
  const color = new T.Color(palette[Math.floor((angle + Math.PI) / (Math.PI / 3)) % 6]);
  colors.push(color.r, color.g, color.b);
}
gem.setAttribute('color', new T.Float32BufferAttribute(colors, 3));

export function createSailCrystal(): T.Group {
  const root = new T.Group(); root.name = 'sail-crystal';
  const add = (geometry: T.BufferGeometry, material: T.Material, x = 0, y = 0, z = 0) => {
    const mesh = new T.Mesh(geometry, material); mesh.position.set(x, y, z); root.add(mesh); return mesh;
  };
  add(gem, facets);
  for (const side of [-1, 1]) {
    const shard = add(gem, facets, side * .34, .14, .06);
    shard.scale.setScalar(.34); shard.rotation.z = -side * .33;
    const leaf = add(new T.SphereGeometry(1, 10, 6), gold, side * .17, .22, 0);
    leaf.scale.set(.09, .28, .15); leaf.rotation.z = -side * .55;
  }
  add(new T.CylinderGeometry(.16, .11, .12, 8), gold, 0, .08);
  // Two open wind ribbons leave the crystal's silhouette and cut faces visible.
  for (const offset of [0, Math.PI]) {
    const points = Array.from({ length: 25 }, (_, i) => {
      const t = i / 24, a = offset + t * Math.PI * 1.5;
      return new T.Vector3(Math.cos(a) * (.38 - t * .09), .22 + t * .7, Math.sin(a) * (.38 - t * .09));
    });
    add(new T.TubeGeometry(new T.CatmullRomCurve3(points), 24, .018, 5), gold);
  }
  for (const [x, y, z, size] of [[-.11, 1.09, -.18, .07], [.18, .78, -.235, .04], [.025, .54, -.27, .035]]) {
    const glint = add(new T.OctahedronGeometry(size), mint, x, y, z); glint.scale.set(.55, 1.8, .3);
  }
  root.updateMatrixWorld(true);
  const batches = new Map<T.Material, T.BufferGeometry[]>();
  root.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
    geometry.applyMatrix4(node.matrixWorld); geometry.deleteAttribute('uv');
    if (!batches.has(node.material as T.Material)) batches.set(node.material as T.Material, []);
    batches.get(node.material as T.Material)!.push(geometry);
  });
  root.clear();
  for (const [material, geometries] of batches) {
    const mesh = new T.Mesh(mergeGeometries(geometries)!, material);
    mesh.name = material === facets ? 'crystal-facets' : material === gold ? 'gold-wind-ribbons' : 'crystal-glints';
    mesh.castShadow = true; root.add(mesh); geometries.forEach(g => g.dispose());
  }
  return root;
}
