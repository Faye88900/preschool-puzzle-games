import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='artifacts/models/wrapping-sword-roots',errors=[];
const base=process.env.TEST_URL||'http://127.0.0.1:4399/';
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1200,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('**/__wrapping-sword-roots',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto(base+'__wrapping-sword-roots');
  const model=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),{createWrappingSwordRoots}=await import('/src/wrapping-sword-roots.ts'),{createAncientWindSword}=await import('/src/ancient-wind-sword.ts');
    const root=createWrappingSwordRoots(),copy=createWrappingSwordRoots(),sword=createAncientWindSword(),scene=new T.Scene();
    sword.rotation.z=-.25;sword.visible=false;scene.add(root,sword);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,900);renderer.setPixelRatio(1);
    renderer.setClearColor('#f7f3eb');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#f4f8ff','#a6a08c',2));
    const sun=new T.DirectionalLight('#fff1d9',3);sun.position.set(-10,20,18);sun.castShadow=true;
    Object.assign(sun.shadow.camera,{left:-15,right:15,top:20,bottom:-4,near:1,far:80});sun.shadow.mapSize.setScalar(2048);sun.shadow.normalBias=.015;scene.add(sun);
    const fill=new T.DirectionalLight('#dbe9ff',.9);fill.position.set(12,10,-15);scene.add(fill);
    const floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:'#f7f3eb',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.025;floor.receiveShadow=true;scene.add(floor);
    const camera=new T.OrthographicCamera(-14,14,10.5,-10.5,.1,100);camera.position.set(17,12,30);camera.lookAt(0,6,0);renderer.render(scene,camera);
    const meshes=[],copyMeshes=[],materials=new Set(),textures=new Set(),lower=new T.Box3(),upper=new T.Box3();let triangles=0,finite=true;
    root.updateMatrixWorld(true);const point=new T.Vector3();
    root.traverse(m=>{if(!m.isMesh)return;meshes.push(m);triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
      const p=m.geometry.attributes.position,n=m.geometry.attributes.normal;finite&&=Array.from(p.array).every(Number.isFinite)&&Array.from(n.array).every(Number.isFinite);
      for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);if(point.y<2)lower.expandByPoint(point);if(point.y>7&&point.y<9)upper.expandByPoint(point);}
      for(const mat of Array.isArray(m.material)?m.material:[m.material]){materials.add(mat);for(const v of Object.values(mat))if(v?.isTexture)textures.add(v);}
    });copy.traverse(m=>{if(m.isMesh)copyMeshes.push(m);});
    const ray=new T.Raycaster(),thickness=[],topHits=[];
    for(const x of [-8,-4,0,4,8])for(const y of [.6,1.2]){
      ray.set(new T.Vector3(x,y,10),new T.Vector3(0,0,-1));const front=ray.intersectObject(root,true)[0]?.point.z;
      ray.set(new T.Vector3(x,y,-10),new T.Vector3(0,0,1));const back=ray.intersectObject(root,true)[0]?.point.z;
      if(front!==undefined&&back!==undefined)thickness.push(front-back);
    }
    for(const x of [-8,-4,0,4,8])for(const z of [-3,-1,1]){ray.set(new T.Vector3(x,15,z),new T.Vector3(0,-1,0));const hit=ray.intersectObject(root,true)[0];if(hit)topHits.push(hit.point.y);}
    sword.updateMatrixWorld(true);
    const frontClear=[[0,10.43,1.05],[.63,6,.76],[-.49,6.43,.75]].map(p=>{
      const target=new T.Vector3(...p).applyMatrix4(sword.matrixWorld);ray.set(target.clone().add(new T.Vector3(0,0,20)),new T.Vector3(0,0,-1));
      return !ray.intersectObject(root,true).some(hit=>hit.distance<19.92);
    });
    const bounds=new T.Box3().setFromObject(root),gl=renderer.getContext(),pixels=[];
    for(const y of [250,450,550])for(const x of [350,500,600,700,850]){const pixel=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);pixels.push((pixel[0]+pixel[1]+pixel[2])/3);}
    window.rootsTest={T,root,sword,renderer,scene,camera,triangles};
    return {finite,triangles,meshes:meshes.length,materials:materials.size,textures:textures.size,min:bounds.min.toArray(),size:bounds.getSize(new T.Vector3()).toArray(),
      lowerWidth:lower.getSize(new T.Vector3()).x,upperWidth:upper.getSize(new T.Vector3()).x,thickness,topHits,frontClear,pixels,render:{...renderer.info.render},
      shared:root!==copy&&meshes.length===copyMeshes.length&&meshes.every((m,i)=>m.geometry===copyMeshes[i].geometry&&m.material===copyMeshes[i].material)};
  });
  assert.ok(model.finite&&model.shared&&model.meshes<=7&&model.materials<=7&&model.triangles<24000&&model.textures<=2,JSON.stringify(model));
  assert.ok(Math.abs(model.min[1])<.12&&model.size[0]>15&&model.size[0]<22&&model.size[1]>9&&model.size[1]<12&&model.size[2]>2.5&&model.size[2]<7,JSON.stringify(model));
  assert.ok(model.lowerWidth>model.upperWidth*1.25&&model.upperWidth>1,'Roots must spread at the base and narrow toward the climbing tips');
  assert.ok(model.thickness.filter(v=>v>.15).length>=2&&model.topHits.length>=3,'Roots must have visible solid surfaces from opposing and overhead directions');
  assert.ok(model.frontClear.every(Boolean),'Roots must leave the central wind seal, wind channel and ember crack visible');
  assert.ok(Math.max(...model.pixels)-Math.min(...model.pixels)>25,'Showroom canvas must contain nonblank root pixels');
  await page.screenshot({path:output+'/three-quarter.png'});
  for(const [name,position]of [['front',[0,6,35]],['side',[35,6,0]],['back',[0,6,-35]]]){
    await page.evaluate(position=>{const s=rootsTest;s.camera.position.fromArray(position);s.camera.lookAt(0,6,0);s.renderer.render(s.scene,s.camera);},position);
    await page.screenshot({path:`${output}/${name}.png`});
  }
  await page.evaluate(()=>{const s=rootsTest;s.sword.visible=true;s.camera.position.set(17,12,30);s.camera.lookAt(0,6,0);s.renderer.render(s.scene,s.camera);});
  await page.screenshot({path:output+'/sword-combined.png'});
  const bytes=await page.evaluate(async()=>{
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {T,root,triangles}=rootsTest,buffer=await new GLTFExporter().parseAsync(root,{binary:true}),loaded=(await new GLTFLoader().parseAsync(buffer,'')).scene;
    const bounds=node=>new T.Box3().setFromObject(node);let count=0;loaded.traverse(m=>{if(m.isMesh)count+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});
    if(bounds(root).min.distanceTo(bounds(loaded).min)>.0001||bounds(root).max.distanceTo(bounds(loaded).max)>.0001||count!==triangles)throw Error('GLB reload changed root bounds or triangles');
    return Array.from(new Uint8Array(buffer));
  });
  await writeFile(output+'/wrapping-sword-roots.glb',Buffer.from(bytes));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async route=>{
    const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nconst __rootsOriginalInit=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await __rootsOriginalInit.call(this)};MazeAdventure.prototype.tick=function(){};'});
  });
  await page.setViewportSize({width:1280,height:800});await page.goto(base+'?level=3&lang=zh');
  await page.locator('.journey-skip').click();await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  const gameplay=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),g=game,root=g.scene.getObjectByName('wrapping-sword-roots'),sword=g.scene.getObjectByName('ancient-wind-sword');
    if(!root||!g.scene.getObjectByName('boss-blockout-roots').getObjectByName('wrapping-sword-roots'))throw Error('Formal roots must replace the scene placeholder');
    g.wand=g.treasure=true;g.enemies[0].hp=g.enemies[1].hp=0;g.invulnerable=1000;
    window.rootsPlace=(x,z)=>{g.body.setTranslation({x,y:.85,z},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.clearInput();g.render(0);};
    rootsPlace(g.enemies[2].home.x,g.enemies[2].home.z+6);g.world.step();
    root.visible=false;g.renderer.render(g.scene,g.camera);const hidden={...g.renderer.info.render};root.visible=true;g.renderer.render(g.scene,g.camera);const shown={...g.renderer.info.render};
    const ray=new T.Raycaster();sword.updateMatrixWorld(true);
    const clearSwordFace=[[0,10.43,1.05],[.63,6,.76],[-.49,6.43,.75]].map(p=>{
      const target=new T.Vector3(...p).applyMatrix4(sword.matrixWorld),direction=target.clone().sub(g.camera.position),distance=direction.length();
      ray.set(g.camera.position,direction.normalize());return !ray.intersectObject(root,true).some(hit=>hit.distance<distance-.08);
    });
    const floors=[];for(let x=176;x<=198;x+=2)for(let z=-36;z<=-14;z+=2){if(Math.hypot(x-187.5,z+25)>12)continue;
      const hit=g.world.castRay({origin:{x,y:6,z},dir:{x:0,y:-1,z:0}},8,true,undefined,undefined,undefined,g.body);floors.push(hit?6-hit.timeOfImpact:null);
    }
    const positions=['boss-blockout-sword','boss-blockout-roots'].map(name=>g.scene.getObjectByName(name).getWorldPosition(new T.Vector3()).toArray());
    return {hidden,shown,clearSwordFace,floors,positions,geometries:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures};
  });
  assert.ok(gameplay.shown.calls>gameplay.hidden.calls&&gameplay.shown.calls-gameplay.hidden.calls<=14,JSON.stringify(gameplay));
  assert.deepEqual(gameplay.positions,[[192.5,0,-42],[192.5,0,-42]]);assert.ok(gameplay.clearSwordFace.every(Boolean),'Roots must preserve important sword details from the gameplay camera');
  assert.ok(gameplay.floors.length>70&&gameplay.floors.every(y=>y!==null&&Math.abs(y)<.03),'Root collisions must leave the central battle floor clear');
  await page.screenshot({path:output+'/gameplay-desktop.png'});
  const routes=await page.evaluate(()=>{
    const g=game,results=[];rootsPlace(165,-15);
    for(const [x,z]of [[176,-15],[187.5,-25],[187.5,-34],[187.5,-25],[176,-15],[165,-15]]){
      for(let i=0;i<900;i++){const p=g.body.translation();if(Math.hypot(x-p.x,z-p.z)<.2)break;g.keys.clear();if(Math.abs(x-p.x)>.1)g.keys.add(x>p.x?'KeyD':'KeyA');if(Math.abs(z-p.z)>.1)g.keys.add(z>p.z?'KeyS':'KeyW');g.step();}
      g.clearInput();const p=g.body.translation();results.push({target:[x,z],distance:Math.hypot(x-p.x,z-p.z),y:p.y});
    }
    rootsPlace(g.enemies[2].home.x,g.enemies[2].home.z+6);return results;
  });
  assert.ok(routes.every(r=>r.distance<.35&&r.y>.6),JSON.stringify(routes));
  const collision=await page.evaluate(()=>{
    const g=game,stops=[];
    for(const x of [188,197.7]){rootsPlace(x,-39);g.keys.add('KeyW');for(let i=0;i<120;i++)g.step();g.clearInput();stops.push({...g.body.translation()});}
    const before=[g.world.bodies.len(),g.world.colliders.len()];g.reset();const after=[g.world.bodies.len(),g.world.colliders.len()];
    g.wand=g.treasure=true;g.invulnerable=1000;rootsPlace(g.enemies[2].home.x,g.enemies[2].home.z+6);
    return {stops,before,after};
  });
  assert.ok(Math.abs(collision.stops[0].z+41.8)<.2&&Math.abs(collision.stops[1].z+41.6)<.2&&collision.stops.every(p=>p.y>.6),'Both root bases must physically stop a grounded player: '+JSON.stringify(collision));
  assert.deepEqual(collision.after,collision.before,'Reset must keep the root collision bodies stable');
  await page.evaluate(()=>{const g=game;g.camera.position.set(204.5,12,-24);g.camera.lookAt(193.5,6,-42);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);});
  await page.screenshot({path:output+'/scene-closeup.png'});
  for(const [width,height]of [[390,844],[844,390]]){await page.setViewportSize({width,height});await page.evaluate(()=>{game.resize();rootsPlace(game.enemies[2].home.x,game.enemies[2].home.z+6);});await page.screenshot({path:`${output}/gameplay-${width}.png`});}
  assert.deepEqual(errors,[]);
  await writeFile(output+'/metrics.json',JSON.stringify({pass:true,model,glbBytes:bytes.length,gameplay,routes,collision,errors},null,2));
  console.log('PASS wrapping sword roots organic shape, solid surfaces, shared resources, GLB roundtrip, clear sword face, battle floor, traversal and desktop/mobile rendering',JSON.stringify({model,glbBytes:bytes.length,gameplay}));
}finally{await browser.close();}
