import * as T from 'three';
import { KNIGHT_DEATH_TIME } from './dark-knight';

// Armor uses rigid weights so plates keep their shape when joints bend.
export function bindGuardianRig(root:T.Group) {
  const names=['body','chest','head','cape',...[-1,1].flatMap(s=>[`arm${s}`,`elbow${s}`,`wrist${s}`,`leg${s}`,`knee${s}`,`ankle${s}`,`shoulder${s}`])];
  const bones:T.Bone[]=[];
  for(const name of names) {
    const old=root.getObjectByName(name)!,bone=new T.Bone();
    bone.name=name;bone.position.copy(old.position);bone.quaternion.copy(old.quaternion);bone.scale.copy(old.scale);
    old.parent!.add(bone);for(const child of [...old.children])bone.add(child);old.removeFromParent();bones.push(bone);
  }
  root.updateMatrixWorld(true);
  const skeleton=new T.Skeleton(bones);skeleton.calculateInverses();
  const meshes:T.Mesh[]=[];root.traverse(o=>{if(o instanceof T.Mesh&&!o.name.includes('glow')&&!(o.material instanceof T.ShaderMaterial))meshes.push(o);});
  for(const old of meshes) {
    let joint:T.Object3D|null=old.parent;while(joint&&!(joint instanceof T.Bone))joint=joint.parent;
    if(!joint)continue;
    const geometry=old.geometry.clone(),count=geometry.attributes.position.count,indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
    for(let i=0;i<count;i++){indices[i*4]=bones.indexOf(joint as T.Bone);weights[i*4]=1;}
    geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
    const mesh=new T.SkinnedMesh(geometry,old.material);mesh.name=old.name;mesh.position.copy(old.position);mesh.quaternion.copy(old.quaternion);mesh.scale.copy(old.scale);
    mesh.visible=old.visible;mesh.castShadow=old.castShadow;mesh.receiveShadow=old.receiveShadow;mesh.frustumCulled=false;
    old.parent!.add(mesh);for(const child of [...old.children])mesh.add(child);mesh.updateMatrixWorld(true);mesh.bind(skeleton,mesh.matrixWorld);old.removeFromParent();
  }
}

type AnimationState={mixer:T.AnimationMixer;actions:Map<string,T.AnimationAction>};
const states=new WeakMap<T.Group,AnimationState>();
export function sampleGuardianClip(root:T.Group,name:string,time:number,author:(name:string,t:number)=>void) {
  let state=states.get(root);
  if(!state) {
    const bones:T.Bone[]=[];root.traverse(o=>{if(o instanceof T.Bone)bones.push(o);});
    const definitions:[string,number][]=[['idle',2.4],['walk',.8],['death',KNIGHT_DEATH_TIME],...[0,1,2].flatMap(a=>[[`hurt${a}`,.8],[`windup${a}`,1],[`strike${a}`,1],[`recover${a}`,1]] as [string,number][])];
    const clips=definitions.map(([clip,duration])=>{
      const times:number[]=[],positions=bones.map(()=>[] as number[]),rotations=bones.map(()=>[] as number[]);
      for(let f=0;f<=40;f++) {
        const t=f/40*duration;times.push(t);author(clip,t);
        bones.forEach((bone,i)=>{positions[i].push(...bone.position.toArray());rotations[i].push(...bone.quaternion.toArray());});
      }
      return new T.AnimationClip(clip,duration,bones.flatMap((bone,i)=>[new T.VectorKeyframeTrack(`${bone.name}.position`,times,positions[i]),new T.QuaternionKeyframeTrack(`${bone.name}.quaternion`,times,rotations[i])]));
    });
    root.animations=clips;
    const mixer=new T.AnimationMixer(root);state={mixer,actions:new Map(clips.map(clip=>[clip.name,mixer.clipAction(clip)]))};states.set(root,state);
  }
  state.mixer.stopAllAction();const action=state.actions.get(name)!;action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();action.time=Math.min(time,action.getClip().duration);state.mixer.update(0);
}


