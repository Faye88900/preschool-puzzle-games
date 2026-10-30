import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rounded } from './puzzle-art';

const templates=new Map<boolean,T.Group>();
const surface=(name:string,color:string,roughness=.94)=>{
  const material=new T.MeshStandardMaterial({color,roughness,vertexColors:true});material.name=`guardian-statue-${name}`;return material;
};
const stone=surface('limestone','#d9d0bb'),trim=surface('carved-edges','#af8545',.76),fracture=surface('fracture','#a19073');
const jade=surface('mineral-jade','#3b7869',.85);
const seams=surface('recesses','#3f514a'),moss=surface('moss','#7f9140'),foliage=surface('ivy','#61853c');
const noise=(n:number)=>Math.sin(n*12.73+9.3)*Math.cos(n*43.1+4.7);
const ivyGeometry=new T.ExtrudeGeometry(new T.Shape([[0,0],[-.42,.25],[-.48,.57],[0,1],[.48,.57],[.42,.25]].map(([x,y])=>new T.Vector2(x,y))),{depth:.025,bevelEnabled:false});

export function createLeafGuardianStatue(damaged=false):T.Group {
  const cached=templates.get(damaged);if(cached)return cached.clone(true);
  const root=new T.Group();root.name=`leaf-guardian-statue-${damaged?'damaged':'intact'}`;
  const body=new T.Group(),helmet=new T.Group(),crown=new T.Group();
  body.name='statue-body';helmet.name='statue-helmet';crown.name='statue-crown';root.add(body,helmet,crown);
  const add=(parent:T.Group,geometry:T.BufferGeometry,material:T.Material,x=0,y=0,z=0)=>{
    const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  };
  const block=(x:number,y:number,z:number,w:number,h:number,d:number,material:T.Material=stone,r=.06)=>
    add(body,rounded(w,h,d,Math.min(r,w/3,h/3,d/3)),material,x,y,z);
  const plate=(parent:T.Group,points:number[][],depth:number,material:T.Material,x=0,y=0,z=0,bevel=.025)=>
    add(parent,new T.ExtrudeGeometry(new T.Shape(points.map(([x,y])=>new T.Vector2(x,y))),
      {depth,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,curveSegments:6}).translate(0,0,-depth/2),material,x,y,z);
  const curve=(parent:T.Group,points:number[][],radius:number,material:T.Material)=>
    add(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(([x,y,z])=>new T.Vector3(x,y,z))),Math.max(4,points.length*2),radius,4,false),material);
  const ellipsoid=(x:number,y:number,z:number,w:number,h:number,d:number,material:T.Material=stone)=>{
    const mesh=add(body,new T.SphereGeometry(1,14,9),material,x,y,z);mesh.scale.set(w,h,d);return mesh;
  };
  const limb=(a:number[],b:number[],r1:number,r2:number,material:T.Material=stone)=>{
    const start=new T.Vector3(...a as [number,number,number]),end=new T.Vector3(...b as [number,number,number]),direction=end.clone().sub(start);
    const mesh=add(body,new T.CylinderGeometry(r2,r1,direction.length(),12,1),material);
    mesh.position.copy(start.add(end).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());return mesh;
  };
  const leaf=(parent:T.Group,x:number,y:number,z:number,w:number,h:number,angle=0,broken=false)=>{
    const group=new T.Group();parent.add(group);group.position.set(x,y,z);group.rotation.z=angle;
    const points=broken?[[0,0],[-w*.47,h*.22],[-w*.36,h*.37],[-w*.14,h*.31],[w*.06,h*.40],[w*.37,h*.30],[w*.45,h*.18]]:
      [[0,0],[-w*.40,h*.24],[-w*.48,h*.51],[-w*.26,h*.75],[0,h],[w*.36,h*.72],[w*.49,h*.47],[w*.35,h*.18]];
    plate(group,points,.09,jade,0,0,0,.018);
    const top=broken?.30:.91;
    curve(group,[[0,.04,.065],[0,h*top*.52,.073],[0,h*top,.065]],.009,trim);
    if(!broken)for(const sign of [-1,1])for(const at of [.30,.52,.68])
      curve(group,[[0,h*at,.067],[sign*w*.22,h*(at+.05),.067],[sign*w*(at>.6?.22:.35),h*(at+.11),.063]],.006,trim);
    return group;
  };

  // Individual plinth stones keep chips and joints visible without widening the entrance proxy.
  block(0,.14,0,2.10,.28,1.84,stone,.09);
  for(const z of [-.71,.71])for(let i=0;i<4;i++) {
    const x=(i-1.5)*.52,mesh=block(x,.18,z,.50,.34,.43,stone,.05);
    mesh.rotation.z=noise(i+z)*.025;
  }
  for(const x of [-.84,.84])for(const z of [-.22,.24])block(x,.18,z,.43,.34,.44,stone,.06);
  for(const sign of [-1,1]) {
    block(sign*.42,.52,.13,.63,.40,.89,stone,.16);
    block(sign*.42,.51,.51,.61,.23,.24,stone,.09);
    ellipsoid(sign*.39,.88,.02,.29,.42,.30);
    plate(body,[[-.26,-.19],[-.30,.07],[-.13,.24],[.13,.24],[.30,.07],[.26,-.19]],.12,jade,sign*.40,.93,.34,.035);
    curve(body,[[sign*.67,.51,.49],[sign*.42,.53,.57],[sign*.17,.51,.49]],.009,seams);
  }
  const torso=add(body,new T.LatheGeometry([[.42,1.12],[.60,1.25],[.65,1.51],[.65,1.88],[.52,2.15],[.27,2.29]].map(p=>new T.Vector2(...p as [number,number])),20),stone);
  torso.scale.z=.70;
  add(body,new T.CylinderGeometry(.28,.38,.15,16),seams,0,2.32,0);
  add(body,new T.CylinderGeometry(.34,.44,.10,16),trim,0,2.29,0);
  for(const front of [-1,1]) {
    const breast=plate(body,[[-.55,-.31],[-.60,.15],[-.40,.37],[0,.43],[.40,.37],[.60,.15],[.55,-.31],[0,-.43]],.14,stone,0,1.82,front*.35,.055);
    if(front<0)breast.rotation.y=Math.PI;
    for(let i=-1;i<=1;i++) {
      const skirt=plate(body,[[-.20,.19],[.20,.19],[.26,-.25],[0,-.32],[-.26,-.25]],.13,i===0?jade:stone,i*.40,1.18,front*.39,.04);
      skirt.rotation.y=front>0?i*.23:Math.PI-i*.23;skirt.rotation.x=front*.14;
    }
    const emblem=new T.Group();emblem.position.set(0,front>0?2.05:1.94,front*.49);if(front<0)emblem.rotation.y=Math.PI;body.add(emblem);
    leaf(emblem,0,-.14,0,.17,.30);leaf(emblem,-.03,-.14,0,.13,.23,.60);leaf(emblem,.03,-.14,0,.13,.23,-.60);
  }
  for(const sign of [-1,1]) {
    const sidePlate=plate(body,[[-.22,.28],[.20,.25],[.29,-.20],[0,-.31],[-.25,-.18]],.13,stone,sign*.61,1.22,0,.035);sidePlate.rotation.y=sign*Math.PI/2;
    ellipsoid(sign*.68,1.98,.02,.28,.32,.31,fracture);
    limb([sign*.68,2.0,.03],[sign*.76,1.68,.29],.22,.25);
    ellipsoid(sign*.76,1.69,.29,.24,.24,.25);
    limb([sign*.74,1.70,.31],[sign*.23,1.83,.72],.245,.20);
    limb([sign*.37,1.80,.61],[sign*.26,1.83,.70],.23,.23,trim);
    const outline=damaged&&sign===1?[[-.40,-.09],[-.38,.14],[-.20,.32],[.04,.36],[.10,.24],[.03,.15],[.17,.10],[.13,-.02],[.31,-.07],[.28,-.18],[0,-.11]]:
      [[-.40,-.10],[-.38,.15],[-.20,.32],[.03,.36],[.28,.26],[.42,.04],[.36,-.18],[.10,-.10],[-.15,-.08]];
    const shoulder=plate(body,outline.map(([x,y])=>[sign*x,y]),.61,jade,sign*.74,2.04,.035,.05);
    shoulder.rotation.z=-sign*.10;
    curve(body,[[sign*.42,2.07,.37],[sign*.62,2.03,.40],[sign*.89,1.99,.38],[sign*1.06,1.94,.29]],.021,trim);
    block(sign*.15,1.87,.76,.32,.31,.31,stone,.10);
    for(let i=0;i<4;i++)block(sign*.15,1.765+i*.067,.92,.27,.063,.09,stone,.025);
    block(sign*.29,1.96,.78,.12,.22,.17,stone,.045).rotation.z=-sign*.40;
  }

  // The curved front is extruded around three real holes, then joined to the rear shell.
  const visor=new T.Shape();visor.moveTo(-.66,-.35);visor.lineTo(.66,-.35);visor.lineTo(.64,.34);visor.lineTo(-.64,.34);visor.closePath();
  for(const x of [-.32,0,.32]) {
    const hole=new T.Path();hole.moveTo(x-.067,-.21);hole.lineTo(x-.067,.17);hole.quadraticCurveTo(x,.20,x+.067,.17);
    hole.lineTo(x+.067,-.21);hole.quadraticCurveTo(x,-.24,x-.067,-.21);visor.holes.push(hole);
  }
  const mask=new T.ExtrudeGeometry(visor,{depth:.085,bevelEnabled:true,bevelSize:.013,bevelThickness:.013,bevelSegments:2,curveSegments:5});
  const position=mask.attributes.position;
  for(let i=0;i<position.count;i++) {
    const x=position.getX(i),y=position.getY(i),r=.603-y*.04+position.getZ(i),theta=x/.64;
    position.setXYZ(i,Math.sin(theta)*r,y+2.75,Math.cos(theta)*r);
  }
  mask.computeVertexNormals();add(helmet,mask,stone);
  add(helmet,new T.CylinderGeometry(.674,.702,.69,28,1,true,1.0,Math.PI*2-2.0),stone,0,2.745,0);
  add(helmet,new T.CylinderGeometry(.42,.43,.58,18),seams,0,2.73,0);
  add(helmet,new T.CylinderGeometry(.69,.71,.075,28),trim,0,2.405,0);
  const lid=new T.LatheGeometry([[.69,3.055],[.69,3.085],[.63,3.125],[.39,3.145],[0,3.145]].map(p=>new T.Vector2(...p as [number,number])),28);
  add(helmet,lid,stone);
  for(const sign of [-1,1]) {
    const rivet=add(helmet,new T.CylinderGeometry(.053,.053,.025,9).rotateZ(Math.PI/2),trim,sign*.687,2.73,0);
    rivet.rotation.y=.1;
  }
  leaf(crown,0,3.105,.005,.43,.76,-.06,damaged);
  leaf(crown,-.31,3.105,.015,.32,.53,.49);leaf(crown,.31,3.105,.015,.32,.53,-.49);

  plate(body,[[0,-.89],[-.18,-.68],[-.18,.68],[.18,.68],[.18,-.68]],.12,stone,0,1.09,.85,.025);
  plate(body,[[0,-.89],[0,.68],[.075,.62],[.075,-.69]],.025,trim,0,1.09,.928,.008);
  block(0,1.91,.85,.13,.38,.15,trim,.04);
  ellipsoid(0,2.08,.85,.11,.09,.10,trim);
  for(const sign of [-1,1])leaf(body,sign*.04,1.73,.91,.20,.36,-sign*1.08);
  leaf(body,0,1.58,.965,.18,.30);

  const sprig=(x:number,y:number,z:number,seed:number,hanging=false)=>{
    const patch=ellipsoid(x,y,z,.15,.035,.11,moss);patch.rotation.y=seed;
    for(let j=0;j<(hanging?5:3);j++) {
      const strand=add(body,ivyGeometry,foliage,x+Math.sin(j*2+seed)*.055,y-(hanging?j*.105:0),z+.025);
      strand.scale.set(.075,.12,1);strand.rotation.z=(j%2?1:-1)*.7;
    }
  };
  for(const [x,y,z,seed]of [[-.82,.35,.70,1],[.75,.35,-.70,3],[-.72,2.38,-.03,4],[.50,2.13,-.29,6],[-.44,3.13,-.10,7]])sprig(x,y,z,seed,y>1);
  for(const line of [
    [[-.86,.27,.94],[-.80,.14,.94],[-.85,.02,.94]],
    [[-.59,1.45,.48],[-.48,1.59,.49],[-.53,1.72,.49]],
    [[.35,2.87,.59],[.39,2.96,.56],[.32,3.08,.59]],
    [[-.57,1.30,-.49],[-.47,1.51,-.50],[-.55,1.67,-.50]],
  ])curve(body,line,.007,seams);
  if(damaged) {
    // Broken surfaces are separate solid fragments, not a dark patch painted over intact armor.
    plate(body,[[0,0],[.13,.03],[.20,-.08],[.12,-.16],[-.03,-.10]],.36,fracture,.89,2.21,.09,.012).rotation.y=.55;
    for(const line of [
      [[.30,1.45,.50],[.44,1.60,.50],[.38,1.73,.50],[.51,1.88,.47]],
      [[.38,1.73,.50],[.20,1.78,.51],[.13,1.89,.51]],
      [[.60,2.94,.34],[.55,2.85,.39],[.61,2.70,.34]],
      [[.42,.33,.93],[.48,.22,.94],[.40,.13,.94],[.51,.015,.94]],
    ])curve(body,line,.013,seams);
    for(const [x,y,z,s]of [[.82,.43,.52,.22],[.95,.24,-.35,.16],[-.74,.41,.43,.13]]) {
      const chip=add(body,new T.DodecahedronGeometry(s,0),fracture,x,y,z);chip.rotation.set(.3,x*3,.6);chip.scale.set(1,.64,.78);
    }
    sprig(.98,1.98,.19,5,true);sprig(.02,3.25,-.01,2);
  }

  for(const group of [body,helmet,crown]) {
    group.updateMatrixWorld(true);const batches=new Map<T.Material,T.BufferGeometry[]>();
    group.traverse(node=>{
      if(!(node instanceof T.Mesh))return;
      const geometry=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();geometry.applyMatrix4(node.matrixWorld);geometry.deleteAttribute('uv');
      const p=geometry.attributes.position,colors:number[]=[];
      for(let i=0;i<p.count;i++) {
        const n=noise(Math.round(p.getX(i)*22)+Math.round(p.getY(i)*29)*1.7+Math.round(p.getZ(i)*25)*2.3),shade=.93+n*.055;
        colors.push(shade,shade*.995,shade*.98);
      }
      geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
      const material=node.material as T.Material;if(!batches.has(material))batches.set(material,[]);batches.get(material)!.push(geometry);
    });
    group.clear();for(const [material,geometries]of batches) {
      const mesh=add(group,mergeGeometries(geometries)!,material);mesh.name=material.name;mesh.castShadow=material!==moss&&material!==foliage;mesh.receiveShadow=true;geometries.forEach(g=>g.dispose());
    }
  }
  const minY=new T.Box3().setFromObject(root).min.y;
  root.children.forEach(group=>group.position.y-=minY);
  root.userData.damaged=damaged;templates.set(damaged,root);return root.clone(true);
}
