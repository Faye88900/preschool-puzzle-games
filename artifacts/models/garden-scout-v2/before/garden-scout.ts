import * as T from 'three';
import { createPlayerCharacter, setCharacterExpression } from './character';
import { treasureLeaf } from './treasure-details';

const skin = new T.MeshStandardMaterial({color:'#d9e9bd',roughness:.6});
const leafGreen = new T.MeshStandardMaterial({color:'#5e9375',roughness:.75});
const paleGreen = new T.MeshStandardMaterial({color:'#a4c786',roughness:.72});
const darkGreen = new T.MeshStandardMaterial({color:'#3f6e59',roughness:.8});
const gold = new T.MeshStandardMaterial({color:'#dbbd76',roughness:.45,metalness:.25});
const wood = new T.MeshStandardMaterial({color:'#b38c5b',roughness:.8});
const sphere = new T.SphereGeometry(1,24,16);

export function createGardenScout(): T.Group {
  const root = createPlayerCharacter(); root.name='garden-scout';
  root.remove(root.getObjectByName('player-marker')!);
  const avatar=root.getObjectByName('avatar')!,upper=new T.Group();upper.name='scout-upper';avatar.add(upper);
  for(const name of ['body','face','arm-1','arm1'])upper.add(root.getObjectByName(name)!);
  const body=root.getObjectByName('body') as T.Mesh;body.material=skin;body.geometry=sphere;
  for(const side of [-1,1]) {
    avatar.remove(root.getObjectByName('ear'+side)!);
    const hand=root.getObjectByName('arm'+side)!.children[0] as T.Mesh;hand.material=skin;hand.geometry=sphere;
    const foot=root.getObjectByName('foot'+side) as T.Mesh;foot.material=darkGreen;foot.geometry=sphere;
  }
  const part=(parent:T.Object3D,name:string,geometry:T.BufferGeometry,material:T.Material,x:number,y:number,z:number,sx=1,sy=sx,sz=sx)=>{
    const mesh=new T.Mesh(geometry,material);mesh.name=name;mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;parent.add(mesh);return mesh;
  };
  const hood=new T.Group();hood.name='scout-leaf-hood';upper.add(hood);
  part(hood,'hood-dome',new T.SphereGeometry(1,32,16,0,Math.PI*2,0,Math.PI/2),leafGreen,0,.37,.025,.61,.31,.56);
  for(const side of [-1,1]) {
    const ear=part(hood,'hood-leaf-ear'+side,treasureLeaf,paleGreen,side*.33,.45,.07,.39,.54,.9);ear.rotation.z=-side*.5;
    const flap=part(hood,'hood-cheek'+side,sphere,leafGreen,side*.49,.14,.09,.12,.25,.32);flap.rotation.z=-side*.24;
    const cape=part(upper,'scout-leaf-cape'+side,treasureLeaf,side<0?leafGreen:darkGreen,side*.13,.35,.43,.88,.92,1.4);cape.rotation.z=Math.PI+side*.19;
    const sprout=part(hood,'hood-sprout'+side,treasureLeaf,paleGreen,0,.64,.06,.25,.31,.65);sprout.rotation.z=-side*.9;
  }
  const clasp=part(upper,'leaf-clasp',treasureLeaf,gold,0,-.4,-.43,.2,.23,.6);
  clasp.rotation.z=-.3;
  part(upper,'leaf-pouch',sphere,darkGreen,.45,-.3,.18,.15,.18,.13);
  part(upper,'pouch-button',sphere,gold,.46,-.28,.045,.035);
  const hand=root.getObjectByName('arm-1')!;
  part(hand,'scout-wind-staff',new T.CylinderGeometry(.027,.037,1.18,12),wood,-.11,.09,-.08);
  const rotor=new T.Group();rotor.name='scout-pinwheel';rotor.position.set(-.11,.72,-.10);hand.add(rotor);
  for(let i=0;i<4;i++) {
    const blade=part(rotor,'pinwheel-leaf'+i,treasureLeaf,i%2?leafGreen:paleGreen,0,0,0,.30,.23,.5);blade.rotation.z=i*Math.PI/2+.3;
  }
  part(rotor,'pinwheel-hub',sphere,gold,0,0,-.035,.045);
  setCharacterExpression(root,'neutral');
  return root;
}

export function animateGardenScout(root:T.Group,time:number,talking:boolean,reducedMotion:boolean) {
  const upper=root.getObjectByName('scout-upper')!,arm=root.getObjectByName('arm1')!;
  upper.position.y=reducedMotion?0:Math.sin(time*1.8)*.008;
  arm.rotation.z=talking?-1.1+(reducedMotion?0:Math.sin(time*4)*.08):-.12;
  root.getObjectByName('scout-pinwheel')!.rotation.z=reducedMotion?0:time*.65;
  setCharacterExpression(root,talking?'happy':'neutral');
}
