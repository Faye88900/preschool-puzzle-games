import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat } from './models';
import { createRopeDock } from './rope-dock';
import { createBossCourtyardBlockoutSteps } from './boss-courtyard-blockout';
import { createBossIslandStonework } from './boss-island-stonework';
import { createCourtyardVegetation } from './courtyard-vegetation';
import { BOSS_ARENA, BOSS_ISLAND_OFFSET_X, FERRY_BOAT_SCALE, FERRY_MOORING_DISTANCE, bossCoastX } from './ferry-shore-layout';

export function createBossIsland(floorTexture:T.Texture) {
  const steps = createBossIslandSteps(floorTexture);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

export function* createBossIslandSteps(floorTexture:T.Texture) {
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
  const paving=new T.MeshStandardMaterial({color:'#596d65',roughness:.96});
  paving.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 vCourtyardPaving;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCourtyardPaving=position.xz;');
    shader.fragmentShader='varying vec2 vCourtyardPaving;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 tile=vCourtyardPaving/2.;tile.x+=mod(floor(tile.y),2.)*.5;
      vec2 edge=min(fract(tile),1.-fract(tile));
      vec2 joint=smoothstep(vec2(.012),vec2(.012)+fwidth(tile),edge);
      float variation=.94+.06*sin(dot(floor(tile),vec2(17.13,43.71)));
      diffuseColor.rgb*=mix(.66,variation,min(joint.x,joint.y));`);
  };
  paving.customProgramCacheKey=()=> 'boss-slate-paving-v1';
  const ground=add(terrain,paving,0,0,0);ground.name='boss-island-ground';
  const stonework=createBossIslandStonework();root.add(stonework.root);
  yield;
  // The arena and landing have physical edges; the empty water gap has no ground collider.
  for(const [x,z,w,d]of [[centerX,top-2.5,width+5,5],[centerX,bottom+2.5,width+5,5],[right+2.5,centerZ,5,depth],
    [left-2.5,(top-17.5)/2,5,-17.5-top],[left-2.5,(bottom-12.5)/2,5,bottom+12.5]])
    colliders.push({x,y:.9,z,width:w,height:1.8,depth:d});
  const mosaic=new T.MeshStandardMaterial({map:floorTexture,roughness:1});
  mosaic.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float leaf=smoothstep(-.025,.045,diffuseColor.g-diffuseColor.r);
      float grey=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      diffuseColor.rgb=max(vec3(0.),mix(vec3(grey),diffuseColor.rgb,1.25)*.90);
      diffuseColor.rgb*=mix(vec3(1.),vec3(.42,.80,1.35),leaf);`);
  };
  mosaic.customProgramCacheKey=()=> 'boss-mosaic-pigment-v1';
  const floor=add(new T.CircleGeometry(15,64),mosaic,centerX,.025,centerZ);
  floor.name='boss-courtyard-wind-mosaic';floor.rotation.x=-Math.PI/2;floor.castShadow=false;
  for(const [x,z]of [[130,-15],[133.5,-16.5],[137,-18],[140,-21]]) {
    add(new T.CylinderGeometry(.85,.9,.035,7),mat('#f1dfb6'),x,.045,z);
  }
  const dock=createRopeDock(4.4,4.6,FERRY_MOORING_DISTANCE-1.69*FERRY_BOAT_SCALE);dock.root.name='boss-island-dock';
  dock.root.position.set(130,0,-15);dock.root.rotation.y=Math.PI;root.add(dock.root);
  colliders.push(...dock.colliders.map(c=>({...c,x:130-c.x,z:-15-c.z})));
  const blockout=yield* createBossCourtyardBlockoutSteps();root.add(blockout.root);colliders.push(...blockout.colliders);
  yield;
  const vegetation=createCourtyardVegetation();vegetation.position.set(centerX,0,centerZ);root.add(vegetation);
  yield;
  // Cached prop kits also serve previews and other islands; tint only this island's copies.
  const palette:Record<string,string>={
    'island-sandstone':'#b99c72','island-capstone':'#e3c28c','island-limestone':'#718479',
    'island-moss':'#526d33','island-ivy':'#39794d',
    'sword-roots-wood':'#806044','sword-roots-bark-ridges':'#ac8054','sword-roots-moss':'#4c7035','sword-roots-leaves':'#387947',
    'ancient-sword-stone':'#c4ad82','ancient-sword-steel':'#314b4b','ancient-sword-bronze':'#c39b48','ancient-sword-seal':'#197e70',
    'guardian-statue-limestone':'#c4b187','guardian-statue-mineral-jade':'#167968',
    'leaf-chime-limestone':'#c7b185','leaf-chime-patina':'#4b9c8c',
    'leaf-channel-limestone':'#bdd8c1','leaf-channel-carved-veins':'#b29251','leaf-channel-support-rock':'#637d70','leaf-channel-pale-roots':'#876646',
    'stele-limestone':'#d6c198','stele-jade':'#177c68','stele-deep-carving':'#4f5949',
    'campfire-limestone':'#bca47b','floating-limestone':'#c3c9b4',
    'courtyard-foliage':'#79bc9c','courtyard-moss':'#78a46a','garden-fresh-leaf':'#3c983e',
  };
  const tinted=new Map<T.Material,T.MeshStandardMaterial>();
  root.traverse(node=>{if(!(node instanceof T.Mesh)||Array.isArray(node.material))return;
    const source=node.material as T.MeshStandardMaterial,color=palette[source.name];if(!color)return;
    if(!tinted.has(source)){const copy=source.clone();copy.color.set(color);tinted.set(source,copy);}node.material=tinted.get(source)!;
  });
  // The textured floor keeps its UVs; support scenery batches discard theirs.
  root.updateMatrixWorld(true);const batches=new Map<T.Material,T.BufferGeometry[]>();
  for(const child of [...root.children]) {
    if(!(child instanceof T.Mesh)||child===ground||child===floor)continue;
    const geometry=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();geometry.applyMatrix4(child.matrixWorld);geometry.deleteAttribute('uv');
    const surface=child.material as T.Material;if(!batches.has(surface))batches.set(surface,[]);batches.get(surface)!.push(geometry);root.remove(child);
  }
  for(const [surface,geometries]of batches){yield;const mesh=new T.Mesh(mergeGeometries(geometries)!,surface);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);geometries.forEach(g=>g.dispose());}
  root.position.x=BOSS_ISLAND_OFFSET_X;
  for(const collider of colliders)collider.x+=BOSS_ISLAND_OFFSET_X;
  const courtyardOccluders=blockout.root.children.flatMap(object=>object.name==='three-tier-leaf-water-channel'
    ?object.children.filter(child=>child.name.startsWith('boss-blockout-water-channel-')||child.name==='leaf-channel-inlet'):[object]);
  return {root,colliders,terrain,occluders:[...courtyardOccluders,...stonework.occluders]};
}
