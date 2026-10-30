import * as T from 'three';
import { createPlayerCharacter, setCharacterExpression } from './character';
import { rounded } from './puzzle-art';
import { batchTreasureParts } from './treasure-details';

const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
const weave=canvas.getContext('2d')!;weave.fillStyle='#f5f3ec';weave.fillRect(0,0,128,128);
for(let i=0;i<128;i+=4) {
  weave.fillStyle=i%8?'#e8e6de':'#ffffff';weave.fillRect(i,0,1,128);
  weave.fillStyle='#eae8e1';weave.fillRect(0,i,128,1);
}
const fabric=new T.CanvasTexture(canvas);fabric.colorSpace=T.SRGBColorSpace;
fabric.wrapS=fabric.wrapT=T.RepeatWrapping;fabric.repeat.set(3,3);
const cloth=(color:string)=>new T.MeshStandardMaterial({color,map:fabric,roughness:.85,side:T.DoubleSide});
const skin=new T.MeshStandardMaterial({color:'#e5eacb',roughness:.66});
const sage=cloth('#88a77d'),moss=cloth('#6b9372'),forest=cloth('#487259'),cream=cloth('#f3e5c9');
const vein=new T.MeshStandardMaterial({color:'#b9c99c',roughness:.8});
const leather=new T.MeshStandardMaterial({color:'#a2714d',roughness:.7,side:T.DoubleSide});
const edge=new T.MeshStandardMaterial({color:'#ccaa77',roughness:.76});
const gold=new T.MeshStandardMaterial({color:'#d7b261',roughness:.35,metalness:.5});
const wood=new T.MeshStandardMaterial({color:'#b68c5a',roughness:.75});
const boot=new T.MeshStandardMaterial({color:'#426c50',roughness:.72});
const sole=new T.MeshStandardMaterial({color:'#76593d',roughness:.85});
const sphere=new T.SphereGeometry(1,24,16),box=rounded(1,1,1,.09);
const shoeShape=new T.LatheGeometry([[0,-.642],[.90,-.642],[1,-.63],[1.03,-.59],[.96,-.51],[.78,-.45],[.42,-.414],[0,-.408]]
  .map(([r,y])=>new T.Vector2(r,y)),24);
const soleShape=new T.LatheGeometry([[0,-.68],[.90,-.68],[1.02,-.669],[1.04,-.648],[1.02,-.631],[.96,-.625],[0,-.625]]
  .map(([r,y])=>new T.Vector2(r,y)),24);
const bootShaft=new T.CylinderGeometry(.125,.145,.27,16);
const v=(p:number[])=>new T.Vector3(p[0],p[1],p[2]);
const mapCanvas=document.createElement('canvas');mapCanvas.width=256;mapCanvas.height=160;
const ink=mapCanvas.getContext('2d')!;ink.fillStyle='#efe0b6';ink.fillRect(0,0,256,160);
ink.strokeStyle='#b49a66';ink.lineWidth=3;ink.strokeRect(7,7,242,146);
for(const [x,y,rx,ry] of [[55,106,32,22],[126,73,37,24],[204,42,28,20]]) {
  ink.fillStyle='#a8bb85';ink.beginPath();ink.ellipse(x,y,rx,ry,-.3,0,Math.PI*2);ink.fill();
}
ink.strokeStyle='#8b734a';ink.lineWidth=4;ink.setLineDash([7,5]);ink.beginPath();
ink.moveTo(30,125);ink.bezierCurveTo(82,129,89,83,129,73);ink.bezierCurveTo(172,62,174,39,224,32);ink.stroke();
ink.setLineDash([]);ink.fillStyle='#d29845';ink.beginPath();ink.arc(224,32,9,0,Math.PI*2);ink.fill();
const mapTexture=new T.CanvasTexture(mapCanvas);mapTexture.colorSpace=T.SRGBColorSpace;
const paper=new T.MeshStandardMaterial({map:mapTexture,roughness:.95,side:T.DoubleSide});
const sleeveGeometry=new T.CylinderGeometry(.075,.105,1,12),up=new T.Vector3(0,1,0);
type ScoutIdle={time:number;near:boolean;lastGreeting:number;greetAt:number;pending:boolean;map:number;rotor:number;phase:string};

