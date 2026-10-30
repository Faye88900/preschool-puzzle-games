import * as T from 'three';
import { animateKnightAsh, KNIGHT_DEATH_TIME, type KnightPhase } from './dark-knight';
import { createWeaponSmearEffect } from './vendor/ember-vfx/weapon-smear.js';
import { animateGuardianFlames } from './guardian-flames';
import { aimGuardianSword, holdGuardianSwordReady } from './ember-guardian';
import { sampleGuardianClip } from './guardian-rig';
import { plantGuardianFoot, poseGuardianSwordAttack } from './guardian-footwork';

export const GUARDIAN_ATTACKS=[
  {name:'cut',windup:1.25,active:.42,recovery:2.6,reach:2.5,angle:.95},
  {name:'sweep',windup:1.5,active:.6,recovery:2.8,reach:2.8,angle:1.35},
  {name:'slam',windup:1.7,active:.55,recovery:3.0,reach:3.2,angle:.25},
] as const;
type GuardianMotion={mesh:T.Group;home:T.Vector3;aim:T.Vector3;hp:number;phase:KnightPhase;timer:number;block:number};
type Point={x:number;z:number};

function warningGeometry(reach:number,angle:number,lane=false) {
  const shape=new T.Shape();
  if(lane){shape.moveTo(-.7,0);shape.lineTo(.7,0);shape.lineTo(.7,reach);shape.lineTo(-.7,reach);shape.closePath();}
  else {shape.moveTo(0,0);shape.absarc(0,0,reach,Math.PI/2-angle,Math.PI/2+angle,false);shape.closePath();}
  return new T.ShapeGeometry(shape,36).rotateX(-Math.PI/2);
}
const warnings=GUARDIAN_ATTACKS.map(a=>warningGeometry(a.reach,a.angle,a.name==='slam'));

export function guardianSwordHits(attack:number,origin:Point,aim:Point,player:Point) {
  const a=GUARDIAN_ATTACKS[attack],dx=player.x-origin.x,dz=player.z-origin.z;
  const forward=dx*aim.x+dz*aim.z,side=dx*aim.z-dz*aim.x;
  if(a.name==='slam')return forward>=0&&forward<=a.reach&&Math.abs(side)<=.7;
  return Math.hypot(dx,dz)<=a.reach&&Math.abs(Math.atan2(side,forward))<=a.angle;
}

