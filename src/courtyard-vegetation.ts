import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type CourtyardPlantKind='groundcover'|'wildflowers'|'fern'|'wind-grass'|'trailing-ivy'|'moss';
const plants=new Map<CourtyardPlantKind,T.Group>();
let template:T.Group|undefined;
const surface=(name:string)=>{const m=new T.MeshStandardMaterial({color:'#ffffff',roughness:.93,vertexColors:true});m.name=`courtyard-${name}`;return m;};
const foliage=surface('foliage'),petals=surface('white-petals'),straw=surface('seed-heads'),moss=surface('moss');
const add=(parent:T.Group,geometry:T.BufferGeometry,material:T.Material,color:string)=>{
  const p=geometry.attributes.position,c=new T.Color(color),colors:number[]=[];
  for(let i=0;i<p.count;i++){const shade=.96+.04*Math.sin(p.getX(i)*17+p.getY(i)*9+p.getZ(i)*11);colors.push(c.r*shade,c.g*shade,c.b*shade);}
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));const mesh=new T.Mesh(geometry,material);parent.add(mesh);return mesh;
};
const tube=(parent:T.Group,points:number[][],radius:number,color:string,material=foliage,segments=6)=>
  add(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3().fromArray(p))),segments,radius,3,false),material,color);

// A folded, closed leaf keeps its underside readable without transparent foliage cards.
function leafGeometry(length:number,width:number,bend:number,rows=3) {
  const p:number[]=[],indices:number[]=[];
  const stride=(rows+1)*3;
  for(let side=0;side<2;side++)for(let row=0;row<=rows;row++)for(let col=0;col<3;col++){
    const u=row/rows,v=col-1,w=Math.sin(Math.PI*u),thickness=side?-.004:.004;
    p.push(u*length,bend*Math.sin(u*Math.PI*.8)+w*(.035*(1-v*v)+thickness),v*width*w);
  }
  for(let side=0;side<2;side++)for(let row=0;row<rows;row++)for(let col=0;col<2;col++){
    const a=side*stride+row*3+col;indices.push(...(side?[a,a+3,a+1,a+1,a+3,a+4]:[a,a+1,a+3,a+1,a+4,a+3]));
  }
  for(let row=0;row<rows;row++)for(const col of [0,2]){const a=row*3+col,b=a+3;indices.push(...(col?[a,a+stride,b,b,a+stride,b+stride]:[a,b,a+stride,b,b+stride,a+stride]));}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

function batch(parent:T.Group) {
  parent.updateWorldMatrix(true,true);const inverse=parent.matrixWorld.clone().invert(),batches=new Map<T.Material,T.BufferGeometry[]>(),originals=new Set<T.BufferGeometry>();
  parent.traverse(node=>{if(!(node instanceof T.Mesh))return;const g=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();
    if(parent.name.startsWith('courtyard-vegetation-')){
      const plant=node.parent!,kind=plant.name.replace('courtyard-plant-',''),p=g.attributes.position,wind:number[]=[];
      const amplitude=kind==='moss'?0:kind==='wind-grass'?.095:kind==='wildflowers'?.06:kind==='fern'?.045:.025;
      for(let i=0;i<p.count;i++){
        const weight=T.MathUtils.clamp(kind==='trailing-ivy'?-p.getY(i)/1.6:(p.getY(i)-.04)/.8,0,1);
        wind.push(weight*amplitude*plant.scale.x,plant.position.x*.15+plant.position.z*.11);
      }
      g.setAttribute('aAmbientWind',new T.Float32BufferAttribute(wind,2));
    }
    g.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,node.matrixWorld));g.deleteAttribute('uv');
    const material=node.material as T.Material;if(!batches.has(material))batches.set(material,[]);batches.get(material)!.push(g);originals.add(node.geometry);
  });
  parent.clear();for(const [material,parts]of batches){const mesh=new T.Mesh(mergeGeometries(parts)!,material);mesh.name=material.name;mesh.castShadow=false;mesh.receiveShadow=true;parent.add(mesh);parts.forEach(g=>g.dispose());}
  return originals;
}

