import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let template:T.Group|undefined;
export function createCourtyardGardenProps() {
  if(template)return template.clone(true);
  const root=new T.Group();root.name='courtyard-garden-props';
  const group=(name:string)=>{const g=new T.Group();g.name=name;root.add(g);return g;};
  const planted=group('courtyard-planted-pot'),empty=group('courtyard-empty-pot'),can=group('courtyard-watering-can');
  const seedling=new T.Group();seedling.name='courtyard-seedling';planted.add(seedling);
  const material=(name:string,color:string,roughness=.85,metalness=0)=>{const m=new T.MeshStandardMaterial({color,roughness,metalness,vertexColors:true});m.name=name;return m;};
  const clay=material('garden-terracotta','#b96539'),sage=material('garden-sage-band','#76866a');
  const copper=material('garden-rubbed-copper','#c39758',.55,.55),patina=material('garden-copper-patina','#428780',.72,.3);
  const soil=material('garden-soil','#493629'),green=material('garden-fresh-leaf','#77a83b'),vein=material('garden-leaf-vein','#b5c66a');
  const noise=(x:number,y:number)=>Math.sin(x*31.7+y*19.3)*Math.cos(x*13.1-y*41.9);
  const texture=(name:string,color:T.Color,metal:boolean)=>{
    const data=new Uint8Array(128*128*4);
    for(let y=0;y<128;y++)for(let x=0;x<128;x++){
      const n=noise(x,y),patch=Math.sin(x*.19+Math.cos(y*.11)*2)*Math.sin(y*.14+x*.08);
      const c=metal&&patch>.82?new T.Color('#9a8b63'):color;
      const srgb=c.clone().convertLinearToSRGB(),shade=1+n*.055+(metal?patch*.09:0);
      data.set([srgb.r*255*shade,srgb.g*255*shade,srgb.b*255*shade,255],(y*128+x)*4);
    }
    const map=new T.DataTexture(data,128,128);map.name=name;map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;
    map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;return map;
  };
  clay.map=texture('terracotta-grain',clay.color,false);clay.color.set('#ffffff');
  patina.map=texture('aged-copper-patches',patina.color,true);patina.color.set('#ffffff');
  const add=(parent:T.Group,geometry:T.BufferGeometry,surface:T.Material,x=0,y=0,z=0)=>{const m=new T.Mesh(geometry,surface);m.position.set(x,y,z);parent.add(m);return m;};
  const lathe=(parent:T.Group,profile:number[][],surface:T.Material,segments=40)=>add(parent,new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),segments),surface);
  const tube=(parent:T.Group,points:number[][],radius:number,surface:T.Material,segments=16,sides=6)=>add(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3().fromArray(p))),segments,radius,sides,false),surface);
  const ring=(parent:T.Group,r:number,y:number,radius:number,surface:T.Material)=>{const m=add(parent,new T.TorusGeometry(r,radius,5,32),surface,0,y,0);m.rotation.x=Math.PI/2;return m;};
  const emblem=(parent:T.Group,radius:number,y:number,scale:number)=>{
    for(const [x,angle,size]of [[0,0,1],[-.09,.72,.76],[.09,-.72,.76]]){
      const leaf=new T.Shape();leaf.moveTo(0,0);leaf.bezierCurveTo(-.10,.11,-.085,.22,0,.29);leaf.bezierCurveTo(.085,.22,.10,.11,0,0);
      const geometry=new T.ExtrudeGeometry(leaf,{depth:.008,bevelEnabled:true,bevelSize:.003,bevelThickness:.003,bevelSegments:1,curveSegments:5,steps:1});
      geometry.scale(scale*size,scale*size,1);geometry.rotateZ(angle);geometry.translate(x*scale,y,0);
      const p=geometry.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,p.getZ(i)+Math.sqrt(Math.max(.001,radius*radius-p.getX(i)**2))+.005);
      geometry.computeVertexNormals();add(parent,geometry,copper);
    }
  };
  const pot=(parent:T.Group)=>{
    // One continuous section includes the inner wall, floor and open drainage hole.
    const m=lathe(parent,[[.055,.015],[.27,.015],[.29,.035],[.30,.09],[.35,.20],[.385,.39],[.37,.56],[.36,.61],[.40,.62],[.415,.65],[.415,.71],[.39,.74],[.35,.74],[.33,.71],[.33,.65],[.32,.60],[.335,.40],[.30,.21],[.25,.085],[.055,.085],[.055,.015]],clay);
    const p=m.geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      const a=Math.atan2(p.getX(i),p.getZ(i)),chip=Math.max(0,1-Math.abs(a-.74)/.14)*.035;
      if(p.getY(i)>.62)p.setY(i,p.getY(i)-chip);
    }
    m.geometry.computeVertexNormals();
    lathe(parent,[[.374,.545],[.368,.595],[.365,.595],[.371,.545],[.374,.545]],sage);
    ring(parent,.374,.55,.005,copper);ring(parent,.368,.59,.005,copper);
    emblem(parent,.382,.18,.75);
    for(const a of [-1.8,.9,2.6]){
      const points=[[a,.60],[a+.06,.52],[a+.04,.45]].map(([angle,y])=>[Math.sin(angle)*.374,y,Math.cos(angle)*.374]);
      tube(parent,points,.0028,soil,4,3);
    }
  };
  pot(planted);pot(empty);planted.position.set(-.57,0,-.10);
  empty.scale.setScalar(.72);empty.rotation.set(1.45,-.5,-.17);empty.position.set(-.08,0,.26);
  empty.updateMatrixWorld(true);empty.position.y-=new T.Box3().setFromObject(empty).min.y;
  const soilMesh=add(planted,new T.CylinderGeometry(.322,.28,.06,32),soil,0,.625,0);soilMesh.name='pot-soil';
  for(let i=0;i<16;i++){
    const a=i*2.4,r=.08+.20*((i*7%17)/17),m=add(planted,new T.IcosahedronGeometry(.035+(i%3)*.008,0),soil,Math.sin(a)*r,.661,Math.cos(a)*r);m.scale.y=.5;
  }
  seedling.position.y=.65;
  tube(seedling,[[0,0,0],[-.02,.12,0],[.015,.29,.01],[.025,.40,.01]],.019,green,16);
  const leaf=(length:number,width:number)=>{
    const p:number[]=[],indices:number[]=[];
    for(let side=0;side<2;side++)for(let i=0;i<=12;i++)for(let j=0;j<=6;j++){
      const u=i/12,v=j/3-1,w=Math.sin(Math.PI*u);
      p.push(u*length,.16*Math.sin(u*Math.PI*.8)+.035*w*(1-v*v)+(side?-.006:.006),v*width*w);
    }
    for(let side=0;side<2;side++)for(let i=0;i<12;i++)for(let j=0;j<6;j++){
      const a=side*91+i*7+j;indices.push(...(side?[a,a+1,a+7,a+1,a+8,a+7]:[a,a+7,a+1,a+1,a+7,a+8]));
    }
    for(let i=0;i<12;i++)for(const j of [0,6]){const a=i*7+j,b=a+7;indices.push(...(j?[a,b,a+91,b,b+91,a+91]:[a,a+91,b,b,a+91,b+91]));}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
  };
  for(const [name,angle,length,width,y]of [['seedling-left-leaf',Math.PI+.18,.36,.13,.23],['seedling-right-leaf',-.22,.43,.15,.27],['seedling-new-leaf',-1.3,.11,.038,.36]] as const){
    const g=new T.Group();g.name=name;g.position.set(.01,y,0);g.rotation.set(0,angle,name==='seedling-new-leaf'?.8:.20);seedling.add(g);
    add(g,leaf(length,width),green);
    tube(g,[[0,.011,0],[length*.45,.173,0],[length*.97,.11,0]],.004,vein,12,4);
    if(length>.2)for(const u of [.28,.48,.67])for(const sign of [-1,1])tube(g,[[length*u,.16*Math.sin(u*Math.PI*.8)+.043,0],[length*(u+.12),.16*Math.sin((u+.12)*Math.PI*.8)+.015,sign*width*Math.sin(Math.PI*(u+.12))*.78]],.0025,vein,4,3);
  }

  can.position.set(.43,0,-.09);can.rotation.y=-.12;
  lathe(can,[[0,.015],[.27,.015],[.30,.045],[.31,.10],[.295,.43],[.255,.60],[.23,.66],[.235,.69],[.21,.69],[.205,.65],[.23,.58],[.27,.42],[.28,.10],[.25,.06],[0,.06]],patina);
  ring(can,.286,.075,.012,copper);ring(can,.283,.46,.009,copper);ring(can,.229,.68,.014,copper);
  emblem(can,.302,.16,.65);
  const handle=new T.Shape();handle.moveTo(-.22,.13);handle.bezierCurveTo(-.64,.12,-.66,.89,-.30,.85);handle.quadraticCurveTo(-.22,.83,-.21,.64);handle.lineTo(-.26,.59);handle.bezierCurveTo(-.27,.80,-.35,.81,-.42,.73);handle.bezierCurveTo(-.60,.54,-.48,.22,-.25,.22);handle.closePath();
  const grip=add(can,new T.ExtrudeGeometry(handle,{depth:.065,bevelEnabled:true,bevelSize:.012,bevelThickness:.01,bevelSegments:2,curveSegments:12,steps:1}).translate(0,0,-.0325),patina);grip.name='can-open-loop-handle';
  tube(can,[[-.25,.17,.045],[-.48,.27,.045],[-.55,.57,.045],[-.43,.80,.045],[-.30,.82,.045],[-.245,.66,.045]],.007,copper,28,4);
  for(const y of [.18,.64]){const rivet=add(can,new T.SphereGeometry(.029,10,6),copper,-.257,y,.045);rivet.scale.z=.35;}
  const spout=new T.Group();spout.name='can-hollow-spout';can.add(spout);spout.position.set(.23,.23,0);
  const direction=new T.Vector3(.57,.60,0).normalize();spout.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction);
  lathe(spout,[[.072,0],[.067,.06],[.040,.68],[.043,.70],[.028,.70],[.025,.68],[.050,.06],[.055,0],[.072,0]],patina,24);
  ring(spout,.066,.055,.008,copper);
  const rose=new T.Group();rose.name='can-perforated-rose';rose.position.y=.69;spout.add(rose);
  lathe(rose,[[.027,0],[.080,.035],[.131,.07],[.133,.09],[.115,.09],[.075,.05],[.027,.018],[.027,0]],patina,32);
  const face=new T.Shape();face.absarc(0,0,.12,0,Math.PI*2,false);
  const holes:number[][]=[[0,0]];
  for(const [r,count]of [[.043,7],[.087,12]])for(let i=0;i<count;i++){const a=i*Math.PI*2/count;holes.push([Math.cos(a)*r,Math.sin(a)*r]);}
  for(const [x,y]of holes){const h=new T.Path();h.absarc(x,y,.009,0,Math.PI*2,true);face.holes.push(h);}
  const plate=add(rose,new T.ExtrudeGeometry(face,{depth:.009,bevelEnabled:false,curveSegments:6,steps:1}),copper,0,.09,0);plate.rotation.x=-Math.PI/2;
  ring(rose,.124,.094,.008,copper);

  // Keep each prop and the three leaves editable; batch surfaces within those named parts.
  const leaves=seedling.children.filter(c=>c instanceof T.Group) as T.Group[];
  for(const parent of [...leaves,seedling,planted,empty,can]){
    parent.updateWorldMatrix(true,true);const inverse=parent.matrixWorld.clone().invert(),batches=new Map<T.Material,T.BufferGeometry[]>(),sources:T.Mesh[]=[];
    parent.traverse(node=>{if(!(node instanceof T.Mesh)||node.userData.batched)return;const geometry=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,node.matrixWorld));
      const p=geometry.attributes.position,colors:number[]=[];for(let i=0;i<p.count;i++){const n=noise(Math.round(p.getX(i)*39),Math.round(p.getY(i)*37)+Math.round(p.getZ(i)*31)),shade=.96+n*.045;colors.push(shade,shade,shade);}geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
      const surface=node.material as T.Material;if(!(surface as T.MeshStandardMaterial).map)geometry.deleteAttribute('uv');
      if(!batches.has(surface))batches.set(surface,[]);batches.get(surface)!.push(geometry);sources.push(node);
    });
    for(const m of sources){m.removeFromParent();m.geometry.dispose();}
    for(const [surface,parts]of batches){const m=add(parent,mergeGeometries(parts)!,surface);m.name=surface.name;m.userData.batched=true;m.castShadow=m.receiveShadow=true;parts.forEach(g=>g.dispose());}
  }
  template=root;return root.clone(true);
}
