import * as T from 'three';
import { rounded } from './puzzle-art';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export type KnightPhase = 'idle' | 'warn' | 'lunge' | 'rest' | 'stun';
const armor = new T.MeshStandardMaterial({ color: '#414956', roughness: .44, metalness: .18 });
const mask = new T.MeshStandardMaterial({ color: '#58616d', roughness: .42, metalness: .22 });
const steel = new T.MeshStandardMaterial({ color: '#8b96a4', roughness: .34, metalness: .48 });
const iron = new T.MeshStandardMaterial({ color: '#252b34', roughness: .52, metalness: .22 });
const dark = new T.MeshStandardMaterial({ color: '#10151c', roughness: .85 });
const crimson = new T.MeshStandardMaterial({ color: '#822d40', roughness: .85 });
const ember = new T.MeshStandardMaterial({ color: '#ff9c65', emissive: '#ef542b', emissiveIntensity: .65, roughness: .38 });
const glint = new T.MeshBasicMaterial({ color: '#ffe5bc' });
const ball = new T.SphereGeometry(1, 20, 14);
const dome = new T.SphereGeometry(1, 32, 24);
const box = rounded(1, 1, 1, .13);
const bar = new T.CylinderGeometry(1, 1, 1, 12);
const diamond = new T.OctahedronGeometry(1);

function plate(shape: T.Shape, depth = .035, bevel = .012) {
  const geometry = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel,
    bevelThickness: bevel, bevelSegments: 3, curveSegments: 12, steps: 1 });
  geometry.translate(0, 0, -depth / 2); return geometry;
}
function outline(points: number[][]) {
  const shape = new T.Shape(); shape.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) shape.lineTo(x, y);
  shape.closePath(); return shape;
}
function facePlate(shape: T.Shape, centerY: number) {
  const flat = plate(shape), geometry = new TessellateModifier(.055, 7).modify(flat), p = geometry.attributes.position;
  flat.dispose();
  // Curved armor follows the spherical body instead of floating as a flat mask.
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i) + centerY;
    p.setXYZ(i, x, y, p.getZ(i) - .46 * Math.sqrt(Math.max(.08, 1 - (x / .515) ** 2 - ((y - .66) / .51) ** 2)));
  }
  geometry.deleteAttribute('normal'); const smooth = mergeVertices(geometry); smooth.computeVertexNormals(); geometry.dispose(); return smooth;
}
const visor = new T.SphereGeometry(1, 32, 20, Math.PI * .19, Math.PI * .62, Math.PI * .33, Math.PI * .39);
visor.rotateY(Math.PI);
const brow = facePlate(outline([[-.335,.10],[0,-.035],[.335,.10],[.33,.025],[0,-.12],[-.33,.025]]), .865);
const guardShape = new T.Shape();
guardShape.moveTo(-.35,.1); guardShape.quadraticCurveTo(0,.035,.35,.1);
guardShape.lineTo(.315,-.08); guardShape.quadraticCurveTo(0,-.22,-.315,-.08); guardShape.closePath();
for (const x of [-.115, 0, .115]) {
  const hole = new T.Path();
  hole.moveTo(x-.018,.025); hole.absarc(x,.025,.018,Math.PI,0,true);
  hole.lineTo(x+.018,-.075); hole.absarc(x,-.075,.018,0,Math.PI,true); hole.closePath();
  guardShape.holes.push(hole);
}
const guard = facePlate(guardShape, .53);
const crest = plate(outline([[-.27,1.03],[-.21,1.18],[-.05,1.24],[.13,1.19],[.26,1.06],[.19,1.025]]), .085, .018);
crest.rotateY(Math.PI / 2);

const shieldShape = new T.Shape();
shieldShape.moveTo(0,.405); shieldShape.bezierCurveTo(.08,.36,.265,.23,.27,.12);
shieldShape.bezierCurveTo(.305,-.12,.16,-.28,0,-.405);
shieldShape.bezierCurveTo(-.16,-.28,-.305,-.12,-.27,.12);
shieldShape.bezierCurveTo(-.265,.23,-.08,.36,0,.405); shieldShape.closePath();
const shieldRim = plate(shieldShape, .085, .025);
const shieldFace = plate(shieldShape, .045, .014);
const capeShape = new T.Shape();
capeShape.moveTo(-.24,0); capeShape.quadraticCurveTo(0,.07,.24,0);
capeShape.lineTo(.38,-.62); capeShape.quadraticCurveTo(.22,-.70,0,-.635);
capeShape.quadraticCurveTo(-.22,-.70,-.38,-.62); capeShape.closePath();
const cape = plate(capeShape, .018, .008), cp = cape.attributes.position;
for (let i = 0; i < cp.count; i++) cp.setZ(i, cp.getZ(i) + .075 - cp.getY(i) * .38 + Math.sin(cp.getX(i) * 15) * .022);
cape.computeVertexNormals();

