import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

let template: T.Group | undefined;

export function createWoodWindChime(): T.Group {
  if (template) return template.clone(true);
  const root = new T.Group(); root.name = 'garden-wood-wind-chime';
  const pixels = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const shade = Math.sin(x * .42 + Math.sin(y * .035) * 2) * 4 + Math.sin(x * .14 + y * .012) * 3;
    pixels.set([247 + shade, 229 + shade, 202 + shade, 255], (y * 128 + x) * 4);
  }
  const grain = new T.DataTexture(pixels, 128, 128); grain.colorSpace = T.SRGBColorSpace;
  grain.magFilter = T.LinearFilter; grain.needsUpdate = true;
  const material = (name: string, color: string, map?: T.Texture) => {
    const surface = new T.MeshStandardMaterial({ color, map, roughness: .82 }); surface.name = name; return surface;
  };
  const wood = material('chime-honey-wood', '#d39b57', grain), ends = material('chime-endgrain', '#ba8142', grain);
  const rope = material('chime-jute', '#bca17b'), veins = material('chime-leaf-veins', '#8e6035');
  const add = (parent: T.Group, geometry: T.BufferGeometry, surface: T.Material, x = 0, y = 0, z = 0) => {
    const mesh = new T.Mesh(geometry, surface); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  const cord = (parent: T.Group, points: number[][], radius = .0026, segments = 16, surface = rope) =>
    add(parent, new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p as [number, number, number]))), segments, radius, 6, false), surface);
  const knot = new T.TorusGeometry(.006, .0027, 6, 12);
  const loop = Array.from({ length: 33 }, (_, i) => {
    const angle = i * Math.PI / 16; return [Math.sin(angle) * .026, Math.cos(angle) * .045, 0];
  });
  cord(root, loop, .0035, 40);
  add(root, knot, rope, 0, -.049, 0);
  const ringProfile = [[.106, -.008], [.108, -.012], [.130, -.012], [.134, -.007], [.134, .007], [.130, .012], [.108, .012], [.106, .008], [.106, -.008]];
  add(root, new T.LatheGeometry(ringProfile.map(([r, y]) => new T.Vector2(r, y)), 40), wood, 0, -.24, 0);
  const angles = [7 * Math.PI / 6, Math.PI / 2, 11 * Math.PI / 6];
  for (const angle of angles) {
    const x = Math.cos(angle) * .12, z = Math.sin(angle) * .12;
    cord(root, [[0, -.049, 0], [x * .5, -.14, z * .5], [x, -.229, z]], .0028, 12);
    const tie = add(root, knot, rope, x, -.24, z); tie.rotation.x = Math.PI / 2;
  }

  // Only the small upper collar is extruded, so its suspension bore is genuinely open.
  const collar = new T.Shape();
  collar.moveTo(-.017, -.055); collar.lineTo(.017, -.055); collar.quadraticCurveTo(.024, -.055, .024, -.048);
  collar.lineTo(.024, -.007); collar.quadraticCurveTo(.024, 0, .017, 0); collar.lineTo(-.017, 0);
  collar.quadraticCurveTo(-.024, 0, -.024, -.007); collar.lineTo(-.024, -.048); collar.quadraticCurveTo(-.024, -.055, -.017, -.055);
  const bore = new T.Path(); bore.absarc(0, -.018, .0085, 0, Math.PI * 2, true); collar.holes.push(bore);
  const collarGeometry = new T.ExtrudeGeometry(collar, { depth: .038, bevelEnabled: true, bevelSize: .003, bevelThickness: .003, bevelSegments: 2, curveSegments: 16, steps: 1 });
  const collarVertices = collarGeometry.attributes.position;
  for (let i = 0; i < collarVertices.count; i++) {
    const x = T.MathUtils.clamp(collarVertices.getX(i) / .027, -1, 1), z = T.MathUtils.clamp((collarVertices.getZ(i) - .019) / .022, -1, 1);
    collarVertices.setXYZ(i, .028 * x * Math.sqrt(1 - z * z / 2), collarVertices.getY(i), .028 * z * Math.sqrt(1 - x * x / 2));
  }
  collarGeometry.deleteAttribute('normal'); collarGeometry.deleteAttribute('uv');
  const upper = mergeVertices(collarGeometry); collarGeometry.dispose(); upper.computeVertexNormals();
  const upperUV = [];
  for (let i = 0; i < upper.attributes.position.count; i++) {
    const p = upper.attributes.position;
    upperUV.push(Math.atan2(p.getZ(i), p.getX(i)) / (Math.PI * 2) + .5, -p.getY(i) / .055);
  }
  upper.setAttribute('uv', new T.Float32BufferAttribute(upperUV, 2));
  for (let i = 0; i < 3; i++) {
    const tube = new T.Group(); tube.name = 'chime-tube-' + i;
    tube.position.set(Math.cos(angles[i]) * .12, -.253, Math.sin(angles[i]) * .12); root.add(tube);
    const top = [-.065, -.086, -.070][i], length = [.235, .285, .25][i];
    const body = new T.LatheGeometry([[0, -length], [.018, -length], [.025, -length + .003], [.028, -length + .01], [.028, -.055], [0, -.055]].map(([r, y]) => new T.Vector2(r, y)), 24);
    add(tube, body, wood, 0, top, 0); add(tube, upper, wood, 0, top, 0);
    cord(tube, [[0, 0, 0], [0, -.03, .027], [0, top - .018, .030], [0, top - .018, -.030], [0, -.03, -.027], [0, 0, 0]], .0025, 28);
    add(tube, knot, rope, 0, -.006, 0);
  }

  const clapper = new T.Group(); clapper.name = 'chime-clapper'; clapper.position.y = -.24; root.add(clapper);
  cord(clapper, [[0, 0, 0], [0, -.16, 0], [0, -.34, 0]], .0025, 12);
  add(clapper, new T.SphereGeometry(.020, 16, 10), ends, 0, -.16, 0);
  const sail = new T.Group(); sail.name = 'chime-leaf-sail'; sail.position.y = -.34; clapper.add(sail);
  const leaf = new T.Shape(); leaf.moveTo(0, -.037);
  leaf.bezierCurveTo(.043, -.061, .041, -.105, 0, -.147); leaf.bezierCurveTo(-.041, -.105, -.043, -.061, 0, -.037);
  const leafHole = new T.Path(); leafHole.absarc(0, -.052, .0038, 0, Math.PI * 2, true); leaf.holes.push(leafHole);
  add(sail, new T.ExtrudeGeometry(leaf, { depth: .006, bevelEnabled: true, bevelSize: .0014, bevelThickness: .0014, bevelSegments: 2, curveSegments: 12, steps: 1 }), wood, 0, 0, -.003);
  cord(sail, [[0, 0, 0], [0, -.049, .008], [0, -.052, -.008], [0, 0, 0]], .0021, 18);
  for (const sign of [-1, 1]) {
    cord(sail, [[0, -.059, sign * .005], [0, -.093, sign * .006], [0, -.132, sign * .005]], .0013, 8, veins);
    for (const y of [-.080, -.103]) for (const side of [-1, 1])
      cord(sail, [[0, y - .01, sign * .0055], [side * .014, y, sign * .0055]], .001, 4, veins);
  }

  // Batch static parts inside each pivot, retaining separate pivots for gentle wind motion.
  const batch = (parent: T.Group) => {
    const geometries = new Map<T.Material, T.BufferGeometry[]>(), originals = new Set<T.BufferGeometry>();
    for (const node of [...parent.children]) {
      if (!(node instanceof T.Mesh)) continue;
      node.updateMatrix(); const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
      geometry.applyMatrix4(node.matrix); originals.add(node.geometry); parent.remove(node);
      const surface = node.material as T.Material;
      if (!geometries.has(surface)) geometries.set(surface, []); geometries.get(surface)!.push(geometry);
    }
    for (const [surface, parts] of geometries) {
      const merged = mergeGeometries(parts)!; const mesh = new T.Mesh(mergeVertices(merged), surface); merged.dispose();
      mesh.name = surface.name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); parts.forEach(g => g.dispose());
    }
    originals.forEach(g => g.dispose());
  };
  root.children.filter(node => node instanceof T.Group).forEach(node => {
    node.children.filter(child => child instanceof T.Group).forEach(child => batch(child as T.Group)); batch(node as T.Group);
  });
  batch(root); template = root; return root.clone(true);
}

export function animateWoodWindChime(root: T.Group, time: number, reducedMotion: boolean) {
  const motion = reducedMotion ? 0 : 1;
  root.rotation.z = Math.sin(time * .85) * .025 * motion;
  for (let i = 0; i < 3; i++) {
    const tube = root.getObjectByName('chime-tube-' + i)!;
    tube.rotation.z = Math.sin(time * 1.25 + i * 1.3) * .035 * motion;
    tube.rotation.x = Math.sin(time * 1.05 + i * .8) * .018 * motion;
  }
  root.getObjectByName('chime-clapper')!.rotation.z = Math.sin(time * 1.1 + .4) * .055 * motion;
  root.getObjectByName('chime-leaf-sail')!.rotation.y = Math.sin(time * .95) * .16 * motion;
}
