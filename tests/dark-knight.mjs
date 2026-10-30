import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const output = 'artifacts/models/dark-knight', errors = [], url = process.env.TEST_URL || 'http://127.0.0.1:5198/';
try {
  await mkdir(output, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, reducedMotion: 'reduce', hasTouch: true });
  page.setDefaultTimeout(90000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.route('**/__dark-knight', r => r.fulfill({ contentType: 'text/html', body: '<body style="margin:0"></body>' }));
  await page.goto(url + '__dark-knight');
  const models = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js'), F = await import('/src/dark-knight.ts');
    const knight = F.createDarkKnight(), copy = F.createDarkKnight();
    const inspect = root => {
      const meshes = [], geometries = new Set(), materials = new Set(); let triangles = 0;
      root.updateMatrixWorld(true);
      root.traverse(m => {
        if (!m.isMesh) return;
        for (const a of Object.values(m.geometry.attributes)) if (![...a.array].every(Number.isFinite)) throw Error('Non-finite model geometry');
        meshes.push(m); geometries.add(m.geometry); materials.add(m.material);
        triangles += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3;
      });
      const box = new T.Box3().setFromObject(root);
      return { meshes: meshes.length, triangles, geometries: geometries.size, materials: materials.size, min: box.min.toArray(), max: box.max.toArray() };
    };
    const a = [], b = []; knight.traverse(m => { if (m.isMesh) a.push(m); }); copy.traverse(m => { if (m.isMesh) b.push(m); });
    if (!a.every((m, i) => m.geometry === b[i].geometry && m.material === b[i].material)) throw Error('Enemies must share resources');
    if (knight.getObjectByName('shield').parent !== knight.getObjectByName('arm1')) throw Error('Shield must be held by the arm');
    const size = inspect(knight);
    const scene = new T.Scene(), renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(1100,900); renderer.setPixelRatio(1); renderer.setClearColor('#f7f2e7');
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    document.body.append(renderer.domElement); scene.add(knight, new T.HemisphereLight('#d8efff','#c3b597',1.5));
    const sun = new T.DirectionalLight('#fff0d5',2.6); sun.position.set(-3,5,-4); sun.castShadow = true;
    Object.assign(sun.shadow.camera, { left:-2,right:2,top:2,bottom:-2,near:.1,far:20 }); sun.shadow.mapSize.setScalar(1024); sun.shadow.normalBias = .006; scene.add(sun);
    const fill = new T.DirectionalLight('#d8eaff',.4); fill.position.set(3,3,4); scene.add(fill);
    const floor = new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({ color:'#f7f2e7',roughness:1 }));
    floor.rotation.x = -Math.PI/2; floor.position.y = -.015; floor.receiveShadow = true; scene.add(floor);
    const camera = new T.OrthographicCamera(-1.16,1.16,.95,-.95,.1,30);
    window.knightTest = { T,F,knight,scene,renderer,camera,inspect };
    return size;
  });
  assert.ok(models.meshes <= 42 && models.triangles < 32000 && models.min[1] > -.015, JSON.stringify(models));
  for (const [name, x, y, z] of [['front',0,1.1,-4],['side',4,1.1,0],['back',0,1.1,4],['three-quarter',2.3,1.7,-4]]) {
    await page.evaluate(({x,y,z}) => { const s = window.knightTest; s.camera.position.set(x,y,z); s.camera.lookAt(0,.62,0); s.renderer.render(s.scene,s.camera); }, {x,y,z});
    await page.screenshot({ path: `${output}/${name}.png` });
  }
  const poses = [];
  for (const phase of ['warn','lunge','rest','stun','dazed']) {
    const pose = await page.evaluate(phase => {
      const s = window.knightTest, k = s.knight, shield = k.getObjectByName('shield');
      s.F.animateDarkKnight(k,'idle',true,0,0,false); k.updateMatrixWorld(true);
      const raised = new s.T.Box3().setFromObject(shield).max.y;
      for (let i=0;i<40;i++) s.F.animateDarkKnight(k,phase,true,i/30,1/30,false);
      k.updateMatrixWorld(true);
      const glove = k.getObjectByName('arm1').getObjectByName('gauntlet').getWorldPosition(new s.T.Vector3());
      const grip = shield.getObjectByName('shield-grip').getWorldPosition(new s.T.Vector3());
      s.camera.position.set(2.3,1.7,-4); s.camera.lookAt(0,.62,0); s.renderer.render(s.scene,s.camera);
      let finite = true; k.traverse(n => { finite &&= n.matrixWorld.elements.every(Number.isFinite); });
      return { phase, finite, stars:k.getObjectByName('pillar-stun-stars').visible, held:glove.distanceTo(grip), raised, top:new s.T.Box3().setFromObject(shield).max.y, bottom:new s.T.Box3().setFromObject(shield).min.y, ...s.inspect(k) };
    }, phase);
    await page.screenshot({ path: `${output}/${phase}.png` });
    assert.ok(pose.finite && pose.held < .001 && pose.bottom > 0 && pose.min[1] > -.025, JSON.stringify(pose));
    if (phase === 'rest' || phase === 'stun' || phase === 'dazed') assert.ok(pose.top < pose.raised - .15, `Lowered shield must visibly expose the body: ${JSON.stringify(pose)}`);
    assert.equal(pose.stars,phase==='dazed');
    poses.push(pose);
  }
  const exportData = await page.evaluate(async () => {
    const s = window.knightTest;
    s.F.animateDarkKnight(s.knight,'idle',true,0,0,true);
    if (s.knight.getObjectByName('foot1').rotation.x !== 0 || s.knight.getObjectByName('body').rotation.z !== 0) throw Error('Reduced motion must stop gait/shiver');
    s.F.animateDarkKnight(s.knight,'idle',false,0,0,true);
    if (!s.knight.getObjectByName('shield').visible || s.knight.getObjectByName('shield').rotation.x > -1) throw Error('Training enemy must carry its shield lowered');
    s.F.animateDarkKnight(s.knight,'idle',true,0,0,true);
    const {GLTFExporter} = await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
    const {GLTFLoader} = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const bytes = await new GLTFExporter().parseAsync(s.knight,{binary:true});
    const loaded = (await new GLTFLoader().parseAsync(bytes,'')).scene;
    // Runtime stun stars are hidden and intentionally absent from the idle GLB.
    const before = new s.T.Box3().setFromObject(s.knight.getObjectByName('body')).getSize(new s.T.Vector3());
    const after = new s.T.Box3().setFromObject(loaded).getSize(new s.T.Vector3());
    if (before.distanceTo(after) > .0001 || !loaded.getObjectByName('shield')) throw Error('GLB roundtrip changed the model');
    s.renderer.render(s.scene,s.camera);
    const gl = s.renderer.getContext(), pixels = new Uint8Array(1100*900*4); gl.readPixels(0,0,1100,900,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let darkPixels = 0; for(let i=0;i<pixels.length;i+=4) if(pixels[i]<130 && pixels[i+1]<130 && pixels[i+2]<140) darkPixels++;
    return { bytes:Array.from(new Uint8Array(bytes)),darkPixels };
  });
  assert.ok(exportData.darkPixels > 10000, 'Model canvas must contain visible dark armor');
  await writeFile(`${output}/dark-knight.glb`, Buffer.from(exportData.bytes));
  console.log('PASS model geometry, shared resources, grounded feet, held shield, visible exposure, reduced motion and GLB roundtrip', JSON.stringify(models));
  // Test the actual enemy state machine and input; teleport only to set up the encounter.
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/, r => r.fulfill({ contentType:'text/javascript', body:'export function startJourney(){return {arrive:async()=>{},dispose(){}}}' }));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch(); await route.fulfill({ response, body: await response.text() + '\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;return init.call(this)};MazeAdventure.prototype.tick=function(){};' });
  });
  await page.setViewportSize({width:1280,height:800});
  await page.goto(url + '?level=3&lang=zh'); await page.locator('.game-loading').waitFor({state:'detached',timeout:90000}); await page.locator('#primary').click();
  await page.evaluate(async () => {
    const g = window.game, p = (await import('/src/maze-map.ts')).at('practice');
    g.wand = g.bridgeOpen = true; g.bridgeProgress = 1; g.bridgeBody.setEnabled(false);
    g.body.setTranslation({x:p.x,y:.8,z:p.z+5.5},true); g.previous.copy(g.body.translation());
    g.enemies[0].mesh.rotation.y = Math.PI; g.updateEnemies(1/30); g.render(0);
    if (!g.enemies.slice(0,2).every(e => e.mesh.name === 'dark-knight')) throw Error('The first and later regular enemies must use the knight');
    if (g.enemies[2].mesh.name!=='ember-guardian' || !g.enemies[2].mesh.getObjectByName('ember-sword') || g.enemies[2].mesh.getObjectByName('shield')) throw Error('Only the final boss must use the new sword guardian');
    if (g.enemies[0].shielded || g.enemies[0].hp!==1 || !g.enemies[0].mesh.getObjectByName('shield').visible || g.enemies[0].mesh.getObjectByName('shield').rotation.x > -1) throw Error('First encounter must stay easy with a lowered shield');
  });
  await page.screenshot({path:`${output}/game-desktop.png`});
  await page.setViewportSize({width:390,height:844}); await page.evaluate(() => game.render(0)); await page.screenshot({path:`${output}/game-mobile.png`});
  await page.keyboard.press('KeyE'); assert.equal(await page.evaluate(() => game.enemies[0].hp),0, 'First knight remains a one-hit training encounter');
  await page.evaluate(async () => {
    const g=window.game,p=(await import('/src/maze-map.ts')).at('shield');
    g.body.setTranslation({x:p.x,y:.8,z:p.z+5.5},true);g.previous.copy(g.body.translation());g.cooldown=0;
    g.enemies[1].mesh.rotation.y=Math.PI;g.render(0);
  });
  await page.keyboard.press('KeyE'); assert.equal(await page.evaluate(() => game.enemies[1].hp),2, 'Later knight raised shield blocks wind');
  await page.evaluate(() => {
    for(let i=0;i<360&&game.enemies[1].phase!=='rest';i++)game.updateEnemies(1/60);
    for(let i=0;i<20;i++)game.updateEnemies(1/60);
    game.cooldown=0;game.render(0);
  });
  assert.equal(await page.evaluate(() => game.enemies[1].phase),'rest');
  assert.ok(await page.evaluate(() => game.enemies[1].mesh.getObjectByName('shield').rotation.x < -1));
  await page.keyboard.press('KeyE'); assert.equal(await page.evaluate(() => game.enemies[1].hp),1, 'Resting knight takes wind damage');
  await page.evaluate(() => { for(let i=0;i<30;i++) game.updateEnemies(1/30); game.windTime=0; game.render(0); });
  await page.screenshot({path:`${output}/game-shield-encounter.png`});
  const render = await page.evaluate(() => ({ calls:game.renderer.info.render.calls, triangles:game.renderer.info.render.triangles, geometries:game.renderer.info.memory.geometries, textures:game.renderer.info.memory.textures }));
  await page.locator('#pause').tap(); assert.ok(await page.evaluate(() => game.paused)); await page.evaluate(() => game.render(0)); await page.locator('#primary').tap();
  await page.evaluate(() => { game.reset(); game.render(0); });
  assert.ok(await page.evaluate(() => game.enemies.every(e => e.hp === e.maxHp && e.mesh.visible) && game.enemies[0].mesh.getObjectByName('shield').rotation.x===-1.2 && game.enemies[1].mesh.getObjectByName('shield').rotation.x===-.55));
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/metrics.json`,JSON.stringify({models,poses,render,glbBytes:exportData.bytes.length,darkPixels:exportData.darkPixels,errors},null,2));
  console.log('PASS first bridge-side knight, later shield knight, final sword guardian identity, one-hit training, shield block/rest/exposure, desktop/mobile, touch pause/resume and reset',JSON.stringify(render));
} finally { await browser.close(); }