function surface(rows:number,columns:number,point:(t:number,s:number)=>T.Vector3) {
  const positions:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++) {
    positions.push(...point(row/rows,col/columns).toArray());uv.push(col/columns,row/rows);
  }
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++) {
    const a=row*(columns+1)+col,b=a+columns+1;indices.push(a,b,a+1,b,b+1,a+1);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function createGardenScout():T.Group {
  const root=createPlayerCharacter();root.name='garden-scout';
  root.remove(root.getObjectByName('player-marker')!);
  const avatar=root.getObjectByName('avatar')!,upper=new T.Group();upper.name='scout-upper';avatar.add(upper);
  for(const name of ['body','face','arm-1','arm1'])upper.add(root.getObjectByName(name)!);
  const body=root.getObjectByName('body') as T.Mesh;body.material=skin;body.geometry=sphere;
  const face=root.getObjectByName('face') as T.Mesh;
  // Fit the smaller face to the body surface so the costume cannot intersect a floating decal.
  face.geometry=face.geometry.clone();face.scale.z=1;
  const fp=face.geometry.attributes.position;
  for(let i=0;i<fp.count;i++) {
    const x=fp.getX(i)*.88,y=fp.getY(i)*.76+.09;
    fp.setXYZ(i,x,y,-.53*Math.sqrt(Math.max(0,1-x*x/(.56*.56)-y*y/(.56*.56)))-.004);
  }
  face.geometry.computeVertexNormals();
  const part=(parent:T.Object3D,geometry:T.BufferGeometry,material:T.Material,x=0,y=0,z=0,sx=1,sy=sx,sz=sx)=>{
    const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);
    mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  const group=(parent:T.Object3D,name:string)=>{
    const g=new T.Group();g.name=name;parent.add(g);return g;
  };
  const tube=(parent:T.Object3D,points:number[][],material:T.Material,radius=.007)=>{
    const curve=points.length===2?new T.LineCurve3(v(points[0]),v(points[1])):new T.CatmullRomCurve3(points.map(v));
    return part(parent,new T.TubeGeometry(curve,points.length===2?1:24,radius,5),material);
  };
  const stitches=(parent:T.Object3D,points:number[][],count=14)=>{
    const curve=new T.CatmullRomCurve3(points.map(v));
    for(let i=0;i<count;i++)tube(parent,[curve.getPoint(i/count).toArray(),curve.getPoint((i+.52)/count).toArray()],cream,.003);
  };
  const leaf=(parent:T.Object3D,points:number[][],width:number,material:T.Material,normal=new T.Vector3(0,0,-1),stitched=false,bodyFit=false)=>{
    const curve=new T.CatmullRomCurve3(points.map(v));
    const point=(t:number,s:number)=>{
      const across=new T.Vector3().crossVectors(curve.getTangent(t),normal).normalize();
      const p=curve.getPoint(t).addScaledVector(across,(s*2-1)*Math.pow(Math.sin(Math.PI*t),.7)*width)
        .addScaledVector(normal,Math.sin(Math.PI*t)*.035*(1-(s*2-1)**2));
      if(bodyFit)p.z=Math.sign(normal.z)*(.53*Math.sqrt(Math.max(.01,1-(p.x/.56)**2-(p.y/.56)**2))+.025);
      return p;
    };
    part(parent,surface(16,8,point),material);
    tube(parent,Array.from({length:13},(_,i)=>point(i/12,.5).addScaledVector(normal,.005).toArray()),vein,.005);
    for(const side of [0,1]) {
      tube(parent,Array.from({length:17},(_,i)=>point(i/16,side).toArray()),stitched?edge:material,.007);
      if(stitched)stitches(parent,Array.from({length:17},(_,i)=>point(.04+i*.92/16,side?.92:.08).addScaledVector(normal,.006).toArray()),12);
    }
  };

  for(const side of [-1,1]) {
    avatar.remove(root.getObjectByName('ear'+side)!);
    const hand=root.getObjectByName('arm'+side)!.children[0] as T.Mesh;hand.material=skin;hand.geometry=sphere;
    const foot=root.getObjectByName('foot'+side) as T.Mesh;foot.material=boot;foot.geometry=shoeShape;
    foot.position.set(side*.30,0,-.13);foot.scale.set(.225,1,.295);
  }
  const freeArm=root.getObjectByName('arm1')!;freeArm.position.set(.48,.02,-.01);
  freeArm.children[0].position.set(.19,-.13,-.06);
  const sleeve=part(freeArm,sleeveGeometry,forest);sleeve.name='scout-free-sleeve';
  const boots=group(avatar,'scout-boot-details'),soles=group(avatar,'scout-soles');
  for(const side of [-1,1]) {
    part(soles,soleShape,sole,side*.30,0,-.13,.23,1,.30);
    // The solid shaft overlaps both body and shoe throughout the breathing cycle.
    part(boots,bootShaft,boot,side*.30,-.385,-.035);
    const cuff=part(boots,new T.TorusGeometry(.135,.018,6,20),forest,side*.3,-.39,-.035);cuff.rotation.x=Math.PI/2;
    tube(boots,[[side*.3,-.48,-.395],[side*.3,-.55,-.414],[side*.3,-.61,-.37]],edge,.004);
  }
  batchTreasureParts(boots);batchTreasureParts(soles);

  const hood=group(upper,'scout-leaf-hood');
  const capPoint=(t:number,a:number)=>{
    const lobe=.5+.5*Math.cos(5*a),radius=.72*t*(.90+.14*lobe);
    return new T.Vector3(Math.sin(a)*radius,.67-(.22+.14*lobe)*Math.pow(t,1.7)+.055*Math.cos(a)*t-.18*Math.max(0,-Math.cos(a))*t*t,-Math.cos(a)*radius*.87+.035);
  };
  for(let panel=0;panel<5;panel++) {
    const start=(panel-.5)*Math.PI*2/5,end=start+Math.PI*2/5+.045;
    const panelPoint=(t:number,s:number)=>capPoint(t,start+(end-start)*s).add(new T.Vector3(0,panel*.004,0));
    part(hood,surface(16,12,panelPoint),panel%2?sage:moss);
    tube(hood,Array.from({length:17},(_,i)=>panelPoint(1,i/16).toArray()),cream,.012);
    stitches(hood,Array.from({length:17},(_,i)=>panelPoint(.96,i/16).add(new T.Vector3(0,.007,0)).toArray()),15);
    tube(hood,Array.from({length:13},(_,i)=>panelPoint(i/12,.5).add(new T.Vector3(0,.008,0)).toArray()),vein,.006);
  }
  for(const side of [-1,1]) {
    part(hood,sphere,forest,side*.49,.22,.055,.105,.19,.24);
    leaf(hood,[[0,.65,.04],[side*.12,.72,.03],[side*.3,.73,.04]],.065,sage);
  }
  leaf(hood,[[0,.64,.04],[.015,.85,.06],[.14,1.02,.065],[.28,.99,.04],[.23,.84,.025]],.11,sage);
  const badge=group(hood,'scout-wind-badge');badge.position.set(.40,.44,-.48);badge.rotation.y=-.55;
  part(badge,new T.CylinderGeometry(.082,.082,.028,24),gold).rotation.x=Math.PI/2;
  part(badge,new T.CylinderGeometry(.062,.062,.032,24),sole,0,0,-.006).rotation.x=Math.PI/2;
  const needle=new T.Shape();needle.moveTo(0,.061);needle.lineTo(-.023,0);needle.lineTo(0,-.061);needle.lineTo(.023,0);needle.closePath();
  part(badge,new T.ExtrudeGeometry(needle,{depth:.009,bevelEnabled:false}),gold,0,0,-.035).rotation.z=-.28;
  batchTreasureParts(hood);

  const cape=group(upper,'scout-leaf-cape');
  for(const a of [-.88,0,.88]) {
    const normal=new T.Vector3(Math.sin(a),0,Math.cos(a));
    leaf(cape,[[Math.sin(a)*.43,-.10,Math.cos(a)*.54],[Math.sin(a)*.43,-.30,Math.cos(a)*.49],
      [Math.sin(a)*.30,a===0?-.51:-.48,Math.cos(a)*.31]],a===0?.28:.17,a===0?forest:moss,normal,true,true);
  }
  for(const side of [-1,1])leaf(cape,[[side*.25,-.19,-.49],[side*.28,-.34,-.44],[side*.21,-.48,-.30]],.14,moss,new T.Vector3(0,0,-1),true,true);
  batchTreasureParts(cape);

  const scarf=group(upper,'scout-scarf');
  const collar=part(scarf,new T.TorusGeometry(.50,.075,10,48),cream,0,-.13,0,1.1,1,1);collar.rotation.x=Math.PI/2;
  tube(scarf,[[-.44,-.10,-.28],[-.25,-.14,-.48],[0,-.19,-.52],[.25,-.13,-.48],[.44,-.08,-.28]],cream,.042);
  const tailCurve=new T.CatmullRomCurve3([v([.12,-.12,.53]),v([.29,-.25,.64]),v([.45,-.28,.62]),v([.51,-.23,.58])]);
  part(scarf,surface(18,4,(t,s)=>tailCurve.getPoint(t).add(new T.Vector3(0,(s-.5)*.13,Math.sin(t*Math.PI)*Math.sin(s*Math.PI)*.02))),cream);
  part(scarf,new T.TorusGeometry(.045,.012,6,20),gold,0,-.17,-.565);
  batchTreasureParts(scarf);

  const strap=group(upper,'scout-map-strap');
  for(const [points,sign] of [
    [[[-.35,-.15,-.40],[-.12,-.23,-.47],[.18,-.30,-.43],[.42,-.33,-.22],[.49,-.30,-.20]],-1],
    [[[-.35,-.15,-.40],[-.53,-.15,.02],[-.35,-.15,.43],[0,-.26,.51],[.36,-.36,.31],[.53,-.31,.03],[.49,-.30,-.20]],1]
  ] as [number[][],number][]) {
    const curve=new T.CatmullRomCurve3(points.map(v));
    part(strap,surface(32,2,(t,s)=>curve.getPoint(t).addScaledVector(new T.Vector3().crossVectors(curve.getTangent(t),new T.Vector3(0,0,sign)).normalize(),(s-.5)*.06)),leather);
  }
  batchTreasureParts(strap);

  const bag=group(upper,'scout-map-satchel');bag.position.set(.49,-.30,-.20);bag.rotation.y=.22;
  part(bag,box,leather,0,0,0,.29,.29,.19);
  tube(bag,[[-.13,.13,-.103],[-.14,-.10,-.103],[-.10,-.14,-.103],[.10,-.14,-.103],[.14,-.10,-.103],[.13,.13,-.103]],edge,.008);
  const flapShape=new T.Shape();flapShape.moveTo(-.145,.14);flapShape.lineTo(.145,.14);flapShape.lineTo(.13,.025);
  flapShape.quadraticCurveTo(0,-.10,-.13,.025);flapShape.closePath();
  part(bag,new T.ExtrudeGeometry(flapShape,{depth:.016,bevelEnabled:true,bevelSize:.009,bevelThickness:.006,bevelSegments:2,steps:1,curveSegments:12}),leather,0,0,-.13);
  leaf(bag,[[0,.11,-.149],[0,.05,-.16],[0,-.035,-.16]],.045,sage);
  part(bag,sphere,gold,0,.003,-.18,.025);
  stitches(bag,[[-.12,.12,-.15],[-.11,.035,-.15],[0,-.055,-.15],[.11,.035,-.15],[.12,.12,-.15]],15);
  part(bag,new T.CylinderGeometry(.054,.054,.047,16),leather,.20,-.02,0);
  batchTreasureParts(bag);
  const roll=group(bag,'scout-map-roll');roll.position.set(.20,.03,0);
  part(roll,new T.LatheGeometry([new T.Vector2(.035,-.15),new T.Vector2(.052,-.15),new T.Vector2(.052,.18),new T.Vector2(.035,.18)],20),cream);
  part(roll,new T.TorusGeometry(.044,.009,6,20),cream,0,.18,0).rotation.x=Math.PI/2;
  batchTreasureParts(roll);
  const map=group(upper,'scout-open-map');
  part(map,surface(8,16,(t,s)=>new T.Vector3((s-.5)*.56,(t-.5)*.34,Math.abs(s-.5)**3*.08)),paper);
  batchTreasureParts(map);

  const staff=group(root.getObjectByName('arm-1')!,'scout-wind-staff');
  part(staff,new T.CylinderGeometry(.028,.036,1.25,12),wood,-.16,.10,-.08);
  tube(staff,[[-.17,-.45,-.105],[-.18,-.05,-.106],[-.16,.35,-.106],[-.17,.64,-.105]],edge,.0035);
  const ribbonCurve=new T.CatmullRomCurve3([v([-.16,.60,-.13]),v([-.27,.49,-.14]),v([-.30,.36,-.12]),v([-.26,.30,-.09])]);
  part(staff,surface(16,4,(t,s)=>ribbonCurve.getPoint(t).add(new T.Vector3((s-.5)*.09,0,Math.sin(t*Math.PI)*.02))),cream);
  batchTreasureParts(staff);
  const rotor=group(root.getObjectByName('arm-1')!,'scout-pinwheel');rotor.position.set(-.16,.75,-.10);
  for(let i=0;i<3;i++) {
    const blade=group(rotor,'pinwheel-blade'+i);blade.rotation.z=i*Math.PI*2/3;
    leaf(blade,[[0,0,0],[-.08,.10,-.02],[-.09,.24,.02],[.02,.31,.02]],.085,i%2?moss:sage);
  }
  part(rotor,sphere,gold,0,0,-.04,.043);batchTreasureParts(rotor);
  resetGardenScout(root);return root;
}

export function resetGardenScout(root:T.Group) {
  root.userData.scoutIdle={time:0,near:false,lastGreeting:-100,greetAt:-100,pending:false,map:0,rotor:0,phase:'rest'} satisfies ScoutIdle;
  animateGardenScout(root,0,false,true);
}

export function animateGardenScout(root:T.Group,time:number,near:boolean,reducedMotion:boolean,talking=false) {
  if(!root.userData.scoutIdle||time<root.userData.scoutIdle.time)resetGardenScout(root);
  const state=root.userData.scoutIdle as ScoutIdle,dt=Math.min(.2,Math.max(0,time-state.time)),cycle=time%20;
  if(near&&!state.near&&time-state.lastGreeting>=8&&!reducedMotion&&!talking) {
    state.pending=true;state.lastGreeting=time;
  }
  if(!near||reducedMotion||talking)state.pending=false;
  const mapGoal=!near&&!talking&&!reducedMotion&&cycle>=9&&cycle<15?1:0;
  state.map=reducedMotion||talking?0:state.map+T.MathUtils.clamp(mapGoal-state.map,-dt/.6,dt/.6);
  if(state.pending&&state.map===0){state.greetAt=time;state.pending=false;}
  if(talking)state.greetAt=Math.min(state.greetAt,time-3);
  const enabled=!reducedMotion&&!talking;
  const window=(start:number,rise:number,fall:number,end:number)=>T.MathUtils.smoothstep(cycle,start,rise)*(1-T.MathUtils.smoothstep(cycle,fall,end));
  const check=enabled&&!near?window(2.5,3.1,5.3,6):0;
  const read=T.MathUtils.smoothstep(state.map,.2,.85),reach=T.MathUtils.smoothstep(state.map,0,.2);
  const glance=enabled&&!near?window(12.8,13.3,14.4,15)*read:0;
  const elapsed=time-state.greetAt;
  const wave=enabled&&near&&state.map===0?T.MathUtils.smoothstep(elapsed,0,.25)*(1-T.MathUtils.smoothstep(elapsed,1.85,2.35)):0;
  const sway=enabled&&!near?Math.sin(time*.7)*.008:0,upper=root.getObjectByName('scout-upper')!;
  upper.position.y=reducedMotion?0:Math.sin(time*1.8)*.006;
  upper.rotation.set(-.06*read+.09*glance,-.10*glance,.035*check+sway);
  root.getObjectByName('scout-leaf-cape')!.rotation.x=enabled?Math.sin(time*1.3)*.01:0;
  root.getObjectByName('scout-leaf-hood')!.rotation.z=enabled?Math.sin(time*.8)*.004:0;
  root.getObjectByName('arm-1')!.rotation.z=-.36*check;
  const map=root.getObjectByName('scout-open-map')!;
  map.visible=state.map>.2;map.position.set(.68+(.18-.68)*read,-.27+.02*read,-.244+(-.61+.244)*read);
  map.rotation.x=.8*read;map.scale.set(.045+.955*T.MathUtils.smoothstep(state.map,.25,.9),1,1);
  root.getObjectByName('scout-map-roll')!.visible=!map.visible;
  const arm=root.getObjectByName('arm1')!,hand=arm.children[0],rest=new T.Vector3(.19,-.13,-.06);
  const grip=map.position.clone().add(new T.Vector3(.28*map.scale.x,0,0)).sub(arm.position);
  hand.position.lerpVectors(rest,grip,reach);
  const wavePhase=T.MathUtils.clamp(elapsed-.25,0,1.6)/1.6*Math.PI*4;
  arm.rotation.z=state.map>0?0:T.MathUtils.lerp(.05,1.35+.24*Math.sin(wavePhase),wave);
  const sleeve=root.getObjectByName('scout-free-sleeve')!;
  sleeve.position.copy(hand.position).multiplyScalar(.45);sleeve.scale.y=hand.position.length()*.9;
  sleeve.quaternion.setFromUnitVectors(up,hand.position.clone().normalize());
  state.rotor=reducedMotion?0:state.rotor+dt*(.6+check*1.3);
  root.getObjectByName('scout-pinwheel')!.rotation.z=state.rotor;
  const blink=enabled&&time%4.8>4.65;
  setCharacterExpression(root,wave>0||talking||blink?'happy':'neutral');
  state.phase=talking?'talking':state.pending?'stowing-map':wave>0?'greeting':near?'attentive':state.map>.2?glance>0?'looking-up':'reading-map':check>0?'checking-wind':'rest';
  state.near=near;state.time=time;
}

