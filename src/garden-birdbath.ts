import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

let template: T.Group | undefined;

export function createGardenBirdbath(): T.Group {
  if (template) return template.clone(true);
  const root = new T.Group(); root.name = 'garden-birdbath';
  const material = (name: string, color: string, roughness = .88) => {
    const surface = new T.MeshStandardMaterial({ color, roughness }); surface.name = name; return surface;
  };
  const stone = material('birdbath-stone', '#dbcfbd'), rim = material('birdbath-rim', '#e8dcc9');
  const seams = material('birdbath-stone-fissures', '#a99e8b');
  const moss = material('birdbath-moss', '#83983b'), tips = material('birdbath-moss-tips', '#a5b342');
  const water = material('birdbath-water', '#d9f0f6', .25); water.metalness = .05;
  const glints = material('birdbath-water-glints', '#d8f7fc', .22);
  const size = 256, pixels = new Uint8Array(size * size * 4), caustics = new Uint8Array(size * size * 4);
  const spots = Array.from({ length: 58 }, (_, i) => ({ x: (Math.sin(i * 41.7) + 1) * .5, y: (Math.sin(i * 17.3 + 2) + 1) * .5,
    radius: .012 + (Math.sin(i * 12.1) + 1) * .012 }));
  const cells = Array.from({ length: 25 }, (_, i) => ({ x: (i % 5 + .5 + Math.sin(i * 2.7) * .27) / 5, y: (Math.floor(i / 5) + .5 + Math.cos(i * 3.1) * .27) / 5 }));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, index = (y * size + x) * 4;
    let shade = 244 + Math.sin(x * .27 + Math.cos(y * .11)) * 2 + Math.sin(y * .43 + x * .7) * 1.5;
    for (const spot of spots) {
      const dx = Math.min(Math.abs(u - spot.x), 1 - Math.abs(u - spot.x)), dy = Math.min(Math.abs(v - spot.y), 1 - Math.abs(v - spot.y));
      const distance = Math.hypot(dx, dy) / (spot.radius * (1 + Math.sin(Math.atan2(dy, dx) * 5) * .17));
      if (distance < 1) shade -= (1 - Math.pow(distance, 6)) * 24;
    }
    pixels.set([shade, shade - 2, shade - 5, 255], index);
    const wu = (u + .032 * Math.sin(v * Math.PI * 6) + .013 * Math.sin((u + v) * Math.PI * 4) + 1) % 1;
    const wv = (v + .027 * Math.sin(u * Math.PI * 6) + .015 * Math.cos((u - v) * Math.PI * 4) + 1) % 1;
    let nearest = Infinity, second = Infinity;
    for (const cell of cells) {
      const dx = Math.min(Math.abs(wu - cell.x), 1 - Math.abs(wu - cell.x)), dy = Math.min(Math.abs(wv - cell.y), 1 - Math.abs(wv - cell.y));
      const distance = Math.hypot(dx, dy);
      if (distance < nearest) { second = nearest; nearest = distance; } else if (distance < second) second = distance;
    }
    const line = Math.exp(-(second - nearest) * 65), ripple = Math.sin(u * 30 + Math.cos(v * 25)) * 4;
    caustics.set([112 + line * 48 + ripple, 178 + line * 38 + ripple, 208 + line * 29 + ripple, 255], index);
  }
  const texture = (data: Uint8Array) => {
    const map = new T.DataTexture(data, size, size); map.colorSpace = T.SRGBColorSpace;
    map.magFilter = T.LinearFilter; map.minFilter = T.LinearMipmapLinearFilter; map.generateMipmaps = true;
    map.wrapS = map.wrapT = T.RepeatWrapping; map.needsUpdate = true; return map;
  };
  stone.map = rim.map = texture(pixels); water.map = texture(caustics);
  const add = (geometry: T.BufferGeometry, surface: T.Material, x = 0, y = 0, z = 0) => {
    const mesh = new T.Mesh(geometry, surface); mesh.position.set(x, y, z); root.add(mesh); return mesh;
  };
  const lathe = (values: number[][], surface: T.Material, segments: number, samples: number) => {
    const profile = new T.SplineCurve(values.map(([r, y]) => new T.Vector2(r, y))).getPoints(samples);
    profile.forEach(p => { p.x = Math.max(0, p.x); p.y = Math.max(0, p.y); });
    return add(new T.LatheGeometry(profile, segments), surface);
  };
  lathe([[0, 0], [.39, 0], [.46, .012], [.48, .045], [.48, .12], [.46, .16], [.39, .17], [0, .17]], stone, 48, 24);
  lathe([[0, .15], [.365, .15], [.36, .22], [.32, .42], [.27, .68], [.24, .81], [.25, .86], [0, .86]], stone, 48, 32);
  lathe([[0, .80], [.25, .80], [.30, .815], [.315, .85], [.30, .895], [.25, .91], [0, .91]], rim, 48, 18);
  // The profile returns through the inner wall to the floor, making a solid concave bowl.
  lathe([[0, .89], [.27, .89], [.43, .925], [.60, 1.005], [.73, 1.115], [.80, 1.245], [.80, 1.31],
    [.73, 1.33], [.70, 1.29], [.65, 1.205], [.53, 1.135], [.32, 1.09], [0, 1.08]], stone, 64, 48);
  lathe([[.795, 1.265], [.85, 1.28], [.885, 1.32], [.89, 1.39], [.87, 1.435], [.81, 1.455],
    [.745, 1.45], [.70, 1.42], [.688, 1.37], [.70, 1.32], [.74, 1.29], [.795, 1.265]], rim, 64, 40);
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7 + .19;
    const path = [[.696, 1.372], [.722, 1.435], [.79, 1.457], [.858, 1.441], [.888, 1.387], [.875, 1.32]].map(([r, y], j) =>
      new T.Vector3(Math.sin(a + Math.sin(j * 2.2 + i) * .005) * r, y, Math.cos(a + Math.sin(j * 2.2 + i) * .005) * r));
    add(new T.TubeGeometry(new T.CatmullRomCurve3(path), 18, .0028, 5, false), seams);
  }
  const surface = new T.CircleGeometry(.697, 80); surface.rotateX(-Math.PI / 2); add(surface, water, 0, 1.325, 0);
  for (const [x, z, sx, sz, angle] of [[-.40, -.19, .105, .014, -.3], [.36, -.27, .078, .012, .45], [.35, .31, .065, .010, -.4]]) {
    const reflection = new T.CircleGeometry(1, 24); reflection.rotateX(-Math.PI / 2);
    const mesh = add(reflection, glints, x, 1.327, z); mesh.scale.set(sx, 1, sz); mesh.rotation.y = angle;
  }
  const tuft = new T.SphereGeometry(1, 10, 6);
  for (const a of [.45, 2.4, 3.35, 5.35]) for (let j = 0; j < 12; j++) {
    const y = .045 + (j % 4) * .053, angle = a + Math.sin(j * 2.4) * .14;
    const r = y < .14 ? .47 : .36;
    const mesh = add(tuft, j % 3 ? moss : tips, Math.sin(angle) * r, y, Math.cos(angle) * r);
    mesh.scale.set(.043 + (j % 3) * .008, .042, .021); mesh.rotation.y = angle;
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
    mesh.name = surface.name; mesh.castShadow = surface !== water && surface !== glints; mesh.receiveShadow = true; root.add(mesh);
    geometries.forEach(g => g.dispose());
  }
  originals.forEach(g => g.dispose()); template = root;
  return root.clone(true);
}
