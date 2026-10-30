import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),errors=[];
try{
  await mkdir('artifacts/models/stone-well',{recursive:true});
  const page=await browser.newPage({viewport:{width:1200,height:900}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/__stone-well',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5194/')+'__stone-well');
  const metrics=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js');
    const {createStoneWell}=await import('/src/stone-well.ts');
    const root=createStoneWell(),copy=createStoneWell(),scene=new T.Scene();scene.add(root);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,900);renderer.setPixelRatio(1);
    renderer.setClearColor('#faf6eb');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#f5f8ff','#a2a590',2));
    const sun=new T.DirectionalLight('#fff0d5',2.8);sun.position.set(-3,6,5);sun.castShadow=true;sun.shadow.mapSize.setScalar(2048);
    Object.assign(sun.shadow.camera,{left:-3,right:3,top:4,bottom:-2,near:.1,far:20});sun.shadow.normalBias=.008;scene.add(sun);
    const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:'#faf6eb',roughness:1}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-.003;floor.receiveShadow=true;scene.add(floor);
    const camera=new T.OrthographicCamera(-2.3,2.3,1.725,-1.725,.1,25);camera.position.set(4.2,3.6,5.6);camera.lookAt(0,1.4,0);renderer.render(scene,camera);
    let triangles=0,finite=true;
    root.traverse(m=>{if(!m.isMesh)return;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
      finite&&=Array.from(m.geometry.attributes.position.array).every(Number.isFinite)&&Array.from(m.geometry.attributes.normal.array).every(Number.isFinite);});
    root.updateMatrixWorld(true);
    const stoneMeshes=root.children.filter(m=>m.name.startsWith('well-stone-')||m.name==='well-rim'),water=root.getObjectByName('well-water');
    const ray=new T.Raycaster(),down=(x,z,objects,fromY=2)=>{ray.set(new T.Vector3(x,fromY,z),new T.Vector3(0,-1,0));return ray.intersectObjects(objects,false)[0]?.point.y;};
    const interiorDepths=[],rimHeights=[];
    for(let i=0;i<12;i++){const angle=i*Math.PI/6;interiorDepths.push(down(Math.sin(angle)*.48,Math.cos(angle)*.48,[...stoneMeshes,water]));rimHeights.push(down(Math.sin(angle)*.85,Math.cos(angle)*.85,stoneMeshes));}
    const courses=[];for(const[row,y]of [[0,.145],[1,.445],[2,.745]]){const direction=new T.Vector3(Math.sin((row%2)*Math.PI/12),0,Math.cos((row%2)*Math.PI/12));ray.set(direction.clone().multiplyScalar(2).setY(y),direction.negate());courses.push(2-ray.intersectObjects(stoneMeshes,false)[0]?.distance);}
    const joints=[];for(const y of [.145,.445,.745]){const direction=new T.Vector3(Math.sin(Math.PI/12),0,Math.cos(Math.PI/12));ray.set(direction.clone().multiplyScalar(1.2).setY(y),direction.negate());ray.far=.6;joints.push(ray.intersectObjects(stoneMeshes,false).length>0);}ray.far=Infinity;
    const bucket=root.getObjectByName('well-planks'),bucketBottom=down(.06,.04,[bucket],1.2),bucketLip=down(.195,0,[bucket],1.2);
    const cord=root.getObjectByName('well-rope'),ropeHits=[];for(let y=1.25;y<1.67;y+=.05){ray.set(new T.Vector3(.1,y,0),new T.Vector3(-1,0,0));ropeHits.push(ray.intersectObject(cord,false)[0]?.point.x);}
    const ironBounds=new T.Box3().setFromObject(root.getObjectByName('well-iron')),box=new T.Box3().setFromObject(root);
    window.wellTest={T,root,renderer,scene,camera,triangles};
    return {triangles,finite,meshes:root.children.length,min:box.min.toArray(),size:box.getSize(new T.Vector3()).toArray(),interiorDepths,rimHeights,courses,joints,bucketDepth:bucketLip-bucketBottom,ropeHits,ironMinX:ironBounds.min.x,ironMaxX:ironBounds.max.x,
      shared:root!==copy&&root.children.every((m,i)=>m.geometry===copy.children[i].geometry&&m.material===copy.children[i].material)};
  });
  await page.screenshot({path:'artifacts/models/stone-well/three-quarter.png'});
  assert.ok(metrics.finite&&metrics.triangles<38000&&metrics.meshes<=13);
  assert.ok(Math.abs(metrics.min[1])<.0001&&metrics.size[0]>2.8&&metrics.size[0]<3.2&&metrics.size[1]>2.8&&metrics.size[1]<3.1);
  assert.ok(metrics.interiorDepths.every(y=>Math.abs(y-.1)<.001)&&metrics.rimHeights.every(y=>y>.88&&y<.90),'Stone ring must remain genuinely open down to recessed water');
  assert.ok(metrics.courses.every(r=>r>.95)&&JSON.stringify(metrics.joints)==='[false,true,false]',`Three stone courses must have alternating real joints: ${JSON.stringify({courses:metrics.courses,joints:metrics.joints})}`);
  assert.ok(metrics.bucketDepth>.28,'Wooden bucket must have an open cavity');
  assert.ok(metrics.ropeHits.every(x=>x>.018&&x<.023),'One taut rope must continuously connect the winding to the bucket handle');
  assert.ok(metrics.ironMinX>-.3&&metrics.ironMaxX>1.16,'Crank bearing must appear only on the right');
  assert.ok(metrics.shared);
  for(const[name,position]of [['front',[0,1.65,6]],['side',[6,1.65,0]],['back',[0,1.65,-6]]]){
    await page.evaluate(position=>{const s=window.wellTest;s.camera.position.fromArray(position);s.camera.lookAt(0,1.4,0);s.renderer.render(s.scene,s.camera);},position);
    await page.screenshot({path:`artifacts/models/stone-well/${name}.png`});
  }
  const bytes=await page.evaluate(async()=>{
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
    const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {T,root,triangles}=window.wellTest,buffer=await new GLTFExporter().parseAsync(root,{binary:true});
    const loaded=(await new GLTFLoader().parseAsync(buffer,'')).scene,size=node=>new T.Box3().setFromObject(node).getSize(new T.Vector3());
    let count=0,meshes=0;loaded.traverse(m=>{if(m.isMesh){meshes++;count+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;}});
    if(size(root).distanceTo(size(loaded))>.0001||count!==triangles||meshes!==root.children.length)throw new Error('GLB reload changed model');
    return Array.from(new Uint8Array(buffer));
  });
  const glb=Buffer.from(bytes);assert.equal(glb.toString('ascii',0,4),'glTF');assert.equal(glb.readUInt32LE(8),glb.length);
  await writeFile('artifacts/models/stone-well/stone-well.glb',glb);assert.deepEqual(errors,[]);
  await writeFile('artifacts/models/stone-well/metrics.json',JSON.stringify({...metrics,glbBytes:glb.length},null,2));
  console.log('PASS well open staggered stone courses, recessed water, open bucket, continuous rope, right crank, shared resources and GLB roundtrip',JSON.stringify({...metrics,glbBytes:glb.length}));
}finally{await browser.close();}
