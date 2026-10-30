import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rounded, gardenFlower, colorFlower } from './puzzle-art';

let template: T.Group | undefined;

export function createFirstEncounterRuins(): T.Group {
  if (template) return template.clone(true);
  const root = new T.Group(); root.name = 'first-encounter-ruins';
  const hedgeClearings: number[][] = []; root.userData.hedgeClearings = hedgeClearings;
  const clearHedge = (object: T.Object3D) => {
    root.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(object).expandByScalar(.22);
    hedgeClearings.push([bounds.min.x, bounds.min.z, bounds.max.x, bounds.max.z]);
  };
  const group = (name: string) => { const node = new T.Group(); node.name = name; root.add(node); return node; };
  const arch = group('ruins-arch'), paving = group('ruins-paving'), walls = group('ruins-walls');
  const planters = group('ruins-planters'), foliage = group('ruins-foliage');
  const columns = group('ruins-columns'), bench = group('ruins-bench'), pavilion = group('ruins-pavilion');
  const colliders: { x: number; y: number; z: number; width: number; height: number; depth: number; angle: number }[] = [];
  root.userData.colliders = colliders;
  const material = (name: string, color: string) => {
    const surface = new T.MeshStandardMaterial({ color, roughness: .91 }); surface.name = name; return surface;
  };
  const stone = material('ruins-ivory', '#dfcda3'), pale = material('ruins-limestone', '#f1dfb6');
  const shade = material('ruins-warm-stone', '#c7b389'), moss = material('ruins-moss', '#87954a');
  const green = material('ruins-ivy', '#517b38'), tips = material('ruins-leaf-tips', '#7a9e47');
  const gold = material('ruins-ochre-cloth', '#d69938'), charcoal = material('ruins-dark-crest', '#485351');
  const add = (parent: T.Object3D, geometry: T.BufferGeometry, surface: T.Material, x = 0, y = 0, z = 0) => {
    const mesh = new T.Mesh(geometry, surface); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  const extrude = (shape: T.Shape, depth: number, bevel = .045) => new T.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 5, steps: 1,
  });
  const leafShape = new T.Shape(); leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(-.4, .28, -.34, .7, 0, 1);
  leafShape.bezierCurveTo(.34, .7, .4, .28, 0, 0);
  const leaf = new T.ShapeGeometry(leafShape, 5), leafVolume = extrude(leafShape, .026, .012);
  const twig = (parent: T.Object3D, x: number, y: number, z: number, size: number, surface: T.Material) => {
    add(parent, rounded(.055 * size, .94 * size, .025, .008), surface, x, y + .47 * size, z);
    for (let i = 0; i < 5; i++) {
      const piece = add(parent, leafVolume, surface, x, y + i * .14 * size, z);
      piece.scale.setScalar(size * (i === 4 ? .45 : .55)); piece.rotation.z = i === 4 ? 0 : i % 2 ? -.77 : .77;
    }
  };
  // The hedge is cut around the stonework, including the open arch and its climbing leaves.
  arch.position.z = .35;
  for (const x of [1.65, 8.35]) {
    add(arch, rounded(1.68, .36, 1.24, .1), shade, x, .18, -8.3);
    for (let course = 0; course < 4; course++) {
      const block = add(arch, rounded(1.56 + (course % 2) * .08, .65, 1.18, .09), course % 2 ? pale : stone,
        x + Math.sin(course * 2.5 + x) * .025, .7 + course * .65, -8.3);
      block.rotation.z = Math.sin(course * 3.4 + x) * .009;
    }
    add(arch, rounded(1.7, .24, 1.28, .07), pale, x, 3.02, -8.3);
  }
  for (let i = 0; i < 9; i++) {
    const a = i * Math.PI / 9 + .014, b = (i + 1) * Math.PI / 9 - .014;
    const shape = new T.Shape();
    shape.moveTo(Math.cos(a) * 2.54, Math.sin(a) * 2.54);
    shape.absarc(0, 0, 2.54, a, b, false);
    shape.lineTo(Math.cos(b) * 3.46, Math.sin(b) * 3.46);
    shape.absarc(0, 0, 3.46, b, a, true); shape.closePath();
    const voussoir = extrude(shape, 1.08, .055); voussoir.translate(0, 0, -.54);
    add(arch, voussoir, i % 3 === 0 ? pale : stone, 5, 2.88, -8.3);
  }
  const key = add(arch, rounded(.83, 1.1, 1.32, .12), pale, 5, 5.98, -8.3); key.rotation.z = -.025;
  twig(arch, 5, 5.58, -7.62, .72, shade);
  const cloth = new T.Shape(); cloth.moveTo(-.51, .87); cloth.lineTo(.51, .87); cloth.lineTo(.46, -.7);
  cloth.lineTo(.12, -.98); cloth.lineTo(0, -.84); cloth.lineTo(-.25, -.98); cloth.lineTo(-.49, -.72); cloth.closePath();
  add(arch, extrude(cloth, .018, .009), gold, 1.65, 1.91, -7.56);
  const rod = add(arch, new T.CylinderGeometry(.055, .055, 1.43, 8), charcoal, 1.65, 2.89, -7.56); rod.rotation.z = Math.PI / 2;
  twig(arch, 1.65, 1.3, -7.525, 1.02, charcoal);
  const shield = new T.Shape(); shield.moveTo(0, .84); shield.quadraticCurveTo(.24, .61, .65, .56);
  shield.lineTo(.59, -.22); shield.quadraticCurveTo(.47, -.65, 0, -.88);
  shield.quadraticCurveTo(-.47, -.65, -.59, -.22); shield.lineTo(-.65, .56); shield.quadraticCurveTo(-.24, .61, 0, .84);
  add(arch, extrude(shield, .035, .035), shade, 8.35, 1.93, -7.58);
  const crest = add(arch, extrude(shield, .026, .025), charcoal, 8.35, 1.93, -7.54); crest.scale.set(.86, .86, .65);
  twig(arch, 8.35, 1.45, -7.545, .82, pale);

  const jitter = (i: number) => Math.sin(i * 127.1 + 91.7) * .5 + Math.cos(i * 53.3) * .5;
  const corners = Array.from({ length: 11 }, (_, row) => Array.from({ length: 9 }, (_, col) => new T.Vector2(
    -6.95 + col * 2.28 + (col === 0 || col === 8 ? 0 : jitter(row * 9 + col) * .66),
    -6.85 + row * 2.25 + (row === 0 || row === 10 ? 0 : jitter(row * 9 + col + 100) * .59),
  )));
  for (let row = 0; row < 10; row++) for (let col = 0; col < 8; col++) {
    const points = [corners[row][col], corners[row][col + 1], corners[row + 1][col + 1], corners[row + 1][col]];
    const center = points.reduce((sum, p) => sum.add(p), new T.Vector2()).multiplyScalar(.25);
    if (center.length() < 3.65 || (row === 9 && (col === 0 || col === 7))) continue;
    const shape = new T.Shape();
    // Shared jittered corners keep neighboring flagstones fitted; cut corners leave organic moss seams.
    const inset = points.map(p => p.clone().lerp(center, .055));
    for (let i = 0; i < 4; i++) {
      const a = inset[i].clone().lerp(inset[(i + 3) % 4], .095), b = inset[i].clone().lerp(inset[(i + 1) % 4], .095);
      if (i === 0) shape.moveTo(a.x, -a.y); else shape.lineTo(a.x, -a.y);
      shape.lineTo(b.x, -b.y);
    }
    shape.closePath(); const geometry = extrude(shape, .012, .012); geometry.rotateX(-Math.PI / 2);
    const seed = row * 8 + col;
    add(paving, geometry, seed % 11 === 0 ? shade : seed % 4 === 0 ? pale : stone, 0, .02, 0);
    if (seed % 3 === 0) {
      const edge = points[1].clone().lerp(points[2], .5);
      const seam = add(paving, new T.CircleGeometry(1, 7), moss, edge.x, .029, edge.y);
      seam.rotation.x = -Math.PI / 2; seam.rotation.z = Math.atan2(points[2].y - points[1].y, points[2].x - points[1].x);
      seam.scale.set(.68, .11, 1);
    }
  }
  const disc = add(paving, new T.CircleGeometry(2.79, 48), pale, 0, .03, 0); disc.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 12; i++) {
    const ring = new T.RingGeometry(2.39, 2.76, 4, 1, i * Math.PI / 6 + .015, Math.PI / 6 - .03); ring.rotateX(-Math.PI / 2);
    add(paving, ring, i % 3 ? stone : pale, 0, .042, 0);
  }
  const stem = add(paving, rounded(.16, .012, 3.7, .004), moss, 0, .033, .02); stem.rotation.y = -.08;
  for (let i = 0; i < 5; i++) {
    const glyph = add(paving, leaf, moss, i === 4 ? -.15 : i % 2 ? .04 : -.04, .044, 1.46 - i * .61);
    glyph.rotation.set(-Math.PI / 2, 0, i === 4 ? 0 : i % 2 ? -.77 : .77); glyph.scale.setScalar(i === 4 ? .92 : 1.5);
  }

  for (const [x, z, angle, count] of [[-4.7, -7.94, 0, 3], [10.1, -7.94, 0, 2], [-7.94, -2.2, Math.PI / 2, 3],
    [-7.94, 12.3, Math.PI / 2, 3], [12.94, 4.2, Math.PI / 2, 3], [12.94, 12.4, Math.PI / 2, 2], [4.6, 17.94, 0, 4]]) {
    const wall = new T.Group();
    wall.position.set(x + (x < -7.5 ? .35 : x > 12.5 ? -.35 : 0), 0, z + (z < -7.5 ? .35 : z > 17.5 ? -.35 : 0));
    wall.rotation.y = angle; walls.add(wall);
    for (let i = 0; i < count; i++) for (let j = 0; j < (i === 0 ? 2 : 3); j++) {
      const block = add(wall, new RoundedBoxGeometry(1.47, .64, .82, 1, .095), (i + j) % 3 ? stone : pale,
        (i - (count - 1) / 2) * 1.42, .35 + j * .62, 0); block.rotation.z = Math.sin(i * 7 + j) * .025;
    }
    clearHedge(wall);
  }
  const bowlProfile = [[0, 0], [.56, 0], [.65, .12], [.72, .28], [.95, .55], [1.08, .94], [1.09, 1.11],
    [.99, 1.16], [.9, 1.04], [.86, .84], [.65, .59], [0, .55]].map(([r, y]) => new T.Vector2(r, y));
  const urnProfile = [[0, 0], [.5, 0], [.59, .12], [.5, .23], [.79, .62], [.83, 1.03], [.61, 1.43],
    [.46, 1.55], [.48, 1.7], [.61, 1.74], [.63, 1.84], [.51, 1.9], [.4, 1.83], [.38, 1.68], [.39, 1.6]].map(([r, y]) => new T.Vector2(r, y));
  const bloomTemplate = gardenFlower(); colorFlower(bloomTemplate, '#eea080', true);
  const petalGeometry = new T.SphereGeometry(1, 7, 5);
  // gardenFlower borrows the global orb sphere; use an owned lighter sphere before batching/disposal.
  bloomTemplate.traverse(node => { if (node instanceof T.Mesh && node.geometry.type === 'SphereGeometry') node.geometry = petalGeometry; });
  for (const [x, z, urn] of [[-8.25, -6.3, 0], [-8.25, 15.65, 1], [13.25, 8, 0], [13.25, 15.65, 1], [13.25, -5.8, 0]]) {
    const planter = new T.Group(); planters.add(planter);
    add(planter, new T.LatheGeometry(urn ? urnProfile : bowlProfile, 20), stone, x, .02, z);
    const rim = add(planter, new T.TorusGeometry(urn ? .54 : 1.02, .085, 5, 24), pale, x, urn ? 1.81 : 1.13, z); rim.rotation.x = Math.PI / 2;
    if (urn) twig(planter, x, .42, z + .81, .8, shade);
    clearHedge(planter);
    if (urn) continue;
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5, bloom = bloomTemplate.clone(true);
      bloom.position.set(x + Math.cos(angle) * .48, 1.12, z + Math.sin(angle) * .45); bloom.scale.setScalar(.62 + (i % 2) * .12); foliage.add(bloom);
    }
  }
  const ivy = (parent: T.Group, x: number, y: number, z: number, length: number, seed: number) => {
    const points = Array.from({ length: 5 }, (_, i) => new T.Vector3(x + Math.sin(i * 1.4 + seed) * .17, y - i * length / 4, z + Math.cos(i + seed) * .08));
    add(parent, new T.TubeGeometry(new T.CatmullRomCurve3(points), 12, .025, 4), green);
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? -1 : 1, p = points[Math.min(4, Math.floor(i / 2))];
      const piece = add(parent, leafVolume, i % 3 ? green : tips, p.x + side * .045, y - i / 10 * length, p.z);
      piece.scale.set(.77, .57, .7);
      piece.rotation.set(Math.sin(i + seed) * .11, Math.cos(i * 2 + seed) * .3, side * (1.9 + Math.sin(i + seed) * .21));
    }
  };
  for (const [x, y, length] of [[1.25, 4.2, 2.4], [2.1, 5.1, 2.3], [3.0, 5.8, 1.8], [6.9, 5.35, 1.1], [8.65, 3.5, 2.1]])
    ivy(arch, x, y, -7.67, length, x);
  for (const [x, z, height] of [[-7.45, -3, 1.7], [-7.45, 12, 1.5], [12.45, 4, 1.8], [12.45, 12.5, 1.2], [9.5, -7.45, 1.5], [3, 17.45, 1.5]])
    ivy(foliage, x, height, z, height - .1, x + z);
  for (const [x, z] of [[-7.44, -1.8], [-7.44, 11.8], [12.44, 4.5], [12.44, 11.8], [9.7, -7.44]]) {
    const bloom = bloomTemplate.clone(true); bloom.position.set(x, .025, z); bloom.scale.setScalar(.24); foliage.add(bloom);
    for (let i = 0; i < 3; i++) {
      const sprig = add(foliage, leafVolume, i % 2 ? tips : green, x, .045, z);
      sprig.scale.set(.35, .29, .5); sprig.rotation.set(-Math.PI / 2 + .25, i * 2.1, i * 2.1);
    }
  }
  clearHedge(arch);

  for (const [x, z, height, radius, base] of [[-2.4, -6, 2.3, .46, 1.45], [10.6, -4.2, 3.8, .53, 1.65]]) {
    const column = new T.Group(); column.position.set(x, 0, z); columns.add(column);
    add(column, new RoundedBoxGeometry(base, .22, base, 1, .075), shade, 0, .11);
    add(column, new RoundedBoxGeometry(base - .18, .23, base - .18, 1, .065), pale, 0, .33);
    const shaftHeight = height - .72;
    for (let i = 0; i < 3; i++) {
      const shaft = add(column, new T.CylinderGeometry(radius - i * .025, radius + .025 - i * .025, shaftHeight / 3 - .025, 8),
        i === 1 ? pale : stone, 0, .45 + (i + .5) * shaftHeight / 3); shaft.rotation.y = Math.PI / 8;
    }
    add(column, new T.CylinderGeometry(radius + .13, radius + .06, .13, 8), pale, 0, height - .26);
    const broken = new T.CylinderGeometry(radius + .12, radius + .13, .25, 8, 1);
    const position = broken.getAttribute('position');
    for (let i = 0; i < position.count; i++) if (position.getY(i) > 0)
      position.setY(i, position.getY(i) + Math.sin(position.getX(i) * 8 + position.getZ(i) * 5 + height) * .085);
    broken.computeVertexNormals(); add(column, broken, stone, 0, height - .11);
    add(column, new T.CylinderGeometry(radius * .65, radius * .69, .035, 8), shade, 0, height - .016);
    twig(column, 0, .72 + shaftHeight * .21, radius + .025, Math.min(.8, shaftHeight * .48), shade);
    ivy(column, radius * .65, height - .32, radius * .76, Math.min(1.28, height * .45), height);
    const chippedTop = height + .085;
    colliders.push({ x, y: .225, z, width: base, height: .45, depth: base, angle: 0 },
      { x, y: (chippedTop + .45) / 2, z, width: (radius + .13) * 2, height: chippedTop - .45, depth: (radius + .13) * 2, angle: 0 });
    clearHedge(column);
  }

  bench.position.set(-3.9, 0, -3.3);
  const arcStone = (inner: number, outer: number, a: number, b: number, depth: number) => {
    const shape = new T.Shape();
    for (let i = 0; i <= 3; i++) {
      const angle = a + (b - a) * i / 3, x = Math.cos(angle) * outer, z = -Math.sin(angle) * outer;
      if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
    }
    for (let i = 3; i >= 0; i--) {
      const angle = a + (b - a) * i / 3; shape.lineTo(Math.cos(angle) * inner, -Math.sin(angle) * inner);
    }
    shape.closePath(); const geometry = extrude(shape, depth, .035); geometry.rotateX(-Math.PI / 2); return geometry;
  };
  for (let i = 0; i < 6; i++) {
    const a = Math.PI + i * Math.PI / 12 + .008, b = Math.PI + (i + 1) * Math.PI / 12 - .008, middle = (a + b) / 2;
    add(bench, arcStone(2.18, 3.0, a, b, .2), i % 3 ? pale : stone, 0, .46);
    add(bench, arcStone(2.81, 3.0, a, b, .57), i % 2 ? stone : pale, 0, .7);
    add(bench, arcStone(2.77, 3.045, a, b, .1), pale, 0, 1.25);
    colliders.push({ x: -3.9 + Math.cos(middle) * 2.62, y: .7, z: -3.3 + Math.sin(middle) * 2.62,
      width: .79, height: 1.4, depth: .94, angle: -middle - Math.PI / 2 });
  }
  for (const angle of [Math.PI + .12, Math.PI * 1.25, Math.PI * 1.5 - .12]) {
    const support = add(bench, new RoundedBoxGeometry(.44, .48, .66, 1, .07), shade,
      Math.cos(angle) * 2.61, .24, Math.sin(angle) * 2.61); support.rotation.y = -angle;
  }
  const benchMedallion = new T.Group(); bench.add(benchMedallion);
  benchMedallion.position.set(-1.99, .76, -1.99); benchMedallion.rotation.y = Math.PI / 4;
  twig(benchMedallion, 0, 0, 0, .44, shade);
  clearHedge(bench);

  pavilion.position.set(13.8, 0, -23.5);
  const roof = material('ruins-aged-sage-roof', '#8d9f84');
  add(pavilion, new T.CylinderGeometry(3.05, 3.12, .22, 8), shade, 0, .11);
  add(pavilion, new T.CylinderGeometry(2.9, 3.02, .16, 8), pale, 0, .3);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4, x = Math.cos(angle) * 2.46, z = Math.sin(angle) * 2.46, broken = i === 1;
    add(pavilion, new RoundedBoxGeometry(.7, .22, .7, 1, .045), stone, x, .48, z);
    const height = broken ? 1.9 : 4.65;
    add(pavilion, new T.CylinderGeometry(.22, .29, height, 8), pale, x, .59 + height / 2, z);
    add(pavilion, new T.CylinderGeometry(broken ? .26 : .38, .31, .21, 8), stone, x, .64 + height, z);
    if (broken) continue;
    const middle = angle + Math.PI / 8;
    if (i === 0) continue;
    const beam = add(pavilion, new RoundedBoxGeometry(1.93, .31, .39, 1, .045), stone,
      Math.cos(middle) * 2.47, 5.43, Math.sin(middle) * 2.47); beam.rotation.y = -middle - Math.PI / 2;
  }
  const dome = new T.SphereGeometry(2.78, 24, 10, 2.8, Math.PI * 2 - .9, 0, Math.PI / 2);
  dome.scale(1, .5, 1); add(pavilion, dome, roof, 0, 5.62);
  for (const angle of [0, 1.55, 2.32, 3.1, 3.88, 4.65, 5.45]) {
    const points = Array.from({ length: 7 }, (_, j) => {
      const t = j * Math.PI / 12; return new T.Vector3(Math.cos(angle) * Math.sin(t) * 2.79,
        5.62 + Math.cos(t) * 1.4, Math.sin(angle) * Math.sin(t) * 2.79);
    });
    add(pavilion, new T.TubeGeometry(new T.CatmullRomCurve3(points), 9, .035, 4), shade);
  }
  add(pavilion, new T.CylinderGeometry(.09, .18, .21, 8), stone, 0, 7.1);
  for (const angle of [.65, 2.9, 4.55]) ivy(pavilion, Math.cos(angle) * 2.48, 5.6, Math.sin(angle) * 2.48, 1.7, angle);
  clearHedge(pavilion);
  // Batch within named components so camera occlusion can fade tall scenery independently.
  for (const component of root.children) {
    component.updateMatrixWorld(true);
    const inverse = component.matrixWorld.clone().invert(), batches = new Map<T.Material, T.BufferGeometry[]>(), originals = new Set<T.BufferGeometry>();
    component.traverse(node => {
      if (!(node instanceof T.Mesh)) return;
      const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
      geometry.applyMatrix4(inverse.clone().multiply(node.matrixWorld)); geometry.deleteAttribute('uv');
      originals.add(node.geometry);
      const surface = node.material as T.Material;
      if (!batches.has(surface)) batches.set(surface, []); batches.get(surface)!.push(geometry);
    });
    component.clear();
    for (const [surface, geometries] of batches) {
      const merged = mergeGeometries(geometries)!, mesh = new T.Mesh(mergeVertices(merged), surface); merged.dispose();
      mesh.name = surface.name; mesh.castShadow = component !== paving; mesh.receiveShadow = true; component.add(mesh);
      geometries.forEach(geometry => geometry.dispose());
    }
    originals.forEach(geometry => geometry.dispose());
  }
  leaf.dispose(); leafVolume.dispose(); template = root;
  return root.clone(true);
}
