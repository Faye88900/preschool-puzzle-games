import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const output = 'artifacts/models/treasure-v2', errors = [], captures = [];
const base = process.env.TEST_URL || 'http://127.0.0.1:5211/';
try {
  await mkdir(output, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
  page.setDefaultTimeout(90000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.route('**/__treasure-models', r => r.fulfill({ contentType: 'text/html', body: '<body style="margin:0"></body>' }));
  await page.goto(base + '__treasure-models');
  const model = await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js');
    const { createTreasureChest, animateTreasureChest } = await import('/src/treasure-chest.ts');
    const { createSailCrystal } = await import('/src/sail-crystal.ts');
    const { GLTFExporter } = await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    window.T = T; window.animateTreasureChest = animateTreasureChest;
    const chest = createTreasureChest(), crystal = createSailCrystal();
    const stats = root => {
      let meshes = 0, triangles = 0, finite = true;
      root.traverse(m => {
        if (!m.isMesh) return;
        meshes++; triangles += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3;
        for (const a of Object.values(m.geometry.attributes)) finite &&= Array.from(a.array).every(Number.isFinite);
      });
      return { meshes, triangles, finite, bounds: new T.Box3().setFromObject(root).getSize(new T.Vector3()).toArray() };
    };
    const metrics = { chest: stats(chest), crystal: stats(crystal) };
    const exporter = new GLTFExporter(), loader = new GLTFLoader();
    const standalone = createTreasureChest();
    standalone.remove(standalone.getObjectByName('chest-crystal'), standalone.getObjectByName('chest-reward-glow'));
    const q = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), 1.9).toArray();
    const clips = [new T.AnimationClip('Open', 1, [new T.QuaternionKeyframeTrack('lid.quaternion', [0, 1], [0, 0, 0, 1, ...q])]),
      new T.AnimationClip('Close', 1, [new T.QuaternionKeyframeTrack('lid.quaternion', [0, 1], [...q, 0, 0, 0, 1])])];
    const files = {};
    for (const [name, root] of [['treasure-chest', standalone], ['sail-crystal', crystal]]) {
      const buffer = await exporter.parseAsync(root, { binary: true, animations: name === 'treasure-chest' ? clips : [] });
      const loaded = await loader.parseAsync(buffer, '');
      files[name] = Array.from(new Uint8Array(buffer));
      const bounds = new T.Box3().setFromObject(loaded.scene).getSize(new T.Vector3());
      if (!Number.isFinite(bounds.x) || bounds.y < .1) throw new Error('Invalid GLB roundtrip');
      if (name === 'treasure-chest' && loaded.animations.length !== 2) throw new Error('Missing lid animation');
    }
    const scene = new T.Scene(); scene.background = new T.Color('#edf1e6');
    scene.add(new T.HemisphereLight('#edfcff', '#a0a48b', 2));
    const key = new T.DirectionalLight('#fff1db', 3); key.position.set(-3, 6, -4); scene.add(key);
    const fill = new T.DirectionalLight('#c8e9ff', 1.3); fill.position.set(3, 3, 4); scene.add(fill);
    const floor = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshStandardMaterial({color:'#dce2cf',roughness:.9}));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.012; scene.add(floor);
    chest.position.x = -1.3; crystal.position.set(1.3, .16, 0); scene.add(chest, crystal);
    const camera = new T.PerspectiveCamera(33, 1.6, .1, 100); camera.position.set(3.6, 3.4, -8.4); camera.lookAt(0, 1, 0);
    const renderer = new T.WebGLRenderer({antialias:true}); renderer.setSize(1280, 800);
    renderer.toneMapping = T.ACESFilmicToneMapping; document.body.append(renderer.domElement);
    window.studio = {chest, crystal, scene, camera, renderer}; renderer.render(scene,camera);
    return {metrics, files};
  });
  assert.ok(model.metrics.chest.finite && model.metrics.crystal.finite);
  assert.ok(model.metrics.chest.meshes <= 19 && model.metrics.chest.triangles < 60000, JSON.stringify(model.metrics));
  assert.equal(model.metrics.crystal.meshes, 4);
  for (const [name, data] of Object.entries(model.files)) await writeFile(`${output}/${name}.glb`, Buffer.from(data));
  await page.screenshot({path:`${output}/models-closed.png`});
  await page.evaluate(() => { animateTreasureChest(studio.chest,1,false,0,true); studio.renderer.render(studio.scene,studio.camera); });
  await page.screenshot({path:`${output}/models-open.png`});
  for (const asset of ['chest','crystal']) for (const view of ['front','side','back']) {
    await page.evaluate(({asset,view})=>{
      const s=studio; s.chest.visible=asset==='chest';s.crystal.visible=asset==='crystal';
      s[asset].position.set(0,0,0);animateTreasureChest(s.chest,0,false,0,true);
      const camera=new T.OrthographicCamera(-2.4,2.4,2.4/1.6,-2.4/1.6,.1,20);
      camera.position.set(view==='side'?8:0,1,view==='front'?-8:view==='back'?8:0);camera.lookAt(0,1,0);
      s.renderer.render(s.scene,camera);
    },{asset,view});
    await page.screenshot({path:`${output}/${asset}-${view}.png`});
  }
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/, r => r.fulfill({ contentType:'text/javascript', body:'export function startJourney(){return {arrive:async()=>{},dispose(){}}}' }));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async r => {
    const response = await r.fetch();
    await r.fulfill({response, body:await response.text()+'\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;return init.call(this)};MazeAdventure.prototype.tick=function(){};'});
  });
  await page.goto(base+'?level=3&lang=zh');
  await page.locator('.game-loading').waitFor({state:'detached'}); await page.locator('#primary').click();
  await page.evaluate(async () => {
    const g = game, {at} = await import('/src/maze-map.ts'), p = at('chest');
    g.wand = g.bridgeOpen = true; g.hearts=1; g.enemies.forEach(e => { e.hp = 0; e.mesh.visible = false; });
    g.encounterGateProgress=1;g.encounterGate.body.setEnabled(false);
    g.body.setTranslation({x:p.x,y:.8,z:p.z+2.2},true); g.body.setLinvel({x:0,y:0,z:0},true);
    g.previous.copy(g.body.translation()); g.render(0);
  });
  assert.equal(await page.evaluate(()=>game.target()?.spot),'chest');
  async function advance(seconds) {
    await page.evaluate(async seconds=>{
      const {movement}=await import('/src/movement.ts');
      const draw=game.renderer.render;game.renderer.render=()=>{};
      try {for(let t=0;t<seconds;t+=movement.step){game.step();game.render(movement.step);}}
      finally{game.renderer.render=draw;}game.render(0);
    },seconds);
  }
  async function capture(name) {
    const pixels = await page.evaluate(() => {
      const g = game; g.render(0); const gl = g.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      const data = new Uint8Array(w*h*4); gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,data);
      const colors = new Set(); for(let i=0;i<data.length;i+=4096) colors.add(`${data[i]},${data[i+1]},${data[i+2]}`);
      return {colors:colors.size,calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles};
    });
    assert.ok(pixels.colors>20,JSON.stringify(pixels)); captures.push({name,...pixels});
    await page.screenshot({path:`${output}/${name}.png`});
  }
  await capture('game-closed-desktop');
  await page.keyboard.press('KeyE');
  assert.ok(await page.evaluate(()=>game.chestQuiz.open&&!game.chestOpened));
  await page.locator('[data-chest-answer="wind"]').click();
  assert.ok(await page.evaluate(()=>game.chestOpened && !game.treasure && game.hearts===1));
  await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>game.treasure),false,'Repeated open input cannot skip the reveal');
  await advance(.55);
  const partial = await page.evaluate(()=>game.chest.getObjectByName('lid').rotation.x);
  assert.ok(partial>0 && partial<1.9);
  await capture('game-rising-desktop');
  await page.locator('#pause').click();
  const paused = await page.evaluate(()=>{game.render(.5);return game.chest.getObjectByName('lid').rotation.x;});
  assert.equal(paused,partial);
  await page.locator('#primary').click();
  await advance(1.2);
  assert.ok(await page.evaluate(()=>game.chest.getObjectByName('chest-crystal').visible && !game.treasure && !game.boat.getObjectByName('wind-sail-crystal').visible));
  assert.match(await page.locator('#dive').innerText(),/拾取晶石/);
  await capture('game-open-desktop');
  for (const [name,width,height] of [['laptop',1024,768],['portrait',390,844],['landscape',844,390]]) {
    await page.setViewportSize({width,height}); await page.evaluate(()=>{game.resize();game.render(0);}); await capture(`game-open-${name}`);
    assert.ok(await page.evaluate(()=>Math.abs(game.camera.aspect-innerWidth/innerHeight)<.001));
  }
  const reduced = await page.evaluate(()=>{
    game.reducedMotion=true;game.render(0);const c=game.chest.getObjectByName('chest-crystal');
    const before=[c.position.y,c.rotation.y];game.time+=1;game.render(.1);return {before,after:[c.position.y,c.rotation.y]};
  });
  assert.deepEqual(reduced.before,reduced.after);
  // Neither a distant collection nor opening without collection can unlock the boat.
  const uncollected=await page.evaluate(async()=>{
    const p=(await import('/src/maze-map.ts')).at('dock');game.body.setTranslation({x:p.x,y:.8,z:p.z},true);
    game.collectCrystal();game.startBoatTrip(true);return {owned:game.treasure,trip:!!game.boatTrip};
  });
  assert.deepEqual(uncollected,{owned:false,trip:false});
  await page.setViewportSize({width:1280,height:800});
  await page.evaluate(async()=>{const p=(await import('/src/maze-map.ts')).at('chest');game.reducedMotion=false;game.body.setTranslation({x:p.x,y:.8,z:p.z+2.2},true);game.previous.copy(game.body.translation());game.resize();game.render(0);});
  // Click the actual 3D crystal, independently of the HUD interaction button.
  const click=await page.evaluate(async()=>{
    const T=await import('/node_modules/.vite/deps/three.js');
    const c=game.chest.getObjectByName('chest-crystal'),p=c.localToWorld(new T.Vector3(0,.9,0)).project(game.camera);
    return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};
  });
  await page.mouse.click(click.x,click.y);
  assert.ok(await page.evaluate(()=>!!game.crystalPickup&&!game.treasure&&game.chest.getObjectByName('chest-crystal').visible));
  const start=await page.evaluate(()=>game.crystalPickup.start.toArray());
  await page.keyboard.press('KeyE');
  assert.deepEqual(await page.evaluate(()=>game.crystalPickup.start.toArray()),start,'Repeated pickup cannot restart the flight');
  await advance(.3);
  const flight=await page.evaluate(()=>({elapsed:game.crystalPickup.elapsed,position:game.chest.getObjectByName('chest-crystal').position.toArray(),scale:game.chest.getObjectByName('chest-crystal').scale.x}));
  assert.notDeepEqual(flight.position,start);assert.ok(flight.scale>0&&flight.scale<.62);
  await capture('game-pickup-flight-desktop');
  await page.locator('#pause').click();await page.evaluate(()=>game.render(.5));
  assert.equal(await page.evaluate(()=>game.crystalPickup.elapsed),flight.elapsed);
  assert.deepEqual(await page.evaluate(()=>game.chest.getObjectByName('chest-crystal').position.toArray()),flight.position);
  await page.locator('#primary').click();await advance(.5);
  assert.ok(await page.evaluate(()=>game.treasure && game.hearts===3 && !game.chest.getObjectByName('chest-crystal').visible));
  await capture('game-collected-desktop');
  await page.evaluate(()=>{game.render(.5);game.render(0);});
  assert.ok(await page.evaluate(()=>!game.chest.getObjectByName('chest-crystal').visible && !game.chest.getObjectByName('chest-reward-glow').visible && game.chest.getObjectByName('lid').rotation.x===1.9));
  await page.evaluate(()=>game.reset());
  assert.ok(await page.evaluate(()=>!game.treasure && !game.chestOpened && game.chestProgress===0 && game.chest.getObjectByName('lid').rotation.x===0 && !game.chest.getObjectByName('chest-crystal').visible && !game.boat.getObjectByName('wind-sail-crystal').visible));
  await page.evaluate(()=>{
    game.body.setTranslation({x:85,y:.8,z:.7},true);game.previous.copy(game.body.translation());game.chestOpened=true;game.chestProgress=1;
    game.render(0);game.collectCrystal();game.render(.2);game.reset();game.render(1);
  });
  assert.ok(await page.evaluate(()=>!game.crystalPickup&&!game.treasure&&!game.chest.getObjectByName('chest-crystal').visible),'Restart cancels a flight without a delayed reward');
  // Real touch action reopens the reset chest at the original interaction distance.
  await page.evaluate(async()=>{const p=(await import('/src/maze-map.ts')).at('chest');game.reducedMotion=true;game.body.setTranslation({x:p.x,y:.8,z:p.z+2.2},true);game.previous.copy(game.body.translation());game.render(0);});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{game.resize();game.render(0);});
  await page.locator('#dive').tap();await page.evaluate(()=>game.render(0));
  await page.locator('[data-chest-answer="wind"]').tap();await page.evaluate(()=>game.render(0));
  assert.ok(await page.evaluate(()=>game.chestOpened&&!game.treasure));
  await page.locator('#dive').tap();await page.evaluate(()=>game.render(0));
  assert.ok(await page.evaluate(()=>game.treasure&&!game.chest.getObjectByName('chest-crystal').visible));
  await capture('game-collected-portrait');
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/metrics.json`,JSON.stringify({model:model.metrics,captures,errors},null,2));
  console.log('PASS reference models, GLB roundtrip, separate open/reveal/pickup, direct 3D click, touch pickup, disappearance, boat prerequisite, pause/reset, reduced motion and desktop/mobile', JSON.stringify(model.metrics));
} finally { await browser.close(); }
