import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let template:T.Group|undefined;

export function createAncientWindSword():T.Group {
  if(template)return template.clone(true);
  const root=new T.Group();root.name='ancient-wind-sword';
  const material=(name:string,color:string,roughness:number,metalness=0)=>{
    const surface=new T.MeshStandardMaterial({color,roughness,metalness});surface.name=`ancient-sword-${name}`;return surface;
  };
  const stone=material('stone','#d5c8af',.82,.12),steel=material('steel','#585d59',.59,.28);
  const bronze=material('bronze','#a99570',.48,.43),grip=material('grip','#363f42',.62,.23);
  const seams=material('seams','#48453b',.96),seal=material('seal','#44635a',.65,.18);
  const wind=material('wind','#a6f5d7',.38,.1);wind.emissive.set('#50e4bb');wind.emissiveIntensity=.75;
  const ember=material('ember','#f47526',.6);ember.emissive.set('#f04b0d');ember.emissiveIntensity=.85;

  const size=256,pixels=new Uint8Array(size*size*4);
  const cells=Array.from({length:32},(_,i)=>({x:(i%4+.5+Math.sin(i*8.1)*.23)/4,y:(Math.floor(i/4)+.5+Math.cos(i*5.7)*.23)/8}));
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const u=x/size+.006*Math.sin(y*.13),v=y/size+.007*Math.sin(x*.11);
    let first=Infinity,second=Infinity;
    for(const cell of cells) {
      const dx=Math.abs(u-cell.x),dy=Math.abs(v-cell.y),distance=Math.hypot(Math.min(dx,1-dx),Math.min(dy,1-dy));
      if(distance<first){second=first;first=distance;}else if(distance<second)second=distance;
    }
    const fissure=Math.exp(-(second-first)*650),noise=Math.sin(x*.31+y*.17)*Math.sin(y*.71-x*.13);
    const shade=245+noise*4-fissure*40;
    pixels.set([shade,shade-2,shade-5,255],(y*size+x)*4);
  }
  const weather=new T.DataTexture(pixels,size,size);weather.name='ancient-sword-mineral-wear';weather.colorSpace=T.SRGBColorSpace;
  weather.wrapS=weather.wrapT=T.RepeatWrapping;weather.magFilter=T.LinearFilter;weather.minFilter=T.LinearMipmapLinearFilter;
  weather.generateMipmaps=true;weather.needsUpdate=true;stone.map=steel.map=weather;

  const add=(geometry:T.BufferGeometry,surface:T.Material,x=0,y=0,z=0)=>{
    const mesh=new T.Mesh(geometry,surface);mesh.position.set(x,y,z);root.add(mesh);return mesh;
  };
  const shape=(points:number[][])=>new T.Shape(points.map(([x,y])=>new T.Vector2(x,y)));
  const plate=(points:number[][],depth:number,bevel:number,surface:T.Material,z=0)=>{
    const geometry=new T.ExtrudeGeometry(shape(points),{depth,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,
      bevelSegments:2,steps:1,curveSegments:8}).translate(0,0,-depth/2);
    return add(geometry,surface,0,0,z);
  };
  const tube=(points:number[][],radius:number,surface:T.Material)=>{
    const path=new T.CurvePath<T.Vector3>();
    for(let i=1;i<points.length;i++)path.add(new T.LineCurve3(new T.Vector3(...points[i-1] as [number,number,number]),new T.Vector3(...points[i] as [number,number,number])));
    return add(new T.TubeGeometry(path,(points.length-1)*3,radius,5,false),surface);
  };
  const disk=(radius:number,depth:number,surface:T.Material,y:number,z:number)=>
    add(new T.CylinderGeometry(radius,radius,depth,40).rotateX(Math.PI/2),surface,0,y,z);

  plate([[0,.16],[-1.34,1.75],[-1.49,2.24],[-1.43,4.1],[-1.50,4.35],[-1.44,6.6],[-1.52,6.82],[-1.48,9.85],
    [-1.15,10.2],[1.15,10.2],[1.48,9.85],[1.46,7.5],[1.38,7.35],[1.48,5.65],[1.4,5.5],[1.49,2.24],[1.34,1.75]],.55,.08,stone);
  const panel=[[0,1.15],[-.98,2.25],[-1.02,9.83],[1.02,9.83],[.98,2.25]];
  for(const side of [-1,1]) {
    plate(panel,.10,.055,steel,side*.35);
    // The raised center ridge gives both faces a real forged cross section.
    const ridge=new T.BufferGeometry(),vertices:number[]=[];
    for(const [a,b,c]of [
      [[-.98,2.25,.455],[0,1.15,.455],[0,9.83,.57]],
      [[-.98,2.25,.455],[0,9.83,.57],[-1.02,9.83,.455]],
      [[0,1.15,.455],[.98,2.25,.455],[0,9.83,.57]],
      [[.98,2.25,.455],[1.02,9.83,.455],[0,9.83,.57]],
    ]) {
      const points=side===1?[a,b,c]:[a,c,b];for(const [x,y,z]of points)vertices.push(x,y,z*side);
    }
    ridge.setAttribute('position',new T.Float32BufferAttribute(vertices,3));ridge.setAttribute('uv',new T.Float32BufferAttribute(new Array(vertices.length/3*2).fill(0),2));ridge.computeVertexNormals();add(ridge,steel);
  }

  const guard=[[0,11.43],[-.58,10.99],[-1.57,11.03],[-2.08,11.28],[-2.47,10.96],[-3.05,10.7],[-2.78,10.15],
    [-1.85,9.98],[-1.28,10.15],[-.55,10.06],[0,9.22],[.55,10.06],[1.28,10.15],[1.85,9.98],[2.78,10.15],
    [3.05,10.7],[2.47,10.96],[2.08,11.28],[1.57,11.03],[.58,10.99]];
  plate(guard,.68,.10,bronze);
  for(const side of [-1,1]) {
    for(const direction of [-1,1]) {
      const quillon=[[.8,10.63],[1.58,10.83],[2.08,11.02],[2.39,10.76],[2.76,10.57],[2.56,10.35],[1.83,10.21],[1.24,10.36]];
      plate(quillon.map(([x,y])=>[x*direction,y]),.08,.035,steel,side*.44);
      tube([[direction*.95,10.47,side*.52],[direction*1.64,10.59,side*.52],[direction*2.12,10.55,side*.52],[direction*2.64,10.59,side*.52]],.018,bronze);
    }
    disk(.99,.23,bronze,10.43,side*.55);
    disk(.84,.08,grip,10.43,side*.71);
    disk(.73,.06,seal,10.43,side*.77);
    add(new T.TorusGeometry(.77,.041,7,48),wind,0,10.43,side*.82);
    add(new T.TorusGeometry(.94,.055,6,48),stone,0,10.43,side*.71);
    const leaf=new T.Shape();leaf.moveTo(-.09,9.32);leaf.bezierCurveTo(-.50,10.10,-.30,10.73,.25,11.17);
    leaf.bezierCurveTo(.56,10.44,.28,9.83,-.09,9.32);
    const leafGeo=new T.ExtrudeGeometry(leaf,{depth:.06,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:2,curveSegments:8}).translate(0,0,-.03);
    add(leafGeo,bronze,0,0,side*.89);
    tube([[-.08,9.33,side*.965],[.02,9.94,side*.965],[.12,10.57,side*.965],[.25,11.16,side*.965]],.026,wind);
    const channel=[[.48,1.83,side*.52],[.63,3.5,side*.57],[.63,8.7,side*.59],[.51,9.5,side*.61]];
    tube(channel,.089,grip);tube(channel.map(([x,y,z])=>[x,y,z+side*.068]),.036,wind);
  }

  const crack=[[-.31,8.94],[-.46,8.52],[-.27,8.13],[-.48,7.66],[-.32,7.29],[-.58,6.91],[-.49,6.43],[-.76,6.04],[-.73,5.56],[-.91,5.1]];
  const branches=[crack,[[-.48,7.66],[-.87,7.78],[-1.21,7.42]],[[-.58,6.91],[-.14,6.65],[.11,6.73]],
    [[-.76,6.04],[-1.14,6.12],[-1.39,5.83]],[[-.27,8.13],[.04,8.36],[.12,8.69]]];
  for(const side of [-1,1]) {
    for(const line of branches) {
      const points=line.map(([x,y])=>[x,y,side*(Math.abs(x)>1.04?.37:.48+.10*(1-Math.abs(x)/1.04))]);
      tube(points,.028,seams);tube(points.map(([x,y,z])=>[x,y,z+side*.028]),.013,ember);
    }
    for(const line of [
      [[-1.44,8.9],[-1.19,8.63],[-1.11,8.30]],[[1.43,6.7],[1.19,6.46],[1.07,6.12]],
      [[-1.43,4.8],[-1.19,4.60],[-1.13,4.12]],[[1.29,2.18],[1.10,2.48],[1.16,2.90]],
    ])tube(line.map(([x,y])=>[x,y,side*.36]),.009,seams);
  }

  add(new T.CylinderGeometry(.36,.43,2.15,12),grip,0,12.07,0);
  for(const y of [11.06,13.13])add(new T.CylinderGeometry(.49,.49,.18,12),bronze,0,y,0);
  for(let i=0;i<8;i++) {
    const band=add(new T.TorusGeometry(.407,.044,5,20).rotateX(Math.PI/2),bronze,0,11.24+i*.245,0);band.rotation.z=.36;
  }
  plate([[0,13.12],[-.47,13.58],[0,14.13],[.47,13.58]],.54,.075,bronze);
  for(const side of [-1,1]) {
    plate([[0,13.28],[-.27,13.6],[0,13.97],[.27,13.6]],.065,.025,grip,side*.34);
    const gem=add(new T.OctahedronGeometry(1,0),wind,0,13.64,side*.425);gem.scale.set(.15,.30,.10);
    plate([[0,11.20],[-.18,11.47],[0,11.72],[.18,11.47]],.22,.025,bronze,side*.57);
    const crest=add(new T.OctahedronGeometry(1,0),wind,0,11.47,side*.74);crest.scale.set(.09,.18,.07);
  }

  root.updateMatrixWorld(true);
  const batches=new Map<T.Material,T.BufferGeometry[]>(),sources=new Set<T.BufferGeometry>();
  for(const child of root.children) {
    if(!(child instanceof T.Mesh))continue;
    const geometry=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();geometry.applyMatrix4(child.matrixWorld);
    if(child.material===stone||child.material===steel) {
      const p=geometry.attributes.position,uv=geometry.attributes.uv;
      for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)*.24+p.getZ(i)*.17,p.getY(i)*.15);
    }
    const surface=child.material as T.Material;if(!batches.has(surface))batches.set(surface,[]);batches.get(surface)!.push(geometry);sources.add(child.geometry);
  }
  root.clear();
  for(const [surface,geometries]of batches) {
    const mesh=new T.Mesh(mergeGeometries(geometries)!,surface);mesh.name=surface.name;
    mesh.castShadow=surface!==wind&&surface!==ember&&surface!==seams;mesh.receiveShadow=true;root.add(mesh);
    geometries.forEach(g=>g.dispose());
  }
  sources.forEach(g=>g.dispose());
  const bottom=new T.Box3().setFromObject(root).min.y;
  for(const child of root.children)if(child instanceof T.Mesh)child.geometry.translate(0,-bottom,0);
  root.userData.design='giant-sword-design-sheet-v1';template=root;return root.clone(true);
}
