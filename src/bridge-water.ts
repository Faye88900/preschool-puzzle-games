import * as T from 'three';
import { CELL } from './maze-map';

export function createBridgeWater() {
  const root = new T.Group(); root.name = 'garden-bridge-stream';
  const time = { value: 0 };
  const bankVertices: number[] = [], bankColors: number[] = [];
  const dry = new T.Color('#d6c095'), wet = new T.Color('#8c9a7e');
  const sections = [[2.6,.022],[2.43,.012],[2.19,-.31],[1.83,-.83]];
  for (const side of [-1,1]) for (let i=0;i<24;i++) for (let band=0;band<3;band++) {
    const point = (step: number, ring: number) => {
      const z = -CELL/2 + step*CELL/24, [x,y] = sections[ring];
      return [side * (x + (ring ? .055 * Math.sin(z*2.3+side) : 0)),y,z];
    };
    const a=point(i,band),b=point(i+1,band),c=point(i+1,band+1),d=point(i,band+1);
    const vertices=side<0?[a,b,c,a,c,d]:[a,c,b,a,d,c];
    for(const vertex of vertices){bankVertices.push(...vertex);const color=dry.clone().lerp(wet,Math.min(1,-vertex[1]*2));bankColors.push(color.r,color.g,color.b);}
  }
  const banksGeometry = new T.BufferGeometry(); banksGeometry.setAttribute('position',new T.Float32BufferAttribute(bankVertices,3));
  banksGeometry.setAttribute('color',new T.Float32BufferAttribute(bankColors,3));banksGeometry.computeVertexNormals();
  const banks = new T.Mesh(banksGeometry,new T.MeshStandardMaterial({vertexColors:true,roughness:1}));
  banks.name='bridge-water-banks';banks.receiveShadow=true;root.add(banks);

  const bedGeometry = new T.PlaneGeometry(CELL,6,12,16).rotateX(-Math.PI/2), positions=bedGeometry.attributes.position;
  for(let i=0;i<positions.count;i++)positions.setY(i,-.85+.018*Math.sin(positions.getX(i)*4+positions.getZ(i)*3));
  bedGeometry.computeVertexNormals();
  const bed=new T.Mesh(bedGeometry,new T.MeshStandardMaterial({color:'#c1b18d',roughness:1}));bed.name='bridge-water-bed';bed.receiveShadow=true;root.add(bed);
  const pebbles=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:'#9aab96',roughness:1,flatShading:true}),18);
  const dummy=new T.Object3D();
  for(let i=0;i<18;i++){
    dummy.position.set(Math.sin(i*4.3)*1.8,-.78+Math.sin(i*1.4)*.025,-2.75+(i/17)*5.5);
    dummy.scale.set(.08+(i%3)*.035,.055+(i%2)*.025,.1+(i%4)*.035);dummy.rotation.y=i*2.1;dummy.updateMatrix();pebbles.setMatrixAt(i,dummy.matrix);
  }
  pebbles.name='bridge-water-pebbles';pebbles.computeBoundingSphere();root.add(pebbles);

  const material=new T.MeshStandardMaterial({color:'#4aaeb7',roughness:.27,metalness:0,transparent:true,opacity:.84,depthWrite:false});
  material.name='bridge-flowing-water';
  material.onBeforeCompile=shader=>{
    shader.uniforms.uStreamTime=time;
    shader.uniforms.uStreamDeep={value:new T.Color('#287b95')};
    shader.uniforms.uStreamShallow={value:new T.Color('#7ccbb7')};
    shader.vertexShader='uniform float uStreamTime;\nvarying vec2 vStream;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vStream=position.xz;
      transformed.y += .012*sin(position.z*4.8-position.x*2.4-uStreamTime*.9)
                     +.008*sin(position.z*7.1+position.x*3.7-uStreamTime*1.3);`);
    shader.fragmentShader='uniform float uStreamTime;\nuniform mat3 normalMatrix;\nuniform vec3 uStreamDeep, uStreamShallow;\nvarying vec2 vStream;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 p=vStream;
      float edge=2.19-abs(p.x+.04*sin(p.y*2.3));
      float shallow=1.-smoothstep(.0,.95,edge);
      float waveA=p.y*4.8-p.x*2.4-uStreamTime*.9;
      float waveB=p.y*7.1+p.x*3.7-uStreamTime*1.3;
      float ripples=sin(p.y*8.-uStreamTime+sin(p.x*2.8+p.y*.8)*1.5+.4*sin(p.x*7.2));
      float broken=smoothstep(.4,.9,sin(p.x*6.7+sin(p.y*3.2)*2.1+p.y*.8));
      float glints=smoothstep(.94,1.,ripples)*broken*.13;
      float foam=(1.-smoothstep(.025,.09,abs(edge-.08-.024*sin(p.y*8.-uStreamTime))))
                 *smoothstep(-.25,.3,.5*sin(p.y*8.3+p.x*2.5-uStreamTime*.35)+.3*sin(p.y*13.3+p.x)+.2*sin(p.y*4.7));
      diffuseColor.rgb=mix(uStreamDeep,uStreamShallow,shallow*.82);
      diffuseColor.rgb+=vec3(.035,.055,.05)*(sin(waveA)*.5+sin(waveB)*.5);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.78,.91,.85),clamp(glints+foam*.62,0.,.8));
      diffuseColor.a=mix(.84,.42,shallow);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec3 streamNormal=normalize(vec3(.028*cos(waveA)-.03*cos(waveB),1.,-.058*cos(waveA)-.057*cos(waveB)));
      normal=normalize(normalMatrix*streamNormal);
      float fresnel=pow(1.-max(dot(normal,normalize(vViewPosition)),0.),3.);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.64,.82,.88),fresnel*.28);`);
  };
  material.customProgramCacheKey=()=> 'bridge-stream-v1';
  // shortcut: analytic flow and depth colors suit this fixed canal; use scene-depth/reflection passes if the water becomes a playable area.
  const surface=new T.Mesh(new T.PlaneGeometry(CELL,6,24,28).rotateX(-Math.PI/2),material);
  surface.position.y=-.27;surface.name='bridge-water-surface';surface.receiveShadow=true;
  surface.geometry.computeBoundingBox();surface.geometry.boundingBox!.expandByScalar(.025);surface.geometry.computeBoundingSphere();surface.geometry.boundingSphere!.radius+=.025;
  root.add(surface);
  return { root, time };
}
