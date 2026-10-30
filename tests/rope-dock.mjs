import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='artifacts/models/rope-dock',errors=[];
try {
  await mkdir(output,{recursive:true});const page=await browser.newPage({viewport:{width:1100,height:900}});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/__dock-model',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5212/')+'__dock-model');
  const result=await page.evaluate(async()=>{
    const T=await import('/node_modules/.vite/deps/three.js'),{createRopeDock}=await import('/src/rope-dock.ts');
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const dock=createRopeDock(4.4,3.3),scene=new T.Scene();scene.background=new T.Color('#edf1e7');scene.add(dock.root,new T.HemisphereLight('#f0faff','#b2a786',2.1));
    const light=new T.DirectionalLight('#fff0d3',2.4);light.position.set(-3,6,5);scene.add(light);
    const camera=new T.OrthographicCamera(-3.7,3.7,3.03,-3.03,.1,40);camera.position.set(6,4.7,7);camera.lookAt(0,0,0);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1100,900);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);renderer.render(scene,camera);
    let meshes=0,triangles=0,finite=true;dock.root.traverse(m=>{if(!m.isMesh)return;meshes++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;for(const a of Object.values(m.geometry.attributes))finite&&=Array.from(a.array).every(Number.isFinite);});
    const ray=new T.Raycaster(),ropes=dock.root.getObjectByName('dock-ropes');
    const ropeTop=x=>{ray.set(new T.Vector3(x,4,1.65),new T.Vector3(0,-1,0));return ray.intersectObject(ropes,true)[0]?.point.y;};
    const floor=[];for(const x of [-1.5,0,1.5]) {ray.set(new T.Vector3(x,4,0),new T.Vector3(0,-1,0));floor.push(ray.intersectObject(dock.root.getObjectByName('dock-deck'),true)[0]?.point.y);}
    const posts=dock.root.getObjectByName('dock-posts'),postBounds=new T.Box3().setFromObject(posts),supportBounds=new T.Box3().setFromObject(dock.root.getObjectByName('dock-supports'));
    ray.set(new T.Vector3(-1,.8,0),new T.Vector3(1,0,0));
    const openingHits=ray.intersectObject(dock.root,true).length;
    const bounds=new T.Box3().setFromObject(dock.root).getSize(new T.Vector3()).toArray();
    const glb=await new GLTFExporter().parseAsync(dock.root,{binary:true}),loaded=await new GLTFLoader().parseAsync(glb,'');
    window.dockView={T,dock,scene,camera,renderer};
    return{glb:Array.from(new Uint8Array(glb)),metrics:{meshes,triangles,finite,bounds,roundtrip:new T.Box3().setFromObject(loaded.scene).getSize(new T.Vector3()).toArray(),floor,
      ropeEdge:ropeTop(-1.95),ropeMiddle:ropeTop(-1.1),postTop:postBounds.max.y,pileBottom:postBounds.min.y,supportBottom:supportBounds.min.y,openingHits,colliders:dock.colliders}};
  });
  const m=result.metrics;assert.ok(m.finite&&m.meshes<=22&&m.triangles<45000,JSON.stringify(m));
  assert.ok(m.floor.every(y=>Math.abs(y-.095)<.001),JSON.stringify(m.floor));
  assert.ok(m.ropeMiddle<m.ropeEdge-.07&&m.postTop<1.4&&m.pileBottom<-1.4&&m.supportBottom<-1,JSON.stringify(m));
  assert.equal(m.openingHits,0,'Boarding entrance stays open with the side mooring line attached');
  assert.equal(m.colliders.length,3);assert.ok(m.bounds.every((n,i)=>Math.abs(n-m.roundtrip[i])<.001));
  await writeFile(`${output}/rope-dock.glb`,Buffer.from(result.glb));
  await page.screenshot({path:`${output}/three-quarter.png`});
  for(const [name,x,y,z] of [['side',0,1.9,8],['boarding',8,2.3,0]]) {
    await page.evaluate(({x,y,z})=>{const s=dockView;s.camera.position.set(x,y,z);s.camera.lookAt(0,0,0);s.renderer.render(s.scene,s.camera);},{x,y,z});
    await page.screenshot({path:`${output}/${name}.png`});
  }
  await page.evaluate(()=>{const s=dockView;s.dock.mooring.visible=false;s.renderer.render(s.scene,s.camera);});
  await page.screenshot({path:`${output}/mooring-released.png`});
  assert.deepEqual(errors,[]);await writeFile(`${output}/model-metrics.json`,JSON.stringify(m,null,2));
  console.log('PASS rope dock geometry, sag, floor continuity, piles/braces, clear boarding opening and GLB reload',JSON.stringify(m));
}finally{await browser.close();}
