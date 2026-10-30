import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rounded } from './puzzle-art';

let template: T.Group | undefined;
let rollingTemplate: T.Group | undefined;

export function createFlowerCart(rolling = false): T.Group {
  const cached = rolling ? rollingTemplate : template;
  if (cached) return cached.clone(true);
  const root = new T.Group(); root.name = 'garden-flower-cart';
  const grain = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const shade = Math.sin(y * .44 + Math.sin(x * .035) * 2) * 5 + Math.sin(y * .15 + x * .014) * 3;
    const i = (y * 128 + x) * 4;
    grain[i] = 244 + shade; grain[i + 1] = 220 + shade; grain[i + 2] = 186 + shade; grain[i + 3] = 255;
  }
  const woodMap = new T.DataTexture(grain, 128, 128); woodMap.colorSpace = T.SRGBColorSpace;
  woodMap.magFilter = T.LinearFilter; woodMap.needsUpdate = true;
  const material = (name: string, color: string, map?: T.Texture) => {
    const surface = new T.MeshStandardMaterial({ color, roughness: .82, map }); surface.name = name; return surface;
  };
  const wood = material('cart-timber', '#bf8246', woodMap), lightWood = material('cart-planks', '#dca15a', woodMap);
  const darkWood = material('cart-endgrain', '#946239', woodMap), iron = material('cart-iron', '#57534e');
  iron.roughness = .61; iron.metalness = .35;
  const terracotta = material('cart-terracotta', '#ce7043'), soil = material('cart-soil', '#503b2a');
  const green = material('cart-leaves', '#518437'), fresh = material('cart-fresh-leaves', '#769e42');
  const cream = material('cart-cream-petals', '#fff0bd'), coral = material('cart-coral-petals', '#f47b62');
  const yellow = material('cart-yellow-petals', '#ffcf5b'), gold = material('cart-pollen', '#edb02d');
  const add = (geometry: T.BufferGeometry, surface: T.Material, x: number, y: number, z: number,
    scale = [1, 1, 1], rotation = [0, 0, 0], parent: T.Object3D = root) => {
    const mesh = new T.Mesh(geometry, surface); mesh.position.set(x, y, z); mesh.scale.fromArray(scale);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]); parent.add(mesh); return mesh;
  };
  const box = (w: number, h: number, d: number, surface: T.Material, x: number, y: number, z: number) =>
    add(rounded(w, h, d, Math.min(.025, h / 3, w / 3, d / 3)), surface, x, y, z);

  for (const x of [-.69, .69]) box(.13, .12, 1.04, darkWood, x, .55, 0);
  for (let i = 0; i < 5; i++) box(1.74, .07, .196, i % 2 ? wood : lightWood, 0, .635, -.404 + i * .202);
  for (const z of [-.555, .555]) for (const y of [.705, .875]) box(1.84, .15, .085, lightWood, 0, y, z);
  for (const x of [-.92, .92]) for (const y of [.705, .875]) box(.09, .15, 1.03, wood, x, y, 0);
  for (const x of [-.86, .86]) for (const z of [-.55, .55]) box(.125, .35, .125, wood, x, .80, z);
  for (const z of [-.43, .43]) box(.13, .63, .13, wood, -.72, .315, z);

  // The two curved handles are closed timber sections, with a shared axle below the bed.
  const handleShape = new T.Shape(); handleShape.moveTo(-.79, .63);
  handleShape.bezierCurveTo(-1.11, .78, -1.42, .83, -1.94, .82);
  handleShape.quadraticCurveTo(-2.04, .82, -2.04, .92);
  handleShape.quadraticCurveTo(-2.04, 1.0, -1.94, 1.0);
  handleShape.bezierCurveTo(-1.42, 1.01, -1.1, .98, -.79, .88); handleShape.closePath();
  const handle = new T.ExtrudeGeometry(handleShape, {depth:.105, bevelEnabled:true, bevelSize:.018, bevelThickness:.018, bevelSegments:2, curveSegments:10, steps:1});
  for (const z of [-.43, .43]) add(handle, lightWood, 0, 0, z - .0525);
  const axle = new T.CylinderGeometry(.045, .045, 1.45, 12);
  add(axle, iron, .23, .46, 0, [1,1,1], [Math.PI/2,0,0]);
  const woodRim = new T.LatheGeometry([[.337,-.062],[.405,-.062],[.423,-.046],[.423,.046],[.405,.062],[.337,.062],[.324,.046],[.324,-.046],[.337,-.062]].map(([r,y])=>new T.Vector2(r,y)),36);
  const tire = new T.LatheGeometry([[.416,-.075],[.448,-.075],[.46,-.059],[.46,.059],[.448,.075],[.416,.075],[.416,-.075]].map(([r,y])=>new T.Vector2(r,y)),36);
  const spoke = rounded(.285,.075,.085,.018), hub = new T.CylinderGeometry(.09,.09,.19,20);
  const bolt = new T.SphereGeometry(1,10,6);
  const wheels: T.Group[] = [];
  for (const z of [-.695,.695]) {
    add(woodRim, lightWood, .23,.46,z,[1,1,1],[Math.PI/2,0,0]);
    add(tire, iron, .23,.46,z,[1,1,1],[Math.PI/2,0,0]);
    const wheel = new T.Group(); wheel.name = 'cart-wheel' + Math.sign(z);
    wheel.position.set(.23, .46, z); root.add(wheel); wheels.push(wheel);
    for (let i=0;i<6;i++) {
      const angle=i*Math.PI/3;
      add(spoke,wood,Math.cos(angle)*.203,Math.sin(angle)*.203,0,[1,1,1],[0,0,angle],wheel);
    }
    add(hub,darkWood,.23,.46,z,[1,1,1],[Math.PI/2,0,0]);
    add(bolt,iron,.23,.46,z+Math.sign(z)*.101,[.061,.061,.026]);
  }
  for (const x of [-.86,.86]) for (const z of [-.62,.62]) for (const y of [.705,.875])
    add(bolt,iron,x,y,z,[.027,.027,.013]);
  for (const z of [-.43,.43]) add(bolt,iron,-.94,.82,z,[.013,.029,.029]);

  const potProfile = [[0,0],[.178,0],[.187,.026],[.242,.302],[.265,.315],[.265,.354],[.245,.366],[.229,.346],[.214,.305],[.166,.042],[0,.042]];
  const pot = new T.LatheGeometry(potProfile.map(([r,y])=>new T.Vector2(r,y)),28);
  const dirt = new T.CylinderGeometry(.222,.222,.018,24), stem = new T.CylinderGeometry(.012,.015,1,7);
  const leaf = new T.SphereGeometry(1,8,5), petal = new T.SphereGeometry(1,10,6), pollen = new T.SphereGeometry(1,12,7);
  for (const [x,z,size,petals] of [[-.43,-.255,1,cream],[.43,-.255,1,coral],[-.43,.29,.9,yellow],[.43,.29,.9,cream]] as const) {
    const plant = new T.Group(); plant.position.set(x,.67,z); plant.scale.setScalar(size); root.add(plant);
    add(pot,terracotta,0,0,0,[1,1.25,1],[0,0,0],plant);
    add(dirt,soil,0,.39,0,[1,1,1],[0,0,0],plant);
    for (let i=0;i<12;i++) {
      const angle=i*Math.PI/4;
      add(leaf,i%2?green:fresh,Math.cos(angle)*.18,.45+(i%2)*.065+Math.floor(i/8)*.12,Math.sin(angle)*.18,[.18,.06,.085],[0,-angle,-.15],plant);
    }
    for (let i=0;i<4;i++) {
      const x=(i%2?1:-1)*.14, z=(i<2?-1:1)*.105, y=i<2?.87:.72;
      add(stem,green,x,(.39+y)/2,z,[1,y-.39,1],[0,0,0],plant);
      const bloom = new T.Group(); bloom.position.set(x,y,z); bloom.rotation.x=-.65+(i%2)*.12; bloom.rotation.z=(i%2?1:-1)*.12; plant.add(bloom);
      for (let j=0;j<5;j++) {
        const angle=j*Math.PI*2/5;
        add(petal,petals,Math.sin(angle)*.111,Math.cos(angle)*.111,0,[.077,.119,.045],[0,0,-angle],bloom);
      }
      add(pollen,gold,0,0,.033,[.063,.063,.033],[0,0,0],bloom);
    }
  }

  if (rolling) root.remove(...wheels);
  root.updateMatrixWorld(true);
  const batches = new Map<T.Material,T.BufferGeometry[]>(), originals = new Set<T.BufferGeometry>();
  root.traverse(node=>{
    if (!(node instanceof T.Mesh)) return;
    const geometry=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();
    geometry.applyMatrix4(node.matrixWorld); originals.add(node.geometry);
    const surface=node.material as T.Material;
    if(!batches.has(surface))batches.set(surface,[]);batches.get(surface)!.push(geometry);
  });
  root.clear();
  for (const [surface,geometries] of batches) {
    const merged=mergeGeometries(geometries)!;
    const mesh=new T.Mesh(mergeVertices(merged),surface);merged.dispose();mesh.name=surface.name;
    mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);geometries.forEach(g=>g.dispose());
  }
  if (rolling) for (const wheel of wheels) {
    wheel.updateMatrixWorld(true);
    const parts = wheel.children.map(child => (child as T.Mesh).geometry.clone().applyMatrix4(child.matrix));
    const merged = mergeGeometries(parts)!;
    const mesh = new T.Mesh(mergeVertices(merged), wood); mesh.castShadow = mesh.receiveShadow = true;
    merged.dispose(); parts.forEach(part => part.dispose()); wheel.clear(); wheel.add(mesh); root.add(wheel);
  }
  originals.add(spoke); originals.forEach(g=>g.dispose());
  if (rolling) rollingTemplate = root; else template = root;
  return root.clone(true);
}
