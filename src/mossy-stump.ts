import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

let template: T.Group | undefined;

export function createMossyStump(): T.Group {
  if (template) return template.clone(true);
  const root = new T.Group(); root.name = 'garden-mossy-stump';
  const material = (name: string, color: string, roughness = .85) => {
    const surface = new T.MeshStandardMaterial({ color, roughness }); surface.name = name; return surface;
  };
  const bark = material('stump-bark', '#a9794b'), cut = material('stump-cut', '#efbd77');
  const rings = material('stump-growth-rings', '#bc864d'), cream = material('stump-mushroom-stems', '#f0dfb5');
  const orange = material('stump-mushroom-caps', '#f4822e', .42);
  const moss = material('stump-moss', '#8b9f35'), lime = material('stump-moss-tips', '#acb947');
  const fern = material('stump-fern', '#587c25'), leaves = material('stump-leaves', '#82a334');
  const pixels = new Uint8Array(128 * 256 * 4);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 128; x++) {
    const grain = Math.sin(x * .72 + Math.sin(y * .019) * 2.2) * 11 + Math.sin(x * 1.91 + y * .012) * 4;
    pixels.set([236 + grain, 222 + grain, 201 + grain, 255], (y * 128 + x) * 4);
  }
  const texture = new T.DataTexture(pixels, 128, 256); texture.colorSpace = T.SRGBColorSpace;
  texture.magFilter = T.LinearFilter; texture.needsUpdate = true; bark.map = texture;
  const add = (geometry: T.BufferGeometry, surface: T.Material, x = 0, y = 0, z = 0) => {
    const mesh = new T.Mesh(geometry, surface); mesh.position.set(x, y, z); root.add(mesh); return mesh;
  };
  const pebble = new T.SphereGeometry(1, 8, 5);
  const blob = (surface: T.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    const mesh = add(pebble, surface, x, y, z); mesh.scale.set(sx, sy, sz); return mesh;
  };
  const points = (values: number[][]) => values.map(v => new T.Vector3(...v));
  const tube = (values: number[][], radius: number, surface: T.Material, segments = 16) =>
    add(new T.TubeGeometry(new T.CatmullRomCurve3(points(values)), segments, radius, 6, false), surface);
  const radius = (y: number, angle: number) => .71 + .25 * Math.pow(1 - y / 1.27, 3) + .055 * Math.sin(angle * 9 + y * 1.2) + .017 * Math.sin(angle * 17 - y);
  const trunk = new T.CylinderGeometry(1, 1, 1.27, 80, 12, true), vertices = trunk.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const y = vertices.getY(i) + .635, angle = Math.atan2(vertices.getX(i), vertices.getZ(i));
    const r = radius(y, angle); vertices.setXYZ(i, Math.sin(angle) * r, y, Math.cos(angle) * r);
  }
  trunk.computeVertexNormals(); add(trunk, bark);
  const rim = new T.RingGeometry(.69, 1, 80); rim.rotateX(-Math.PI / 2);
  const rp = rim.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    const a = Math.atan2(rp.getX(i), rp.getZ(i)), r = Math.hypot(rp.getX(i), rp.getZ(i)) > .9 ? radius(1.27, a) : .69;
    rp.setXYZ(i, Math.sin(a) * r, 1.27, Math.cos(a) * r);
  }
  rim.computeVertexNormals(); add(rim, bark);
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7 + .12, length = 1.13 + Math.sin(i * 3.1) * .13;
    const curve = new T.CatmullRomCurve3(points([[Math.sin(a) * .42, .83, Math.cos(a) * .42],
      [Math.sin(a) * .77, .30, Math.cos(a) * .77], [Math.sin(a + .06) * length, .11, Math.cos(a + .06) * length],
      [Math.sin(a + .1) * (length + .17), .06, Math.cos(a + .1) * (length + .17)]]));
    const geometry = new T.TubeGeometry(curve, 16, 1, 10, false), p = geometry.attributes.position;
    for (let j = 0; j <= 16; j++) {
      const t = j / 16, center = curve.getPointAt(t), width = .245 * (1 - t) + .035;
      for (let k = 0; k <= 10; k++) {
        const index = j * 11 + k, v = new T.Vector3().fromBufferAttribute(p, index).sub(center).multiplyScalar(width);
        p.setXYZ(index, center.x + v.x, Math.max(.008, center.y + v.y * .68), center.z + v.z);
      }
    }
    const uv = geometry.attributes.uv;
    for (let j = 0; j < uv.count; j++) { const u = uv.getX(j); uv.setXY(j, uv.getY(j), u); }
    geometry.computeVertexNormals(); add(geometry, bark);
  }
  const top = new T.CylinderGeometry(.704, .728, .055, 80, 1); add(top, cut, 0, 1.253, 0);
  for (let ring = 0; ring < 6; ring++) {
    const r = .085 + ring * .105, values = [];
    for (let i = 0; i <= 96; i++) {
      const a = i / 96 * Math.PI * 2, irregular = r * (1 + Math.sin(a * 3 + ring) * .018);
      values.push([Math.sin(a) * irregular + .028, 1.282, Math.cos(a) * irregular - .018]);
    }
    tube(values, ring % 2 ? .006 : .009, rings, 64);
  }
  for (const a of [.3, 2.1, 4.5]) tube([[Math.sin(a) * .70, 1.282, Math.cos(a) * .70],
    [Math.sin(a + .025) * .60, 1.284, Math.cos(a + .025) * .60],
    [Math.sin(a - .02) * .51, 1.283, Math.cos(a - .02) * .51]], .007, rings, 8);
  // Broken patches follow the bark surface, leaving the cut face and broad wood areas visible.
  for (let patch = 0; patch < 7; patch++) {
    const a = patch * Math.PI * 2 / 7 + .22, drop = .22 + (Math.sin(patch * 5) + 1) * .20;
    for (let j = 0; j < 12; j++) {
      const y = 1.25 - j / 11 * drop, angle = a + Math.sin(j * 2.4 + patch) * .10;
      const r = radius(Math.min(y, 1.27), angle) + .012;
      const tuft = blob(j % 4 ? moss : lime, Math.sin(angle) * r, y, Math.cos(angle) * r, .115, .078 + .012 * Math.sin(j), .036);
      tuft.rotation.y = angle; tuft.scale.x *= 1 - j / 26;
    }
    for (let j = 0; j < 6; j++) {
      const angle = a + (j - 2.5) * .07;
      blob(j % 2 ? lime : moss, Math.sin(angle) * .66, 1.278, Math.cos(angle) * .66, .085, .026, .07);
    }
  }
  for (let i = 0; i < 48; i++) {
    const a = i * 2.39996, r = .85 + (Math.sin(i * 7.1) + 1) * .28;
    blob(i % 3 ? moss : lime, Math.sin(a) * r, .037, Math.cos(a) * r, .18, .037, .12);
  }
  for (const [x, z, scale] of [[-.91, .63, 1], [-.42, 1.03, .76], [1.01, .18, .80]]) {
    const mushroom = new T.Group(); mushroom.name = 'stump-mushroom'; root.add(mushroom);
    const stem = new T.LatheGeometry(points([[0, .02], [.105, .025], [.127, .08], [.098, .22], [.08, .40], [.105, .47], [0, .49]]).map(v => new T.Vector2(v.x, v.y)), 24);
    const cap = new T.LatheGeometry(new T.SplineCurve([new T.Vector2(0, .445), new T.Vector2(.18, .444), new T.Vector2(.34, .455),
      new T.Vector2(.375, .49), new T.Vector2(.36, .56), new T.Vector2(.30, .65), new T.Vector2(.20, .735), new T.Vector2(.09, .78), new T.Vector2(0, .79)]).getPoints(20), 32);
    const stalk = new T.Mesh(stem, cream), hat = new T.Mesh(cap, orange);
    mushroom.add(stalk, hat); mushroom.position.set(x, 0, z); mushroom.scale.setScalar(scale);
    mushroom.rotation.set(.02, x, x * -.055);
  }
  const leaf = new T.SphereGeometry(1, 10, 6), lp = leaf.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const y = (lp.getY(i) + 1) / 2;
    lp.setXYZ(i, lp.getX(i) * .45 * (1 - y * .28), y, lp.getZ(i) * .13 + Math.sin(y * Math.PI) * .10);
  }
  leaf.computeVertexNormals();
  for (const [x, z, dx, dz, height] of [[.43, -.50, .08, -.32, 1.97], [.68, -.40, .71, -.18, 1.62], [.80, -.10, .80, .21, 1.03]]) {
    const curve = new T.CatmullRomCurve3(points([[x, .06, z], [x + dx * .15, height * .45, z + dz * .18], [x + dx, height, z + dz]]));
    add(new T.TubeGeometry(curve, 24, .018, 6, false), fern);
    for (let i = 0; i < 8; i++) for (const side of [-1, 1]) {
      const t = .15 + i * .105, p = curve.getPoint(t), size = .45 * (1 - t * .74);
      const blade = add(leaf, i % 3 ? fern : leaves, p.x, p.y, p.z);
      blade.scale.set(size, size, size); blade.rotation.set(.18, -.15, side * (1.07 - t * .22));
    }
    const p = curve.getPoint(1), tip = add(leaf, leaves, p.x, p.y - .04, p.z); tip.scale.setScalar(.14); tip.rotation.z = -.4;
  }
  for (let i = 0; i < 15; i++) {
    const a = i * 2.4, r = .90 + (Math.sin(i * 4.2) + 1) * .27;
    for (let j = 0; j < 3; j++) {
      const blade = add(leaf, leaves, Math.sin(a) * r, .04, Math.cos(a) * r);
      blade.scale.set(.18, .23, .18); blade.rotation.set(1.05, j * Math.PI * 2 / 3 + a, .1);
    }
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
    const merged = mergeGeometries(geometries)!, mesh = new T.Mesh(mergeVertices(merged), surface); merged.dispose();
    mesh.name = surface.name; mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); geometries.forEach(g => g.dispose());
  }
  originals.forEach(g => g.dispose()); template = root;
  return root.clone(true);
}
