import * as T from 'three';
import { batchTreasureParts, treasureLeaf } from './treasure-details';

const facets = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: .17, metalness: .08,
  clearcoat: .9, clearcoatRoughness: .18, emissive: '#4fbcad', emissiveIntensity: .1, flatShading: true,
  transparent: true, opacity: .84, depthWrite: false });
const heart = new T.MeshStandardMaterial({ color: '#208f91', roughness: .23, metalness: .1, emissive: '#176b70', emissiveIntensity: .16 });
const gold = new T.MeshStandardMaterial({ color: '#dfb65d', roughness: .3, metalness: .52 });
const pale = new T.MeshStandardMaterial({ color: '#f5ffeb', roughness: .28, emissive: '#a8f7df', emissiveIntensity: .3 });

// Flat facets suggest crystal depth without a refraction render pass.
const gem = new T.LatheGeometry([
  new T.Vector2(0, 0), new T.Vector2(.23, .3), new T.Vector2(.43, .78),
  new T.Vector2(.33, 1.19), new T.Vector2(.015, 1.74), new T.Vector2(0, 1.76),
], 8).toNonIndexed();
gem.scale(1, 1, .57); gem.computeVertexNormals();
const colors: number[] = [], positions = gem.getAttribute('position');
const palette = ['#8ce9d6', '#b7ffed', '#56c9c6', '#71ded5', '#b7f3d7', '#60c5c1', '#86ddd2', '#d1fff0'];
for (let i = 0; i < positions.count; i += 3) {
  const x = (positions.getX(i) + positions.getX(i + 1) + positions.getX(i + 2)) / 3;
  const z = (positions.getZ(i) + positions.getZ(i + 1) + positions.getZ(i + 2)) / 3;
  const color = new T.Color(palette[Math.floor((Math.atan2(z / .57, x) + Math.PI) / (Math.PI / 4)) % 8]);
  for (let v = 0; v < 3; v++) colors.push(color.r, color.g, color.b);
}
gem.setAttribute('color', new T.Float32BufferAttribute(colors, 3));

export function createSailCrystal(): T.Group {
  const root = new T.Group(); root.name = 'sail-crystal';
  const add = (geometry: T.BufferGeometry, material: T.Material, x = 0, y = 0, z = 0) => {
    const mesh = new T.Mesh(geometry, material); mesh.position.set(x, y, z); root.add(mesh); return mesh;
  };
  add(gem, facets);
  const core = add(gem, heart, 0, .14, 0); core.scale.set(.49, .58, .62);
  for (const side of [-1, 1]) {
    for (const wing of [-1, 1]) {
      const curvedLeaf = treasureLeaf.clone(), p = curvedLeaf.getAttribute('position');
      for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - side * Math.sin(p.getY(i) * Math.PI) * .17);
      curvedLeaf.computeVertexNormals();
      const leaf = add(curvedLeaf, gold, wing * .025, .02, side * .22);
      leaf.scale.set(.59, .78, .8); leaf.rotation.z = -wing * .55;
    }
  }
  const crescent = new T.Shape(); crescent.moveTo(.18, 1.29);
  crescent.bezierCurveTo(1.04, 1.09, .94, .38, .15, .1);
  crescent.bezierCurveTo(.76, .47, .76, 1.04, .18, 1.29);
  add(new T.ExtrudeGeometry(crescent, { depth: .045, bevelEnabled: true, bevelSize: .016,
    bevelThickness: .016, bevelSegments: 2, steps: 1, curveSegments: 16 }), gold, 0, 0, .19);
  for (const [x, y, z, size] of [[-.16, 1.29, -.12, .045], [.22, .97, -.2, .026]]) {
    add(new T.OctahedronGeometry(size), pale, x, y, z).scale.set(.6, 1.8, .35);
  }
  batchTreasureParts(root);
  root.children.forEach(mesh => { mesh.name = (mesh as T.Mesh).material === facets ? 'crystal-facets'
    : (mesh as T.Mesh).material === heart ? 'crystal-inner-heart' : (mesh as T.Mesh).material === gold ? 'gold-leaf-cradle' : 'crystal-glints'; });
  return root;
}
