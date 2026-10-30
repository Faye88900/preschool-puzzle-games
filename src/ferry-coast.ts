import * as T from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { batchTreasureParts, treasureLeaf } from './treasure-details';
import { mt } from './maze-text';
import { at } from './maze-map';
import { BOSS_ARENA, BOSS_ISLAND_OFFSET_X, FERRY_BAY, FERRY_SEA_Y, gardenCoastX, bossCoastX } from './ferry-shore-layout';

const swells=[[.51,.33,.32,1.6],[-.26,.73,.11,1.95],[1.12,-.58,.04,2.5]] as const;

export function createFerryCoast() {
  const bossTop=Math.max(BOSS_ARENA.top-5,FERRY_BAY.z-FERRY_BAY.depth/2),bossBottom=BOSS_ARENA.bottom+5;
  const root=new T.Group();root.name='ferry-coast';const time={value:0};
  const basin=new T.Group();basin.name='ferry-bay-basin';root.add(basin);
  const stone=new T.MeshStandardMaterial({color:'#8c9890',roughness:1,flatShading:true});
  const base=new T.Mesh(new T.BoxGeometry(FERRY_BAY.width+5,7,FERRY_BAY.depth+5),stone);
  base.name='ferry-bay-foundation';base.position.set(FERRY_BAY.x,-6,FERRY_BAY.z);basin.add(base);
  const rim=new T.InstancedMesh(new T.DodecahedronGeometry(1,0),stone,104),pose=new T.Object3D();rim.name='ferry-bay-rock-rim';
  let rockCount=0;
  for(let i=0;i<104;i++) {
    const side=Math.floor(i/26),t=(i%26)/25;
    pose.position.set(FERRY_BAY.x+(side<2?(t-.5)*FERRY_BAY.width:(side===2?-1:1)*FERRY_BAY.width/2),-.4,FERRY_BAY.z+(side<2?(side===0?-1:1)*FERRY_BAY.depth/2:(t-.5)*FERRY_BAY.depth));
    // Keep both landing areas and their sea approaches free of scenery.
    if(['dock','bossDock'].some(name=>{const dock=at(name as 'dock'|'bossDock');return Math.abs(pose.position.x-dock.x)<16&&Math.abs(pose.position.z-dock.z)<12;}))continue;
    const x=pose.position.x,z=pose.position.z;
    if((z>-35&&z<11&&x<gardenCoastX(z)+3)||(z>=bossTop-3&&z<=bossBottom+3&&x>bossCoastX(z)-3))continue;
    pose.scale.set(2.5+Math.sin(i*2)*.35,1.7+Math.cos(i*1.7)*.5,2.5);pose.rotation.set(i*.17,i*.7,0);pose.updateMatrix();rim.setMatrixAt(rockCount++,pose.matrix);
  }
  rim.count=rockCount;rim.computeBoundingSphere();rim.castShadow= rim.receiveShadow=true;basin.add(rim);
  const wake=Array.from({length:32},()=>new T.Vector4(0,0,-100,0));
  const wakeDirections=Array.from({length:32},()=>new T.Vector2(1,0));
  const wakeTime={value:0},boatFoam={value:new T.Vector4(0,0,0,0)},boatDirection={value:new T.Vector2(1,0)};
  let wakeIndex=0,wakeSample=0;
  const updateWake=(x:number,z:number,speed:number,dx:number,dz:number,dt:number)=>{
    wakeTime.value+=dt;wakeSample+=dt;
    boatFoam.value.set(x,z,Math.abs(speed),Math.sign(speed));boatDirection.value.set(dx,dz);
    if(Math.abs(speed)>.4&&wakeSample>=.1){wake[wakeIndex].set(x-dx*2.4*Math.sign(speed),z-dz*2.4*Math.sign(speed),wakeTime.value,Math.min(1,Math.abs(speed)/6));wakeDirections[wakeIndex].set(dx*Math.sign(speed),dz*Math.sign(speed));wakeIndex=(wakeIndex+1)%wake.length;wakeSample=0;}
  };
  const clearWake=()=>{wake.forEach(p=>p.set(0,0,-100,0));boatFoam.value.z=0;};
  const heightAt=(x:number,z:number)=>{
    const shore=Math.max(0,Math.min(Math.max(x-gardenCoastX(z),-32-z,z-8),Math.max(bossCoastX(z)-x,bossTop-z,z-bossBottom)));
    const fade=.15+.85*T.MathUtils.smoothstep(shore,1.5,7.5);
    const garden=Math.max(x-gardenCoastX(z),-32-z,z-8),boss=Math.max(bossCoastX(z)-x,bossTop-z,z-bossBottom);
    const side=garden<boss?1:-1,phase=((side*x+z*.08+time.value*1.65)/8.-.5)*Math.PI*2;
    const swell=swells.reduce((height,[kx,kz,amplitude,speed])=>height+amplitude*Math.sin(x*kx+z*kz-time.value*speed),0);
    return T.MathUtils.lerp(swell,.24*Math.cos(phase),1-T.MathUtils.smoothstep(shore,3,7))*fade;
  };
  // The boat and both shader stages sample the same travelling swells.
  const swellShader=`
    float seaShore(vec2 p) {
      float ga=max(0.,1.-pow((p.y+12.)/20.,2.)),ba=max(0.,1.-pow((p.y+15.)/13.,2.));
      float gardenX=102.5-5.8*ga*ga+.25*sin(p.y*.7)*ga;
      float bossX=127.5+uBossOffset+4.2*ba*ba+.16*sin(p.y*.9)*ba;
      return max(0.,min(max(p.x-gardenX,max(-32.-p.y,p.y-8.)),max(bossX-p.x,max(${bossTop.toFixed(1)}-p.y,p.y-${bossBottom.toFixed(1)}))));
    }
    vec3 seaSwell(vec2 p) {
      vec3 wave=vec3(0.);float phase;
      ${swells.map(([kx,kz,amplitude,speed])=>`phase=dot(p,vec2(${kx},${kz}))-uSeaTime*${speed};
        wave+=${amplitude}*vec3(sin(phase),${kx}*cos(phase),${kz}*cos(phase));`).join('\n')}
      float ga=max(0.,1.-pow((p.y+12.)/20.,2.)),ba=max(0.,1.-pow((p.y+15.)/13.,2.));
      float gardenX=102.5-5.8*ga*ga+.25*sin(p.y*.7)*ga,bossX=127.5+uBossOffset+4.2*ba*ba+.16*sin(p.y*.9)*ba;
      float garden=max(p.x-gardenX,max(-32.-p.y,p.y-8.)),boss=max(bossX-p.x,max(${bossTop.toFixed(1)}-p.y,p.y-${bossBottom.toFixed(1)}));
      float side=garden<boss?1.:-1.,incomingPhase=((side*p.x+p.y*.08+uSeaTime*1.65)/8.-.5)*6.283185;
      vec3 incoming=vec3(.24*cos(incomingPhase),-.24*sin(incomingPhase)*side*.785398,-.24*sin(incomingPhase)*.08*.785398);
      float shore=seaShore(p);
      return mix(wave,incoming,1.-smoothstep(3.,7.,shore))*(.15+.85*smoothstep(1.5,7.5,shore));
    }\n`;
  const vertices:number[]=[],colors:number[]=[];
  const sections=[[-.65,.026,'#85ab5b'],[0,.020,'#c6c58a'],[.55,-.04,'#e1cb98'],[1.3,-.30,'#c8b88c'],[2.4,-.96,'#8eaaa1'],[4,-1.7,'#72a6a1']] as const;
  for(const [edge,direction,z0,z1] of [[gardenCoastX,1,-32,8],[bossCoastX,-1,bossTop,bossBottom]] as const) {
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
  // Tileable cellular edges form foam filaments around clear water pockets.
  const foamSize=256,foamPixels=new Uint8Array(foamSize*foamSize*4),cells=9;
  const hash=(x:number,y:number)=>{const n=Math.sin(((x%cells+cells)%cells)*127.1+((y%cells+cells)%cells)*311.7)*43758.5453;return n-Math.floor(n);};
  for(let y=0;y<foamSize;y++)for(let x=0;x<foamSize;x++) {
    const u=x/foamSize*Math.PI*2,v=y/foamSize*Math.PI*2;
    const px=x/foamSize*cells+.44*Math.sin(v*3+Math.sin(u*2))+.18*Math.sin(u*5+v*4);
    const py=y/foamSize*cells+.44*Math.sin(u*3+Math.cos(v*2))+.18*Math.cos(v*5-u*4),ix=Math.floor(px),iy=Math.floor(py);
    let first=Infinity,second=Infinity;
    for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++) {
      const sx=ix+i+.05+.9*hash(ix+i,iy+j),sy=iy+j+.15+.7*hash(iy+j+23,ix+i+47);
      const distance=(px-sx)**2+(py-sy)**2;
      if(distance<first){second=first;first=distance;}else second=Math.min(second,distance);
    }
    const edge=Math.sqrt(second)-Math.sqrt(first),index=(y*foamSize+x)*4;
    foamPixels[index]=Math.round((1-T.MathUtils.smoothstep(edge,.01,.09))*255);
    foamPixels[index+1]=Math.round((1-T.MathUtils.smoothstep(edge,.03,.23))*255);
    foamPixels[index+2]=Math.round(Math.min(1,Math.sqrt(first))*255);foamPixels[index+3]=255;
  }
  const foamTexture=new T.DataTexture(foamPixels,foamSize,foamSize);foamTexture.name='ferry-foam-filaments';
  foamTexture.wrapS=foamTexture.wrapT=T.RepeatWrapping;foamTexture.magFilter=T.LinearFilter;foamTexture.minFilter=T.LinearMipmapLinearFilter;foamTexture.generateMipmaps=true;foamTexture.needsUpdate=true;
  const waterMaterial=new T.MeshStandardMaterial({color:'#258caa',roughness:.20,metalness:0,transparent:true,opacity:.93,depthWrite:false});
  waterMaterial.name='ferry-sea-water';waterMaterial.addEventListener('dispose',()=>{normals.dispose();foamTexture.dispose();});
  waterMaterial.onBeforeCompile=shader=>{
    shader.uniforms.uSeaTime=time;shader.uniforms.uFoamTexture={value:foamTexture};
    shader.uniforms.uWakeTime=wakeTime;shader.uniforms.uWake={value:wake};shader.uniforms.uWakeDirections={value:wakeDirections};shader.uniforms.uBoatFoam=boatFoam;shader.uniforms.uBoatDirection=boatDirection;
    shader.uniforms.uSeaNormals={value:normals};
    shader.uniforms.uBossOffset={value:BOSS_ISLAND_OFFSET_X};
    shader.uniforms.uBayBounds={value:new T.Vector4(FERRY_BAY.x-FERRY_BAY.width/2,FERRY_BAY.x+FERRY_BAY.width/2,FERRY_BAY.z-FERRY_BAY.depth/2,FERRY_BAY.z+FERRY_BAY.depth/2)};
    shader.vertexShader='uniform float uSeaTime,uBossOffset;\nvarying vec3 vSeaWorld;\n'+swellShader+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec2 p=(modelMatrix*vec4(position,1.)).xz;
      transformed.y+=seaSwell(p).x;
      vSeaWorld=(modelMatrix*vec4(transformed,1.)).xyz;`);
    shader.fragmentShader='uniform float uWakeTime;uniform vec4 uWake[32],uBoatFoam;uniform vec2 uBoatDirection,uWakeDirections[32];\nfloat foamHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat foamNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(foamHash(i),foamHash(i+vec2(1,0)),f.x),mix(foamHash(i+vec2(0,1)),foamHash(i+vec2(1,1)),f.x),f.y);}\nuniform float uSeaTime,uBossOffset;\nuniform sampler2D uSeaNormals,uFoamTexture;\nuniform vec4 uBayBounds;\nuniform mat3 normalMatrix;\nvarying vec3 vSeaWorld;\n'+swellShader+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 p=vSeaWorld.xz;
      float shore=seaShore(p);
      float shallow=1.-smoothstep(1.6,8.,shore);
      vec3 wave=seaSwell(p);
      float crest=smoothstep(.10,.40,wave.x);
      vec2 n1=texture2D(uSeaNormals,p*.085+vec2(-.012,.008)*uSeaTime).rg*2.-1.;
      vec2 n2=texture2D(uSeaNormals,mat2(.8,-.6,.6,.8)*p*.19+vec2(.009,-.014)*uSeaTime).rg*2.-1.;
      vec2 n3=texture2D(uSeaNormals,p*.43+vec2(-.018,-.011)*uSeaTime+n1*.13).rg*2.-1.;
      vec2 flow=p+vec2(foamNoise(p*.7-uSeaTime*.1),foamNoise(p*.6+3.+uSeaTime*.08))*.3;
      float broad=foamNoise(flow*2.+vec2(uSeaTime*.14,-uSeaTime*.2));
      float fine=foamNoise(flow*14.-uSeaTime*.35)*.55+foamNoise(flow*31.+uSeaTime*.24)*.3+foamNoise(flow*61.)*.15;
      float lace=smoothstep(.27,.69,fine+broad*.24);
      float bubbles=1.-smoothstep(.025,.12,abs(fine-.49));
      float ga=max(0.,1.-pow((p.y+12.)/20.,2.));
      float ba=max(0.,1.-pow((p.y+15.)/13.,2.));
      float gardenX=102.5-5.8*ga*ga+.25*sin(p.y*.7)*ga;
      float bossX=127.5+uBossOffset+4.2*ba*ba+.16*sin(p.y*.9)*ba;
      float gardenDistance=max(p.x-gardenX,max(-32.-p.y,p.y-8.));
      float bossDistance=max(bossX-p.x,max(${bossTop.toFixed(1)}-p.y,p.y-${bossBottom.toFixed(1)}));
      float shoreSide=gardenDistance<bossDistance?1.:-1.;
      float coastX=gardenDistance<bossDistance?gardenX:bossX;
      // Incoming world-space wave trains travel toward land; the coast only masks breaking depth.
      float travel=shoreSide*p.x+p.y*.08+uSeaTime*1.65;
      float wavePhase=fract(travel/8.);
      float waveDistance=abs(wavePhase-.5)*8.;
      float breakingDepth=smoothstep(.45,1.25,shore)*(1.-smoothstep(3.4,5.2,shore));
      float breaker=(1.-smoothstep(.12,.65,waveDistance+(broad-.5)*.2))*breakingDepth;
      // A crest reaching the beach starts uprush, then a slower draining backwash.
      float arrival=fract((shoreSide*coastX+p.y*.08+uSeaTime*1.65)/8.-.5);
      float uprush=clamp(arrival/.32,0.,1.);
      float backwash=clamp((arrival-.32)/.68,0.,1.);
      float waterline=arrival<.32?mix(2.1,.35,1.-pow(1.-uprush,2.)):mix(.35,2.1,backwash*backwash);
      float washLife=1.-smoothstep(.62,1.,arrival);
      float washFront=(1.-smoothstep(.08,.36,abs(shore-waterline)+(broad-.5)*.18))*washLife;
      float sheet=smoothstep(waterline-.12,waterline+.3,shore)*(1.-smoothstep(2.2,3.1,shore))*washLife;
      vec2 washUV=vec2(p.y*.25,shore*.45+waterline*.20);
      washUV+=vec2(foamNoise(p*.9+uSeaTime*.04),foamNoise(p*.8+7.-uSeaTime*.06))*.22;
      vec3 cellsA=texture2D(uFoamTexture,washUV).rgb;
      vec3 cellsB=texture2D(uFoamTexture,washUV*2.1+vec2(.23,-waterline*.09)).rgb;
      float breakup=smoothstep(.25,.64,foamNoise(p*1.2+vec2(-waterline*.3,0.)));
      float strands=smoothstep(.33,.59,foamNoise(p*3.4+waterline*.3));
      float filaments=(cellsA.r*breakup+cellsB.r*cellsA.g*.35)*strands;
      float membrane=cellsA.g*.13*breakup*strands;
      float brokenFront=smoothstep(.23,.7,broad)*(.25+cellsA.g*.6);
      float foam=(breaker*(filaments*.8+membrane)+washFront*brokenFront*.65+sheet*(filaments*.55+membrane))*smoothstep(.05,.4,shore);
      float residue=smoothstep(1.,1.8,shore)*(1.-smoothstep(3.,4.5,shore))*smoothstep(.54,.76,broad)*exp(-arrival*2.);
      foam+=residue*(filaments*.6+membrane);
      foam+=crest*crest*smoothstep(.1,.4,n2.x+n3.y)*smoothstep(3.,7.,shore)*.09;
      float trail=0.,arms=0.;
      for(int i=0;i<32;i++){
        float age=uWakeTime-uWake[i].z;
        vec2 offset=p-uWake[i].xy;
        vec2 direction=uWakeDirections[i];
        float longitudinal=dot(offset,direction);
        float lateral=abs(dot(offset,vec2(-direction.y,direction.x)));
        float spread=.7+age*.85;
        float longitudinalFade=(1.-smoothstep(.5,1.35,abs(longitudinal)))*(1.-smoothstep(2.,3.35,age));
        float arm=(1.-smoothstep(.13,.45+age*.1,abs(lateral-spread)+(broad-.5)*.3))*longitudinalFade;
        arms=max(arms,arm*exp(-age*.28)*uWake[i].w*step(0.,age));
        float churn=(1.-smoothstep(.18,.8+age*.17,lateral+(broad-.5)*.35))*longitudinalFade;
        trail=max(trail,churn*exp(-age*.55)*uWake[i].w*step(0.,age));
      }
      vec2 relative=p-uBoatFoam.xy;
      float along=dot(relative,uBoatDirection)*uBoatFoam.w;
      float across=abs(dot(relative,vec2(-uBoatDirection.y,uBoatDirection.x)));
      float hullWidth=.22+1.05*sqrt(max(0.,1.-pow(along/2.9,2.)));
      float hullFoam=(1.-smoothstep(.06,.32,abs(across-hullWidth)+(broad-.5)*.16))*(1.-smoothstep(2.5,3.1,abs(along)));
      float bow=(1.-smoothstep(.1,.4,abs(across-(.25+(2.9-along)*.52))))*smoothstep(.4,1.8,along)*(1.-smoothstep(2.6,3.3,along));
      float speedFoam=min(1.,uBoatFoam.z/5.);
      float wakeFoam=trail*(.22+lace*.75)+arms*(bubbles*.35+lace*.7)+(bow*.6+hullFoam*.85)*speedFoam*lace;
      foam=clamp(foam+wakeFoam,0.,.97);
      float caustic=pow(max(0.,1.-abs(n2.x+n3.y)*5.),4.)*shallow*.035;
      vec3 transmission=exp(-max(shore-1.5,0.)*.35*vec3(.85,.36,.22));
      diffuseColor.rgb=mix(vec3(.012,.115,.19),vec3(.17,.53,.43),transmission);
      diffuseColor.rgb+=vec3(.045,.085,.070)*(wave.x/.47)+caustic*vec3(.5,1.,.8);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.94,.985,1.),clamp(foam,0.,.96));
      float bayEdge=min(min(p.x-uBayBounds.x,uBayBounds.y-p.x),min(p.y-uBayBounds.z,uBayBounds.w-p.y));
      diffuseColor.a=mix(.98,.55,shallow)*smoothstep(0.,2.,bayEdge);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float detail=1.-smoothstep(18.,85.,length(vViewPosition));
      vec2 slopes=n1*.32+n2*.18+n3*.09*detail;
      slopes-=wave.yz;
      vec3 seaNormal=normalize(vec3(slopes.x,1.,slopes.y));
      normal=normalize(normalMatrix*seaNormal);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      vec3 eye=normalize(cameraPosition-vSeaWorld);
      vec3 reflected=reflect(-eye,seaNormal);
      float facing=max(dot(seaNormal,eye),0.);
      float fresnel=.025+.90*pow(1.-facing,4.);
      vec3 sky=mix(vec3(.57,.78,.84),vec3(.18,.46,.65),smoothstep(.0,.85,reflected.y));
      vec2 skyNoise=texture2D(uSeaNormals,reflected.xz/max(.18,reflected.y)*.10+vec2(.31,.19)).rg*2.-1.;
      float clouds=smoothstep(-.06,.22,skyNoise.x+skyNoise.y)*smoothstep(.08,.3,reflected.y);
      sky=mix(sky,vec3(.78,.86,.88),clouds*.55);
      outgoingLight=mix(outgoingLight,sky,fresnel*(1.-clamp(foam,0.,1.)));
      outgoingLight+=vec3(.025,.12,.075)*crest*(.2+.8*pow(1.-facing,2.))*(1.-clamp(foam,0.,1.));
      outgoingLight=mix(outgoingLight,vec3(.86,.95,.98),clamp(foam*.88,0.,.92));
      #include <opaque_fragment>`);
  };
  waterMaterial.customProgramCacheKey=()=> 'ferry-bay-v9-cellular-surf';
  // shortcut: analytic sky reflection and shoreline avoid scene re-renders; add planar/depth passes for reflected props or underwater cameras.
  const sea=new T.Mesh(new T.PlaneGeometry(FERRY_BAY.width,FERRY_BAY.depth,80,64).rotateX(-Math.PI/2),waterMaterial);
  sea.name='ferry-sea';sea.position.set(FERRY_BAY.x,FERRY_SEA_Y,FERRY_BAY.z);sea.receiveShadow=true;
  sea.geometry.computeBoundingSphere();sea.geometry.boundingSphere!.radius+=.47;root.add(sea);

  const reefs=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:'#8e9b88',roughness:.97,flatShading:true}),52);
  const dummy=new T.Object3D();let index=0;
  for(const [edge,direction,z0,z1] of [[gardenCoastX,1,-30,3],[bossCoastX,-1,bossTop+1,bossBottom-1.5]] as const)for(let i=0;i<26;i++) {
    let z=z0+i*(z1-z0)/25;if(direction>0&&z>-12.8&&z<-7.2)z-=6;if(direction<0&&z>-18.2&&z<-11.7)z-=7;
    dummy.position.set(edge(z)+direction*(1.7+(i%3)*.37),-.57+(i%3)*.1,z);
    dummy.scale.set(.45+(i%4)*.17,.35+(i%3)*.2,.42+(i%5)*.13);dummy.rotation.set(.12*Math.sin(i),i*2.3,.12*Math.cos(i));dummy.updateMatrix();reefs.setMatrixAt(index++,dummy.matrix);
  }
  reefs.name='ferry-shore-reefs';reefs.castShadow=reefs.receiveShadow=true;reefs.computeBoundingSphere();root.add(reefs);

  const contactMaterial=new T.ShaderMaterial({
    uniforms:{uSeaTime:time,uBossOffset:{value:BOSS_ISLAND_OFFSET_X},uFoamTexture:{value:foamTexture}},
    transparent:true,depthWrite:false,side:T.DoubleSide,
    vertexShader:'uniform float uSeaTime,uBossOffset;varying vec2 vFoamUv;varying vec2 vFoamWorld;'+swellShader+
      'void main(){vFoamUv=uv;vec4 p=modelMatrix*instanceMatrix*vec4(position,1.);vFoamWorld=p.xz;p.y='+FERRY_SEA_Y+'+.035+seaSwell(p.xz).x;gl_Position=projectionMatrix*viewMatrix*p;}',
    fragmentShader:`uniform float uSeaTime;uniform sampler2D uFoamTexture;varying vec2 vFoamUv,vFoamWorld;
      void main(){
        vec2 q=(vFoamUv-.5)*2.;float radius=length(q);
        vec3 pattern=texture2D(uFoamTexture,vFoamWorld*.38+vec2(sin(uSeaTime*.5+vFoamWorld.y)*.04,uSeaTime*.025)).rgb;
        float ring=smoothstep(.37,.55,radius)*(1.-smoothstep(.7,1.,radius+(pattern.b-.5)*.12));
        float wash=.45+.4*sin(uSeaTime*1.3+vFoamWorld.y*.25);
        gl_FragColor=vec4(.84,.94,.91,ring*(pattern.r*.65+pattern.g*.12)*wash);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const rockFoam=new T.InstancedMesh(new T.PlaneGeometry(2,2,4,4).rotateX(-Math.PI/2),contactMaterial,reefs.count);rockFoam.name='ferry-rock-contact-foam';
  for(let i=0;i<reefs.count;i++){
    reefs.getMatrixAt(i,dummy.matrix);dummy.matrix.decompose(dummy.position,dummy.quaternion,dummy.scale);
    dummy.rotation.set(0,i*2.3,0);dummy.scale.set(dummy.scale.x*1.6,1,dummy.scale.z*1.6);dummy.updateMatrix();rockFoam.setMatrixAt(i,dummy.matrix);
  }
  rockFoam.computeBoundingSphere();root.add(rockFoam);

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
  const sign=new T.Group();sign.name='ferry-boarding-sign';sign.position.set(94.6,0,-11.35);sign.scale.setScalar(1.65);props.add(sign);
  add(sign,new T.CylinderGeometry(.065,.09,1.38,10),timber,0,.69,0);
  const arrow=new T.Shape();arrow.moveTo(-.70,.87);arrow.lineTo(.36,.87);arrow.lineTo(.36,.77);arrow.lineTo(.79,1.09);arrow.lineTo(.36,1.41);arrow.lineTo(.36,1.31);arrow.lineTo(-.70,1.31);arrow.closePath();
  add(sign,new T.ExtrudeGeometry(arrow,{depth:.08,bevelEnabled:true,bevelSize:.025,bevelThickness:.02,bevelSegments:2,steps:1}),timber,0,0,0);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#fff0c8';ctx.font='bold 96px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(mt('boardingSign'),256,80,490);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const label=add(sign,new T.PlaneGeometry(1.03,.32),new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}),-.12,1.09,.105);
  const back=label.clone();back.position.z=-.045;back.rotation.y=Math.PI;sign.add(back);
  batchTreasureParts(sign);
  return {root,time,heightAt,terrain,wake,updateWake,clearWake,colliders:[{x:96.35,y:1.3,z:-11.35,width:.24,height:2.6,depth:.24},{x:94.6,y:1.155,z:-11.35,width:.33,height:2.31,depth:.33}]};
}




