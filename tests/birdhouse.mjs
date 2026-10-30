import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),errors=[];
try{
  await mkdir('artifacts/models/birdhouse',{recursive:true});
  const page=await browser.newPage({viewport:{width:1200,height:900}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/__birdhouse',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5194/')+'__birdhouse');
  const metrics=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js');
    const {createBirdhouse}=await import('/src/birdhouse.ts');
    const root=createBirdhouse(),copy=createBirdhouse(),scene=new T.Scene();scene.add(root);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,900);renderer.setPixelRatio(1);
    renderer.setClearColor('#faf6eb');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#f5f8ff','#a2a590',2));
    const sun=new T.DirectionalLight('#fff0d5',2.8);sun.position.set(-3,6,5);sun.castShadow=true;sun.shadow.mapSize.setScalar(2048);
    Object.assign(sun.shadow.camera,{left:-2,right:2,top:2,bottom:-1,near:.1,far:20});sun.shadow.normalBias=.003;scene.add(sun);
    const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:'#faf6eb',roughness:1}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-.003;floor.receiveShadow=true;scene.add(floor);
    const camera=new T.OrthographicCamera(-.88,.88,.66,-.66,.1,20);camera.position.set(1.8,1.3,3);camera.lookAt(0,.53,0);renderer.render(scene,camera);
    let triangles=0,finite=true;
    root.traverse(m=>{if(!m.isMesh)return;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
      finite&&=Array.from(m.geometry.attributes.position.array).every(Number.isFinite)&&Array.from(m.geometry.attributes.normal.array).every(Number.isFinite);});
    root.updateMatrixWorld(true);
    const ray=new T.Raycaster(),depth=(x,y)=>{ray.set(new T.Vector3(x,y,1),new T.Vector3(0,0,-1));return ray.intersectObject(root,true)[0]?.point.z;};
    const entranceDepths=[depth(0,.58)];for(let i=0;i<8;i++){const angle=i*Math.PI/4;entranceDepths.push(depth(Math.cos(angle)*.08,.58+Math.sin(angle)*.08));}
    const faceDepth=depth(.16,.58),perchDepth=depth(0,.315);
    const angledInterior=[];for(const x of [-.6,.6]){ray.set(new T.Vector3(x,.58,1),new T.Vector3(-x,0,-.753).normalize());angledInterior.push(ray.intersectObject(root,true)[0]?.object.name);}
    const backDepths=[];for(const y of [.32,.43,.54]){ray.set(new T.Vector3(0,y,-1),new T.Vector3(0,0,1));backDepths.push(ray.intersectObject(root,true)[0]?.point.z);}
    const box=new T.Box3().setFromObject(root);window.birdTest={T,root,renderer,scene,camera,triangles};
    return {triangles,finite,meshes:root.children.length,min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new T.Vector3()).toArray(),entranceDepths,faceDepth,perchDepth,backDepths,angledInterior,
      shared:root!==copy&&root.children.every((m,i)=>m.geometry===copy.children[i].geometry&&m.material===copy.children[i].material)};
  });
  assert.ok(metrics.finite&&metrics.triangles<20000&&metrics.meshes<=7);
  assert.ok(Math.abs(metrics.min[1])<.0001&&metrics.size[0]>.75&&metrics.size[0]<.95&&metrics.size[1]>1&&metrics.size[1]<1.15);
  assert.ok(metrics.faceDepth>.24&&metrics.entranceDepths.every(z=>Number.isFinite(z)&&z<-.17),'Round entrance must open through the front panel into a deep cavity');
  assert.ok(metrics.angledInterior.every(name=>name==='birdhouse-interior'),'Angled views through the hole must reach the interior lining');
  assert.ok(metrics.perchDepth>.42,'A solid perch must project below the entrance');
  assert.ok(metrics.backDepths.every(z=>z<-.31)&&metrics.min[2]>-.32,'Rear cleat and its two fasteners must define the mounting plane');
  assert.ok(metrics.shared,'Instances must share geometry and materials');
  await page.screenshot({path:'artifacts/models/birdhouse/three-quarter.png'});
  for(const[name,position]of [['front',[0,.7,4]],['side',[4,.7,0]],['back',[0,.7,-4]]]){
    await page.evaluate(position=>{const s=window.birdTest;s.camera.position.fromArray(position);s.camera.lookAt(0,.53,0);s.renderer.render(s.scene,s.camera);},position);
    await page.screenshot({path:`artifacts/models/birdhouse/${name}.png`});
  }
  const bytes=await page.evaluate(async()=>{
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
    const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {T,root,triangles}=window.birdTest,buffer=await new GLTFExporter().parseAsync(root,{binary:true});
    const loaded=(await new GLTFLoader().parseAsync(buffer,'')).scene;
    const size=node=>new T.Box3().setFromObject(node).getSize(new T.Vector3());
    let count=0,meshes=0;loaded.traverse(m=>{if(m.isMesh){meshes++;count+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;}});
    if(size(root).distanceTo(size(loaded))>.0001||count!==triangles||meshes!==root.children.length)throw new Error('GLB reload changed model');
    return Array.from(new Uint8Array(buffer));
  });
  const glb=Buffer.from(bytes);assert.equal(glb.toString('ascii',0,4),'glTF');assert.equal(glb.readUInt32LE(8),glb.length);
  await writeFile('artifacts/models/birdhouse/birdhouse.glb',glb);assert.deepEqual(errors,[]);
  await writeFile('artifacts/models/birdhouse/metrics.json',JSON.stringify({...metrics,glbBytes:glb.length},null,2));
  console.log('PASS birdhouse open entrance, hollow interior, perch, mounting cleat, shared resources and GLB roundtrip',JSON.stringify({...metrics,glbBytes:glb.length}));
}finally{await browser.close();}
