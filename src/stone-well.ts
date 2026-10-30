import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rounded } from './puzzle-art';

let template: T.Group | undefined;

export function createStoneWell(): T.Group {
  if (template) return template.clone(true);
  const root=new T.Group();root.name='garden-stone-well';
  const grain=new Uint8Array(128*128*4),mottle=new Uint8Array(128*128*4);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const i=(y*128+x)*4,g=Math.sin(y*.43+Math.sin(x*.033)*2)*5+Math.sin(y*.14+x*.012)*3;
    const s=Math.sin(x*.11+Math.sin(y*.09)*2)*4+Math.sin(y*.16+x*.03)*3;
    grain.set([244+g,220+g,186+g,255],i);mottle.set([235+s,234+s,229+s,255],i);
  }
  const woodMap=new T.DataTexture(grain,128,128),stoneMap=new T.DataTexture(mottle,128,128);
  for(const map of [woodMap,stoneMap]){map.colorSpace=T.SRGBColorSpace;map.magFilter=T.LinearFilter;map.needsUpdate=true;}
  const material=(name:string,color:string,map?:T.Texture)=>{
    const surface=new T.MeshStandardMaterial({color,roughness:.86,map});surface.name=name;return surface;
  };
  const stones=[material('well-stone-warm','#bcb5a8',stoneMap),material('well-stone-cool','#acafaa',stoneMap),material('well-stone-light','#c8c3b7',stoneMap)];
  const rim=material('well-rim','#d3cbbc',stoneMap),wood=material('well-timber','#ac7542',woodMap);
  const honey=material('well-planks','#cf9451',woodMap),darkWood=material('well-endgrain','#805735',woodMap);
  const roof=material('well-roof','#dc943f',woodMap),roofLight=material('well-roof-variation','#eba94d',woodMap);
  const rope=material('well-rope','#c4ac7c'),iron=material('well-iron','#5f6059'),green=material('well-leaves','#799c3e');
  iron.metalness=.35;iron.roughness=.64;
  const water=material('well-water','#497d82');water.roughness=.32;water.metalness=.08;
  const add=(geometry:T.BufferGeometry,surface:T.Material,x:number,y:number,z:number,rotation=[0,0,0])=>{
    const mesh=new T.Mesh(geometry,surface);mesh.position.set(x,y,z);mesh.rotation.set(rotation[0],rotation[1],rotation[2]);root.add(mesh);return mesh;
  };
  const box=(w:number,h:number,d:number,surface:T.Material,x:number,y:number,z:number)=>
    add(rounded(w,h,d,Math.min(.025,w/3,h/3,d/3)),surface,x,y,z);
  const brick=(radius:number,depth:number)=>{
    const geometry=rounded(radius*Math.PI/6-.013,.29,depth,.035),p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');
    for(let i=0;i<p.count;i++){
      const angle=p.getX(i)/radius,r=radius+p.getZ(i),nx=n.getX(i)*radius/r,nz=n.getZ(i);
      p.setXYZ(i,r*Math.sin(angle),p.getY(i),r*Math.cos(angle));
      const normal=new T.Vector3(nx*Math.cos(angle)+nz*Math.sin(angle),n.getY(i),-nx*Math.sin(angle)+nz*Math.cos(angle)).normalize();
      n.setXYZ(i,normal.x,normal.y,normal.z);
    }
    return geometry;
  };
  const wallBrick=brick(.84,.28),rimBrick=brick(.85,.30);
  for(let row=0;row<3;row++)for(let i=0;i<12;i++){
    add(row===2?rimBrick:wallBrick,row===2?rim:stones[(i+row*2)%3],0,.145+row*.30,0,[0,(i+(row%2)*.5)*Math.PI/6,0]);
  }
  add(new T.CircleGeometry(.695,48),water,0,.10,0,[-Math.PI/2,0,0]);
  for(const x of [-1.03,1.03])box(.18,2.34,.20,wood,x,1.17,0);
  box(2.23,.13,.17,darkWood,0,2.27,0);
  const pitch=Math.atan2(.46,.90),slope=Math.hypot(.46,.90);
  for(const x of [-1.10,1.10])for(const side of [-1,1]){
    const rafter=box(.10,.11,slope+.09,honey,x,2.565,side*.45);rafter.rotation.x=side*pitch;
  }
  const gable=new T.Shape();gable.moveTo(-.86,2.36);gable.lineTo(.86,2.36);gable.lineTo(0,2.80);gable.closePath();
  const gableGeometry=new T.ExtrudeGeometry(gable,{depth:.045,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:1,steps:1});
  for(const x of [-1.115,1.07])add(gableGeometry,wood,x,0,0,[0,Math.PI/2,0]);
  for(const side of [-1,1])for(let row=0;row<3;row++)for(let column=0;column<6;column++){
    const t=(row+.5)/3;
    const tile=box(.445,.065,.39,(row+column)%3?roof:roofLight,-1.13+column*.452,2.83-.46*t+(2-row)*.012,side*.90*t);
    tile.rotation.x=side*pitch;
  }
  for(let i=0;i<6;i++)box(.459,.09,.145,i%2?roof:roofLight,-1.13+i*.452,2.856,0);

  const axle=new T.CylinderGeometry(.075,.075,2.50,20);
  add(axle,honey,0,1.78,0,[0,0,Math.PI/2]);
  for(const x of [-.921,.921])add(new T.CylinderGeometry(.12,.12,.035,20),darkWood,x,1.78,0,[0,0,Math.PI/2]);
  add(new T.CylinderGeometry(.12,.12,.04,20),iron,1.145,1.78,0,[0,0,Math.PI/2]);
  box(.075,.30,.10,honey,1.285,1.65,0);
  add(new T.CylinderGeometry(.056,.056,.27,16),honey,1.425,1.52,0,[0,0,Math.PI/2]);
  add(new T.CylinderGeometry(.029,.029,.016,12),darkWood,1.568,1.52,0,[0,0,Math.PI/2]);

  const winding=[];
  for(let i=0;i<=120;i++){
    const t=i/120,angle=Math.PI+(t-1)*Math.PI*10;
    winding.push(new T.Vector3(-.24+.24*t,1.78+Math.cos(angle)*.105,Math.sin(angle)*.105));
  }
  add(new T.TubeGeometry(new T.CatmullRomCurve3(winding),120,.023,6,false),rope,0,0,0);
  add(new T.CylinderGeometry(.021,.021,.455,10),rope,0,1.4475,0);
  add(new T.SphereGeometry(.027,10,6),rope,0,1.225,0);

  const bucketProfile=[[0,0],[.15,0],[.16,.025],[.205,.33],[.205,.36],[.18,.36],[.175,.33],[.135,.05],[0,.05]];
  add(new T.LatheGeometry(bucketProfile.map(([r,y])=>new T.Vector2(r,y)),32),honey,0,.64,0);
  for(const [y,r]of [[.74,.179],[.94,.202]]){
    const band=new T.LatheGeometry([[r-.004,-.02],[r+.012,-.02],[r+.012,.02],[r-.004,.02],[r-.004,-.02]].map(([r,y])=>new T.Vector2(r,y)),28);
    add(band,iron,0,y,0);
  }
  for(let i=0;i<12;i++){
    const angle=i*Math.PI/6,curve=new T.LineCurve3(new T.Vector3(Math.cos(angle)*.163,.672,Math.sin(angle)*.163),new T.Vector3(Math.cos(angle)*.206,.987,Math.sin(angle)*.206));
    add(new T.TubeGeometry(curve,1,.0025,4,false),darkWood,0,0,0);
  }
  const handle=[];for(let i=0;i<=16;i++){const angle=i*Math.PI/16;handle.push(new T.Vector3(Math.cos(angle)*.205,.99+Math.sin(angle)*.23,0));}
  add(new T.TubeGeometry(new T.CatmullRomCurve3(handle),20,.017,6,false),iron,0,0,0);
  for(const x of [-.205,.205])add(new T.SphereGeometry(.024,10,6),iron,x,.99,0);

  const vine=[];for(let i=0;i<7;i++)vine.push(new T.Vector3(-1.105+Math.sin(i*1.2)*.045,.13+i*.23,.125));
  add(new T.TubeGeometry(new T.CatmullRomCurve3(vine),20,.01,5,false),green,0,0,0);
  const leaf=new T.SphereGeometry(1,8,5);
  for(let i=0;i<10;i++){
    const mesh=add(leaf,green,-1.10+(i%2?.08:-.07),.20+i*.125,.14,[.1,.2,i%2?.5:-.5]);mesh.scale.set(.09,.12,.035);
  }
  for(let i=0;i<7;i++)add(leaf,green,.62+(i%3)*.08,2.91-(i%2)*.02,-.06-Math.floor(i/3)*.07,[0,0,i*.8]).scale.set(.095,.028,.065);

  root.updateMatrixWorld(true);
  const batches=new Map<T.Material,T.BufferGeometry[]>(),originals=new Set<T.BufferGeometry>();
  root.traverse(node=>{
    if(!(node instanceof T.Mesh))return;
    const geometry=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();geometry.applyMatrix4(node.matrixWorld);originals.add(node.geometry);
    const surface=node.material as T.Material;if(!batches.has(surface))batches.set(surface,[]);batches.get(surface)!.push(geometry);
  });
  root.clear();
  for(const[surface,geometries]of batches){
    const merged=mergeGeometries(geometries)!;const mesh=new T.Mesh(mergeVertices(merged),surface);merged.dispose();mesh.name=surface.name;
    mesh.castShadow=surface!==water;mesh.receiveShadow=true;root.add(mesh);geometries.forEach(g=>g.dispose());
  }
  originals.forEach(g=>g.dispose());template=root;
  return root.clone(true);
}
