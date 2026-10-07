import * as T from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export type Expression = 'neutral' | 'happy' | 'surprised' | 'determined';
const palette = { body: '#f2eaf7', rim: '#b5a1d5', inset: '#bfe5d9', feet: '#a68ac9' };
const ball = new T.SphereGeometry(1, 40, 28);
const skin = new T.MeshStandardMaterial({ color: palette.body, roughness: .44 });
const rim = new T.MeshStandardMaterial({ color: palette.rim, roughness: .4 });
const mint = new T.MeshPhysicalMaterial({ color: palette.inset, roughness: .36, clearcoat: .3 });
const feetMaterial = new T.MeshStandardMaterial({ color: palette.feet, roughness: .35 });
const white = new T.MeshStandardMaterial({ color: '#f9fffc', roughness: .4 });
const faceMaterials = new Map<Expression, T.MeshStandardMaterial>();

// Curved decals follow the sphere: eyes and blush cannot float off the face in profile.
const faceGeometry = new T.SphereGeometry(.572, 48, 36, Math.PI * .18, Math.PI * .64, Math.PI * .23, Math.PI * .54);
faceGeometry.rotateY(Math.PI);
function faceMaterial(expression: Expression) {
  if (faceMaterials.has(expression)) return faceMaterials.get(expression)!;
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 768;
  const c = canvas.getContext('2d')!;
  const ellipse = (x: number, y: number, rx: number, ry: number, color: string | CanvasGradient) => {
    c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
  };
  for (const x of [225, 799]) {
    const blush = c.createRadialGradient(x, 476, 2, x, 476, 83);
    blush.addColorStop(0, '#dec1e3bb'); blush.addColorStop(1, '#dec1e300');
    ellipse(x, 476, 83, 46, blush);
  }
  for (const x of [350, 674]) {
    if (expression === 'happy') {
      c.strokeStyle = '#352565'; c.lineWidth = 19; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x - 55, 334); c.quadraticCurveTo(x, 230, x + 55, 334); c.stroke();
      continue;
    }
    c.save();
    if (expression === 'determined') {
      c.beginPath(); c.moveTo(x - 88, x < 512 ? 225 : 292); c.lineTo(x + 88, x < 512 ? 292 : 225);
      c.lineTo(x + 88, 460); c.lineTo(x - 88, 460); c.closePath(); c.clip();
    }
    ellipse(x, 300, 112, 153, '#75628f');
    ellipse(x, 303, 106, 146, '#fffaff');
    const iris = c.createLinearGradient(0, 167, 0, 435);
    iris.addColorStop(0, '#221639'); iris.addColorStop(.5, '#352565'); iris.addColorStop(1, '#8c9de5');
    ellipse(x + (x < 512 ? 9 : -9), 300, 86, 139, iris);
    ellipse(x, 295, 39, 85, '#231940');
    ellipse(x - 14, 225, 28, 33, '#ffffff');
    ellipse(x + 24, 405, 12, 16, '#bbf4f6');
    c.restore();
  }
  c.fillStyle = '#452345'; c.beginPath();
  if (expression === 'surprised') c.ellipse(512, 492, 32, 43, 0, 0, Math.PI * 2);
  else { c.moveTo(463, 470); c.quadraticCurveTo(512, 483, 561, 470); c.bezierCurveTo(558, 560, 466, 560, 463, 470); }
  c.fill();
  if (expression !== 'surprised') ellipse(512, 526, 28, 15, '#d68fb8');
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
  const material = new T.MeshStandardMaterial({ map: texture, roughness: .44, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  faceMaterials.set(expression, material); return material;
}

function wingGeometry() {
  const s = new T.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(.28, .015, .46, .18, .46, .36);
  s.bezierCurveTo(.47, .49, .40, .53, .32, .49);
  s.bezierCurveTo(.40, .76, .27, .94, .14, .91);
  s.bezierCurveTo(-.07, .86, -.13, .26, 0, 0);
  const geometry = new T.ExtrudeGeometry(s, { depth: .045, steps: 1, curveSegments: 24, bevelEnabled: true, bevelSegments: 5, bevelSize: .035, bevelThickness: .035 });
  geometry.deleteAttribute('uv'); geometry.deleteAttribute('normal');
  const smooth = mergeVertices(geometry); smooth.computeVertexNormals(); geometry.dispose(); return smooth;
}
const wing = wingGeometry();

export function createPlayerCharacter() {
  const root = new T.Group(); root.name = 'character-a';
  const avatar = new T.Group(); avatar.name = 'avatar'; root.add(avatar);
  const ellipsoid = (parent: T.Object3D, material: T.Material, name: string, position: number[], scale: number[]) => {
    const mesh = new T.Mesh(ball, material); mesh.name = name;
    mesh.position.fromArray(position); mesh.scale.fromArray(scale); parent.add(mesh); return mesh;
  };
  ellipsoid(avatar, skin, 'body', [0, 0, 0], [.56, .56, .53]);
  const face = new T.Mesh(faceGeometry, faceMaterial('neutral')); face.name = 'face'; face.scale.z = .53 / .56; avatar.add(face);
  for (const side of [-1, 1]) {
    const ear = new T.Group(); ear.name = 'ear' + side; ear.position.set(side * .36, .22, .10); ear.rotation.z = -side * .22; ear.scale.set(.9, .78, 1); avatar.add(ear);
    const shape = new T.Group(); shape.scale.x = side; ear.add(shape);
    shape.add(new T.Mesh(wing, rim));
    const inset = new T.Mesh(wing, mint); inset.scale.set(.77, .81, .35); inset.position.set(.035, .077, -.049); shape.add(inset);
    for (const [x, y, r] of [[.18, .63, .062], [.25, .32, .068]]) {
      ellipsoid(shape, white, 'wing-spot', [x, y, -.080], [r, r, .008]);
    }
    const arm = new T.Group(); arm.name = 'arm' + side; arm.position.set(side * .49, -.13, 0); avatar.add(arm);
    ellipsoid(arm, skin, 'hand', [side * .11, 0, -.015], [.17, .16, .17]);
    ellipsoid(avatar, feetMaterial, 'foot' + side, [side * .30, -.535, -.13], [.235, .145, .31]);
  }
  avatar.traverse(node => { if (node instanceof T.Mesh && node !== face) node.castShadow = true; });
  const marker = new T.Group(); marker.name = 'player-marker'; root.add(marker);
  const ring = new T.Mesh(new T.TorusGeometry(.68, .025, 6, 48), new T.MeshBasicMaterial({ color: '#fff0ad' }));
  ring.rotation.x = Math.PI / 2; ring.position.y = -.635; marker.add(ring);
  const arrow = new T.Mesh(new T.ConeGeometry(.19, .28, 3), new T.MeshBasicMaterial({ color: '#ffda39' }));
  arrow.rotation.z = Math.PI; arrow.position.y = 1.65; marker.add(arrow);
  return root;
}

export function setCharacterExpression(root: T.Group, expression: Expression) {
  if (root.userData.expression === expression) return;
  const face = root.getObjectByName('face') as T.Mesh;
  face.material = faceMaterial(expression);
  root.userData.expression = expression;
}

export function animateCharacterDetails(root: T.Group, gait: number, speed: number, grounded: boolean, reducedMotion: boolean, blend: number) {
  const avatar = root.getObjectByName('avatar')!;
  if (!reducedMotion && grounded && root.userData.wasGrounded === false) root.userData.squash = .85;
  root.userData.wasGrounded = grounded;
  root.userData.squash = T.MathUtils.lerp(root.userData.squash ?? 1, reducedMotion || grounded ? 1 : 1.05, blend);
  const squash = root.userData.squash as number;
  avatar.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
  for (const side of [-1, 1]) {
    const ear = root.getObjectByName('ear' + side)!;
    const flutter = reducedMotion ? 0 : grounded ? Math.sin(gait * 2) * .045 * Math.min(speed / 4, 1) : .16;
    ear.rotation.z = T.MathUtils.lerp(ear.rotation.z, -side * (.22 + flutter), blend);
    const foot = root.getObjectByName('foot' + side)!;
    const stride = Math.sin(gait + (side === 1 ? Math.PI : 0));
    foot.position.y = -.535 + (grounded && !reducedMotion ? Math.max(0, stride) * .065 * Math.min(speed / 4, 1) : 0);
  }
}
