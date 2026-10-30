import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let template:T.Group|undefined;

export function createLeafWeaponRack():T.Group {
  if(template)return template.clone(true);
  const root=new T.Group();root.name='leaf-weapon-rack';
  const group=(name:string)=>{const g=new T.Group();g.name=name;root.add(g);return g;};
  const frame=group('weapon-rack-frame'),shield=group('leaf-round-shield');shield.position.set(.76,1.18,.34);
  const material=(name:string,color:string,roughness=.91,metalness=0)=>{
    const m=new T.MeshStandardMaterial({color,roughness,metalness,vertexColors:true});m.name=`weapon-rack-${name}`;return m;
  };
  const wood=material('old-wood','#ffffff'),endGrain=material('worn-wood-ends','#ba874e');
  const bronze=material('aged-bronze','#b18b48',.62,.50),steel=material('steel','#86968e',.48,.64);
  const jade=material('jade-leaves-and-cloth','#337b62'),rope=material('rope','#c4b183'),dark=material('leather-and-seams','#5b3d29'),moss=material('moss','#708b3a');
  const pixels=new Uint8Array(128*256*4);
  for(let y=0;y<256;y++)for(let x=0;x<128;x++){
    const bend=Math.sin(y/256*Math.PI*2)*1.5+Math.sin(y/256*Math.PI*6)*.35;
    const grain=Math.sin((x+bend)*1.35)+.42*Math.sin((x-bend)*3.8),shade=grain*8+Math.sin(x*11.7+y*3.9)*2;
    pixels.set([146+shade,94+shade*.80,49+shade*.45,255],(y*128+x)*4);
  }
  const texture=new T.DataTexture(pixels,128,256);texture.name='old-rack-wood-grain';texture.colorSpace=T.SRGBColorSpace;
  texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;wood.map=texture;
  const add=(parent:T.Group,geometry:T.BufferGeometry,surface:T.Material,x=0,y=0,z=0)=>{const m=new T.Mesh(geometry,surface);m.position.set(x,y,z);parent.add(m);return m;};
  const outline=(points:number[][])=>new T.Shape(points.map(([x,y])=>new T.Vector2(x,y)));
  const plate=(parent:T.Group,shape:T.Shape,depth:number,bevel:number,surface:T.Material,x=0,y=0,z=0)=>
    add(parent,new T.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,curveSegments:8,steps:1}).translate(0,0,-depth/2),surface,x,y,z);
  const block=(parent:T.Group,w:number,h:number,d:number,x:number,y:number,z:number,surface:T.Material=wood)=>
    plate(parent,outline([[-w/2+.018,-h/2+.018],[w/2-.018,-h/2+.018],[w/2-.018,h/2-.018],[-w/2+.018,h/2-.018]]),d-.036,.018,surface,x,y,z);
  const tube=(parent:T.Group,points:number[][],radius:number,surface:T.Material,segments=12)=>
    add(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p as [number,number,number]))),segments,radius,4,false),surface);
  const beam=(a:T.Vector3,b:T.Vector3,w:number,d:number)=>{const m=block(frame,w,a.distanceTo(b),d,0,0,0);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());};
  const bolt=(parent:T.Group,x:number,y:number,z:number,r=.035)=>add(parent,new T.SphereGeometry(r,8,5),bronze,x,y,z).scale.set(1,1,.45);

  for(const x of [-1.08,1.08]) {
    block(frame,.43,.26,1.04,x,.13,0);block(frame,.28,2.23,.31,x,1.34,0);
    block(frame,.29,.045,.32,x,2.475,0,endGrain);
    for(const y of [.43,1.95]){
      block(frame,.36,.24,.035,x,y,.177,bronze);bolt(frame,x,y,.21,.046);
      for(let i=0;i<3;i++)tube(frame,[[x-.18,y-.09+i*.04,.19],[x+.18,y-.09+i*.04,.19],[x+.18,y-.06+i*.04,-.19],[x-.18,y-.06+i*.04,-.19],[x-.18,y-.05+i*.04,.19]],.018,rope,16);
      tube(frame,[[x-.11,y-.12,.225],[x+.10,y+.10,.225]],.023,rope,2);
    }
    block(frame,.045,.16,.52,x+.225,.16,.04,bronze);bolt(frame,x+.252,.16,.23,.030);
    for(let i=0;i<3;i++){
      tube(frame,[[x-.07+i*.06,2.50,.10],[x-.05+i*.06,2.43,.16],[x-.08+i*.06,2.36,.17]],.006,dark,4);
      const patch=add(frame,new T.IcosahedronGeometry(.13,0),moss,x+(i-1)*.14,.045,(i%2?.36:-.31));patch.scale.set(1,.25,.8);
    }
  }
  const notched=[[-1.39,-.13],[1.39,-.13],[1.39,.13]];
  for(const x of [.62,0,-.62])notched.push([x+.11,.13],[x+.09,.025],[x-.09,.025],[x-.11,.13]);
  notched.push([-1.39,.13]);plate(frame,outline(notched),.29,.015,wood,0,1.95,0);
  block(frame,2.43,.20,.30,0,.36,0);block(frame,2.16,.07,.54,0,.255,0,endGrain);
  beam(new T.Vector3(-1.02,.46,-.20),new T.Vector3(.99,1.84,-.20),.14,.14);
  beam(new T.Vector3(1.02,.46,-.27),new T.Vector3(-.99,1.84,-.27),.14,.14);
  for(const x of [-.95,.95])for(const y of [.51,1.83])bolt(frame,x,y,-.36);
  for(const x of [-.62,0,.62]){
    add(frame,new T.TorusGeometry(.067,.014,4,12).rotateX(Math.PI/2),bronze,x,.30,.205);
    tube(frame,[[x-.08,1.95,.16],[x-.075,1.95,.255],[x+.075,1.95,.255],[x+.08,1.95,.16]],.016,bronze,8);
  }
  for(const x of [-.84,-.34,.18,.89])tube(frame,[[x,1.88,.167],[x+.07,1.91,.168],[x+.13,1.89,.168]],.005,dark,5);

  for(const [i,tip]of [4.25,3.90,3.55].entries()){
    const spear=group(`leaf-spear-${i}`);spear.position.set(-.62+i*.62,0,.205);const neck=tip-.74;
    add(spear,new T.CylinderGeometry(.041,.047,neck-.30,8),wood,0,(neck+.30)/2,0);
    for(const y of [.38,1.18,neck-.06])add(spear,new T.CylinderGeometry(.055,.055,.10,10),bronze,0,y,0);
    add(spear,new T.CylinderGeometry(.067,.062,.17,10),bronze,0,neck,0);
    const edge=[[0,0],[-.10,.12],[-.17,.34],[-.10,.55],[0,.74],[.10,.55],[.17,.34],[.10,.12]].reverse();
    const vertices:number[]=[],indices:number[]=[];
    for(const side of [1,-1]){
      const start=vertices.length/3;vertices.push(0,.32,side*.060);edge.forEach(([x,y])=>vertices.push(x,y,0));
      for(let j=0;j<edge.length;j++) {const a=start+1+j,b=start+1+(j+1)%edge.length;indices.push(start,...(side>0?[a,b]:[b,a]));}
    }
    const head=new T.BufferGeometry();head.setAttribute('position',new T.Float32BufferAttribute(vertices,3));head.setIndex(indices);head.computeVertexNormals();add(spear,head,steel,0,neck,0).name='leaf-spearhead';
    for(const side of [-1,1]){
      tube(spear,[[0,neck+.04,side*.01],[0,neck+.32,side*.066],[0,tip-.025,side*.006]],.009,bronze,8);
      for(const sign of [-1,1])for(const at of [.22,.37])tube(spear,[[0,neck+at,.065*side],[sign*.10,neck+at+.095,.027*side]],.006,bronze,3);
    }
    for(let j=0;j<4;j++)add(spear,new T.TorusGeometry(.047,.013,4,10).rotateX(Math.PI/2),jade,0,neck-.15-j*.035,0);
    const strip=plate(spear,outline([[-.04,0],[.04,.015],[.085,-.28],[.025,-.25],[-.02,-.31],[-.025,-.16]]),.014,.002,jade,.015,neck-.20,.043);strip.rotation.z=.2+i*.16;
  }

  const radius=.64,segments=32,rings=4,vertices:number[]=[],uv:number[]=[],indices:number[]=[];
  for(const side of [1,-1]){
    const start=vertices.length/3;
    for(let ring=0;ring<=rings;ring++)for(let j=0;j<=segments;j++){
      const r=ring/rings,angle=j/segments*Math.PI*2,x=Math.cos(angle)*r*radius,y=Math.sin(angle)*r*radius;
      vertices.push(x,y,(side>0?.08:-.055)+.10*(1-r*r));uv.push(x*.65+.5,y*.65+.5);
    }
    for(let ring=0;ring<rings;ring++)for(let j=0;j<segments;j++){
      const a=start+ring*(segments+1)+j,b=a+segments+1;
      indices.push(...(side>0?[a,b,b+1,a,b+1,a+1]:[a,b+1,b,a,a+1,b+1]));
    }
  }
  const shieldGeometry=new T.BufferGeometry();shieldGeometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));shieldGeometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));shieldGeometry.setIndex(indices);shieldGeometry.computeVertexNormals();add(shield,shieldGeometry,wood).name='convex-wooden-shield';
  const rim=new T.Shape();rim.absarc(0,0,.68,0,Math.PI*2,false);const hole=new T.Path();hole.absarc(0,0,.61,0,Math.PI*2,true);rim.holes.push(hole);plate(shield,rim,.16,.012,bronze,0,0,.025);
  for(let j=0;j<12;j++){const a=j/12*Math.PI*2;bolt(shield,Math.cos(a)*.646,Math.sin(a)*.646,.123,.026);}
  for(const x of [-.42,-.21,0,.21,.42]){
    const height=Math.sqrt(.59*.59-x*x),front:number[][]=[],back:number[][]=[];
    for(let j=0;j<=10;j++){const y=-height+j/10*height*2,bend=.10*(1-(x*x+y*y)/radius**2);front.push([x,y,.083+bend]);back.push([x,y,-.058+bend]);}
    tube(shield,front,.004,dark,10);tube(shield,back,.004,dark,10);
  }
  for(const [height,angle,x]of [[.72,0,0],[.52,.78,-.035],[.52,-.78,.035]]){
    const leaf=new T.Group();leaf.position.set(x,-.28,.192);leaf.rotation.z=angle;shield.add(leaf);
    const shape=new T.Shape();shape.moveTo(0,0);shape.bezierCurveTo(-.20,height*.24,-.21,height*.60,0,height);shape.bezierCurveTo(.21,height*.60,.20,height*.24,0,0);
    plate(leaf,shape,.025,.006,jade);tube(leaf,[[0,.03,.023],[0,height*.48,.03],[0,height-.05,.022]],.009,bronze,8);
    for(const sign of [-1,1])for(const at of [.25,.44,.62])tube(leaf,[[0,height*at,.028],[sign*.12,height*(at+.13),.025]],.006,bronze,3);
  }
  const boss=add(shield,new T.SphereGeometry(.105,16,8),bronze,0,-.12,.23);boss.scale.z=.55;
  tube(shield,[[-.22,-.04,.033],[-.20,-.04,-.19],[.20,-.04,-.19],[.22,-.04,.033]],.037,dark,12).name='shield-rear-grip';
  const strap=add(shield,new T.BoxGeometry(.42,.12,.035,8,1,1),dark,0,.22,0),strapPositions=strap.geometry.attributes.position;
  for(let i=0;i<strapPositions.count;i++){const u=Math.min(1,Math.abs(strapPositions.getX(i))/.21);strapPositions.setZ(i,strapPositions.getZ(i)+.035-.18*(1-u*u));}strap.geometry.computeVertexNormals();
  block(shield,.055,.15,.055,.18,.22,-.03,bronze);
  for(const x of [-.22,.22]){bolt(shield,x,-.04,.030,.025);bolt(shield,x,.22,.017,.022);}
  const hanger=plate(frame,outline([[.66,1.33],[.68,2.13],[.87,2.13],[.88,1.33]]),.035,.005,dark,0,0,.19);hanger.name='shield-leather-hanger';
  bolt(frame,.77,2.05,.24,.036);

  // Merge each functional part by material while retaining the three spears and shield groups.
  for(const parent of [frame,shield,...root.children.filter(g=>g.name.startsWith('leaf-spear-'))] as T.Group[]){
    parent.updateMatrixWorld(true);const inverse=parent.matrixWorld.clone().invert(),batches=new Map<T.Material,T.BufferGeometry[]>();
    parent.traverse(node=>{if(!(node instanceof T.Mesh))return;const geometry=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,node.matrixWorld));
      const p=geometry.attributes.position,colors:number[]=[];for(let i=0;i<p.count;i++){const shade=.94+.05*Math.sin(p.getX(i)*27+p.getY(i)*19+p.getZ(i)*31);colors.push(shade,shade,shade);}geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
      const m=node.material as T.Material;if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push(geometry);
    });
    parent.clear();for(const [m,parts]of batches){const mesh=add(parent,mergeGeometries(parts)!,m);mesh.name=m.name;mesh.castShadow=m!==moss;mesh.receiveShadow=true;parts.forEach(g=>g.dispose());}
  }
  template=root;return root.clone(true);
}
