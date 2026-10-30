import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let template:T.Group|undefined;

export function createLeafEmblemStele():T.Group {
  if(template)return template.clone(true);
  const root=new T.Group();root.name='leaf-emblem-stele';
  const group=(name:string)=>{const g=new T.Group();g.name=name;root.add(g);return g;};
  const main=group('stele-main'),large=group('stele-large-fragment'),small=group('stele-small-fragment');
  const material=(name:string,color:string,roughness=.94,metalness=0)=>{const m=new T.MeshStandardMaterial({color,roughness,metalness,vertexColors:true});m.name=`stele-${name}`;return m;};
  const stone=material('limestone','#ffffff'),fracture=material('fracture','#96988b'),jade=material('jade','#3b7d69',.86);
  const gold=material('aged-gold','#b08c4d',.68,.35),dark=material('deep-carving','#706d59'),moss=material('moss','#768d3f');
  const noise=(n:number)=>Math.sin(n*12.73+7.4)*Math.cos(n*27.19+3.1),pixels=new Uint8Array(128*128*4);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const grain=noise(x+y*128)*5+Math.sin(x*.19+Math.sin(y*.13))*3,pore=noise(x*19+y*31)>.89?-16:0;
    pixels.set([213+grain+pore,202+grain+pore,179+grain+pore,255],(y*128+x)*4);
  }
  const texture=new T.DataTexture(pixels,128,128);texture.name='stele-weathered-limestone';texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;stone.map=texture;
  const add=(parent:T.Group,geometry:T.BufferGeometry,surface:T.Material,x=0,y=0,z=0)=>{const m=new T.Mesh(geometry,surface);m.position.set(x,y,z);parent.add(m);return m;};
  const outline=(points:number[][])=>new T.Shape(points.map(([x,y])=>new T.Vector2(x,y)));
  const plate=(parent:T.Group,shape:T.Shape,depth:number,bevel:number,surface:T.Material,z=0)=>
    add(parent,new T.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,curveSegments:8,steps:1}).translate(0,0,-depth/2),surface,0,0,z);
  const tube=(parent:T.Group,points:number[][],radius:number,surface:T.Material,segments=18)=>add(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(([x,y,z])=>new T.Vector3(x,y,z))),segments,radius,4,false),surface);
  const contour=()=>outline([[-.68,.18],[.68,.18],[.72,1.30],[.65,1.62],[.45,1.66],[.39,1.84],[.27,1.93],[.32,2.11],[.10,2.32],[-.18,2.16],[-.37,1.96],[-.63,1.79],[-.74,1.26]]);
  const body=plate(main,contour(),.26,.025,stone,-.03),g=body.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
  const parts=[{positions:[] as number[],uvs:[] as number[]},{positions:[] as number[],uvs:[] as number[]}];
  for(let i=0;i<p.count;i+=3){
    const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,y=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3;
    const part=parts[x>.25&&y>1.48&&y<2.15&&Math.abs(n.getZ(i))<.95?1:0];
    for(let j=0;j<3;j++){part.positions.push(p.getX(i+j),p.getY(i+j),p.getZ(i+j));part.uvs.push(uv.getX(i+j),uv.getY(i+j));}
  }
  main.remove(body);g.dispose();parts.forEach((part,i)=>{const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(part.positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(part.uvs,2));geometry.computeVertexNormals();add(main,geometry,i?fracture:stone,0,0,-.03);});

  const center=new T.Shape();center.moveTo(0,.43);center.bezierCurveTo(-.025,.97,-.17,1.30,-.16,1.53);center.bezierCurveTo(-.12,1.70,-.07,1.79,0,1.96);center.bezierCurveTo(.07,1.79,.12,1.70,.16,1.53);center.bezierCurveTo(.17,1.30,.025,.97,0,.43);
  const leaves=[center];
  for(const sign of [-1,1]){
    const leaf=new T.Shape();leaf.moveTo(sign*.04,.43);leaf.bezierCurveTo(sign*.14,.80,sign*.18,1.02,sign*.42,1.09);leaf.bezierCurveTo(sign*.52,1.14,sign*.58,1.05,sign*.59,1.00);leaf.bezierCurveTo(sign*.75,1.20,sign*.70,1.58,sign*.48,1.53);leaf.bezierCurveTo(sign*.18,1.49,sign*.10,.93,sign*.04,.43);leaves.push(leaf);
  }
  const face=contour();leaves.forEach(leaf=>face.holes.push(new T.Path(leaf.getPoints(24))));
  for(const sign of [-1,1]){
    const curve=new T.CatmullRomCurve3([[.44,.59],[.43,.43],[.29,.37],[.21,.42],[.23,.50],[.29,.49],[.29,.45]].map(([x,y])=>new T.Vector3(sign*x,y,0)));
    const a:number[][]=[],b:number[][]=[];
    for(let i=0;i<=36;i++){const p=curve.getPoint(i/36),t=curve.getTangent(i/36),offset=new T.Vector2(-t.y,t.x).normalize().multiplyScalar(.020);a.push([p.x+offset.x,p.y+offset.y]);b.push([p.x-offset.x,p.y-offset.y]);}
    face.holes.push(new T.Path([...a,...b.reverse()].map(([x,y])=>new T.Vector2(x,y))));
    tube(main,curve.getPoints(36).map(p=>[p.x,p.y,.111]),.008,dark,36);
  }
  // A pierced front layer over a solid backing creates real recessed leaf and wind carving.
  plate(main,face,.060,.006,stone,.135);
  leaves.forEach(leaf=>{
    plate(main,leaf,.018,.003,jade,.125);
    const points=leaf.getPoints(16).map(p=>[p.x,p.y,.153]);tube(main,points,.0045,gold,points.length);
  });
  tube(main,[[0,.49,.145],[.035,1.03,.145],[-.02,1.49,.145],[0,1.91,.145]],.008,gold,36);
  for(const sign of [-1,1]){
    tube(main,[[sign*.04,.46,.145],[sign*.13,.94,.145],[sign*.32,1.33,.145],[sign*.60,1.30,.145]],.0065,gold,28);
    for(const y of [1.23,1.43,1.62])tube(main,[[0,y,.145],[sign*.085,y+.09,.145]],.004,gold,4);
  }
  plate(main,outline([[-.76,.04],[.76,.04],[.76,.16],[-.76,.16]]),.66,.030,stone,-.02);
  const cracks=[
    [[-.61,.33],[ -.55,.48],[-.61,.65]],[[.59,.39],[.48,.56],[.53,.70]],
    [[-.59,1.72],[-.43,1.65],[-.38,1.73]],[[.02,2.21],[-.07,2.11],[-.03,2.04]],
  ];
  for(const points of cracks)for(const side of [-1,1])tube(main,points.map(([x,y])=>[x,y,side>0?.173:-.188]),.004,dark,8);

  const missing=[[.65,1.62],[.76,1.78],[.58,2.06],[.32,2.11],[.27,1.93],[.39,1.84],[.45,1.66]].map(([x,y])=>[x-.52,y-1.87]);
  plate(large,outline(missing),.26,.015,fracture);
  plate(large,outline(missing.map(([x,y])=>[x*.94,y*.94])),.018,.008,stone,.145);
  plate(large,outline([[-.115,-.031],[0,.169],[.05,.141],[-.065,-.059]]),.009,.002,jade,.164);
  tube(large,[[-.09,-.04,.173],[-.03,.06,.173],[.025,.15,.173]],.005,gold,12);
  large.position.set(.99,0,.19);large.rotation.set(-.75,.15,-.35);
  const wedge=outline([[-.17,-.10],[.19,-.08],[.12,.15],[-.09,.20]]);
  plate(small,wedge,.20,.012,fracture);plate(small,wedge,.014,.006,stone,.112);small.position.set(-.81,0,.30);small.rotation.set(-.55,.3,.1);
  for(const fragment of [large,small]){fragment.updateMatrixWorld(true);fragment.position.y-=new T.Box3().setFromObject(fragment).min.y;}
  for(const [x,y,z,size]of [[-.66,.045,.27,.13],[.64,.055,.31,.12],[-.63,.35,.13,.08],[-.53,1.77,.13,.065],[.42,1.73,-.10,.07],[1.08,.04,.36,.085],[-.84,.025,.43,.075]]){
    const patch=add(main,new T.IcosahedronGeometry(size,0),moss,x,y,z);patch.scale.set(1,.28,.75);
    for(let i=0;i<3;i++){
      const leaf=plate(main,outline([[0,0],[-.035,.035],[0,.085],[.035,.035]]),.006,0,moss);
      leaf.position.set(x+(i-1)*size*.5,y+.013,z+.015);leaf.rotation.set(-Math.PI/3,0,(i-1)*.6);
    }
  }

  for(const parent of [main,large,small]){
    parent.updateMatrixWorld(true);const inverse=parent.matrixWorld.clone().invert(),batches=new Map<T.Material,T.BufferGeometry[]>();
    parent.traverse(node=>{if(!(node instanceof T.Mesh))return;const geometry=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,node.matrixWorld));
      const p=geometry.attributes.position,colors:number[]=[];for(let i=0;i<p.count;i++){const shade=.95+noise(Math.round(p.getX(i)*23)+Math.round(p.getY(i)*31)+Math.round(p.getZ(i)*29))*.045;colors.push(shade,shade,shade);}geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
      const surface=node.material as T.Material;if(!batches.has(surface))batches.set(surface,[]);batches.get(surface)!.push(geometry);
    });
    parent.clear();for(const [surface,parts]of batches){if(!(surface as T.MeshStandardMaterial).map)parts.forEach(g=>g.deleteAttribute('uv'));const m=add(parent,mergeGeometries(parts)!,surface);m.name=surface.name;m.castShadow=surface!==moss;m.receiveShadow=true;parts.forEach(g=>g.dispose());}
  }
  template=root;return root.clone(true);
}
