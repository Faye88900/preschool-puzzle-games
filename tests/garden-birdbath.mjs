import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),errors=[],output='artifacts/models/garden-birdbath';
const base=process.env.TEST_URL||'http://127.0.0.1:5208/';
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1200,height:900},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('**/__garden-birdbath',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto(base+'__garden-birdbath');
  const metrics=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),{createGardenBirdbath}=await import('/src/garden-birdbath.ts');
    const root=createGardenBirdbath(),copy=createGardenBirdbath(),scene=new T.Scene();scene.add(root);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,900);renderer.setPixelRatio(1);
    renderer.setClearColor('#faf6eb');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#f5f8ff','#a2a590',2));
    const sun=new T.DirectionalLight('#fff0d5',2.8);sun.position.set(-3,6,5);sun.castShadow=true;sun.shadow.mapSize.setScalar(2048);
    Object.assign(sun.shadow.camera,{left:-2,right:2,top:3,bottom:-2,near:.1,far:20});sun.shadow.normalBias=.004;scene.add(sun);
    const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:'#faf6eb',roughness:1}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-.005;floor.receiveShadow=true;scene.add(floor);
    const camera=new T.OrthographicCamera(-1.4,1.4,1.05,-1.05,.1,25);camera.position.set(2.8,2.6,4.8);camera.lookAt(0,.79,0);renderer.render(scene,camera);
    let triangles=0,finite=true;root.traverse(m=>{if(!m.isMesh)return;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
      finite&&=Array.from(m.geometry.attributes.position.array).every(Number.isFinite)&&Array.from(m.geometry.attributes.normal.array).every(Number.isFinite);});
    const ray=new T.Raycaster(),stone=root.getObjectByName('birdbath-stone'),rim=root.getObjectByName('birdbath-rim'),water=root.getObjectByName('birdbath-water');
    root.updateMatrixWorld(true);
    const down=(x,z,objects)=>{ray.set(new T.Vector3(x,2,z),new T.Vector3(0,-1,0));return ray.intersectObjects(objects,false)[0]?.point.y??null;};
    const bowl=[0,.25,.50].map(r=>down(r,0,[stone,rim])),waterDepths=[],lip=[];
    for(let i=0;i<12;i++){const a=i*Math.PI/6;waterDepths.push(down(Math.sin(a)*.6,Math.cos(a)*.6,[stone,rim,water]));lip.push(down(Math.sin(a)*.79,Math.cos(a)*.79,[stone,rim]));}
    const box=new T.Box3().setFromObject(root);window.bathTest={T,root,renderer,scene,camera,triangles};
    return {triangles,finite,meshes:root.children.length,min:box.min.toArray(),size:box.getSize(new T.Vector3()).toArray(),bowl,waterDepths,lip,
      render:{...renderer.info.render},textures:renderer.info.memory.textures,
      shared:root!==copy&&root.children.every((m,i)=>m.geometry===copy.children[i].geometry&&m.material===copy.children[i].material)};
  });
  await page.screenshot({path:`${output}/three-quarter.png`});
  assert.ok(metrics.finite&&metrics.triangles<28000&&metrics.meshes===7&&metrics.shared,JSON.stringify(metrics));
  assert.ok(metrics.min[1]>-.005&&metrics.min[1]<.005&&metrics.size[0]>1.75&&metrics.size[0]<1.85&&metrics.size[1]>1.45&&metrics.size[1]<1.49);
  assert.ok(metrics.bowl.every(y=>y>1.07&&y<1.16)&&metrics.bowl[2]>metrics.bowl[0]+.035,'Bowl must have a solid recessed curved floor');
  assert.ok(metrics.waterDepths.every(y=>Math.abs(y-1.325)<.001)&&metrics.lip.every(y=>y>1.44),'All water must sit below the stone lip');
  for(const[name,position]of [['front',[0,1.4,5]],['side',[5,1.4,0]],['back',[0,1.4,-5]],['top',[0,5,.001]]]){
    await page.evaluate(position=>{const s=window.bathTest;s.camera.position.fromArray(position);s.camera.lookAt(0,.79,0);s.renderer.render(s.scene,s.camera);},position);
    await page.screenshot({path:`${output}/${name}.png`});
  }
  const bytes=await page.evaluate(async()=>{
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {T,root,triangles}=window.bathTest,buffer=await new GLTFExporter().parseAsync(root,{binary:true}),loaded=(await new GLTFLoader().parseAsync(buffer,'')).scene;
    const size=node=>new T.Box3().setFromObject(node).getSize(new T.Vector3());let count=0;loaded.traverse(m=>{if(m.isMesh)count+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});
    if(size(root).distanceTo(size(loaded))>.0001||count!==triangles)throw new Error('GLB reload changed model');return Array.from(new Uint8Array(buffer));
  });
  await writeFile(`${output}/garden-birdbath.glb`,Buffer.from(bytes));
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:'export function startJourney(){return {arrive:async()=>{},dispose(){}}}'}));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+'\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await init.call(this)};MazeAdventure.prototype.tick=function(){};'});});
  await page.setViewportSize({width:1440,height:900});await page.goto(base+'?level=3&lang=zh');
  await page.waitForFunction(()=>window.game?.body&&window.game?.root);await page.locator('.game-loading').waitFor({state:'detached',timeout:60000});await page.locator('#primary').click();
  const yard=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),g=game,bath=g.scene.getObjectByName('garden-birdbath'),bounds=new T.Box3().setFromObject(bath);
    const props=g.scene.children.filter(o=>['garden-stone-well','garden-bench-01','garden-vine-trellis','garden-barrel-01','garden-well-bush','garden-bloom'].includes(o.name));
    const overlaps=props.filter(p=>bounds.intersectsBox(new T.Box3().setFromObject(p))).map(p=>p.name).concat(g.walls.some(w=>bounds.intersectsBox(w.bounds))?['hedge']:[]);
    g.body.setTranslation({x:-39,y:.8,z:7},true);g.previous.copy(g.body.translation());g.render(0);
    g.camera.position.set(-30,8,15);g.camera.lookAt(-38.5,.7,2.4);g.camera.updateMatrixWorld();
    bath.visible=false;g.renderer.render(g.scene,g.camera);const before={...g.renderer.info.render};bath.visible=true;g.renderer.render(g.scene,g.camera);
    return {position:bath.position.toArray(),min:bounds.min.toArray(),max:bounds.max.toArray(),overlaps,before,after:{...g.renderer.info.render}};
  });
  await page.screenshot({path:`${output}/well-yard.png`});assert.deepEqual(yard.overlaps,[],JSON.stringify(yard));assert.ok(yard.after.calls-yard.before.calls<=7);
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{const g=game;g.resize();g.camera.position.set(-29.5,5.5,8.5);g.camera.lookAt(-33.7,.8,-.9);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);});
  await page.screenshot({path:`${output}/well-yard-mobile.png`});
  await page.evaluate(()=>{const g=game;g.body.setTranslation({x:-33.7,y:.8,z:2.7},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());});
  await page.keyboard.down('ArrowUp');const stoppedAtBath=await page.evaluate(()=>{for(let i=0;i<80;i++)game.step();return game.body.translation();});await page.keyboard.up('ArrowUp');
  assert.ok(stoppedAtBath.z>.40&&stoppedAtBath.z<.55,JSON.stringify(stoppedAtBath));
  assert.deepEqual(errors,[]);await writeFile(`${output}/metrics.json`,JSON.stringify({...metrics,glbBytes:bytes.length,yard,stoppedAtBath},null,2));
  console.log('PASS birdbath concave basin, recessed water, shared resources, GLB roundtrip, yard clearance, collision and desktop/mobile renders',JSON.stringify({...metrics,glbBytes:bytes.length,yard,stoppedAtBath}));
} finally {await browser.close();}
