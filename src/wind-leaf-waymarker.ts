import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rounded } from './puzzle-art';
import { createTreeBench } from './tree-bench';

let template: T.Group | undefined;
export const windLeafWaymarkerColliders = [
  { x: 0, y: .32, z: 0, width: .94, height: .64, depth: .8 },
  { x: 0, y: 1.665, z: 0, width: .42, height: 2.05, depth: .42 },
  { x: -.9, y: 2.12, z: 0, width: 1.5, height: .62, depth: .22 },
  { x: .9, y: 1.36, z: 0, width: 1.5, height: .62, depth: .22 },
];

export function createWindLeafWaymarker(): T.Group {
  if (template) return template.clone(true);
  const root = new T.Group(); root.name = 'garden-wind-leaf-waymarker';
  const palette = createTreeBench();
  const shared = (name: string) => (palette.getObjectByName('tree-bench-' + name) as T.Mesh).material as T.MeshStandardMaterial;
  const wood = shared('wood'), dark = shared('frame'), stone = shared('stone'), brass = shared('brass'), teal = shared('leaf');
  const face = new T.MeshStandardMaterial({ color: '#eddbb8', roughness: .84 }); face.name = 'waymarker-sign-face';
  const gold = new T.MeshStandardMaterial({ color: '#e4aa3b', roughness: .56, metalness: .2 }); gold.name = 'waymarker-golden-leaf';
  const green = new T.MeshStandardMaterial({ color: '#648e3e', roughness: .9 }); green.name = 'waymarker-ferns';
  const group = (name: string, y = 0) => {
    const part = new T.Group(); part.name = name; part.position.y = y; root.add(part); return part;
  };
  const frame = group('waymarker-frame'), upper = group('waymarker-leaf-arrow', 2.12), lower = group('waymarker-wind-arrow', 1.36);
  const rotor = group('waymarker-rotor', 3.19); rotor.position.z = .1;
  const add = (parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material, x = 0, y = 0, z = 0) => {
    const mesh = new T.Mesh(geometry, material); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  const box = (parent: T.Object3D, w: number, h: number, d: number, material: T.Material, x: number, y: number, z: number) =>
    add(parent, rounded(w, h, d, Math.min(.045, w / 4, h / 4, d / 4)), material, x, y, z);
  const tube = (parent: T.Object3D, points: number[][], radius: number, material: T.Material) =>
    add(parent, new T.TubeGeometry(new T.CatmullRomCurve3(points.map(([x, y, z]) => new T.Vector3(x, y, z))), 16, radius, 5, false), material);
  const dome = new T.SphereGeometry(1, 10, 6);
  const bolt = (parent: T.Object3D, x: number, y: number, z: number, size = .034) =>
    add(parent, dome, brass, x, y, z).scale.set(size, size, size * .45);
  const extrude = (shape: T.Shape, depth: number, bevel = .018) => {
    const geometry = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 9, steps: 1 });
    geometry.translate(0, 0, -depth / 2); return geometry;
  };
  const leaf = new T.Shape(); leaf.moveTo(0, 0);
  leaf.bezierCurveTo(.28, .15, .3, .57, 0, .9); leaf.bezierCurveTo(-.3, .57, -.28, .15, 0, 0);
  const leafGeometry = extrude(leaf, .04);
  const sprig = (parent: T.Object3D, x: number, y: number, z: number, size: number, material: T.Material) => {
    for (const angle of [-.7, 0, .7]) {
      const blade = add(parent, leafGeometry, material, x, y, z);
      blade.scale.setScalar(size * (angle ? .76 : 1)); blade.rotation.z = angle;
    }
    tube(parent, [[x,y-.025,z+.03],[x,y+size*.66,z+.03]], .012, material);
  };
  box(frame, .94, .64, .8, stone, 0, .32, 0);
  add(frame, new T.CylinderGeometry(.16, .18, 2.05, 12), wood, 0, 1.665, 0);
  add(frame, new T.CylinderGeometry(.21, .23, .16, 12), dark, 0, .72, 0);
  for (const y of [.86, 1.69, 2.51]) {
    add(frame, new T.CylinderGeometry(.21, .21, .13, 16), brass, 0, y, 0);
    bolt(frame, 0, y, .215, .035);
  }
  add(frame, new T.CylinderGeometry(.075, .09, .37, 12), brass, 0, 2.89, 0);
  const axle = add(frame, new T.CylinderGeometry(.09, .09, .26, 12), brass, 0, 3.19, .03); axle.rotation.x = Math.PI / 2;
  sprig(frame, 0, .13, .418, .41, teal);
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const x = side * (.48 + i * .09), z = -.12 + i * .13;
    tube(frame, [[x,.025,z],[x+side*.09,.21,z],[x+side*.19,.39+i*.055,z]], .012, green);
    for (let j = 0; j < 4; j++) {
      const blade = add(frame, leafGeometry, green, x + side * j * .042, .07+j*.065, z);
      blade.scale.setScalar(.16 + j * .012); blade.rotation.set(.25, side*.4, (j%2 ? 1 : -1)*1.05);
    }
  }
  const arrowShape = (direction: number, inset: number) => {
    const shape = new T.Shape(), half = .29 - inset;
    shape.moveTo(direction*(.18+inset), -half); shape.lineTo(direction*(1.32-inset*.5), -half);
    shape.lineTo(direction*(1.62-inset), 0); shape.lineTo(direction*(1.32-inset*.5), half);
    shape.lineTo(direction*(.18+inset), half); shape.closePath(); return shape;
  };
  for (const [part, direction] of [[upper, -1], [lower, 1]] as const) {
    add(part, extrude(arrowShape(direction, 0), .16, .025), wood);
    for (const side of [-1, 1]) {
      add(part, extrude(arrowShape(direction, .065), .018, .008), face, 0, 0, side*.099);
      for (const x of [.28, 1.27]) for (const y of [-.18, .18]) bolt(part, direction*x, y, side*.12);
      const x = direction * .85, z = side * .125;
      if (part === upper) sprig(part, x, -.17, z, .34, dark);
      else {
        for (const [y, length, bend] of [[.14,.36,.12],[0,.46,-.13],[-.14,.28,-.12]]) {
          tube(part, [[x-.29,y,z],[x+length*.55,y,z],[x+length,y+.035,z],[x+length*.88,y+bend,z],[x+length*.64,y+bend*.75,z]], .024, dark);
        }
      }
    }
  }
  const center = add(rotor, new T.CylinderGeometry(.16, .16, .18, 16), brass); center.rotation.x = Math.PI/2;
  bolt(rotor, 0, 0, .115, .095);
  for (let i = 0; i < 3; i++) {
    const angle = .18 + i * Math.PI * 2 / 3, blade = new T.Group(); blade.rotation.z = angle; rotor.add(blade);
    add(blade, leafGeometry, gold, 0, .11, 0);
    tube(blade, [[0,.12,.038],[0,.48,.038],[0,.94,.038]], .012, brass);
    for (const y of [.38,.57,.73]) {
      const width = y > .65 ? .11 : .18;
      for (const side of [-1, 1]) tube(blade, [[0,y,.038],[side*width,y+.1,.038]], .008, brass);
    }
  }
  // Keep the rotor and the two arrows separate while batching each part by material.
  root.updateMatrixWorld(true);
  for (const part of [frame, upper, lower, rotor]) {
    const inverse = part.matrixWorld.clone().invert(), batches = new Map<T.Material, T.BufferGeometry[]>(), originals = new Set<T.BufferGeometry>();
    part.traverse(node => {
      if (!(node instanceof T.Mesh)) return;
      const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
      geometry.applyMatrix4(inverse.clone().multiply(node.matrixWorld)); originals.add(node.geometry);
      const material = node.material as T.Material;
      if (!batches.has(material)) batches.set(material, []); batches.get(material)!.push(geometry);
    });
    part.clear();
    for (const [material, geometries] of batches) {
      const merged = mergeGeometries(geometries)!, mesh = new T.Mesh(mergeVertices(merged), material); merged.dispose();
      mesh.name = part.name + '-' + material.name; mesh.castShadow = mesh.receiveShadow = true; part.add(mesh);
      geometries.forEach(geometry => geometry.dispose());
    }
    originals.forEach(geometry => geometry.dispose());
  }
  template = root; return root.clone(true);
}
