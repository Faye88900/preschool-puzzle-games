import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='artifacts/models/ancient-wind-sword',errors=[];
const base=process.env.TEST_URL||'http://127.0.0.1:4399/';
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1200,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('**/__ancient-wind-sword',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto(base+'__ancient-wind-sword');
  const model=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),{createAncientWindSword}=await import('/src/ancient-wind-sword.ts');
    const root=createAncientWindSword(),copy=createAncientWindSword(),scene=new T.Scene();scene.add(root);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,900);renderer.setPixelRatio(1);
    renderer.setClearColor('#f7f3eb');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#f4f8ff','#a6a08c',2));
    const sun=new T.DirectionalLight('#fff1d9',3);sun.position.set(-10,20,18);sun.castShadow=true;
    Object.assign(sun.shadow.camera,{left:-12,right:12,top:20,bottom:-4,near:1,far:80});sun.shadow.mapSize.setScalar(2048);sun.shadow.normalBias=.015;scene.add(sun);
    const fill=new T.DirectionalLight('#dbe9ff',.9);fill.position.set(12,10,-15);scene.add(fill);
    const floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:'#f7f3eb',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.02;floor.receiveShadow=true;scene.add(floor);
    const camera=new T.OrthographicCamera(-10,10,7.5,-7.5,.1,100);camera.position.set(15,11,27);camera.lookAt(0,7,0);renderer.render(scene,camera);
    const meshes=[],copyMeshes=[],materials=new Set(),textures=new Set();let triangles=0,finite=true;
    root.traverse(m=>{if(!m.isMesh)return;meshes.push(m);triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
      finite&&=Array.from(m.geometry.attributes.position.array).every(Number.isFinite)&&Array.from(m.geometry.attributes.normal.array).every(Number.isFinite);
      for(const mat of Array.isArray(m.material)?m.material:[m.material]){materials.add(mat);for(const v of Object.values(mat))if(v?.isTexture)textures.add(v);}
    });copy.traverse(m=>{if(m.isMesh)copyMeshes.push(m);});
    root.updateMatrixWorld(true);const ray=new T.Raycaster(),thickness=[];
    for(const y of [3,6]){
      ray.set(new T.Vector3(0,y,10),new T.Vector3(0,0,-1));const front=ray.intersectObject(root,true)[0]?.point.z;
      ray.set(new T.Vector3(0,y,-10),new T.Vector3(0,0,1));const back=ray.intersectObject(root,true)[0]?.point.z;
      thickness.push(front===undefined||back===undefined?null:front-back);
    }
    const bounds=new T.Box3().setFromObject(root);
    const gl=renderer.getContext(),pixels=new Uint8Array(9*4);let i=0;
    for(const y of [300,450,600])for(const x of [450,600,750]){gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels.subarray(i,i+4));i+=4;}
    window.swordTest={T,root,renderer,scene,camera,triangles};
    return {finite,triangles,meshes:meshes.length,materials:materials.size,textures:textures.size,min:bounds.min.toArray(),size:bounds.getSize(new T.Vector3()).toArray(),thickness,
      shared:root!==copy&&meshes.length===copyMeshes.length&&meshes.every((m,i)=>m.geometry===copyMeshes[i].geometry&&m.material===copyMeshes[i].material),
      pixels:[...pixels],render:{...renderer.info.render}};
  });
  assert.ok(model.finite&&model.shared&&model.meshes<=12&&model.triangles<18000&&model.textures<=2,JSON.stringify(model));
  assert.ok(Math.abs(model.min[1])<.06&&model.size[0]>5&&model.size[0]<7&&model.size[1]>13&&model.size[1]<15&&model.size[2]>.4&&model.size[2]<3,JSON.stringify(model));
  assert.ok(model.thickness.every(v=>v!==null&&v>.25),'Blade must retain a solid front and back surface, not be a flat image');
  const luminance=Array.from({length:model.pixels.length/4},(_,i)=>(model.pixels[i*4]+model.pixels[i*4+1]+model.pixels[i*4+2])/3);
  assert.ok(Math.max(...luminance)-Math.min(...luminance)>25,'Showroom canvas must contain nonblank model pixels: '+JSON.stringify(model.pixels));
  await page.screenshot({path:output+'/three-quarter.png'});
  for(const [name,position]of [['front',[0,7,35]],['side',[35,7,0]],['back',[0,7,-35]]]){
    await page.evaluate(position=>{const s=swordTest;s.camera.position.fromArray(position);s.camera.lookAt(0,7,0);s.renderer.render(s.scene,s.camera);},position);
    await page.screenshot({path:`${output}/${name}.png`});
  }
  const bytes=await page.evaluate(async()=>{
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {T,root,triangles}=swordTest,buffer=await new GLTFExporter().parseAsync(root,{binary:true}),loaded=(await new GLTFLoader().parseAsync(buffer,'')).scene;
    const bounds=node=>new T.Box3().setFromObject(node);let count=0;loaded.traverse(m=>{if(m.isMesh)count+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});
    if(bounds(root).min.distanceTo(bounds(loaded).min)>.0001||bounds(root).max.distanceTo(bounds(loaded).max)>.0001||count!==triangles)throw Error('GLB reload changed sword bounds or triangles');
    return Array.from(new Uint8Array(buffer));
  });
  await writeFile(output+'/ancient-wind-sword.glb',Buffer.from(bytes));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async route=>{
    const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nconst __swordOriginalInit=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await __swordOriginalInit.call(this)};MazeAdventure.prototype.tick=function(){};'});
  });
  await page.setViewportSize({width:1280,height:800});await page.goto(base+'?level=3&lang=zh');
  await page.locator('.journey-skip').click();await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  const gameplay=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),g=game,sword=g.scene.getObjectByName('ancient-wind-sword');
    if(!sword||!g.scene.getObjectByName('boss-blockout-sword').getObjectByName('ancient-wind-sword'))throw Error('Formal sword must replace the scene placeholder');
    g.wand=g.treasure=true;g.enemies[0].hp=g.enemies[1].hp=0;g.invulnerable=1000;
    window.swordPlace=(x,z)=>{g.body.setTranslation({x,y:.85,z},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.clearInput();g.render(0);};
    swordPlace(g.enemies[2].home.x,g.enemies[2].home.z+6);g.world.step();
    sword.visible=false;g.renderer.render(g.scene,g.camera);const hidden={...g.renderer.info.render};
    sword.visible=true;g.renderer.render(g.scene,g.camera);const shown={...g.renderer.info.render};
    const bounds=new T.Box3().setFromObject(sword),counts=[g.world.bodies.len(),g.world.colliders.len()];
    let lowestVertex=Infinity;const point=new T.Vector3();sword.updateMatrixWorld(true);
    sword.traverse(m=>{if(m.isMesh)for(let i=0;i<m.geometry.attributes.position.count;i++)lowestVertex=Math.min(lowestVertex,point.fromBufferAttribute(m.geometry.attributes.position,i).applyMatrix4(m.matrixWorld).y);});
    g.reset();
    const afterReset=[g.world.bodies.len(),g.world.colliders.len()];g.wand=g.treasure=true;g.invulnerable=1000;swordPlace(g.enemies[2].home.x,g.enemies[2].home.z+6);
    return {hidden,shown,min:bounds.min.toArray(),max:bounds.max.toArray(),lowestVertex,counts,afterReset,geometries:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures};
  });
  assert.ok(gameplay.shown.calls>gameplay.hidden.calls&&gameplay.shown.calls-gameplay.hidden.calls<=24,JSON.stringify(gameplay));
  assert.deepEqual(gameplay.afterReset,gameplay.counts,'Reset must not create more sword physics bodies');
  assert.ok(Math.abs(gameplay.lowestVertex)<.06,'Tilted sword tip must meet the island ground: '+gameplay.lowestVertex);
  await page.screenshot({path:output+'/gameplay-desktop.png'});
  await page.evaluate(()=>{const g=game;g.scene.getObjectByName('boss-blockout-sword').getWorldPosition(g.camera.position);const {x,z}=g.camera.position;g.camera.position.set(x+12,12,z+18);g.camera.lookAt(x+1,6,z);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);});
  await page.screenshot({path:output+'/scene-closeup.png'});
  for(const [width,height]of [[390,844],[844,390]]){
    await page.setViewportSize({width,height});await page.evaluate(()=>{game.resize();swordPlace(game.enemies[2].home.x,game.enemies[2].home.z+6);});
    await page.screenshot({path:`${output}/gameplay-${width}.png`});
  }
  assert.deepEqual(errors,[]);
  await writeFile(output+'/metrics.json',JSON.stringify({pass:true,model,glbBytes:bytes.length,gameplay,errors},null,2));
  console.log('PASS ancient wind sword geometry, physical thickness, shared resources, GLB roundtrip, in-game replacement, reset and desktop/mobile rendering',JSON.stringify({model,glbBytes:bytes.length,gameplay}));
}finally{await browser.close();}
