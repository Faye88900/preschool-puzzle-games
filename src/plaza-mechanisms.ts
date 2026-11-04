import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rounded } from './puzzle-art';
import { createTreeBench } from './tree-bench';

const templates = new Map<string, T.Group>();
let surfaces: Record<string, T.MeshStandardMaterial> | undefined;
function palette() {
  if (surfaces) return surfaces;
  const source = createTreeBench();
  const shared = (name: string) => (source.getObjectByName('tree-bench-' + name) as T.Mesh).material as T.MeshStandardMaterial;
  const cream = new T.MeshStandardMaterial({ color: '#fff0d1', roughness: .88 }); cream.name = 'garden-sail-cream';
  const dark = new T.MeshStandardMaterial({ color: '#594c36', roughness: .86 }); dark.name = 'garden-lock-recess';
  surfaces = { wood: shared('wood'), frame: shared('frame'), stone: shared('stone'), gold: shared('brass'), teal: shared('leaf'), cream, dark };
  return surfaces;
}
function add(parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material, x = 0, y = 0, z = 0) {
  const mesh = new T.Mesh(geometry, material); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
}
function box(parent: T.Object3D, w: number, h: number, d: number, material: T.Material, x: number, y: number, z: number) {
  return add(parent, rounded(w, h, d, Math.min(.045, w / 4, h / 4, d / 4)), material, x, y, z);
}
function bolt(parent: T.Object3D, x: number, y: number, z: number, size = .045) {
  add(parent, new T.SphereGeometry(1, 10, 6), palette().gold, x, y, z).scale.set(size, size, size * .45);
}
function badge(parent: T.Object3D, x: number, y: number, z: number, size: number) {
  const { teal, gold } = palette();
  const rim = add(parent, new T.CylinderGeometry(size * .58, size * .58, .075, 16), gold, x, y, z); rim.rotation.x = Math.PI / 2;
  const face = add(parent, new T.CylinderGeometry(size * .49, size * .49, .085, 16), teal, x, y, z + .018); face.rotation.x = Math.PI / 2;
  const shape = new T.Shape(); shape.moveTo(0, 0); shape.bezierCurveTo(.18, .12, .16, .37, 0, .57); shape.bezierCurveTo(-.16, .37, -.18, .12, 0, 0);
  const leaf = new T.ExtrudeGeometry(shape, { depth: .018, bevelEnabled: true, bevelSize: .009, bevelThickness: .009, bevelSegments: 1, curveSegments: 6, steps: 1 });
  for (const turn of [-.7, 0, .7]) {
    const blade = add(parent, leaf, gold, x, y - size * .29, z + .07); blade.scale.setScalar(size * (turn ? .67 : 1)); blade.rotation.z = turn;
  }
}
function batch(root: T.Group) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(), batches = new Map<T.Material, T.BufferGeometry[]>();
  root.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
    geometry.applyMatrix4(inverse.clone().multiply(node.matrixWorld));
    const material = node.material as T.Material;
    if (!batches.has(material)) batches.set(material, []); batches.get(material)!.push(geometry);
  });
  root.clear();
  for (const [material, geometries] of batches) {
    const merged = mergeGeometries(geometries)!, mesh = new T.Mesh(mergeVertices(merged), material); merged.dispose();
    mesh.name = root.name + '-' + material.name; mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    geometries.forEach(geometry => geometry.dispose());
  }
}

