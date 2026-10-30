import * as T from 'three';
import { BOSS_ARENA } from './ferry-shore-layout';
import { createAncientWindSword } from './ancient-wind-sword';
import { createWrappingSwordRoots } from './wrapping-sword-roots';
import { createLeafGuardianStatue } from './leaf-guardian-statue';
import { createLeafChimePost } from './leaf-chime-post';
import { createLeafWaterChannel, LEAF_CHANNEL_FLOORS, LEAF_CHANNEL_SPACING } from './leaf-water-channel';
import { createLeafWeaponRack } from './leaf-weapon-rack';
import { createCampfireRemains } from './campfire-remains';
import { createLeafEmblemStele } from './leaf-emblem-stele';
import { createCourtyardGardenProps } from './courtyard-garden-props';
import { createFloatingRock } from './floating-islands';

export function createBossCourtyardBlockout() {
  const root=new T.Group();root.name='boss-courtyard-blockout';root.userData.stage='blockout';
  const {left,right,top,bottom}=BOSS_ARENA;
  root.position.set((left+right)/2,0,(top+bottom)/2);
  const colliders:{x:number;y:number;z:number;width:number;height:number;depth:number}[]=[];
  const group=(name:string,x:number,z:number)=>{
    const object=new T.Group();object.name=`boss-blockout-${name}`;object.position.set(x,0,z);root.add(object);return object;
  };
  const base=(parent:T.Group,w:number,h:number,d:number)=>{
    colliders.push({x:root.position.x+parent.position.x,y:h/2,z:root.position.z+parent.position.z,width:w,height:h,depth:d});
  };

  // Authored props replace their reserved silhouettes one group at a time.
  const sword=group('sword',5,-17),blade=createAncientWindSword();blade.rotation.z=-.25;sword.add(blade);
  base(sword,4.8,10,1.6);

  const roots=group('roots',sword.position.x,sword.position.z);roots.add(createWrappingSwordRoots());
  colliders.push(
    {x:root.position.x+roots.position.x-4.5,y:1.5,z:root.position.z+roots.position.z-1.2,width:4.2,height:3,depth:2},
    {x:root.position.x+roots.position.x+5.2,y:1.2,z:root.position.z+roots.position.z-1,width:3.4,height:2.4,depth:2},
  );

  const statue=group('statue-0',-18,6);
  statue.add(createLeafGuardianStatue());
  base(statue,2.2,3.2,2.2);

  for(const [index,x,z]of [[0,-18,-14.5],[1,17.5,14]]) {
    const chime=group(`chime-${index}`,x,z);
    chime.add(createLeafChimePost());
    base(chime,1.1,2.2,1.1);
  }

  const channel=createLeafWaterChannel();channel.position.set(18.2,0,-13.8);channel.rotation.y=Math.PI/4;root.add(channel);
  for(const [i,floor]of LEAF_CHANNEL_FLOORS.entries()) {
    channel.getObjectByName(`leaf-water-tier-${i}`)!.name=`boss-blockout-water-channel-${i}`;
    const step=i*LEAF_CHANNEL_SPACING/Math.sqrt(2),height=floor+.50;
    colliders.push({x:root.position.x+18.2+step,y:height/2,z:root.position.z-13.8+step,width:3.2,height,depth:3.2});
  }
  channel.getObjectByName('leaf-channel-waterfall-preview')!.name='boss-blockout-waterfall';

  const rack=group('weapon-rack',-14,-18);
  rack.add(createLeafWeaponRack());
  base(rack,2.8,2,1.3);

  const camp=group('campfire',-16,-16);
  camp.add(createCampfireRemains());

  const marker=group('marker',-15,17);
  marker.add(createLeafEmblemStele());base(marker,1.7,2.3,.85);
  const pots=group('pots',-12,18);
  pots.add(createCourtyardGardenProps());
  base(pots,2.5,.75,1.4);

  const shards=group('floating-rocks',15,-22);
  for(const [i,kind]of (['c','b','a'] as const).entries()) {
    const rock=createFloatingRock(kind);rock.position.set(i*3,6+i*3.1,0);rock.rotation.set(.04,i*.55,(i-1)*.12);shards.add(rock);
  }
  return {root,colliders};
}
