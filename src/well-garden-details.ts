import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { gardenFlower, colorFlower } from './puzzle-art';

export const wellGardenPots = [[-4.8, -1.35, .64], [-1.4, -2.4, .70], [4.65, -1.2, .50]] as const;

export function createWellGardenDetails(models: ReadonlyMap<string, T.Group>): T.Group {
  const root = new T.Group(); root.name = 'garden-well-details';
  const green = new T.MeshStandardMaterial({ color: '#799b3f', roughness: .9 }); green.name = 'well-detail-vines';
  const soil = new T.MeshStandardMaterial({ color: '#59472e', roughness: 1 }); soil.name = 'well-detail-soil';
  const rope = new T.MeshStandardMaterial({ color: '#b39450', roughness: .95 }); rope.name = 'well-detail-rope';
  const add = (geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number) => {
    const mesh = new T.Mesh(geometry, material); mesh.position.set(x, y, z); root.add(mesh); return mesh;
  };
  const model = (name: string, x: number, y: number, z: number, width: number, rotation = 0) => {
    const copy = models.get('kenney-nature/' + name)!.clone(true); copy.position.set(x, y, z); copy.scale.setScalar(width); copy.rotation.y = rotation; root.add(copy); return copy;
  };
  const bloom = gardenFlower(); colorFlower(bloom, '#fff1cd', true);
  const detailSphere = new T.SphereGeometry(1, 8, 5);
  bloom.traverse(node => { if (node instanceof T.Mesh && node.geometry.type === 'SphereGeometry') node.geometry = detailSphere; });
  for (const [i, [x, z, width]] of wellGardenPots.entries()) {
    const pot = model(i === 2 ? 'pot_large' : 'pot_small', x, 0, z, width);
    const height = new T.Box3().setFromObject(pot).max.y;
    add(new T.CylinderGeometry(width * .405, width * .405, .025, 16), soil, x, height - .045, z);
    model('grass_leafs', x, height - .03, z, width * .85, i * .7);
    if (i === 2) model('plant_flatShort', x, height - .03, z, width * .68);
    else for (let j = 0; j < 3; j++) {
      const angle = j * Math.PI * 2 / 3, flower = bloom.clone(true);
      flower.position.set(x + Math.sin(angle) * width * .17, height - .025 + (j === 0 ? .09 : 0), z + Math.cos(angle) * width * .17);
      flower.scale.setScalar(width * .26); flower.rotation.y = j; root.add(flower);
    }
  }
  for (let i = 0; i < 22; i++) {
    const side = i % 2 ? 1 : -1, x = side > 0 ? 3.2 + (i % 5) * .59 : -6.8 + (i % 4) * .65;
    const z = side > 0 ? -3.9 + Math.floor(i / 5) * 1.02 : -4.9 + Math.floor(i / 6) * .80;
    model('grass_leafs', x, .012, z, .24 + (i % 3) * .07, i * 2.4);
    if (i % 2 === 0) {
      const flower = bloom.clone(true); flower.scale.setScalar(.095 + (i % 3) * .013); flower.position.set(x, -.015, z); flower.rotation.y = i; root.add(flower);
    }
  }
  const leaf = new T.SphereGeometry(1, 8, 5);
  // Hang against the exposed hedge faces; every strand stays outside the walking space.
  for (const [x, z, angle, length] of [[-7.35, .9, Math.PI / 2, 2.45], [-.7, -7.35, 0, 2.25], [4.1, -7.35, 0, 2.6], [9.1, -7.35, 0, 1.8]]) {
    const points = Array.from({ length: 17 }, (_, i) => {
      const t = i / 16, sway = Math.sin(t * 7) * .23;
      return new T.Vector3(x + Math.cos(angle) * sway, 3.29 - t * length, z - Math.sin(angle) * sway);
    });
    const curve = new T.CatmullRomCurve3(points); add(new T.TubeGeometry(curve, 24, .017, 5, false), green, 0, 0, 0);
    for (let i = 0; i < 13; i++) {
      const p = curve.getPoint(.02 + i / 13 * .95), side = i % 2 ? 1 : -1, offset = .10 + (i % 3) * .018;
      const blade = add(leaf, green, p.x + Math.cos(angle) * side * offset, p.y - .04, p.z - Math.sin(angle) * side * offset);
      blade.scale.set(.10, .16 - i * .003, .031); blade.rotation.set(0, angle, side * -.9);
    }
    for (let i = 0; i < 7; i++) {
      const top = add(leaf, green, x + Math.cos(angle) * (i - 3) * .12, 3.27, z - Math.sin(angle) * (i - 3) * .12);
      top.scale.set(.13, .045, .16); top.rotation.y = angle + i * .5;
    }
  }
  const coil: T.Vector3[] = [];
  for (let i = 0; i <= 240; i++) {
    const t = i / 240, a = t * Math.PI * 8, radius = .10 + t * .23;
    coil.push(new T.Vector3(4.8 + Math.cos(a) * radius, .027, -.2 + Math.sin(a) * radius));
  }
  coil.push(new T.Vector3(5.24, .027, -.12), new T.Vector3(5.29, .027, .09));
  add(new T.TubeGeometry(new T.CatmullRomCurve3(coil), 260, .025, 6, false), rope, 0, 0, 0);
  root.updateMatrixWorld(true);
  const batches = new Map<T.Material, T.BufferGeometry[]>();
  root.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone(); geometry.applyMatrix4(node.matrixWorld);
    const surface = node.material as T.Material;
    if (!batches.has(surface)) batches.set(surface, []); batches.get(surface)!.push(geometry);
  });
  root.clear();
  for (const [surface, geometries] of batches) {
    const merged = mergeGeometries(geometries)!, mesh = new T.Mesh(mergeVertices(merged), surface); merged.dispose();
    mesh.name = surface.name || 'well-detail-flowers'; mesh.castShadow = ['wood', 'woodBarkDark', '_defaultMat'].includes(surface.name);
    mesh.receiveShadow = true; root.add(mesh); geometries.forEach(g => g.dispose());
  }
  return root;
}
