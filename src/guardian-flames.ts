import * as T from 'three';

let flameTexture:Promise<T.Texture>|undefined;
export function loadGuardianFlameTexture() {
  return flameTexture??=new T.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}textures/ember-guardian/flame_01.png`).then(texture=>{
    texture.colorSpace=T.NoColorSpace;texture.wrapS=texture.wrapT=T.ClampToEdgeWrapping;
    return texture;
  });
}

export function createGuardianFlames(texture:T.Texture) {
  const plane=new T.PlaneGeometry(1,1),geometry=new T.InstancedBufferGeometry();
  geometry.setIndex(plane.index);geometry.setAttribute('position',plane.attributes.position);geometry.setAttribute('uv',plane.attributes.uv);
  const seeds=new Float32Array(9*4);
  for(let i=0;i<9;i++)seeds.set([.06+i*.106,(i*.618034)%1,.55+(i%4)*.15,i%2?1:-1],i*4);
  geometry.setAttribute('flameSeed',new T.InstancedBufferAttribute(seeds,4));geometry.instanceCount=9;
  const material=new T.ShaderMaterial({
    uniforms:{uFlame:{value:texture},uTime:{value:0},uStill:{value:0}},transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,
    vertexShader:`attribute vec4 flameSeed;uniform float uTime,uStill;varying vec2 vUv;varying float vAge;
      void main(){
        float age=mix(fract(uTime*(.85+flameSeed.z*.3)+flameSeed.y),.15+flameSeed.y*.5,uStill);
        float envelope=sin(age*3.141593);
        vec4 world=modelMatrix*vec4(flameSeed.w*.075,.30+flameSeed.x*1.02,-.04,1.);
        world.xyz+=vec3(sin(age*5.+flameSeed.y*6.)*.035,age*.16,0.);
        vec4 mvPosition=viewMatrix*world;mvPosition.z+=.045;
        float width=(.10+flameSeed.z*.055)*(.5+envelope*.5);
        float height=(.16+flameSeed.z*.11)*(.5+envelope*.5);
        mvPosition.xy+=vec2(position.x*width,(position.y+.35)*height);
        gl_Position=projectionMatrix*mvPosition;vUv=uv;vAge=age;
      }`,
    fragmentShader:`uniform sampler2D uFlame;varying vec2 vUv;varying float vAge;
      void main(){
        float mask=texture2D(uFlame,vUv).r;
        float alpha=smoothstep(.035,.64,mask)*sin(vAge*3.141593)*.86;
        vec3 color=mix(vec3(1.1,.07,.002),vec3(1.4,.40,.035),smoothstep(.12,.85,mask));
        if(alpha<.012)discard;gl_FragColor=vec4(color,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh=new T.Mesh(geometry,material);mesh.name='sword-residual-flames';mesh.frustumCulled=false;
  mesh.renderOrder=2;mesh.userData.runtimeVfx=true;
  return mesh;
}

export function animateGuardianFlames(model:T.Group,time:number,reducedMotion:boolean) {
  const flame=model.getObjectByName('sword-residual-flames') as T.Mesh<T.InstancedBufferGeometry,T.ShaderMaterial>|undefined;
  if(!flame)return;
  flame.material.uniforms.uTime.value=time;
  flame.material.uniforms.uStill.value=reducedMotion?1:0;
}
