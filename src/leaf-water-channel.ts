import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rounded } from './puzzle-art';

export const LEAF_CHANNEL_SPACING=3.465;
export const LEAF_CHANNEL_FLOORS=[3.12,2.42,1.72] as const;
let template:T.Group|undefined;

export function leafChannelStreams() {
  const top=LEAF_CHANNEL_FLOORS[0],last=LEAF_CHANNEL_FLOORS[2],outlet=2*LEAF_CHANNEL_SPACING+3.04;
  return [
    {width:.145,points:[[0,top+.32,-1.27],[0,top+.30,-1.06],[0,top+.25,-.76]]},
    ...[0,1].map(i=>{const z=i*LEAF_CHANNEL_SPACING,floor=LEAF_CHANNEL_FLOORS[i],next=LEAF_CHANNEL_FLOORS[i+1];return {width:.19,points:[[0,floor+.245,z+3.01],[0,floor+.24,z+3.14],[0,floor+.11,z+3.32],[0,next+.37,z+3.48],[0,next+.25,z+3.55]]};}),
    {width:.22,points:[[0,last+.245,outlet],[0,last+.22,outlet+.15],[0,last+.04,outlet+.39],[0,1.20,outlet+.65],[0,.30,outlet+.96],[0,-1.30,outlet+1.35],[0,-4.5,outlet+1.85],[0,-8,outlet+2.30],[0,-12.5,outlet+2.80]]},
  ];
}

