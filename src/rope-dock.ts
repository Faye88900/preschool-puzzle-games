import * as T from 'three';
import { rounded } from './puzzle-art';
import { batchTreasureParts, treasureLeaf } from './treasure-details';

const grainCanvas=document.createElement('canvas');grainCanvas.width=grainCanvas.height=128;
const grain=grainCanvas.getContext('2d')!;grain.fillStyle='#f5e5cb';grain.fillRect(0,0,128,128);
grain.strokeStyle='#d5bc93';grain.lineWidth=.8;
for(let i=0;i<19;i++) {grain.beginPath();for(let y=0;y<=128;y+=4){const x=i*7+Math.sin(y*.055+i)*1.2;if(y)grain.lineTo(x,y);else grain.moveTo(x,y);}grain.stroke();}
const timber=new T.CanvasTexture(grainCanvas);timber.colorSpace=T.SRGBColorSpace;
const wood=new T.MeshStandardMaterial({color:'#b98c58',roughness:.85,map:timber});
const lightWood=new T.MeshStandardMaterial({color:'#cfa56c',roughness:.82,map:timber});
const darkWood=new T.MeshStandardMaterial({color:'#75543a',roughness:.94});
const endGrain=new T.MeshStandardMaterial({color:'#ead3a4',roughness:.88});
const rope=new T.MeshStandardMaterial({color:'#d8be88',roughness:1});
const braid=new T.MeshStandardMaterial({color:'#b59461',roughness:1});
const iron=new T.MeshStandardMaterial({color:'#726a50',roughness:.67,metalness:.3});
const leafMaterial=new T.MeshStandardMaterial({color:'#76916b',roughness:.9});
const plank=rounded(1,1,1,.045),peg=new T.SphereGeometry(.018,6,4);

export function createRopeDock(length:number,width:number,boatTieX=length/2+1.05) {
  const root=new T.Group(),mooring=new T.Group();mooring.name='dock-mooring-line';
  const group=(name:string)=>{const g=new T.Group();g.name=name;root.add(g);return g;};
  const deck=group('dock-deck'),supports=group('dock-supports'),posts=group('dock-posts'),ropes=group('dock-ropes');root.add(mooring);
  const add=(parent:T.Group,geometry:T.BufferGeometry,material:T.Material,x=0,y=0,z=0)=>{
    const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  };
  const box=(parent:T.Group,material:T.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{
    const m=add(parent,plank,material,x,y,z);m.scale.set(w,h,d);return m;
  };
  const tube=(parent:T.Group,points:T.Vector3[],radius:number,material:T.Material,segments=36)=>
    add(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points),segments,radius,5,false),material);
  const between=(a:T.Vector3,b:T.Vector3,w:number,d:number)=>{
    const beam=box(supports,wood,0,0,0,w,a.distanceTo(b),d);beam.position.copy(a).add(b).multiplyScalar(.5);
    beam.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());
  };
  const wrap=(x:number,y:number,z:number,turns:number)=>{
    const points=Array.from({length:65},(_,i)=>{
      const t=i/64,a=t*Math.PI*2*turns;return new T.Vector3(x+Math.cos(a)*.169,y+(t-.5)*turns*.041,z+Math.sin(a)*.169);
    });tube(posts,points,.024,rope,turns*24);
  };
  const post=(x:number,z:number,badge=false)=>{
    add(posts,new T.CylinderGeometry(.145,.18,2.78,10),wood,x,-.13,z);
    add(posts,new T.CylinderGeometry(.185,.185,.10,12),endGrain,x,1.30,z);
    add(posts,new T.CylinderGeometry(.17,.18,.38,10),darkWood,x,-1.33,z);
    wrap(x,1.09,z,3);wrap(x,-.23,z,2);
    for(const r of [.055,.105]) {
      const ring=add(posts,new T.TorusGeometry(r,.0035,3,16),darkWood,x,1.353,z);ring.rotation.x=Math.PI/2;
    }
    for(const angle of [.8,2.8,4.8])tube(posts,[new T.Vector3(x+Math.cos(angle)*.155,.3,z+Math.sin(angle)*.155),new T.Vector3(x+Math.cos(angle)*.15,.91,z+Math.sin(angle)*.15)],.004,darkWood,5);
    if(badge) {
      const leaf=add(posts,treasureLeaf,leafMaterial,x,.58,z+.19);leaf.scale.set(.23,.35,.3);leaf.rotation.z=-.2;
      tube(posts,[new T.Vector3(x,1,z+.17),new T.Vector3(x+.03,.86,z+.20)],.012,rope,6);
    }
  };
  const sagRope=(parent:T.Group,a:T.Vector3,b:T.Vector3,sag:number)=>{
    const path=new T.CatmullRomCurve3(Array.from({length:9},(_,i)=>{
      const t=i/8,p=a.clone().lerp(b,t);p.y-=4*sag*t*(1-t);return p;
    }));
    add(parent,new T.TubeGeometry(path,32,.047,6,false),rope);
    const frames=path.computeFrenetFrames(64,false);
    for(const phase of [0,Math.PI])tube(parent,Array.from({length:65},(_,i)=>{
      const a=i/64*Math.PI*28+phase;return path.getPointAt(i/64).addScaledVector(frames.normals[i],Math.cos(a)*.045).addScaledVector(frames.binormals[i],Math.sin(a)*.045);
    }),.009,braid,64);
  };
  const count=Math.ceil(length/.34),spacing=length/count;
  for(let i=0;i<count;i++) {
    const x=-length/2+(i+.5)*spacing;
    box(deck,i%3===0?wood:lightWood,x,.035,0,spacing-.018,.12,width-.14);
    for(const z of [-width/2+.26,width/2-.26])add(deck,peg,iron,x,.101,z);
  }
  for(const z of [-width/2+.12,width/2-.12])box(supports,darkWood,0,-.14,z,length+.1,.22,.20);
  for(const x of [-length/2,0,length/2]) {
    box(supports,wood,x,-.20,0,.22,.22,width+.15);
    for(const z of [-width/2,width/2])post(x,z,x===-length/2&&z>0);
  }
  for(const z of [-width/2,width/2]) {
    for(const [x0,x1] of [[-length/2,0],[0,length/2]]) {
      sagRope(ropes,new T.Vector3(x0,1.10,z),new T.Vector3(x1,1.10,z),.22);
      between(new T.Vector3(x0,-1.18,z),new T.Vector3(x1,-.3,z),.12,.14);
      between(new T.Vector3(x1,-1.18,z),new T.Vector3(x0,-.3,z),.12,.14);
    }
  }
  const cleatX=length/2-.22,cleatZ=width/2-.25;
  box(deck,iron,cleatX,.16,cleatZ,.10,.13,.12);box(deck,iron,cleatX,.24,cleatZ,.38,.055,.08);
  const coil=Array.from({length:121},(_,i)=>{const t=i/120,a=t*Math.PI*6,r=.10+t*.17;return new T.Vector3(length/2-.57+Math.cos(a)*r,.125,cleatZ-.22+Math.sin(a)*r);});
  tube(deck,coil,.022,rope,120);
  sagRope(mooring,new T.Vector3(cleatX,.25,cleatZ),new T.Vector3(boatTieX,.18,.75),.16);
  for(const component of [deck,supports,posts,ropes,mooring])batchTreasureParts(component);
  const colliders=[{x:0,y:.035,z:0,width:length,height:.12,depth:width-.14},
    ...[-1,1].map(side=>({x:0,y:.67,z:side*width/2,width:length+.34,height:1.34,depth:.34}))];
  return {root,mooring,colliders};
}
