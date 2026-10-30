import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BOSS_ARENA, BOSS_ISLAND_OFFSET_X, bossCoastX } from './ferry-shore-layout';

export type RuinedWallKind='straight'|'curved'|'corner'|'pier'|'breach'|'rubble';
const modules=new Map<RuinedWallKind,T.Group>();
let islandTemplate:T.Group|undefined;
const stone=new T.MeshStandardMaterial({color:'#d4c7ad',roughness:.94,vertexColors:true});stone.name='island-sandstone';
const cap=new T.MeshStandardMaterial({color:'#ded0ac',roughness:.91,vertexColors:true});cap.name='island-capstone';
const limestone=new T.MeshStandardMaterial({color:'#bcbaa9',roughness:1,vertexColors:true});limestone.name='island-limestone';
const moss=new T.MeshStandardMaterial({color:'#7c8b43',roughness:1});moss.name='island-moss';
const leaf=new T.MeshStandardMaterial({color:'#728d3e',roughness:.95});leaf.name='island-ivy';

const noise=(n:number)=>Math.sin(n*127.1+19.7)*Math.cos(n*43.7+3.1);
const sphere=new T.SphereGeometry(1,7,4);
const leafShape=new T.Shape();leafShape.moveTo(0,0);leafShape.bezierCurveTo(-.28,.08,-.24,.38,0,.48);leafShape.bezierCurveTo(.24,.38,.28,.08,0,0);
const leafGeometry=new T.ExtrudeGeometry(leafShape,{depth:.025,bevelEnabled:false,curveSegments:4});

function add(parent:T.Group,geometry:T.BufferGeometry,surface:T.Material,x=0,y=0,z=0) {
  const mesh=new T.Mesh(geometry,surface);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

function stoneBlock(w:number,h:number,d:number,seed:number) {
  const bevel=Math.min(.11,h*.17),vertices:number[]=[],colors:number[]=[],indices:number[]=[];
  for(const [ring,y,inset]of [[0,-h/2,bevel],[1,-h/2+bevel,0],[2,h/2-bevel,0],[3,h/2,bevel]]) {
    const x=w/2-inset,z=d/2-inset,b=Math.min(.12,x*.22,z*.22);
    const outline=[[-x+b,-z],[x-b,-z],[x,-z+b],[x,z-b],[x-b,z],[-x+b,z],[-x,z-b],[-x,-z+b]];
    for(let i=0;i<8;i++) {
      const [px,pz]=outline[i],variation=noise(seed+i*3.7);
      vertices.push(px*(1+variation*.035),y+(ring>1?noise(seed+i*2.1)*h*.055:0),pz*(1+noise(seed+i*8.3)*.045));
      const shade=.87+noise(seed+i*3.8+ring)*.065+(ring===3?.09:0);colors.push(shade,shade,shade);
      if(ring<3){const a=ring*8+i,b=ring*8+(i+1)%8;indices.push(a,a+8,b,b,a+8,b+8);}
    }
  }
  for(let i=1;i<7;i++){indices.push(0,i,i+1);indices.push(24,24+i+1,24+i);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

function cliffRock(w:number,h:number,d:number,seed:number) {
  const vertices:number[]=[],colors:number[]=[],indices:number[]=[],sides=7;
  for(let row=0;row<4;row++)for(let i=0;i<sides;i++) {
    const angle=i/sides*Math.PI*2+noise(seed+row)*.18,scale=[.48,.82,1,.63][row],radius=1+noise(seed+i*2.7)*.24;
    vertices.push(Math.cos(angle)*w/2*scale*radius+noise(seed+row*2)*w*.10,
      ([-.5,-.18,.23,.5][row]+noise(seed+i+row*6)*.09)*h,
      Math.sin(angle)*d/2*scale*radius+noise(seed+row*5)*d*.10);
    const shade=.87+noise(seed+i*3+row*2)*.09;colors.push(shade,shade*.99,shade*.96);
    if(row<3){const a=row*sides+i,b=row*sides+(i+1)%sides;indices.push(a,a+sides,b,b,a+sides,b+sides);}
  }
  for(let i=1;i<sides-1;i++){indices.push(0,i,i+1);indices.push(21,21+i+1,21+i);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);
  const faceted=geometry.toNonIndexed();faceted.computeVertexNormals();geometry.dispose();return faceted;
}

function batch(group:T.Group) {
  group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),batches=new Map<T.Material,T.BufferGeometry[]>();
  group.traverse(node=>{
    if(!(node instanceof T.Mesh))return;
    const geometry=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();
    geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,node.matrixWorld));geometry.deleteAttribute('uv');
    const surface=node.material as T.Material;if(!batches.has(surface))batches.set(surface,[]);batches.get(surface)!.push(geometry);
  });
  group.clear();for(const [surface,geometries]of batches) {
    const mesh=add(group,mergeGeometries(geometries)!,surface);mesh.name=surface.name;
    mesh.castShadow=surface!==moss&&surface!==leaf;geometries.forEach(g=>g.dispose());
  }
}