export function createLeafWaterChannel():T.Group {
  if(template)return template.clone(true);
  const root=new T.Group();root.name='three-tier-leaf-water-channel';
  const material=(name:string,color:string,roughness=.94)=>{
    const m=new T.MeshStandardMaterial({color,roughness,vertexColors:true});m.name=`leaf-channel-${name}`;return m;
  };
  const stone=material('limestone','#ffffff'),veins=material('carved-veins','#ded1a7'),rock=material('support-rock','#c4b99f');
  const wood=material('pale-roots','#baa482'),moss=material('moss','#7b8a48'),seams=material('seams','#8c896b');
  const water=material('water-preview','#65c6c8',.27);water.transparent=true;water.opacity=.43;water.depthWrite=false;water.side=T.DoubleSide;
  const foam=material('water-highlight','#d9f5e7',.42);
  const noise=(n:number)=>Math.sin(n*19.73+7.8)*Math.cos(n*32.17+2.7);
  const add=(parent:T.Group,geometry:T.BufferGeometry,surface:T.Material,x=0,y=0,z=0)=>{
    const mesh=new T.Mesh(geometry,surface);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  };
  const tube=(parent:T.Group,points:number[][],radius:number,surface:T.Material,segments=14)=>
    add(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(([x,y,z])=>new T.Vector3(x,y,z))),segments,radius,radius<.03?4:7,false),surface);
  const outline=new T.Shape();outline.moveTo(0,-1.65);
  outline.bezierCurveTo(-1.22,-1.65,-1.55,-.85,-1.40,.15);
  outline.bezierCurveTo(-1.28,1.18,-.48,1.78,0,3.05);
  outline.bezierCurveTo(.48,1.78,1.28,1.18,1.40,.15);
  outline.bezierCurveTo(1.55,-.85,1.22,-1.65,0,-1.65);
  const edge=outline.getSpacedPoints(64).slice(0,-1),count=edge.length;
  const color=(hex:string,shade:number)=>new T.Color(hex).multiplyScalar(shade);

  for(const [tier,floor]of LEAF_CHANNEL_FLOORS.entries()) {
    const basin=new T.Group();basin.name=`leaf-water-tier-${tier}`;basin.position.z=tier*LEAF_CHANNEL_SPACING;root.add(basin);
    const shell=new T.Group();shell.name='stone-leaf-basin';basin.add(shell);
    const vertices:number[]=[],colors:number[]=[],indices:number[]=[];
    const profile=[[.04,0],[.40,.012],[.70,.05],[.84,.13],[.91,.42],[.98,.50],[1.04,.45],[1.06,.27],[1.02,-.20],[.88,-.28],[.42,-.28],[.04,-.28]];
    for(let row=0;row<profile.length;row++)for(let i=0;i<count;i++) {
      const [r,y]=profile[row],p=edge[i],variation=row>3&&row<9?noise(i*.65+tier)*.015:0;
      const notch=T.MathUtils.smoothstep(p.y,1.55,2.95)*Math.max(0,1-Math.abs(p.x)/.66);
      vertices.push(p.x*r,y+floor-(row>=3&&row<=7?notch*.29:0)+variation,p.y*r);
      const shade=.94+noise(i*2.7+tier+row)*.035;
      const c=color(row<4?'#b9c5a8':row<7?'#e3d0a7':'#d3c6aa',shade);colors.push(c.r,c.g,c.b);
      if(row<profile.length-1){const a=row*count+i,b=row*count+(i+1)%count,c=a+count,d=b+count;indices.push(a,c,b,b,c,d);}
    }
    for(const [row,reverse]of [[0,false],[profile.length-1,true]] as const) {
      const index=vertices.length/3;vertices.push(0,floor+(reverse?-.28:0),0);const c=color(reverse?'#d3c6aa':'#b9c5a8',.95);colors.push(c.r,c.g,c.b);
      for(let i=0;i<count;i++){const a=row*count+i,b=row*count+(i+1)%count;indices.push(index,reverse?b:a,reverse?a:b);}
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();add(shell,geometry,stone);
    for(let i=2;i<count;i+=6) {
      const p=edge[i];if(p.y>2.0)continue;
      tube(shell,[[p.x*.92,floor+.425,p.y*.92],[p.x*.99,floor+.50,p.y*.99],[p.x*1.04,floor+.39,p.y*1.04],[p.x*1.045,floor+.18,p.y*1.045]],.009,seams,8);
    }
    tube(shell,[[0,floor+.026,-1.20],[0,floor+.026,-.3],[.02,floor+.040,.55],[0,floor+.080,1.38],[0,floor+.17,2.53]],.026,veins,24);
    for(const side of [-1,1])for(const [z,endX,endZ]of [[-.70,.72,-1.05],[-.10,.96,-.60],[.50,.88,.02],[1.05,.55,.65]])
      tube(shell,[[0,floor+.035,z],[side*endX*.60,floor+.038,z-.14],[side*endX,floor+.065,endZ]],.017,veins,12);

    const supports=new T.Group();supports.name='leaf-rock-support';basin.add(supports);
    const height=floor-.27;
    for(let row=0;row<3;row++)for(const side of [-1,1]) {
      const mesh=add(supports,new T.DodecahedronGeometry(1,0),rock,side*.51+noise(row+tier)*.09,height*(row+.5)/3,-.12+noise(row*4+tier)*.13);
      mesh.scale.set(.82-row*.06,height/5.3,.95-row*.06);mesh.rotation.y=noise(row+tier*4+side)*.5;
    }
    for(const side of [-1,1]) {
      tube(supports,[[side*.78,.10,.64],[side*1.02,height*.35,.50],[side*.99,height*.72,.31],[side*1.29,floor-.01,.20]],.095,wood,25);
      tube(supports,[[side*1.05,.09,-.55],[side*.82,height*.36,-.69],[side*1.05,height*.75,-.53],[side*.96,floor-.04,-.73]],.055,wood,20);
    }
    for(const i of [5,17,39,51]) {
      const p=edge[i],patch=add(supports,new T.SphereGeometry(1,8,4),moss,p.x*1.02,floor+.38,p.y*1.02);patch.scale.set(.21,.045,.16);
      for(let j=0;j<4;j++) {
        const shape=new T.Shape([new T.Vector2(0,0),new T.Vector2(-.07,-.08),new T.Vector2(0,-.18),new T.Vector2(.07,-.08)]);
        const leaf=add(supports,new T.ExtrudeGeometry(shape,{depth:.018,bevelEnabled:false}),moss,p.x*1.055+Math.sin(j*2)*.05,floor+.37-j*.16,p.y*1.055);leaf.rotation.y=Math.atan2(p.x,p.y);leaf.rotation.z=Math.sin(j)*.60;
      }
    }

    const surface=new T.Group();surface.name='leaf-basin-water-preview';basin.add(surface);
    const waterVertices=[0,floor+.245,0],waterIndices:number[]=[];
    for(const p of edge){const r=.86+.14*T.MathUtils.smoothstep(p.y,1.55,2.95);waterVertices.push(p.x*r,floor+.245,p.y*r);}
    for(let i=0;i<count;i++)waterIndices.push(0,i+1,(i+1)%count+1);
    const surfaceGeometry=new T.BufferGeometry();surfaceGeometry.setAttribute('position',new T.Float32BufferAttribute(waterVertices,3));surfaceGeometry.setIndex(waterIndices);surfaceGeometry.computeVertexNormals();add(surface,surfaceGeometry,water);
    for(let i=0;i<3;i++) {
      const ring=add(surface,new T.TorusGeometry(.17+i*.14,.009,4,28).rotateX(Math.PI/2),foam,0,floor+.252,tier===0?-.76:.085);ring.scale.y=.60;
    }
  }

  const intake=new T.Group();intake.name='leaf-channel-inlet';root.add(intake);
  const top=LEAF_CHANNEL_FLOORS[0];
  for(const x of [-.29,.29])add(intake,rounded(.28,.64,.54,.05),rock,x,top+.36,-1.52);
  add(intake,rounded(.86,.22,.62,.05),stone,0,top+.78,-1.52);
  add(intake,rounded(.47,.12,.62,.025),stone,0,top+.23,-1.52);
  const falls=new T.Group();falls.name='leaf-channel-waterfall-preview';root.add(falls);
  const sheet=(points:number[][],width:number)=>{
    const vertices:number[]=[],indices:number[]=[];
    points.forEach(([x,y,z],i)=>{const w=width*(1+i*.04);vertices.push(x-w,y,z,x+w,y,z);if(i<points.length-1){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}});
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();add(falls,geometry,water);
    for(const side of [-1,1])tube(falls,points.map(([x,y,z])=>[x+side*width*.86,y+.006,z+.014]),.012,foam,points.length*4);
  };
  for(const stream of leafChannelStreams())sheet(stream.points,stream.width);

  // Batch inside each named part so basin, supports and static water remain separately inspectable.
  const batch=(group:T.Group)=>{
    group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),batches=new Map<T.Material,T.BufferGeometry[]>();
    for(const child of [...group.children]) {
      if(!(child instanceof T.Mesh))continue;
      const geometry=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,child.matrixWorld));geometry.deleteAttribute('uv');
      if(!geometry.attributes.color)geometry.setAttribute('color',new T.Float32BufferAttribute(new Array(geometry.attributes.position.count*3).fill(.96),3));
      const m=child.material as T.Material;if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push(geometry);group.remove(child);
    }
    for(const [m,parts]of batches){const mesh=add(group,mergeGeometries(parts)!,m);mesh.name=m.name;mesh.castShadow=m!==water&&m!==foam&&m!==moss;mesh.receiveShadow=m!==water&&m!==foam;parts.forEach(p=>p.dispose());}
  };
  for(let i=0;i<3;i++)for(const part of root.getObjectByName(`leaf-water-tier-${i}`)!.children)batch(part as T.Group);
  batch(intake);batch(falls);template=root;return root.clone(true);
}
