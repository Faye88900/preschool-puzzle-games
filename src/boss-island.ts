import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat } from './models';
import { createRopeDock } from './rope-dock';
import { createBossCourtyardBlockout } from './boss-courtyard-blockout';
import { createBossIslandStonework } from './boss-island-stonework';
import { BOSS_ARENA, BOSS_ISLAND_OFFSET_X, FERRY_BOAT_SCALE, FERRY_MOORING_DISTANCE, bossCoastX } from './ferry-shore-layout';

export function createBossIsland(floorTexture:T.Texture) {
  const root=new T.Group();root.name='boss-island';
  const colliders:{x:number;y:number;z:number;width:number;height:number;depth:number}[]=[];
  const add=(geometry:T.BufferGeometry,material:T.Material,x:number,y:number,z:number)=>{
    const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  const {left,right,top,bottom}=BOSS_ARENA,centerX=(left+right)/2,centerZ=(top+bottom)/2;
  const width=right-left,depth=bottom-top;
  const land=new T.Shape();land.moveTo(right+5,-top+5);land.lineTo(right+5,-bottom-5);
  for(let z=bottom+5;z>=top-5;z-=.5)land.lineTo(bossCoastX(z)-BOSS_ISLAND_OFFSET_X,-z);land.closePath();
  const terrain=new T.ExtrudeGeometry(land,{depth:1,bevelEnabled:false,steps:1}).rotateX(-Math.PI/2).translate(0,-1,0);
  const ground=add(terrain,mat('#cfc6ad'),0,0,0);ground.name='boss-island-ground';
  const stonework=createBossIslandStonework();root.add(stonework.root);
  // The arena and landing have physical edges; the empty water gap has no ground collider.
  for(const [x,z,w,d]of [[centerX,top-2.5,width+5,5],[centerX,bottom+2.5,width+5,5],[right+2.5,centerZ,5,depth],
    [left-2.5,(top-17.5)/2,5,-17.5-top],[left-2.5,(bottom-12.5)/2,5,bottom+12.5]])
    colliders.push({x,y:.9,z,width:w,height:1.8,depth:d});
  const floor=add(new T.CircleGeometry(15,64),new T.MeshStandardMaterial({map:floorTexture,roughness:1}),centerX,.025,centerZ);
  floor.name='boss-courtyard-wind-mosaic';floor.rotation.x=-Math.PI/2;floor.castShadow=false;
  for(const [x,z]of [[130,-15],[133.5,-16.5],[137,-18],[140,-21]]) {
    add(new T.CylinderGeometry(.85,.9,.035,7),mat('#f1dfb6'),x,.045,z);
  }
  const dock=createRopeDock(4.4,4.6,FERRY_MOORING_DISTANCE-1.69*FERRY_BOAT_SCALE);dock.root.name='boss-island-dock';
  dock.root.position.set(130,0,-15);dock.root.rotation.y=Math.PI;root.add(dock.root);
  colliders.push(...dock.colliders.map(c=>({...c,x:130-c.x,z:-15-c.z})));
  const blockout=createBossCourtyardBlockout();root.add(blockout.root);colliders.push(...blockout.colliders);
  // The textured floor keeps its UVs; support scenery batches discard theirs.
  root.updateMatrixWorld(true);const batches=new Map<T.Material,T.BufferGeometry[]>();
  for(const child of [...root.children]) {
    if(!(child instanceof T.Mesh)||child===ground||child===floor)continue;
    const geometry=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();geometry.applyMatrix4(child.matrixWorld);geometry.deleteAttribute('uv');
    const surface=child.material as T.Material;if(!batches.has(surface))batches.set(surface,[]);batches.get(surface)!.push(geometry);root.remove(child);
  }
  for(const [surface,geometries]of batches){const mesh=new T.Mesh(mergeGeometries(geometries)!,surface);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);geometries.forEach(g=>g.dispose());}
  root.position.x=BOSS_ISLAND_OFFSET_X;
  for(const collider of colliders)collider.x+=BOSS_ISLAND_OFFSET_X;
  const courtyardOccluders=blockout.root.children.flatMap(object=>object.name==='three-tier-leaf-water-channel'
    ?object.children.filter(child=>child.name.startsWith('boss-blockout-water-channel-')||child.name==='leaf-channel-inlet'):[object]);
  return {root,colliders,terrain,occluders:[...courtyardOccluders,...stonework.occluders]};
}