function authorGuardianPose(root:T.Group,phase:KnightPhase,attack:number,progress:number,time:number,reducedMotion:boolean,moving=false) {
  const body=root.getObjectByName('body')!,cape=root.getObjectByName('cape')!,head=root.getObjectByName('head')!;
  const right=root.getObjectByName('arm1')!,elbow=root.getObjectByName('elbow1')!,left=root.getObjectByName('arm-1')!;
  const warn=phase==='warn',strike=phase==='lunge',rest=phase==='rest',hurt=phase==='stun';
  const swing=T.MathUtils.smoothstep(progress,.08,.90),slam=attack===2,cut=attack===0;
  root.getObjectByName('chest')!.rotation.set(0,0,0);body.position.set(0,0,0);head.rotation.set(0,0,0);cape.rotation.set(0,0,0);
  body.rotation.set(hurt?-.09:rest?.08:0,(warn||strike)&&!slam?-.25+(strike?swing:0)*.5:0,reducedMotion?0:hurt?Math.sin(progress*Math.PI*4)*.065:0);
  body.position.y=reducedMotion?0:moving?Math.abs(Math.sin(time*9))*.025:Math.sin(time*2.3)*.008;
  head.rotation.x=rest?.08:warn||strike?-.06:0;
  holdGuardianSwordReady(root);
  if(warn||strike) {
    right.rotation.set(slam?.50:.28,slam?0:T.MathUtils.lerp(-.45,.55,strike?swing:0),slam?-.10:.10);
    elbow.rotation.x=slam?1.30:.75;
    if(slam) {
      const angle=strike?T.MathUtils.lerp(.20,2.10,swing):.20;
      aimGuardianSword(root,0,Math.cos(angle),-Math.sin(angle));
    }else {
      const angle=strike?T.MathUtils.lerp(.15,2.85,swing):.15;
      aimGuardianSword(root,Math.cos(angle),cut?T.MathUtils.lerp(.48,-.18,strike?swing:0):.12,-Math.sin(angle));
    }
  }
  left.rotation.set(warn||strike?-.12:rest?.08:0,0,rest?-.12:0);
  cape.rotation.x=reducedMotion?0:(warn||strike?-.16:0)+Math.sin(time*3)*.02;
  for(const side of [-1,1]) {
    const leg=root.getObjectByName(`leg${side}`)!;
    const stride=Math.sin(time*Math.PI*2/.8)*side,lift=Math.max(0,stride);
    leg.rotation.set(moving?stride*.32:0,0,0);
    root.getObjectByName(`knee${side}`)!.rotation.x=moving?-lift*.48:0;
    root.getObjectByName(`ankle${side}`)!.rotation.x=moving?-stride*.32+lift*.48:0;
    if(moving)left.rotation.x=-stride*.18;
    const eye=root.getObjectByName(`eye${side}`)!;
    eye.scale.y=rest?.52:warn||strike?.72:hurt?.45:1;
    eye.rotation.z=side*(warn?.18:rest?-.12:0);
  }
  if(moving) {
    body.position.set(0,.012,-.035);body.rotation.y=Math.sin(time*Math.PI*2/.8)*.025;
    root.getObjectByName('chest')!.rotation.set(-.12,-body.rotation.y*.7,0);
    head.rotation.x=.04;
    for(const side of [-1,1]) {
      const cycle=(time/.8+(side===1?0:.5))%1;
      const stance=cycle<.55,p=stance?cycle/.55:(cycle-.55)/.45;
      const z=stance?T.MathUtils.lerp(-.14,.22,p):T.MathUtils.lerp(.22,-.14,T.MathUtils.smoothstep(p,0,1));
      plantGuardianFoot(root,side,z,stance?0:Math.sin(p*Math.PI)*.03);
    }
    aimGuardianSword(root,.025,-.30,-.95);root.getObjectByName('wrist1')!.rotateY(Math.PI);
  }
  const glow=root.getObjectByName('blade-glow') as T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>;
  glow.material.opacity=(strike?.10:.035)+(reducedMotion?0:Math.sin(time*7)*.006);
  animateGuardianFlames(root,time,reducedMotion);
}

