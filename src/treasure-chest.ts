import * as T from 'three';
import { rounded } from './puzzle-art';
import { createSailCrystal } from './sail-crystal';
import { batchTreasureParts, treasureLeaf } from './treasure-details';

const grainCanvas = document.createElement('canvas'); grainCanvas.width = grainCanvas.height = 128;
const grain = grainCanvas.getContext('2d')!; grain.fillStyle = '#f2e5cf'; grain.fillRect(0, 0, 128, 128);
grain.strokeStyle = '#c9b795'; grain.lineWidth = .8;
for (let line = -2; line < 18; line++) {
  grain.beginPath();
  for (let x = 0; x <= 128; x += 4) {
    const y = line * 9 + Math.sin(x * .045 + line * 1.7) * 2.1 + Math.sin(x * .11 + line) * .65;
    if (!x) grain.moveTo(x, y); else grain.lineTo(x, y);
  }
  grain.stroke();
}
const woodGrain = new T.CanvasTexture(grainCanvas); woodGrain.colorSpace = T.SRGBColorSpace;
const wood = new T.MeshStandardMaterial({ color: '#b18a60', roughness: .66, map: woodGrain });
const lightWood = new T.MeshStandardMaterial({ color: '#c59a67', roughness: .63, map: woodGrain });
const dark = new T.MeshStandardMaterial({ color: '#514132', roughness: .85 });
const gold = new T.MeshStandardMaterial({ color: '#dfb65d', roughness: .32, metalness: .52 });
const green = new T.MeshStandardMaterial({ color: '#66876a', roughness: .6 });
const lining = new T.MeshStandardMaterial({ color: '#315d4e', roughness: .95 });
const aqua = new T.MeshPhysicalMaterial({ color: '#70dfce', roughness: .2, clearcoat: .8, emissive: '#2b8d81', emissiveIntensity: .15 });
const box = rounded(1, 1, 1, .05);

