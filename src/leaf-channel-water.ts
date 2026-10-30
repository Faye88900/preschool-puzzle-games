import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { leafChannelStreams, LEAF_CHANNEL_FLOORS, LEAF_CHANNEL_SPACING } from './leaf-water-channel';

let flowTexture:T.DataTexture|undefined;
function waterTexture() {
  if(flowTexture)return flowTexture;
  const size=128,data=new Uint8Array(size*size*4),cells=9;
  const hash=(x:number,y:number)=>{const n=Math.sin(((x%cells+cells)%cells)*127.1+((y%cells+cells)%cells)*311.7)*43758.5453;return n-Math.floor(n);};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    let sx=0,sy=0,first=Infinity,second=Infinity;
    for(const [kx,ky,a,p]of [[2,1,.024,0],[-3,4,.018,1.7],[7,2,.009,2.4],[-4,9,.006,.7]]) {
      const slope=a*Math.cos((kx*x+ky*y)/size*Math.PI*2+p);sx+=kx*slope;sy+=ky*slope;
    }
    const px=x/size*cells,py=y/size*cells,ix=Math.floor(px),iy=Math.floor(py);
    for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++) {
      const dx=px-ix-i-.12-.76*hash(ix+i,iy+j),dy=py-iy-j-.12-.76*hash(iy+j+17,ix+i+29),d=dx*dx+dy*dy;
      if(d<first){second=first;first=d;}else second=Math.min(second,d);
    }
    const foam=1-T.MathUtils.smoothstep(Math.sqrt(second)-Math.sqrt(first),.025,.19),n=(hash(x,y)*.4+.6)*255;
    data.set([T.MathUtils.clamp(sx*.5+.5,0,1)*255,T.MathUtils.clamp(sy*.5+.5,0,1)*255,foam*255,n],(y*size+x)*4);
  }
  const texture=new T.DataTexture(data,size,size);texture.name='leaf-water-wave-slopes-and-foam';texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;flowTexture=texture;return texture;
}

const common=`
  uniform float uTime,uMotion,uFade;
  uniform sampler2D uFlow;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
  float fbm(vec2 p){return noise(p)*.58+noise(p*2.07+3.)*.28+noise(p*4.17+7.)*.14;}
`;