function authorClip(root:T.Group,name:string,t:number) {
  const moving=name==='walk',hurt=name.startsWith('hurt'),death=name==='death',attack=Number(name.at(-1))||0;
  authorGuardianPose(root,'idle',attack,0,moving?t:name==='idle'?t/2.4*(Math.PI*2/2.3):0,false,moving);
  if(moving||name==='idle') {
    const cycle=t*Math.PI*2/(moving?.8:2.4);
    if(!moving) {
      const breath=Math.sin(cycle),weight=1-Math.cos(cycle);
      root.getObjectByName('body')!.position.set(weight*.003,0,0);
      root.getObjectByName('chest')!.rotation.set(-breath*.012,weight*.006,breath*.006);
      root.getObjectByName('head')!.rotation.set(breath*.007,-weight*.01,0);
      root.getObjectByName('arm1')!.rotation.x=.02+breath*.012;
      root.getObjectByName('elbow1')!.rotation.x=.12+weight*.008;
      root.getObjectByName('arm-1')!.rotation.x=-breath*.016;
      aimGuardianSword(root,.025,-.365+breath*.004,-.93);root.getObjectByName('wrist1')!.rotateY(Math.PI);
    }
    root.getObjectByName('cape')!.rotation.x=Math.sin(cycle)*.02;
  }
  const bones:T.Bone[]=[];root.traverse(o=>{if(o instanceof T.Bone)bones.push(o);});
  if(name.startsWith('windup')||name.startsWith('recover')) {
    const ready=bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()}));
    const recovering=name.startsWith('recover');
    authorGuardianPose(root,recovering?'lunge':'warn',attack,recovering?1:0,0,true);
    const weight=recovering?1-T.MathUtils.smoothstep(t,0,.55):T.MathUtils.smoothstep(t,0,.85);
    bones.forEach((b,i)=>{b.position.lerpVectors(ready[i].p,b.position,weight);b.quaternion.slerpQuaternions(ready[i].q,b.quaternion.clone(),weight);});
  }else if(name.startsWith('strike'))authorGuardianPose(root,'lunge',attack,t,0,true);
  if(name.startsWith('windup')||name.startsWith('strike')||name.startsWith('recover')) {
    poseGuardianSwordAttack(root,name.startsWith('windup')?t:name.startsWith('strike')?1+t:2+t,attack,aimGuardianSword);
  }
  if(hurt) {
    const p=T.MathUtils.clamp(t/.8,0,1),weight=guardianHurtWeight(p),head=guardianHurtWeight(Math.max(0,p-.045));
    const sweep=attack===1,slam=attack===2,step=Math.sin(T.MathUtils.smoothstep(p,.10,.80)*Math.PI);
    const body=root.getObjectByName('body')!;body.position.set(sweep?-weight*.045:0,-weight*(slam?.045:.012),weight*(slam?-.055:.045));
    root.getObjectByName('chest')!.rotation.set(weight*(slam?-.38:sweep?.08:.28),sweep?weight*.38:weight*.045,sweep?-weight*.14:weight*.035);
    root.getObjectByName('head')!.rotation.set(head*(slam?-.20:.13),sweep?-head*.16:-head*.025,sweep?-head*.10:head*.025);
    root.getObjectByName('arm1')!.rotation.set(.02+weight*(slam?.35:sweep?.14:-.10),sweep?weight*.24:0,.04+weight*(sweep?.15:0));
    root.getObjectByName('elbow1')!.rotation.x=.12+weight*(slam?.25:.20);
    root.getObjectByName('arm-1')!.rotation.set(-weight*(slam?.15:.42),0,-weight*(sweep?.55:.28));
    root.getObjectByName('cape')!.rotation.x=guardianHurtWeight(Math.max(0,p-.07))*.08;
    for(const side of [-1,1]) {
      const stepping=side===(sweep?-1:1)&&!slam;
      plantGuardianFoot(root,side,slam?(side===-1?-.11:.065)*weight:stepping?step*.12:0,stepping?Math.sin(T.MathUtils.smoothstep(p,.1,.48)*Math.PI)*.045:0,side*.19+(sweep&&side===-1?-step*.10:0));
      root.getObjectByName(`leg${side}`)!.quaternion.slerpQuaternions(new T.Quaternion(),root.getObjectByName(`leg${side}`)!.quaternion.clone(),weight);
      root.getObjectByName(`knee${side}`)!.rotation.x*=weight;
      const ankle=root.getObjectByName(`ankle${side}`)!;ankle.rotation.set(ankle.rotation.x*weight,ankle.rotation.y*weight,ankle.rotation.z*weight);
    }
    if(slam) {
      root.updateMatrixWorld(true);
      const height=root.worldToLocal(root.getObjectByName('wrist1')!.getWorldPosition(new T.Vector3())).y;
      const x=.025*(1-weight),y=T.MathUtils.lerp(-.365,(.045-height)/1.38,weight);
      aimGuardianSword(root,x,y,-Math.sqrt(Math.max(.01,1-x*x-y*y)));
    }else aimGuardianSword(root,.025,-.365+weight*.055,-.93);
    root.getObjectByName('wrist1')!.rotateY(Math.PI);
  }
  if(death) {
    const p=T.MathUtils.clamp(t/KNIGHT_DEATH_TIME,0,1),weight=T.MathUtils.smoothstep(p,0,1);
    const body=root.getObjectByName('body')!;
    body.rotation.x=weight*(death?-.55:.23);body.rotation.z=weight*.10;body.position.y=-weight*(death?.19:.03);
    root.getObjectByName('head')!.rotation.x=weight*(death?-.28:.12);
    for(const side of [-1,1]){root.getObjectByName(`leg${side}`)!.rotation.x=weight*.35;root.getObjectByName(`knee${side}`)!.rotation.x=-weight*.8;root.getObjectByName(`ankle${side}`)!.rotation.x=weight*.45;}
    root.getObjectByName('arm-1')!.rotation.z=-weight*.24;
    aimGuardianSword(root,.025,T.MathUtils.lerp(-.365,death?-.12:-.30,weight),-.93);root.getObjectByName('wrist1')!.rotateY(Math.PI);
  }
  if(moving||hurt||death) {
    root.updateMatrixWorld(true);
    const bounds=new T.Box3();
    for(const side of [-1,1])root.getObjectByName(`ankle${side}`)!.traverse(o=>{
      if(o instanceof T.SkinnedMesh){o.skeleton.update();bounds.union(new T.Box3().setFromObject(o,true));}
    });
    root.getObjectByName('body')!.position.y+=(root.position.y-bounds.min.y)/root.scale.y;
  }
}