export function createTreasureChest(): T.Group {
  const root = new T.Group(); root.name = 'garden-treasure-chest';
  const body = new T.Group(); body.name = 'chest-body'; root.add(body);
  const lid = new T.Group(); lid.name = 'lid'; lid.position.set(0, 1.06, .74); root.add(lid);
  const add = (parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material,
    x: number, y: number, z: number, sx = 1, sy = sx, sz = sx) => {
    const mesh = new T.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
    parent.add(mesh); return mesh;
  };
  const plank = (parent: T.Object3D, material: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) =>
    add(parent, box, material, x, y, z, w, h, d);
  const leaf = (parent: T.Object3D, x: number, y: number, z: number, length: number, angle = 0, inset = true) => {
    const g = new T.Group(); g.position.set(x, y, z); g.rotation.z = angle; parent.add(g);
    add(g, treasureLeaf, gold, 0, 0, 0, length * .65, length, 1.6);
    if (inset) {
      add(g, treasureLeaf, green, 0, length * .1, -.035, length * .41, length * .72, .6);
      add(g, treasureLeaf, green, 0, length * .1, .115, length * .41, length * .72, .6);
    }
    return g;
  };
  const sprig = (parent: T.Group, side: number, y: number) => {
    const points = [new T.Vector3(side * .25, y, -.82), new T.Vector3(side * .5, y + .08, -.825),
      new T.Vector3(side * .87, y + .28, -.82)];
    add(parent, new T.TubeGeometry(new T.CatmullRomCurve3(points), 16, .012, 4), gold, 0, 0, 0);
    for (const [x, h, angle] of [[.43, .07, -.65], [.62, .15, .65], [.77, .23, -.6]])
      leaf(parent, side * x, y + h, -.84, .15, side * angle, false);
  };
  plank(body, dark, 0, .18, 0, 2.34, .24, 1.46);
  plank(body, lining, 0, .32, 0, 2.1, .04, 1.2);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      plank(body, i % 2 ? wood : lightWood, 0, .43 + i * .2, side * .69, 2.34, .195, .13);
      plank(body, i % 2 ? lightWood : wood, side * 1.11, .43 + i * .2, 0, .13, .195, 1.34);
    }
    plank(body, lining, 0, .62, side * .605, 2.1, .55, .04);
    plank(body, lining, side * 1.045, .62, 0, .04, .55, 1.2);
    for (const y of [.24, 1.02]) {
      plank(body, gold, 0, y, side * .72, 2.48, .13, .14);
      plank(body, gold, side * 1.17, y, 0, .14, .13, 1.42);
    }
    const panel = new T.Shape(); panel.moveTo(-.93, 0); panel.lineTo(-.93, .46);
    panel.quadraticCurveTo(-.62, .55, -.3, .46); panel.quadraticCurveTo(0, .35, .3, .46);
    panel.quadraticCurveTo(.62, .55, .93, .46); panel.lineTo(.93, 0);
    panel.quadraticCurveTo(.5, -.09, 0, -.03); panel.quadraticCurveTo(-.5, -.09, -.93, 0);
    const face = new T.Group(); face.position.set(0, .37, side * .77); if (side > 0) face.rotation.y = Math.PI; body.add(face);
    add(face, new T.ExtrudeGeometry(panel, { depth: .025, bevelEnabled: true, bevelSize: .018,
      bevelThickness: .012, bevelSegments: 1, steps: 1, curveSegments: 8 }), green, 0, 0, 0);
    for (const wing of [-1, 1]) {
      const ornament = new T.Group(); sprig(ornament, wing, .02); ornament.position.z = .77; face.add(ornament);
    }
    for (const x of [-1.07, 1.07]) {
      plank(body, gold, x, .61, side * .77, .13, .75, .08);
      plank(body, dark, x, .08, side * .6, .27, .16, .28);
      const guard = leaf(body, x, .025, side * .82, .54, x > 0 ? -.3 : .3); guard.scale.x = 1.3;
      leaf(body, x, .72, side * .82, .3, Math.PI);
    }
    plank(body, green, side * 1.19, .65, 0, .025, .48, .97);
    const handle = add(body, new T.TorusGeometry(.19, .04, 6, 16, Math.PI), gold, side * 1.24, .68, 0);
    handle.rotation.set(0, Math.PI / 2, Math.PI);
    for (const z of [-.19, .19]) add(body, new T.SphereGeometry(.06, 8, 5), gold, side * 1.24, .68, z);
  }
  const cap = add(lid, new T.CylinderGeometry(.74, .74, 2.34, 24, 1, false, 0, Math.PI), wood, 0, 0, -.74);
  cap.rotation.z = Math.PI / 2;
  const enamel = add(lid, new T.CylinderGeometry(.75, .75, 1.96, 24, 1, false, .045, Math.PI - .09), green, 0, 0, -.74);
  enamel.rotation.z = Math.PI / 2;
  const stem = add(lid, new T.CylinderGeometry(.763, .763, .07, 24, 1, false, 0, Math.PI), gold, 0, 0, -.74);
  stem.rotation.z = Math.PI / 2;
  plank(lid, lining, 0, -.018, -.74, 2.18, .06, 1.28);
  for (const x of [-1.08, 1.08]) {
    const band = add(lid, new T.CylinderGeometry(.78, .78, .14, 24, 1, false, 0, Math.PI), gold, x, 0, -.74);
    band.rotation.z = Math.PI / 2;
    const hinge = add(body, new T.CylinderGeometry(.085, .085, .34, 12), gold, x * .7, 1.06, .76); hinge.rotation.z = Math.PI / 2;
    plank(body, gold, x * .7, .98, .81, .37, .26, .04);
    for (const y of [.89, 1.04]) add(body, new T.SphereGeometry(.028, 8, 5), lightWood, x * .7, y, .85);
  }
  for (const z of [-1.49, .01]) plank(lid, gold, 0, .025, z, 2.47, .12, .1);
  for (const x of [-1.08, 1.08]) leaf(lid, x, .04, -1.48, .39, x > 0 ? -.18 : .18);
  // Bend the relief onto the dome so its leaves remain attached when the lid opens.
  for (const side of [-1, 1]) {
    const relief = new T.Group(); sprig(relief, side, .28); relief.updateMatrixWorld(true);
    const meshes: T.Mesh[] = [];
    relief.traverse(node => {
      if (!(node instanceof T.Mesh)) return;
      const geometry = node.geometry.clone(); geometry.applyMatrix4(node.matrixWorld);
      const p = geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) p.setZ(i, -.74 - Math.sqrt(Math.max(0, .75 ** 2 - p.getY(i) ** 2)) - .025 + (p.getZ(i) + .82));
      geometry.computeVertexNormals(); meshes.push(new T.Mesh(geometry, gold));
    });
    lid.add(...meshes);
  }
  leaf(lid, 0, .58, -.84, .46);
  const seal = leaf(lid, 0, -.36, -1.58, .73); seal.name = 'chest-leaf-lock';
  add(seal, treasureLeaf, aqua, 0, .065, -.07, .32, .57, .55);
  for (let i = 0; i < 3; i++) {
    const wind = new T.Shape(); wind.moveTo(0, 0);
    wind.bezierCurveTo(.02, .12, .18, .12, .17, -.005);
    wind.bezierCurveTo(.12, .055, .065, .055, 0, 0);
    const blade = add(seal, new T.ExtrudeGeometry(wind, {depth:.018,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:1,steps:1,curveSegments:8}), gold, 0, .35, -.115);
    blade.rotation.z = i * Math.PI * 2 / 3;
  }
  for (const group of [body, lid]) batchTreasureParts(group);
  const reward = createSailCrystal(); reward.name = 'chest-crystal'; reward.visible = false; root.add(reward);
  const glow = new T.Mesh(new T.RingGeometry(.22, .72, 32), new T.MeshBasicMaterial({
    color: '#9cebd1', transparent: true, opacity: .25, side: T.DoubleSide, depthWrite: false,
  }));
  glow.name = 'chest-reward-glow'; glow.rotation.x = -Math.PI / 2; glow.position.y = 1.09; glow.visible = false; root.add(glow);
  return root;
}

export function animateTreasureChest(root: T.Group, progress: number, collected: boolean, time: number, reducedMotion: boolean) {
  const lid = root.getObjectByName('lid')!, crystal = root.getObjectByName('chest-crystal')!, glow = root.getObjectByName('chest-reward-glow')!;
  lid.rotation.x = T.MathUtils.smoothstep(progress, 0, .65) * 1.9;
  const reveal = T.MathUtils.smoothstep(progress, .28, 1);
  crystal.visible = glow.visible = !collected && reveal > 0;
  crystal.position.set(0, .6 + reveal * 1.45 + (reducedMotion ? 0 : Math.sin(time * 2) * .055 * reveal), -.08);
  crystal.rotation.y = reducedMotion ? .12 : Math.sin(time * .55) * .22;
  crystal.scale.setScalar(.32 + reveal * .3);
  glow.scale.setScalar(.6 + reveal * .6);
}
