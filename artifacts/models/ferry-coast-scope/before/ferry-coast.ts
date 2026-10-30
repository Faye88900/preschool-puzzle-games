import * as T from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { batchTreasureParts, treasureLeaf } from './treasure-details';
import { mt } from './maze-text';
import { FERRY_SEA_Y, gardenCoastX, bossCoastX } from './ferry-shore-layout';

export function createFerryCoast() {
  const root=new T.Group();root.name='ferry-coast';const time={value:0};
  const vertices:number[]=[],colors:number[]=[];
  const sections=[[-.65,.026,'#85ab5b'],[0,.020,'#c6c58a'],[.55,-.04,'#e1cb98'],[1.3,-.30,'#c8b88c'],[2.4,-.96,'#8eaaa1'],[4,-1.7,'#72a6a1']] as const;
  for(const [edge,direction,z0,z1] of [[gardenCoastX,1,-52.5,62.5],[bossCoastX,-1,-42.5,-7.5]] as const) {
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

  const waterMaterial=new T.MeshStandardMaterial({color:'#258caa',roughness:.29,metalness:.08,transparent:true,opacity:.93,depthWrite:false});
  waterMaterial.onBeforeCompile=shader=>{
    shader.uniforms.uSeaTime=time;
    shader.vertexShader='uniform float uSeaTime;\nvarying vec2 vSea;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vSea=(modelMatrix*vec4(position,1.)).xz;
      transformed.y+=.022*sin(vSea.x*.76+vSea.y*.65-uSeaTime*.85)+.012*sin(vSea.y*1.43-vSea.x*.42-uSeaTime*1.2);`);
    shader.fragmentShader='uniform float uSeaTime;\nuniform mat3 normalMatrix;\nvarying vec2 vSea;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 p=vSea;
      float ga=max(0.,1.-pow((p.y+12.)/20.,2.));
      float ba=max(0.,1.-pow((p.y+15.)/13.,2.));
      float gardenX=102.5-5.8*ga*ga+.25*sin(p.y*.7)*ga;
      float bossX=127.5+4.2*ba*ba+.16*sin(p.y*.9)*ba;
      float gardenDist=max(p.x-gardenX, max(-52.5-p.y,p.y-62.5));
      float bossDist=max(bossX-p.x,max(-42.5-p.y,p.y+7.5));
      float shore=max(0.,min(gardenDist,bossDist));
      float shallow=1.-smoothstep(1.8,9.,shore);
      float a=p.x*.76+p.y*.65-uSeaTime*.85,b=p.y*1.43-p.x*.42-uSeaTime*1.2;
      float ripple=sin(p.x*2.3+p.y*3.7-uSeaTime*1.4+sin(p.x*.8+p.y*.9));
      float glint=smoothstep(.94,1.,ripple)*smoothstep(.15,.85,sin(p.x*3.1-p.y*.7))*.16;
      float wash=2.15+.22*sin(uSeaTime*.8+p.y*.37);
      float foam=(1.-smoothstep(.04,.20,abs(shore-wash)))
        *smoothstep(-.45,.55,sin(p.y*3.8+sin(p.y*1.7)*1.7-uSeaTime*.4));
      diffuseColor.rgb=mix(vec3(.045,.30,.47),vec3(.20,.66,.65),shallow);
      diffuseColor.rgb+=vec3(.025,.045,.045)*(sin(a)+sin(b));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.95,.87),clamp(glint+foam*.8,0.,.9));
      diffuseColor.a=mix(.97,.70,shallow);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      normal=normalize(normalMatrix*normalize(vec3(-.017*cos(a)+.005*cos(b),1.,-.014*cos(a)-.017*cos(b))));
      float fresnel=pow(1.-max(dot(normal,normalize(vViewPosition)),0.),3.);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.58,.79,.86),fresnel*.25);`);
  };
  waterMaterial.customProgramCacheKey=()=> 'ferry-sea-v1';
  // shortcut: analytic shallows and highlights avoid extra render passes; use scene-depth water for swimming or underwater cameras.
  const sea=new T.Mesh(new T.PlaneGeometry(650,650,160,160).rotateX(-Math.PI/2),waterMaterial);
  sea.name='ferry-sea';sea.position.set(70,FERRY_SEA_Y,0);sea.receiveShadow=true;
  sea.geometry.computeBoundingSphere();sea.geometry.boundingSphere!.radius+=.04;root.add(sea);

  const reefs=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:'#8e9b88',roughness:.97,flatShading:true}),52);
  const dummy=new T.Object3D();let index=0;
  for(const [edge,direction,z0,z1] of [[gardenCoastX,1,-34,3],[bossCoastX,-1,-39,-9]] as const)for(let i=0;i<26;i++) {
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