function guardianHurtWeight(progress:number) {
  return T.MathUtils.smoothstep(progress,0,.10)*(1-T.MathUtils.smoothstep(progress,.18,.94));
}

export function poseEmberGuardian(root:T.Group,phase:KnightPhase,attack:number,progress:number,time:number,reducedMotion:boolean,moving=false,dead=false,walkTime=time) {
  const name=dead?'death':phase==='stun'?`hurt${attack}`:phase==='warn'?`windup${attack}`:phase==='lunge'?`strike${attack}`:phase==='rest'?`recover${attack}`:moving?'walk':'idle';
  const t=dead?progress*KNIGHT_DEATH_TIME:phase==='stun'?progress*.8:name==='idle'?(reducedMotion?0:time%2.4):name==='walk'?walkTime%.8:progress;
  sampleGuardianClip(root,name,t,(clip,t)=>authorClip(root,clip,t));
  for(const side of [-1,1]) {
    const eye=root.getObjectByName(`eye${side}`)!;
    eye.scale.y=dead?.12:phase==='stun'?progress<.14?1.18:T.MathUtils.lerp(.48,1,T.MathUtils.smoothstep(progress,.2,.94)):phase==='rest'?.52:1;
    eye.rotation.z=phase==='stun'?side*.12*guardianHurtWeight(progress):0;
  }
  const glow=root.getObjectByName('blade-glow') as T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>;
  glow.material.opacity=phase==='lunge'?.10:.035;
  animateGuardianFlames(root,time,reducedMotion);
}

