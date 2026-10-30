import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rounded } from './puzzle-art';

export function createShieldCourtyard(floorTexture: T.Texture) {
  const root = new T.Group(); root.name = 'wind-garden-courtyard';
  const group = (name: string) => { const g=new T.Group();g.name=name;root.add(g);return g; };
  const backdrop=group('wind-garden-guard-ruins'),entrance=group('wind-garden-courtyard-entrance'),plants=group('wind-garden-courtyard-plants');
  const stone=new T.MeshStandardMaterial({color:'#eadbb9',roughness:.94});
  const pale=new T.MeshStandardMaterial({color:'#f4e7c9',roughness:.92});
  const shade=new T.MeshStandardMaterial({color:'#c5b48f',roughness:1});
  const moss=new T.MeshStandardMaterial({color:'#739255',roughness:1});
  const leafLight=new T.MeshStandardMaterial({color:'#9cbb59',roughness:.9});
  const leafDark=new T.MeshStandardMaterial({color:'#507744',roughness:.95});
  const bronze=new T.MeshStandardMaterial({color:'#b79752',roughness:.6,metalness:.25});
  const wood=new T.MeshStandardMaterial({color:'#a87a49',roughness:.95});
  const pink=new T.MeshStandardMaterial({color:'#edbdc7',roughness:.9});
  const white=new T.MeshStandardMaterial({color:'#fff3d6',roughness:.95});
  const center=new T.MeshStandardMaterial({color:'#e1c064',roughness:.9});
  const colliders: {x:number;y:number;z:number;width:number;height:number;depth:number}[]=[];
  const pillars: typeof colliders=[];
  const solid=(x:number,y:number,z:number,width:number,height:number,depth:number)=>{
    const collider={x,y,z,width,height,depth};colliders.push(collider);return collider;
  };
  const add=(parent:T.Group,geometry:T.BufferGeometry,material:T.Material,x:number,y:number,z:number)=>{
    const m=new T.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m;
  };
  const block=(parent:T.Group,x:number,y:number,z:number,w:number,h:number,d:number,material:T.Material=stone)=>
    add(parent,rounded(w,h,d,Math.min(.06,h/4)),material,x,y,z);
  const sphere=new T.IcosahedronGeometry(1,0),stem=new T.CylinderGeometry(1,1,1,5);
  const pebble=(parent:T.Group,x:number,y:number,z:number,sx:number,sy:number,sz:number,material:T.Material)=>{
    const m=add(parent,sphere,material,x,y,z);m.scale.set(sx,sy,sz);return m;
  };
  const tube=(parent:T.Group,points:T.Vector3[],radius:number,material:T.Material)=>
    add(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points),Math.max(4,points.length*3),radius,4),material,0,0,0);
  const leafShape=new T.Shape();leafShape.moveTo(0,0);leafShape.quadraticCurveTo(-.65,.55,0,1.5);leafShape.quadraticCurveTo(.65,.55,0,0);
  const leafGeometry=new T.ShapeGeometry(leafShape,6);
  const vine=(parent:T.Group,x:number,y:number,z:number,length:number)=>{
    const points=Array.from({length:8},(_,i)=>new T.Vector3(x+Math.sin(i*1.7)*.16,y-i*length/7,z+Math.cos(i)*.09));
    tube(parent,points,.024,leafDark);
    for(let i=0;i<8;i++){
      const p=points[i];const m=pebble(parent,p.x+(i%2?-.12:.12),p.y,p.z+.1,.19,.27,.07,i%3?moss:leafLight);m.rotation.z=i%2?-.55:.55;
    }
  };
  // Back wall and side beds sit at the edge of the existing room, clear of the dodge lanes.
  for(const side of [-1,1]) {
    for(let row=0;row<3;row++)for(let i=0;i<3;i++) {
      const height=row===2&&i===2?.24:.44,x=25+side*(3.15+i*1.05+(row%2)*.15);
      block(backdrop,x,.26+row*.45,-7.45,1.03,height,.7,(row+i)%3?stone:pale);
    }
    solid(25+side*4.1,.7,-7.45,3.25,1.4,.7);
    for(const x of [25+side*2.75,25+side*5.65])vine(backdrop,x,1.65,-7.03,1.4);
  }
  const niche=new T.Shape();niche.moveTo(-1.95,0);niche.lineTo(1.95,0);niche.lineTo(1.95,2.8);
  niche.quadraticCurveTo(1.5,3.55,0,4.2);niche.quadraticCurveTo(-1.5,3.55,-1.95,2.8);niche.closePath();
  const nicheGeometry=new T.ExtrudeGeometry(niche,{depth:.6,bevelEnabled:true,bevelSize:.11,bevelThickness:.07,bevelSegments:1,steps:1,curveSegments:8});
  add(backdrop,nicheGeometry,stone,25,.08,-7.85);
  const nicheTrim=tube(backdrop,[new T.Vector3(23.2,.4,-7.1),new T.Vector3(23.2,2.8,-7.1),new T.Vector3(25,4.1,-7.1),new T.Vector3(26.8,2.8,-7.1),new T.Vector3(26.8,.4,-7.1)],.11,pale);
  nicheTrim.name='guard-niche-trim';solid(25,2.2,-7.5,4.1,4.4,.85);
  for(let i=0;i<6;i++)for(const side of [-1,1])block(backdrop,25+side*1.72,.32+i*.46,-7.04,.4,.42,.22,i%2?stone:pale);
  for(const [x,h]of [[22.5,3.9],[28,3.1]] as const) {
    for(let i=0;i<Math.ceil(h/.52);i++)block(backdrop,x,.28+i*.5,-7.65,.88,.46,.88,i%2?stone:pale);
    block(backdrop,x,h+.12,-7.65,1.15,.22,1.15,pale);pillars.push(solid(x,h/2,-7.65,1.1,h,1.1));vine(backdrop,x-.2,h+.2,-7.05,h*.7);
  }
  const shield=new T.Shape();shield.moveTo(0,0);shield.bezierCurveTo(-1.05,.65,-1,1.8,0,2.85);shield.bezierCurveTo(1,1.8,1.05,.65,0,0);
  const shieldGeometry=new T.ExtrudeGeometry(shield,{depth:.08,bevelEnabled:true,bevelSize:.05,bevelThickness:.025,bevelSegments:1,steps:1,curveSegments:10});
  add(backdrop,shieldGeometry,bronze,25,.72,-7.08);
  const inset=add(backdrop,shieldGeometry,leafDark,25,.86,-6.96);inset.scale.set(.84,.84,.7);
  vine(backdrop,23.65,3.7,-6.94,2.9);vine(backdrop,26.5,3.4,-6.96,2.3);
  // A small hanging bell and a spare shield explain the garden sentinel's home.
  block(backdrop,29.15,3.3,-7.25,2.35,.13,.15,wood);block(backdrop,30.2,1.75,-7.25,.16,3.1,.16,wood);
  add(backdrop,new T.CylinderGeometry(.022,.022,.65,5),bronze,28.75,2.91,-7.24);
  const bellProfile=[new T.Vector2(.06,0),new T.Vector2(.24,-.12),new T.Vector2(.16,.12),new T.Vector2(.13,.35),new T.Vector2(.04,.4)];
  add(backdrop,new T.LatheGeometry(bellProfile,12),bronze,28.75,2.48,-7.24);pebble(backdrop,28.75,2.29,-7.24,.055,.1,.055,bronze);
  const spare=add(plants,shieldGeometry,bronze,31.45,.15,-4.35);spare.scale.set(.48,.48,.48);spare.rotation.set(-.17,-.5,-.28);
  const entryX=25,entryZ=12.1,outerRadius=2.8,innerRadius=2.2;
  for(const side of [-1,1]) {
    const x=entryX+side*(outerRadius+innerRadius)/2;
    for(let i=0;i<3;i++)block(entrance,x,.28+i*.5,entryZ,1.05,.45,1.05,i%2?stone:pale);
    block(entrance,x,1.7,entryZ,1.3,.22,1.25,pale);pillars.push(solid(x,.9,entryZ,1.15,1.8,1.15));vine(entrance,x+.3,1.8,entryZ+.6,1.5);
  }
  const arch=new T.Shape();arch.absarc(0,0,outerRadius,0,Math.PI,false);arch.lineTo(-innerRadius,0);arch.absarc(0,0,innerRadius,Math.PI,0,true);arch.closePath();
  const archGeometry=new T.ExtrudeGeometry(arch,{depth:.68,bevelEnabled:true,bevelSize:.06,bevelThickness:.05,bevelSegments:1,steps:1,curveSegments:18});
  add(entrance,archGeometry,pale,entryX,1.7,entryZ-.34);vine(entrance,entryX-1.75,3.7,entryZ+.4,1.8);vine(entrance,entryX+1.8,3.5,entryZ+.45,1.6);
  const beds=[[18.45,-4.6],[31.6,-5.25],[18.4,5.7],[31.7,5.9]];
  for(const [x,z] of beds) {
    block(plants,x,.16,z,2.15,.3,1.4,shade);block(plants,x,.34,z,1.94,.08,1.2,moss);
    for(const side of [-1,1])block(plants,x+side*1.03,.36,z,.18,.25,1.45,pale);
    for(const side of [-1,1])block(plants,x,.36,z+side*.67,2.1,.25,.17,stone);
    solid(x,.25,z,2.15,.5,1.45);
  }
  const flower=(x:number,z:number,scale:number,tint:T.Material,base=.06)=>{
    const height=.4*scale,m=add(plants,stem,leafDark,x,height/2+base,z);m.scale.set(.028*scale,height,.028*scale);
    for(let j=0;j<5;j++){const a=j*Math.PI*2/5;pebble(plants,x+Math.cos(a)*.14*scale,height+base,z+Math.sin(a)*.14*scale,.13*scale,.06*scale,.13*scale,tint);}
    pebble(plants,x,height+base+.06,z,.075*scale,.055*scale,.075*scale,center);
    const leaf=add(plants,leafGeometry,leafLight,x,base+.02,z);leaf.scale.setScalar(.3*scale);leaf.rotation.set(-Math.PI/3,0,1.2);
  };
  for(const [x,z] of beds) {
    for(let i=0;i<3;i++)pebble(plants,x+(i-1)*.55,.56,z-.23,.52,.35,.42,i%2?moss:leafDark);
    for(let i=0;i<7;i++)flower(x+((i%4)-1.5)*.44,z+(i<4?.28:-.23),1.2+(i%3)*.22,i%3?white:pink,.38);
  }
  for(let i=0;i<78;i++) {
    const a=i*2.39996,back=i%3===0;
    const x=back?18.3+(i%18)*.79:25+Math.cos(a)*(7.9+(i%3)*.22),z=back?-7.15-(i%4)*.27:Math.sin(a)*(7.9+(i%3)*.22);
    if((Math.abs(z)<2.3)||(z>6.5&&x>20&&x<28.8))continue;
    flower(x,z,1.1+(i%4)*.18,i%3?white:pink);
    if(i%3===0)pebble(plants,x-.35,.3,z-.15,.58,.38,.5,i%2?moss:leafDark);
  }
  for(let i=0;i<14;i++) {
    const x=i%2?17.7:32.2,z=-6+(i%7)*2;
    if(Math.abs(z)<2.3)continue;
    for(let j=0;j<5;j++){
      const a=j*Math.PI*2/5;
      for(let k=0;k<4;k++){
        const m=add(plants,leafGeometry,k%2?moss:leafLight,x+Math.cos(a)*k*.12,.08+k*.09,z+Math.sin(a)*k*.12);
        m.scale.set(.14,.2,.2);m.rotation.set(-.8,a,Math.sin(j)*.5);
      }
    }
  }
  // Layered foliage behind the ruin changes the hedge skyline without entering the playable room.
  const crownGeometry=new T.IcosahedronGeometry(1,1);
  for(let i=0;i<7;i++) {
    const x=15.9+i*2.95,z=-11.8-(i%3)*1.3,h=3.1+(i%3)*.7;
    const trunk=add(plants,stem,wood,x,h/2,z);trunk.scale.set(.22,h,.22);
    for(let j=0;j<5;j++) {
      const a=j*2.39996,m=add(plants,crownGeometry,(i+j)%3?moss:leafDark,x+Math.cos(a)*.85,h+.3+(j%3)*.45,z+Math.sin(a)*.8);
      m.scale.set(1.5+(j%2)*.15,1.45,1.4);m.rotation.y=a;
    }
  }
  // Merge only opaque support geometry; the textured floor and progress signals retain their own state.
  const batch=(component:T.Group,castShadow=true)=>{
    component.updateMatrixWorld(true);const batches=new Map<T.Material,T.BufferGeometry[]>();
    component.traverse(node=>{
      if(!(node instanceof T.Mesh))return;const g=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();
      g.applyMatrix4(node.matrixWorld);g.deleteAttribute('uv');const material=node.material as T.Material;
      if(!batches.has(material))batches.set(material,[]);batches.get(material)!.push(g);
    });
    component.clear();for(const [material,geometries] of batches){const m=new T.Mesh(mergeGeometries(geometries)!,material);m.castShadow=castShadow;m.receiveShadow=true;component.add(m);geometries.forEach(g=>g.dispose());}
  };
  for(const component of [backdrop,entrance,plants])batch(component);
  const floor=add(root,new T.CircleGeometry(7.15,64).rotateX(-Math.PI/2),new T.MeshStandardMaterial({map:floorTexture,roughness:1}),25,.086,0);
  floor.name='courtyard-wind-mosaic';floor.receiveShadow=true;
  const signalMaterial=new T.MeshStandardMaterial({color:'#94d8ad',emissive:'#65c99e',emissiveIntensity:.04,roughness:.75});
  const crest=group('courtyard-crest-veins');
  tube(crest,[new T.Vector3(25,.93,-6.86),new T.Vector3(24.94,1.75,-6.86),new T.Vector3(25.05,2.6,-6.86),new T.Vector3(25,3.18,-6.86)],.036,signalMaterial);
  for(const side of [-1,1])tube(crest,[new T.Vector3(25,1.4,-6.85),new T.Vector3(25+side*.43,1.85,-6.85),new T.Vector3(25+side*.46,2.35,-6.85)],.027,signalMaterial);
  const trail=group('courtyard-victory-leaves');trail.visible=false;
  const trailMaterial=new T.MeshBasicMaterial({color:'#67dbaa'});
  for(let i=0;i<6;i++){
    const m=add(trail,leafGeometry,trailMaterial,29.2+i*1.12,.13,.45*Math.sin(i*.65));m.rotation.set(-Math.PI/2,0,-Math.PI/2);m.scale.set(.6,.6,.6);
  }
  const sign=group('courtyard-onward-sign');
  block(sign,33.4,.65,-1.6,.13,1.3,.13,wood);const arrow=new T.Shape();arrow.moveTo(-.65,-.2);arrow.lineTo(.25,-.2);arrow.lineTo(.25,-.38);arrow.lineTo(.8,0);arrow.lineTo(.25,.38);arrow.lineTo(.25,.2);arrow.lineTo(-.65,.2);arrow.closePath();
  add(sign,new T.ExtrudeGeometry(arrow,{depth:.12,bevelEnabled:false}),wood,33.4,1.24,-1.65);
  const signLeaf=add(sign,leafGeometry,pale,33.15,1.05,-1.49);signLeaf.scale.setScalar(.25);signLeaf.rotation.z=-.65;
  for(const component of [crest,trail,sign])batch(component,false);
  let cleared=false;
  return {root,colliders,pillars,occluders:[backdrop,entrance],setCleared(value:boolean){
    if(cleared===value)return;cleared=value;trail.visible=value;signalMaterial.emissiveIntensity=value ? .65 : .04;
  }};
}
