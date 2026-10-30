import * as T from 'three';
import { rounded } from './puzzle-art';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export type KnightPhase = 'idle' | 'chase' | 'return' | 'warn' | 'lunge' | 'rest' | 'stun' | 'dazed';
export const KNIGHT_DEATH_TIME = 1.25;
export const KNIGHT_PILLAR_STUN_TIME = 5;
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
const starShape = new T.Shape();
for(let i=0;i<10;i++){
  const angle=Math.PI/2+i*Math.PI/5,radius=i%2?.085:.2;
  if(i===0)starShape.moveTo(Math.cos(angle)*radius,Math.sin(angle)*radius);
  else starShape.lineTo(Math.cos(angle)*radius,Math.sin(angle)*radius);
}
starShape.closePath();
const stunStar=new T.ShapeGeometry(starShape),stunGold=new T.MeshBasicMaterial({color:'#ffdc67',side:T.DoubleSide});
type AshLayer={mesh:T.Mesh;original:T.Material|T.Material[];ash:T.Material|T.Material[];shadow:boolean};
const deaths = new WeakMap<T.Group, { amount: { value: number }; layers: AshLayer[]; dust: T.Points<T.BufferGeometry,T.PointsMaterial> }>();

export function animateKnightAsh(root: T.Group, progress: number, reducedMotion: boolean, heightScale=1) {
  let effect = deaths.get(root);
  if (!effect && progress <= 0) return;
  if (!effect) {
    const amount = { value: 0 }, layers: AshLayer[] = [];
    const materials = new Map<T.Material,T.Material>();
    const ashMaterial=(original:T.Material)=>{
      let ash = materials.get(original);
      if (!ash) {
        ash = original.clone();
        if (ash instanceof T.MeshStandardMaterial) { ash.emissiveIntensity = 0; ash.metalness = 0; ash.roughness = 1; }
        ash.onBeforeCompile = shader => {
          shader.uniforms.ashAmount = amount;
          shader.vertexShader = 'varying vec3 vAshPosition;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvAshPosition = (modelMatrix * vec4(transformed,1.0)).xyz;');
          shader.fragmentShader = 'uniform float ashAmount; varying vec3 vAshPosition;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
            vec3 cell = floor(vAshPosition * 36.0);
            float grain = fract(sin(dot(cell,vec3(12.9898,78.233,45.164))) * 43758.5453);
            if (grain < smoothstep(0.25,0.92,ashAmount)) discard;
            diffuseColor.rgb = mix(diffuseColor.rgb,vec3(0.32),smoothstep(0.04,0.26,ashAmount));`);
        };
        ash.customProgramCacheKey = () => 'knight-ash-v1'; materials.set(original,ash);
      }
      return ash;
    };
    root.getObjectByName('body')!.traverse(node => {
      if (!(node instanceof T.Mesh)||node.userData.runtimeVfx) return;
      const original=node.material,ash=Array.isArray(original)?original.map(ashMaterial):ashMaterial(original);
      layers.push({ mesh: node, original, ash, shadow: node.castShadow });
    });
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(48 * 3),3));
    const dust = new T.Points(geometry,new T.PointsMaterial({ color: '#a4a29f', size: .055, transparent: true, depthWrite: false }));
    dust.name = 'ash-dust'; dust.frustumCulled = false; root.add(dust);
    effect = { amount, layers, dust }; deaths.set(root,effect);
  }
  effect.amount.value = progress;
  for (const layer of effect.layers) {
    layer.mesh.material = progress > 0 ? layer.ash : layer.original;
    layer.mesh.castShadow = progress > .2 ? false : layer.shadow;
  }
  const dustTime = T.MathUtils.smoothstep(progress,.18,1);
  effect.dust.visible = progress > .18 && progress < 1;
  effect.dust.material.opacity = Math.sin(dustTime * Math.PI) * .85;
  const positions = effect.dust.geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const a = i * 2.39996, height = (i * .618034) % 1, radius = .25 + .2 * Math.sin(i * 7.1);
    const drift = reducedMotion ? 0 : dustTime;
    positions.setXYZ(i,Math.cos(a) * (radius + drift * .55) + drift * .2,
      (.2 + height * .85 + drift * (.3 + height * .6))*heightScale,Math.sin(a) * (radius + drift * .45));
  }
  positions.needsUpdate = true;
  root.getObjectByName('body')!.visible = progress < .92;
}

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
    const eye = new T.Group(); eye.name = `eye${side}`; eye.position.set(side * .145,.715,-.455);
    eye.rotation.y = -side * .28; body.add(eye);
    part(eye, 'ember-eye', ball, ember, 0,0,0, .098,.085,.021);
    part(eye, 'pupil', ball, dark, -side * .009,.005,-.021, .03,.055,.009);
    const light = part(eye, 'eye-glint', ball, glint, -.018,.043,-.025, .012,.014,.005); light.castShadow = false;
    for (const turn of [-1, 1]) {
      const cross = part(eye, `dazed-eye${turn}`, box, dark, 0,0,-.034, .024,.14,.012);
      cross.rotation.z = turn * Math.PI / 4; cross.visible = false;
    }
  }
  const hand = body.getObjectByName('arm1')!;
  const shield = new T.Group(); shield.name = 'shield'; shield.position.set(.06,-.015,-.16); hand.add(shield);
  part(shield, 'shield-rim', shieldRim, steel, 0,0,-.135);
  part(shield, 'shield-face', shieldFace, iron, 0,0,-.19, .86,.88,1);
  part(shield, 'crimson-crest', diamond, crimson, 0,0,-.23, .135,.235,.032);
  part(shield, 'steel-crest', diamond, steel, 0,0,-.266, .047,.08,.018);
  const grip = part(shield, 'shield-grip', bar, iron, 0,0,0, .036,.18,.036); grip.rotation.z = Math.PI / 2;
  for (const x of [-.09,.09]) part(shield, 'grip-bracket', box, iron, x,0,-.065, .05,.075,.14);
  const stars=new T.Group();stars.name='pillar-stun-stars';stars.visible=false;root.add(stars);
  for(let i=0;i<3;i++){
    const star=new T.Mesh(stunStar,stunGold),angle=i*Math.PI*2/3;
    star.position.set(Math.cos(angle)*.58,1.85,Math.sin(angle)*.32);stars.add(star);
  }
  return root;
}

export function animateDarkKnight(root: T.Group, phase: KnightPhase, shielded: boolean, time: number, dt: number, reducedMotion: boolean,
  motion?: { speed: number; alert: number; timer: number; block: number; hp: number }) {
  const body = root.getObjectByName('body')!, shield = root.getObjectByName('shield')!;
  const crashed=phase==='dazed';
  const exposed = !shielded || phase === 'rest' || phase === 'stun' || crashed, dash = phase === 'lunge', hit = phase === 'stun' || crashed;
  const state = root.userData.animation ??= { gait: 0, walk: 0, elapsed: 0, phase };
  const blend = dt ? 1 - Math.exp(-dt * 12) : 1;
  if (!dt || state.phase !== phase) state.elapsed = 0;
  else state.elapsed += dt;
  state.phase = phase;
  const speed = motion?.speed ?? (dash ? 5 : 0), alert = motion?.alert ?? (shielded ? 1 : 0);
  const defeated = motion?.hp === 0;
  const duration = defeated ? KNIGHT_DEATH_TIME : crashed ? KNIGHT_PILLAR_STUN_TIME : .8;
  const hurtTime = hit ? duration - (motion?.timer ?? Math.max(0,duration - state.elapsed)) : 0;
  const dazed = crashed || hit && hurtTime > .08;
  const recoil = hit ? Math.sin(Math.min(1, hurtTime / .38) * Math.PI) : 0;
  const block = (motion?.block ?? 0) / .24;
  state.walk = reducedMotion ? 0 : T.MathUtils.lerp(state.walk, Math.min(1, speed / .8), blend);
  if (!dt) state.gait = 0;
  else state.gait += speed * dt * (dash ? 5.5 : 8);
  const stride = Math.sin(state.gait) * state.walk;
  animateKnightAsh(root,defeated ? T.MathUtils.clamp(hurtTime / KNIGHT_DEATH_TIME,0,1) : 0,reducedMotion);
  shield.visible = true;
  shield.rotation.x = T.MathUtils.lerp(shield.rotation.x, exposed ? -1.2 : dash ? -.12 : -.55 * (1 - alert) + block * .12, blend);
  body.rotation.x = T.MathUtils.lerp(body.rotation.x, reducedMotion ? 0 : crashed ? .15+recoil*.12 : hit ? recoil * .16 : dash ? -.14 : phase === 'warn' ? .07 : exposed ? .035 : 0, blend);
  body.rotation.z = reducedMotion ? 0 : crashed ? Math.sin(time*4)*.055 : hit ? Math.sin(hurtTime * 24) * recoil * .08 : stride * .035;
  const lift = (dash ? .08 : crashed && !reducedMotion ? .065 : 0) + (reducedMotion ? 0 : Math.abs(stride) * .035 + recoil * .04);
  body.position.y = T.MathUtils.lerp(body.position.y, lift, blend);
  body.position.z = T.MathUtils.lerp(body.position.z, reducedMotion ? 0 : recoil * .09, blend);
  const squash = !reducedMotion && phase === 'warn' ? .035 : 0;
  body.scale.x = T.MathUtils.lerp(body.scale.x,1 + squash * .5,blend);
  body.scale.y = T.MathUtils.lerp(body.scale.y,1 - squash,blend);
  body.scale.z = T.MathUtils.lerp(body.scale.z,1,blend);
  const cape = root.getObjectByName('cape')!;
  cape.rotation.x = reducedMotion ? 0 : T.MathUtils.lerp(cape.rotation.x, -.03 - state.walk * .16 - (dash ? .16 : 0) + Math.sin(time * 3) * .025, blend);
  const stars=root.getObjectByName('pillar-stun-stars')!;stars.visible=crashed&&!defeated;
  stars.children.forEach((star,i)=>{
    const angle=i*Math.PI*2/3+(reducedMotion?0:time*2.2);
    star.position.set(Math.cos(angle)*.58,1.85+(reducedMotion?0:Math.sin(angle*2)*.08),Math.sin(angle)*.32);
    star.rotation.y=-root.rotation.y;
  });
  for (const side of [-1, 1]) {
    const foot = root.getObjectByName(`foot${side}`)!;
    foot.rotation.x = stride * side * .27;
    foot.position.y = .095 + Math.max(0, stride * side) * .065;
    foot.position.z = -.07 + stride * side * .055;
    const arm = root.getObjectByName(`arm${side}`)!;
    arm.rotation.x = T.MathUtils.lerp(arm.rotation.x, reducedMotion ? 0 : side === 1 ? alert * .12 + (dash ? .13 : 0) - block * .16 : -stride * .22 + (dash ? .3 : 0), blend);
    const eye = root.getObjectByName(`eye${side}`)!;
    const attacking = phase === 'warn' || dash, tired = phase === 'rest';
    const blink = !reducedMotion && phase === 'idle' && time % 4.6 > 4.45;
    eye.scale.y = T.MathUtils.lerp(eye.scale.y,hit ? dazed ? 1.1 : 1.45 : blink ? .12 : tired ? .48 : attacking ? .58 : 1 + alert * .15,blend);
    eye.scale.x = T.MathUtils.lerp(eye.scale.x,hit && !dazed ? .85 : attacking ? 1.12 : 1,blend);
    eye.rotation.z = T.MathUtils.lerp(eye.rotation.z,side * (hit ? 0 : tired ? -.18 : attacking ? .32 : alert * .18),blend);
    const pupil = eye.getObjectByName('pupil')!;
    pupil.scale.x = T.MathUtils.lerp(pupil.scale.x,hit && !dazed ? .016 : attacking ? .018 : .03,blend);
    eye.getObjectByName('pupil')!.visible = !dazed; eye.getObjectByName('eye-glint')!.visible = !dazed;
    for (const turn of [-1, 1]) eye.getObjectByName(`dazed-eye${turn}`)!.visible = dazed;
  }
}
