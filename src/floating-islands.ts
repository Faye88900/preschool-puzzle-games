import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createCourtyardPlant } from './courtyard-vegetation';

export type FloatingRockKind='a'|'b'|'c';
export type DistantIslandKind='grass'|'grove'|'ridge';
const rocks=new Map<FloatingRockKind,T.Group>(),islands=new Map<DistantIslandKind,T.Group>();
const stone=new T.MeshStandardMaterial({roughness:.94,vertexColors:true});stone.name='floating-limestone';
const green=new T.MeshStandardMaterial({roughness:1,vertexColors:true});green.name='distant-island-green';
const bark=new T.MeshStandardMaterial({roughness:.96,vertexColors:true});bark.name='distant-tree-bark';
const noise=(n:number)=>Math.sin(n*12.73+7.4)*Math.cos(n*27.19+3.1);
const pixels=new Uint8Array(128*128*4);
for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const grain=noise(x+y*128)*4+Math.sin(x*.11+Math.sin(y*.14))*2;
  pixels.set([218+grain,208+grain,185+grain,255],(y*128+x)*4);
}
const map=new T.DataTexture(pixels,128,128);map.name='floating-rock-stone-grain';map.colorSpace=T.SRGBColorSpace;
map.wrapS=map.wrapT=T.RepeatWrapping;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;stone.map=map;

function add(parent:T.Group,geometry:T.BufferGeometry,material:T.Material,color='#ffffff') {
  if(!geometry.hasAttribute('color')){
    const p=geometry.attributes.position,c=new T.Color(color),colors:number[]=[];
    for(let i=0;i<p.count;i++){const shade=.95+noise(Math.round(p.getX(i)*17)+Math.round(p.getY(i)*23)+Math.round(p.getZ(i)*13))*.04;colors.push(c.r*shade,c.g*shade,c.b*shade);}
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  }
  const mesh=new T.Mesh(geometry,material);mesh.castShadow=false;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

// Shared meridians close the crown and underside; shelves change the silhouette, not just its color.
function crag(width:number,height:number,depth:number,seed:number,sides=10,lean=0,slab=false) {
  const p:number[]=[],uv:number[]=[],colors:number[]=[],indices:number[]=[];
  const levels=slab?[[-1,.58],[-.85,.94],[-.18,1],[0,.72]]:[[-1,.19],[-.86,.38],[-.66,.58],[-.55,.54],[-.36,.83],[-.23,.79],[-.10,1],[0,.85]];
  for(let row=0;row<levels.length;row++)for(let i=0;i<sides;i++){
    const [y,r]=levels[row],a=i/sides*Math.PI*2,edge=1+noise(seed+i*3.1)*.14,step=noise(seed+i*7+row)*.045;
    const x=Math.cos(a)*width*.5*(r+step)*edge+lean*(y+.4),z=Math.sin(a)*depth*.5*(r+step)*(1+noise(seed+i*5)*.09);
    p.push(x,height*(y+(row===levels.length-1?noise(seed+i)*.012:noise(seed+i*2+row)*.025)),z);uv.push(x*.5,z*.5+row*.12);
    const shade=.88+noise(seed+i*4+row)*.055+(row===4||row===6?.10:0);colors.push(shade,shade*.995,shade*.97);
    if(row<levels.length-1){const a=row*sides+i,b=row*sides+(i+1)%sides;indices.push(a,b,a+sides,b,b+sides,a+sides);}
  }
  const bottom=p.length/3;p.push(lean*(-.6),-height*1.015,0);uv.push(.5,0);colors.push(.76,.76,.75);
  const top=p.length/3;p.push(lean*.4,.012,0);uv.push(.5,1);colors.push(.98,.98,.96);
  for(let i=0;i<sides;i++){const next=(i+1)%sides;indices.push(bottom,next,i);const a=(levels.length-1)*sides+i,b=(levels.length-1)*sides+next;indices.push(top,a,b);}
  for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);
  const faceted=geometry.toNonIndexed();faceted.computeVertexNormals();geometry.dispose();return faceted;
}

function batch(group:T.Group) {
  group.updateWorldMatrix(true,true);const inverse=group.matrixWorld.clone().invert(),batches=new Map<T.Material,T.BufferGeometry[]>();
  group.traverse(node=>{if(!(node instanceof T.Mesh))return;const g=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();g.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,node.matrixWorld));
    const material=node.material as T.Material;if(!(material as T.MeshStandardMaterial).map)g.deleteAttribute('uv');if(!batches.has(material))batches.set(material,[]);batches.get(material)!.push(g);
  });
  group.clear();for(const [material,parts]of batches){const m=new T.Mesh(mergeGeometries(parts)!,material);m.name=material.name;m.receiveShadow=true;group.add(m);parts.forEach(g=>g.dispose());}
}