function greenery(parent:T.Group,x:number,y:number,z:number,seed:number,hanging=false) {
  const patch=add(parent,sphere,moss,x,y,z);patch.scale.set(.34,.07,.24);
  const count=hanging?Math.min(9,Math.max(1,Math.floor((y-.15)/.24)+1)):3;
  for(let j=0;j<count;j++) {
    const mesh=add(parent,leafGeometry,leaf,x+Math.sin(j*1.7+seed)*.16,y-(hanging?j*.24:0),z+.10);
    mesh.rotation.set(hanging?0:-Math.PI/2,0,(j%2?1:-1)*.58);mesh.scale.setScalar(.42+(j%3)*.11);
  }
}

export function createRuinedWallModule(kind:RuinedWallKind):T.Group {
  const cached=modules.get(kind);if(cached)return cached.clone(true);
  const root=new T.Group();root.name=`ruined-wall-${kind}`;
  const block=(x:number,y:number,z:number,w:number,h:number,d:number,seed:number,top=false)=>
    add(root,stoneBlock(w,h,d,seed),top?cap:stone,x,y,z);
  const run=(length:number,seed:number,angle=0,offsetX=0,offsetZ=0)=>{
    const segment=new T.Group();root.add(segment);
    const count=Math.ceil(length/1.22),unit=length/count;
    for(let row=0;row<4;row++)for(let i=0;i<count+(row%2);i++) {
      // A continuous footing keeps upper masonry breaks readable as a protected boundary.
      if(row===3&&(i+seed)%3!==0)continue;
      if(kind==='breach'&&row>=2&&i>=count/2)continue;
      const half=row%2&&(i===0||i===count),w=half?unit/2:unit;
      const start=row%2?i===0?0:(i-.5)*unit:i*unit;
      const x=-length/2+start+w/2,z=kind==='curved'?.10*x*x:noise(seed+i*3+row)*.025;
      const mesh=add(segment,stoneBlock(w-.035,.43,.97-row*.05,seed+i+row*13),row===3?cap:stone,x,.23+row*.445,z);
      mesh.rotation.y=kind==='curved'?-.20*x:noise(seed+i*2+row)*.025;
    }
    segment.position.set(offsetX,0,offsetZ);segment.rotation.y=angle;
  };
  if(kind==='pier') {
    for(let row=0;row<5;row++)block(0,.24+row*.46,0,1.05,.45,1.05,row*17,row===4);
    greenery(root,-.18,1.85,.56,3,true);
  }else if(kind==='rubble') {
    for(let i=0;i<6;i++) {
      const mesh=block(noise(i+3)*1.25,.18+(i%3)*.13,noise(i+7)*.5,.60+(i%2)*.24,.36,.48,i*9,i===0);
      mesh.rotation.set(noise(i)*.25,noise(i+4),noise(i+8)*.12);
    }
    greenery(root,.3,.44,.1,2);
  }else {
    run(kind==='corner'?2.4:3.8,kind==='straight'?2:5);
    if(kind==='corner')run(2.4,7,Math.PI/2,1.2,1.2);
    greenery(root,-1.1,.96,.52,4,true);greenery(root,.8,1.42,.1,6);
    if(kind==='breach')for(let i=0;i<3;i++)block(.5+i*.6,.18,.8+i*.12,.55,.34,.5,i*3);
  }
  batch(root);const bottom=new T.Box3().setFromObject(root).min.y;
  for(const node of root.children)if(node instanceof T.Mesh)node.geometry.translate(0,-bottom,0);
  modules.set(kind,root);return root.clone(true);
}

