import * as T from 'three';
import { rounded } from './puzzle-art';
import { batchTreasureParts, treasureLeaf } from './treasure-details';
import { createSailCrystal } from './sail-crystal';

const grainCanvas=document.createElement('canvas');grainCanvas.width=grainCanvas.height=128;
const grain=grainCanvas.getContext('2d')!;grain.fillStyle='#f4e7cf';grain.fillRect(0,0,128,128);
grain.strokeStyle='#d9c5a3';grain.lineWidth=.7;
for(let line=-1;line<20;line++) {
  grain.beginPath();for(let y=0;y<=128;y+=4){const x=line*7+Math.sin(y*.045+line)*1.5;if(y)grain.lineTo(x,y);else grain.moveTo(x,y);}grain.stroke();
}
const timber=new T.CanvasTexture(grainCanvas);timber.colorSpace=T.SRGBColorSpace;
const wood=new T.MeshStandardMaterial({color:'#b88a53',roughness:.72,map:timber});
const lightWood=new T.MeshStandardMaterial({color:'#d1aa74',roughness:.72,map:timber});
const darkWood=new T.MeshStandardMaterial({color:'#775538',roughness:.82});
const cream=new T.MeshStandardMaterial({color:'#f1dfb9',roughness:.7});
const green=new T.MeshStandardMaterial({color:'#709375',roughness:.78});
const gold=new T.MeshStandardMaterial({color:'#cfa968',roughness:.4,metalness:.35});
const rope=new T.MeshStandardMaterial({color:'#d4bd8c',roughness:.95});
const clothCanvas=document.createElement('canvas');clothCanvas.width=256;clothCanvas.height=384;
const cloth=clothCanvas.getContext('2d')!;cloth.fillStyle='#f7eed9';cloth.fillRect(0,0,256,384);
cloth.strokeStyle='#b8a98b22';cloth.lineWidth=.6;
for(let y=0;y<384;y+=4){cloth.beginPath();cloth.moveTo(0,y);cloth.lineTo(256,y);cloth.stroke();}
cloth.strokeStyle='#b5a17a';cloth.lineWidth=2;cloth.setLineDash([5,5]);cloth.strokeRect(8,8,240,368);cloth.setLineDash([]);
cloth.fillStyle='#8ba481';cloth.beginPath();cloth.moveTo(98,225);cloth.bezierCurveTo(53,172,113,123,180,127);
cloth.bezierCurveTo(173,176,127,180,98,225);cloth.fill();
cloth.beginPath();cloth.moveTo(105,231);cloth.bezierCurveTo(122,182,179,182,189,164);
cloth.bezierCurveTo(199,217,163,240,105,231);cloth.fill();
cloth.strokeStyle='#8ba481';cloth.lineWidth=4;cloth.beginPath();cloth.moveTo(136,157);cloth.bezierCurveTo(63,201,85,252,128,254);
cloth.bezierCurveTo(158,253,143,230,131,240);cloth.stroke();
const clothTexture=new T.CanvasTexture(clothCanvas);clothTexture.colorSpace=T.SRGBColorSpace;
const canvasMaterial=new T.MeshStandardMaterial({map:clothTexture,roughness:.92,side:T.DoubleSide});
const plank=rounded(1,1,1,.06),rivet=new T.SphereGeometry(.028,8,5);
const vector=(p:number[])=>new T.Vector3(p[0],p[1],p[2]);

