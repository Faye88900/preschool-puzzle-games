import * as T from 'three';

const wood = new T.MeshStandardMaterial({ color: '#d9a463', roughness: .68 });
const cream = new T.MeshStandardMaterial({ color: '#fff0ce', roughness: .48 });
const mint = new T.MeshStandardMaterial({ color: '#79cdbd', roughness: .42 });
const lavender = new T.MeshStandardMaterial({ color: '#b6a0d4', roughness: .46 });
const ball = new T.SphereGeometry(1, 16, 10);
const cylinder = new T.CylinderGeometry(1, 1, 1, 16);
const shaft = new T.LatheGeometry([
  new T.Vector2(0, -.43), new T.Vector2(.036, -.43), new T.Vector2(.048, -.40),
  new T.Vector2(.049, .67), new T.Vector2(.064, .72), new T.Vector2(.053, .77), new T.Vector2(0, .78),
], 16);
// A small flat cap at each end keeps the crystal faceted without needle points.
const crystalGeometry = new T.LatheGeometry([
  new T.Vector2(0, -.29), new T.Vector2(.025, -.29), new T.Vector2(.045, -.275),
  new T.Vector2(.145, -.12), new T.Vector2(.145, .13),
  new T.Vector2(.04, .275), new T.Vector2(.023, .29), new T.Vector2(0, .29),
], 6);
const ribbonPoints = Array.from({ length: 33 }, (_, i) => {
  const t = i / 32, angle = t * Math.PI * 2 - .6;
  return new T.Vector3(Math.cos(angle) * .176, .24 - t * .48, Math.sin(angle) * .176);
});
const ribbonGeometry = new T.TubeGeometry(new T.CatmullRomCurve3(ribbonPoints), 48, .023, 6, false);

function part(parent: T.Object3D, name: string, geometry: T.BufferGeometry, material: T.Material,
  x: number, y: number, z: number, sx = 1, sy = sx, sz = sx) {
  const mesh = new T.Mesh(geometry, material); mesh.name = name;
  mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true; parent.add(mesh); return mesh;
}

export function createWindWand(): T.Group {
  const root = new T.Group(); root.name = 'wind-wand';
  part(root, 'wood-shaft', shaft, wood, 0, 0, 0);
  part(root, 'grip', cylinder, mint, 0, .005, 0, .068, .34, .068);
  for (const y of [-.165, .175]) part(root, 'grip-edge', ball, mint, 0, y, 0, .068, .026, .068);
  part(root, 'grip-band', cylinder, lavender, 0, -.015, 0, .074, .065, .074);
  part(root, 'rounded-foot', ball, cream, 0, -.395, 0, .076, .08, .076);
  part(root, 'neck-collar', ball, cream, 0, .71, 0, .088, .045, .088);
  const bud = part(root, 'mint-bud', ball, mint, 0, .785, -.055, .078, .12, .045);
  bud.rotation.z = -.2;
  for (const side of [-1, 1]) {
    const fork = part(root, 'cream-fork', ball, cream, side * .065, .855, 0, .055, .13, .065);
    fork.rotation.z = -side * .55;
    const curve = new T.CatmullRomCurve3([
      new T.Vector3(side * .09, .86, .035), new T.Vector3(side * .22, .96, .035),
      new T.Vector3(side * .255, 1.085, .035),
    ]);
    part(root, 'lavender-wing', new T.TubeGeometry(curve, 12, .057, 8, false), lavender, 0, 0, 0);
    part(root, 'rounded-wing-tip', ball, lavender, side * .255, 1.085, .035, .057);
  }
  const coreMaterial = new T.MeshStandardMaterial({ color: '#91e4eb', emissive: '#3cbacb',
    emissiveIntensity: .16, roughness: .24, metalness: .08, flatShading: true });
  const crystal = part(root, 'wind-core', crystalGeometry, coreMaterial, 0, 1.105, 0);
  crystal.rotation.y = Math.PI / 6;
  const ribbon = new T.Group(); ribbon.name = 'wind-ribbon'; ribbon.position.y = 1.105; root.add(ribbon);
  part(ribbon, 'wind-spiral', ribbonGeometry, mint, 0, 0, 0);
  for (const [i, p] of [ribbonPoints[0], ribbonPoints.at(-1)!].entries()) {
    part(ribbon, `rounded-ribbon-tip-${i}`, ball, mint, p.x, p.y, p.z, .023);
  }
  return root;
}

export function animateWindWand(wand: T.Group, dt: number, windTime: number, reducedMotion: boolean) {
  const core = wand.getObjectByName('wind-core') as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
  core.material.emissiveIntensity = .16 + T.MathUtils.clamp(windTime / .5, 0, 1) * .6;
  if (!reducedMotion) wand.getObjectByName('wind-ribbon')!.rotation.y += dt * (windTime > 0 ? 7 : .3);
}
