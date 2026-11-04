import * as T from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createPlayerCharacter, type Expression } from './character';
import { rounded } from './puzzle-art';
import { batchTreasureParts } from './treasure-details';

const material=(color:string)=>new T.MeshStandardMaterial({color,roughness:.78});
const skin=material('#ffe4b6'),coral=material('#dd7966'),petalBack=material('#c96b5c');
const green=material('#799342'),strap=material('#637d36'),clay=material('#c67c48');
const pollen=material('#f1c856'),seed=material('#f5df9f'),soil=material('#744238');
const sphere=new T.SphereGeometry(1,32,24);
const shoe=new T.LatheGeometry([[0,-.68],[.70,-.68],[.94,-.66],[1,-.62],[1,-.55],[.92,-.49],[.45,-.455],[0,-.455]].map(([r,y])=>new T.Vector2(r,y)),24);
const faces=new Map<Expression,T.MeshStandardMaterial>();
type ScoutIdle={time:number;near:boolean;lastGreeting:number;greetAt:number;gait:number;phase:string};

export function setGardenScoutExpression(root:T.Group,expression:Expression) {
  if(root.userData.expression===expression)return;
  if(!faces.has(expression)) {
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=768;
    const c=canvas.getContext('2d')!;
    const ellipse=(x:number,y:number,rx:number,ry:number,color:string)=>{
      c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();
    };
    for(const x of [235,789])ellipse(x,440,65,43,'#efb08b');
    c.strokeStyle='#60383c';c.lineWidth=15;c.lineCap='round';
    for(const x of [310,714]) {
      if(expression==='happy') {
        c.beginPath();c.moveTo(x-36,315);c.quadraticCurveTo(x,265,x+36,315);c.stroke();
      } else {
        const glance=expression==='thinking'?-15:0;
        ellipse(x+glance,310,48,expression==='surprised'?58:49,'#60383c');
        ellipse(x-10+glance,296,10,11,'#fff4d9');
        if(expression==='worried'||expression==='thinking'||expression==='determined') {
          c.beginPath();c.moveTo(x-38,235);c.lineTo(x+38,x<512?215:245);c.stroke();
        }
      }
    }
    if(expression==='surprised')ellipse(512,465,25,34,'#60383c');
    else {
      c.beginPath();c.moveTo(470,452);
      c.quadraticCurveTo(512,expression==='worried'?420:expression==='thinking'?452:510,554,452);c.stroke();
    }
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
    faces.set(expression,new T.MeshStandardMaterial({map,transparent:true,depthWrite:false,roughness:.8,polygonOffset:true,polygonOffsetFactor:-1}));
  }
  (root.getObjectByName('face') as T.Mesh).material=faces.get(expression)!;
  root.userData.expression=expression;
}