export function createCourtyardPlant(kind:CourtyardPlantKind):T.Group {
  const cached=plants.get(kind);if(cached)return cached.clone(true);
  const root=new T.Group();root.name=`courtyard-plant-${kind}`;
  const leaf=(parent:T.Group,x:number,y:number,z:number,length:number,width:number,angle:number,bend=.14,color='#819b42',rows=3)=>{
    const mesh=add(parent,leafGeometry(length,width,bend,rows),foliage,color);mesh.position.set(x,y,z);mesh.rotation.y=angle;return mesh;
  };
  if(kind==='groundcover') {
    for(let i=0;i<12;i++){
      const a=i*2.4,r=i<7?.055:.18,y=i<7?.12:.025,length=i<7?.61:.67;
      const x=Math.cos(a)*r,z=Math.sin(a)*r;
      leaf(root,x,y,z,length,.24,-a,.22,i%3?'#789343':'#4f7136',4);
      if(i<7)tube(root,[[0,.01,0],[x*.6,y*.6,z*.6],[x,y,z]],.012,'#628039',foliage,3);
    }
  }else if(kind==='wildflowers') {
    for(let i=0;i<8;i++){const a=i*2.4;leaf(root,Math.cos(a)*.06,.015,Math.sin(a)*.06,.39,.15,-a,.12,i%2?'#7b9b40':'#637f34');}
    for(let i=0;i<4;i++){
      const a=i*2.4,x=Math.cos(a)*.32,z=Math.sin(a)*.25,y=.42+(i%3)*.13;
      tube(root,[[x*.6,.04,z*.6],[x,y*.6,z],[x+.04,y,z]],.009,'#6d8b3b');
      const bloom=new T.Group();bloom.position.set(x+.04,y,z);bloom.rotation.set(.15,0,(i-2)*.13);root.add(bloom);
      for(let j=0;j<5;j++){const angle=j*Math.PI*2/5;const p=add(bloom,new T.IcosahedronGeometry(1,0),petals,'#fff6df');p.scale.set(.095,.014,.05);p.position.set(Math.cos(angle)*.085,0,Math.sin(angle)*.085);p.rotation.y=-angle;}
      const center=add(bloom,new T.IcosahedronGeometry(.043,0),straw,'#d8ad50');center.scale.y=.5;center.position.y=.018;
    }
  }else if(kind==='fern') {
    for(let i=0;i<5;i++){
      const frond=new T.Group();frond.rotation.y=i*Math.PI*2/5+.2;root.add(frond);
      const spine=new T.CatmullRomCurve3([[0,.02,0],[.26,.48,0],[.55,.61,0],[.88,.47,0]].map(p=>new T.Vector3().fromArray(p)));
      tube(frond,spine.getPoints(8).map(p=>p.toArray()),.009,'#a0b45b',foliage,8);
      for(let j=1;j<=5;j++)for(const side of [-1,1]){
        const u=j/6,p=spine.getPoint(u),length=.28*(1-u)+.075;
        leaf(frond,p.x,p.y,side*.008,length,.06,side*1.25-.15,.04,j%2?'#8aab46':'#68883c',2);
      }
      leaf(frond,.79,.53,0,.15,.055,0,-.055,'#9ab653');
    }
  }else if(kind==='wind-grass') {
    for(let i=0;i<12;i++){
      const a=i*2.4,length=.55+(i%5)*.13,points:number[]=[],indices:number[]=[];
      for(let row=0;row<=3;row++){
        const u=row/3,w=.023*(1-u),x=Math.cos(a)*(.07+u*u*.28)+u*u*.21,y=Math.sin(u*Math.PI*.43)*length,z=Math.sin(a)*(.07+u*u*.28);
        points.push(x-w,y,z,x,y+.014*Math.sin(Math.PI*u),z+.012,x+w,y,z);
        if(row<3)for(let col=0;col<2;col++){const n=row*3+col;indices.push(n,n+3,n+1,n+1,n+3,n+4,n,n+1,n+3,n+1,n+4,n+3);}
      }
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.setIndex(indices);const faces=g.toNonIndexed();faces.computeVertexNormals();g.dispose();add(root,faces,foliage,i%3?'#8b9c4c':'#b2b269');
    }
    for(let i=0;i<4;i++){
      const x=(i-1.5)*.08,z=Math.sin(i*2)*.12,height=.97+(i%2)*.15;
      tube(root,[[x,0,z],[x+.10,height*.7,z],[x+.30,height,z]],.006,'#c5b675',straw,8);
      const tuft=add(root,new T.IcosahedronGeometry(.055,0),straw,'#dfcea0');tuft.position.set(x+.25,height-.06,z);tuft.scale.set(2.2,.6,.6);tuft.rotation.z=.7;
    }
  }else if(kind==='trailing-ivy') {
    for(let i=0;i<3;i++){
      const x=(i-1)*.26,length=1.1+(i%2)*.5;
      tube(root,[[x,0,-.15],[x+.05,-.25,.03],[x-.04,-length*.65,.10],[x+.06,-length,.17]],.009,'#75834b',foliage,12);
      for(let j=0;j<7;j++){
        const side=j%2?1:-1,y=-j*length/7;
        const m=leaf(root,x+side*.025,y,.05+j*.018,.24-(j/7)*.08,.12,0,.025,j%3?'#7b9843':'#5f7f3b',2);m.rotation.set(.45,0,side*1.25-.8);
      }
    }
    for(let i=0;i<5;i++)leaf(root,(i-2)*.15,.015,-.12,.34,.14,i*2.4,.10);
  }else {
    for(let i=0;i<9;i++){
      const a=i*2.4,r=i?.16+(i%3)*.10:0,patch=add(root,new T.IcosahedronGeometry(1,0),moss,i%3?'#7c8e3e':'#a1aa4b');
      patch.position.set(Math.cos(a)*r,.018,Math.sin(a)*r*.7);patch.scale.set(.22,.035,.17);
    }
  }
  const originals=batch(root);originals.forEach(g=>g.dispose());plants.set(kind,root);return root.clone(true);
}

