import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rounded } from './puzzle-art';
import { mat } from './models';
import { createRopeDock } from './rope-dock';
import { bossCoastX } from './ferry-shore-layout';

export function createBossIsland() {
  const root=new T.Group();root.name='boss-island';
  const colliders:{x:number;y:number;z:number;width:number;height:number;depth:number}[]=[];
  const add=(geometry:T.BufferGeometry,material:T.Material,x:number,y:number,z:number)=>{
    const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  const box=(x:number,y:number,z:number,width:number,height:number,depth:number,color:string)=>{
    add(rounded(width,height,depth,Math.min(.15,height/3)),mat(color),x,y,z);
    colliders.push({x,y,z,width,height,depth});
  };
  const land=new T.Shape();land.moveTo(162.5,42.5);land.lineTo(162.5,7.5);
  for(let z=-7.5;z>=-42.5;z-=.5)land.lineTo(bossCoastX(z),-z);land.closePath();
  const terrain=new T.ExtrudeGeometry(land,{depth:1,bevelEnabled:false,steps:1}).rotateX(-Math.PI/2).translate(0,-1,0);
  const ground=add(terrain,mat('#82ab58'),0,0,0);ground.name='boss-island-ground';
  const rockGeometry=new T.CylinderGeometry(24.748,5,25,4,3).rotateY(Math.PI/4).translate(145,-13.5,-25);
  const rockPoints=rockGeometry.attributes.position;
  for(let i=0;i<rockPoints.count;i++)rockPoints.setX(i,Math.max(rockPoints.getX(i),bossCoastX(rockPoints.getZ(i))));
  rockGeometry.computeVertexNormals();const rock=add(rockGeometry,mat('#c6b5bd'),0,0,0);
  rock.material=new T.MeshStandardMaterial({color:'#c6b5bd',roughness:1,flatShading:true});
  // The arena and landing have physical edges; the empty water gap has no ground collider.
  for(const [x,z,w,d]of [[145,-40,30,5],[145,-10,30,5],[160,-25,5,25],[130,-27.5,5,20]])
    box(x,.9,z,w,1.8,d,'#668e46');
  const floor=add(new T.CircleGeometry(9.2,48),mat('#e5d3ad'),145,.025,-25);floor.rotation.x=-Math.PI/2;
  for(const [x,z]of [[130,-15],[133.5,-16.5],[137,-18],[140,-21]]) {
    add(new T.CylinderGeometry(.85,.9,.035,7),mat('#f1dfb6'),x,.045,z);
  }
  const dock=createRopeDock(4.4,4.6);dock.root.name='boss-island-dock';
  dock.root.position.set(130,0,-15);dock.root.rotation.y=Math.PI;root.add(dock.root);
  colliders.push(...dock.colliders.map(c=>({...c,x:130-c.x,z:-15-c.z})));
  for(const [x,z,h]of [[135,-34,2.8],[155,-34,3.2],[155,-18,1.8]]) {
    add(new T.CylinderGeometry(.6,.75,h,10),mat('#dfcda3'),x,h/2,z);
    colliders.push({x,y:h/2,z,width:1.5,height:h,depth:1.5});
  }
  // Keep terrain and the detailed dock separate from the static scenery batches.
  root.updateMatrixWorld(true);const batches=new Map<T.Material,T.BufferGeometry[]>();
  for(const child of [...root.children]) {
    if(!(child instanceof T.Mesh)||child===ground)continue;
    const geometry=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();geometry.applyMatrix4(child.matrixWorld);geometry.deleteAttribute('uv');
    const surface=child.material as T.Material;if(!batches.has(surface))batches.set(surface,[]);batches.get(surface)!.push(geometry);root.remove(child);
  }
  for(const [surface,geometries]of batches){const mesh=new T.Mesh(mergeGeometries(geometries)!,surface);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);geometries.forEach(g=>g.dispose());}
  return {root,colliders,terrain};
}
