import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true});
const errors=[];
try {
  await mkdir('artifacts/models/potting-workbench',{recursive:true}); await mkdir('test-results',{recursive:true});
  const page=await browser.newPage({viewport:{width:1200,height:900}});
  page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/__potting-model',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5194/')+'__potting-model');
  const metrics=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js');
    const {createPottingWorkbench}=await import('/src/potting-workbench.ts');
    const root=createPottingWorkbench(), copy=createPottingWorkbench(), scene=new T.Scene();scene.add(root);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,900);renderer.setPixelRatio(1);
    renderer.setClearColor('#faf6eb');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#f5f8ff','#a2a590',2));
    const sun=new T.DirectionalLight('#fff0d5',2.8);sun.position.set(-3,6,5);sun.castShadow=true;sun.shadow.mapSize.setScalar(2048);
    Object.assign(sun.shadow.camera,{left:-2,right:2,top:3,bottom:-1,near:.1,far:20});sun.shadow.normalBias=.012;scene.add(sun);
    const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:'#faf6eb',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.003;floor.receiveShadow=true;scene.add(floor);
    const camera=new T.OrthographicCamera(-1.45,1.45,1.0875,-1.0875,.1,20);camera.position.set(2.5,2.0,3.6);camera.lookAt(0,.64,0);renderer.render(scene,camera);
    let triangles=0,finite=true;
    root.traverse(m=>{if(!m.isMesh)return;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
      finite&&=Array.from(m.geometry.attributes.position.array).every(Number.isFinite)&&Array.from(m.geometry.attributes.normal.array).every(Number.isFinite);});
    root.updateMatrixWorld(true);
    const ray=new T.Raycaster();
    const height=(x,z,objects)=>{ray.set(new T.Vector3(x,3,z),new T.Vector3(0,-1,0));return ray.intersectObjects(objects,false)[0]?.point.y;};
    const pots=root.getObjectByName('bench-terracotta'),tray=root.getObjectByName('bench-tray'),soil=root.getObjectByName('bench-soil');
    const potDepth=height(-.68+.143,-.205,[pots])-height(-.68,-.205,[pots]);
    const soilHeights=[];for(const x of [-.58,-.36,-.14])for(const z of [-.075,.125])soilHeights.push(height(x,z,[tray,soil]));
    const rimHeight=height(-.703,.025,[tray]);
    window.benchTest={T,root,renderer,scene,camera};
    const box=new T.Box3().setFromObject(root);
    return {triangles,finite,meshes:root.children.length,minY:box.min.y,size:box.getSize(new T.Vector3()).toArray(),potDepth,soilHeights,rimHeight,
      shared:root!==copy&&root.children.every((m,i)=>m.geometry===copy.children[i].geometry&&m.material===copy.children[i].material)};
  });
  assert.ok(metrics.finite&&metrics.triangles<22000&&metrics.meshes<=14);
  assert.ok(Math.abs(metrics.minY)<.0001&&Math.abs(metrics.size[0]-1.8)<.001&&metrics.size[1]>1.3&&metrics.size[1]<1.5);
  assert.ok(metrics.potDepth>.15,'Terracotta pot must have a real open cavity');
  assert.ok(metrics.soilHeights.length===6&&metrics.soilHeights.every(y=>Number.isFinite(y)&&metrics.rimHeight-y>.008),'All six cells must be recessed below an open tray rim');
  assert.ok(metrics.shared,'Cloned benches must reuse their geometry and materials');
  await page.screenshot({path:'artifacts/models/potting-workbench/three-quarter.png'});
  for(const [name,position]of [['front',[0,1.15,4]],['side',[4,1.15,0]],['back',[0,1.15,-4]]]){
    await page.evaluate(position=>{const s=window.benchTest;s.camera.position.fromArray(position);s.camera.lookAt(0,.67,0);s.renderer.render(s.scene,s.camera);},position);
    await page.screenshot({path:`artifacts/models/potting-workbench/${name}.png`});
  }
  const bytes=await page.evaluate(async()=>{
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
    const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {T,root}=window.benchTest;
    const buffer=await new GLTFExporter().parseAsync(root,{binary:true});
    const loaded=(await new GLTFLoader().parseAsync(buffer,'')).scene;
    const originalSize=new T.Box3().setFromObject(root).getSize(new T.Vector3());
    const loadedSize=new T.Box3().setFromObject(loaded).getSize(new T.Vector3());
    if(originalSize.distanceTo(loadedSize)>.0001)throw new Error('GLB reload changed model bounds');
    let meshes=0,triangles=0;loaded.traverse(m=>{if(m.isMesh){meshes++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;}});
    if(meshes!==12||triangles!==16688)throw new Error('GLB reload changed model geometry');
    return Array.from(new Uint8Array(buffer));
  });
  const glb=Buffer.from(bytes);assert.equal(glb.toString('ascii',0,4),'glTF');assert.equal(glb.readUInt32LE(8),glb.length);
  await writeFile('artifacts/models/potting-workbench/potting-workbench.glb',glb);
  assert.deepEqual(errors,[]);
  await writeFile('artifacts/models/potting-workbench/metrics.json',JSON.stringify({...metrics,glbBytes:glb.length},null,2));
  console.log('PASS potting bench finite geometry, open pots, six recessed cells, shared resources, views and GLB export/reload',JSON.stringify({...metrics,glbBytes:glb.length}));
} finally {await browser.close();}