export function createGardenScout():T.Group {
  const root=createPlayerCharacter();root.name='garden-scout';root.userData.character='poppy';
  root.remove(root.getObjectByName('player-marker')!);
  const avatar=root.getObjectByName('avatar')!,upper=new T.Group();upper.name='scout-upper';avatar.add(upper);
  for(const name of ['body','face','arm-1','arm1'])upper.add(root.getObjectByName(name)!);
  const part=(parent:T.Object3D,geometry:T.BufferGeometry,mat:T.Material,position:number[],scale=[1,1,1])=>{
    const mesh=new T.Mesh(geometry,mat);mesh.position.fromArray(position);mesh.scale.fromArray(scale);
    mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  const group=(parent:T.Object3D,name:string)=>{const g=new T.Group();g.name=name;parent.add(g);return g;};
  const tube=(parent:T.Object3D,points:number[][],mat:T.Material,radius:number)=>
    part(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3().fromArray(p))),16,radius,8),mat,[0,0,0]);
  const body=root.getObjectByName('body') as T.Mesh;body.material=skin;body.geometry=sphere.clone();
  const headPositions=body.geometry.attributes.position;
  for(let i=0;i<headPositions.count;i++)headPositions.setX(i,headPositions.getX(i)*(1-.12*headPositions.getY(i)));
  body.geometry.computeVertexNormals();body.position.y=.39;body.scale.set(.51,.38,.405);
  const torso=part(upper,sphere,skin,[0,-.17,.025],[.40,.28,.32]);torso.name='poppy-torso';
  const face=root.getObjectByName('face') as T.Mesh;
  face.geometry=face.geometry.clone();face.scale.z=1;
  const fp=face.geometry.attributes.position;
  for(let i=0;i<fp.count;i++) {
    const x=fp.getX(i)*.90,y=fp.getY(i)*.62+.39,ny=(y-.39)/.38;
    fp.setXYZ(i,x,y,-.405*Math.sqrt(Math.max(.01,1-(x/(.51*(1-.12*ny)))**2-ny*ny))-.004);
  }
  face.geometry.computeVertexNormals();
  const boots=group(avatar,'poppy-boots');
  for(const side of [-1,1]) {
    avatar.remove(root.getObjectByName('ear'+side)!);
    const arm=root.getObjectByName('arm'+side)!;arm.position.set(side*.42,-.11,-.015);
    const hand=arm.children[0] as T.Mesh;hand.geometry=sphere;hand.material=skin;
    hand.position.set(side*.10,-.02,-.025);hand.scale.set(.14,.15,.145);
    const foot=root.getObjectByName('foot'+side) as T.Mesh;
    foot.geometry=shoe;foot.material=clay;foot.position.set(side*.235,0,-.04);foot.scale.set(.15,1,.18);boots.add(foot);
    part(foot,sphere,skin,[0,-.40,0],[.065/.15,.055,.065/.18]);
  }
  const freeArm=root.getObjectByName('arm1')!;freeArm.position.y=.04;
  freeArm.children[0].position.set(.16,-.17,-.025);

  const hood=group(upper,'poppy-flower-hood');
  part(hood,sphere,petalBack,[0,.48,.30],[.48,.43,.36]);
  const outline=new T.Shape();outline.moveTo(-.08,.08);
  outline.bezierCurveTo(-.27,.28,-.37,.55,-.27,.80);
  outline.quadraticCurveTo(-.10,.88,0,.92);
  outline.quadraticCurveTo(.10,.88,.27,.80);
  outline.bezierCurveTo(.37,.55,.27,.28,.08,.08);outline.closePath();
  const rawPetal=new T.ExtrudeGeometry(outline,{depth:.19,bevelEnabled:true,bevelSize:.045,bevelThickness:.06,bevelSegments:3,curveSegments:12,steps:1});
  const positions=rawPetal.attributes.position;
  for(let i=0;i<positions.count;i++)positions.setZ(i,positions.getZ(i)-.42*positions.getY(i)**2);
  rawPetal.deleteAttribute('uv');rawPetal.deleteAttribute('normal');
  const petal=mergeVertices(rawPetal);petal.computeVertexNormals();rawPetal.dispose();
  for(let i=0;i<5;i++) {
    const mesh=part(hood,petal,i%2?petalBack:coral,[0,.42,.22]);mesh.rotation.z=(i-.5)*Math.PI*2/5;
    if(i===3)mesh.scale.y=.30;
  }
  for(const [x,y] of [[-.14,1.20],[0,1.32],[.14,1.20]]) {
    tube(hood,[[0,.93,.19],[x*.55,1.10,.20],[x,y,.21]],pollen,.022);
    part(hood,sphere,pollen,[x,y,.21],[.061,.066,.061]);
  }
  batchTreasureParts(hood);

  const apron=group(upper,'poppy-apron');
  // Let the apron hang in front of the belly instead of following its shaded underside.
  const bibPositions:number[]=[],bibIndices:number[]=[];
  for(let row=0;row<=16;row++)for(let col=0;col<=16;col++) {
    const t=row/16,y=-.40*t+.025*(col/8-1)**2,x=(col/8-1)*(.25+.11*Math.sin(t*Math.PI));
    bibPositions.push(x,y,-.255-.09*Math.sin(t*Math.PI)+.08*(x/.36)**2+.04*t);
    if(row<16&&col<16){const a=row*17+col;bibIndices.push(a,a+17,a+1,a+17,a+18,a+1);}
  }
  const bib=new T.BufferGeometry();bib.setAttribute('position',new T.Float32BufferAttribute(bibPositions,3));bib.setIndex(bibIndices);bib.computeVertexNormals();
  const apronMaterial=green.clone();apronMaterial.side=T.DoubleSide;
  part(apron,bib,apronMaterial,[0,0,0]);
  for(const side of [-1,1]) {
    tube(apron,[[side*.23,-.10,-.27],[side*.27,.035,-.15],[side*.30,.06,.03],[side*.25,-.02,.22],[-side*.24,-.30,.25]],strap,.027);
  }
  part(apron,rounded(.34,.18,.035,.035),green,[0,-.24,-.33]);
  for(const side of [-1,1]) {
    const half=part(apron,sphere,seed,[side*.026,-.24,-.353],[.025,.055,.009]);half.rotation.z=side*.16;
  }
  batchTreasureParts(apron);

  const can=group(root.getObjectByName('arm-1')!,'poppy-watering-can');can.position.set(-.18,-.28,-.04);
  part(can,new T.CylinderGeometry(.16,.18,.27,24),clay,[0,0,0]);
  const opening=part(can,new T.CylinderGeometry(.11,.11,.008,20),soil,[0,.137,0]);opening.castShadow=false;
  part(can,new T.TorusGeometry(.13,.025,8,24),clay,[0,.14,0]).rotation.x=Math.PI/2;
  tube(can,[[-.11,.10,0],[-.13,.32,0],[.10,.32,0],[.12,.10,0]],clay,.035);
  tube(can,[[-.11,-.06,0],[-.24,.01,0],[-.36,.17,0]],clay,.047);
  const rose=group(can,'poppy-can-rose');rose.position.set(-.37,.18,0);rose.rotation.z=.65;
  part(rose,new T.CylinderGeometry(.078,.055,.06,16),clay,[0,0,0]);
  for(let i=0;i<5;i++)part(rose,sphere,soil,[Math.cos(i*Math.PI*2/5)*.043,.033,Math.sin(i*Math.PI*2/5)*.043],[.009,.004,.009]);
  batchTreasureParts(can);
  root.userData.expression=undefined;resetGardenScout(root);return root;
}