export function createFloatingRock(kind:FloatingRockKind):T.Group {
  const cached=rocks.get(kind);if(cached)return cached.clone(true);
  const root=new T.Group();root.name=`floating-rock-${kind}`;
  const [width,height,depth,seed,lean]=kind==='a'?[2.65,4.4,2.15,7,.12]:kind==='b'?[2.7,3.1,1.85,19,.55]:[2.3,1.85,1.8,37,-.16];
  const core=add(root,crag(width,height,depth,seed,12,lean,kind==='c'),stone);core.name=`floating-rock-${kind}-core`;
  const shelves=new T.Group();shelves.name=`floating-rock-${kind}-shelves`;root.add(shelves);
  for(let i=0;i<(kind==='a'?9:kind==='b'?7:5);i++){
    const a=i*2.4+.3,y=-.22-(i%4)*height*.17,w=width*(.40+(i%3)*.06),h=height*(.19+(i%2)*.04);
    const m=add(shelves,crag(w,h,depth*.55,seed+i*7,7,.08,true),stone);m.position.set(Math.cos(a)*width*.29,y,Math.sin(a)*depth*.27);m.rotation.set(noise(i)*.10,noise(i+8)*.3,noise(i+5)*.10);
  }
  core.updateMatrixWorld(true);const ray=new T.Raycaster();
  for(const x of [-.32,.26]){
    const points:T.Vector3[]=[];
    for(let i=0;i<7;i++){const y=-height*(.12+i*.10);ray.set(new T.Vector3(x+noise(i+seed)*.06,y,depth*2),new T.Vector3(0,0,-1));const hit=ray.intersectObject(core)[0];if(hit)points.push(hit.point.add(new T.Vector3(0,0,.006)));}
    if(points.length>2)add(shelves,new T.TubeGeometry(new T.CatmullRomCurve3(points),12,.008,3,false),stone,'#8d897b');
  }
  batch(shelves);
  const growth=new T.Group();growth.name=`floating-rock-${kind}-growth`;root.add(growth);
  const cover=createCourtyardPlant('groundcover');cover.position.set(-.12,.015,0);cover.scale.setScalar(.60);growth.add(cover);
  const a=.45,ivy=createCourtyardPlant('trailing-ivy');ivy.position.set(Math.sin(a)*width*.36,-.03,Math.cos(a)*depth*.40);ivy.rotation.y=a;ivy.scale.setScalar(kind==='c'?.42:.58);growth.add(ivy);
  batch(growth);root.userData.kind=kind;rocks.set(kind,root);return root.clone(true);
}

function crown(parent:T.Group,geometry:T.BufferGeometry) {
  const p=geometry.attributes.position,positions:number[]=[],colors:number[]=[];
  for(let i=0;i<p.count;i+=3){
    if([0,1,2].some(j=>p.getY(i+j)<-.10))continue;
    for(let j=0;j<3;j++){positions.push(p.getX(i+j),p.getY(i+j)+.018,p.getZ(i+j));const shade=.85+noise(i+j)*.05;const c=new T.Color('#819746').multiplyScalar(shade);colors.push(c.r,c.g,c.b);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();add(parent,g,green);
}

export function createDistantIsland(kind:DistantIslandKind):T.Group {
  const cached=islands.get(kind);if(cached)return cached.clone(true);
  const root=new T.Group();root.name=`distant-island-${kind}`;const seed=kind==='grass'?51:kind==='grove'?67:83;
  const core=crag(kind==='ridge'?3.1:2,1.35,kind==='ridge'?1.25:1.65,seed,9,.08);
  add(root,core,stone);crown(root,core);
  const ledges=new T.Group();root.add(ledges);
  for(let i=0;i<4;i++){
    const a=i*2.4,mesh=add(ledges,crag(.67,.48,.55,seed+i*5,6,0,true),stone);mesh.position.set(Math.cos(a)*(kind==='ridge'?1.15:.65),-.18-(i%2)*.38,Math.sin(a)*.48);
  }
  if(kind==='ridge')for(const x of [-.8,.85]){const lobe=add(ledges,crag(1.25,1,.95,seed+x*17,7),stone);lobe.position.set(x,-.38,0);}
  for(let i=0;i<5;i++){
    const patch=add(root,new T.IcosahedronGeometry(1,0),green,i%2?'#8c9e49':'#687f40');patch.scale.set(.20,.035,.17);patch.position.set(noise(i+seed)*(kind==='ridge'?1.1:.6),.015,noise(i+seed+5)*.4);
  }
  if(kind==='grove'){
    const tree=new T.Group();tree.name='distant-wind-tree';root.add(tree);
    for(const points of [
      [[0,0,0],[-.08,.25,0],[.08,.50,.02],[.12,.72,0]],
      [[-.04,.32,0],[-.28,.48,.03],[-.37,.65,.03]],
      [[.04,.47,0],[.27,.54,-.02],[.39,.68,-.02]],
    ])add(tree,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3().fromArray(p))),6,.036,4,false),bark,'#96764f');
    for(const [x,y,z,s]of [[-.35,.67,.04,.33],[.38,.71,-.02,.37],[.10,.87,0,.43],[-.10,.77,.22,.29],[.25,.80,-.20,.28]]){
      const canopy=add(tree,new T.IcosahedronGeometry(1,1),green,x<0?'#748d42':'#899b47');canopy.scale.set(s,s*.32,s*.65);canopy.position.set(x,y,z);
    }
  }
  batch(root);root.userData.kind=kind;islands.set(kind,root);return root.clone(true);
}
