import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rounded } from './puzzle-art';

let template: T.Group | undefined;

export function createBirdhouse(): T.Group {
  if (template) return template.clone(true);
  const root = new T.Group(); root.name = 'garden-birdhouse';
  const grain = new Uint8Array(128 * 128 * 4);
  for (let y=0;y<128;y++) for (let x=0;x<128;x++) {
    const shade=Math.sin(x*.41+Math.sin(y*.032)*2)*4+Math.sin(x*.13+y*.009)*3, i=(y*128+x)*4;
    grain[i]=246+shade;grain[i+1]=229+shade;grain[i+2]=201+shade;grain[i+3]=255;
  }
  const woodMap = new T.DataTexture(grain,128,128);woodMap.colorSpace=T.SRGBColorSpace;
  woodMap.magFilter=T.LinearFilter;woodMap.needsUpdate=true;
  const material=(name:string,color:string,map?:T.Texture)=>{
    const surface=new T.MeshStandardMaterial({color,roughness:.85,map});surface.name=name;return surface;
  };
  const cream=material('birdhouse-cream','#fff1d0',woodMap),wood=material('birdhouse-timber','#be8649',woodMap);
  const honey=material('birdhouse-trim','#dda65e',woodMap),roof=material('birdhouse-tiles','#ce6843',woodMap);
  const roofLight=material('birdhouse-tile-variation','#db7750',woodMap),inside=material('birdhouse-interior','#795638');
  const iron=material('birdhouse-fasteners','#706956');iron.metalness=.3;iron.roughness=.64;
  const add=(geometry:T.BufferGeometry,surface:T.Material,x:number,y:number,z:number,rotation=[0,0,0])=>{
    const mesh=new T.Mesh(geometry,surface);mesh.position.set(x,y,z);mesh.rotation.set(rotation[0],rotation[1],rotation[2]);root.add(mesh);return mesh;
  };
  const box=(w:number,h:number,d:number,surface:T.Material,x:number,y:number,z:number)=>
    add(rounded(w,h,d,Math.min(.012,w/3,h/3,d/3)),surface,x,y,z);
  const gable=()=>{
    const shape=new T.Shape();shape.moveTo(-.30,.11);shape.lineTo(.30,.11);shape.lineTo(.30,.69);
    shape.lineTo(0,.965);shape.lineTo(-.30,.69);shape.closePath();return shape;
  };
  const front=gable(),entrance=new T.Path();entrance.absarc(0,.58,.108,0,Math.PI*2,true);front.holes.push(entrance);
  const panelOptions={depth:.038,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:2,curveSegments:24,steps:1};
  add(new T.ExtrudeGeometry(front,panelOptions),cream,0,0,.204);
  add(new T.ExtrudeGeometry(gable(),panelOptions),cream,0,0,-.238);
  box(.042,.59,.405,cream,-.28,.405,0);box(.042,.59,.405,cream,.28,.405,0);
  box(.56,.035,.40,inside,0,.128,0);
  box(.51,.55,.012,inside,0,.425,-.191);
  for(const x of [-.254,.254])box(.008,.52,.39,inside,x,.415,.005);
  const ring=new T.LatheGeometry([[.104,-.012],[.115,-.012],[.12,-.003],[.12,.003],[.115,.012],[.104,.012],[.104,-.012]].map(([r,y])=>new T.Vector2(r,y)),32);
  add(ring,honey,0,.58,.247,[Math.PI/2,0,0]);
  for(const x of [-.29,.29]) for(const z of [-.219,.229])box(.035,.59,.035,wood,x,.405,z);
  box(.69,.11,.51,honey,0,.055,0);
  box(.64,.055,.02,wood,0,.055,.258);
  const perch=new T.LatheGeometry([[0,0],[.032,0],[.037,.012],[.037,.17],[.031,.183],[0,.187]].map(([r,y])=>new T.Vector2(r,y)),20);
  add(perch,honey,0,.315,.24,[Math.PI/2,0,0]);

  const pitch=Math.atan2(.31,.34),slope=Math.hypot(.31,.34);
  for(const side of [-1,1]) {
    const frame=box(slope+.09,.047,.55,wood,side*.17,.8475,0);frame.rotation.z=-side*pitch;
    for(const z of [-.285,.285]) {
      const trim=box(slope+.11,.055,.046,honey,side*.17,.8475,z);trim.rotation.z=-side*pitch;
    }
    for(let row=0;row<3;row++) for(let column=0;column<4;column++) {
      const t=(row+.5)/3;
      const tile=box(slope/3+.061,.043,.149,(row+column)%3?roof:roofLight,side*(.016+.36*t),1.028-.329*t,.235-column*.157);
      tile.rotation.z=-side*pitch;
    }
  }
  for(let i=0;i<4;i++)box(.096,.063,.155,i%2?roof:roofLight,0,1.038,.235-i*.157);
  const cap=new T.Shape();cap.moveTo(-.042,.91);cap.lineTo(.042,.91);cap.lineTo(.055,1.008);cap.lineTo(0,1.052);cap.lineTo(-.055,1.008);cap.closePath();
  const capGeometry=new T.ExtrudeGeometry(cap,{depth:.021,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:2,steps:1});
  add(capGeometry,honey,0,0,.294);add(capGeometry,honey,0,0,-.285,[0,Math.PI,0]);

  box(.11,.37,.074,wood,0,.43,-.279);
  const screw=new T.CylinderGeometry(.012,.012,.003,12),nail=new T.SphereGeometry(1,10,6);
  for(const y of [.32,.54])add(screw,iron,0,y,-.3165,[Math.PI/2,0,0]);
  for(const x of [-.277,.277])add(nail,iron,x,.055,.272).scale.set(.009,.009,.004);

  root.updateMatrixWorld(true);
  const batches=new Map<T.Material,T.BufferGeometry[]>(),originals=new Set<T.BufferGeometry>();
  root.traverse(node=>{
    if(!(node instanceof T.Mesh))return;
    const geometry=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();geometry.applyMatrix4(node.matrixWorld);originals.add(node.geometry);
    const surface=node.material as T.Material;if(!batches.has(surface))batches.set(surface,[]);batches.get(surface)!.push(geometry);
  });
  root.clear();
  for(const [surface,geometries]of batches){
    const merged=mergeGeometries(geometries)!;
    const mesh=new T.Mesh(mergeVertices(merged),surface);merged.dispose();mesh.name=surface.name;
    mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);geometries.forEach(g=>g.dispose());
  }
  originals.forEach(g=>g.dispose());template=root;
  return root.clone(true);
}
