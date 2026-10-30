import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { advanceGarden, nearGarden, collectGardenTool, plantGarden } from './garden-quest-helpers.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const output = 'test-results/painterly-grass', errors = [];
try {
  await mkdir(output, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' });
  page.setDefaultTimeout(90000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/, r => r.fulfill({ contentType: 'text/javascript', body: 'export function startJourney(){return {arrive:async()=>{},dispose(){}}}' }));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + '\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await init.call(this)};MazeAdventure.prototype.tick=function(){};' });
  });
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5230/') + '?level=3&lang=zh');
  await page.locator('.game-loading').waitFor({ state: 'detached' }); await page.locator('#primary').click();
  const state = await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js'), R = (await import('/node_modules/.vite/deps/@dimforge_rapier3d-compat.js')).default, g = game;
    const { meadowCoverageAt } = await import('/src/meadow-layout.ts');
    for(let z=27.5;z<=52.5;z+=1)for(let x=27.5;x<=47.5;x+=1)if(meadowCoverageAt(x,z)!==0)throw Error('Keep the entire first encounter courtyard free of grass: '+[x,z]);
    for(const [x,z] of [[-10,50],[-30,25],[55,8],[-32,37],[-38.9,47.95],[25,0],[187.5,-25]]) if(meadowCoverageAt(x,z)!==0)throw Error('Keep routes, clues and combat clear: '+[x,z]);
    for(const [x,z] of [[-20,45],[10,49],[-45,8],[53.2,7],[171,-23]])if(meadowCoverageAt(x,z)<.9)throw Error('Natural land needs full cover: '+[x,z]);
    for (let i = 0; i < 60; i++) g.step();
    const meshes = g.meadow.root.children.flatMap(region => region.children);
    const roots = [], buried = [], unsupported = [], paving = [], regions = {}; let triangles = 0, finite = true;
    for (const m of meshes) {
      const a = m.geometry.attributes.aRoot, seed = m.geometry.attributes.seed;
      regions[m.parent.name] = (regions[m.parent.name] || 0) + a.count;
      finite &&= a.count === seed.count && Array.from(a.array).every(Number.isFinite) && Array.from(seed.array).every(Number.isFinite);
      triangles += m.geometry.instanceCount * m.geometry.index.count / 3;
      for (let i = 0; i < a.count; i++) {
        const x = a.getX(i), z = a.getY(i); roots.push([x,z]);
        if (meadowCoverageAt(x,z)===0) paving.push([x,z]);
        if (g.walls.some(w => w.bounds.containsPoint(new T.Vector3(x,.1,z)))) buried.push([x,z]);
        const hit = g.world.castRay(new R.Ray({x,y:1.5,z},{x:0,y:-1,z:0}),2,true,undefined,undefined,undefined,g.body);
        const floor = hit ? 1.5-hit.timeOfImpact : null;
        if (floor === null || floor < -.1 || floor > .15) unsupported.push({x,z,floor});
      }
    }
    const buckets=new Map();
    for(const [x,z] of roots){const key=`${Math.floor(x)},${Math.floor(z)}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push([x,z]);}
    let covered=0,eligible=0;
    for(let z=-50;z<60;z++)for(let x=-50;x<210;x++){
      if(meadowCoverageAt(x+.5,z+.5)<.9)continue;
      const ray=new R.Ray({x:x+.5,y:6,z:z+.5},{x:0,y:-1,z:0}),hit=g.world.castRay(ray,6.1,true,undefined,undefined,undefined,g.body);
      if(!hit||6-hit.timeOfImpact>.15)continue;
      eligible++;
      if((buckets.get(`${x},${z}`)||[]).some(([rx,rz])=>Math.hypot(rx-x-.5,rz-z-.5)<.65))covered++;
    }
    const mat = meshes.find(m=>m.parent.visible).material, before = mat.uniforms.uTime.value;
    g.render(.5); const animated = mat.uniforms.uTime.value; g.paused = true; g.render(1); const paused = mat.uniforms.uTime.value;
    g.paused = false; g.reducedMotion = true; g.render(.5); const reduced = mat.uniforms.uTime.value; g.render(2); const reducedAgain = mat.uniforms.uTime.value;
    g.reducedMotion = false;
    const memory = {...g.renderer.info.memory}, bodies = [g.world.bodies.len(),g.world.colliders.len()]; g.reset(); g.render(0);
    const resetMemory = {...g.renderer.info.memory}, resetBodies = [g.world.bodies.len(),g.world.colliders.len()];
    window.grassFocus = kind => {
      const p = { plaza:[-10,.8,50], well:[-40,.8,8], ruins:[35,.8,44], bends:[55,.8,8], dock:[90,.8,-10], boss:[187.5,.8,-27] }[kind];
      g.body.setTranslation({x:p[0],y:p[1],z:p[2]},true); g.previous.copy(g.body.translation()); g.resize(); g.render(0);
    };
    window.grassCloseup = () => { g.camera.position.set(-17,2.1,54); g.camera.lookAt(-20.5,.2,49); g.camera.updateMatrixWorld(); g.renderer.render(g.scene,g.camera); };
    grassFocus('plaza');
    const pixels = () => {const gl=g.renderer.getContext(),p=new Uint8Array(g.renderer.domElement.width*g.renderer.domElement.height*4);gl.readPixels(0,0,g.renderer.domElement.width,g.renderer.domElement.height,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
    g.meadow.root.visible=false; g.renderer.render(g.scene,g.camera); const hidden={...g.renderer.info.render}, a=pixels();
    g.meadow.root.visible=true; g.renderer.render(g.scene,g.camera); const shown={...g.renderer.info.render}, b=pixels();
    let changed=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>12)changed++;
    g.meadow.update(0,false,g.camera.position);grassCloseup();const still=pixels();g.meadow.update(2.1,false,g.camera.position);grassCloseup();const wind=pixels();
    let windPixels=0;for(let i=0;i<still.length;i+=4)if(Math.abs(still[i]-wind[i])+Math.abs(still[i+1]-wind[i+1])+Math.abs(still[i+2]-wind[i+2])>12)windPixels++;
    const gl=g.renderer.getContext(),timings={};
    for(const visible of [false,true]){g.meadow.root.visible=visible;g.renderer.render(g.scene,g.camera);gl.finish();const start=performance.now();for(let i=0;i<5;i++){g.renderer.render(g.scene,g.camera);gl.finish();}timings[visible?'grass':'bare']=(performance.now()-start)/5;}
    g.meadow.root.visible=true;grassCloseup();
    return { meshes:meshes.length,regions,instances:roots.length,triangles,finite,buried,unsupported,paving,covered,eligible,timings,before,animated,paused,reduced,reducedAgain,memory,resetMemory,bodies,resetBodies,hidden,shown,changed,windPixels };
  });
  await writeFile(output+'/metrics.json',JSON.stringify(state,null,2));
  await page.evaluate(()=>grassFocus('plaza'));await page.screenshot({path:output+'/continuous-plaza.png'});
  assert.ok(state.meshes>80&&state.meshes<300); assert.ok(state.instances>20000&&state.triangles<800000&&state.finite);
  assert.ok(state.eligible>1000&&state.covered/state.eligible>.98,'Meadow must continuously cover eligible land: '+JSON.stringify({covered:state.covered,eligible:state.eligible}));
  assert.deepEqual(state.paving,[],'Expanded planting must leave the oak paving and combat center clear');
  assert.deepEqual(state.buried,[],'Grass roots must remain outside the hedges');
  assert.ok(state.unsupported.length===0,'Grass roots must sit on ground rather than props or water: '+JSON.stringify(state.unsupported.slice(0,8)));
  assert.ok(state.animated>state.before); assert.equal(state.paused,state.animated); assert.equal(state.reduced,0); assert.equal(state.reducedAgain,0);
  assert.deepEqual(state.resetBodies,state.bodies); assert.deepEqual(state.resetMemory,state.memory);
  assert.ok(state.shown.calls-state.hidden.calls<100&&state.changed>15000&&state.windPixels>150,JSON.stringify({calls:state.shown.calls-state.hidden.calls,changed:state.changed,windPixels:state.windPixels}));
  await page.screenshot({path:output+'/grass-closeup.png'});
  for(const kind of ['plaza','well','ruins','bends','dock','boss']) { await page.evaluate(kind=>grassFocus(kind),kind); await page.screenshot({path:`${output}/${kind}-desktop.png`}); }
  await page.setViewportSize({width:390,height:844}); await page.evaluate(()=>{grassFocus('plaza');grassCloseup();}); await page.screenshot({path:output+'/grass-mobile.png'});
  await page.evaluate(()=>grassFocus('plaza'));await page.screenshot({path:output+'/gameplay-mobile.png'});
  await page.setViewportSize({width:1280,height:800});
  await page.evaluate(()=>{game.reset();game.reducedMotion=true;});
  await nearGarden(page,'gardener');await page.keyboard.press('KeyE');
  for(let i=0;i<4;i++){await advanceGarden(page,1.8);await page.locator('#maze-next').click();}await advanceGarden(page,3.2);
  await collectGardenTool(page);await plantGarden(page);
  assert.ok(await page.evaluate(()=>game.wand&&game.gardenQuest.stage==='grown'),'Full meadow must preserve cart, trowel and planting progression');
  await page.screenshot({path:output+'/garden-quest-complete.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS continuous meadow coverage, grounded placement, GPU wind, pause/reduced motion, reset, bounded draws, desktop/mobile and garden quest',JSON.stringify({tiles:Object.keys(state.regions).length,coverage:state.covered/state.eligible,instances:state.instances,triangles:state.triangles,draws:state.shown.calls-state.hidden.calls,pixels:state.changed,windPixels:state.windPixels,timings:state.timings}));
} finally { await browser.close(); }
