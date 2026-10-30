import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),errors=[];
try{
  await mkdir('artifacts/models/garden-tool-rack',{recursive:true});
  const page=await browser.newPage({viewport:{width:1200,height:900}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/__garden-tool-rack',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5194/')+'__garden-tool-rack');
  const metrics=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js');
    const {createGardenToolRack}=await import('/src/garden-tool-rack.ts');
    const root=createGardenToolRack(),copy=createGardenToolRack(),scene=new T.Scene();scene.add(root);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,900);renderer.setPixelRatio(1);
    renderer.setClearColor('#faf6eb');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#f5f8ff','#a2a590',2));
    const sun=new T.DirectionalLight('#fff0d5',2.8);sun.position.set(-3,6,5);sun.castShadow=true;sun.shadow.mapSize.setScalar(2048);
    Object.assign(sun.shadow.camera,{left:-2,right:2,top:3,bottom:-1,near:.1,far:20});sun.shadow.normalBias=.005;scene.add(sun);
    const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:'#faf6eb',roughness:1}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-.003;floor.receiveShadow=true;scene.add(floor);
    const camera=new T.OrthographicCamera(-1.52,1.52,1.14,-1.14,.1,20);camera.position.set(2.5,2.0,4);camera.lookAt(0,.89,0);renderer.render(scene,camera);
    let triangles=0,finite=true;
    root.traverse(m=>{if(!m.isMesh)return;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
      finite&&=Array.from(m.geometry.attributes.position.array).every(Number.isFinite)&&Array.from(m.geometry.attributes.normal.array).every(Number.isFinite);});
    root.updateMatrixWorld(true);
    const ray=new T.Raycaster(),front=(x,y)=>{ray.set(new T.Vector3(x,y,1),new T.Vector3(0,0,-1));const h=ray.intersectObject(root,true)[0];return {name:h?.object.name,z:h?.point.z};};
    const empty=front(0,1.15),gloves=front(-.58,1.18),coil=front(.64,1.16),hooks=[-.52,0,.52].map(x=>front(x,1.50));
    const clay=root.getObjectByName('rack-terracotta'),height=(x,z)=>{ray.set(new T.Vector3(x,.9,z),new T.Vector3(0,-1,0));return ray.intersectObject(clay,false)[0]?.point.y;};
    const potDepths=[height(-.47+.127*.86,.03)-height(-.47,.03),height(-.13+.127*.78,-.02)-height(-.13,-.02)];
    const box=new T.Box3().setFromObject(root);window.rackTest={T,root,renderer,scene,camera,triangles};
    return {triangles,finite,meshes:root.children.length,min:box.min.toArray(),size:box.getSize(new T.Vector3()).toArray(),empty,gloves,coil,hooks,potDepths,
      shared:root!==copy&&root.children.every((m,i)=>m.geometry===copy.children[i].geometry&&m.material===copy.children[i].material)};
  });
  await page.screenshot({path:'artifacts/models/garden-tool-rack/three-quarter.png'});
  assert.ok(metrics.finite&&metrics.triangles<26000&&metrics.meshes<=10);
  assert.ok(Math.abs(metrics.min[1])<.0001&&metrics.size[0]<2&&metrics.size[1]>1.7&&metrics.size[1]<1.9&&metrics.size[2]<.66);
  assert.ok(metrics.empty.z<0,'Middle hook must retain a clear hanging space for the missing trowel');
  assert.equal(metrics.gloves.name,'rack-gloves');assert.equal(metrics.coil.name,'rack-twine');
  assert.ok(metrics.hooks.every(h=>h.name==='rack-brackets'&&h.z>.25),'Three real hooks must project from the backing');
  assert.ok(metrics.potDepths.every(d=>d>.13),'Shelf pots must retain open cavities');assert.ok(metrics.shared);
  for(const[name,position]of [['front',[0,1.2,4]],['side',[4,1.2,0]],['back',[0,1.2,-4]]]){
    await page.evaluate(position=>{const s=window.rackTest;s.camera.position.fromArray(position);s.camera.lookAt(0,.89,0);s.renderer.render(s.scene,s.camera);},position);
    await page.screenshot({path:`artifacts/models/garden-tool-rack/${name}.png`});
  }
  const bytes=await page.evaluate(async()=>{
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
    const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {T,root,triangles}=window.rackTest,buffer=await new GLTFExporter().parseAsync(root,{binary:true});
    const loaded=(await new GLTFLoader().parseAsync(buffer,'')).scene,size=node=>new T.Box3().setFromObject(node).getSize(new T.Vector3());
    let count=0,meshes=0;loaded.traverse(m=>{if(m.isMesh){meshes++;count+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;}});
    if(size(root).distanceTo(size(loaded))>.0001||count!==triangles||meshes!==root.children.length)throw new Error('GLB reload changed model');
    return Array.from(new Uint8Array(buffer));
  });
  const glb=Buffer.from(bytes);assert.equal(glb.toString('ascii',0,4),'glTF');assert.equal(glb.readUInt32LE(8),glb.length);
  await writeFile('artifacts/models/garden-tool-rack/garden-tool-rack.glb',glb);assert.deepEqual(errors,[]);
  await writeFile('artifacts/models/garden-tool-rack/metrics.json',JSON.stringify({...metrics,glbBytes:glb.length},null,2));
  console.log('PASS rack silhouette bounds, three hooks, empty quest space, gloves, twine, open pots, shared resources and GLB roundtrip',JSON.stringify({...metrics,glbBytes:glb.length}));
}finally{await browser.close();}
