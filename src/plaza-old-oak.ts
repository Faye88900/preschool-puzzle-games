import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

let template: T.Group | undefined;

export function createPlazaOldOak(): T.Group {
  if (template) return template.clone(true);
  const root = new T.Group(); root.name = 'plaza-old-oak';
  const timber: T.BufferGeometry[] = [], foliage: T.BufferGeometry[] = [];
  const bark = new T.Color('#8c643d'), barkDark = new T.Color('#694a30');
  const greens = ['#759442', '#88a74e', '#64853b', '#95b65a'].map(color => new T.Color(color));
  const tint = (geometry: T.BufferGeometry, color: T.Color, shade: (i: number) => number) => {
    const colors: number[] = [];
    for (let i = 0; i < geometry.attributes.position.count; i++) {
      const light = shade(i); colors.push(color.r * light, color.g * light, color.b * light);
    }
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); return geometry;
  };
  const branch = (points: number[][], radius: number, endRadius: number, segments = 20, color = bark) => {
    const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(p[0], p[1], p[2])));
    const geometry = new T.TubeGeometry(curve, segments, 1, 12, false), vertices = geometry.attributes.position;
    for (let ring = 0; ring <= segments; ring++) {
      const t = ring / segments, center = curve.getPointAt(t), width = T.MathUtils.lerp(radius, endRadius, Math.pow(t, .8));
      for (let side = 0; side <= 12; side++) {
        const i = ring * 13 + side, angle = side * Math.PI / 6;
        const ridge = 1 + Math.cos(angle * 6 + t * 2) * .055 + Math.sin(angle * 3 - t * 5) * .025;
        const p = new T.Vector3().fromBufferAttribute(vertices, i).sub(center).multiplyScalar(width * ridge).add(center);
        vertices.setXYZ(i, p.x, Math.max(0, p.y), p.z);
      }
    }
    geometry.computeVertexNormals();
    tint(geometry, color, i => .91 + .12 * Math.sin(i % 13 * Math.PI / 6 + .6) + .04 * Math.sin(Math.floor(i / 13) * .8));
    timber.push(geometry);
  };
  branch([[0, 0, 0], [0, .45, 0], [-.08, 1.5, .04], [.18, 2.8, -.04], [-.12, 4.1, -.12], [-.4, 5.8, -.3]], .70, .22, 36);
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI * 2 / 7 + .23, x = Math.sin(angle), z = Math.cos(angle), length = 1.35 + (i % 3) * .12;
    branch([[x * .28, .42, z * .28], [x * .71, .18, z * .71], [x * length, .03, z * length]], .24, .035, 12);
  }
  branch([[.03, 2.9, 0], [-.8, 4.35, .23], [-1.9, 5.45, .35], [-3, 6.8, .15]], .40, .065);
  branch([[.12, 3.3, -.05], [.85, 4.7, -.3], [1.9, 5.7, -.18], [2.8, 7, .1]], .37, .06);
  branch([[-.1, 4, -.1], [-.3, 5.2, -1.2], [-1.2, 6.9, -2.05]], .28, .055);
  branch([[.05, 4.05, .1], [.3, 5.15, 1.04], [1.12, 6.65, 1.7]], .25, .05);
  branch([[-.3, 4.9, -.2], [-.12, 6.4, -.55], [.3, 7.8, -.4], [.08, 9.1, -.15]], .24, .035);
  branch([[-1.8, 5.3, .3], [-1.8, 6.5, 1.1], [-1.5, 7.2, 1.65]], .14, .035, 16);
  branch([[1.9, 5.7, -.2], [2.2, 6.5, -1.1], [2.4, 7.2, -1.5]], .15, .035, 16);
  branch([[-.4, 5.7, -.3], [-1.25, 7.1, -.4], [-1.5, 8.4, -.5]], .19, .035, 18);
  const anchor = new T.Object3D(); anchor.name = 'garden-chime-anchor'; anchor.position.set(1.476, 5.33, 3.936); root.add(anchor);
  branch([[.16, 3.03, .03], [.36, 3.95, 1.1], [.94, 4.95, 2.7], anchor.position.toArray()], .16, .035, 28);
  const tip = new T.SphereGeometry(.038, 12, 8); tip.translate(...anchor.position.toArray() as [number, number, number]);
  tint(tip, bark, () => 1); timber.push(tip);
  const knot = new T.TorusGeometry(.115, .027, 7, 18); knot.scale(1, 1.5, .6); knot.translate(.25, 2.45, .42);
  tint(knot, barkDark, () => 1); timber.push(knot);

  const cushions = [
    [-1.15, 8.7, -.45, 1.65, 1.36, 1.45], [.65, 9.0, -.65, 1.65, 1.38, 1.50],
    [1.6, 8.35, .65, 1.55, 1.30, 1.50], [-2.1, 7.9, .05, 1.65, 1.40, 1.55],
    [-.25, 7.8, 1.32, 1.65, 1.38, 1.48], [2.65, 7.55, .12, 1.55, 1.32, 1.52],
    [-2.85, 6.85, .16, 1.38, 1.30, 1.42], [1.4, 7.05, 1.52, 1.53, 1.16, 1.35],
    [-1.5, 6.85, 1.5, 1.60, 1.25, 1.37], [-.95, 7.35, -1.77, 1.57, 1.38, 1.50],
    [1.25, 7.65, -1.7, 1.60, 1.38, 1.45], [-2.5, 7.08, -1.45, 1.45, 1.25, 1.35],
    [2.3, 6.8, -1.24, 1.4, 1.25, 1.35], [.25, 9.65, -.2, 1.4, 1.18, 1.35],
    [-1.7, 9.08, -1.12, 1.35, 1.23, 1.27],
  ];
  for (const [index, [x, y, z, sx, sy, sz]] of cushions.entries()) {
    const geometry = new T.SphereGeometry(1, 18, 12), vertices = geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const px = vertices.getX(i), py = vertices.getY(i), pz = vertices.getZ(i), angle = Math.atan2(pz, px);
      const ripple = 1 + (Math.sin(angle * 5 + py * 4 + index) * .075 + Math.cos(angle * 8 - py * 5) * .035) * (1 - py * py);
      vertices.setXYZ(i, x + px * sx * ripple, y + py * sy * (1 + .035 * Math.sin(angle * 3)), z + pz * sz * ripple);
    }
    geometry.computeVertexNormals();
    tint(geometry, greens[index % greens.length], i => .91 + .10 * (vertices.getY(i) - y) / sy + .025 * Math.sin(vertices.getX(i) * 6 + vertices.getZ(i) * 5));
    foliage.push(geometry);
  }

  // Folded leaf sprays break up the large canopy silhouette without alpha cards or extra draw calls.
  const leaf = new T.BufferGeometry(), positions: number[] = [], indices: number[] = [];
  for (let row = 0; row <= 8; row++) {
    const t = row / 8, width = Math.sin(t * Math.PI) * (.16 + .035 * Math.cos(t * Math.PI * 6));
    positions.push(-width, t * .68, 0, 0, t * .68, Math.sin(t * Math.PI) * .07, width, t * .68, 0);
    if (row < 8) for (let side = 0; side < 2; side++) {
      const i = row * 3 + side; indices.push(i, i + 1, i + 3, i + 1, i + 4, i + 3);
    }
  }
  leaf.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); leaf.setIndex(indices); leaf.computeVertexNormals();
  leaf.setAttribute('uv', new T.Float32BufferAttribute(positions.flatMap((_, i) => i % 3 ? [] : [.5, positions[i + 1] / .68]), 2));
  for (let i = 0; i < 26; i++) {
    const angle = i * 2.399963, x = Math.sin(angle) * (3.30 + i % 3 * .13), z = Math.cos(angle) * 2.73;
    const y = 6.8 + (i % 5) * .39;
    for (let j = 0; j < 3; j++) {
      const geometry = leaf.clone(), rotation = new T.Euler(.25 + Math.cos(angle) * .65, -angle, (j - 1) * .8);
      geometry.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(rotation), new T.Vector3(1, 1, 1)));
      tint(geometry, greens[(i + j + 1) % greens.length], k => k % 3 === 1 ? 1.12 : .96); foliage.push(geometry);
    }
  }
  leaf.dispose();
  const pixels = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const stripe = Math.sin(x * .55 + Math.sin(y * .035) * 1.5) * 9 + Math.sin(x * .17 - y * .014) * 5;
    const i = (y * 128 + x) * 4; pixels.set([239 + stripe, 235 + stripe, 223 + stripe, 255], i);
  }
  const map = new T.DataTexture(pixels, 128, 128); map.colorSpace = T.SRGBColorSpace; map.magFilter = T.LinearFilter; map.needsUpdate = true;
  const trunkMaterial = new T.MeshStandardMaterial({ vertexColors: true, roughness: .92, map }); trunkMaterial.name = 'old-oak-bark';
  const crownMaterial = new T.MeshStandardMaterial({ vertexColors: true, roughness: .96, side: T.DoubleSide }); crownMaterial.name = 'old-oak-foliage';
  for (const [parts, surface, name] of [[timber, trunkMaterial, 'plaza-oak-trunk'], [foliage, crownMaterial, 'plaza-oak-crown']] as const) {
    const merged = mergeGeometries(parts.map(geometry => geometry.index ? geometry.toNonIndexed() : geometry))!;
    const mesh = new T.Mesh(mergeVertices(merged), surface); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    merged.dispose(); parts.forEach(geometry => geometry.dispose());
  }
  template = root; return root.clone(true);
}
