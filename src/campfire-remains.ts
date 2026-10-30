import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let template:T.Group|undefined;

export function createCampfireRemains():T.Group {
  if(template)return template.clone(true);
  const root=new T.Group();root.name='campfire-remains';
  const group=(name:string)=>{const g=new T.Group();g.name=name;root.add(g);return g;};
  const stones=group('campfire-stone-ring'),ashes=group('cold-ash-bed'),helmet=group('forgotten-leaf-helmet');
  const material=(name:string,color:string,roughness=.96,metalness=0)=>{const m=new T.MeshStandardMaterial({color,roughness,metalness,vertexColors:true});m.name=`campfire-${name}`;return m;};
  const stone=material('limestone','#d9ccb0'),coal=material('charcoal','#ffffff'),wood=material('broken-wood-core','#a16c3d');
  const ash=material('cold-ash','#8d897e'),steel=material('steel','#84908b',.61,.56),bronze=material('old-bronze','#b18b48',.62,.50);
  const jade=material('jade-leaves','#337b62'),leather=material('leather-liner','#514131'),moss=material('moss','#768c3e');
  const noise=(n:number)=>Math.sin(n*12.73+7.4)*Math.cos(n*27.19+3.1);
  const pixels=new Uint8Array(128*128*4);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const u=x/128*10+.22*Math.sin(y/128*Math.PI*8),v=y/128*7+.13*Math.sin(x/128*Math.PI*10);
    const fx=u-Math.floor(u),fy=v-Math.floor(v),crack=Math.min(fx,1-fx,fy,1-fy),tile=noise(Math.floor(u)+Math.floor(v)*19);
    const shade=crack<.055?10:32+tile*12+noise(x+y*128)*3;
    pixels.set([shade+5,shade+2,shade,255],(y*128+x)*4);
  }
  const texture=new T.DataTexture(pixels,128,128);texture.name='campfire-charred-bark';texture.colorSpace=T.SRGBColorSpace;
  texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;coal.map=texture;
  const add=(parent:T.Group,geometry:T.BufferGeometry,surface:T.Material,x=0,y=0,z=0)=>{const m=new T.Mesh(geometry,surface);m.position.set(x,y,z);parent.add(m);return m;};
  const tube=(parent:T.Group,points:number[][],radius:number,surface:T.Material,segments=10)=>
    add(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(([x,y,z])=>new T.Vector3(x,y,z))),segments,radius,4,false),surface);
  const plate=(parent:T.Group,shape:T.Shape,depth:number,surface:T.Material)=>add(parent,new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.003,bevelThickness:.003,bevelSegments:1,curveSegments:5}).translate(0,0,-depth/2),surface);
  const reverse=(geometry:T.BufferGeometry)=>{const index=geometry.index!;for(let i=0;i<index.count;i+=3){const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b);}geometry.computeVertexNormals();return geometry;};

  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4,h=.37+noise(i)*.055,w=.59+noise(i+12)*.035,d=.43+noise(i+27)*.025;
    const footprint=[[-w/2+.08,-d/2],[w/2-.08,-d/2],[w/2,-d/2+.07],[w/2,d/2-.07],[w/2-.08,d/2],[-w/2+.08,d/2],[-w/2,d/2-.07],[-w/2,-d/2+.07]];
    const vertices:number[]=[],colors:number[]=[],indices:number[]=[];
    for(const [y,scale]of [[0,.82],[.045,1],[h-.06,1],[h,.83]])for(let j=0;j<8;j++){
      const x=footprint[j][0]*scale+noise(i*17+j)*.016,z=footprint[j][1]*scale;
      vertices.push(x,y+(y>0?noise(i*19+j)*.014:0),z);const soot=T.MathUtils.smoothstep(z,-.045,.13)*(1-.6*T.MathUtils.smoothstep(y,h*.65,h+.02));
      const shade=1-soot*.95;colors.push(shade,shade,shade);
    }
    for(let layer=0;layer<3;layer++)for(let j=0;j<8;j++){const a=layer*8+j,b=layer*8+(j+1)%8;indices.push(a,a+8,b,b,a+8,b+8);}
    for(const side of [0,1]){const center=vertices.length/3;vertices.push(0,side?h:0,0);colors.push(1,1,1);for(let j=0;j<8;j++){const a=(side?24:0)+j,b=(side?24:0)+(j+1)%8;indices.push(center,...(side?[b,a]:[a,b]));}}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const facets=geometry.toNonIndexed();facets.computeVertexNormals();geometry.dispose();
    const rock=add(stones,facets,stone,Math.sin(angle)*.88,.014,Math.cos(angle)*.88);rock.rotation.y=angle+Math.PI;
    const x=Math.sin(angle)*1.05,z=Math.cos(angle)*1.05;
    for(let j=0;j<2;j++){const patch=add(stones,new T.IcosahedronGeometry(.105,0),moss,x+noise(i+j)*.08,.033,z+noise(i+j+20)*.07);patch.scale.set(1,.22,.8);}
    const crack=tube(stones,[[-.16,h*.65,-d/2-.006],[-.09,h*.49,-d/2-.007],[-.12,h*.28,-d/2-.008]],.004,ash,4);crack.position.copy(rock.position);crack.rotation.y=rock.rotation.y;
  }
  const bed=new T.Shape();for(let i=0;i<32;i++){const a=i/32*Math.PI*2,r=.77+noise(i)*.025;const x=Math.cos(a)*r,y=Math.sin(a)*r;if(i===0)bed.moveTo(x,y);else bed.lineTo(x,y);}bed.closePath();
  add(ashes,new T.ExtrudeGeometry(bed,{depth:.018,bevelEnabled:false}).rotateX(-Math.PI/2),ash,0,.013,0);
  for(let i=0;i<26;i++){
    const a=i*2.399,r=.68*Math.sqrt((i+.5)/26),fragment=add(ashes,new T.IcosahedronGeometry(.025+(i%4)*.007,0),i%3?coal:ash,Math.cos(a)*r,.045,Math.sin(a)*r);fragment.scale.set(1,.6,.8);fragment.rotation.set(i*.7,i*.9,.2);
  }
  for(const [i,length,angle,y]of [[0,1.34,-.56,.18],[1,1.24,.63,.19],[2,1.43,.10,.37]]){
    const log=group(`charred-log-${i}`);log.position.y=y;log.rotation.set(0,angle,Math.PI/2);
    const radius=.12+i*.008,geometry=new T.CylinderGeometry(radius*.88,radius,length,12,7,false),p=geometry.attributes.position;
    for(let j=0;j<p.count;j++){const x=p.getX(j),z=p.getZ(j),along=p.getY(j),rough=1+.065*Math.sin(Math.atan2(z,x)*6+along*7+i);p.setXYZ(j,x*rough,along+Math.sign(along)*.018*noise(j%13+i*11),z*rough);}
    geometry.computeVertexNormals();add(log,geometry,coal);
    for(const side of [-1,1]){
      const disk=new T.Shape();for(let j=0;j<12;j++){const a=j/12*Math.PI*2,r=radius*(.68+.13*noise(j+i*17));const x=Math.cos(a)*r,z=Math.sin(a)*r;if(j===0)disk.moveTo(x,z);else disk.lineTo(x,z);}disk.closePath();
      const end=plate(log,disk,.023,wood);end.rotation.x=-side*Math.PI/2;end.position.y=side*(length/2+.015);
      for(let j=0;j<4;j++){const a=j*1.7+i;tube(log,[[Math.cos(a)*radius*.22,side*(length/2+.031),Math.sin(a)*radius*.22],[Math.cos(a)*radius*.65,side*(length/2+.034),Math.sin(a)*radius*.65]],.005,coal,2);}
    }
    for(let j=0;j<7;j++){const z=noise(j+i*7)*radius*.65,flake=add(log,new T.IcosahedronGeometry(.020+j%3*.004,0),ash,Math.sqrt(radius*radius-z*z)+.006,noise(j*7+i*13)*length*.43,z);flake.scale.set(.18,.7+j%3*.2,1.1);}
  }

  // Curved extruded visor holes open into a true shell; the neck is never capped.
  const visor=new T.Shape();visor.moveTo(-.32,-.175);
  for(let i=1;i<=16;i++)visor.lineTo(-.32+i*.04,-.175);
  visor.lineTo(.32,.175);for(let i=1;i<=16;i++)visor.lineTo(.32-i*.04,.175);visor.closePath();
  for(const x of [-.225,-.075,.075,.225]){
    const hole=new T.Path();hole.moveTo(x-.025,-.11);hole.lineTo(x-.025,.105);hole.quadraticCurveTo(x,.13,x+.025,.105);hole.lineTo(x+.025,-.11);hole.quadraticCurveTo(x,-.13,x-.025,-.11);visor.holes.push(hole);
  }
  const mask=new T.ExtrudeGeometry(visor,{depth:.035,bevelEnabled:false,curveSegments:5}),maskPositions=mask.attributes.position;
  for(let i=0;i<maskPositions.count;i++){const x=maskPositions.getX(i),y=maskPositions.getY(i)+.215,r=.285+(.39-y)*.057+maskPositions.getZ(i),a=x/.32;maskPositions.setXYZ(i,Math.sin(a)*r,y,Math.cos(a)*r);}mask.computeVertexNormals();add(helmet,mask,steel);
  const rear=new T.CylinderGeometry(.32,.34,.35,32,1,true,1,Math.PI*2-2);add(helmet,rear,steel,0,.215,0);
  const inside=add(helmet,reverse(new T.CylinderGeometry(.285,.305,.35,32,1,true,1,Math.PI*2-2)),steel,0,.215,0);inside.userData.interior=true;
  for(const inner of [false,true]){
    const radius=inner?.285:.32,profile=Array.from({length:13},(_,j)=>{const a=j/12*Math.PI/2;return new T.Vector2(radius*Math.cos(a),.39+radius*Math.sin(a));});
    // Match the visor and rear-shell angular samples so the crown seam has no cracks.
    for(const [segments,start,span]of [[16,-1,2],[32,1,Math.PI*2-2]]){
      const dome=new T.LatheGeometry(profile,segments,start,span),positions=dome.attributes.position;
      for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),dent=Math.exp(-((x-.16)**2+(y-.57)**2+(z-.16)**2)/.006)*.018;positions.setXYZ(i,x-dent*.4,y-dent,z-dent*.6);}
      dome.computeVertexNormals();const mesh=add(helmet,inner?reverse(dome):dome,steel);mesh.userData.interior=inner;
    }
  }
  add(helmet,new T.RingGeometry(.305,.34,32).rotateX(Math.PI/2),steel,0,.04,0);
  for(const [y,outer,inner,h]of [[.045,.352,.305,.035],[.385,.334,.315,.032]])add(helmet,new T.LatheGeometry([[inner,y-h/2],[outer,y-h/2],[outer,y+h/2],[inner,y+h/2],[inner,y-h/2]].map(([r,y])=>new T.Vector2(r,y)),32),bronze);
  add(helmet,new T.LatheGeometry([[.301,.085],[.301,.145],[.289,.145],[.289,.085],[.301,.085]].map(([r,y])=>new T.Vector2(r,y)),24,1,Math.PI*2-2),leather);
  add(helmet,new T.LatheGeometry([[.303,.055],[.303,.080],[.292,.080],[.292,.055],[.303,.055]].map(([r,y])=>new T.Vector2(r,y)),32),leather);
  const frontZ=(x:number,y:number)=>Math.sqrt(Math.max(.001,.32**2-Math.max(0,y-.39)**2-x*x));
  for(let j=0;j<12;j++){const a=j*Math.PI/6;const rivet=add(helmet,new T.SphereGeometry(.015,8,5),bronze,Math.sin(a)*.338,.385,Math.cos(a)*.338);rivet.scale.y=.85;}
  for(const side of [-1,1])add(helmet,new T.CylinderGeometry(.032,.032,.020,10).rotateZ(Math.PI/2),bronze,side*.329,.29,0);
  for(const [height,angle,x]of [[.23,0,0],[.16,.62,-.015],[.16,-.62,.015]]){
    const shape=new T.Shape();shape.moveTo(0,0);shape.bezierCurveTo(-.06,height*.25,-.065,height*.62,0,height);shape.bezierCurveTo(.065,height*.62,.06,height*.25,0,0);
    const leaf=plate(helmet,shape,.013,jade);leaf.geometry.rotateZ(angle).translate(x,.425,0);const p=leaf.geometry.attributes.position;
    for(let i=0;i<p.count;i++)p.setZ(i,p.getZ(i)+frontZ(p.getX(i),p.getY(i))+.012);leaf.geometry.computeVertexNormals();leaf.updateMatrixWorld(true);
    const ray=new T.Raycaster();
    const vein=Array.from({length:7},(_,j)=>{const p=new T.Vector3(0,.02+j/6*(height-.045),0).applyAxisAngle(new T.Vector3(0,0,1),angle),vx=p.x+x,vy=p.y+.425;ray.set(new T.Vector3(vx,vy,1),new T.Vector3(0,0,-1));return[vx,vy,(ray.intersectObject(leaf,false)[0]?.point.z??frontZ(vx,vy))+.006];});tube(helmet,vein,.004,bronze,12);
  }
  for(const [x,y]of [[.13,.54],[-.12,.47]])tube(helmet,[[x,y,frontZ(x,y)+.003],[x+.04,y+.018,frontZ(x+.04,y+.018)+.003]],.0025,bronze,2);
  helmet.rotation.set(.16,-.28,-.24);helmet.position.set(1.02,0,.66);helmet.updateMatrixWorld(true);helmet.position.y-=new T.Box3().setFromObject(helmet).min.y;

  for(const parent of [stones,ashes,helmet,...root.children.filter(g=>g.name.startsWith('charred-log-'))] as T.Group[]){
    parent.updateMatrixWorld(true);const inverse=parent.matrixWorld.clone().invert(),batches=new Map<T.Material,T.BufferGeometry[]>();
    parent.traverse(node=>{if(!(node instanceof T.Mesh))return;const geometry=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone(),existing=geometry.attributes.color;geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,node.matrixWorld));
      const p=geometry.attributes.position,colors:number[]=[];for(let i=0;i<p.count;i++){const shade=(node.userData.interior?.62:.96)+noise(Math.round(p.getX(i)*31)+Math.round(p.getY(i)*37)+Math.round(p.getZ(i)*41))*.04;colors.push(shade*(existing?.getX(i)??1),shade*(existing?.getY(i)??1),shade*(existing?.getZ(i)??1));}geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
      const m=node.material as T.Material;if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push(geometry);
    });
    parent.clear();for(const [surface,parts]of batches){
      // Texture-free parts share no UV requirement; mixed primitive UVs are discarded.
      if(!(surface as T.MeshStandardMaterial).map)parts.forEach(g=>g.deleteAttribute('uv'));
      const m=add(parent,mergeGeometries(parts)!,surface);m.name=surface.name;m.castShadow=surface!==moss;m.receiveShadow=true;parts.forEach(g=>g.dispose());
    }
  }
  template=root;return root.clone(true);
}