export function createCourtyardVegetation():T.Group {
  if(template)return template.clone(true);
  const root=new T.Group();root.name='courtyard-vegetation';
  const zones=['rear','front','left','right'].map(name=>{const g=new T.Group();g.name=`courtyard-vegetation-${name}`;root.add(g);return g;});
  const placements:{kind:CourtyardPlantKind;x:number;y:number;z:number;scale:number}[]=[];
  const put=(zone:number,kind:CourtyardPlantKind,x:number,z:number,scale=1,y=0,angle=0)=>{
    const plant=createCourtyardPlant(kind);plant.position.set(x,y,z);plant.scale.setScalar(scale);plant.rotation.y=angle;zones[zone].add(plant);placements.push({kind,x,y,z,scale});
  };
  // Keep a bare walking apron outside the 15-unit mosaic and a clear western dock opening.
  for(const [zone,points]of [
    [0,[[-18.5,-19.2],[-16.8,-20],[-13.6,-20],[-9,-20],[-5.8,-17.8],[-3.8,-18.8],[-1.4,-19.6],[1,-18.6],[8,-19.7],[11,-19.6],[14,-19.5],[17.8,-19]]],
    [1,[[-17.7,18.3],[-16.2,17.5],[-13.6,18.5],[-10,19.6],[-7.7,19],[-4.4,19.5],[-1.2,19.6],[2.3,19.6],[5.5,19],[8.8,19.5],[12,19.5],[15.5,19.6],[18.5,18.6]]],
    [2,[[-19.3,-16.8],[-19.4,-13.3],[-19.2,-10.2],[-19.5,-6.9],[-19.5,-3.6],[-19.4,-.5],[-19.5,2.8],[-19,16.8]]],
    [3,[[19.3,-18.1],[18.5,-9],[19,-5.6],[19.3,-2.3],[19.3,1],[19.4,4.4],[19.3,7.7],[19.4,11.4],[19.3,16.8]]],
  ] as [number,number[][]][]){
    points.forEach(([x,z],i)=>{
      put(zone,'groundcover',x,z,1.35+(i%3)*.20,0,i*1.7);
      if(i%3===0)put(zone,'wildflowers',x+(zone===2?.35:0),z+(zone===0?.6:zone===1?-.55:0),1.12,0,i);
      if(i%4===1)put(zone,'fern',x,z,1.0,0,i*.8);
    });
  }
  for(const [zone,x,z]of [[0,-18.9,-19.6],[0,-5.5,-20],[0,14.8,-20],[1,-17.8,20],[1,-6,20],[1,7.2,20],[1,19.8,19.1],[3,20,9]])put(zone,'wind-grass',x,z,1.15,0,.25);
  for(const [x,z]of [[16.4,-14.3],[18.3,-11],[19.8,-7.3]]){put(3,'fern',x,z,.85);put(3,'moss',x+.45,z+.35,1.6,.025);}
  for(const [zone,x,z,angle]of [[0,-17,-21.25,Math.PI],[0,-7,-21.25,Math.PI],[0,13,-21.25,Math.PI],[1,-17,21.25,0],[1,-8,21.25,0],[1,3,21.25,0],[1,13,21.25,0],[2,-21.25,-12,-Math.PI/2],[2,-21.25,-2,-Math.PI/2],[3,21.25,4,Math.PI/2],[3,21.25,16,Math.PI/2]]){
    put(zone,'trailing-ivy',x,z,1.25,1.39,angle);put(zone,'groundcover',x,z,.80,1.35,angle);
  }
  for(const [zone,x,z,angle]of [[1,-14,24.5,0],[1,6,24.5,0],[1,18,24.5,0],[0,-8,-24.5,Math.PI],[0,15,-24.5,Math.PI],[3,24.5,9,Math.PI/2],[2,-24.2,-10,-Math.PI/2]])put(zone,'trailing-ivy',x,z,2.1,-.02,angle);
  for(const [zone,x,z]of [[0,-7,-19.5],[0,10,-20],[1,-17,20],[1,13,20],[3,20,-12],[3,20,1],[2,-20,-5]])put(zone,'moss',x,z,1.8,.025);
  // Zone-sized batches retain culling; low decorative foliage needs no physics or island-wide fade.
  zones.forEach(zone=>batch(zone));root.userData.placements=placements;
  template=root;return root.clone(true);
}
