import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='artifacts/models/leaf-guardian-statue',errors=[];
const base=process.env.TEST_URL||'http://127.0.0.1:4399/';
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1200,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('**/__leaf-guardian-statue',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto(base+'__leaf-guardian-statue');
  const models=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),{createLeafGuardianStatue}=await import('/src/leaf-guardian-statue.ts');
    const roots=[createLeafGuardianStatue(false),createLeafGuardianStatue(true)],scene=new T.Scene();scene.add(...roots);roots[1].visible=false;
    const meshes=object=>{const list=[];object.traverse(m=>{if(m.isMesh)list.push(m);});return list;};
    const inspect=object=>{
      const list=meshes(object),materials=new Set(),textures=new Set();let triangles=0,finite=true;
      for(const m of list){triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;finite&&=Array.from(m.geometry.attributes.position.array).every(Number.isFinite)&&Array.from(m.geometry.attributes.normal.array).every(Number.isFinite);
        for(const mat of Array.isArray(m.material)?m.material:[m.material]){materials.add(mat);for(const v of Object.values(mat))if(v?.isTexture)textures.add(v);}}
      const box=new T.Box3().setFromObject(object);return {meshes:list.length,materials:materials.size,textures:textures.size,triangles,finite,min:box.min.toArray(),size:box.getSize(new T.Vector3()).toArray()};
    };
    const modelStats=roots.map((root,i)=>{
      const copy=createLeafGuardianStatue(!!i),a=meshes(root),b=meshes(copy),stats=inspect(root),ray=new T.Raycaster(),tops=[];root.updateMatrixWorld(true);
      for(const x of [-.55,-.3,0,.3,.55]){ray.set(new T.Vector3(x,6,0),new T.Vector3(0,-1,0));tops.push(ray.intersectObject(root,true)[0]?.point.y??null);}
      ray.set(new T.Vector3(.45,1.1,5),new T.Vector3(0,0,-1));const front=ray.intersectObject(root,true)[0]?.point.z;
      ray.set(new T.Vector3(.45,1.1,-5),new T.Vector3(0,0,1));const back=ray.intersectObject(root,true)[0]?.point.z;
      const helmet=root.getObjectByName('statue-helmet'),crown=root.getObjectByName('statue-crown'),visor=[];
      for(const x of [0,.15]){ray.set(new T.Vector3(x,2.72,5),new T.Vector3(0,0,-1));visor.push(ray.intersectObject(helmet,true)[0]?.point.z??null);}
      ray.set(new T.Vector3(.25,4,0),new T.Vector3(0,-1,0));const helmetTop=ray.intersectObject(helmet,true)[0]?.point.y??null;
      return {damaged:!!i,...stats,shared:root!==copy&&a.length===b.length&&a.every((m,j)=>m.geometry===b[j].geometry&&m.material===b[j].material),tops,visor,helmetTop,crownMax:new T.Box3().setFromObject(crown).max.y,thickness:front===undefined||back===undefined?null:front-back};
    });
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,900);renderer.setPixelRatio(1);renderer.setClearColor('#f7f3eb');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#f4f8ff','#a6a08c',2));const sun=new T.DirectionalLight('#fff1d9',3);sun.position.set(-5,8,6);sun.castShadow=true;
    sun.shadow.mapSize.setScalar(1024);Object.assign(sun.shadow.camera,{left:-4,right:4,top:5,bottom:-2,near:.1,far:30});sun.shadow.normalBias=.008;scene.add(sun);
    const fill=new T.DirectionalLight('#dbe9ff',.7);fill.position.set(6,3,-7);scene.add(fill);
    const floor=new T.Mesh(new T.PlaneGeometry(40,40),new T.MeshStandardMaterial({color:'#f7f3eb',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;floor.receiveShadow=true;scene.add(floor);
    const camera=new T.OrthographicCamera(-3,3,2.25,-2.25,.1,40);camera.position.set(6,4,9);camera.lookAt(0,1.8,0);renderer.render(scene,camera);
    window.statueTest={T,roots,scene,renderer,camera,inspect};return modelStats;
  });
  for(const [i,variant]of ['intact','damaged'].entries()){
    await page.evaluate(i=>{const s=statueTest;s.roots.forEach((root,j)=>root.visible=i===j);s.renderer.render(s.scene,s.camera);},i);
    await page.screenshot({path:`${output}/${variant}-three-quarter.png`});
  }
  assert.ok(models.every(m=>m.finite&&m.shared&&m.meshes<=12&&m.materials<=8&&m.triangles<30000),'Both variants must be finite, shared and within the prop budget: '+JSON.stringify(models));
  assert.ok(models.every(m=>Math.abs(m.min[1])<.04&&m.size[0]<2.5&&m.size[0]>1.7&&m.size[1]>3.2&&m.size[1]<4.2&&m.size[2]>.9&&m.size[2]<2.5&&m.thickness>.4),'Statues must be grounded and solid: '+JSON.stringify(models));
  assert.ok(models[0].triangles!==models[1].triangles&&models[0].tops.some((y,i)=>y!==null&&models[1].tops[i]!==null&&Math.abs(y-models[1].tops[i])>.12),'Broken crown must change the actual upper silhouette');
  assert.ok(models[0].crownMax-models[1].crownMax>.15,'Damaged leaf crown must be physically shorter');
  assert.ok(models.every(m=>m.visor.every(z=>z!==null)&&m.visor[1]-m.visor[0]>.08),'Helmet visor must be open through the stone shell with a recessed interior, not painted black: '+JSON.stringify(models.map(m=>m.visor)));
  assert.ok(models.every(m=>m.helmetTop>3.10&&m.helmetTop<3.22),'Helmet top must have a closed outward-facing stone cap');
  const exports=[];
  for(const [i,variant]of ['intact','damaged'].entries()){
    const pixelRange=await page.evaluate(i=>{
      const s=statueTest;s.roots.forEach((root,j)=>root.visible=i===j);s.camera.position.set(6,4,9);s.camera.lookAt(0,1.8,0);s.renderer.render(s.scene,s.camera);
      const gl=s.renderer.getContext(),values=[];for(const y of [250,450,650])for(const x of [350,500,600,700,850]){const p=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);values.push((p[0]+p[1]+p[2])/3);}return Math.max(...values)-Math.min(...values);
    },i);
    assert.ok(pixelRange>20,'Statue showroom must have nonblank varied pixels');models[i].pixelRange=pixelRange;
    await page.screenshot({path:`${output}/${variant}-three-quarter.png`});
    for(const [name,position]of [['front',[0,1.8,10]],['side',[10,1.8,0]],['back',[0,1.8,-10]]]){
      await page.evaluate(position=>{const s=statueTest;s.camera.position.fromArray(position);s.camera.lookAt(0,1.8,0);s.renderer.render(s.scene,s.camera);},position);
      await page.screenshot({path:`${output}/${variant}-${name}.png`});
    }
    const bytes=await page.evaluate(async i=>{
      const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
      const s=statueTest,root=s.roots[i],buffer=await new GLTFExporter().parseAsync(root,{binary:true}),loaded=(await new GLTFLoader().parseAsync(buffer,'')).scene,before=s.inspect(root),after=s.inspect(loaded);
      if(before.triangles!==after.triangles||before.min.some((n,j)=>Math.abs(n-after.min[j])>.0001)||before.size.some((n,j)=>Math.abs(n-after.size[j])>.0001))throw Error('GLB reload changed statue');
      return Array.from(new Uint8Array(buffer));
    },i);
    await writeFile(`${output}/leaf-guardian-statue-${variant}.glb`,Buffer.from(bytes));exports.push({variant,bytes:bytes.length});
  }
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nconst __statueInit=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await __statueInit.call(this)};MazeAdventure.prototype.tick=function(){};'});});
  await page.setViewportSize({width:1280,height:800});await page.goto(base+'?level=3&lang=zh');await page.locator('.journey-skip').click();await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  const gameplay=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),g=game,statues=[g.scene.getObjectByName('leaf-guardian-statue-intact')];
    if(!statues[0]||!g.scene.getObjectByName('boss-blockout-statue-0').getObjectByName(statues[0].name)||g.scene.getObjectByName('boss-blockout-statue-1')||g.scene.getObjectByName('leaf-guardian-statue-damaged'))throw Error('Only the selected intact statue must remain in the courtyard');
    g.wand=g.treasure=true;g.enemies[0].hp=g.enemies[1].hp=0;g.invulnerable=1000;
    window.statuePlace=(x,z)=>{g.body.setTranslation({x,y:.85,z},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.clearInput();g.render(0);};
    statuePlace(165,-15);g.world.step();
    const positions=statues.map(s=>s.getWorldPosition(new T.Vector3()).toArray());
    statues.forEach(s=>s.visible=false);g.renderer.render(g.scene,g.camera);const hidden={...g.renderer.info.render};statues.forEach(s=>s.visible=true);g.renderer.render(g.scene,g.camera);const shown={...g.renderer.info.render};
    return {positions,hidden,shown,occluders:g.buildingOccluders.filter(o=>o.object.name.startsWith('boss-blockout-statue-')).length,geometries:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures};
  });
  assert.deepEqual(gameplay.positions,[[169.5,0,-19]]);assert.equal(gameplay.occluders,1);assert.ok(gameplay.shown.calls>gameplay.hidden.calls&&gameplay.shown.calls-gameplay.hidden.calls<=12);
  await page.screenshot({path:output+'/gameplay-entry.png'});
  const travel=await page.evaluate(()=>{
    const g=game,stops=[];statuePlace(165,-15);
    const routes=[];for(const [x,z]of [[176,-15],[165,-15]]){for(let i=0;i<900;i++){const p=g.body.translation();if(Math.hypot(x-p.x,z-p.z)<.2)break;g.keys.clear();if(Math.abs(x-p.x)>.1)g.keys.add(x>p.x?'KeyD':'KeyA');if(Math.abs(z-p.z)>.1)g.keys.add(z>p.z?'KeyS':'KeyW');g.step();}g.clearInput();const p=g.body.translation();routes.push({distance:Math.hypot(x-p.x,z-p.z),y:p.y});}
    statuePlace(173,-19);g.keys.add('KeyA');for(let i=0;i<120;i++)g.step();g.clearInput();stops.push({...g.body.translation()});
    statuePlace(173,-11);g.keys.add('KeyA');for(let i=0;i<120;i++)g.step();g.clearInput();const cleared={...g.body.translation()};
    const floorHit=g.world.castRay({origin:{x:169.5,y:6,z:-11},dir:{x:0,y:-1,z:0}},8,true,undefined,undefined,undefined,g.body),removedFloor=floorHit?6-floorHit.timeOfImpact:null;
    statuePlace(169.5,-22);const opacity=g.buildingOccluders.find(o=>o.object.name==='boss-blockout-statue-0').opacity;
    const before=[g.world.bodies.len(),g.world.colliders.len()];g.reset();const after=[g.world.bodies.len(),g.world.colliders.len()];g.wand=g.treasure=true;g.invulnerable=1000;statuePlace(165,-15);
    return {routes,stops,cleared,removedFloor,opacity,before,after};
  });
  assert.ok(travel.routes.every(r=>r.distance<.35&&r.y>.6),'Statues must leave the dock entrance passable');
  assert.ok(travel.stops.every(p=>p.x>170.7&&p.x<171.5&&p.y>.6),'Remaining statue base must stop player collision: '+JSON.stringify(travel));
  assert.ok(travel.cleared.x<169&&travel.cleared.y>.6,'Removed statue must leave no invisible collision: '+JSON.stringify(travel.cleared));
  assert.ok(travel.removedFloor!==null&&Math.abs(travel.removedFloor)<.03,'Removed statue base must expose the original ground: '+travel.removedFloor);
  assert.equal(travel.opacity,.16,'Statues in front of the player must fade');assert.deepEqual(travel.after,travel.before,'Reset must retain stable statue collision counts');
  await page.evaluate(()=>{const g=game;g.camera.position.set(177,7,-4);g.camera.lookAt(169.5,1.8,-15);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);});await page.screenshot({path:output+'/scene-closeup.png'});
  for(const [width,height]of [[390,844],[844,390]]){await page.setViewportSize({width,height});await page.evaluate(()=>{game.resize();statuePlace(165,-15);});await page.screenshot({path:`${output}/gameplay-${width}.png`});}
  assert.deepEqual(errors,[]);await writeFile(output+'/metrics.json',JSON.stringify({pass:true,models,exports,gameplay,travel,errors},null,2));
  console.log('PASS leaf guardian statue variants, solid body, crown silhouette, shared resources, GLB roundtrips, entrance traversal, collisions, fading and mobile views',JSON.stringify({models,exports,gameplay,travel}));
}finally{await browser.close();}
