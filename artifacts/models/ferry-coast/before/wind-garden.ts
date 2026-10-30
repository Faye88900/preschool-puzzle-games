import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { gardenFlower, colorFlower } from './puzzle-art';
import { mat, orb } from './models';
import { at } from './maze-map';
import { createShieldCourtyard } from './shield-courtyard';
import { FlowerChoir } from './flower-choir';
import { createWindSailBoat } from './wind-sail-boat';
import { createRopeDock } from './rope-dock';

export function createWindGarden(floorTexture: T.Texture) {
  const root = new T.Group(); root.name = 'wind-garden';
  const colliders: { x: number; y: number; z: number; width: number; height: number; depth: number }[] = [];
  const group = (name: string) => { const g = new T.Group(); g.name = name; root.add(g); return g; };
  const paving = group('wind-garden-paving'), flowers = group('wind-garden-flowers');
  const foliage = group('wind-garden-ivy');
  const columns = group('wind-garden-pavilion-columns'), roof = group('wind-garden-pavilion-roof');
  const pond = group('wind-garden-pond'), dock = createRopeDock(4.4,3.3), boat = createWindSailBoat();
  dock.root.name='wind-garden-dock';dock.gate.name='wind-garden-boarding-gate';
  const pavilionShift = at('pavilion').x-42, dockShift = at('dock').x-50, choir = at('choir');
  columns.position.x = roof.position.x = pavilionShift;
  pond.position.x = dockShift;dock.root.position.set(49.65+dockShift,0,-10);
  colliders.push(...dock.colliders.map(c=>({...c,x:c.x+dock.root.position.x,z:c.z+dock.root.position.z})));
  boat.position.set(at('dock').x+3.7,-.3,at('dock').z); boat.rotation.y = Math.PI/2;
  flowers.position.set(choir.x,0,choir.z);
  const stone = mat('#dfcda3'), pale = mat('#f1dfb6'), shade = mat('#c7b389');
  const green = mat('#658b57'), gold = mat('#dfbb66');
  const add = (parent: T.Group, geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number) => {
    const mesh = new T.Mesh(geometry, material); mesh.position.set(x,y,z); parent.add(mesh); return mesh;
  };
  const solid = (x: number, y: number, z: number, width: number, height: number, depth: number) => colliders.push({x,y,z,width,height,depth});
  const disc = (parent: T.Group, x: number, z: number, radius: number, material: T.Material) =>
    add(parent,new T.CylinderGeometry(radius,radius,.035,48),material,x,.04,z);
  const bloom = gardenFlower(); colorFlower(bloom,'#f0b9bd',true);
  const plant = (x: number, z: number, scale: number, color: string) => {
    const f=bloom.clone(true); colorFlower(f,color,true); f.position.set(x,.06,z); f.scale.setScalar(scale); foliage.add(f);
  };
  // Stepping stones reinforce the left bend from the existing onward corridor.
  for(const [x,z] of [[40,24],[40,21],[37,20],[34,20],[31,20],[28,20],[25,17],[25,14],[25,11],
    [33,0],[37,0],[41,0],[45,0],[49,0],[53,0],[55,4],[55,8],[55,12],[59,15],[63,15],[67,15],[71,15],
    [75,12],[75,8],[75,4],[75,0],[79,0],[83,0],[85,-3],[85,-9],[90,-10],[94,-10]]) {
    const slab=add(paving,new T.CylinderGeometry(.84,.9,.035,7),pale,x,.04,z);slab.rotation.y=x*.3;
  }
  // The round bed is off the main walking line, rather than in the arena centre.
  const bed=disc(flowers,0,0,3,mat('#739454'));bed.scale.z=.65;
  const rim=add(flowers,new T.TorusGeometry(2.9,.19,6,36),pale,0,.22,0);rim.rotation.x=Math.PI/2;rim.scale.y=.65;
  solid(choir.x,.3,choir.z,5.7,.6,3.5);
  const colors=['#eca0b8','#edce62','#b6a1df','#edb4c5','#e8ce73'];
  const ivy = (x: number, y: number, z: number, length: number, parent: T.Group) => {
    const stem=new T.CatmullRomCurve3(Array.from({length:9},(_,i)=>new T.Vector3(x+Math.sin(i*1.4)*.1,y-i*length/9,z)));
    add(parent,new T.TubeGeometry(stem,12,.025,4),green,0,0,0);
    for(let i=0;i<9;i++) {
      const leaf=orb(i%2?'#749957':'#52783f',x+Math.sin(i*1.4)*.18,y-i*length/9,z+Math.cos(i)*.09,.15,.2,.07);
      leaf.rotation.z=Math.sin(i)*.8;parent.add(leaf);
    }
  };
  // An open rotunda faces the player; its floor is flush, with no invisible step.
  disc(paving,42+pavilionShift,-5,3.35,pale);
  for(let i=0;i<6;i++) {
    const a=Math.PI/6+i*Math.PI/3,x=42+Math.sin(a)*2.8,z=-5+Math.cos(a)*2.8;
    add(columns,new T.CylinderGeometry(.28,.36,3.5,12),pale,x,1.85,z);
    for(const y of [.18,3.62])add(columns,new T.CylinderGeometry(.48,.48,.25,12),stone,x,y,z);
    solid(x+pavilionShift,1.9,z,.8,3.8,.8);ivy(x,3.9,z+.3,1.2,columns);
  }
  const dome=add(roof,new T.SphereGeometry(3.85,24,10,0,Math.PI*2,0,Math.PI/2),mat('#8ca77a'),42,3.85,-5);dome.scale.y=.4;
  const eave=add(roof,new T.TorusGeometry(3.85,.12,6,48),pale,42,3.85,-5);eave.rotation.x=Math.PI/2;
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4,curve=new T.CatmullRomCurve3(Array.from({length:9},(_,j)=>{
      const t=j*Math.PI/16;return new T.Vector3(42+Math.cos(a)*3.88*Math.sin(t),3.85+1.57*Math.cos(t),-5+Math.sin(a)*3.88*Math.sin(t));}));
    add(roof,new T.TubeGeometry(curve,12,.045,4),pale,0,0,0);
  }
  add(roof,new T.SphereGeometry(.22,10,8),gold,42,5.5,-5);
  // The pond stays inside the island edge; the dock is the sole walkable water crossing.
  const water=new T.MeshStandardMaterial({color:'#72b7bd',roughness:.3,metalness:.08});
  const pool=disc(pond,50,-16.8,2.2,water);pool.scale.z=2.55;pool.position.y=.045;
  const bank=add(pond,new T.TorusGeometry(2.25,.15,6,48),shade,50,.07,-16.8);bank.rotation.x=Math.PI/2;bank.scale.y=2.5;
  for(let i=0;i<4;i++) {
    const ripple=add(pond,new T.TorusGeometry(.32+i*.09,.018,4,28),mat('#a2d3cd'),49.2+(i%2)*1.4,.105,-13.6-i*1.5);ripple.rotation.x=Math.PI/2;
    const pad=disc(pond,48.7+(i%2)*2,-14.5-i*1.6,.25,green);pad.position.y=.07;
  }
  for(const [x,z]of [[18,12],[32,8],[34,-3],[53,11],[60,16],[70,14],[77,3],[82,6],[90,5],[82,-11]]) {
    for(let i=0;i<3;i++)plant(x+Math.sin(i*2.4)*.8,z+Math.cos(i*2.4)*.6,.25,colors[i%5]);
  }
  // Batch static parts by material within named components, preserving roof occlusion control.
  root.updateMatrixWorld(true);
  const leafSphere = new T.SphereGeometry(1,8,5);
  for(const component of root.children) {
    const inverse=component.matrixWorld.clone().invert(),batches=new Map<T.Material,T.BufferGeometry[]>();
    component.traverse(node=>{
      if(!(node instanceof T.Mesh))return;
      const source = node.geometry.type === 'SphereGeometry' && (node.geometry as T.SphereGeometry).parameters.radius === 1 ? leafSphere : node.geometry;
      const geometry=source.index?source.toNonIndexed():source.clone();
      geometry.applyMatrix4(inverse.clone().multiply(node.matrixWorld));geometry.deleteAttribute('uv');
      const material=node.material as T.Material;
      if(!batches.has(material))batches.set(material,[]);batches.get(material)!.push(geometry);
    });
    component.clear();
    for(const [material,geometries]of batches) {
      const mesh=new T.Mesh(mergeGeometries(geometries)!,material);mesh.castShadow=component!==paving&&component!==pond;mesh.receiveShadow=true;
      component.add(mesh);geometries.forEach(g=>g.dispose());
    }
  }
  leafSphere.dispose();
  const flowerChoir = new FlowerChoir(flowers);
  root.add(boat,dock.root);
  const courtyard=createShieldCourtyard(floorTexture);root.add(courtyard.root);colliders.push(...courtyard.colliders);
  return {root,colliders,courtyard,flowerChoir};
}