function part(parent: T.Object3D, name: string, geometry: T.BufferGeometry, material: T.Material,
  x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) {
  const mesh = new T.Mesh(geometry, material); mesh.name = name;
  mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
  mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

export function createDarkKnight(): T.Group {
  const root = new T.Group(); root.name = 'dark-knight';
  const body = new T.Group(); body.name = 'body'; root.add(body);
  part(body, 'helmet-dome', dome, armor, 0,.66,.015, .49,.48,.43);
  part(body, 'visor', visor, dark, 0,.66,.015, .497,.487,.442);
  part(body, 'brow-ridge', brow, steel);
  part(body, 'vented-faceguard', guard, mask);
  part(body, 'helmet-crest', crest, steel);
  const mantle = new T.Group(); mantle.name = 'cape'; mantle.position.set(0,.91,.22); body.add(mantle);
  part(mantle, 'crimson-cape', cape, crimson);
  for (const side of [-1, 1]) {
    const foot = new T.Group(); foot.name = `foot${side}`; foot.position.set(side * .235,.095,-.07); body.add(foot);
    part(foot, 'boot-sole', ball, steel, 0,-.035,0, .205,.06,.255);
    part(foot, 'armored-boot', ball, iron, 0,.03,-.01, .195,.125,.245);
    part(body, 'ear-guard-rim', ball, steel, side * .445,.8,.01, .065,.16,.18);
    part(body, 'ear-guard', ball, armor, side * .472,.81,.012, .05,.132,.147);
    part(body, 'shoulder-rim', ball, steel, side * .455,.62,.0, .14,.14,.15);
    part(body, 'shoulder-cap', ball, armor, side * .477,.64,-.005, .125,.13,.145);
    const arm = new T.Group(); arm.name = `arm${side}`; arm.position.set(side * .49,.55,-.075); body.add(arm);
    part(arm, 'armored-arm', ball, iron, 0,0,-.045, .1,.1,.135);
    part(arm, 'gauntlet', ball, iron, side * .06,-.015,-.16, .14,.135,.13);
    const eye = new T.Group(); eye.name = `eye${side}`; eye.position.set(side * .145,.765,-.413);
    eye.rotation.y = -side * .28; body.add(eye);
    part(eye, 'ember-eye', ball, ember, 0,0,0, .079,.095,.019);
    part(eye, 'pupil', ball, dark, -side * .009,.005,-.019, .025,.059,.009);
    const light = part(eye, 'eye-glint', ball, glint, -.018,.043,-.025, .012,.014,.005); light.castShadow = false;
  }
  const hand = body.getObjectByName('arm1')!;
  const shield = new T.Group(); shield.name = 'shield'; shield.position.set(.06,-.015,-.16); hand.add(shield);
  part(shield, 'shield-rim', shieldRim, steel, 0,0,-.135);
  part(shield, 'shield-face', shieldFace, iron, 0,0,-.19, .86,.88,1);
  part(shield, 'crimson-crest', diamond, crimson, 0,0,-.23, .135,.235,.032);
  part(shield, 'steel-crest', diamond, steel, 0,0,-.266, .047,.08,.018);
  const grip = part(shield, 'shield-grip', bar, iron, 0,0,0, .036,.18,.036); grip.rotation.z = Math.PI / 2;
  for (const x of [-.09,.09]) part(shield, 'grip-bracket', box, iron, x,0,-.065, .05,.075,.14);
  return root;
}

export function animateDarkKnight(root: T.Group, phase: KnightPhase, shielded: boolean, time: number, dt: number, reducedMotion: boolean) {
  const body = root.getObjectByName('body')!, shield = root.getObjectByName('shield')!;
  const exposed = !shielded || phase === 'rest' || phase === 'stun', dash = phase === 'lunge';
  const blend = dt ? 1 - Math.exp(-dt * 12) : 1;
  shield.visible = true;
  shield.rotation.x = T.MathUtils.lerp(shield.rotation.x, exposed ? -1.2 : dash ? -.12 : 0, blend);
  body.rotation.x = T.MathUtils.lerp(body.rotation.x, dash ? -.12 : exposed ? .065 : 0, blend);
  body.rotation.z = reducedMotion ? 0 : Math.sin(time * (phase === 'warn' ? 22 : 3)) * (phase === 'warn' ? .045 : .015);
  body.position.y = (dash ? .07 : 0) + (reducedMotion ? 0 : Math.abs(Math.sin(time * (dash ? 22 : 2))) * (dash ? .025 : .007));
  root.getObjectByName('cape')!.rotation.x = reducedMotion ? 0 : (dash ? -.3 : -.03) + Math.sin(time * 3) * .025;
  for (const side of [-1, 1]) {
    const foot = root.getObjectByName(`foot${side}`)!;
    const stride = !reducedMotion && dash ? Math.sin(time * 22) * side : 0;
    foot.rotation.x = stride * .32; foot.position.y = .095 + Math.max(0, stride) * .055;
    const eye = root.getObjectByName(`eye${side}`)!;
    eye.scale.y = T.MathUtils.lerp(eye.scale.y, phase === 'stun' ? 1.22 : phase === 'warn' ? .8 : 1, blend);
  }
}
