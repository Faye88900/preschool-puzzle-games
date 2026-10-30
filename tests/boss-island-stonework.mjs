import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='artifacts/models/boss-island-stonework',errors=[];
const base=process.env.TEST_URL||'http://127.0.0.1:4399/';
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1200,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('**/__boss-stonework',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto(base+'__boss-stonework');
  const model=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),{createBossIslandStonework,createRuinedWallModule}=await import('/src/boss-island-stonework.ts');
    const {root,occluders}=createBossIslandStonework(),copy=createBossIslandStonework().root,scene=new T.Scene(),kit=new T.Group();kit.name='ruined-wall-modular-kit';
    const meshes=object=>{const list=[];object.traverse(m=>{if(m.isMesh)list.push(m);});return list;};
    const inspect=object=>{
      const list=meshes(object),materials=new Set(),textures=new Set();let triangles=0,finite=true;
      for(const m of list){triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;finite&&=Array.from(m.geometry.attributes.position.array).every(Number.isFinite)&&Array.from(m.geometry.attributes.normal.array).every(Number.isFinite);
        for(const mat of Array.isArray(m.material)?m.material:[m.material]){materials.add(mat);for(const v of Object.values(mat))if(v?.isTexture)textures.add(v);}}
      const box=new T.Box3().setFromObject(object);return {meshes:list.length,materials:materials.size,textures:textures.size,triangles,finite,min:box.min.toArray(),size:box.getSize(new T.Vector3()).toArray()};
    };
    const shared=(a,b)=>{const x=meshes(a),y=meshes(b);return a!==b&&x.length===y.length&&x.every((m,i)=>m.geometry===y[i].geometry&&m.material===y[i].material);};
    const kinds=['straight','curved','corner','pier','breach','rubble'],modules=[];
    for(const [i,kind]of kinds.entries()){
      const object=createRuinedWallModule(kind),copy=createRuinedWallModule(kind),stats=inspect(object),ray=new T.Raycaster();object.updateMatrixWorld(true);
      const center=new T.Box3().setFromObject(object).getCenter(new T.Vector3()),surface=[];
      // Offset from the module center so the sample does not fall in a masonry joint.
      for(const side of [-1,1]){ray.set(new T.Vector3(center.x+.25,.25,center.z+side*10),new T.Vector3(0,0,-side));const hit=ray.intersectObject(object,true)[0];surface.push(hit?.point.z??null);}
      object.position.set((i%3-1)*8,0,Math.floor(i/3)*7-3.5);kit.add(object);
      modules.push({kind,...stats,shared:shared(object,copy),surface});
    }
    root.updateMatrixWorld(true);const cliff=root.getObjectByName('boss-island-cliffs'),top=new T.Box3(),bottom=new T.Box3(),point=new T.Vector3();let centralAbove=0;
    cliff.traverse(m=>{if(!m.isMesh)return;const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){
      point.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld).sub(root.position);
      if(point.y>-3)top.expandByPoint(point);if(point.y<-17)bottom.expandByPoint(point);
      if(point.y>.001&&Math.hypot(point.x,point.z)<15)centralAbove++;
    }});
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,900);renderer.setPixelRatio(1);renderer.setClearColor('#f7f3eb');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#f4f8ff','#a6a08c',2));const sun=new T.DirectionalLight('#fff1d9',3);sun.position.set(-20,35,25);scene.add(sun);
    const fill=new T.DirectionalLight('#dbe9ff',.7);fill.position.set(20,0,-30);scene.add(fill);
    const camera=new T.OrthographicCamera(-38,38,28.5,-28.5,.1,200);camera.position.set(55,30,65);camera.lookAt(0,-6,0);
    const centered=root.clone(true);centered.position.set(0,0,0);scene.add(centered);renderer.render(scene,camera);
    const gl=renderer.getContext(),pixels=[];for(const y of [250,400,550])for(const x of [300,450,600,750,900]){const p=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);pixels.push((p[0]+p[1]+p[2])/3);}
    window.stoneTest={T,root,centered,kit,renderer,scene,camera,inspect};
    return {...inspect(root),shared:shared(root,copy),position:root.position.toArray(),occluders:occluders.map(o=>o.name),modules,
      cliff:inspect(cliff),topWidth:top.getSize(new T.Vector3()).x,bottomWidth:bottom.getSize(new T.Vector3()).x,centralAbove,pixels};
  });
  assert.ok(model.finite&&model.shared&&model.meshes<=35&&model.triangles<100000&&model.textures<=2,JSON.stringify(model));
  assert.deepEqual(model.position,[152.5,0,-25]);
  assert.ok(model.cliff.min[1]<-18&&model.topWidth>model.bottomWidth*1.2&&model.centralAbove===0,'Floating rock must taper below the arena without intruding above the central floor');
  for(let i=0;i<5;i++)assert.ok(model.occluders.includes('boss-ruined-wall-'+i),'Every perimeter wall must support occlusion');
  assert.ok(model.modules.every(m=>m.finite&&m.shared&&Math.abs(m.min[1])<.08&&m.size[2]>.35),'Modules must be grounded, solid and share resources');
  for(const kind of ['straight','pier']){const m=model.modules.find(m=>m.kind===kind);assert.ok(m.surface.every(v=>v!==null)&&m.surface[1]-m.surface[0]>.35,'Opaque wall faces must point outward and retain physical front/back depth: '+JSON.stringify(m));}
  const pier=model.modules.find(m=>m.kind==='pier'),rubble=model.modules.find(m=>m.kind==='rubble');
  assert.ok(pier.size[1]>rubble.size[1]*1.4&&new Set(model.modules.map(m=>m.size.map(n=>n.toFixed(2)).join(','))).size>=4,'Wall kit must contain distinct silhouettes');
  assert.ok(Math.max(...model.pixels)-Math.min(...model.pixels)>20,'Stonework preview must not be blank');
  await page.screenshot({path:output+'/stonework-three-quarter.png'});
  for(const [name,position]of [['front',[0,10,85]],['side',[85,10,0]],['below',[35,-30,45]]]){
    await page.evaluate(position=>{const s=stoneTest;s.camera.position.fromArray(position);s.camera.lookAt(0,-7,0);s.renderer.render(s.scene,s.camera);},position);
    await page.screenshot({path:`${output}/stonework-${name}.png`});
  }
  await page.evaluate(()=>{const s=stoneTest;s.centered.visible=false;s.scene.add(s.kit);s.camera.left=-17;s.camera.right=17;s.camera.top=12.75;s.camera.bottom=-12.75;s.camera.updateProjectionMatrix();s.camera.position.set(20,18,25);s.camera.lookAt(0,0,0);s.renderer.render(s.scene,s.camera);});
  await page.screenshot({path:output+'/modular-kit.png'});
  for(const which of ['root','kit']){
    const bytes=await page.evaluate(async which=>{
      const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
      const s=stoneTest,object=s[which],buffer=await new GLTFExporter().parseAsync(object,{binary:true}),loaded=(await new GLTFLoader().parseAsync(buffer,'')).scene;
      const before=s.inspect(object),after=s.inspect(loaded);
      if(before.triangles!==after.triangles||before.min.some((n,i)=>Math.abs(n-after.min[i])>.0001)||before.size.some((n,i)=>Math.abs(n-after.size[i])>.0001))throw Error('GLB reload changed '+which);
      return Array.from(new Uint8Array(buffer));
    },which);
    await writeFile(`${output}/${which==='root'?'boss-island-stonework':'ruined-wall-modular-kit'}.glb`,Buffer.from(bytes));
  }
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nconst __stoneInit=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await __stoneInit.call(this)};MazeAdventure.prototype.tick=function(){};'});});
  await page.setViewportSize({width:1280,height:800});await page.goto(base+'?level=3&lang=zh');await page.locator('.journey-skip').click();await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  const gameplay=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),g=game,root=g.scene.getObjectByName('boss-island-stonework');
    if(!root||!root.getObjectByName('boss-island-cliffs'))throw Error('Formal stonework must replace the old island supports');
    g.wand=g.treasure=true;g.enemies[0].hp=g.enemies[1].hp=0;g.invulnerable=1000;
    window.stonePlace=(x,z)=>{g.body.setTranslation({x,y:.85,z},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.clearInput();g.render(0);};
    stonePlace(g.enemies[2].home.x,g.enemies[2].home.z+6);g.world.step();
    root.visible=false;g.renderer.render(g.scene,g.camera);const hidden={...g.renderer.info.render};root.visible=true;g.renderer.render(g.scene,g.camera);const shown={...g.renderer.info.render};
    const floors=[];for(let x=176;x<=198;x+=2)for(let z=-36;z<=-14;z+=2){if(Math.hypot(x-187.5,z+25)>12)continue;const hit=g.world.castRay({origin:{x,y:6,z},dir:{x:0,y:-1,z:0}},8,true,undefined,undefined,undefined,g.body);floors.push(hit?6-hit.timeOfImpact:null);}
    return {position:root.getWorldPosition(new T.Vector3()).toArray(),hidden,shown,floors,occluders:g.buildingOccluders.filter(o=>o.object.name.startsWith('boss-ruined-wall-')).length,geometries:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures};
  });
  assert.deepEqual(gameplay.position,[187.5,0,-25]);assert.equal(gameplay.occluders,5);assert.ok(gameplay.shown.calls>gameplay.hidden.calls&&gameplay.shown.calls-gameplay.hidden.calls<=35);
  assert.ok(gameplay.floors.length>70&&gameplay.floors.every(y=>y!==null&&Math.abs(y)<.03),'Stonework must not alter central battle floors');
  await page.screenshot({path:output+'/gameplay-desktop.png'});
  await page.evaluate(()=>{const g=game;g.scene.fog=null;g.camera.position.set(220,57,34);g.camera.lookAt(184,-3,-24);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);});await page.screenshot({path:output+'/island-overview.png'});
  for(const [width,height]of [[390,844],[844,390]]){await page.setViewportSize({width,height});await page.evaluate(()=>{game.resize();stonePlace(game.enemies[2].home.x,game.enemies[2].home.z+6);});await page.screenshot({path:`${output}/gameplay-${width}.png`});}
  assert.deepEqual(errors,[]);await writeFile(output+'/metrics.json',JSON.stringify({pass:true,model,gameplay,errors},null,2));
  console.log('PASS island stonework geometry, tapered floating cliffs, grounded modular kit, shared resources, GLB roundtrips, runtime replacement and desktop/mobile views',JSON.stringify({model,gameplay}));
}finally{await browser.close();}
