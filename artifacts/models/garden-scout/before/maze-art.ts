import * as T from 'three';
import { bean, mat, orb } from './models';
import { rounded } from './puzzle-art';
import { createGardenTrowel } from './garden-trowel';
import { createGardenToolRack } from './garden-tool-rack';

const pole = new T.CylinderGeometry(1, 1, 1, 12);
const board = rounded(1, 1, 1, .07);
const leafShape = new T.Shape();
leafShape.moveTo(0, -.5);
leafShape.bezierCurveTo(-.6, -.2, -.48, .24, 0, .62);
leafShape.bezierCurveTo(.48, .24, .6, -.2, 0, -.5);
const leafGeometry = new T.ExtrudeGeometry(leafShape, { depth: .06, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 2, steps: 1 });

function piece(parent: T.Object3D, geometry: T.BufferGeometry, color: string, x: number, y: number, z: number, sx = 1, sy = sx, sz = sx) {
  const mesh = new T.Mesh(geometry, mat(color));
  mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh); return mesh;
}

function leaf(parent: T.Object3D, color: string, x: number, y: number, z: number, size: number) {
  const root = new T.Group(); root.position.set(x, y, z); root.scale.setScalar(size);
  piece(root, leafGeometry, color, 0, 0, 0);
  piece(root, pole, '#d9e892', 0, .02, -.035, .018, .82, .018);
  for (const side of [-1, 1]) {
    for (const y of [-.15, .08]) {
      const vein = piece(root, pole, '#d9e892', side * .12, y + .06, -.035, .012, .29, .012);
      vein.rotation.z = -side * .8;
    }
  }
  parent.add(root); return root;
}

export { createGardenWindmill as windmill } from './plaza-mechanisms';

export { createWindWand as windWand } from './wind-wand';

export function leafMonster(boss = false): T.Group {
  const root = new T.Group();
  const body = new T.Group(); body.name = 'body'; root.add(body);
  body.add(orb(boss ? '#a6bb65' : '#82b985', 0, .62, 0, .43, .51, .35));
  body.add(orb('#fff0cb', 0, .83, -.285, .32, .25, .1));
  for (const side of [-1, 1]) {
    const foot = orb('#775a42', side * .23, .1, -.06, .19, .1, .25); foot.name = `foot${side}`; body.add(foot);
    body.add(orb('#293c38', side * .115, .87, -.38, .045, .064, .026));
    body.add(orb('#ffffff', side * .115 + .012, .891, -.4, .012));
    body.add(orb('#e9a98c', side * .23, .76, -.36, .066, .034, .018));
    const arm = orb('#608e61', side * .43, .54, -.04, .12, .24, .13); arm.name = `arm${side}`; arm.rotation.z = side * .4; body.add(arm);
  }
  const tuft = leaf(body, '#548a58', 0, 1.08, .02, .33); tuft.rotation.z = -.35;
  const shield = leaf(body, '#579663', -.12, .43, -.47, .69); shield.name = 'shield';
  if (boss) {
    piece(body, new T.CylinderGeometry(.3, .26, .12, 8), '#f0c95d', 0, 1.12, 0);
    for (const x of [-.2, 0, .2]) piece(body, new T.ConeGeometry(.085, .22, 5), '#f0c95d', x, 1.27, -.02);
    const emblem = goldKey(); emblem.scale.setScalar(.24); emblem.position.set(.12, .42, -.55); body.add(emblem);
    root.scale.setScalar(1.9);
  }
  root.traverse(o => { if (o instanceof T.Mesh) o.castShadow = true; });
  return root;
}

export { createTreasureChest as treasureChest } from './treasure-chest';

export function gardenTools(): T.Group {
  const root = new T.Group();
  const trowel = createGardenTrowel(); trowel.scale.setScalar(.82); trowel.rotation.set(-Math.PI / 2, 0, .45);
  trowel.position.set(-.4, 0, .45); root.add(trowel);
  trowel.position.y = .025 - new T.Box3().setFromObject(trowel).min.y;
  return root;
}

export function gardenerYard(): T.Group {
  const root = new T.Group(); root.name = 'gardener-yard';
  const rack = createGardenToolRack(); rack.position.set(-2.4, 0, -2.1); root.add(rack);
  return root;
}

export function goldKey(): T.Group {
  const root = new T.Group();
  piece(root, new T.TorusGeometry(.22, .065, 8, 20), '#f5cb58', 0, .73, 0);
  piece(root, pole, '#f5cb58', 0, .3, 0, .06, .55, .06);
  for (const y of [.08, .23]) piece(root, board, '#f5cb58', .11, y, 0, .23, .09, .12);
  return root;
}

export function gardener(): T.Group {
  const root = bean('#c7a36b');
  piece(root, board, '#5f927e', 0, -.12, -.41, .44, .46, .08);
  piece(root, board, '#e7c999', .08, -.19, -.46, .2, .16, .035);
  piece(root, new T.CylinderGeometry(.64, .64, .07, 24), '#e4c77c', 0, .66, 0);
  piece(root, new T.CylinderGeometry(.31, .4, .3, 16), '#efda98', 0, .81, 0);
  piece(root, new T.CylinderGeometry(.38, .4, .07, 16), '#78996b', 0, .71, 0);
  const sprig = leaf(root, '#76a975', .33, .82, -.15, .24); sprig.rotation.z = -.65;
  return root;
}

export function signpost(text: string): T.Group {
  const root = new T.Group();
  piece(root, board, '#987348', 0, .72, 0, .15, 1.44, .15);
  piece(root, board, '#b58c54', 0, 1.26, 0, 2.1, .72, .16);
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return root;
  ctx.fillStyle = '#fff0cc'; ctx.fillRect(0, 0, 768, 256);
  ctx.fillStyle = '#3d5747'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 72px "Microsoft YaHei", sans-serif';
  ctx.fillText(text, 384, 128, 720);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
  const face = new T.Mesh(new T.PlaneGeometry(1.95, .6), new T.MeshBasicMaterial({ map: texture }));
  face.position.set(0, 1.26, -.086); face.rotation.y = Math.PI; root.add(face);
  return root;
}
