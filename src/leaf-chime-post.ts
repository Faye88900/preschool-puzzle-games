import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rounded } from './puzzle-art';

let template:T.Group|undefined;

export function createLeafChimePost():T.Group {
  if(template)return template.clone(true);
  const root=new T.Group();root.name='leaf-chime-post';
  const frame=new T.Group();frame.name='chime-frame';root.add(frame);
  const material=(name:string,color:string,roughness=.93,metalness=0)=>{
    const m=new T.MeshStandardMaterial({color,roughness,metalness,vertexColors:true});m.name=`leaf-chime-${name}`;return m;
  };
  const stone=material('limestone','#ded1b5'),bronze=material('aged-bronze','#ffffff',.66,.43);
  const gold=material('exposed-bronze','#b68c49',.61,.40),patina=material('patina','#80b5a1',.80,.20);
  const red=material('wine-red-cloth','#a64037',.98),dark=material('cord-and-seams','#654836');
  const green=material('moss-and-ivy','#718940');
  const noise=(n:number)=>Math.sin(n*17.31+4.7)*Math.cos(n*31.27+8.2);
  const textureSize=128,pixels=new Uint8Array(textureSize*textureSize*4);
  for(let y=0;y<textureSize;y++)for(let x=0;x<textureSize;x++) {
    const field=Math.sin(x*.17+Math.sin(y*.13)*1.8)*Math.cos(y*.15+Math.sin(x*.11))+.34*Math.sin(x*.51-y*.37);
    const oxidized=T.MathUtils.smoothstep(field,-.08,.32),grain=noise(x+y*textureSize)*9;
    pixels.set([T.MathUtils.lerp(173,73,oxidized)+grain,T.MathUtils.lerp(125,139,oxidized)+grain,T.MathUtils.lerp(62,118,oxidized)+grain,255],(y*textureSize+x)*4);
  }
  const weather=new T.DataTexture(pixels,textureSize,textureSize);weather.name='leaf-chime-copper-patina';weather.colorSpace=T.SRGBColorSpace;
  weather.wrapS=weather.wrapT=T.RepeatWrapping;weather.magFilter=T.LinearFilter;weather.minFilter=T.LinearMipmapLinearFilter;weather.generateMipmaps=true;weather.needsUpdate=true;
  bronze.map=patina.map=weather;
  const add=(parent:T.Group,geometry:T.BufferGeometry,surface:T.Material,x=0,y=0,z=0)=>{
    const mesh=new T.Mesh(geometry,surface);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  };
  const block=(x:number,y:number,z:number,w:number,h:number,d:number)=>add(frame,rounded(w,h,d,.045),stone,x,y,z);
  const tube=(parent:T.Group,points:number[][],radius:number,surface:T.Material,segments=20)=>
    add(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(([x,y,z])=>new T.Vector3(x,y,z))),segments,radius,radius<.025?4:8,false),surface);
  const plate=(parent:T.Group,shape:T.Shape,depth:number,bevel:number,surface:T.Material,z=0)=>
    add(parent,new T.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,curveSegments:8,steps:1}).translate(0,0,-depth/2),surface,0,0,z);
  const outline=(points:number[][])=>new T.Shape(points.map(([x,y])=>new T.Vector2(x,y)));
  const sprig=(x:number,y:number,z:number,length:number)=>{
    const patch=add(frame,new T.SphereGeometry(1,8,5),green,x,y,z);patch.scale.set(.19,.035,.15);
    tube(frame,[[x,y,z],[x-.06,y-length*.5,z+.03],[x+.01,y-length,z+.02]],.010,green,10);
    for(let i=0;i<5;i++) {
      const shape=outline([[0,0],[-.055,.035],[-.065,.075],[0,.12],[.065,.075],[.055,.035]]);
      const leaf=plate(frame,shape,.012,0,green,z+.04);leaf.position.set(x+Math.sin(i*2)*.045,y-i*length/5,z+.04);leaf.rotation.z=(i%2?1:-1)*.75;
    }
  };

  block(0,.12,0,1.10,.24,1.10);
  block(0,.58,0,.90,.72,.90);block(.015,1.22,-.005,.89,.59,.89);
  block(0,1.56,0,.98,.14,.98);
  for(const [points,radius]of [
    [[[-.36,.94,.458],[-.18,.85,.458],[-.20,.71,.458],[-.11,.63,.458]],.009],
    [[[.44,1.40,.08],[.45,1.25,.14],[.45,1.18,.08],[.45,1.04,.13]],.008],
    [[[-.42,.21,.552],[-.35,.10,.552],[-.39,.02,.552]],.009],
  ] as [number[][],number][])tube(frame,points,radius,dark,10);
  for(const sign of [-1,1]) {
    const emblem=new T.Group();frame.add(emblem);emblem.position.set(0,.99,sign*.457);if(sign<0)emblem.rotation.y=Math.PI;
    for(const [x,h,angle]of [[0,.36,0],[-.04,.26,.55],[.04,.26,-.55]]) {
      const leaf=plate(emblem,outline([[0,0],[-.09,h*.4],[-.075,h*.7],[0,h],[.075,h*.7],[.09,h*.4]]),.018,.008,green);
      leaf.position.set(x,-.17,0);leaf.rotation.z=angle;
    }
  }
  sprig(-.34,1.62,.32,1.19);sprig(.30,.26,-.31,.16);sprig(.21,1.64,-.26,.40);

  add(frame,new T.CylinderGeometry(.205,.22,.28,16),bronze,0,1.77,0);
  for(const y of [1.65,1.88])add(frame,new T.CylinderGeometry(.233,.233,.055,18),gold,0,y,0);
  for(let i=0;i<4;i++) {
    const angle=i*Math.PI/2,bolt=add(frame,new T.CylinderGeometry(.037,.037,.028,6).rotateX(Math.PI/2),gold,Math.sin(angle)*.215,1.77,Math.cos(angle)*.215);bolt.rotation.y=angle;
  }
  tube(frame,[[0,1.84,0],[-.08,2.13,0],[-.20,2.40,.01],[-.06,2.72,.02],[-.16,3.08,0],[-.08,3.43,0],[.05,3.76,0],[.01,4.05,0]],.115,bronze,72);
  tube(frame,[[-.47,3.82,0],[-.56,3.75,0],[-.52,3.66,0],[-.37,3.67,0],[-.07,3.86,0],[.32,3.91,0],[.74,3.89,0],[1.12,3.84,0],[1.44,3.76,0]],.103,bronze,64);
  for(const [x,y]of [[-.47,3.82],[1.44,3.76]])add(frame,new T.SphereGeometry(.103,10,6),bronze,x,y,0);
  const bud=add(frame,new T.SphereGeometry(1,14,9),bronze,.015,4.08,0);bud.scale.set(.16,.20,.15);bud.rotation.z=-.20;
  tube(frame,[[-.055,4.00,.13],[.01,4.09,.15],[.065,4.20,.075]],.009,gold,12);

  const leafShape=(w:number,h:number,inset=false)=>{
    const top=inset?-.025:0,length=inset?h-.05:h,width=inset?w*.83:w;
    const s=new T.Shape();s.moveTo(0,top);
    s.bezierCurveTo(-width*.32,top-.02,-width*.51,top-length*.25,-width*.48,top-length*.45);
    s.bezierCurveTo(-width*.45,top-length*.69,-width*.20,top-length*.90,0,top-length);
    s.bezierCurveTo(width*.20,top-length*.90,width*.45,top-length*.69,width*.48,top-length*.45);
    s.bezierCurveTo(width*.51,top-length*.25,width*.32,top-.02,0,top);
    const hole=new T.Path();hole.absarc(0,-.11,inset?.055:.045,0,Math.PI*2,true);s.holes.push(hole);return s;
  };
  for(const [i,x,armY,pivotY,w,h]of [[0,.35,3.91,3.58,.31,.75],[1,.82,3.88,3.44,.38,.93],[2,1.29,3.80,3.17,.45,1.09]]) {
    const eyelet=add(frame,new T.TorusGeometry(.048,.014,6,14),gold,x,armY-.105,0);eyelet.name=`chime-eyelet-${i}`;
    tube(frame,[[x,armY-.15,.012],[x,armY-.23,.013],[x,pivotY+.017,0]],.017,dark,12);
    for(let j=0;j<3;j++)add(frame,new T.TorusGeometry(.025,.008,5,10).rotateX(Math.PI/2),dark,x,armY-.19-j*.022,0);
    const pivot=new T.Group();pivot.name=`leaf-chime-${i}`;pivot.position.set(x,pivotY,0);root.add(pivot);
    const ring=add(pivot,new T.TorusGeometry(.072,.014,7,18).rotateY(Math.PI/2),gold,0,-.055,0);ring.name='chime-ring';
    const leaf=new T.Group();leaf.name='chime-leaf';pivot.add(leaf);
    plate(leaf,leafShape(w,h),.07,.010,gold);
    for(const side of [-1,1]) {
      plate(leaf,leafShape(w,h,true),.010,.004,patina,side*.050);
      tube(leaf,[[0,-.18,side*.064],[.008,-h*.50,side*.071],[0,-h*.91,side*.062]],.009,gold,14);
      for(const direction of [-1,1])for(const at of [.32,.47,.62,.75])
        tube(leaf,[[0,-h*at,side*.068],[direction*w*.25,-h*(at+.07),side*.063],[direction*w*(at>.6?.28:.36),-h*(at+.10),side*.058]],.006,gold,6);
    }
  }

  const streamer=new T.Group();streamer.name='chime-streamer';streamer.position.set(1.40,3.79,0);root.add(streamer);
  for(let i=0;i<2;i++)add(streamer,new T.TorusGeometry(.125-i*.007,.035,7,18).rotateY(Math.PI/2),red,i*.07,0,0);
  const cloth=outline([[.06,.065],[.32,.01],[.61,-.10],[.95,-.24],[.87,-.29],[1.00,-.35],[.90,-.39],[1.04,-.51],[.88,-.47],[.78,-.52],[.88,-.61],[.65,-.54],[.54,-.40],[.34,-.33],[.19,-.19],[.04,-.05]]);
  const banner=plate(streamer,cloth,.024,.004,red);
  const clothPositions=banner.geometry.attributes.position;
  for(let i=0;i<clothPositions.count;i++) {
    const x=clothPositions.getX(i),y=clothPositions.getY(i);clothPositions.setZ(i,clothPositions.getZ(i)+Math.sin(x*10+y*4)*.075*x);
  }
  banner.geometry.computeVertexNormals();
  tube(streamer,[[.10,-.015,.02],[.27,-.10,.025],[.43,-.17,-.025],[.63,-.26,.02],[.83,-.36,.03]],.006,dark,22);

  const batch=(group:T.Group)=>{
    group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),batches=new Map<T.Material,T.BufferGeometry[]>();
    for(const node of [...group.children]) {
      if(!(node instanceof T.Mesh))continue;
      const geometry=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,node.matrixWorld));
      const p=geometry.attributes.position,colors:number[]=[];
      for(let i=0;i<p.count;i++){const shade=.94+noise(Math.round(p.getX(i)*30)+Math.round(p.getY(i)*22)*1.3+Math.round(p.getZ(i)*29)*2.1)*.05;colors.push(shade,shade,shade);}
      geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
      const m=node.material as T.Material;if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push(geometry);group.remove(node);
    }
    for(const [m,parts]of batches){const mesh=add(group,mergeGeometries(parts)!,m);mesh.name=m.name;mesh.castShadow=m!==green;mesh.receiveShadow=true;parts.forEach(p=>p.dispose());}
  };
  // Batch the stone emblem with the fixed frame, retaining three independent leaf pivots.
  frame.updateMatrixWorld(true);
  for(const group of [...frame.children])if(group instanceof T.Group) {
    group.updateMatrixWorld(true);for(const child of [...group.children])if(child instanceof T.Mesh){child.applyMatrix4(group.matrix);frame.add(child);}frame.remove(group);
  }
  for(let i=0;i<3;i++)batch(root.getObjectByName(`leaf-chime-${i}`)!.getObjectByName('chime-leaf') as T.Group);
  batch(frame);batch(streamer);
  const bottom=new T.Box3().setFromObject(root).min.y;
  root.children.forEach(child=>child.position.y-=bottom);
  root.traverse(node=>{if(node instanceof T.Mesh){node.castShadow=node.material!==green;node.receiveShadow=true;}});
  template=root;return root.clone(true);
}