export class GuardianCombat {
  root=new T.Group();
  attack=0;
  private landed=false;
  private impactTime=0;
  private wasSwinging=false;
  private walkTime=0;
  private returning=false;
  private moveSpeed=0;
  private homeHeading=0;
  private locomotionBlend=0;
  private locomotionPose:{bone:T.Bone;position:T.Vector3;rotation:T.Quaternion}[]=[];
  private hitPose:{bone:T.Bone;position:T.Vector3;rotation:T.Quaternion}[]=[];
  private hitActive=false;
  private hitSide=0;
  private hitStep=0;
  private hitStepDirection=new T.Vector3();
  private hitFlashTime=0;
  private hitFlash=new T.Group();
  private warning=new T.Mesh(warnings[0],new T.MeshBasicMaterial({color:'#e45b22',transparent:true,opacity:.40,side:T.DoubleSide,depthWrite:false,toneMapped:false}));
  private warningEdge=new T.LineSegments(new T.EdgesGeometry(warnings[0]),new T.LineBasicMaterial({color:'#b9471b',depthWrite:false,toneMapped:false}));
  private marker=new T.Group();
  private impact=new T.Mesh(new T.RingGeometry(.82,1,40),new T.MeshBasicMaterial({color:'#ffbd62',transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}));
  private trail=createWeaponSmearEffect(T,{id:'weapon-smear',color:'#ff943e'},{size:.88,detail:.8,density:.375});
  private sword:T.Object3D;
  constructor(model:T.Group) {
    this.homeHeading=model.rotation.y;
    model.traverse(bone=>{if(bone instanceof T.Bone){this.locomotionPose.push({bone,position:new T.Vector3(),rotation:new T.Quaternion()});this.hitPose.push({bone,position:new T.Vector3(),rotation:new T.Quaternion()});}});
    this.root.name='guardian-sword-effects';this.marker.name='guardian-sword-warning';
    const star=new T.Shape();
    for(let i=0;i<8;i++){const angle=i*Math.PI/4,r=i%2?.025:.09;if(i===0)star.moveTo(Math.cos(angle)*r,Math.sin(angle)*r);else star.lineTo(Math.cos(angle)*r,Math.sin(angle)*r);}star.closePath();
    const starGeometry=new T.ShapeGeometry(star),starMaterial=new T.MeshBasicMaterial({color:'#ffe7a3',transparent:true,depthTest:false,depthWrite:false,side:T.DoubleSide});
    for(let i=0;i<3;i++){const mesh=new T.Mesh(starGeometry,starMaterial);mesh.position.set((i-1)*.18,(i%2)*.12,0);mesh.rotation.z=i*.7;this.hitFlash.add(mesh);}
    this.hitFlash.name='guardian-hit-stars';this.hitFlash.renderOrder=12;this.hitFlash.visible=false;this.root.add(this.hitFlash);
    this.root.add(this.marker,this.trail.group);this.marker.add(this.warning,this.warningEdge,this.impact);
    this.impact.rotation.x=-Math.PI/2;this.impact.position.z=-2.05;this.impact.position.y=.015;
    this.marker.position.y=.06;
    this.sword=model.getObjectByName('ember-sword')!;
    this.trail.attachWeapon(this.sword,{base:[0,.25,0],tip:[0,1.38,0]});this.trail.stop();
    this.warning.visible=this.warningEdge.visible=this.impact.visible=false;
  }
  reset(model:T.Group,reducedMotion:boolean) {
    model.rotation.y=this.homeHeading;
    this.attack=0;this.landed=false;this.impactTime=0;this.wasSwinging=false;this.walkTime=0;
    this.returning=false;this.moveSpeed=0;this.locomotionBlend=0;
    this.hitActive=false;
    this.hitStep=0;this.hitFlashTime=0;this.hitFlash.visible=false;
    model.visible=true;animateKnightAsh(model,0,reducedMotion);
    for(const name of ['sword-residual-flames','blade-glow']){const effect=model.getObjectByName(name);if(effect)effect.visible=true;}
    this.trail.reset();this.trail.stop();this.trail.group.visible=false;
    this.root.visible=true;this.warning.visible=this.warningEdge.visible=this.impact.visible=false;
    poseEmberGuardian(model,'idle',0,0,0,reducedMotion);
  }
  reactToHit(model:T.Group,source:Point) {
    for(const pose of this.hitPose){pose.position.copy(pose.bone.position);pose.rotation.copy(pose.bone.quaternion);}
    const push=new T.Vector3(model.position.x-source.x,0,model.position.z-source.z).normalize().applyAxisAngle(new T.Vector3(0,1,0),-model.rotation.y);
    this.hitSide=push.x;this.hitActive=true;this.moveSpeed=0;
    this.hitStep=0;this.hitStepDirection.set(this.attack===1?(push.x<0?-1:1):0,0,this.attack===1?.25:1).normalize().applyAxisAngle(new T.Vector3(0,1,0),model.rotation.y);
    this.hitFlashTime=.22;this.hitFlash.visible=true;
    this.hitFlash.position.copy(model.position).add(new T.Vector3(0,1.05*model.scale.y,0)).addScaledVector(new T.Vector3(source.x-model.position.x,0,source.z-model.position.z).normalize(),.35*model.scale.x);
    this.hitFlash.rotation.y=Math.atan2(source.x-model.position.x,source.z-model.position.z);this.hitFlash.scale.setScalar(1);
    (this.hitFlash.children[0] as T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>).material.opacity=1;
    this.trail.stop();this.wasSwinging=false;
  }
  private turn(model:T.Group,heading:number,dt:number) {
    const delta=Math.atan2(Math.sin(heading-model.rotation.y),Math.cos(heading-model.rotation.y));
    model.rotation.y+=T.MathUtils.clamp(delta,-dt*3.5,dt*3.5);
    return Math.abs(delta);
  }
  private moveTo(enemy:GuardianMotion,target:Point,speed:number,dt:number,canMove:(from:Point,to:Point)=>boolean) {
    const p=enemy.mesh.position,direction=new T.Vector3(target.x-p.x,0,target.z-p.z),distance=direction.length();
    if(distance<.025){this.moveSpeed=0;return;}
    direction.divideScalar(distance);
    const turn=this.turn(enemy.mesh,Math.atan2(-direction.x,-direction.z),dt);
    const desired=turn>.8?0:Math.min(speed,Math.sqrt(6*distance));
    this.moveSpeed+=T.MathUtils.clamp(desired-this.moveSpeed,-dt*4,dt*4);
    const step=Math.min(dt*this.moveSpeed,distance),next=p.clone().addScaledVector(direction,step);
    if(canMove(p,next))p.copy(next);
    else for(const side of [-1,1]){next.set(p.x+direction.z*step*side,p.y,p.z-direction.x*step*side);if(canMove(p,next)){p.copy(next);break;}}
  }
  update(enemy:GuardianMotion,player:{x:number;y:number;z:number},dt:number,time:number,reducedMotion:boolean,canMove:(from:Point,to:Point)=>boolean) {
    if(enemy.hp<=0){
      this.root.visible=false;this.trail.stop();this.wasSwinging=false;
      enemy.timer=Math.max(0,enemy.timer-dt);enemy.mesh.visible=enemy.timer>0;
      const progress=1-enemy.timer/KNIGHT_DEATH_TIME;
      poseEmberGuardian(enemy.mesh,'stun',this.attack,progress,time,reducedMotion,false,true);
      if(this.hitActive){const blend=T.MathUtils.smoothstep(progress,0,.12);for(const pose of this.hitPose){pose.bone.position.lerpVectors(pose.position,pose.bone.position,blend);pose.bone.quaternion.slerpQuaternions(pose.rotation,pose.bone.quaternion.clone(),blend);}}
      animateKnightAsh(enemy.mesh,progress,reducedMotion,1.4);
      for(const name of ['sword-residual-flames','blade-glow']){const effect=enemy.mesh.getObjectByName(name);if(effect)effect.visible=progress<.12;}
      return false;
    }
    this.root.visible=true;
    let hit=false,slamImpact=false;
    const p=enemy.mesh.position,distance=Math.hypot(player.x-p.x,player.z-p.z);
    const beforeX=p.x,beforeZ=p.z;
    enemy.timer=Math.max(0,enemy.timer-dt);enemy.block=Math.max(0,enemy.block-dt);
    if(enemy.phase==='stun'&&this.hitActive) {
      const step=T.MathUtils.smoothstep(1-enemy.timer/.8,.10,.48)*(this.attack===2?0:this.attack===1?.28:.35),next=p.clone().addScaledVector(this.hitStepDirection,step-this.hitStep);
      if(canMove(p,next))p.copy(next);this.hitStep=step;
    }
    if(enemy.phase==='idle'||enemy.phase==='chase') {
      const homeDistance=Math.hypot(p.x-enemy.home.x,p.z-enemy.home.z);
      if(this.returning&&distance<6&&homeDistance<13)this.returning=false;
      if(!this.returning&&distance<11&&homeDistance<15) {
        enemy.aim.set(player.x-p.x,0,player.z-p.z).normalize();
        if(distance<=2.35) {
          enemy.mesh.rotation.y=Math.atan2(-enemy.aim.x,-enemy.aim.z);this.moveSpeed=0;
          enemy.phase='warn';enemy.timer=GUARDIAN_ATTACKS[this.attack].windup;this.landed=false;
          this.warning.geometry=warnings[this.attack];this.warningEdge.geometry.dispose();this.warningEdge.geometry=new T.EdgesGeometry(this.warning.geometry);
        } else {
          enemy.phase='chase';
          this.moveTo(enemy,p.clone().addScaledVector(enemy.aim,distance-2.3),2,dt,canMove);
        }
      }else {
        enemy.phase='idle';this.returning=homeDistance>.025;
        if(this.returning)this.moveTo(enemy,enemy.home,1.6,dt,canMove);
        else {this.moveSpeed=0;this.turn(enemy.mesh,this.homeHeading,dt);}
      }
    } else if(enemy.phase==='warn'&&enemy.timer===0) {
      enemy.phase='lunge';enemy.timer=GUARDIAN_ATTACKS[this.attack].active;
      this.trail.reset();this.wasSwinging=true;
    } else if(enemy.phase==='lunge') {
      const elapsed=GUARDIAN_ATTACKS[this.attack].active-enemy.timer;
      const contact=GUARDIAN_ATTACKS[this.attack].active*(this.attack===2?.60:.45);
      if(elapsed>contact&&elapsed<GUARDIAN_ATTACKS[this.attack].active-.04&&!this.landed&&player.y<1.8&&guardianSwordHits(this.attack,p,enemy.aim,player)){hit=true;this.landed=true;}
      if(this.attack===2&&elapsed>contact&&this.impactTime===0){this.impactTime=.5;this.impact.visible=true;slamImpact=true;}
      if(enemy.timer===0){enemy.phase='rest';enemy.timer=GUARDIAN_ATTACKS[this.attack].recovery;this.trail.stop();this.wasSwinging=false;}
    } else if((enemy.phase==='rest'||enemy.phase==='stun')&&enemy.timer===0) {
      this.attack=(this.attack+1)%GUARDIAN_ATTACKS.length;enemy.phase='idle';
    }
    const a=GUARDIAN_ATTACKS[this.attack];
    const progress=enemy.phase==='warn'?1-enemy.timer/a.windup:enemy.phase==='lunge'?1-enemy.timer/a.active:enemy.phase==='stun'?1-enemy.timer/.8:enemy.phase==='rest'?1-enemy.timer/a.recovery:0;
    const traveled=Math.hypot(p.x-beforeX,p.z-beforeZ);
    this.walkTime+=traveled/(enemy.mesh.scale.x*(.36/.44));
    poseEmberGuardian(enemy.mesh,enemy.block>0&&enemy.phase!=='stun'?'warn':enemy.phase,this.attack,progress,time,reducedMotion,traveled>.00001,false,this.walkTime);
    if(enemy.phase==='stun'&&this.hitActive) {
      const weight=guardianHurtWeight(progress),blend=T.MathUtils.smoothstep(progress,0,.10);
      enemy.mesh.getObjectByName('chest')!.rotation.z-=this.hitSide*weight*.10;
      enemy.mesh.getObjectByName('chest')!.rotation.y+=this.hitSide*weight*.08;
      enemy.mesh.getObjectByName('head')!.rotation.z-=this.hitSide*weight*.06;
      for(const pose of this.hitPose){pose.bone.position.lerpVectors(pose.position,pose.bone.position,blend);pose.bone.quaternion.slerpQuaternions(pose.rotation,pose.bone.quaternion.clone(),blend);}
    }else this.hitActive=false;
    if(enemy.phase==='idle'||enemy.phase==='chase') {
      this.locomotionBlend+=T.MathUtils.clamp((traveled>.00001?1:0)-this.locomotionBlend,-dt*6,dt*6);
      poseEmberGuardian(enemy.mesh,'idle',this.attack,0,time,reducedMotion);
      for(const pose of this.locomotionPose){pose.position.copy(pose.bone.position);pose.rotation.copy(pose.bone.quaternion);}
      poseEmberGuardian(enemy.mesh,'chase',this.attack,0,time,reducedMotion,true,false,this.walkTime);
      for(const pose of this.locomotionPose){pose.bone.position.lerpVectors(pose.position,pose.bone.position,this.locomotionBlend);pose.bone.quaternion.slerpQuaternions(pose.rotation,pose.bone.quaternion.clone(),this.locomotionBlend);}
    }else this.locomotionBlend=0;
    this.marker.position.set(p.x,.06,p.z);this.marker.rotation.y=enemy.mesh.rotation.y;
    if(slamImpact) {
      this.sword.updateWorldMatrix(true,false);this.marker.updateWorldMatrix(true,false);
      const tip=this.marker.worldToLocal(this.sword.localToWorld(new T.Vector3(0,1.38,0)));
      this.impact.position.set(tip.x,.015,tip.z);
    }
    this.warning.visible=this.warningEdge.visible=enemy.phase==='warn';
    this.warning.material.opacity=reducedMotion?.44:.36+progress*.14;
    if(this.wasSwinging&&enemy.phase!=='lunge'){this.trail.stop();this.wasSwinging=false;}
    this.trail.update(dt);this.trail.group.visible=!reducedMotion&&!this.trail.finished;
    this.hitFlashTime=Math.max(0,this.hitFlashTime-dt);this.hitFlash.visible=this.hitFlashTime>0;
    if(this.hitFlash.visible){const p=1-this.hitFlashTime/.22;this.hitFlash.scale.setScalar(reducedMotion?1:1+p*.7);(this.hitFlash.children[0] as T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>).material.opacity=1-p;}
    if(this.impactTime>0){this.impactTime=Math.max(0,this.impactTime-dt);this.impact.visible=true;this.impact.scale.setScalar(reducedMotion?1:1+(1-this.impactTime/.5)*.7);this.impact.material.opacity=this.impactTime*.8;}
    else this.impact.visible=false;
    return hit;
  }
}