export function createGardenWindmill(): T.Group {
  const cached = templates.get('mill'); if (cached) return cached.clone(true);
  const { wood, frame, stone, gold, teal, cream } = palette();
  const root = new T.Group(); root.name = 'garden-windmill';
  const tower = new T.Group(); tower.name = 'windmill-tower'; root.add(tower);
  for(let i=0;i<6;i++)add(tower,new T.CylinderGeometry(.9-(i+1)*.28/6,.9-i*.28/6,2.8/6-.012,12),stone,0,(i+.5)*2.8/6,0);
  for (const [y, radius] of [[.18,.89],[.66,.85],[2.64,.65]]) {
    add(tower, new T.CylinderGeometry(radius, radius + .025, .13, 12), wood, 0, y, 0);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, pin = add(tower, new T.SphereGeometry(1, 8, 5), gold, Math.sin(a) * (radius+.015), y, Math.cos(a) * (radius+.015)); pin.scale.setScalar(.043);
    }
  }
  for (let i = 0; i < 3; i++) {
    const radius = 1.04 - i * .26;
    add(tower, new T.ConeGeometry(radius, .5, 12), teal, 0, 2.95 + i * .26, 0);
  }
  add(tower, new T.SphereGeometry(.085, 10, 6), gold, 0, 3.73, 0);
  box(tower, .5, .74, .12, frame, 0, 1.63, -.69); box(tower, .36, .58, .13, teal, 0, 1.65, -.76);
  box(tower, .035, .6, .03, gold, 0, 1.65, -.84); box(tower, .44, .06, .2, wood, 0, 1.3, -.77);
  const plate = new T.Group(); plate.rotation.y = Math.PI; plate.position.set(0,.52,-.87); tower.add(plate); badge(plate,0,0,0,.46);
  box(tower, .17, .17, .38, gold, 0, 2.5, -.75);
  const rotor = new T.Group(); rotor.name = 'rotor'; rotor.position.set(0,2.5,-.86); root.add(rotor);
  for (let i = 0; i < 4; i++) {
    const blade = new T.Group(); blade.rotation.z = i * Math.PI / 2; rotor.add(blade);
    box(blade,.12,1.43,.12,frame,0,.72,0);
    box(blade,.52,.97,.1,wood,.16,.99,-.035); box(blade,.41,.83,.075,cream,.16,.99,-.105);
    for (const y of [.59,.86,1.13,1.4]) {
      box(blade,.48,.025,.03,wood,.16,y,-.16); bolt(blade,-.07,y,-.18,.029); bolt(blade,.39,y,-.18,.029);
    }
  }
  const crest = new T.Group(); crest.rotation.y=Math.PI; rotor.add(crest); badge(crest,0,0,.18,.45);
  batch(tower); batch(rotor); templates.set('mill',root); return root.clone(true);
}

export function createGardenBridgeDrive(): T.Group {
  const { wood, frame, stone, gold, teal } = palette();
  const root = new T.Group(); root.name = 'windmill-bridge-drive';
  const base = new T.Group(); base.name = 'bridge-drive-housing'; root.add(base);
  box(base, 1.15, .3, .8, stone, -1.1, .15, 2.1);
  for (const x of [-1.65, -.55]) box(base, .18, .65, .65, wood, x, .48, 2.1);
  const a = new T.Vector3(-2.5, .12, -.65), b = new T.Vector3(-1.6, .12, 2.1);
  const input = add(base, new T.CylinderGeometry(.085, .085, a.distanceTo(b), 10), gold);
  input.position.copy(a).add(b).multiplyScalar(.5); input.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.sub(a).normalize());
  add(base, new T.CylinderGeometry(.1, .1, .58, 10), gold, -1.6, .41, 2.1);
  const shaft = add(base, new T.CylinderGeometry(.085, .085, 1.73, 10), gold, -.735, .7, 2.1); shaft.rotation.z = Math.PI / 2;
  box(base, .72, .8, .52, frame, .13, .4, 1.96);
  const output = add(base, new T.CylinderGeometry(.09, .09, .7, 10), gold, .13, .2, 1.94); output.rotation.x = Math.PI / 2;
  const wheel = new T.Group(); wheel.name = 'bridge-drive-wheel'; wheel.position.set(.13, .7, 2.3); root.add(wheel);
  const rim = add(wheel, new T.TorusGeometry(.39, .065, 6, 24), gold);
  rim.name = 'bridge-drive-gear';
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6, tooth = box(wheel, .13, .16, .13, gold, Math.sin(angle) * .46, Math.cos(angle) * .46, 0);
    tooth.rotation.z = -angle;
  }
  for (const angle of [0, Math.PI / 3, -Math.PI / 3]) box(wheel, .075, .72, .1, wood, 0, 0, 0).rotation.z = angle;
  const hub = add(wheel, new T.CylinderGeometry(.14, .14, .18, 12), teal); hub.rotation.x = Math.PI / 2;
  batch(base); batch(wheel); return root;
}