function patch(rows:number,columns:number,point:(t:number,v:number)=>T.Vector3,flip=false) {
  const positions:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let r=0;r<=rows;r++)for(let c=0;c<=columns;c++) {
    positions.push(...point(r/rows,c/columns).toArray());uv.push(c/columns,r/rows);
  }
  for(let r=0;r<rows;r++)for(let c=0;c<columns;c++) {
    const a=r*(columns+1)+c,b=a+columns+1;
    indices.push(...(flip?[a,a+1,b,b,a+1,b+1]:[a,b,a+1,b,b+1,a+1]));
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export function createWindSailBoat():T.Group {
  const boat=new T.Group();boat.name='wind-garden-boat';
  const group=(name:string)=>{const g=new T.Group();g.name=name;boat.add(g);return g;};
  const hull=group('boat-hull'),deck=group('boat-deck'),rig=group('boat-rig'),sail=group('boat-sail');
  const add=(parent:T.Group,geometry:T.BufferGeometry,material:T.Material,x=0,y=0,z=0,sx=1,sy=sx,sz=sx)=>{
    const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;
  };
  const box=(parent:T.Group,material:T.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>add(parent,plank,material,x,y,z,w,h,d);
  const tube=(parent:T.Group,points:number[][],material:T.Material,radius:number,segments=32,closed=false)=>
    add(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(vector),closed),segments,radius,6,closed),material);
  const section=(t:number)=>({width:Math.max(.035,.98*Math.pow(Math.sin(Math.PI*(.06+.94*t)),.58)),
    keel:.05+.38*Math.pow(Math.abs(2*t-1),2.6),rim:.93+.19*(2*t-1)**2+.07*t*t,z:(t-.5)*4.2});
  const skin=(t:number,v:number,side:number,inside=false)=>{
    const s=section(t),angle=v*Math.PI/2,inset=inside?Math.min(.06,s.width*.7):0;
    return new T.Vector3(side*(s.width-inset)*Math.sin(angle),s.keel+(inside?.055:0)+(s.rim-s.keel-(inside?.055:0))*(1-Math.cos(angle)),s.z);
  };
  for(const side of [-1,1]) {
    for(let row=0;row<5;row++)add(hull,patch(36,3,(t,v)=>skin(t,(row+v)/5,side),side>0),row%2?lightWood:wood);
    add(hull,patch(36,12,(t,v)=>skin(t,v,side,true),side<0),lightWood);
    for(let row=1;row<5;row++)tube(hull,Array.from({length:33},(_,i)=>skin(i/32,row/5,side).multiply(new T.Vector3(1.003,1,1)).toArray()),darkWood,.008);
    for(const t of [.12,.27,.72,.88])for(const v of [.42,.79]) {
      const p=skin(t,v,side);p.x+=side*.012;add(hull,rivet,gold,p.x,p.y,p.z);
    }
    for(const t of [.19,.37,.63,.80]) {
      const points=Array.from({length:13},(_,i)=>skin(t,.25+i*.75/12,side,true).multiply(new T.Vector3(.984,1,1)).toArray());
      tube(hull,points,darkWood,.025,16);
    }
  }
  const rimPoints=[...Array.from({length:41},(_,i)=>skin(i/40,1,-1).toArray()),...Array.from({length:41},(_,i)=>skin(1-i/40,1,1).toArray())];
  tube(hull,rimPoints,cream,.064,100,true);
  tube(hull,[[0,.43,-2.1],[0,.13,-1.05],[0,.045,0],[0,.18,1.2],[0,.43,2.1]],darkWood,.035,48);
  const transom=new T.Shape();
  for(let i=0;i<=12;i++){const p=skin(0,1-i/12,-1);if(!i)transom.moveTo(p.x,p.y);else transom.lineTo(p.x,p.y);}
  for(let i=0;i<=12;i++){const p=skin(0,i/12,1);transom.lineTo(p.x,p.y);}transom.closePath();
  add(hull,new T.ExtrudeGeometry(transom,{depth:.07,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:2,steps:1,curveSegments:12}),wood,0,0,-2.135);
  tube(hull,[[0,.43,2.1],[0,.74,2.14],[0,1.14,2.16],[0,1.21,2.10]],wood,.05,24);
  add(hull,treasureLeaf,gold,0,.69,2.165,.30,.47,.65);
  add(hull,treasureLeaf,green,0,.735,2.205,.19,.33,.40);

  const floorHalf=(z:number)=>{
    const s=section(z/4.2+.5),rise=(.545-s.keel)/(s.rim-s.keel);
    return Math.max(.10,(s.width-.06)*Math.sqrt(Math.max(0,1-(1-rise)**2))-.025);
  };
  const floorShape=new T.Shape();
  for(let i=0;i<=28;i++){const z=-1.48+i*2.96/28,x=-floorHalf(z);if(i)floorShape.lineTo(x,-z);else floorShape.moveTo(x,-z);}
  for(let i=28;i>=0;i--){const z=-1.48+i*2.96/28;floorShape.lineTo(floorHalf(z),-z);}floorShape.closePath();
  const floor=add(deck,new T.ExtrudeGeometry(floorShape,{depth:.055,bevelEnabled:true,bevelSize:.01,bevelThickness:.01,bevelSegments:2,steps:1,curveSegments:12}),lightWood,0,.555,0);
  floor.rotation.x=-Math.PI/2;
  for(const fraction of [-.75,-.5,-.25,0,.25,.5,.75])tube(deck,Array.from({length:23},(_,i)=>{
    const z=-1.46+i*2.92/22;return [floorHalf(z)*fraction,.6205,z];}),darkWood,.0035,24);
  for(const z of [-1.35,1.35]) {
    box(deck,lightWood,0,.80,z,1.0,.12,.28);
    for(const x of [-.40,.40]){box(deck,wood,x,.71,z,.11,.18,.13);add(deck,rivet,gold,x,.868,z);}
  }
  box(rig,green,0,.65,0,.30,.06,.30);
  add(rig,new T.CylinderGeometry(.045,.073,3.34,16),wood,0,2.29,0);
  const boom=add(rig,new T.CylinderGeometry(.027,.039,1.82,12),wood,.06,1.96,-.88);boom.rotation.x=Math.PI/2-.05;
  for(const y of [.74,1.96,3.73]) {
    const wrap=add(rig,new T.TorusGeometry(.074,.018,6,18),rope,0,y,0);wrap.rotation.x=Math.PI/2;
  }
  tube(rig,[[0,3.77,0],[.05,2.8,-.90],[.06,1.91,-1.76]],rope,.012,24);
  const rudder=new T.Shape();rudder.moveTo(-.08,.11);rudder.lineTo(-.12,.71);rudder.quadraticCurveTo(0,.84,.12,.71);
  rudder.lineTo(.12,.13);rudder.quadraticCurveTo(0,.025,-.08,.11);
  add(rig,new T.ExtrudeGeometry(rudder,{depth:.06,bevelEnabled:true,bevelSize:.018,bevelThickness:.015,bevelSegments:2,steps:1,curveSegments:12}),green,0,0,-2.17);
  tube(rig,[[0,.45,-2.10],[0,.91,-2.08],[0,1.13,-1.91],[0,1.15,-1.49]],wood,.038,20);
  for(const y of [.36,.68])box(rig,gold,0,y,-2.125,.21,.05,.035);
  const oar=add(rig,new T.CylinderGeometry(.022,.03,1.95,10),wood,1.0,.96,-.58);oar.rotation.x=Math.PI/2;
  const blade=add(rig,treasureLeaf,lightWood,1.0,.965,.36,.36,.58,.50);blade.rotation.x=Math.PI/2;
  for(const z of [-1.2,.03])box(rig,green,1.0,.95,z,.10,.10,.07);
  for(const z of [-1.76,1.69]) {
    const s=section(z/4.2+.5),ring=add(rig,new T.TorusGeometry(.085,.018,6,18),gold,-s.width-.015,s.rim-.08,z);
    ring.rotation.y=Math.PI/2;
  }
  add(rig,patch(6,12,(t,u)=>new T.Vector3(.025+Math.sin(u*Math.PI*2)*.035,3.97+(t-.5)*.25,-.04-u*.60)),green);

  const sailPoint=(v:number,u:number)=>{
    const width=1.68*Math.pow(1-v,.72)+.10*Math.sin(Math.PI*v);
    return new T.Vector3(.07+.42*Math.sin(Math.PI*u)*Math.pow(Math.sin(Math.PI*v),.65),2.03+1.68*v-.10*u*(1-v),-.07-width*u);
  };
  add(sail,patch(28,18,sailPoint),canvasMaterial);
  for(const edge of [0,1])tube(sail,Array.from({length:33},(_,i)=>sailPoint(i/32,edge).toArray()),cream,.017,36);
  tube(sail,Array.from({length:25},(_,i)=>sailPoint(0,i/24).toArray()),cream,.017,28);
  for(const y of [2.08,2.47,2.88,3.30,3.69]) {
    const tie=add(rig,new T.TorusGeometry(.073,.009,5,14),rope,0,y,0);tie.rotation.x=Math.PI/2;
  }
  for(const component of [hull,deck,rig,sail])batchTreasureParts(component);
  (sail.children.find(m=>(m as T.Mesh).material===canvasMaterial)!).name='boat-sail-cloth';
  const crystal=createSailCrystal();crystal.name='wind-sail-crystal';crystal.position.set(0,3.83,0);crystal.scale.setScalar(.4);crystal.visible=false;boat.add(crystal);
  return boat;
}
