import * as T from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { batchTreasureParts, treasureLeaf } from './treasure-details';
import { mt } from './maze-text';
import { BOSS_ISLAND_OFFSET_X, FERRY_BAY, FERRY_SEA_Y, gardenCoastX, bossCoastX } from './ferry-shore-layout';

export function createFerryCoast() {
  const root=new T.Group();root.name='ferry-coast';const time={value:0};
  const vertices:number[]=[],colors:number[]=[];
  const sections=[[-.65,.026,'#85ab5b'],[0,.020,'#c6c58a'],[.55,-.04,'#e1cb98'],[1.3,-.30,'#c8b88c'],[2.4,-.96,'#8eaaa1'],[4,-1.7,'#72a6a1']] as const;
  for(const [edge,direction,z0,z1] of [[gardenCoastX,1,-32,8],[bossCoastX,-1,-28,-7.5]] as const) {
    const count=Math.ceil((z1-z0)/.6);
    for(let i=0;i<count;i++)for(let band=0;band<sections.length-1;band++) {
      const point=(s:number,b:number)=>{const z=z0+s*(z1-z0)/count,[dx,y]=sections[b];return[edge(z)+direction*dx,y,z];};
      const a=point(i,band),b=point(i+1,band),c=point(i+1,band+1),d=point(i,band+1);
      for(const [p,j] of (direction>0?[[a,band],[b,band],[c,band+1],[a,band],[c,band+1],[d,band+1]]:[[a,band],[c,band+1],[b,band],[a,band],[d,band+1],[c,band+1]]) as [number[],number][]) {
        vertices.push(...p);const color=new T.Color(direction>0&&p[2]>-12.7&&p[2]<-7.3&&j<2?'#e1cb98':sections[j][2]);colors.push(color.r,color.g,color.b);
      }
    }
  }
  const bankGeometry=new T.BufferGeometry();bankGeometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));bankGeometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const terrain=mergeVertices(bankGeometry);bankGeometry.dispose();terrain.computeVertexNormals();
  const banks=new T.Mesh(terrain,new T.MeshStandardMaterial({vertexColors:true,roughness:1}));banks.name='ferry-sand-banks';banks.receiveShadow=true;root.add(banks);

  // Periodic wave slopes tile seamlessly; mipmaps keep distant ripples from shimmering.
  const size=128,data=new Uint8Array(size*size*4);
  const waves=[[2,1,.024,0],[-3,4,.018,1.7],[7,2,.012,2.4],[-4,9,.009,.7],[13,-7,.006,4.1],[17,11,.004,2.8]];
  for(let z=0;z<size;z++)for(let x=0;x<size;x++) {
    let dx=0,dz=0;
    for(const [kx,kz,amplitude,phase] of waves) {
      const slope=amplitude*Math.cos((kx*x+kz*z)/size*Math.PI*2+phase);
      dx-=kx*slope;dz-=kz*slope;
    }
    const i=(z*size+x)*4;data[i]=Math.round((dx*.5+.5)*255);data[i+1]=Math.round((dz*.5+.5)*255);data[i+2]=255;data[i+3]=255;
  }
  const normals=new T.DataTexture(data,size,size);normals.name='ferry-wave-slopes';
  normals.wrapS=normals.wrapT=T.RepeatWrapping;normals.magFilter=T.LinearFilter;normals.minFilter=T.LinearMipmapLinearFilter;
  normals.generateMipmaps=true;normals.needsUpdate=true;
  const waterMaterial=new T.MeshStandardMaterial({color:'#258caa',roughness:.24,metalness:0,transparent:true,opacity:.93,depthWrite:false});
  waterMaterial.name='ferry-sea-water';waterMaterial.addEventListener('dispose',()=>normals.dispose());
  waterMaterial.onBeforeCompile=shader=>{
    shader.uniforms.uSeaTime=time;
    shader.uniforms.uSeaNormals={value:normals};
    shader.uniforms.uBossOffset={value:BOSS_ISLAND_OFFSET_X};
    shader.uniforms.uBayBounds={value:new T.Vector4(FERRY_BAY.x-FERRY_BAY.width/2,FERRY_BAY.x+FERRY_BAY.width/2,FERRY_BAY.z-FERRY_BAY.depth/2,FERRY_BAY.z+FERRY_BAY.depth/2)};
    shader.vertexShader='uniform float uSeaTime;\nvarying vec3 vSeaWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec2 p=(modelMatrix*vec4(position,1.)).xz;
      transformed.y+=.045*sin(p.x*.51+p.y*.33-uSeaTime*.7)
        +.025*sin(-p.x*.26+p.y*.73-uSeaTime*.95)+.010*sin(p.x*1.12-p.y*.58-uSeaTime*1.35);
      vSeaWorld=(modelMatrix*vec4(transformed,1.)).xyz;`);
    shader.fragmentShader='uniform float uSeaTime,uBossOffset;\nuniform sampler2D uSeaNormals;\nuniform vec4 uBayBounds;\nuniform mat3 normalMatrix;\nvarying vec3 vSeaWorld;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 p=vSeaWorld.xz;
      float ga=max(0.,1.-pow((p.y+12.)/20.,2.));
      float ba=max(0.,1.-pow((p.y+15.)/13.,2.));
      float gardenX=102.5-5.8*ga*ga+.25*sin(p.y*.7)*ga;
      float bossX=127.5+uBossOffset+4.2*ba*ba+.16*sin(p.y*.9)*ba;
      float gardenDist=max(p.x-gardenX, max(-32.-p.y,p.y-8.));
      float bossDist=max(bossX-p.x,max(-28.-p.y,p.y+7.5));
      float shore=max(0.,min(gardenDist,bossDist));
      float shallow=1.-smoothstep(1.6,8.,shore);
      float a=p.x*.51+p.y*.33-uSeaTime*.7,b=-p.x*.26+p.y*.73-uSeaTime*.95,c=p.x*1.12-p.y*.58-uSeaTime*1.35;
      vec2 n1=texture2D(uSeaNormals,p*.085+vec2(-.012,.008)*uSeaTime).rg*2.-1.;
      vec2 n2=texture2D(uSeaNormals,mat2(.8,-.6,.6,.8)*p*.19+vec2(.009,-.014)*uSeaTime).rg*2.-1.;
      vec2 n3=texture2D(uSeaNormals,p*.43+vec2(-.018,-.011)*uSeaTime+n1*.13).rg*2.-1.;
      float wash=2.02+.26*sin(uSeaTime*.8+p.y*.31);
      float breakup=smoothstep(-.22,.20,n1.x+n2.y+.12*sin(p.y*2.8-uSeaTime*.5));
      float foam=(1.-smoothstep(.055,.24,abs(shore-wash+n2.x*.25)))*breakup;
      foam+=(1.-smoothstep(.03,.14,abs(shore-wash-.65+n1.y*.2)))*breakup*.22;
      float caustic=pow(max(0.,1.-abs(n2.x+n3.y)*5.),4.)*shallow*.035;
      diffuseColor.rgb=mix(vec3(.018,.16,.23),vec3(.13,.50,.42),shallow);
      diffuseColor.rgb+=vec3(.012,.025,.022)*(sin(a)+sin(b))+caustic*vec3(.5,1.,.8);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.79,.91,.85),clamp(foam*.78,0.,.85));
      float bayEdge=min(min(p.x-uBayBounds.x,uBayBounds.y-p.x),min(p.y-uBayBounds.z,uBayBounds.w-p.y));
      diffuseColor.a=mix(.98,.55,shallow)*smoothstep(0.,2.,bayEdge);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float detail=1.-smoothstep(18.,85.,length(vViewPosition));
      vec2 slopes=n1*.48+n2*.28+n3*.16*detail;
      slopes-=vec2(.02295,.01485)*cos(a)+vec2(-.0065,.01825)*cos(b)+vec2(.0112,-.0058)*cos(c);
      vec3 seaNormal=normalize(vec3(slopes.x,1.,slopes.y));
      normal=normalize(normalMatrix*seaNormal);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      vec3 eye=normalize(cameraPosition-vSeaWorld);
      vec3 reflected=reflect(-eye,seaNormal);
      float fresnel=.025+.78*pow(1.-max(dot(seaNormal,eye),0.),5.);
      vec3 sky=mix(vec3(.57,.78,.84),vec3(.18,.46,.65),smoothstep(.0,.85,reflected.y));
      outgoingLight=mix(outgoingLight,sky,fresnel*(1.-clamp(foam,0.,1.)));
      #include <opaque_fragment>`);
  };
  waterMaterial.customProgramCacheKey=()=> 'ferry-bay-v3';
  // shortcut: analytic sky reflection and shoreline avoid scene re-renders; add planar/depth passes for reflected props or underwater cameras.
  const sea=new T.Mesh(new T.PlaneGeometry(FERRY_BAY.width,FERRY_BAY.depth,80,64).rotateX(-Math.PI/2),waterMaterial);
  sea.name='ferry-sea';sea.position.set(FERRY_BAY.x,FERRY_SEA_Y,FERRY_BAY.z);sea.receiveShadow=true;
  sea.geometry.computeBoundingSphere();sea.geometry.boundingSphere!.radius+=.08;root.add(sea);

  const reefs=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:'#8e9b88',roughness:.97,flatShading:true}),52);
  const dummy=new T.Object3D();let index=0;
  for(const [edge,direction,z0,z1] of [[gardenCoastX,1,-30,3],[bossCoastX,-1,-27,-9]] as const)for(let i=0;i<26;i++) {
    let z=z0+i*(z1-z0)/25;if(direction>0&&z>-12.8&&z<-7.2)z-=6;if(direction<0&&z>-18.2&&z<-11.7)z-=7;
    dummy.position.set(edge(z)+direction*(1.7+(i%3)*.37),-.57+(i%3)*.1,z);
    dummy.scale.set(.45+(i%4)*.17,.35+(i%3)*.2,.42+(i%5)*.13);dummy.rotation.set(.12*Math.sin(i),i*2.3,.12*Math.cos(i));dummy.updateMatrix();reefs.setMatrixAt(index++,dummy.matrix);
  }
  reefs.name='ferry-shore-reefs';reefs.castShadow=reefs.receiveShadow=true;reefs.computeBoundingSphere();root.add(reefs);

  const props=new T.Group();props.name='ferry-dock-props';root.add(props);
  const timber=new T.MeshStandardMaterial({color:'#a77c47',roughness:.85}),brass=new T.MeshStandardMaterial({color:'#c6a361',roughness:.55,metalness:.25});
  const leaf=new T.MeshStandardMaterial({color:'#70906a',roughness:.85}),glow=new T.MeshStandardMaterial({color:'#fff1b5',emissive:'#f3c76e',emissiveIntensity:.55,roughness:.5});
  const add=(g:T.Group,geometry:T.BufferGeometry,material:T.Material,x:number,y:number,z:number)=>{const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
  const lamp=new T.Group();lamp.name='ferry-leaf-lamp';lamp.position.set(96.35,0,-11.35);props.add(lamp);
  add(lamp,new T.CylinderGeometry(.075,.11,2.6,10),timber,0,1.3,0);
  const arm=new T.CatmullRomCurve3([new T.Vector3(0,2.5,0),new T.Vector3(.2,2.77,0),new T.Vector3(.72,2.66,0),new T.Vector3(.86,2.44,0)]);
  add(lamp,new T.TubeGeometry(arm,24,.035,6,false),brass,0,0,0);
  const bulb=add(lamp,new T.SphereGeometry(1,16,12),glow,.86,2.12,0);bulb.scale.set(.19,.29,.17);
  for(const side of [-1,1]) {const shade=add(lamp,treasureLeaf,leaf,.86+side*.13,2.08,0);shade.scale.set(.38,.58,.7);shade.rotation.z=-side*.55;shade.rotation.y=side*Math.PI/3;}
  for(const y of [1.81,2.41])add(lamp,new T.SphereGeometry(.07,8,6),brass,.86,y,0);
  batchTreasureParts(lamp);
  const sign=new T.Group();sign.name='ferry-boarding-sign';sign.position.set(94.6,0,-8.55);props.add(sign);
  add(sign,new T.CylinderGeometry(.065,.09,1.38,10),timber,0,.69,0);
  const arrow=new T.Shape();arrow.moveTo(-.70,.87);arrow.lineTo(.36,.87);arrow.lineTo(.36,.77);arrow.lineTo(.79,1.09);arrow.lineTo(.36,1.41);arrow.lineTo(.36,1.31);arrow.lineTo(-.70,1.31);arrow.closePath();
  add(sign,new T.ExtrudeGeometry(arrow,{depth:.08,bevelEnabled:true,bevelSize:.025,bevelThickness:.02,bevelSegments:2,steps:1}),timber,0,0,0);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#fff0c8';ctx.font='bold 64px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(mt('boardingSign'),256,80,490);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const label=add(sign,new T.PlaneGeometry(1.03,.32),new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}),-.12,1.09,.105);
  const back=label.clone();back.position.z=-.045;back.rotation.y=Math.PI;sign.add(back);
  batchTreasureParts(sign);
  return {root,time,terrain,colliders:[{x:96.35,y:1.3,z:-11.35,width:.24,height:2.6,depth:.24},{x:94.6,y:.7,z:-8.55,width:.2,height:1.4,depth:.2}]};
}
