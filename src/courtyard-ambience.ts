import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function createCourtyardAmbience(island:T.Group) {
  const courtyard=island.getObjectByName('boss-courtyard-blockout')!;
  const effects=new T.Group();effects.name='courtyard-ambient-effects';effects.position.copy(courtyard.position);island.add(effects);
  const clock={value:0},motion={value:1};
  const windShader=(material:T.MeshStandardMaterial,cloth=false)=>{
    material.onBeforeCompile=shader=>{
      shader.uniforms.uAmbientTime=clock;shader.uniforms.uAmbientMotion=motion;
      shader.vertexShader='uniform float uAmbientTime,uAmbientMotion;\n'+(cloth?'':'attribute vec2 aAmbientWind;\n')+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        float ambientGust=.65+.35*pow(sin(uAmbientTime*.28),2.);
        ${cloth?`float freeTail=smoothstep(.15,1.,position.x);
          transformed.z+=uAmbientMotion*freeTail*.09*sin(position.x*5.-uAmbientTime*2.3)*ambientGust;
          transformed.y+=uAmbientMotion*freeTail*.025*sin(position.x*4.-uAmbientTime*1.8);`:
        `float sway=uAmbientMotion*aAmbientWind.x*(sin(uAmbientTime*1.8+aAmbientWind.y)+.3*sin(uAmbientTime*.75+aAmbientWind.y))*ambientGust;
          transformed.x+=sway;transformed.z-=sway*.35;transformed.y-=abs(sway)*.10;`}`);
    };
    material.customProgramCacheKey=()=>cloth?'courtyard-cloth-v1':'courtyard-rooted-wind-v1';material.needsUpdate=true;
  };
  const vegetation=island.getObjectByName('courtyard-vegetation')!,copies=new Map<T.Material,T.MeshStandardMaterial>();
  vegetation.traverse(node=>{if(!(node instanceof T.Mesh))return;const source=node.material as T.MeshStandardMaterial;
    if(!copies.has(source)){const material=source.clone();windShader(material);copies.set(source,material);}node.material=copies.get(source)!;
    node.geometry.computeBoundingSphere();node.geometry.boundingSphere!.radius+=.25;
  });
  const bells:{object:T.Object3D;x:number;z:number;phase:number}[]=[],rocks:{object:T.Object3D;y:number;z:number;phase:number}[]=[];
  let chimeIndex=0;
  island.traverse(node=>{
    if(node.name==='leaf-chime-post'){
      for(let i=0;i<3;i++){const leaf=node.getObjectByName(`leaf-chime-${i}`)!;bells.push({object:leaf,x:leaf.rotation.x,z:leaf.rotation.z,phase:i*1.3+chimeIndex*.7});}
      node.getObjectByName('chime-streamer')!.traverse(part=>{if(part instanceof T.Mesh)windShader(part.material as T.MeshStandardMaterial,true);});chimeIndex++;
    }
    if(/^floating-rock-[abc]$/.test(node.name))rocks.push({object:node,y:node.position.y,z:node.rotation.z,phase:rocks.length*1.7});
  });
  const sword=island.getObjectByName('ancient-wind-sword')!,glows=new Map<T.MeshStandardMaterial,number>();
  sword.traverse(node=>{if(node instanceof T.Mesh){const material=node.material as T.MeshStandardMaterial;if(material.name==='ancient-sword-wind'||material.name==='ancient-sword-ember')glows.set(material,material.emissiveIntensity);}});

  const shape=new T.Shape();shape.moveTo(-.19,0);shape.quadraticCurveTo(-.01,.11,.19,0);shape.quadraticCurveTo(-.01,-.07,-.19,0);
  const leafMaterial=new T.MeshBasicMaterial({color:'#d0bc60',side:T.DoubleSide,transparent:true,opacity:.65,depthWrite:false});
  leafMaterial.forceSinglePass=true;
  const leaves=new T.InstancedMesh(new T.ShapeGeometry(shape,4),leafMaterial,12);leaves.name='courtyard-drifting-leaves';leaves.boundingSphere=new T.Sphere(new T.Vector3(0,2,0),34);effects.add(leaves);
  const pose=new T.Object3D();
  for(let i=0;i<leaves.count;i++)leaves.setColorAt(i,new T.Color(i%3?'#afbd6b':'#ead18c'));leaves.instanceColor!.needsUpdate=true;
  const dustPositions=new Float32Array(28*3),dustGeometry=new T.BufferGeometry();dustGeometry.setAttribute('position',new T.BufferAttribute(dustPositions,3));dustGeometry.boundingSphere=new T.Sphere(new T.Vector3(2,3,-20),15);
  const dust=new T.Points(dustGeometry,new T.PointsMaterial({color:'#fff0c7',size:.065,transparent:true,opacity:.32,depthWrite:false}));dust.name='courtyard-sun-motes';effects.add(dust);
  const wispsMaterial=new T.MeshBasicMaterial({color:'#fff6d9',transparent:true,opacity:.05,depthWrite:false});
  const wispParts=[
    [[-19,3,-23],[-16,3.4,-23.4],[-13,3.3,-23.5],[-10,3.5,-24]],
    [[9,3.8,-23],[12,4,-23.4],[15,4.4,-23.8],[18,4.3,-24]],
  ].map(points=>new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3().fromArray(p))),24,.018,3,false));
  const wisps=new T.Mesh(mergeGeometries(wispParts)!,wispsMaterial);wisps.name='courtyard-wind-wisps';effects.add(wisps);wispParts.forEach(g=>g.dispose());
  const shaftPositions:number[]=[],shaftUV:number[]=[];
  for(const x of [-6,7]){
    shaftPositions.push(x,9,-16,x+.6,9,-16,x+5,.5,-20,x+.6,9,-16,x+6.8,.5,-20,x+5,.5,-20);
    shaftUV.push(0,1,1,1,0,0,1,1,1,0,0,0);
  }
  const shaftGeometry=new T.BufferGeometry();shaftGeometry.setAttribute('position',new T.Float32BufferAttribute(shaftPositions,3));shaftGeometry.setAttribute('uv',new T.Float32BufferAttribute(shaftUV,2));
  const shafts=new T.Mesh(shaftGeometry,new T.ShaderMaterial({name:'courtyard-daylight-shafts',uniforms:T.UniformsUtils.merge([T.UniformsLib.fog,{uTint:{value:new T.Color('#fff1ca')}}]),transparent:true,depthWrite:false,side:T.DoubleSide,fog:true,
    vertexShader:`varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){vUv=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader:`uniform vec3 uTint;varying vec2 vUv;
      #include <fog_pars_fragment>
      void main(){float edge=pow(max(0.,1.-abs(vUv.x*2.-1.)),2.);float fade=sin(vUv.y*3.14159265);gl_FragColor=vec4(uTint,edge*fade*.045);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
      }`}));shafts.name='courtyard-sun-shafts';effects.add(shafts);
  shafts.material.forceSinglePass=true;
  return {root:effects,update(time:number,reducedMotion:boolean){
    const t=reducedMotion?0:time,m=reducedMotion?0:1,gust=.65+.35*Math.sin(t*.28)**2;clock.value=t;motion.value=m;
    for(const b of bells){b.object.rotation.x=b.x+m*.018*Math.sin(t*1.7+b.phase);b.object.rotation.z=b.z+m*.075*Math.sin(t*2+b.phase)*gust;}
    for(const r of rocks){r.object.position.y=r.y+m*.14*(Math.sin(t*.72+r.phase)-Math.sin(r.phase));r.object.rotation.z=r.z+m*.012*(Math.sin(t*.55+r.phase)-Math.sin(r.phase));}
    for(const [material,base]of glows)material.emissiveIntensity=base*(reducedMotion?1:material.name==='ancient-sword-wind'?.86+.14*Math.cos(t*Math.PI/3):.97+.03*Math.cos(t*.9));
    leaves.visible=dust.visible=wisps.visible=!reducedMotion;
    for(let i=0;i<leaves.count;i++){
      const flight=((t*.8+i*3.7)%44+44)%44;pose.position.set(-22+flight,1+(i%4)*.6+.22*Math.sin(t*.7+i),i%2?22.5:-22.5);
      const fade=T.MathUtils.smoothstep(flight,0,2)*(1-T.MathUtils.smoothstep(flight,42,44));
      pose.rotation.set(.6+Math.sin(t*.8+i)*.5,t*.45+i,Math.sin(t+i)*.7);pose.scale.setScalar((.7+(i%3)*.15)*fade);pose.updateMatrix();leaves.setMatrixAt(i,pose.matrix);
    }
    leaves.instanceMatrix.needsUpdate=true;wispsMaterial.opacity=Math.max(0,gust-.76)*.27;wisps.position.x=Math.sin(t*.2)*.5;
    for(let i=0;i<28;i++){dustPositions[i*3]=-8+i*.77+.25*Math.sin(t*.24+i);dustPositions[i*3+1]=.9+(i%7)*.55+.12*Math.sin(t*.4+i);dustPositions[i*3+2]=-20-(i%4)*.3;}
    dustGeometry.attributes.position.needsUpdate=true;
  }};
}
