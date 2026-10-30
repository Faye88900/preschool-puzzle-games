import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='artifacts/models/leaf-channel-water',errors=[];
const base=process.env.TEST_URL||'http://127.0.0.1:4399/';
try {
  await mkdir(output,{recursive:true});const page=await browser.newPage({viewport:{width:1200,height:900}});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('**/__leaf-water-effects',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto(base+'__leaf-water-effects');
  await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),{createLeafWaterChannel}=await import('/src/leaf-water-channel.ts'),{createLeafChannelWater}=await import('/src/leaf-channel-water.ts');
    const root=createLeafWaterChannel(),scene=new T.Scene();scene.add(root);const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,900);renderer.setPixelRatio(1);renderer.setClearColor('#f7f3eb');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#f5f9ff','#a6a08c',2));const sun=new T.DirectionalLight('#fff1d9',3);sun.position.set(-12,20,18);scene.add(sun);
    const camera=new T.OrthographicCamera(-8,8,6,-6,.1,100);camera.position.set(15,17,23);camera.lookAt(0,1.5,4.1);renderer.render(scene,camera);
    window.waterFX={T,root,scene,renderer,camera,createLeafChannelWater};
  });await page.screenshot({path:output+'/before.png'});
  const model=await page.evaluate(()=>{
    const s=waterFX;s.effect=s.createLeafChannelWater(s.root);
    // Match the existing per-occluder private material clones before starting the clock.
    const copies=new Map();s.root.traverse(m=>{if(m.isMesh){if(!copies.has(m.material))copies.set(m.material,m.material.clone());m.material=copies.get(m.material);}});
    s.draw=(time,reduced=false)=>{s.effect.update(time,reduced);s.renderer.render(s.scene,s.camera);};
    s.read=()=>{const p=new Uint8Array(1200*900*4);s.renderer.getContext().readPixels(0,0,1200,900,s.renderer.getContext().RGBA,s.renderer.getContext().UNSIGNED_BYTE,p);return p;};
    const compare=(a,b)=>{let total=0,changed=0;for(let i=0;i<a.length;i+=4){const d=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);total+=d;if(d>9)changed++;}return {mean:total/(a.length/4*3),changed};};
    s.draw(0);const first=s.read();s.draw(1.17);const second=s.read();s.draw(1.17);const repeat=s.read();s.draw(2,true);const reduced=s.read();s.draw(8,true);const reducedAgain=s.read();
    let meshes=0,triangles=0,finite=true;const materials=new Set(),textures=new Set(),shaders=[];
    s.root.traverse(m=>{if(m.isMesh){meshes++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;finite&&=Array.from(m.geometry.attributes.position.array).every(Number.isFinite);}if(m.isMesh||m.isPoints){materials.add(m.material);if(m.material.uniforms?.uFlow)textures.add(m.material.uniforms.uFlow.value);if(m.material.isShaderMaterial)shaders.push({name:m.material.name,time:m.material.uniforms.uTime.value,fade:m.material.uniforms.uFade.value});}});
    const surface=s.root.getObjectByName('leaf-water-ripple-surface').material;surface.opacity=.16;s.draw(.7);
    const sprayFade=s.root.getObjectByName('leaf-water-impact-spray').material.uniforms.uFade.value;surface.opacity=1;s.draw(.7);
    const cloud=s.root.getObjectByName('leaf-water-local-cloud-sea'),centers=cloud.geometry.attributes.aCenter,sizes=cloud.geometry.attributes.aSize;
    const cloudTop=Math.max(...Array.from({length:centers.count},(_,i)=>centers.getY(i)+sizes.getY(i)/2));
    const curtain=s.root.getObjectByName('leaf-water-turbulent-cascades');curtain.geometry.computeBoundingBox();
    return {animation:compare(first,second),deterministic:compare(second,repeat),reduced:compare(reduced,reducedAgain),sprayFade,cloudQuads:centers.count/4,cloudTop,waterfallBottom:curtain.geometry.boundingBox.min.y,meshes,triangles,finite,materials:materials.size,textures:textures.size,shaders,render:{...s.renderer.info.render}};
  });
  await page.screenshot({path:output+'/after.png'});
  assert.ok(model.finite&&model.triangles<30000&&model.meshes<30&&model.textures===1,JSON.stringify(model));
  assert.ok(model.animation.changed>100&&model.animation.mean>.03,'Flowing water must visibly animate in canvas pixels: '+JSON.stringify(model));
  assert.equal(model.deterministic.changed,0,'Same-time water rendering must be deterministic');assert.equal(model.reduced.changed,0,'Reduced motion must freeze both waves and spray');assert.ok(model.shaders.length===6&&model.shaders.every(m=>m.time===0));
  assert.ok(model.cloudQuads===12&&model.cloudTop < -17&&model.waterfallBottom < -27,'Local clouds and waterfall must extend below the island');
  assert.equal(model.sprayFade,.16,'Spray must follow the occluded basin fade');
  await page.evaluate(()=>{const s=waterFX;s.camera.left=-3.4;s.camera.right=3.4;s.camera.top=2.55;s.camera.bottom=-2.55;s.camera.updateProjectionMatrix();s.camera.position.set(4,7,6);s.camera.lookAt(0,3.1,.7);s.draw(.7);});await page.screenshot({path:output+'/basin-closeup.png'});
  await page.evaluate(()=>{const s=waterFX;s.camera.left=-6;s.camera.right=6;s.camera.top=4.5;s.camera.bottom=-4.5;s.camera.updateProjectionMatrix();s.camera.position.set(10,0,18);s.camera.lookAt(0,-3,10);s.draw(.7);});await page.screenshot({path:output+'/waterfall-closeup.png'});
  await page.evaluate(()=>{const s=waterFX;s.camera.left=-22;s.camera.right=22;s.camera.top=16.5;s.camera.bottom=-16.5;s.camera.updateProjectionMatrix();s.camera.position.set(27,1,38);s.camera.lookAt(0,-11,10);s.draw(.7);});await page.screenshot({path:output+'/cloud-sea-overview.png'});
  const cloudMotion=await page.evaluate(()=>{const s=waterFX,cloud=s.root.getObjectByName('leaf-water-local-cloud-sea');s.root.children.forEach(m=>{if(m!==cloud)m.visible=false;});s.renderer.setClearColor('#bce3fa');s.camera.left=-12;s.camera.right=12;s.camera.top=9;s.camera.bottom=-9;s.camera.updateProjectionMatrix();s.camera.position.set(27,-10,38);s.camera.lookAt(0,-24,15);s.draw(.7);const a=s.read();s.draw(30.7);const b=s.read();s.draw(2,true);const c=s.read();s.draw(8,true);const d=s.read();let changed=0,reducedChanged=0;for(let i=0;i<a.length;i+=4){if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>9)changed++;if(c[i]!==d[i]||c[i+1]!==d[i+1]||c[i+2]!==d[i+2])reducedChanged++;}s.root.children.forEach(m=>m.visible=true);s.renderer.setClearColor('#f7f3eb');s.draw(.7);return{changed,reducedChanged};});
  assert.ok(cloudMotion.changed>100,'Local clouds must visibly drift: '+JSON.stringify(cloudMotion));assert.equal(cloudMotion.reducedChanged,0,'Reduced motion freezes cloud drift');
  const video=await page.evaluate(async()=>{
    const s=waterFX;s.camera.left=-22;s.camera.right=22;s.camera.top=16.5;s.camera.bottom=-16.5;s.camera.updateProjectionMatrix();s.camera.position.set(27,1,38);s.camera.lookAt(0,-11,10);
    const stream=s.renderer.domElement.captureStream(24),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:1500000}),chunks=[];
    return await new Promise(resolve=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());resolve(Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer())));};
      recorder.start();const start=performance.now();const frame=now=>{s.draw((now-start)/1000+.7);if(now-start<3200)requestAnimationFrame(frame);else recorder.stop();};requestAnimationFrame(frame);});
  });await writeFile(output+'/water-motion.webm',Buffer.from(video));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nconst __waterFxInit=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await __waterFxInit.call(this)};MazeAdventure.prototype.tick=function(){};'});});
  await page.setViewportSize({width:1280,height:800});await page.goto(base+'?level=3&lang=zh');await page.locator('.journey-skip').click();await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  const gameplay=await page.evaluate(()=>{
    const g=game;g.wand=g.treasure=true;g.enemies[0].hp=g.enemies[1].hp=0;g.invulnerable=1000;
    window.waterFxPlace=()=>{g.body.setTranslation({x:200,y:.85,z:-33},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.clearInput();g.render(0);};waterFxPlace();
    const root=g.scene.getObjectByName('three-tier-leaf-water-channel'),shaderTimes=()=>{const times=[];root.traverse(m=>{if(m.isMesh&&m.material.uniforms?.uTime)times.push(m.material.uniforms.uTime.value);});return times;};
    const before=g.ferryCoast.time.value;g.render(.3);const animated=shaderTimes();g.paused=true;const pausedTime=g.ferryCoast.time.value;g.render(.6);const paused=shaderTimes();g.paused=false;
    g.reducedMotion=true;g.render(.6);const reduced=shaderTimes();g.reducedMotion=false;g.render(.2);
    const shown={...g.renderer.info.render};root.visible=false;g.renderer.render(g.scene,g.camera);const hidden={...g.renderer.info.render};root.visible=true;
    const bodies=[g.world.bodies.len(),g.world.colliders.len()];g.reset();const reset=[g.world.bodies.len(),g.world.colliders.len()];g.wand=g.treasure=true;g.invulnerable=1000;waterFxPlace();g.scene.fog=null;
    window.waterFxFocus=()=>{g.camera.position.set(225,13,-16);g.camera.lookAt(209,-1,-34);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);};waterFxFocus();
    return {before,animated,pausedTime,paused,reduced,bodies,reset,shown,hidden,geometries:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures};
  });
  assert.ok(gameplay.animated.length===5&&gameplay.animated.every(t=>Math.abs(t-gameplay.before-.3)<.001),'Occlusion material clones must receive water time');
  assert.ok(gameplay.paused.every(t=>t===gameplay.pausedTime)&&gameplay.reduced.every(t=>t===0));assert.deepEqual(gameplay.bodies,gameplay.reset);
  await page.screenshot({path:output+'/scene-closeup.png'});
  await page.evaluate(()=>{game.camera.position.set(244,10,-2);game.camera.lookAt(213,-10,-32);game.camera.updateMatrixWorld();game.renderer.render(game.scene,game.camera);});await page.screenshot({path:output+'/cloud-sea-scene.png'});
  for(const [width,height]of [[390,844],[844,390]]){await page.setViewportSize({width,height});await page.evaluate(()=>{game.resize();waterFxPlace();game.camera.position.set(223,12,-18);game.camera.lookAt(209,1.5,-35);game.camera.updateMatrixWorld();game.renderer.render(game.scene,game.camera);});await page.screenshot({path:`${output}/water-closeup-${width}.png`});}
  assert.deepEqual(errors,[]);await writeFile(output+'/metrics.json',JSON.stringify({pass:true,model,cloudMotion,gameplay,errors},null,2));
  console.log('PASS dynamic leaf water pixels, deterministic time, reduced motion, shader clones, pause, stable physics, desktop/mobile and no shader errors',JSON.stringify({model,gameplay}));
}finally{await browser.close();}
