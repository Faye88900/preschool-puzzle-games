import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rounded } from './puzzle-art';

let template: T.Group | undefined;

export function createGardenToolRack(): T.Group {
  if(template)return template.clone(true);
  const root=new T.Group();root.name='garden-tool-rack';
  const pixels=new Uint8Array(128*128*4);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const shade=Math.sin(y*.43+Math.sin(x*.035)*2)*4+Math.sin(y*.14+x*.012)*3,i=(y*128+x)*4;
    pixels.set([244+shade,222+shade,190+shade,255],i);
  }
  const grain=new T.DataTexture(pixels,128,128);grain.colorSpace=T.SRGBColorSpace;grain.magFilter=T.LinearFilter;grain.needsUpdate=true;
  const material=(name:string,color:string,map?:T.Texture)=>{
    const surface=new T.MeshStandardMaterial({color,roughness:.84,map});surface.name=name;return surface;
  };
  const timber=material('rack-timber','#b67d45',grain),planks=material('rack-planks','#d4a164',grain),endgrain=material('rack-endgrain','#90613b',grain);
  const iron=material('rack-brackets','#625e50');iron.metalness=.4;iron.roughness=.58;
  const linen=material('rack-gloves','#e5d6af'),teal=material('rack-cuffs','#638f79'),clay=material('rack-terracotta','#c87549');
  const twine=material('rack-twine','#c8b18a'),paper=material('rack-packets','#fff0c9'),green=material('rack-leaf-print','#7f9c4f');
  const add=(geometry:T.BufferGeometry,surface:T.Material,x:number,y:number,z:number,rotation=[0,0,0],parent:T.Object3D=root)=>{
    const mesh=new T.Mesh(geometry,surface);mesh.position.set(x,y,z);mesh.rotation.set(rotation[0],rotation[1],rotation[2]);parent.add(mesh);return mesh;
  };
  const box=(w:number,h:number,d:number,surface:T.Material,x:number,y:number,z:number)=>
    add(rounded(w,h,d,Math.min(.025,w/3,h/3,d/3)),surface,x,y,z);
  for(const x of [-.83,.83]){
    box(.15,1.70,.15,timber,x,.915,0);
    box(.28,.065,.64,endgrain,x,.0325,0);
    box(.19,.065,.19,planks,x,1.79,0);
    const brace=box(.09,.43,.075,timber,x,.255,-.15);brace.rotation.x=-.58;
  }
  box(1.98,.12,.23,planks,0,1.65,0);
  box(1.68,.10,.10,timber,0,.72,0);
  box(1.67,.07,.09,timber,0,.28,-.19);
  for(let i=0;i<7;i++)box(.211,.81,.042,i%2?planks:timber,-.666+i*.222,1.165,-.065);
  const diagonal=box(1.65,.065,.045,endgrain,0,1.16,-.115);diagonal.rotation.z=.46;
  for(const z of [-.15,.005,.16])box(1.53,.045,.148,planks,0,.335,z);
  box(1.64,.105,.065,timber,0,.33,.255);
  for(const x of [-.77,.77])box(.065,.10,.46,timber,x,.33,.015);

  const rivet=new T.SphereGeometry(1,10,6);
  for(const side of [-1,1]){
    box(.14,.024,.012,iron,side*.71,1.568,.05);
    box(.024,.14,.012,iron,side*.768,1.51,.05);
    for(const[x,y]of [[side*.68,1.568],[side*.768,1.47]])add(rivet,iron,x,y,.061).scale.set(.009,.009,.005);
    for(const y of [.33,1.65])add(rivet,endgrain,side*.83,y,.125).scale.set(.016,.016,.009);
  }
  const hookCurve=new T.CatmullRomCurve3([new T.Vector3(0,0,-.020),new T.Vector3(0,0,.17),new T.Vector3(0,.005,.235),new T.Vector3(0,.035,.266),new T.Vector3(0,.075,.266)]);
  const hook=new T.TubeGeometry(hookCurve,16,.012,7,false);
  for(const x of [-.52,0,.52]){
    box(.073,.105,.018,iron,x,1.46,-.025);
    add(rivet,planks,x,1.492,-.012).scale.set(.009,.009,.005);
    add(hook,iron,x,1.425,0);
    add(rivet,iron,x,1.50,.266).scale.setScalar(.012);
  }

  const hand=new T.Shape();hand.moveTo(-.064,.12);hand.lineTo(.064,.12);hand.lineTo(.067,-.016);
  hand.quadraticCurveTo(.15,-.055,.13,-.10);hand.quadraticCurveTo(.11,-.125,.075,-.072);
  hand.lineTo(.068,-.228);hand.quadraticCurveTo(.062,-.254,.044,-.232);hand.lineTo(.037,-.115);
  hand.lineTo(.029,-.266);hand.quadraticCurveTo(.017,-.287,.004,-.264);hand.lineTo(-.002,-.122);
  hand.lineTo(-.013,-.255);hand.quadraticCurveTo(-.027,-.277,-.039,-.25);hand.lineTo(-.041,-.115);
  hand.lineTo(-.052,-.211);hand.quadraticCurveTo(-.07,-.23,-.078,-.203);hand.lineTo(-.074,-.06);hand.closePath();
  const glove=new T.ExtrudeGeometry(hand,{depth:.026,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:2,curveSegments:6,steps:1});
  for(const[x,z,angle]of [[-.60,.17,-.10],[-.45,.205,.12]]){
    const pair=new T.Group();pair.position.set(x,1.15,z);pair.rotation.z=angle;root.add(pair);
    add(glove,linen,0,0,0,[0,0,0],pair);
    add(rounded(.146,.075,.041,.009),teal,0,.15,.013,[0,0,0],pair);
    for(const y of [-.052,-.092])add(rounded(.075,.005,.004,.001),twine,0,y,.034,[0,0,0],pair);
  }
  const gloveLoop=new T.CatmullRomCurve3([new T.Vector3(-.60,1.334,.19),new T.Vector3(-.55,1.425,.238),new T.Vector3(-.51,1.446,.24),new T.Vector3(-.45,1.334,.23)]);
  add(new T.TubeGeometry(gloveLoop,18,.007,6,false),twine,0,0,0);
  for(const r of [.064,.093,.122])add(new T.TorusGeometry(r,.014,6,28),twine,.52,1.16,.19);
  const cord=new T.CatmullRomCurve3([new T.Vector3(.52,1.29,.19),new T.Vector3(.50,1.42,.23),new T.Vector3(.52,1.443,.25),new T.Vector3(.55,1.34,.22)]);
  add(new T.TubeGeometry(cord,16,.008,6,false),twine,0,0,0);
  add(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(.52,1.10,.20),new T.Vector3(.55,.97,.20),new T.Vector3(.60,.94,.18)]),12,.009,6,false),twine,0,0,0);

  const pot=new T.LatheGeometry([[0,0],[.083,0],[.091,.018],[.124,.182],[.137,.19],[.137,.213],[.117,.222],[.107,.19],[.078,.032],[0,.032]].map(([r,y])=>new T.Vector2(r,y)),24);
  add(pot,clay,-.47,.357,.03);add(pot,clay,-.47,.414,.03).scale.setScalar(.86);
  add(pot,clay,-.13,.357,-.02).scale.setScalar(.78);
  const leaf=new T.SphereGeometry(1,10,6);
  for(const[x,z,angle]of [[.34,-.07,-.12],[.51,-.11,.10]]){
    const packet=new T.Group();packet.position.set(x,.505,z);packet.rotation.set(-.16,0,angle);root.add(packet);
    add(rounded(.19,.29,.024,.008),paper,0,0,0,[0,0,0],packet);
    add(leaf,green,-.025,.015,.016,[0,0,-.45],packet).scale.set(.026,.055,.006);
    add(leaf,green,.025,.015,.016,[0,0,.45],packet).scale.set(.026,.055,.006);
    add(rounded(.12,.009,.004,.001),teal,0,-.097,.016,[0,0,0],packet);
  }

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
    mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);geometries.forEach(g=>g.dispose());
  }
  originals.forEach(g=>g.dispose());template=root;
  return root.clone(true);
}