export function resetGardenScout(root:T.Group) {
  root.userData.scoutIdle={time:0,near:false,lastGreeting:-100,greetAt:-100,gait:0,phase:'rest'} satisfies ScoutIdle;
  animateGardenScout(root,0,false,true);
}

export function animateGardenScout(root:T.Group,time:number,near:boolean,reducedMotion:boolean,talking=false,walkingSpeed=0) {
  if(!root.userData.scoutIdle||time<root.userData.scoutIdle.time)resetGardenScout(root);
  const state=root.userData.scoutIdle as ScoutIdle,enabled=!reducedMotion&&!talking;
  const dt=T.MathUtils.clamp(time-state.time,0,.2),walking=enabled&&!near&&walkingSpeed>0;
  if(walking)state.gait+=dt*walkingSpeed/(root.scale.z*.56)*Math.PI*2;
  if(near&&!state.near&&time-state.lastGreeting>=8&&enabled)state.greetAt=state.lastGreeting=time;
  if(talking||reducedMotion)state.greetAt=Math.min(state.greetAt,time-3);
  const elapsed=time-state.greetAt,cycle=time%16;
  const wave=enabled&&near?T.MathUtils.smoothstep(elapsed,0,.25)*(1-T.MathUtils.smoothstep(elapsed,1.85,2.35)):0;
  const tending=enabled&&!near&&!walking?T.MathUtils.smoothstep(cycle,3,4)*(1-T.MathUtils.smoothstep(cycle,6,7)):0;
  const upper=root.getObjectByName('scout-upper')!;
  upper.position.y=reducedMotion?0:Math.sin(time*1.8)*.006;
  upper.rotation.set(.04*tending,0,enabled&&!near?Math.sin(time*.7)*.008:0);
  for(const side of [-1,1]) {
    const foot=root.getObjectByName('foot'+side)!,phase=(state.gait+(side===1?Math.PI:0))%(Math.PI*2),swing=phase>Math.PI;
    foot.position.y=walking&&swing?Math.sin(phase-Math.PI)*.018:0;
    foot.position.z=-.04+(walking?.14*(swing?-1+2*(phase-Math.PI)/Math.PI:1-2*phase/Math.PI):0);
    foot.rotation.x=walking&&swing?Math.sin(phase-Math.PI)*-.02:0;
  }
  root.getObjectByName('poppy-flower-hood')!.rotation.z=enabled?Math.sin(time*.8)*.012:0;
  root.getObjectByName('arm-1')!.rotation.z=-.24*tending;
  root.getObjectByName('arm-1')!.rotation.x=walking?Math.sin(state.gait)*.10:0;
  root.getObjectByName('poppy-watering-can')!.rotation.z=-.28*tending;
  root.getObjectByName('arm1')!.rotation.z=T.MathUtils.lerp(.05,1.35+.24*Math.sin(T.MathUtils.clamp(elapsed-.25,0,1.6)/1.6*Math.PI*4),wave);
  root.getObjectByName('arm1')!.rotation.x=walking?-Math.sin(state.gait)*.22:0;
  if(!talking)setGardenScoutExpression(root,wave>0||enabled&&time%4.8>4.65?'happy':'neutral');
  state.phase=talking?'talking':wave>0?'greeting':near?'attentive':walking?'walking':tending>0?'tending':'rest';
  state.near=near;state.time=time;
}