export function createLeafChannelWater(root:T.Object3D) {
  const texture=waterTexture(),materials:T.ShaderMaterial[]=[];
  const shader=(name:string,vertexShader:string,fragmentShader:string,extra:Record<string,T.IUniform>={})=>{
    const m=new T.ShaderMaterial({name,transparent:true,depthWrite:false,side:T.DoubleSide,fog:true,forceSinglePass:true,
      uniforms:T.UniformsUtils.merge([T.UniformsLib.fog,{uTime:{value:0},uMotion:{value:1},uFade:{value:1},uFlow:{value:texture}},extra]),vertexShader,fragmentShader});
    m.userData.leafChannelWater=true;return m;
  };
  const surfaceVertex=`
    uniform float uTime,uMotion;
    attribute float aRadial;
    varying vec2 vLocal;
    varying vec3 vWorld,vAxisX,vAxisZ;
    varying float vRadial;
    #include <fog_pars_vertex>
    void main(){
      vLocal=position.xz;vRadial=aRadial;
      vec3 p=position;float edge=1.-smoothstep(.86,1.,aRadial);
      p.y+=uMotion*edge*(.006*sin(p.x*4.1+p.z*3.6-uTime*1.9)+.004*sin(p.x*7.7-p.z*5.3+uTime*2.7));
      vAxisX=normalize((modelMatrix*vec4(1.,0.,0.,0.)).xyz);vAxisZ=normalize((modelMatrix*vec4(0.,0.,1.,0.)).xyz);
      vWorld=(modelMatrix*vec4(p,1.)).xyz;vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
    }`;
  // shortcut: analytic sky reflections avoid a second scene pass; use scene capture if nearby-object reflections become essential.
  const surfaceFragment=`
    ${common}
    uniform vec2 uImpact;
    varying vec2 vLocal;
    varying vec3 vWorld,vAxisX,vAxisZ;
    varying float vRadial;
    #include <fog_pars_fragment>
    void main(){
      vec2 p=vLocal;float t=uTime;
      vec2 n1=texture2D(uFlow,p*.57+vec2(.024,-.037)*t).rg*2.-1.;
      vec2 n2=texture2D(uFlow,mat2(.8,-.6,.6,.8)*p*1.31+vec2(-.036,.028)*t+n1*.075).rg*2.-1.;
      vec2 delta=p-uImpact;float radius=length(delta),wave=radius*30.-t*5.2;
      vec2 impactSlope=delta/max(radius,.02)*cos(wave)*exp(-radius*2.1)*.065;
      vec2 slopes=n1*.60+n2*.27+impactSlope;
      vec3 N=normalize(-slopes.x*vAxisX+vec3(0.,1.,0.)-slopes.y*vAxisZ),V=normalize(cameraPosition-vWorld);
      float facing=max(dot(N,V),.0),fresnel=.02+.98*pow(1.-facing,5.);
      vec3 R=reflect(-V,N);float horizon=smoothstep(-.1,.8,R.y);
      vec3 sky=mix(vec3(.59,.77,.84),vec3(.19,.43,.62),horizon);
      float cloud=smoothstep(.53,.76,fbm(R.xz/max(.25,R.y+.5)*2.9));sky=mix(sky,vec3(.92,.96,.96),cloud*.65);
      vec3 L=normalize(vec3(-.42,.82,-.40)),H=normalize(L+V);
      float spec=pow(max(dot(N,H),0.),72.)*.40+pow(max(dot(N,H),0.),280.)*1.3;
      float depth=1.-pow(clamp(vRadial,0.,1.),2.4);
      vec3 tint=mix(vec3(.06,.32,.28),vec3(.015,.12,.17),depth*.75);
      float filament=texture2D(uFlow,p*1.7+vec2(-.03,.06)*t+n1*.10).b;
      float bubbles=smoothstep(.45,.87,filament)*exp(-radius*2.8);
      float ripple=(1.-smoothstep(.035,.11,abs(sin(wave))))*exp(-radius*2.2)*smoothstep(.05,.22,radius);
      float aeration=exp(-radius*radius*23.)*(.66+.22*noise(p*21.-t*1.8));
      float foam=clamp(bubbles*.56+ripple*.22+aeration,0.,.90);
      float rimFoam=smoothstep(.88,.98,vRadial)*smoothstep(.56,.85,filament)*.20;
      vec3 col=mix(tint,sky,.23+fresnel*.65)+vec3(.80,.92,.96)*spec;
      col+=vec3(.055,.073,.052)*pow(filament,5.)*depth;
      col=mix(col,vec3(.88,.96,.92),clamp(foam+rimFoam,0.,.84));
      float alpha=clamp(.49+depth*.13+fresnel*.28+foam*.34+spec*.14,.40,.94)*uFade;
      gl_FragColor=vec4(col,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`;
  for(let i=0;i<3;i++) {
    const tier=root.getObjectByName(`boss-blockout-water-channel-${i}`)??root.getObjectByName(`leaf-water-tier-${i}`);
    const group=tier!.getObjectByName('leaf-basin-water-preview')!;
    const old=group.children.find(node=>node instanceof T.Mesh&&(node.material as T.Material).name==='leaf-channel-water-preview') as T.Mesh;
    const p=old.geometry.attributes.position,vertices:number[]=[],radial:number[]=[],indices:number[]=[];
    // Subdivide each existing leaf fan sector; its perimeter and spill opening stay fixed.
    for(let triangle=0;triangle<p.count;triangle+=3) {
      const a=new T.Vector3().fromBufferAttribute(p,triangle),b=new T.Vector3().fromBufferAttribute(p,triangle+1),c=new T.Vector3().fromBufferAttribute(p,triangle+2);
      const grid:number[][]=[];
      for(let row=0;row<=6;row++) {
        grid[row]=[];for(let col=0;col<=row;col++) {
          grid[row][col]=vertices.length/3;const v=a.clone().multiplyScalar(1-row/6).addScaledVector(b,(row-col)/6).addScaledVector(c,col/6);vertices.push(v.x,v.y,v.z);radial.push(row/6);
        }
      }
      for(let row=0;row<6;row++)for(let col=0;col<=row;col++) {
        indices.push(grid[row][col],grid[row+1][col],grid[row+1][col+1]);
        if(col<row)indices.push(grid[row][col],grid[row+1][col+1],grid[row][col+1]);
      }
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('aRadial',new T.Float32BufferAttribute(radial,1));geometry.setIndex(indices);geometry.computeVertexNormals();
    geometry.computeBoundingSphere();geometry.boundingSphere!.radius+=.02;
    const m=shader('leaf-water-ripple-surface',surfaceVertex,surfaceFragment,{uImpact:{value:new T.Vector2(0,i===0?-.76:.085)}});
    group.clear();const mesh=new T.Mesh(geometry,m);mesh.name='leaf-water-ripple-surface';mesh.renderOrder=3;group.add(mesh);
  }

  const falls=root.getObjectByName('boss-blockout-waterfall')??root.getObjectByName('leaf-channel-waterfall-preview');falls!.clear();
  const streams=leafChannelStreams(),terminal=streams[3],endZ=terminal.points[terminal.points.length-1][2];
  terminal.points.push([0,-18,endZ+.85],[.05,-23,endZ+1.70],[.10,-27.5,endZ+2.45]);
  const terminalCurve=new T.CatmullRomCurve3(terminal.points.map(([x,y,z])=>new T.Vector3(x,y,z)));
  const ribbons:T.BufferGeometry[]=[];
  for(const [index,stream]of streams.entries()) {
    const curve=new T.CatmullRomCurve3(stream.points.map(([x,y,z])=>new T.Vector3(x,y,z))),length=curve.getLength(),sections=index===3?160:22;
    const vertices:number[]=[],uv:number[]=[],long:number[]=[],indices:number[]=[];
    for(let i=0;i<=sections;i++) {
      const p=curve.getPointAt(i/sections),w=stream.width*(1+(index===3?1.55:.15)*i/sections);
      vertices.push(p.x-w,p.y,p.z,p.x+w,p.y,p.z);uv.push(0,i/sections*length,1,i/sections*length);long.push(index===3?1:0,index===3?1:0);
      if(i<sections){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('aLong',new T.Float32BufferAttribute(long,1));geometry.setIndex(indices);geometry.computeVertexNormals();ribbons.push(geometry);
  }
  const fallVertex=`
    uniform float uTime,uMotion;
    attribute float aLong;
    varying vec2 vUv;varying float vLong,vHeight;varying vec3 vWorld,vFacing;
    #include <fog_pars_vertex>
    void main(){vUv=uv;vLong=aLong;vec3 p=position;
      float free=smoothstep(.10,1.2,uv.y);p.x+=uMotion*free*(.013+aLong*.018)*sin(uv.y*6.-uTime*5.5+uv.x*2.1);
      p.z+=uMotion*free*.012*sin(uv.y*9.-uTime*6.2);
      vHeight=p.y;vWorld=(modelMatrix*vec4(p,1.)).xyz;vFacing=normalize(mat3(modelMatrix)*normal);
      vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
    }`;
  const fallFragment=`
    ${common}
    varying vec2 vUv;varying float vLong,vHeight;varying vec3 vWorld,vFacing;
    #include <fog_pars_fragment>
    void main(){
      float t=uTime;vec2 flow=vec2(vUv.x*1.4,vUv.y*.12-t*(1.+vLong*.35));
      vec4 tex=texture2D(uFlow,flow);float broad=fbm(flow*vec2(3.1,1.8)+tex.rg*.38);
      float thin=texture2D(uFlow,vec2(vUv.x*2.3,vUv.y*.34-t*1.9)).b;
      float strand=pow(.5+.5*sin(vUv.x*51.+tex.r*5.+broad*7.+vUv.y*.7),5.);
      float edge=1.-smoothstep(.58+broad*.20,.98,abs(vUv.x-.5)*2.);
      float breaking=smoothstep(.11,.32,broad+thin*.20);
      float white=clamp(thin*.44+strand*.32+smoothstep(.51,.80,broad)*.44+vLong*.10,0.,.94);
      vec3 col=mix(vec3(.035,.23,.28),vec3(.76,.91,.95),white);
      float fresnel=pow(1.-abs(dot(normalize(vFacing),normalize(cameraPosition-vWorld))),3.);
      col+=vec3(.10,.13,.14)*fresnel;
      float cloudFade=mix(1.,1.-smoothstep(19.,27.5,-vHeight),vLong);
      float alpha=edge*breaking*(.33+white*.58+fresnel*.12)*uFade*cloudFade;
      gl_FragColor=vec4(col,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`;
  const curtain=new T.Mesh(mergeGeometries(ribbons)!,shader('leaf-water-turbulent-cascades',fallVertex,fallFragment));ribbons.forEach(g=>g.dispose());curtain.name='leaf-water-turbulent-cascades';curtain.renderOrder=4;falls!.add(curtain);

  const anchors:number[]=[],velocities:number[]=[],seeds:number[]=[];
  for(let i=0;i<78;i++) {
    const target=i%3,angle=i*2.399,phase=((i*17)%77)/77;
    let x=0,y=LEAF_CHANNEL_FLOORS[target]+.26,z=target*LEAF_CHANNEL_SPACING+(target===0?-.76:.085);
    if(i>=42){const p=terminalCurve.getPointAt(.10+(i-42)/35*.83);x=p.x;y=p.y;z=p.z;}
    anchors.push(x,y,z);velocities.push(Math.cos(angle)*(.28+phase*.45),i<42?.85+phase*.9:-.45,Math.sin(angle)*(.25+phase*.40));seeds.push(phase);
  }
  const dropsGeometry=new T.BufferGeometry();dropsGeometry.setAttribute('position',new T.Float32BufferAttribute(anchors,3));dropsGeometry.setAttribute('aVelocity',new T.Float32BufferAttribute(velocities,3));dropsGeometry.setAttribute('aSeed',new T.Float32BufferAttribute(seeds,1));
  const drops=shader('leaf-water-spray',`
    uniform float uTime,uMotion;attribute vec3 aVelocity;attribute float aSeed;varying float vLife;
    #include <fog_pars_vertex>
    void main(){float age=fract(uTime*1.5+aSeed),life=age*.46;vec3 p=position+aVelocity*life;p.y-=2.3*life*life;
      vLife=sin(age*3.14159)*uMotion*(1.-smoothstep(23.,28.,-p.y));vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;gl_PointSize=clamp(28./max(1.,-mvPosition.z),1.,3.5);
      #include <fog_vertex>
    }`, `
    uniform float uFade;varying float vLife;
    #include <fog_pars_fragment>
    void main(){float d=length(gl_PointCoord-.5);float alpha=(1.-smoothstep(.14,.5,d))*vLife*.52*uFade;gl_FragColor=vec4(vec3(.83,.94,.97),alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`);
  const spray=new T.Points(dropsGeometry,drops);spray.name='leaf-water-impact-spray';spray.renderOrder=5;spray.frustumCulled=false;root.add(spray);

  const cloudPositions:number[]=[],cloudUvs:number[]=[],centers:number[]=[],sizes:number[]=[],cloudSeeds:number[]=[],densities:number[]=[],cloudIndices:number[]=[];
  // shortcut: local billboards approximate cloud volume; use volumetric clouds if flight through them is added.
  const puffs=[
    [-5.6,-26,15.3,8.2,5.3,.78],[-1.8,-27.1,17.0,9.0,5.5,.86],[3.5,-26.7,17.4,9.4,5.6,.83],
    [-3.6,-24.3,13.1,7.2,4.4,.78],[1.1,-24.7,15.5,8.1,4.7,.80],[5.3,-25.1,14.8,7.9,4.6,.74],
    [-.8,-22.8,13.9,5.7,3.4,.60],[3.2,-23.3,14.6,5.5,3.3,.55],[-4.0,-23.8,16.3,6.2,3.8,.62],
    [-.25,-18.2,13.6,1.3,2.2,.13],[.55,-20.1,14.2,2.0,2.6,.19],[-.5,-21.5,14.6,2.6,2.9,.24],
  ];
  puffs.forEach(([x,y,z,w,h,density],i)=>{
    const offset=cloudPositions.length/3;
    for(const [u,v]of [[0,0],[1,0],[1,1],[0,1]]){cloudPositions.push(u-.5,v-.5,0);cloudUvs.push(u,v);centers.push(x,y,z);sizes.push(w,h);cloudSeeds.push(i*1.73);densities.push(density);}
    cloudIndices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
  });
  const cloudGeometry=new T.BufferGeometry();cloudGeometry.setAttribute('position',new T.Float32BufferAttribute(cloudPositions,3));cloudGeometry.setAttribute('uv',new T.Float32BufferAttribute(cloudUvs,2));cloudGeometry.setAttribute('aCenter',new T.Float32BufferAttribute(centers,3));cloudGeometry.setAttribute('aSize',new T.Float32BufferAttribute(sizes,2));cloudGeometry.setAttribute('aSeed',new T.Float32BufferAttribute(cloudSeeds,1));cloudGeometry.setAttribute('aDensity',new T.Float32BufferAttribute(densities,1));cloudGeometry.setIndex(cloudIndices);
  const clouds=shader('leaf-water-local-clouds',`
    uniform float uTime,uMotion;
    attribute vec3 aCenter;attribute vec2 aSize;attribute float aSeed,aDensity;
    varying vec2 vUv;varying float vSeed,vDensity;
    #include <fog_pars_vertex>
    void main(){vUv=uv;vSeed=aSeed;vDensity=aDensity;vec3 center=aCenter;
      center.x+=uMotion*.10*sin(uTime*.09+aSeed);center.z+=uMotion*.07*cos(uTime*.07+aSeed);
      vec4 mvPosition=modelViewMatrix*vec4(center,1.);mvPosition.xy+=position.xy*aSize;gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
    }`, `
    ${common}
    varying vec2 vUv;varying float vSeed,vDensity;
    #include <fog_pars_fragment>
    void main(){
      vec2 p=(vUv-.5)*2.;float detail=fbm(vUv*5.1+vSeed+vec2(uTime*.012,-uTime*.008));
      float billow=fbm(vUv*2.3+vSeed*.7);
      float edge=1.-smoothstep(.68,.99,length(p*vec2(.94,1.06))+(billow-.5)*.30);
      float body=.65+.35*smoothstep(.08,.50,detail*.65+billow*.45);
      float light=clamp(vUv.y*.60+detail*.40+.12,0.,1.);
      vec3 col=mix(vec3(.95,1.05,1.10),vec3(2.3,2.2,2.),light);
      float alpha=edge*body*vDensity*uFade;gl_FragColor=vec4(col,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`);
  const cloudSea=new T.Mesh(cloudGeometry,clouds);cloudSea.name='leaf-water-local-cloud-sea';cloudSea.renderOrder=2;cloudSea.frustumCulled=false;root.add(cloudSea);
  let collected=false;
  return {update(time:number,reducedMotion:boolean){
    // Collect after the existing occlusion system has cloned the effect materials.
    if(!collected){root.traverse(node=>{if(node instanceof T.Mesh||node instanceof T.Points){const m=node.material;if(m instanceof T.ShaderMaterial&&m.userData.leafChannelWater)materials.push(m);}});collected=true;}
    const fade=materials[0]?.opacity??1;
    for(const m of materials){m.uniforms.uFlow.value=texture;m.uniforms.uTime.value=reducedMotion?0:time;m.uniforms.uMotion.value=reducedMotion?0:1;m.uniforms.uFade.value=m.name==='leaf-water-spray'?fade:m.opacity;}
  }};
}