export function createGardenBridge(): T.Group {
  const cached = templates.get('bridge'); if (cached) return cached.clone(true);
  const { wood, frame, stone, gold } = palette();
  const root = new T.Group(); root.name = 'garden-windmill-bridge';
  const anchors = new T.Group(); anchors.name = 'bridge-abutments'; root.add(anchors);
  for (const x of [0,5]) for (const z of [-2,2]) {
    box(anchors,.46,.68,.46,stone,x,.34,z); box(anchors,.53,.13,.53,stone,x,.745,z);
    const cap = new T.Group(); cap.rotation.y=z<0?Math.PI:0; cap.position.set(x,.48,z+Math.sign(z)*.24); anchors.add(cap); badge(cap,0,0,0,.25);
  }
  const deck = new T.Group(); deck.name = 'bridge-deck'; deck.position.y = .2; root.add(deck);
  for (let i = 0; i < 8; i++) {
    const x = .32 + i * .62; box(deck,.58,.2,4.1,wood,x,0,0);
    for (const z of [-1.65,1.65]) {
      const nail=add(deck,new T.SphereGeometry(1,8,5),gold,x,.108,z); nail.scale.set(.035,.013,.035);
    }
  }
  for (const z of [-1.53,1.53]) box(deck,4.8,.16,.17,frame,2.5,-.17,z);
  for (const side of [-1,1]) {
    const z=side*2;
    for (const y of [.42,.83]) box(deck,4.75,.13,.13,wood,2.5,y,z);
    for (const x of [.22,2.5,4.78]) {
      box(deck,.16,.86,.16,frame,x,.43,z); box(deck,.23,.13,.23,stone,x,.92,z);
      for (const y of [.42,.83]) bolt(deck,x,y,z+side*.085,.032);
    }
    const hinge=add(deck,new T.CylinderGeometry(.14,.14,.18,12),gold,.13,0,z); hinge.rotation.x=Math.PI/2;
  }
  batch(anchors); batch(deck); templates.set('bridge',root); return root.clone(true);
}

