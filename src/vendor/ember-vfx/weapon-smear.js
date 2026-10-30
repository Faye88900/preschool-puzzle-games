/*!
00GameDevs exported assets — original code only
This license applies only to original code delivered by the VFX, Shader and Object copy/download functions. Website UI code, branding, avatars and promotional images are not licensed by this notice. Third-party code retains its own copyright and license.

The MIT License

Copyright (c) 2026 00GameDevs (@00vchannel)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

Third-party dependency: Three.js (including its addons).
Keep the notices supplied with each dependency when distributing your game.
The notice below does not replace any additional notices in imported modules.

The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

// Source: https://ember-three-vfx.pages.dev/zh-TW/#effects/weapon-smear
export function createWeaponSmearEffect(THREE,spec,options={}) {
  const spatial=spec.id==='spatial-smear';
  const group=new THREE.Group();group.name=spec.id;
  const capacity=64,lifetime=.18,positions=new Float32Array(capacity*6),uvs=new Float32Array(capacity*4),ages=new Float32Array(capacity*2),indices=[];
  const bases=Array.from({length:capacity},()=>new THREE.Vector3()),tips=Array.from({length:capacity},()=>new THREE.Vector3()),times=new Float64Array(capacity);
  for(let i=0;i<capacity;i++){uvs.set([i/(capacity-1),0,i/(capacity-1),1],i*4);if(i<capacity-1){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}
  const inverse=new THREE.Matrix4(),base=new THREE.Vector3(),tip=new THREE.Vector3(),localBase=new THREE.Vector3(),localTip=new THREE.Vector3(0,1,0),a=new THREE.Vector3(),b=new THREE.Vector3();
  let weapon=null,count=0,time=0,stoppedAt=-1,disposed=false,settings;
  const uniforms={uColor:{value:new THREE.Color()},uDetail:{value:1},uDensity:{value:.5}};
  const vertex='attribute float aAge;varying vec2 vUv;varying float vAge;void main(){vUv=uv;vAge=aAge;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
  const fragment=`uniform vec3 uColor;uniform float uDetail,uDensity;varying vec2 vUv;varying float vAge;
    void main(){float age=clamp(vAge,0.0,1.0),y=vUv.y;float fade=pow(1.0-age,1.35);float alpha;vec3 color=uColor;
    #if SMEAR_LAYER == 0
      float lines=0.0;for(int i=0;i<8;i++){float f=float(i);float center=.12+f*.105;float aa=max(fwidth(y),.002);lines+=(1.0-smoothstep(.005,.005+aa,abs(y-center)))*step(f+.5,uDensity*8.0);}
      // Make the fresh leading face readable across the blade, not just at its tip.
      // Retain the actual weapon endpoints and the existing width control.
      float head=1.0-smoothstep(0.0,.28,age);
      float body=mix(.12+.35*y,.42+.12*y,head);
      alpha=(body+lines*.13*uDetail)*smoothstep(0.0,.08,y)*fade;
    #elif SMEAR_LAYER == 1
      alpha=exp(-pow((1.0-y)*7.5,2.0))*.48*uDetail*fade;
    #else
      float aa=max(fwidth(y),.002);alpha=(1.0-smoothstep(.01,.022+aa,1.0-y))*.95*fade;color=mix(uColor,vec3(.86,1.,1.),.8);
    #endif
    if(alpha<.002)discard;gl_FragColor=vec4(color,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`;
  const spatialVertex=vertex.replace('void main(){','varying vec4 vScreen;void main(){').replace('gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);','vScreen=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position=vScreen;');
  const refraction=`uniform float uDetail;varying vec2 vUv;varying float vAge;varying vec4 vScreen;
    uniform sampler2D transmissionSamplerMap;uniform vec2 transmissionSamplerSize;
    void main(){
      // Zero-thickness sheets must not sample the transmission capture while writing it.
      #ifdef FLIP_SIDED
        discard;
      #else
      float age=clamp(vAge,0.0,1.0),y=vUv.y;
      float coverage=pow(1.0-age,1.35)*smoothstep(0.0,.08,y)*(1.0-smoothstep(.96,1.0,y));
      if(coverage<.002||vScreen.w<=0.0)discard;
      vec2 screen=vScreen.xy/vScreen.w*.5+.5;
      // Screen derivatives follow the real ribbon, including arbitrary weapon rotations.
      vec2 dx=dFdx(vUv),dy=dFdy(vUv),pixel=vec2(dFdx(screen.x),dFdy(screen.y));
      float det=dx.x*dy.y-dx.y*dy.x;
      if(abs(det)<1e-10)discard;
      vec2 across=vec2(-dy.x,dx.x)/det*pixel,flow=vec2(dy.y,-dx.y)/det*pixel;
      flow=flow/max(length(flow),1e-6)*min(length(across)*.28,.09);
      float band=sin(y*66.0+sin(age*13.0)*1.25-age*19.0);
      float fine=sin(y*157.0+age*33.0)*.12;
      vec2 delta=(flow*(.35+.65*band+fine)+across*(band*.065+fine*.04))*uDetail*coverage;
      vec2 inset=.5/max(transmissionSamplerSize,vec2(1.0));
      float edge=max(0.0,min(min(screen.x-inset.x,1.0-inset.x-screen.x),min(screen.y-inset.y,1.0-inset.y-screen.y)));
      delta*=smoothstep(0.0,max(.04,length(delta)*1.35),edge);
      gl_FragColor=vec4(texture2D(transmissionSamplerMap,clamp(screen+delta,inset,1.0-inset)).rgb,coverage);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #endif
    }`;
  // A neutral halo with sparse fine lines; density never changes the refractive face.
  const spatialGlow=fragment.replace('*.48*uDetail*fade','*.16*uDetail*fade').replace('if(alpha<.002)discard;',`
    #if SMEAR_LAYER == 1
      float lines=0.0;for(int i=0;i<8;i++){float f=float(i),center=.12+f*.105,aa=max(fwidth(y),.002);lines+=(1.0-smoothstep(.004,.004+aa,abs(y-center)))*step(f+.5,uDensity*8.0);}
      alpha+=lines*.055*uDetail*fade;
    #endif
    if(alpha<.002)discard;`);
  const geometries=[],materials=[];
  for(let layer=0;layer<3;layer++){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geometry.setAttribute('aAge',new THREE.BufferAttribute(ages,1).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);geometry.setDrawRange(0,0);geometries.push(geometry);
    let material;
    if(spatial&&layer===0){
      material=new THREE.MeshPhysicalMaterial({transmission:1,roughness:0,metalness:0,side:THREE.DoubleSide,transparent:true,depthTest:true,depthWrite:false});
      material.forceSinglePass=true;material.uniforms=uniforms;material.vertexShader=spatialVertex;material.fragmentShader=refraction;
      material.onBeforeCompile=program=>{Object.assign(program.uniforms,uniforms);program.vertexShader=material.vertexShader;program.fragmentShader=material.fragmentShader;material.userData.transmissionUniforms=program.uniforms;};
      material.customProgramCacheKey=()=>material.vertexShader+'\n'+material.fragmentShader;
    }else material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:spatial?spatialGlow:fragment,uniforms,defines:{SMEAR_LAYER:layer},side:THREE.DoubleSide,transparent:true,depthTest:true,depthWrite:false,blending:layer===0?THREE.NormalBlending:THREE.AdditiveBlending});
    materials.push(material);
    const mesh=new THREE.Mesh(geometry,material);mesh.name=spec.id+'-'+['blade','halo','edge'][layer];mesh.frustumCulled=false;mesh.renderOrder=layer+1;group.add(mesh);
  }
  function setOptions(next={}){
    if(disposed)return;settings={color:spec.color,size:1,speed:1,detail:1,density:.5,...settings,...next};
    delete settings.quantity;delete settings.spread;delete settings.panelCount;
    for(const key of ['size','speed','detail','density'])settings[key]=THREE.MathUtils.clamp(Number(settings[key])||(key==='density'?.125:.25),key==='density'?.125:.25,key==='density'||key==='size'?1:2);
    if(!/^#[0-9a-f]{6}$/i.test(settings.color))settings.color=spec.color;
    uniforms.uColor.value.set(settings.color);uniforms.uDetail.value=settings.detail;uniforms.uDensity.value=settings.density;rebuild();
  }
  function rebuild(){
    group.updateWorldMatrix(true,false);inverse.copy(group.matrixWorld).invert();
    for(let i=0;i<count;i++){b.copy(tips[i]);a.copy(tips[i]).lerp(bases[i],settings.size);a.applyMatrix4(inverse);b.applyMatrix4(inverse);a.toArray(positions,i*6);b.toArray(positions,i*6+3);ages[i*2]=ages[i*2+1]=Math.min(1,(time-times[i])/lifetime);}
    for(const g of geometries){g.attributes.position.needsUpdate=true;g.attributes.aAge.needsUpdate=true;g.setDrawRange(0,Math.max(0,count-1)*6);}
  }
  function removeFirst(){for(let i=1;i<count;i++){bases[i-1].copy(bases[i]);tips[i-1].copy(tips[i]);times[i-1]=times[i];}count--;}
  function update(dt){
    if(disposed||!Number.isFinite(dt)||dt<0||api.finished)return;
    time+=dt*settings.speed;while(count&&time-times[0]>lifetime)removeFirst();
    if(weapon&&stoppedAt<0){
      weapon.updateWorldMatrix(true,false);base.copy(localBase).applyMatrix4(weapon.matrixWorld);tip.copy(localTip).applyMatrix4(weapon.matrixWorld);
      const length=base.distanceTo(tip);if(Number.isFinite(length)&&length>1e-6){
        if(dt>.25||(count&&Math.max(base.distanceTo(bases[count-1]),tip.distanceTo(tips[count-1]))>length*3))count=0;
        if(!count||Math.max(base.distanceToSquared(bases[count-1]),tip.distanceToSquared(tips[count-1]))>length*length*1e-10){
          if(count===capacity)removeFirst();bases[count].copy(base);tips[count].copy(tip);times[count]=time;count++;
        }
      }else count=0;
    }
    rebuild();group.visible=!api.finished;
  }
  function reset(){if(disposed)return;count=0;time=0;stoppedAt=-1;group.visible=true;rebuild();}
  function stop(){if(!disposed&&stoppedAt<0)stoppedAt=time;}
  function attachWeapon(object,{base:root=[0,0,0],tip:end=[0,1,0]}={}){
    if(disposed)return api;if(!object?.isObject3D)throw new TypeError('attachWeapon requires a THREE.Object3D');
    const read=(value,target)=>{if(value?.isVector3)target.copy(value);else if(Array.isArray(value)&&value.length===3)target.fromArray(value);else throw new TypeError('Blade points must be Vector3 or [x,y,z]');if(![target.x,target.y,target.z].every(Number.isFinite))throw new TypeError('Blade points must be finite');};
    read(root,a);read(end,b);if(a.distanceToSquared(b)<1e-12)throw new RangeError('Blade base and tip must differ');
    localBase.copy(a);localTip.copy(b);weapon=object;reset();return api;
  }
  function detachWeapon(){weapon=null;stop();}
  function dispose(){if(disposed)return;disposed=true;weapon=null;count=0;group.visible=false;group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();group.clear();}
  const api={group,update,setOptions,reset,stop,dispose,attachWeapon,detachWeapon,hit(){},setDirection(){},setEndpoints(){},get settings(){return {...settings};},get elapsed(){return time;},get particleCount(){return 0;},get lifecycle(){return {start:.001,end:lifetime};},get phase(){return api.finished?'finished':stoppedAt>=0?'ending':time<.001?'starting':'active';},get finished(){return disposed||(stoppedAt>=0&&time-stoppedAt>=lifetime-1e-9);}};
  setOptions(options);return api;
}
