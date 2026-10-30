import * as T from 'three';

export function plantGuardianFoot(root:T.Group,side:number,z:number,lift=0,x=side*.19) {
  const body=root.getObjectByName('body')!,leg=root.getObjectByName(`leg${side}`)!;
  const target=new T.Vector3(x,.105+lift,z).sub(body.position).applyQuaternion(body.quaternion.clone().invert()).sub(leg.position);
  const distance=T.MathUtils.clamp(Math.hypot(target.y,target.z),.06,.389);
  const knee=-Math.acos(T.MathUtils.clamp((distance*distance-.19*.19-.20*.20)/(2*.19*.20),-1,1));
  const hip=Math.atan2(-target.z,-target.y)+Math.acos(T.MathUtils.clamp((.19*.19+distance*distance-.20*.20)/(2*.19*distance),-1,1));
  leg.rotation.set(hip,-body.rotation.y,Math.atan2(target.x,-target.y));
  root.getObjectByName(`knee${side}`)!.rotation.x=knee;
  root.getObjectByName(`ankle${side}`)!.rotation.set(-hip-knee-body.rotation.x,0,-leg.rotation.z-body.rotation.z);
}

// Key poses: settle, load, plant, cut through, follow through, recover.
// time, hipY, hipZ, hipYaw, chestPitch, chestYaw, armX/Y/Z, elbow, bladeX/Y/Z, leftFootZ, rightFootZ
const cutKeys=[
  [0,0,0,0,0,0,.02,0,.04,.12,.025,-.365,-.93,0,0],
  [.65,-.028,.025,-.12,.045,-.20,.28,-.38,-.18,.72,.85,.58,-.20,-.05,.07],
  [1,-.028,.025,-.12,.045,-.20,.28,-.38,-.18,.72,.85,.58,-.20,-.05,.07],
  [1.18,-.025,-.045,-.03,-.025,-.20,.35,-.24,-.20,.66,.85,.58,-.20,-.16,.07],
  [1.48,-.025,-.07,.12,-.10,.04,.50,.10,.04,.30,.05,.12,-1,-.16,.07],
  [1.72,-.025,-.07,.18,-.08,.27,.28,.60,.18,.20,-.88,-.23,-.35,-.16,.07],
  [2,-.025,-.07,.18,-.08,.27,.28,.60,.18,.20,-.88,-.23,-.35,-.16,.07],
  [2.18,-.025,-.07,.18,-.08,.27,.28,.60,.18,.20,-.88,-.23,-.35,-.16,.07],
  [2.68,-.01,-.025,.04,-.02,.05,.10,.18,.08,.32,-.35,-.30,-.88,-.06,.03],
  [3,0,0,0,0,0,.02,0,.04,.12,.025,-.365,-.93,0,0],
];

const sweepKeys=[
  [0,0,0,0,0,0,.02,0,.04,.12,.025,-.365,-.93,0,0],
  [.68,-.018,.015,-.26,-.025,-.38,.42,-.55,.38,.85,.98,.10,.12,-.055,.065],
  [1,-.020,.010,-.28,-.03,-.40,.44,-.57,.40,.82,.99,.10,.08,-.055,.065],
  [1.20,-.022,-.015,-.08,-.04,-.38,.48,-.35,.42,.65,.96,.10,-.24,-.055,.065],
  [1.48,-.022,-.035,.17,-.055,.02,.60,.10,.40,.32,.05,.08,-1,-.055,.065],
  [1.80,-.018,-.035,.30,-.025,.34,.46,.72,.30,.42,-.98,.08,-.12,-.055,.065],
  [2,-.017,-.035,.31,-.02,.36,.44,.75,.28,.44,-.99,.075,-.06,-.055,.065],
  [2.16,-.015,-.032,.30,-.015,.35,.40,.72,.26,.46,-.98,.05,-.14,-.052,.062],
  [2.72,-.008,-.015,.06,-.01,.08,.16,.22,.14,.36,-.40,-.25,-.86,-.02,.02],
  [3,0,0,0,0,0,.02,0,.04,.12,.025,-.365,-.93,0,0],
];

