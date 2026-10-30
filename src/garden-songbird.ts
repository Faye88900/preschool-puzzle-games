import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

let template: T.Group | undefined;

export function createGardenSongbird(): T.Group {
  if (template) return template.clone(true);
  const root = new T.Group(); root.name = 'garden-songbird';
  const material = (name: string, color: string, roughness = .73) => {
    const surface = new T.MeshStandardMaterial({ color, roughness }); surface.name = name; return surface;
  };
  const blue = material('songbird-blue', '#7ba8df'), cream = material('songbird-cream', '#ffebce');
  const wings = material('songbird-wings', '#729ed0'), feathers = material('songbird-feathers', '#6993c6');
  const orange = material('songbird-orange', '#f79527', .57), mouth = material('songbird-beak-seam', '#bc6828');
  const eyes = material('songbird-eyes', '#231b1b', .15), glints = material('songbird-eye-glints', '#ffffff', .2);
  const sphere = new T.SphereGeometry(1, 32, 24), detail = new T.SphereGeometry(1, 18, 12);
  const add = (geometry: T.BufferGeometry, surface: T.Material, x = 0, y = 0, z = 0) => {
    const mesh = new T.Mesh(geometry, surface); mesh.position.set(x, y, z); root.add(mesh); return mesh;
  };
  const oval = (surface: T.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, geometry = sphere) => {
    const mesh = add(geometry, surface, x, y, z); mesh.scale.set(sx, sy, sz); return mesh;
  };
  oval(blue, 0, .40, -.025, .31, .32, .28);
  oval(cream, 0, .385, .092, .278, .300, .235);
  // All three head sections share their boundaries and smooth normals, so the face has no overlay seam.
  for (const section of ['crown', 'face', 'back']) {
    const positions: number[] = [], normals: number[] = [], uv: number[] = [], indices: number[] = [];
    for (let row = 0; row <= 24; row++) for (let column = 0; column <= 48; column++) {
      const a = (section === 'back' ? Math.PI / 2 : -Math.PI / 2) + column / 48 * Math.PI;
      const brow = 1.43 - .40 * Math.exp(-Math.pow((Math.abs(a) - .55) / .36, 2)) + .5 * Math.pow(Math.abs(a) / (Math.PI / 2), 6);
      const theta = section === 'back' ? row / 24 * Math.PI : section === 'face' ? brow + (Math.PI - brow) * row / 24 : brow * row / 24;
      const x = Math.sin(a) * Math.sin(theta), y = Math.cos(theta), z = Math.cos(a) * Math.sin(theta);
      positions.push(x * .285, .755 + y * .285, .035 + z * .26);
      const normal = new T.Vector3(x / .285, y / .285, z / .26).normalize(); normals.push(normal.x, normal.y, normal.z);
      uv.push(column / 48, row / 24);
      if (row < 24 && column < 48) {
        const i = row * 49 + column; indices.push(i, i + 49, i + 1, i + 1, i + 49, i + 50);
      }
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3)); geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices); add(geometry, section === 'face' ? cream : blue);
  }
  for (const side of [-1, 1]) {
    const wing = oval(wings, side * .287, .425, -.035, .108, .205, .208); wing.rotation.x = .45; wing.rotation.z = side * .12;
    for (let i = 0; i < 3; i++) {
      const feather = oval(i === 2 ? feathers : wings, side * (.364 - i * .008), .421 - i * .043, .046 - i * .070, .036, .131, .067, detail);
      feather.rotation.x = .66 + i * .12; feather.rotation.z = side * .12;
    }
    for (let i = 0; i < 2; i++) {
      const covert = oval(wings, side * .369, .51 - i * .044, -.011 - i * .065, .033, .074, .050, detail); covert.rotation.x = .72;
    }
    oval(eyes, side * .134, .823, .273, .050, .061, .034);
    oval(glints, side * .134 - .013, .845, .302, .0125, .0145, .007, detail);
    oval(glints, side * .134 + .012, .807, .303, .0045, .005, .003, detail);
    const leg = new T.CatmullRomCurve3([new T.Vector3(side * .105, .038, .004), new T.Vector3(side * .108, .086, -.003), new T.Vector3(side * .115, .16, -.025)]);
    add(new T.TubeGeometry(leg, 8, .022, 8, false), orange);
    for (const angle of [-.53, 0, .53]) {
      const toe = oval(orange, side * .105 + Math.sin(angle) * .042, .023, .029 + Math.cos(angle) * .040, .021, .023, .078, detail);
      toe.rotation.y = angle;
    }
    oval(orange, side * .105, .023, -.034, .022, .023, .055, detail);
  }
  for (let i = 0; i < 3; i++) {
    const tail = oval(i === 1 ? wings : feathers, (i - 1) * .058, .284 + (i === 1 ? .01 : 0), i === 1 ? -.47 : -.45, .046, .040, .22, detail);
    tail.rotation.y = (i - 1) * -.22; tail.rotation.x = .15;
  }
  const beak = new T.LatheGeometry([[0, 0], [.062, 0], [.079, .026], [.061, .076], [.016, .140], [0, .15]].map(([r, y]) => new T.Vector2(r, y)), 32);
  beak.rotateX(Math.PI / 2); const bp = beak.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const a = Math.atan2(bp.getY(i), bp.getX(i)), roundDiamond = Math.pow(Math.abs(Math.cos(a)) + Math.abs(Math.sin(a)), -.7);
    bp.setXYZ(i, bp.getX(i) * roundDiamond, bp.getY(i) * roundDiamond, bp.getZ(i));
  }
  beak.computeVertexNormals(); const bill = add(beak, orange, 0, .778, .276); bill.scale.set(1, .70, 1);
  const line = new T.CatmullRomCurve3([new T.Vector3(-.066, .778, .320), new T.Vector3(-.032, .778, .389), new T.Vector3(0, .778, .424),
    new T.Vector3(.032, .778, .389), new T.Vector3(.066, .778, .320)]);
  add(new T.TubeGeometry(line, 24, .002, 5, false), mouth);
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
    mesh.name = surface.name; mesh.castShadow = surface !== eyes && surface !== glints && surface !== mouth;
    mesh.receiveShadow = true; root.add(mesh); geometries.forEach(g => g.dispose());
  }
  originals.forEach(g => g.dispose()); template = root;
  return root.clone(true);
}