export function createGardenGate(kind: 'exit' | 'shortcut', exitLabel = '出口'): T.Group {
  const cacheKey = kind === 'exit' ? kind + ':' + exitLabel : kind;
  const cached = templates.get(cacheKey); if (cached) return cached.clone(true);
  const { wood, stone, gold, teal, dark } = palette();
  const root = new T.Group(); root.name = 'garden-' + kind + '-gate';
  const arch = new T.Group(); arch.name = 'gate-frame'; root.add(arch);
  for (const x of [-2.25,2.25]) {
    for (let i=0;i<6;i++) box(arch,.55,.5,.65,stone,x,.26+i*.51,0);
    box(arch,.67,.19,.74,stone,x,3.13,0); box(arch,.58,.12,.68,gold,x,2.92,0);
    for (const side of [-1,1]) { const crest=new T.Group();crest.rotation.y=side<0?Math.PI:0;crest.position.set(x,2.43,side*.34);arch.add(crest);badge(crest,0,0,0,.3); }
  }
  const shape=new T.Shape();shape.moveTo(-2.25,3.04);shape.quadraticCurveTo(0,4.5,2.25,3.04);
  shape.lineTo(2.25,2.79);shape.quadraticCurveTo(0,4.0,-2.25,2.79);shape.closePath();
  const beam=new T.ExtrudeGeometry(shape,{depth:.32,bevelEnabled:true,bevelSize:.04,bevelThickness:.04,bevelSegments:2,curveSegments:20,steps:1});
  add(arch,beam,wood,0,0,-.16);
  for(const side of [-1,1]){const crest=new T.Group();crest.rotation.y=side<0?Math.PI:0;crest.position.set(0,kind==='exit'?4.1:3.73,side*.2);arch.add(crest);badge(crest,0,0,0,.66);}
  const grille=new T.Group();grille.name='gate-grille';root.add(grille);
  const bars=kind==='exit'?teal:wood;
  for(let i=-3;i<=3;i++){
    const x=i*.55,height=2.45+.45*(1-Math.abs(i)/3);
    box(grille,.28,height,.21,bars,x,.18+height/2,0);
    box(grille,.29,.08,.23,gold,x,.18+height,0);
    for(const y of [.72,2.04])for(const side of [-1,1])bolt(grille,x,y,side*.17,.04);
  }
  for(const y of [.72,2.04])box(grille,3.85,.16,.24,bars,0,y,0);
  for(const side of [-1,1]){
    const lock=new T.Group();lock.position.set(0,1.43,side*.17);lock.rotation.y=side<0?Math.PI:0;grille.add(lock);
    const disc=add(lock,new T.CylinderGeometry(kind==='exit'?.42:.34,kind==='exit'?.42:.34,.12,24),gold);disc.rotation.x=Math.PI/2;
    add(lock,new T.SphereGeometry(1,12,8),dark,0,.08,.075).scale.set(.105,.105,.018);
    box(lock,.105,.22,.025,dark,0,-.065,.08);
    for(let i=0;i<8;i++){const a=i*Math.PI/4,r=kind==='exit'?.34:.27;bolt(lock,Math.sin(a)*r,Math.cos(a)*r,.075,.018);}
  }
  batch(arch);batch(grille);
  if (kind === 'exit') {
    const plaque = new T.Group(); plaque.name = 'exit-nameplate'; plaque.position.set(0,3.42,.2); arch.add(plaque);
    const outline = new T.Shape(); outline.moveTo(-1.2,-.22); outline.lineTo(1.2,-.22);
    outline.quadraticCurveTo(1.23,-.22,1.23,-.19); outline.lineTo(1.23,.13);
    outline.quadraticCurveTo(0,.34,-1.23,.13); outline.lineTo(-1.23,-.19); outline.quadraticCurveTo(-1.23,-.22,-1.2,-.22);
    const panel = new T.ExtrudeGeometry(outline,{depth:.1,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:2,curveSegments:16,steps:1});
    add(plaque,panel,gold);
    const enamel = new T.MeshStandardMaterial({color:'#205d58',roughness:.82}); enamel.name = 'garden-exit-enamel';
    add(plaque,panel,enamel,0,.003,.025).scale.set(.955,.83,1);
    for (const x of [-1.1,1.1]) bolt(plaque,x,-.025,.15,.043);
    batch(plaque);
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 160;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#fff0d1'; ctx.font = 'bold 112px "Microsoft YaHei", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(exitLabel,320,84,500);
      ctx.strokeStyle = '#fff0d1'; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(624,122); ctx.lineTo(624,39); ctx.moveTo(591,72); ctx.lineTo(624,39); ctx.lineTo(657,72); ctx.stroke();
      const map = new T.CanvasTexture(canvas); map.colorSpace = T.SRGBColorSpace;
      const text = add(plaque,new T.PlaneGeometry(2.08,.4),new T.MeshBasicMaterial({map,transparent:true,alphaTest:.04,depthWrite:false,toneMapped:false}),0,-.005,.16);
      text.name = 'exit-nameplate-text'; text.userData.label = exitLabel;
    }
  }
  templates.set(cacheKey,root);return root.clone(true);
}