const slamKeys=[
  [0,0,0,0,0,0,.02,0,.04,.12,.025,-.365,-.93,0,0],
  [.72,-.010,.02,0,.045,0,2.25,0,-.08,.55,0,.96,.28,-.04,.06],
  [1,-.014,.015,0,.04,0,2.38,0,-.08,.45,0,.98,.18,-.04,.06],
  [1.16,-.020,-.035,0,-.10,0,2.12,0,-.07,.40,0,.88,-.45,-.12,.07],
  [1.40,-.025,-.065,0,-.26,0,1.35,0,-.03,.27,0,.05,-1,-.12,.07],
  [1.56,-.028,-.065,0,-.30,0,.68,0,.02,.25,0,-.37,-.93,-.12,.07],
  [1.80,-.025,-.065,0,-.26,0,.40,0,.04,.18,0,-.30,-.95,-.12,.07],
  [2,-.022,-.060,0,-.24,0,.35,0,.04,.18,0,-.28,-.96,-.12,.07],
  [2.15,-.018,-.055,0,-.20,0,.44,0,.04,.25,0,-.24,-.97,-.115,.065],
  [2.55,-.008,-.025,0,-.10,0,.38,0,.04,.42,0,-.20,-.98,-.055,.03],
  [3,0,0,0,0,0,.02,0,.04,.12,.025,-.365,-.93,0,0],
];

const sweepSeconds=(t:number)=>t<=1?t*1.5:t<=2?1.5+(t-1)*.6:2.1+(t-2)*2.8;
const slamSeconds=(t:number)=>t<=1?t*1.7:t<=2?1.7+(t-1)*.55:2.25+(t-2)*3;
function continuousValue(keys:number[][],seconds:(t:number)=>number,time:number,index:number,column:number) {
  const a=keys[index],b=keys[index+1],x=seconds(time),x0=seconds(a[0]),x1=seconds(b[0]);
  const slope=(i:number)=>{
    if(i===0||i===keys.length-1)return 0;
    const before=keys[i-1],at=keys[i],after=keys[i+1];
    const h0=seconds(at[0])-seconds(before[0]),h1=seconds(after[0])-seconds(at[0]);
    const d0=(at[column]-before[column])/h0,d1=(after[column]-at[column])/h1;
    if(d0*d1<=0)return 0;
    return 3*(h0+h1)/((2*h1+h0)/d0+(h1+2*h0)/d1);
  };
  // Preserve velocity through intermediate keys without overshooting the authored poses.
  const u=T.MathUtils.clamp((x-x0)/(x1-x0),0,1),u2=u*u,u3=u2*u;
  return (2*u3-3*u2+1)*a[column]+(u3-2*u2+u)*(x1-x0)*slope(index)+(-2*u3+3*u2)*b[column]+(u3-u2)*(x1-x0)*slope(index+1);
}

export function poseGuardianSwordAttack(root:T.Group,time:number,attack:number,aim:(root:T.Group,x:number,y:number,z:number)=>void) {
  const keys=attack===2?slamKeys:attack===1?sweepKeys:cutKeys;
  const index=Math.max(0,keys.findIndex((_,i)=>i<keys.length-1&&time<=keys[i+1][0]));
  const a=keys[index],b=keys[index+1],u=T.MathUtils.smoothstep(time,a[0],b[0]),v=a.map((x,i)=>attack>0?continuousValue(keys,attack===2?slamSeconds:sweepSeconds,time,index,i):T.MathUtils.lerp(x,b[i],u));
  const body=root.getObjectByName('body')!,chest=root.getObjectByName('chest')!;
  body.position.set(0,v[1],v[2]);body.rotation.set(0,v[3],0);chest.rotation.set(v[4],v[5],0);
  root.getObjectByName('arm1')!.rotation.set(v[6],v[7],v[8]);root.getObjectByName('elbow1')!.rotation.x=v[9];
  const effort=Math.sin(Math.min(1,time/3)*Math.PI);
  root.getObjectByName('head')!.rotation.set(-v[4]*.5,-v[5]*.55,0);
  root.getObjectByName('arm-1')!.rotation.set(-effort*(attack===1?.42:.28),-effort*.12,-effort*(attack===1?.34:.22));
  root.getObjectByName('cape')!.rotation.set(-effort*.10,attack===1?-v[5]*.18:Math.sin(time*Math.PI)*.035,0);
  plantGuardianFoot(root,-1,v[13],attack===0&&time>1&&time<1.18?Math.sin((time-1)/.18*Math.PI)*.035:0);
  plantGuardianFoot(root,1,v[14]);
  aim(root,v[10],v[11],v[12]);root.getObjectByName('wrist1')!.rotateY(Math.PI);
}



