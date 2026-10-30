import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),errors=[],output='artifacts/models/mossy-stump';
const base=process.env.TEST_URL||'http://127.0.0.1:5173/';
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1200,height:900},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('**/__mossy-stump',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto(base+'__mossy-stump');
  const metrics=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),{createMossyStump}=await import('/src/mossy-stump.ts');
    const root=createMossyStump(),copy=createMossyStump(),scene=new T.Scene();scene.add(root);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,900);renderer.setPixelRatio(1);
    renderer.setClearColor('#faf6eb');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#f5f8ff','#a2a590',2));
    const sun=new T.DirectionalLight('#fff0d5',2.8);sun.position.set(-3,6,5);sun.castShadow=true;sun.shadow.mapSize.setScalar(2048);
    Object.assign(sun.shadow.camera,{left:-3,right:3,top:4,bottom:-2,near:.1,far:20});sun.shadow.normalBias=.005;scene.add(sun);
    const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:'#faf6eb',roughness:1}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-.005;floor.receiveShadow=true;scene.add(floor);
    const camera=new T.OrthographicCamera(-2,2,1.5,-1.5,.1,25);camera.position.set(3,2.8,5);camera.lookAt(0,.85,0);renderer.render(scene,camera);
    let triangles=0,finite=true;root.traverse(m=>{if(!m.isMesh)return;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
      finite&&=Array.from(m.geometry.attributes.position.array).every(Number.isFinite)&&Array.from(m.geometry.attributes.normal.array).every(Number.isFinite);});
    const ray=new T.Raycaster();ray.set(new T.Vector3(0,2,0),new T.Vector3(0,-1,0));
    const top=ray.intersectObject(root.getObjectByName('stump-cut'),false)[0]?.point.y;
    const box=new T.Box3().setFromObject(root);window.stumpTest={T,root,renderer,scene,camera,triangles};
    return {triangles,finite,meshes:root.children.length,min:box.min.toArray(),size:box.getSize(new T.Vector3()).toArray(),top,
      capTriangles:root.getObjectByName('stump-mushroom-caps').geometry.index.count/3,
      render:{...renderer.info.render},textures:renderer.info.memory.textures,
      shared:root!==copy&&root.children.every((m,i)=>m.geometry===copy.children[i].geometry&&m.material===copy.children[i].material)};
  });
  await page.screenshot({path:`${output}/three-quarter.png`});
  assert.ok(metrics.finite&&metrics.triangles<38000&&metrics.meshes<=9&&metrics.shared,JSON.stringify(metrics));
  assert.ok(metrics.min[1]>-.01&&metrics.min[1]<.04&&metrics.size[0]<3.3&&metrics.size[2]<3.3&&metrics.size[1]>1.9&&metrics.size[1]<2.2);
  assert.ok(Math.abs(metrics.top-1.2805)<.001,'Cut face must remain flat and clear of moss at its center');
  assert.equal(metrics.capTriangles,3*32*20*2,'Exactly three complete orange caps');
  for(const[name,position]of [['front',[0,1.65,6]],['side',[6,1.65,0]],['back',[0,1.65,-6]]]){
    await page.evaluate(position=>{const s=window.stumpTest;s.camera.position.fromArray(position);s.camera.lookAt(0,.85,0);s.renderer.render(s.scene,s.camera);},position);
    await page.screenshot({path:`${output}/${name}.png`});
  }
  const bytes=await page.evaluate(async()=>{
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
    const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {T,root,triangles}=window.stumpTest,buffer=await new GLTFExporter().parseAsync(root,{binary:true});
    const loaded=(await new GLTFLoader().parseAsync(buffer,'')).scene,size=node=>new T.Box3().setFromObject(node).getSize(new T.Vector3());
    let count=0;loaded.traverse(m=>{if(m.isMesh)count+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});
    if(size(root).distanceTo(size(loaded))>.0001||count!==triangles)throw new Error('GLB reload changed model');
    return Array.from(new Uint8Array(buffer));
  });
  await writeFile(`${output}/mossy-stump.glb`,Buffer.from(bytes));
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:'export function startJourney(){return {arrive:async()=>{},dispose(){}}}'}));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+'\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await init.call(this)};MazeAdventure.prototype.tick=function(){};'});});
  await page.setViewportSize({width:1440,height:900});await page.goto(base+'?level=3&lang=zh');
  await page.waitForFunction(()=>window.game?.body&&window.game?.root);await page.locator('.game-loading').waitFor({state:'detached',timeout:60000});await page.locator('#primary').click();
  const yard=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),g=game,stump=g.scene.getObjectByName('garden-mossy-stump'),bounds=new T.Box3().setFromObject(stump);
    const overlaps=['garden-stone-well','garden-bench-01','garden-vine-trellis'].filter(name=>bounds.intersectsBox(new T.Box3().setFromObject(g.scene.getObjectByName(name))))
      .concat(g.walls.some(w=>bounds.intersectsBox(w.bounds))?['hedge']:[]);
    g.body.setTranslation({x:-41,y:.8,z:7},true);g.previous.copy(g.body.translation());g.render(0);
    g.camera.position.set(-35,8,15);g.camera.lookAt(-43,.6,2.7);g.camera.updateMatrixWorld();
    stump.visible=false;g.renderer.render(g.scene,g.camera);const before={...g.renderer.info.render};stump.visible=true;g.renderer.render(g.scene,g.camera);
    return {position:stump.position.toArray(),min:bounds.min.toArray(),max:bounds.max.toArray(),overlaps,
      hedgeBounds:g.walls.filter(w=>bounds.intersectsBox(w.bounds)).map(w=>({min:w.bounds.min.toArray(),max:w.bounds.max.toArray()})),before,after:{...g.renderer.info.render}};
  });
  await page.screenshot({path:`${output}/well-yard.png`});assert.deepEqual(yard.overlaps,[],JSON.stringify(yard));
  assert.ok(yard.after.calls-yard.before.calls<=9);
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{const g=game;g.resize();g.camera.position.set(-37,9,16);g.camera.lookAt(-43,.6,2.8);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);});
  await page.screenshot({path:`${output}/well-yard-mobile.png`});
  await page.evaluate(()=>{const g=game;g.body.setTranslation({x:-46.6,y:.8,z:5.5},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());});
  await page.keyboard.down('ArrowUp');
  const stoppedAtStump=await page.evaluate(()=>{for(let i=0;i<80;i++)game.step();return game.body.translation();});
  await page.keyboard.up('ArrowUp');
  assert.ok(stoppedAtStump.z>3.55&&stoppedAtStump.z<3.75,'Stump cylinder must stop the player outside the wood');
  assert.deepEqual(errors,[]);await writeFile(`${output}/metrics.json`,JSON.stringify({...metrics,glbBytes:bytes.length,yard,stoppedAtStump},null,2));
  console.log('PASS mossy stump geometry, three mushrooms, shared resources, GLB roundtrip, yard clearance and desktop/mobile renders',JSON.stringify({...metrics,glbBytes:bytes.length,yard}));
} finally {await browser.close();}
