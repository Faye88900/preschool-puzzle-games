import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless:true }), output='artifacts/models/tree-bench', errors=[];
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('**/__tree-bench',route=>route.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5218/')+'__tree-bench');
  const metrics=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),{createTreeBench,treeBenchColliders}=await import('/src/tree-bench.ts');
    const root=createTreeBench(),copy=createTreeBench(),scene=new T.Scene();scene.add(root);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1280,900);renderer.setPixelRatio(1);
    renderer.setClearColor('#f7f2e7');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#eef4ff','#aa9678',1.8));
    const sun=new T.DirectionalLight('#fff0d4',2.6);sun.position.set(-4,9,6);sun.castShadow=true;sun.shadow.mapSize.setScalar(2048);
    Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:30});sun.shadow.normalBias=.008;scene.add(sun);
    const floor=new T.Mesh(new T.PlaneGeometry(60,60),new T.MeshStandardMaterial({color:'#f7f2e7',roughness:1}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-.005;floor.receiveShadow=true;scene.add(floor);
    const camera=new T.OrthographicCamera(-5.0,5.0,3.516,-3.516,.1,40);camera.position.set(7,6.5,9);camera.lookAt(0,.3,0);renderer.render(scene,camera);
    let finite=true,triangles=0;root.traverse(m=>{if(m.isMesh){triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;finite&&=[...m.geometry.attributes.position.array,...m.geometry.attributes.normal.array,...m.geometry.attributes.uv.array].every(Number.isFinite);}});
    const bounds=new T.Box3().setFromObject(root),ray=new T.Raycaster();
    const down=(x,z)=>{ray.set(new T.Vector3(x,3,z),new T.Vector3(0,-1,0));return ray.intersectObject(root,true)[0]?.point.y??null;};
    const seats=[0,Math.PI].flatMap(turn=>[-.8,-.4,0,.4,.8].map(a=>down(Math.cos(a+turn)*2.69,Math.sin(a+turn)*2.69)));
    const openings=[down(0,2.69),down(0,-2.69),down(0,0)];
    window.benchTest={T,root,scene,renderer,camera,triangles};
    return {triangles,finite,meshes:root.children.length,min:bounds.min.toArray(),max:bounds.max.toArray(),size:bounds.getSize(new T.Vector3()).toArray(),seats,openings,
      colliders:treeBenchColliders.length,shared:root!==copy&&root.children.every((m,i)=>m.geometry===copy.children[i].geometry&&m.material===copy.children[i].material),render:{...renderer.info.render},textures:renderer.info.memory.textures};
  });
  await page.screenshot({path:`${output}/three-quarter.png`});
  assert.ok(metrics.finite&&metrics.shared&&metrics.meshes===6&&metrics.triangles<20000,JSON.stringify(metrics));
  assert.ok(metrics.min[1]>-.001&&metrics.min[1]<.001&&metrics.size[0]>6.4&&metrics.size[0]<6.7&&metrics.size[1]>.8&&metrics.size[1]<.9);
  assert.ok(metrics.seats.every(y=>y>.78&&y<.85),'Both curved sections must have a continuous usable seat surface');
  assert.deepEqual(metrics.openings,[null,null,null],'Front/back openings and the tree opening must be actual empty space');
  for(const[name,position]of [['top',[0,11,.001]],['front',[0,2,11]],['side',[11,2,0]]]){
    await page.evaluate(position=>{const s=window.benchTest;s.camera.position.fromArray(position);s.camera.lookAt(0,.3,0);s.renderer.render(s.scene,s.camera);},position);
    await page.screenshot({path:`${output}/${name}.png`});
  }
  const bytes=await page.evaluate(async()=>{
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {T,root,triangles}=window.benchTest,buffer=await new GLTFExporter().parseAsync(root,{binary:true}),loaded=(await new GLTFLoader().parseAsync(buffer,'')).scene;
    let count=0;loaded.traverse(m=>{if(m.isMesh)count+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});
    const size=node=>new T.Box3().setFromObject(node).getSize(new T.Vector3());
    if(count!==triangles||size(root).distanceTo(size(loaded))>.0001)throw Error('GLB reload changed bench geometry');
    return Array.from(new Uint8Array(buffer));
  });
  await writeFile(`${output}/tree-bench.glb`,Buffer.from(bytes));
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/metrics.json`,JSON.stringify({...metrics,glbBytes:bytes.length,errors},null,2));
  console.log('PASS curved bench, shared geometry/materials, real gaps, ground contact, seat rays, four rendered views and self-contained GLB roundtrip',JSON.stringify({...metrics,glbBytes:bytes.length}));
}finally{await browser.close();}
