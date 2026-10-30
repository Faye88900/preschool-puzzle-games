import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),errors=[],output='artifacts/models/garden-songbird';
const base=process.env.TEST_URL||'http://127.0.0.1:5208/';
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1200,height:900},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('**/__garden-songbird',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto(base+'__garden-songbird');
  const metrics=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),{createGardenSongbird}=await import('/src/garden-songbird.ts');
    const root=createGardenSongbird(),copy=createGardenSongbird(),scene=new T.Scene();scene.add(root);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,900);renderer.setPixelRatio(1);
    renderer.setClearColor('#faf6eb');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#f5f8ff','#a2a590',2));
    const sun=new T.DirectionalLight('#fff0d5',2.8);sun.position.set(-3,6,5);sun.castShadow=true;sun.shadow.mapSize.setScalar(2048);
    Object.assign(sun.shadow.camera,{left:-1,right:1,top:2,bottom:-1,near:.1,far:20});sun.shadow.normalBias=.002;scene.add(sun);
    const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:'#faf6eb',roughness:1}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-.003;floor.receiveShadow=true;scene.add(floor);
    const camera=new T.OrthographicCamera(-.95,.95,.7125,-.7125,.1,25);camera.position.set(3.4,1.5,4.1);camera.lookAt(0,.53,-.035);renderer.render(scene,camera);
    let triangles=0,finite=true;root.traverse(m=>{if(!m.isMesh)return;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
      finite&&=Array.from(m.geometry.attributes.position.array).every(Number.isFinite)&&Array.from(m.geometry.attributes.normal.array).every(Number.isFinite);});
    root.updateMatrixWorld(true);const ray=new T.Raycaster(),front=(x,y)=>{ray.set(new T.Vector3(x,y,1),new T.Vector3(0,0,-1));const hit=ray.intersectObject(root,true)[0];return hit?{name:hit.object.name,z:hit.point.z}:null;};
    const box=new T.Box3().setFromObject(root);window.birdTest={T,root,renderer,scene,camera,triangles};
    return {triangles,finite,meshes:root.children.length,min:box.min.toArray(),size:box.getSize(new T.Vector3()).toArray(),
      cheeks:[front(-.22,.77),front(.22,.77)],eyes:[front(-.134,.823),front(.134,.823)],forehead:front(0,.94),
      render:{...renderer.info.render},shared:root!==copy&&root.children.every((m,i)=>m.geometry===copy.children[i].geometry&&m.material===copy.children[i].material)};
  });
  await page.screenshot({path:`${output}/three-quarter.png`});
  assert.ok(metrics.finite&&metrics.triangles<30000&&metrics.meshes===8&&metrics.shared,JSON.stringify(metrics));
  assert.ok(Math.abs(metrics.min[1])<.00001&&metrics.size[0]>.75&&metrics.size[0]<.85&&metrics.size[1]>1.03&&metrics.size[1]<1.06);
  assert.ok(metrics.cheeks.every(h=>h?.name==='songbird-cream')&&metrics.eyes.every(h=>h?.name==='songbird-eyes')&&metrics.forehead?.name==='songbird-blue',JSON.stringify(metrics));
  for(const[name,position]of [['front',[0,.72,4]],['side',[4,.72,0]],['back',[0,.72,-4]]]){
    await page.evaluate(position=>{const s=window.birdTest;s.camera.position.fromArray(position);s.camera.lookAt(0,.53,-.035);s.renderer.render(s.scene,s.camera);},position);
    await page.screenshot({path:`${output}/${name}.png`});
  }
  const bytes=await page.evaluate(async()=>{
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {T,root,triangles}=window.birdTest,buffer=await new GLTFExporter().parseAsync(root,{binary:true}),loaded=(await new GLTFLoader().parseAsync(buffer,'')).scene;
    const size=node=>new T.Box3().setFromObject(node).getSize(new T.Vector3());let count=0;loaded.traverse(m=>{if(m.isMesh)count+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});
    if(size(root).distanceTo(size(loaded))>.0001||count!==triangles)throw new Error('GLB reload changed model');return Array.from(new Uint8Array(buffer));
  });
  await writeFile(`${output}/garden-songbird.glb`,Buffer.from(bytes));
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:'export function startJourney(){return {arrive:async()=>{},dispose(){}}}'}));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+'\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await init.call(this)};MazeAdventure.prototype.tick=function(){};'});});
  await page.setViewportSize({width:1440,height:900});await page.goto(base+'?level=3&lang=zh');
  await page.waitForFunction(()=>window.game?.body&&window.game?.root);await page.locator('.game-loading').waitFor({state:'detached',timeout:60000});await page.locator('#primary').click();
  const yard=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),g=game,bird=g.scene.getObjectByName('garden-songbird'),bath=g.scene.getObjectByName('garden-birdbath'),bounds=new T.Box3().setFromObject(bird);
    const footGaps=[-1,1].map(side=>{const p=bird.localToWorld(new T.Vector3(side*.105,0,.03)),ray=new T.Raycaster(p.clone().add(new T.Vector3(0,.1,0)),new T.Vector3(0,-1,0));const hit=ray.intersectObject(bath.getObjectByName('birdbath-rim'),false)[0];return hit?p.y-hit.point.y:null;});
    const facing=bird.getWorldDirection(new T.Vector3()).dot(bath.position.clone().sub(bird.position).setY(0).normalize());
    const overlaps=g.walls.some(w=>bounds.intersectsBox(w.bounds));
    g.body.setTranslation({x:-39,y:.8,z:7},true);g.previous.copy(g.body.translation());g.render(0);
    g.camera.position.set(-30,8,15);g.camera.lookAt(-38.5,.7,2.4);g.camera.updateMatrixWorld();
    bird.visible=false;g.renderer.render(g.scene,g.camera);const before={...g.renderer.info.render};bird.visible=true;g.renderer.render(g.scene,g.camera);
    return {position:bird.position.toArray(),min:bounds.min.toArray(),max:bounds.max.toArray(),footGaps,facing,overlaps,before,after:{...g.renderer.info.render},bodies:g.world.bodies.len()};
  });
  await page.screenshot({path:`${output}/well-yard.png`});
  assert.ok(!yard.overlaps&&yard.facing>.999&&yard.footGaps.every(g=>g!==null&&Math.abs(g)<.015),JSON.stringify(yard));assert.ok(yard.after.calls-yard.before.calls<=8);
  await page.evaluate(()=>{const g=game;g.camera.position.set(-30.7,3.1,3.2);g.camera.lookAt(-33.5,1.5,-.9);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);});
  await page.screenshot({path:`${output}/birdbath-perch.png`});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{const g=game;g.resize();g.camera.position.set(-29.5,5.5,8.5);g.camera.lookAt(-33.7,1,-.9);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);});
  await page.screenshot({path:`${output}/well-yard-mobile.png`});
  assert.deepEqual(errors,[]);await writeFile(`${output}/metrics.json`,JSON.stringify({...metrics,glbBytes:bytes.length,yard},null,2));
  console.log('PASS songbird finite model, face mask/eyes, shared resources, GLB roundtrip, rim contact, inward facing and desktop/mobile renders',JSON.stringify({...metrics,glbBytes:bytes.length,yard}));
} finally {await browser.close();}
