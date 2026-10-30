import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='artifacts/models/leaf-chime-post',errors=[];
const base=process.env.TEST_URL||'http://127.0.0.1:4399/';
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1200,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('**/__leaf-chime-post',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto(base+'__leaf-chime-post');
  const model=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),{createLeafChimePost}=await import('/src/leaf-chime-post.ts');
    const root=createLeafChimePost(),copy=createLeafChimePost(),scene=new T.Scene();scene.add(root);
    const meshes=object=>{const list=[];object.traverse(m=>{if(m.isMesh)list.push(m);});return list;};
    const inspect=object=>{
      const list=meshes(object),materials=new Set(),textures=new Set();let triangles=0,finite=true;
      for(const m of list){triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;finite&&=Array.from(m.geometry.attributes.position.array).every(Number.isFinite)&&Array.from(m.geometry.attributes.normal.array).every(Number.isFinite);
        for(const mat of Array.isArray(m.material)?m.material:[m.material]){materials.add(mat);for(const v of Object.values(mat))if(v?.isTexture)textures.add(v);}}
      const palette=[...new Set([...materials].map(m=>[m.name,m.color.getHexString(),m.roughness,m.metalness,!!m.map].join('|')))].sort();
      const box=new T.Box3().setFromObject(object);return {meshes:list.length,materials:materials.size,palette,textures:textures.size,triangles,finite,min:box.min.toArray(),size:box.getSize(new T.Vector3()).toArray()};
    };
    root.updateMatrixWorld(true);const ray=new T.Raycaster(),leaves=[];
    for(let i=0;i<3;i++){
      const pivot=root.getObjectByName('leaf-chime-'+i),leaf=pivot.getObjectByName('chime-leaf'),ring=pivot.getObjectByName('chime-ring');
      if(!leaf||!ring)throw Error('Each chime needs a named leaf and hanging ring');
      const target=new T.Vector3(0,-.11,0).applyMatrix4(pivot.matrixWorld),dir=new T.Vector3(0,0,-1).transformDirection(pivot.matrixWorld);
      ray.set(target.clone().addScaledVector(dir,-1),dir);const opening=ray.intersectObject(leaf,true).length===0;
      const solidPoint=new T.Vector3(0,-.35,0).applyMatrix4(pivot.matrixWorld),depths=[];
      for(const side of [-1,1]){const direction=dir.clone().multiplyScalar(side);ray.set(solidPoint.clone().addScaledVector(direction,-1),direction);const hit=ray.intersectObject(leaf,true)[0];depths.push(hit?.point.clone().sub(solidPoint).dot(dir)??null);}
      const ringBounds=new T.Box3().setFromObject(ring),pivotWorld=pivot.getWorldPosition(new T.Vector3()),leafBounds=new T.Box3().setFromObject(leaf);
      leaves.push({opening,depths,thickness:depths.every(n=>n!==null)?Math.abs(depths[0]-depths[1]):0,pivot:pivotWorld.toArray(),
        leafMin:leafBounds.min.toArray(),leafMax:leafBounds.max.toArray(),ringSize:ringBounds.getSize(new T.Vector3()).toArray(),ringDistance:ringBounds.getCenter(new T.Vector3()).distanceTo(pivotWorld)});
    }
    const a=meshes(root),b=meshes(copy),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,900);renderer.setPixelRatio(1);
    renderer.setClearColor('#f7f3eb');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#f4f8ff','#a6a08c',2));const sun=new T.DirectionalLight('#fff1d9',3);sun.position.set(-5,8,6);sun.castShadow=true;
    sun.shadow.mapSize.setScalar(1024);Object.assign(sun.shadow.camera,{left:-4,right:4,top:6,bottom:-2,near:.1,far:30});sun.shadow.normalBias=.008;scene.add(sun);
    const fill=new T.DirectionalLight('#dbe9ff',.7);fill.position.set(6,3,-7);scene.add(fill);
    const floor=new T.Mesh(new T.PlaneGeometry(40,40),new T.MeshStandardMaterial({color:'#f7f3eb',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;floor.receiveShadow=true;scene.add(floor);
    const camera=new T.OrthographicCamera(-3.4,3.4,2.55,-2.55,.1,40);camera.position.set(6,4.8,9);camera.lookAt(.5,2.1,0);renderer.render(scene,camera);
    const gl=renderer.getContext(),pixels=[];for(const y of [200,350,500,650])for(const x of [350,500,600,700,850]){const p=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);pixels.push((p[0]+p[1]+p[2])/3);}
    window.chimeTest={T,root,scene,renderer,camera,inspect};return {...inspect(root),leaves,pixelRange:Math.max(...pixels)-Math.min(...pixels),
      shared:root!==copy&&a.length===b.length&&a.every((m,i)=>m.geometry===b[i].geometry&&m.material===b[i].material),frame:!!root.getObjectByName('chime-frame'),streamer:!!root.getObjectByName('chime-streamer')};
  });
  await page.screenshot({path:output+'/three-quarter.png'});
  assert.ok(model.finite&&model.shared&&model.meshes<=16&&model.materials<=8&&model.triangles<20000&&model.textures<=2,JSON.stringify(model));
  assert.ok(Math.abs(model.min[1])<.04&&model.size[1]>3.8&&model.size[1]<4.8&&model.size[0]>1.4&&model.size[0]<3.6&&model.size[2]>.6&&model.size[2]<2.2,'Post must be grounded and solid: '+JSON.stringify(model));
  assert.ok(model.frame&&model.streamer&&model.pixelRange>20);
  assert.ok(model.leaves.every(l=>l.opening&&l.thickness>.04&&l.thickness<.18),'Leaves need real holes and solid bronze thickness');
  assert.ok(model.leaves.every(l=>l.ringDistance<.35&&l.ringSize[1]>.10&&l.ringSize[2]>.10),'Hanging rings must attach near the local leaf pivots');
  assert.ok(model.leaves.every((l,i)=>i===0||l.pivot[0]-model.leaves[i-1].pivot[0]>.2),'The three hanging leaves must remain separated');
  assert.ok(model.leaves[0].leafMax[1]-model.leaves[0].leafMin[1]<model.leaves[2].leafMax[1]-model.leaves[2].leafMin[1],'Chime leaves must have distinct lengths');
  for(const [name,position]of [['front',[.5,2.1,10]],['side',[10,2.1,0]],['back',[.5,2.1,-10]]]){await page.evaluate(position=>{const s=chimeTest;s.camera.position.fromArray(position);s.camera.lookAt(.5,2.1,0);s.renderer.render(s.scene,s.camera);},position);await page.screenshot({path:`${output}/${name}.png`});}
  const bytes=await page.evaluate(async()=>{
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const s=chimeTest,buffer=await new GLTFExporter().parseAsync(s.root,{binary:true}),loaded=(await new GLTFLoader().parseAsync(buffer,'')).scene,before=s.inspect(s.root),after=s.inspect(loaded);
    // GLTFLoader clones the ring's gold material because its mesh has no vertex colors.
    if(before.triangles!==after.triangles||before.textures!==after.textures||JSON.stringify(before.palette)!==JSON.stringify(after.palette)||before.min.some((n,j)=>Math.abs(n-after.min[j])>.0001)||before.size.some((n,j)=>Math.abs(n-after.size[j])>.0001))throw Error('GLB reload changed chime geometry or embedded materials/textures: '+JSON.stringify({before,after}));return Array.from(new Uint8Array(buffer));
  });await writeFile(output+'/leaf-chime-post.glb',Buffer.from(bytes));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nconst __chimeInit=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await __chimeInit.call(this)};MazeAdventure.prototype.tick=function(){};'});});
  await page.setViewportSize({width:1280,height:800});await page.goto(base+'?level=3&lang=zh');await page.locator('.journey-skip').click();await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  const gameplay=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),g=game,posts=[0,1].map(i=>g.scene.getObjectByName('boss-blockout-chime-'+i).getObjectByName('leaf-chime-post'));
    if(posts.some(p=>!p))throw Error('Both leaf chime posts must replace their placeholders');g.wand=g.treasure=true;g.enemies[0].hp=g.enemies[1].hp=0;g.invulnerable=1000;
    window.chimePlace=(x,z)=>{g.body.setTranslation({x,y:.85,z},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.clearInput();g.render(0);};
    chimePlace(200,-15);g.world.step();posts.forEach(p=>p.visible=false);g.renderer.render(g.scene,g.camera);const hidden={...g.renderer.info.render};posts.forEach(p=>p.visible=true);g.renderer.render(g.scene,g.camera);const shown={...g.renderer.info.render};
    return {positions:posts.map(p=>p.getWorldPosition(new T.Vector3()).toArray()),hidden,shown,occluders:g.buildingOccluders.filter(o=>o.object.name.startsWith('boss-blockout-chime-')).length,geometries:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures};
  });
  assert.deepEqual(gameplay.positions,[[169.5,0,-41],[205,0,-11]]);assert.equal(gameplay.occluders,2);assert.ok(gameplay.shown.calls>gameplay.hidden.calls&&gameplay.shown.calls-gameplay.hidden.calls<=32);
  await page.screenshot({path:output+'/gameplay-desktop.png'});
  const travel=await page.evaluate(()=>{
    const g=game,stops=[],routes=[];chimePlace(165,-15);
    for(const [x,z]of [[175,-15],[200,-15],[200,-38],[175,-38],[175,-15],[165,-15]]){for(let i=0;i<900;i++){const p=g.body.translation();if(Math.hypot(x-p.x,z-p.z)<.2)break;g.keys.clear();if(Math.abs(x-p.x)>.1)g.keys.add(x>p.x?'KeyD':'KeyA');if(Math.abs(z-p.z)>.1)g.keys.add(z>p.z?'KeyS':'KeyW');g.step();}g.clearInput();const p=g.body.translation();routes.push({distance:Math.hypot(x-p.x,z-p.z),y:p.y});}
    for(const [x,z,key]of [[173,-41,'KeyA'],[201.5,-11,'KeyD']]){chimePlace(x,z);g.keys.add(key);for(let i=0;i<120;i++)g.step();g.clearInput();stops.push({...g.body.translation()});}
    chimePlace(205,-14);const opacity=g.buildingOccluders.find(o=>o.object.name==='boss-blockout-chime-1').opacity;
    const before=[g.world.bodies.len(),g.world.colliders.len()];g.reset();const after=[g.world.bodies.len(),g.world.colliders.len()];g.wand=g.treasure=true;g.invulnerable=1000;chimePlace(200,-15);return {routes,stops,opacity,before,after};
  });
  assert.ok(travel.routes.every(r=>r.distance<.35&&r.y>.6),'Posts must preserve dock and perimeter traversal: '+JSON.stringify(travel));
  assert.ok(Math.abs(travel.stops[0].x-170.45)<.2&&Math.abs(travel.stops[1].x-204.05)<.2&&travel.stops.every(p=>p.y>.6),'Both post proxies must block grounded movement: '+JSON.stringify(travel));
  assert.equal(travel.opacity,.16);assert.deepEqual(travel.before,travel.after);
  await page.evaluate(()=>{const g=game;g.camera.position.set(211,6,-3);g.camera.lookAt(205.5,2.2,-11);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);});await page.screenshot({path:output+'/scene-closeup.png'});
  for(const [width,height]of [[390,844],[844,390]]){
    await page.setViewportSize({width,height});await page.evaluate(()=>{game.resize();chimePlace(200,-15);});await page.screenshot({path:`${output}/gameplay-${width}.png`});
    await page.evaluate(()=>{const g=game;g.camera.position.set(210,5,-2);g.camera.lookAt(205.7,2.1,-11);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);});await page.screenshot({path:`${output}/chime-closeup-${width}.png`});
  }
  assert.deepEqual(errors,[]);await writeFile(output+'/metrics.json',JSON.stringify({pass:true,model,glbBytes:bytes.length,gameplay,travel,errors},null,2));
  console.log('PASS leaf chime post solid leaves, hanging holes/rings, sharing, GLB, layout, collision, fading and mobile',JSON.stringify({model,glbBytes:bytes.length,gameplay,travel}));
}finally{await browser.close();}
