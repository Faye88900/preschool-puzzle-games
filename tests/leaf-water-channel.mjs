import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='artifacts/models/leaf-water-channel',errors=[];
const base=process.env.TEST_URL||'http://127.0.0.1:4399/';
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1200,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('**/__leaf-water-channel',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto(base+'__leaf-water-channel');
  const model=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),{createLeafWaterChannel,LEAF_CHANNEL_FLOORS,LEAF_CHANNEL_SPACING}=await import('/src/leaf-water-channel.ts');
    const root=createLeafWaterChannel(),copy=createLeafWaterChannel(),scene=new T.Scene();scene.add(root);
    const meshes=object=>{const list=[];object.traverse(m=>{if(m.isMesh)list.push(m);});return list;};
    const inspect=object=>{
      const list=meshes(object),materials=new Set(),textures=new Set();let triangles=0,finite=true;
      for(const m of list){triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;finite&&=Array.from(m.geometry.attributes.position.array).every(Number.isFinite)&&Array.from(m.geometry.attributes.normal.array).every(Number.isFinite);
        for(const mat of Array.isArray(m.material)?m.material:[m.material]){materials.add(mat);for(const v of Object.values(mat))if(v?.isTexture)textures.add(v);}}
      const box=new T.Box3().setFromObject(object);return {meshes:list.length,materials:materials.size,textures:textures.size,triangles,finite,min:box.min.toArray(),size:box.getSize(new T.Vector3()).toArray()};
    };
    const ray=new T.Raycaster(),tiers=[];root.updateMatrixWorld(true);
    for(let i=0;i<3;i++){
      const tier=root.getObjectByName('leaf-water-tier-'+i),shell=tier.getObjectByName('stone-leaf-basin'),z=tier.position.z,floor=LEAF_CHANNEL_FLOORS[i];
      const hit=(x,y,z,direction)=>{ray.set(new T.Vector3(x,y,z),new T.Vector3(0,direction,0));return ray.intersectObject(shell,true)[0]?.point.y??null;};
      const hollow=hit(.4,7,z-.2,-1),underside=hit(.4,floor-1,z-.2,1),rim=hit(-1.35,7,z+.02,-1),spill=hit(0,7,z+2.91,-1);
      const support=new T.Box3().setFromObject(tier.getObjectByName('leaf-rock-support'));
      tiers.push({floor,z,hollow,underside,rim,spill,supportMin:support.min.y,waterY:floor+.245,thickness:hollow===null||underside===null?null:hollow-underside});
    }
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,900);renderer.setPixelRatio(1);renderer.setClearColor('#f7f3eb');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#f5f9ff','#a6a08c',2));const sun=new T.DirectionalLight('#fff1d9',3);sun.position.set(-12,20,18);scene.add(sun);
    const fill=new T.DirectionalLight('#dbe9ff',.6);fill.position.set(15,3,-10);scene.add(fill);
    const camera=new T.OrthographicCamera(-10,10,7.5,-7.5,.1,100);camera.position.set(18,14,24);camera.lookAt(0,1.7,4);renderer.render(scene,camera);
    window.waterTest={T,root,renderer,scene,camera,inspect};
    const gl=renderer.getContext(),pixels=[];for(const y of [200,350,500,650])for(const x of [300,450,600,750,900]){const p=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);pixels.push((p[0]+p[1]+p[2])/3);}
    const a=meshes(root),b=meshes(copy);return {...inspect(root),tiers,spacing:LEAF_CHANNEL_SPACING,shared:root!==copy&&a.length===b.length&&a.every((m,i)=>m.geometry===b[i].geometry&&m.material===b[i].material),pixelRange:Math.max(...pixels)-Math.min(...pixels)};
  });
  await page.screenshot({path:output+'/three-quarter.png'});
  assert.ok(model.finite&&model.shared&&model.meshes<=32&&model.materials<=9&&model.triangles<35000&&model.textures<=1,JSON.stringify(model));
  assert.ok(model.pixelRange>20&&model.tiers.length===3);
  for(const tier of model.tiers){
    assert.ok(tier.hollow!==null&&tier.rim!==null&&tier.underside!==null&&tier.spill!==null,'Stone shell must have outward-facing solid surfaces: '+JSON.stringify(tier));
    assert.ok(tier.rim-tier.hollow>.25&&tier.thickness>.20&&tier.thickness<.50,'Real bowl cavity and thick floor: '+JSON.stringify(tier));
    assert.ok(tier.waterY>tier.hollow+.1&&tier.waterY<tier.rim-.08&&tier.spill<tier.waterY,'Recessed water must exit through a lowered spill lip: '+JSON.stringify(tier));
    assert.ok(tier.supportMin>=-.06&&tier.supportMin<.15,'Rock/root support must meet ground');
  }
  assert.ok(model.tiers[0].waterY>model.tiers[1].waterY+.5&&model.tiers[1].waterY>model.tiers[2].waterY+.5);
  for(const [name,position,target]of [['top',[0,26,4],[0,1.5,4]],['side',[22,6,4],[0,1.5,4]],['back',[-15,13,-13],[0,1.5,4]],['waterfall',[15,1,22],[0,-4,6]]]){
    await page.evaluate(({position,target,name})=>{const s=waterTest;s.camera.left=-10;s.camera.right=10;s.camera.top=7.5;s.camera.bottom=-7.5;if(name==='waterfall'){s.camera.top=10;s.camera.bottom=-10;}s.camera.updateProjectionMatrix();s.camera.position.fromArray(position);s.camera.lookAt(...target);s.renderer.render(s.scene,s.camera);},{position,target,name});await page.screenshot({path:`${output}/${name}.png`});
  }
  const bytes=await page.evaluate(async()=>{
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const s=waterTest,buffer=await new GLTFExporter().parseAsync(s.root,{binary:true}),loaded=(await new GLTFLoader().parseAsync(buffer,'')).scene,before=s.inspect(s.root),after=s.inspect(loaded);
    if(before.triangles!==after.triangles||before.materials!==after.materials||before.min.some((n,i)=>Math.abs(n-after.min[i])>.0001)||before.size.some((n,i)=>Math.abs(n-after.size[i])>.0001))throw Error('GLB reload changed leaf channel');return Array.from(new Uint8Array(buffer));
  });await writeFile(output+'/three-tier-leaf-water-channel.glb',Buffer.from(bytes));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nconst __leafWaterInit=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await __leafWaterInit.call(this)};MazeAdventure.prototype.tick=function(){};'});});
  await page.setViewportSize({width:1280,height:800});await page.goto(base+'?level=3&lang=zh');await page.locator('.journey-skip').click();await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  const gameplay=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),g=game,root=g.scene.getObjectByName('three-tier-leaf-water-channel');
    if(!root)throw Error('Formal leaf water channel must replace the three placeholders');
    g.wand=g.treasure=true;g.enemies[0].hp=g.enemies[1].hp=0;g.invulnerable=1000;
    window.leafWaterPlace=(x,z)=>{g.body.setTranslation({x,y:.85,z},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.clearInput();g.render(0);};
    leafWaterPlace(200,-33);g.world.step();root.visible=false;g.renderer.render(g.scene,g.camera);const hidden={...g.renderer.info.render};root.visible=true;g.renderer.render(g.scene,g.camera);const shown={...g.renderer.info.render};
    const tiers=[0,1,2].map(i=>g.scene.getObjectByName('boss-blockout-water-channel-'+i).getWorldPosition(new T.Vector3()).toArray());
    const floorHits=tiers.map(([x,,z])=>{const hit=g.world.castRay({origin:{x,y:8,z},dir:{x:0,y:-1,z:0}},10,true,undefined,undefined,undefined,g.body);return hit?8-hit.timeOfImpact:null;});
    const outlet=new T.Vector3(0,1.965,2*3.465+3.04).applyMatrix4(root.matrixWorld);
    const before=[g.world.bodies.len(),g.world.colliders.len()];g.reset();const after=[g.world.bodies.len(),g.world.colliders.len()];g.wand=g.treasure=true;g.invulnerable=1000;leafWaterPlace(200,-33);
    return {position:root.getWorldPosition(new T.Vector3()).toArray(),rotation:root.rotation.y,tiers,floorHits,outlet:outlet.toArray(),before,after,hidden,shown,geometries:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures,occluders:g.buildingOccluders.filter(o=>o.object.name.startsWith('boss-blockout-water-channel-')||o.object.name==='leaf-channel-inlet').length};
  });
  assert.ok(Math.abs(gameplay.position[0]-205.7)<.001&&Math.abs(gameplay.position[2]+38.8)<.001&&gameplay.rotation===Math.PI/4);
  assert.ok(gameplay.outlet[0]>212.5,'Final spill lip must project beyond the island terrain edge');
  assert.ok(gameplay.floorHits.every((h,i)=>h>model.tiers[i].floor+.4),'Each support needs its simple collision proxy');
  assert.deepEqual(gameplay.before,gameplay.after);assert.equal(gameplay.occluders,4);assert.ok(gameplay.shown.calls-gameplay.hidden.calls>0&&gameplay.shown.calls-gameplay.hidden.calls<=32);
  const travel=await page.evaluate(()=>{
    const g=game,results=[];leafWaterPlace(165,-15);
    for(const [x,z]of [[175,-15],[200,-15],[200,-40],[175,-40],[175,-15],[165,-15]]){for(let i=0;i<900;i++){const p=g.body.translation();if(Math.hypot(x-p.x,z-p.z)<.2)break;g.keys.clear();if(Math.abs(x-p.x)>.1)g.keys.add(x>p.x?'KeyD':'KeyA');if(Math.abs(z-p.z)>.1)g.keys.add(z>p.z?'KeyS':'KeyW');g.step();}g.clearInput();const p=g.body.translation();results.push({distance:Math.hypot(x-p.x,z-p.z),y:p.y});}
    leafWaterPlace(200,-38.8);g.keys.add('KeyD');for(let i=0;i<150;i++)g.step();g.clearInput();const stop={...g.body.translation()};leafWaterPlace(200,-33);return {routes:results,stop};
  });
  assert.ok(travel.routes.every(r=>r.distance<.35&&r.y>.6),'Basin supports must preserve dock and perimeter travel: '+JSON.stringify(travel));
  assert.ok(travel.stop.x>203&&travel.stop.x<204.1&&travel.stop.y>.6,'Upper support collision must stop the player: '+JSON.stringify(travel.stop));
  await page.screenshot({path:output+'/gameplay-desktop.png'});
  await page.evaluate(()=>{const g=game;g.scene.fog=null;g.camera.position.set(225,13,-16);g.camera.lookAt(209,-1,-34);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);});await page.screenshot({path:output+'/scene-closeup.png'});
  await page.evaluate(()=>{const g=game;g.camera.position.set(229,0,-19);g.camera.lookAt(211,-5,-33);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);});await page.screenshot({path:output+'/cliff-outlet.png'});
  for(const [width,height]of [[390,844],[844,390]]){await page.setViewportSize({width,height});await page.evaluate(()=>{game.resize();leafWaterPlace(200,-33);});await page.screenshot({path:`${output}/gameplay-${width}.png`});
    await page.evaluate(()=>{const g=game;g.camera.position.set(223,12,-18);g.camera.lookAt(209,1.5,-35);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);});await page.screenshot({path:`${output}/channel-closeup-${width}.png`});}
  assert.deepEqual(errors,[]);await writeFile(output+'/metrics.json',JSON.stringify({pass:true,model,glbBytes:bytes.length,gameplay,travel,errors},null,2));
  console.log('PASS hollow leaf basins, real spillway depths, solid floors, tier heights, GLB roundtrip, cliff outlet, collision, traversal, reset and mobile views',JSON.stringify({model,glbBytes:bytes.length,gameplay,travel}));
}finally{await browser.close();}
