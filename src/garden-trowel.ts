import * as T from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const metal = new T.MeshStandardMaterial({ color: '#98b7e2', metalness: .42, roughness: .34 });
const rimMetal = new T.MeshStandardMaterial({ color: '#c3d0df', metalness: .45, roughness: .3 });
const grain = new Uint8Array(128 * 256 * 4);
for (let y = 0; y < 256; y++) for (let x = 0; x < 128; x++) {
  const variation = Math.sin(x * .52 + Math.sin(y * .025) * 2) * 3 + Math.sin(x * .13 + Math.sin(y * .011) * 4) * 4;
  const i = (y * 128 + x) * 4;
  grain[i] = 214 + variation; grain[i + 1] = 159 + variation; grain[i + 2] = 91 + variation; grain[i + 3] = 255;
}
const woodMap = new T.DataTexture(grain, 128, 256);
woodMap.colorSpace = T.SRGBColorSpace; woodMap.magFilter = T.LinearFilter; woodMap.needsUpdate = true;
const wood = new T.MeshStandardMaterial({ map: woodMap, roughness: .65 });

const gripShape = new T.Shape();
gripShape.moveTo(-.078, .94);
gripShape.bezierCurveTo(-.115, 1.0, -.15, 1.35, -.15, 1.48);
gripShape.bezierCurveTo(-.15, 1.7, .15, 1.7, .15, 1.48);
gripShape.bezierCurveTo(.15, 1.35, .115, 1.0, .078, .94);
gripShape.bezierCurveTo(.065, .885, -.065, .885, -.078, .94);
const hole = new T.Path(); hole.absarc(0, 1.5, .048, 0, Math.PI * 2, true); gripShape.holes.push(hole);
const gripBuffer = new T.ExtrudeGeometry(gripShape, { depth: .14, bevelEnabled: true, bevelSize: .018, bevelThickness: .055, bevelSegments: 6, curveSegments: 24, steps: 1 });
gripBuffer.translate(0, 0, -.07);
const gripPositions = gripBuffer.attributes.position, gripUV = gripBuffer.attributes.uv;
for (let i = 0; i < gripPositions.count; i++) gripUV.setXY(i, (gripPositions.getX(i) + .18) / .36, (gripPositions.getY(i) - .9) / .78);
gripBuffer.deleteAttribute('normal');
const gripGeometry = mergeVertices(gripBuffer); gripGeometry.computeVertexNormals(); gripBuffer.dispose();

const profile = new T.SplineCurve([
  new T.Vector2(.018, .012), new T.Vector2(.075, .05), new T.Vector2(.18, .15),
  new T.Vector2(.275, .3), new T.Vector2(.29, .46), new T.Vector2(.25, .59),
  new T.Vector2(.16, .66), new T.Vector2(.075, .71), new T.Vector2(.052, .79),
]);
const rows = 40, across = 24, ring = (across + 1) * 2 + 2;
const vertices: number[] = [], indices: number[] = [], lip: T.Vector3[] = [];
function scoop(x: number, y: number, width: number) {
  const u = x / width, bowl = Math.sin(Math.PI * T.MathUtils.clamp(y / .79, 0, 1));
  return (.105 * u * u - .065 + .018 * Math.exp(-u * u * 65)) * bowl + .01;
}
for (let row = 0; row <= rows; row++) {
  const p = profile.getPoint(row / rows), width = p.x, y = p.y;
  for (let i = 0; i <= across; i++) {
    const x = (width - .008) * (i / across * 2 - 1);
    vertices.push(x, y, scoop(x, y, width) + .014);
  }
  vertices.push(width, y, scoop(width, y, width));
  for (let i = across; i >= 0; i--) {
    const x = (width - .008) * (i / across * 2 - 1);
    vertices.push(x, y, scoop(x, y, width) - .014);
  }
  vertices.push(-width, y, scoop(-width, y, width));
  lip.push(new T.Vector3(-width + .006, y, scoop(-width + .006, y, width) + .014));
  if (row < rows) for (let i = 0; i < ring; i++) {
    const a = row * ring + i, b = row * ring + (i + 1) % ring;
    indices.push(a, b, a + ring, b, b + ring, a + ring);
  }
}
for (const row of [0, rows]) {
  const p = profile.getPoint(row / rows), center = vertices.length / 3;
  vertices.push(0, p.y, scoop(0, p.y, p.x));
  for (let i = 0; i < ring; i++) {
    const a = row * ring + i, b = row * ring + (i + 1) % ring;
    indices.push(center, row ? a : b, row ? b : a);
  }
}
for (let row = rows; row >= 0; row--) {
  const p = profile.getPoint(row / rows);
  lip.push(new T.Vector3(p.x - .006, p.y, scoop(p.x - .006, p.y, p.x) + .014));
}
// Both surfaces and the edge share vertices so the scoop has thickness and smooth normals.
const bladeGeometry = new T.BufferGeometry();
bladeGeometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); bladeGeometry.setIndex(indices); bladeGeometry.computeVertexNormals();
const rimGeometry = new T.TubeGeometry(new T.CatmullRomCurve3(lip, true, 'centripetal'), 128, .008, 6, true);
const neckGeometry = new T.TubeGeometry(new T.CatmullRomCurve3([
  new T.Vector3(0, .75, .01), new T.Vector3(0, .81, -.005), new T.Vector3(0, .87, 0), new T.Vector3(0, .94, 0),
]), 20, .043, 16, false);
const collarGeometry = new T.CylinderGeometry(.105, .088, .055, 32);

export function createGardenTrowel(): T.Group {
  const root = new T.Group(); root.name = 'garden-trowel';
  for (const [name, geometry, material] of [
    ['trowel-blade', bladeGeometry, metal], ['trowel-rim', rimGeometry, rimMetal],
    ['trowel-neck', neckGeometry, metal], ['trowel-grip', gripGeometry, wood], ['trowel-collar', collarGeometry, rimMetal],
  ] as const) {
    const mesh = new T.Mesh(geometry, material); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true;
    if (name === 'trowel-collar') mesh.position.y = .897;
    root.add(mesh);
  }
  return root;
}