export function createBossIslandStonework() {
  const centerX=(BOSS_ARENA.left+BOSS_ARENA.right)/2,centerZ=(BOSS_ARENA.top+BOSS_ARENA.bottom)/2;
  if(islandTemplate){const root=islandTemplate.clone(true);return {root,occluders:root.children.filter(o=>o.name.startsWith('boss-ruined-wall-'))};}
  const root=new T.Group();root.name='boss-island-stonework';root.position.set(centerX,0,centerZ);
  const cliffs=new T.Group();cliffs.name='boss-island-cliffs';root.add(cliffs);
  const outline:T.Vector2[]=[];
  for(let i=0;i<16;i++)outline.push(new T.Vector2(-25+i*50/16,-25));
  for(let i=0;i<16;i++)outline.push(new T.Vector2(25,-25+i*50/16));
  for(let i=0;i<16;i++)outline.push(new T.Vector2(25-i*50/16,25));
  for(let i=0;i<16;i++) {
    const z=25-i*50/16;outline.push(new T.Vector2(bossCoastX(z+centerZ)-BOSS_ISLAND_OFFSET_X-centerX,z));
  }
  const levels=[[-.15,1],[-1.2,1],[-3.2,.97],[-6.8,.84],[-11.4,.67],[-16.8,.43],[-22,.17]];
  const vertices:number[]=[],colors:number[]=[],indices:number[]=[],count=outline.length;
  for(let row=0;row<levels.length;row++)for(let i=0;i<count;i++) {
    const [y,baseScale]=levels[row],[x,z]=outline[i].toArray(),variation=row<2?0:noise(i*1.7+row)*.95;
    const scale=baseScale+(row<2?0:noise(i*2.3+row*4)*.035);
    vertices.push(x*scale+variation,y+(row<2?0:noise(i*.8+row*4)*(row===6?1.8:.85)),z*scale+variation);
    const shade=.86+noise(i*2.5+row)*.06+(row===2||row===4?.07:0);colors.push(shade,shade*.985,shade*.96);
    if(row<levels.length-1) {
      const a=row*count+i,b=row*count+(i+1)%count;
      indices.push(a,b,a+count,b,b+count,a+count);
    }
  }
  for(let i=1;i<count-1;i++) {indices.push(0,i+1,i);const last=(levels.length-1)*count;indices.push(last,last+i,last+i+1);}
  const core=new T.BufferGeometry();core.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  core.setAttribute('color',new T.Float32BufferAttribute(colors,3));core.setIndex(indices);core.computeVertexNormals();add(cliffs,core,limestone);
  for(let i=0;i<count;i++) {
    const p=outline[i],next=outline[(i+1)%count],mid=p.clone().add(next).multiplyScalar(.5),length=p.distanceTo(next);
    const rim=add(cliffs,stoneBlock(length+.12,.65,1.65,i*3),cap,mid.x,-.39,mid.y);rim.rotation.y=-Math.atan2(next.y-p.y,next.x-p.x);
    if(i%2===0)for(let row=0;row<3;row++) {
      const y=-3.4-row*3.9+noise(i+row)*.65,scale=1-row*.15;
      const geometry=cliffRock(length*(1.4+noise(i+row)*.3),5.2+noise(i*2+row)*1.3,3.6+noise(i*3+row)*.7,i*7+row);
      const mesh=add(cliffs,geometry,row===1?stone:limestone,mid.x*scale,y,mid.y*scale);mesh.rotation.y=rim.rotation.y+noise(i+row)*.2;
    }
    if(i%5===0) {
      const length=2.8+(i%3)*.7;
      for(let j=0;j<10;j++) {
        const mesh=add(cliffs,leafGeometry,leaf,mid.x+Math.sin(j*.7)*.15,-.2-j*length/10,mid.y);
        mesh.rotation.set(0,rim.rotation.y,Math.sin(j)*.7);mesh.scale.setScalar(.65+(j%2)*.2);
      }
      const patch=add(cliffs,sphere,moss,mid.x,-.04,mid.y);patch.scale.set(.6,.08,.4);
    }
  }
  batch(cliffs);

  const walls=[
    {x:0,z:-20.7,length:41.4,angle:0},
    {x:0,z:20.7,length:41.4,angle:0},
    {x:20.7,z:0,length:40,angle:Math.PI/2},
    {x:-20.7,z:-6.25,length:27.5,angle:Math.PI/2},
    {x:-20.7,z:16.25,length:7.5,angle:Math.PI/2},
  ];
  walls.forEach(({x,z,length,angle},index)=>{
    const wall=new T.Group();wall.name=`boss-ruined-wall-${index}`;root.add(wall);wall.position.set(x,0,z);wall.rotation.y=angle;
    const pieces=Math.ceil(length/3.8),span=length/pieces;
    for(let i=0;i<pieces;i++) {
      const kind=i%4===1?'breach':i%5===2?'curved':'straight';
      const module=createRuinedWallModule(kind);module.position.x=-length/2+span*(i+.5);module.scale.x=span/3.8;
      if(i%3===2)module.rotation.y=Math.PI;wall.add(module);
    }
    if(index===0)for(const x of [-length/2+.5,length/2-.5]) {
      const pier=createRuinedWallModule('pier');pier.position.x=x;wall.add(pier);
    }
    batch(wall);
  });
  islandTemplate=root;const copy=root.clone(true);
  return {root:copy,occluders:copy.children.filter(o=>o.name.startsWith('boss-ruined-wall-'))};
}
