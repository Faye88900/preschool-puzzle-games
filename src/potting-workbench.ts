import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rounded } from './puzzle-art';

let template: T.Group | undefined;

export function createPottingWorkbench(): T.Group {
  if (template) return template.clone(true);
  const root = new T.Group(); root.name = 'garden-potting-workbench';
  const grain = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const shade = Math.sin(y * .47 + Math.sin(x * .035) * 2) * 5 + Math.sin(y * .13 + x * .012) * 3;
    const i = (y * 128 + x) * 4;
    grain[i] = 244 + shade; grain[i + 1] = 220 + shade; grain[i + 2] = 186 + shade; grain[i + 3] = 255;
  }
  const woodMap = new T.DataTexture(grain, 128, 128); woodMap.colorSpace = T.SRGBColorSpace;
  woodMap.magFilter = T.LinearFilter; woodMap.needsUpdate = true;
  const material = (name: string, color: string, map?: T.Texture) => {
    const result = new T.MeshStandardMaterial({ color, roughness: .82, map }); result.name = name; return result;
  };
  const wood = material('bench-timber', '#c58949', woodMap), lightWood = material('bench-planks', '#dfaa65', woodMap);
  const darkWood = material('bench-endgrain', '#a86f39', woodMap), terracotta = material('bench-terracotta', '#c96d40');
  const soil = material('bench-soil', '#503b2a'), plastic = material('bench-tray', '#43474a');
  const green = material('bench-leaves', '#62913b'), fresh = material('bench-new-leaves', '#9dbb54');
  const cloth = material('bench-linen', '#d4c2a0'), paper = material('bench-packets', '#fff1cd');
  const orange = material('bench-flower-print', '#e88b51'), gold = material('bench-flower-center', '#f4c963');
  const add = (geometry: T.BufferGeometry, surface: T.Material, x: number, y: number, z: number,
    scale = [1, 1, 1], rotation = [0, 0, 0], parent: T.Object3D = root) => {
    const mesh = new T.Mesh(geometry, surface); mesh.position.set(x, y, z); mesh.scale.fromArray(scale); mesh.rotation.set(rotation[0], rotation[1], rotation[2]); parent.add(mesh); return mesh;
  };
  const box = (w: number, h: number, d: number, surface: T.Material, x: number, y: number, z: number) =>
    add(rounded(w, h, d, Math.min(.018, h / 3, w / 3, d / 3)), surface, x, y, z);
  for (const x of [-.77, .77]) for (const z of [-.27, .27]) box(.12, .94, .12, wood, x, .47, z);
  for (const z of [-.315, .315]) {
    box(1.66, .12, .08, wood, 0, .88, z);
    box(1.64, .075, .07, wood, 0, .22, z);
  }
  for (const x of [-.77, .77]) {
    box(.08, .11, .57, darkWood, x, .88, 0);
    box(.08, .075, .57, wood, x, .22, 0);
  }
  for (let i = 0; i < 4; i++) {
    box(1.8, .085, .181, i % 2 ? lightWood : wood, 0, .9775, -.282 + i * .188);
    box(1.47, .045, .145, i % 2 ? wood : lightWood, 0, .2675, -.225 + i * .15);
  }
  box(1.79, .14, .045, wood, 0, 1.075, -.352);
  const peg = new T.CylinderGeometry(.013, .013, .007, 10);
  for (const x of [-.77, .77]) for (const y of [.23, .88]) add(peg, darkWood, x, y, .358, [1, 1, 1], [Math.PI / 2, 0, 0]);

  const potProfile = [[0, 0], [.095, 0], [.103, .018], [.136, .20], [.151, .207], [.153, .23], [.13, .237], [.126, .208], [.108, .04], [0, .04]];
  const potGeometry = new T.LatheGeometry(potProfile.map(([r, y]) => new T.Vector2(r, y)), 28);
  add(potGeometry, terracotta, -.68, 1.02, -.205);
  for (let i = 0; i < 3; i++) add(potGeometry, terracotta, -.48, .29 + i * .063, .04, [1 - i * .12, 1 - i * .12, 1 - i * .12]);

  const leafShape = new T.Shape(); leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(-.55, .18, -.48, .77, 0, 1); leafShape.bezierCurveTo(.48, .77, .55, .18, 0, 0);
  const leaf = new T.ExtrudeGeometry(leafShape, {depth: .04, bevelEnabled:true, bevelSize:.022, bevelThickness:.018, bevelSegments:2, curveSegments:8, steps:1});
  const leafPoints = leaf.getAttribute('position');
  for (let i=0;i<leafPoints.count;i++) leafPoints.setZ(i,leafPoints.getZ(i)+.14*Math.sin(leafPoints.getY(i)*Math.PI));
  leaf.computeVertexNormals();
  const stem = new T.CylinderGeometry(.007, .009, .075, 6);
  const cup = new T.CylinderGeometry(.115, .087, .13, 4, 1, true);
  const dirt = rounded(.143, .018, .143, .009);
  for (const x of [-.58, -.36, -.14]) for (const z of [-.075, .125]) {
    add(cup, plastic, x, 1.10, z, [1,1,1], [0,Math.PI/4,0]);
    add(dirt, soil, x, 1.154, z);
    add(stem, green, x, 1.2, z);
    add(leaf, green, x, 1.21, z, [.14,.16,.12], [-.25,.5,.7]);
    add(leaf, fresh, x, 1.21, z, [.14,.16,.12], [.2,-.5,-.7]);
  }
  // One rim with six real openings keeps the soil and seedlings recessed in their cells.
  const rimShape = new T.Shape(); rimShape.moveTo(-.35, -.215); rimShape.lineTo(.35,-.215); rimShape.lineTo(.35,.215); rimShape.lineTo(-.35,.215); rimShape.closePath();
  for (const x of [-.22, 0, .22]) for (const z of [-.10, .10]) {
    const hole = new T.Path(); hole.moveTo(x-.073,z-.073); hole.lineTo(x-.073,z+.073); hole.lineTo(x+.073,z+.073); hole.lineTo(x+.073,z-.073); hole.closePath(); rimShape.holes.push(hole);
  }
  const rim = new T.ExtrudeGeometry(rimShape, {depth:.012, bevelEnabled:true, bevelSize:.006, bevelThickness:.004, bevelSegments:2, steps:1});
  add(rim, plastic, -.36, 1.171, .025, [1,1,1], [-Math.PI/2,0,0]);

  const sackGeometry = rounded(.44,.40,.30,.065), points = sackGeometry.getAttribute('position');
  for (let i=0;i<points.count;i++) {
    const x=points.getX(i), y=points.getY(i), z=points.getZ(i), fold=1 + .035*Math.cos(Math.atan2(z,x)*7+y*12);
    points.setXYZ(i, x*fold, y, z*fold);
  }
  sackGeometry.computeVertexNormals();
  add(sackGeometry, cloth, .48, .49, .03);
  add(rounded(.27,.07,.18,.03),cloth,.48,.693,.03);
  add(new T.TorusGeometry(.112,.023,8,28), cloth, .48,.72,.03,[1.2,1,.85],[-Math.PI/2,0,0]);
  add(new T.CircleGeometry(.105,24), soil,.48,.711,.03,[1.2,.85,1],[-Math.PI/2,0,0]);
  add(leaf, green, .475,.48,.194,[.065,.105,.03],[0,0,.45]);
  add(leaf, green, .475,.48,.195,[.065,.105,.03],[0,0,-.45]);

  for (const [x, flower] of [[.38,false],[.67,true]] as const) {
    const packet = new T.Group(); packet.position.set(x,1.169,-.24); packet.rotation.x=-.19; root.add(packet);
    add(rounded(.225,.295,.028,.012), paper,0,0,0,[1,1,1],[0,0,0],packet);
    add(rounded(.17,.009,.005,.002),flower?orange:green,0,-.101,.018,[1,1,1],[0,0,0],packet);
    if (flower) {
      const petal = new T.SphereGeometry(1,10,6);
      for(let i=0;i<5;i++){const angle=i*Math.PI*2/5;add(petal,orange,Math.sin(angle)*.036,.015+Math.cos(angle)*.036,.024,[.026,.03,.005],[0,0,-angle],packet);}
      add(new T.SphereGeometry(.018,10,6),gold,0,.015,.031,[1,1,.3],[0,0,0],packet);
    } else {
      add(leaf,green,0,-.054,.02,[.075,.12,.03],[0,0,.4],packet);
      add(leaf,green,0,-.054,.02,[.075,.12,.03],[0,0,-.4],packet);
    }
  }

  root.updateMatrixWorld(true);
  const batches = new Map<T.Material, T.BufferGeometry[]>(), originals = new Set<T.BufferGeometry>();
  root.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
    geometry.applyMatrix4(node.matrixWorld); originals.add(node.geometry);
    const surface=node.material as T.Material;
    if(!batches.has(surface)) batches.set(surface,[]); batches.get(surface)!.push(geometry);
  });
  root.clear();
  for (const [surface, geometries] of batches) {
    const merged=mergeGeometries(geometries)!;
    const mesh=new T.Mesh(mergeVertices(merged),surface);merged.dispose();mesh.name=surface.name;
    mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);geometries.forEach(g=>g.dispose());
  }
  originals.forEach(g=>g.dispose()); template=root;
  return root.clone(true);
}
