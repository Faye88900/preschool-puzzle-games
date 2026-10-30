import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless:true }), output='artifacts/models/flowerbed-edging', errors=[];
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('**/__flowerbed-edging',route=>route.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5218/')+'__flowerbed-edging');
  const metrics=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),{createFlowerbedBorder,createFlowerbedEdging,flowerbedBorderColliders}=await import('/src/flowerbed-edging.ts');
    const root=createFlowerbedBorder(),copy=createFlowerbedBorder(),scene=new T.Scene();scene.add(root);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1280,900);renderer.setPixelRatio(1);
    renderer.setClearColor('#f7f2e7');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#eef4ff','#aa9678',1.8));
    const sun=new T.DirectionalLight('#fff0d4',2.6);sun.position.set(-4,9,6);sun.castShadow=true;sun.shadow.mapSize.setScalar(2048);
    Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:30});sun.shadow.normalBias=.008;scene.add(sun);
    const floor=new T.Mesh(new T.PlaneGeometry(60,60),new T.MeshStandardMaterial({color:'#f7f2e7',roughness:1}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-.005;floor.receiveShadow=true;scene.add(floor);
    const camera=new T.OrthographicCamera(-5.4,5.4,3.797,-3.797,.1,40);camera.position.set(7,9,11);camera.lookAt(0,.2,.5);renderer.render(scene,camera);
    let finite=true,triangles=0;root.traverse(m=>{if(m.isMesh){triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;finite&&=[...m.geometry.attributes.position.array,...m.geometry.attributes.normal.array,...m.geometry.attributes.uv.array].every(Number.isFinite);}});
    const bounds=new T.Box3().setFromObject(root),ray=new T.Raycaster();
    const down=(x,z)=>{ray.set(new T.Vector3(x,4,z),new T.Vector3(0,-1,0));return ray.intersectObject(root,true)[0]?.point.y??null;};
    const rim=[down(-.9,-1.2),down(0,-1.2),down(.9,-1.2),down(2.1,0),down(-2.1,0),down(2.1,.3),down(-2.1,.3),down(0,1.2),down(-.9,1.2),down(.9,1.2)];
    const openings=[down(0,0),down(0,.6)];
    const shared=root!==copy&&root.children.every((m,i)=>m.geometry===copy.children[i].geometry&&m.material===copy.children[i].material);
    const modules=['straight','curve','end'].map(kind=>createFlowerbedEdging(kind));
    const moduleBounds=modules.map(m=>{m.updateMatrixWorld(true);const b=new T.Box3().setFromObject(m);return {name:m.name,min:b.min.toArray(),max:b.max.toArray()};});
    root.position.z=-1.4;
    for(const [i,m]of modules.entries()){m.position.set(-3+i*2.85,0,2.1);scene.add(m);}
    renderer.render(scene,camera);
    window.edgingTest={T,root,modules,scene,renderer,camera,triangles};
    return {triangles,finite,meshes:root.children.length,min:bounds.min.toArray(),max:bounds.max.toArray(),size:bounds.getSize(new T.Vector3()).toArray(),rim,openings,shared,moduleBounds,
      colliders:flowerbedBorderColliders.length,render:{...renderer.info.render},textures:renderer.info.memory.textures};
  });
  await page.screenshot({path:`${output}/three-quarter.png`});
  assert.ok(metrics.finite&&metrics.shared&&metrics.meshes===2&&metrics.triangles<20000,JSON.stringify(metrics));
  assert.ok(Math.abs(metrics.min[1])<.001&&Math.abs(metrics.size[1]-.48)<.001&&metrics.size[0]>4.5&&metrics.size[0]<4.7);
  assert.ok(metrics.rim.every(y=>y>.43&&y<.49),'Module joins and curved border must have continuous stone at seat height');
  assert.deepEqual(metrics.openings,[null,null],'Only the planting interior must be empty; the perimeter is closed');
  assert.ok(metrics.moduleBounds.every(m=>Math.abs(m.min[1])<.001&&Math.abs(m.max[1]-.48)<.001),'All modules must share floor/height');
  assert.ok(Math.abs(metrics.moduleBounds[0].max[0]-1.8)<.02&&Math.abs(metrics.moduleBounds[1].max[0]-1.38)<.02,'Straight and quarter-circle modules must match the chosen grid');
  for(const[name,position]of [['top',[0,11,.001]],['front',[0,3,11]],['side',[11,3,0]]]){
    await page.evaluate(position=>{const s=window.edgingTest;s.camera.position.fromArray(position);s.camera.lookAt(0,.2,.5);s.renderer.render(s.scene,s.camera);},position);
    await page.screenshot({path:`${output}/${name}.png`});
  }
  const exports=await page.evaluate(async()=>{
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {T,root,modules}=window.edgingTest,results=[];
    for(const source of [root,...modules]){
      const node=source.clone(true);node.position.set(0,0,0);node.updateMatrixWorld(true);
      const buffer=await new GLTFExporter().parseAsync(node,{binary:true}),loaded=(await new GLTFLoader().parseAsync(buffer,'')).scene;
      const size=n=>new T.Box3().setFromObject(n).getSize(new T.Vector3());
      const count=n=>{let v=0;n.traverse(m=>{if(m.isMesh)v+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});return v;};
      if(count(node)!==count(loaded)||size(node).distanceTo(size(loaded))>.0001)throw Error('GLB reload changed edging geometry');
      results.push({name:node.name,bytes:Array.from(new Uint8Array(buffer))});
    }
    return results;
  });
  for(const item of exports)await writeFile(`${output}/${item.name}.glb`,Buffer.from(item.bytes));
  assert.deepEqual(errors,[]);
  const glbs=exports.map(({name,bytes})=>({name,bytes:bytes.length}));
  await writeFile(`${output}/metrics.json`,JSON.stringify({...metrics,glbs,errors},null,2));
  console.log('PASS edging modules, shared resources, matching height, fully closed perimeter, hollow planting interior, four views and four GLB roundtrips',JSON.stringify({...metrics,glbs}));
}finally{await browser.close();}
