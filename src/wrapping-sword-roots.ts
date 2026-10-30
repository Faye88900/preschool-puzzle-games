import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let template:T.Group|undefined;

export function createWrappingSwordRoots():T.Group {
  if(template)return template.clone(true);
  const root=new T.Group();root.name='wrapping-sword-roots';
  const material=(name:string,color:string,vertexColors=false)=>{
    const surface=new T.MeshStandardMaterial({color,roughness:.92,vertexColors});surface.name=`sword-roots-${name}`;return surface;
  };
  const wood=material('wood','#e6d2ae',true),ridges=material('bark-ridges','#edddbd',true);
  const moss=material('moss','#78863d'),leaves=material('leaves','#6f9039');
  const width=256,height=512,data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const u=x/width,v=y/height,warp=u+.018*Math.sin(v*18)+.008*Math.sin(v*47+u*8);
    const grain=Math.pow(.5+.5*Math.sin(warp*Math.PI*26+Math.sin(v*8)),18);
    const broad=Math.sin(warp*Math.PI*10+Math.sin(v*13)*.6),noise=Math.sin(x*.72+y*.21)*Math.sin(y*.31-x*.15);
    const shade=239+broad*9-grain*43+noise*3;
    data.set([shade,shade-2,shade-6,255],(y*width+x)*4);
  }
  const bark=new T.DataTexture(data,width,height);bark.name='wrapping-roots-directional-bark';bark.colorSpace=T.SRGBColorSpace;
  bark.wrapS=bark.wrapT=T.RepeatWrapping;bark.magFilter=T.LinearFilter;bark.minFilter=T.LinearMipmapLinearFilter;
  bark.generateMipmaps=true;bark.needsUpdate=true;wood.map=ridges.map=bark;
  const add=(geometry:T.BufferGeometry,surface:T.Material)=>{const mesh=new T.Mesh(geometry,surface);root.add(mesh);return mesh;};

  const grow=(points:number[][],radii:number[],seed:number,segments:number,sides:number,surface:T.Material)=>{
    const curve=new T.CatmullRomCurve3(points.map(([x,y,z])=>new T.Vector3(x,y,z))),frames=curve.computeFrenetFrames(segments,false);
    const vertices:number[]=[],uvs:number[]=[],colors:number[]=[],indices:number[]=[];
    const radiusAt=(t:number)=>{
      const p=t*(radii.length-1),a=Math.min(radii.length-2,Math.floor(p)),blend=T.MathUtils.smoothstep(p-a,0,1);
      return T.MathUtils.lerp(radii[a],radii[a+1],blend);
    };
    const point=new T.Vector3(),offset=new T.Vector3(),length=curve.getLength();
    for(let i=0;i<=segments;i++) {
      const t=i/segments,center=curve.getPointAt(t),radius=radiusAt(t);
      for(let j=0;j<=sides;j++) {
        const angle=j/sides*Math.PI*2+t*1.25+seed*.23;
        const lobe=1+.13*Math.sin(angle*5+seed+t*3)+.045*Math.sin(angle*9-t*7);
        offset.copy(frames.normals[i]).multiplyScalar(Math.cos(angle)*radius*lobe);
        offset.addScaledVector(frames.binormals[i],Math.sin(angle)*radius*lobe*.73);point.copy(center).add(offset);
        vertices.push(point.x,point.y,point.z);uvs.push(j/sides,t*length*.38);
        const shade=.88+.10*Math.sin(angle*5+seed+t*3)+.025*Math.sin(t*34+seed);
        colors.push(shade,shade,shade);
        if(i<segments&&j<sides) {
          const a=i*(sides+1)+j,b=a+sides+1;
          indices.push(a,a+1,b,b,a+1,b+1);
        }
      }
    }
    for(const end of [0,1]) {
      const center=curve.getPointAt(end),index=vertices.length/3,base=end*segments*(sides+1);
      vertices.push(center.x,center.y,center.z);uvs.push(.5,end*length*.38);colors.push(.88,.88,.88);
      for(let j=0;j<sides;j++)indices.push(index,base+j+(end?0:1),base+j+(end?1:0));
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geometry.setIndex(indices);geometry.computeVertexNormals();add(geometry,surface);
    return {curve,frames,radiusAt};
  };

  const primary=[
    {points:[[-8.8,.20,-1.3],[-5.4,.8,-1.2],[-3.6,2.2,-1.25],[-2.6,4.8,-1],[-1.3,7.5,-.9],[.2,9.6,-.75],[1.3,10.25,-.2],[1.65,9.75,.55]],radii:[.045,1.0,1.4,1.28,1.0,.65,.28,.025]},
    {points:[[-10.5,.15,.4],[-7.5,.4,.4],[-5.3,1.15,.2],[-4.0,3,.15],[-2.8,5.5,.35],[-.9,8.1,-.3],[.4,9.75,-.2],[1.6,10.65,-.1],[2.4,10.1,-.25]],radii:[.03,.45,.85,.95,.80,.58,.36,.21,.025]},
    {points:[[8.7,.16,-1.1],[6.6,.7,-1.5],[4.8,1.3,-1.6],[3.6,3.9,-1.45],[3.1,6.7,-1.25],[2,8.8,-.95],[.2,9.6,-.75]],radii:[.03,.6,.85,.8,.57,.32,.35]},
  ];
  const trunks=primary.map((branch,i)=>grow(branch.points,branch.radii,i+1,64,14,wood));
  const secondary=[
    {points:[[-5.4,.7,-.9],[-5.9,.65,0],[-7.2,.32,.7],[-9.6,.1,.95]],radii:[.5,.45,.28,.02]},
    {points:[[-5.3,.7,-.6],[-4.7,.75,.1],[-4.5,.35,1],[-3.6,.1,1.3]],radii:[.55,.4,.2,.018]},
    {points:[[-5.25,.85,-1],[-2.6,.7,-1.7],[-.8,.35,-2.3],[1,.1,-2.5]],radii:[.6,.45,.2,.02]},
    {points:[[5.6,.7,-1.3],[6,.6,-.2],[7.1,.3,.3],[9.2,.1,.65]],radii:[.6,.5,.23,.018]},
    {points:[[4.7,1.2,-1.6],[5.1,.6,-2.1],[6.2,.23,-2.7],[7.9,.1,-2.8]],radii:[.5,.4,.18,.02]},
    {points:[[3.6,3.6,-1.45],[4.5,2.9,-2],[6.5,1.6,-2.3],[9.2,.1,-2.5]],radii:[.48,.42,.3,.018]},
    {points:[[.2,9.6,-.75],[.5,10.4,-.8],[1.2,10.9,-.6],[2.3,10.85,-.5],[3,10.3,-.45]],radii:[.35,.33,.24,.14,.018]},
    {points:[[0,9.4,-.5],[.45,10.1,-.15],[1,10,.35],[1.35,9.5,.76],[1.2,8.95,.70]],radii:[.4,.33,.26,.16,.025]},
  ];
  secondary.forEach((branch,i)=>grow(branch.points,branch.radii,i+5,32,10,wood));

  // Tapered raised fibers follow each trunk's twist instead of forming uniform rings.
  trunks.forEach(({curve,frames,radiusAt},index)=>{
    for(let fiber=0;fiber<4;fiber++) {
      const points:number[][]=[],radii:number[]=[];
      for(let j=0;j<=12;j++) {
        const t=.10+j/12*.79,frame=Math.round(t*64),angle=fiber*Math.PI/2+t*1.25+(index+1)*.23;
        const point=curve.getPointAt(t),radius=radiusAt(t)*.99;
        point.addScaledVector(frames.normals[frame],Math.cos(angle)*radius);
        point.addScaledVector(frames.binormals[frame],Math.sin(angle)*radius*.73);
        points.push(point.toArray());radii.push(.018+Math.sin(j/12*Math.PI)*radius*.12);
      }
      grow(points,radii,index*7+fiber,28,5,ridges);
    }
  });

  const mossGeometry=new T.SphereGeometry(1,8,5);
  root.updateMatrixWorld(true);const ray=new T.Raycaster(),barkMeshes=[...root.children];
  const patches=[[-5.1,1],[-3.8,2.8],[-2.8,4.5],[-2.0,6.3],[-.6,8.5],[.8,10.5],
    [4.8,1.6],[3.7,3.5],[3.3,6.0],[6.5,.8],[-7.5,.5],[-4.6,.4]].flatMap(([x,y])=>{
    ray.set(new T.Vector3(x,y,6),new T.Vector3(0,0,-1));const hit=ray.intersectObjects(barkMeshes,false)[0];
    return hit?[[x,y,hit.point.z+.02]]:[];
  });
  patches.forEach(([x,y,z],i)=>{
    const mesh=add(mossGeometry,moss);mesh.position.set(x,y,z);mesh.scale.set(.38+(i%3)*.12,.22+(i%2)*.12,.07);mesh.rotation.z=Math.sin(i*2.7)*.45;
  });
  const leafShape=new T.Shape();leafShape.moveTo(0,0);leafShape.bezierCurveTo(-.09,.18,-.34,.20,-.25,.36);
  leafShape.bezierCurveTo(-.15,.50,-.03,.37,0,.34);leafShape.bezierCurveTo(.03,.37,.15,.50,.25,.36);
  leafShape.bezierCurveTo(.34,.20,.09,.18,0,0);
  const leafGeometry=new T.ExtrudeGeometry(leafShape,{depth:.025,bevelEnabled:true,bevelSize:.009,bevelThickness:.009,bevelSegments:1,curveSegments:5});
  for(const [index,patch]of patches.entries()) {
    if(index===8||index===9)continue;
    for(let j=0;j<3;j++) {
      const mesh=add(leafGeometry,leaves);mesh.position.set(patch[0]+(j-1)*.20,patch[1]+.02+j*.12,patch[2]+.04);
      mesh.rotation.set(-.25,Math.sin(index*2+j)*.3,(j-1)*.72+Math.sin(index)*.3);mesh.scale.setScalar(.65+(index%3)*.15);
    }
  }

  root.updateMatrixWorld(true);
  const batches=new Map<T.Material,T.BufferGeometry[]>(),sources=new Set<T.BufferGeometry>();
  for(const child of root.children) {
    if(!(child instanceof T.Mesh))continue;
    const geometry=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();geometry.applyMatrix4(child.matrixWorld);
    const surface=child.material as T.Material;if(!batches.has(surface))batches.set(surface,[]);batches.get(surface)!.push(geometry);sources.add(child.geometry);
  }
  root.clear();
  for(const [surface,geometries]of batches) {
    const mesh=new T.Mesh(mergeGeometries(geometries)!,surface);mesh.name=surface.name;mesh.castShadow=surface!==leaves;mesh.receiveShadow=true;root.add(mesh);
    geometries.forEach(g=>g.dispose());
  }
  sources.forEach(g=>g.dispose());
  const bottom=new T.Box3().setFromObject(root).min.y;
  for(const child of root.children)if(child instanceof T.Mesh)child.geometry.translate(0,-bottom,0);
  root.userData.design='wrapping-roots-design-sheet-v1';template=root;return root.clone(true);
}
