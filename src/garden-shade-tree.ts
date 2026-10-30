import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function createGardenShadeTree(source: T.Group): T.Group {
  const root = new T.Group(); root.name = 'garden-shade-tree'; source.updateMatrixWorld(true);
  const crowns: T.BufferGeometry[] = [];
  let crownMaterial: T.Material | undefined;
  source.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone(); geometry.applyMatrix4(node.matrixWorld);
    const p = geometry.attributes.position, n = geometry.attributes.normal, colors = geometry.attributes.color;
    const trunk = { position: [] as number[], normal: [] as number[], color: [] as number[] };
    const islands: { ids: Set<number>; keys: Set<string> }[] = [], seen = new Map<string, typeof islands[number]>();
    for (let i = 0; i < p.count; i += 3) {
      const ids = [i, i + 1, i + 2];
      if (!ids.every(k => colors.getY(k) > colors.getX(k) * 1.1)) {
        // The source has hidden pink helper faces that would show through the rounded foliage.
        if (ids.some(k => colors.getZ(k) >= colors.getY(k))) continue;
        for (const k of ids) {
          trunk.position.push(p.getX(k), p.getY(k), p.getZ(k)); trunk.normal.push(n.getX(k), n.getY(k), n.getZ(k));
          trunk.color.push(colors.getX(k), colors.getY(k), colors.getZ(k));
        }
        continue;
      }
      const keys = ids.map(k => [p.getX(k), p.getY(k), p.getZ(k)].map(v => v.toFixed(5)).join(','));
      const touching = new Set(keys.flatMap(key => seen.has(key) ? [seen.get(key)!] : []));
      const island = touching.size ? [...touching][0] : { ids: new Set<number>(), keys: new Set<string>() };
      if (!touching.size) islands.push(island);
      for (const old of touching) if (old !== island) {
        old.ids.forEach(id => island.ids.add(id)); old.keys.forEach(key => { island.keys.add(key); seen.set(key, island); });
        islands.splice(islands.indexOf(old), 1);
      }
      ids.forEach(id => island.ids.add(id)); keys.forEach(key => { island.keys.add(key); seen.set(key, island); });
    }
    const trunkGeometry = new T.BufferGeometry();
    for (const name of ['position', 'normal', 'color'] as const) trunkGeometry.setAttribute(name, new T.Float32BufferAttribute(trunk[name], 3));
    const timber = new T.Mesh(trunkGeometry, node.material); timber.name = 'garden-shade-trunk'; root.add(timber);
    crownMaterial = node.material as T.Material;
    // Replace only the oak's four separate foliage masses; keep its original trunk and source GLB.
    for (const island of islands) {
      const bounds = new T.Box3(), color = new T.Vector3();
      island.ids.forEach(i => { bounds.expandByPoint(new T.Vector3().fromBufferAttribute(p, i)); color.add(new T.Vector3().fromBufferAttribute(colors, i)); });
      color.divideScalar(island.ids.size);
      const size = bounds.getSize(new T.Vector3()).multiplyScalar(.5), center = bounds.getCenter(new T.Vector3());
      const crown = new T.SphereGeometry(1, 20, 12), vertices = crown.attributes.position, tint = [];
      for (let i = 0; i < vertices.count; i++) {
        const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
        const lobe = 1 + Math.sin(Math.atan2(z, x) * 5 + y * 3) * .035 * (1 - y * y);
        vertices.setXYZ(i, center.x + x * size.x * lobe, center.y + y * size.y, center.z + z * size.z * lobe);
        const light = 1 + y * .12; tint.push(color.x * light, color.y * light, color.z * light);
      }
      crown.setAttribute('color', new T.Float32BufferAttribute(tint, 3)); crown.computeVertexNormals(); crown.deleteAttribute('uv'); crowns.push(crown);
    }
    geometry.dispose();
  });
  const crown = new T.Mesh(mergeGeometries(crowns)!, crownMaterial); crown.name = 'garden-shade-crown'; root.add(crown); crowns.forEach(g => g.dispose());
  const curve = new T.CatmullRomCurve3([new T.Vector3(0, .33, 0), new T.Vector3(.03, .45, .12), new T.Vector3(.11, .58, .32), new T.Vector3(.18, .65, .48)]);
  const branch = new T.TubeGeometry(curve, 24, .022, 8, false), vertices = branch.attributes.position;
  for (let i = 0; i <= 24; i++) {
    const center = curve.getPointAt(i / 24), taper = 1 - .81 * i / 24;
    for (let j = 0; j <= 8; j++) {
      const index = i * 9 + j, point = new T.Vector3().fromBufferAttribute(vertices, index).sub(center).multiplyScalar(taper).add(center);
      vertices.setXYZ(index, point.x, point.y, point.z);
    }
  }
  branch.computeVertexNormals();
  const twig = new T.Mesh(branch, new T.MeshStandardMaterial({ color: '#805b37', roughness: .9 })); twig.name = 'garden-chime-branch'; root.add(twig);
  const anchor = new T.Object3D(); anchor.name = 'garden-chime-anchor'; anchor.position.copy(curve.getPoint(1)); root.add(anchor);
  root.traverse(node => { if (node instanceof T.Mesh) node.castShadow = node.receiveShadow = true; });
  return root;
}
