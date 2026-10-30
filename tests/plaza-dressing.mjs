import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const output = `test-results/plaza-${process.env.PLAZA_CAPTURE || 'after'}`;
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', hasTouch: true });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: 'export function startJourney(){return {arrive:async()=>{},dispose(){}}}' }));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + '\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await init.call(this)};MazeAdventure.prototype.tick=function(){};' });
  });
  await mkdir(output, { recursive: true });
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5217/') + '?level=3&lang=zh');
  await page.waitForFunction(() => window.game?.body && window.game?.root, { timeout: 90000 });
  await page.locator('.game-loading').waitFor({ state: 'detached', timeout: 90000 });
  await page.locator('#primary').click();
  await page.evaluate(() => game.render(0));
  const layout = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const { at, maze, spots, position, walkable } = await import('/src/maze-map.ts');
    const g = game, plaza = g.scene.getObjectByName('old-oak-plaza');
    const reachable = (bridge, shortcut, exit) => {
      const queue = [spots.spawn], seen = new Set();
      while (queue.length) {
        const [c, r] = queue.shift(), id = `${c},${r}`, p = position(c, r);
        if (seen.has(id) || !walkable(p.x, p.z, bridge, shortcut, exit)) continue;
        seen.add(id);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (maze[r + dr]?.[c + dc]) queue.push([c + dc, r + dr]);
      }
      return { finish: seen.has(spots.finish.join(',')), tools: seen.has(spots.tools.join(',')), boss: seen.has(spots.boss.join(',')) };
    };
    const benches = plaza.children.filter(child => child.name === 'garden-tree-bench').map(child => {
      const bounds = new T.Box3().setFromObject(child);
      return { min: bounds.min.toArray(), max: bounds.max.toArray(), center: bounds.getCenter(new T.Vector3()).toArray() };
    });
    const batches = plaza.getObjectByName('plaza-groundcover');
    let finite = true, triangles = 0;
    plaza.traverse(node => { if (node.isMesh) {
      triangles += (node.geometry.index?.count || node.geometry.attributes.position.count) / 3;
      finite &&= [...node.geometry.attributes.position.array].every(Number.isFinite);
    } });
    const trail = g.scene.getObjectByName('maze-exit-onward-trail'), bounds = new T.Box3().setFromObject(trail);
    const stream=g.scene.getObjectByName('garden-bridge-stream'),water=stream.getObjectByName('bridge-water-surface');
    const ground=g.scene.getObjectByName('maze-ground'),ray=new T.Raycaster(new T.Vector3(at('bridge').x,2,at('bridge').z),new T.Vector3(0,-1,0));
    g.scene.updateMatrixWorld(true);
    if(ray.intersectObject(ground,true).length)throw Error('The ground/path must have a real visual opening beneath the bridge water');
    ray.ray.origin.x+=4;
    if(!ray.intersectObject(ground,true).length)throw Error('The stream cutout must preserve the adjoining walkable bank');
    if(water.position.y>=-.1||new T.Box3().setFromObject(stream.getObjectByName('bridge-water-bed')).max.y>=water.position.y-.3)throw Error('Stream bed must sit visibly below the recessed surface');
    let streamTriangles=0;stream.traverse(m=>{if(m.isMesh)streamTriangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1);});
    if(stream.children.length>4||streamTriangles>6000)throw Error('The stream must stay a small four-draw effect without reflection render passes');
    const normals = trail.geometry.attributes.normal;
    const pathClear = !g.walls.some(wall => [0, 5, 10, 15].some(z => wall.bounds.containsPoint(new T.Vector3(at('exit').x, 1, z))));
    const materials = new Set(); batches.traverse(node => { if (node.isMesh) materials.add(node.material); });
    const nook = plaza.getObjectByName('garden-pergola-rest-nook');
    const exitPlaque = g.scene.getObjectByName('exit-nameplate');
    if(g.scene.getObjectByName('sign-exit') || exitPlaque?.parent!==g.scene.getObjectByName('garden-exit-gate').getObjectByName('gate-frame')
      || exitPlaque.getObjectByName('exit-nameplate-text')?.userData.label!=='出口')throw Error('The localized exit plaque must replace the freestanding exit sign on the fixed frame');
    const nookBounds = new T.Box3().setFromObject(nook);
    const waymarker = plaza.getObjectByName('garden-wind-leaf-waymarker');
    const borders=plaza.children.filter(c=>c.name==='garden-flowerbed-border').map(c=>({position:c.position.toArray(),meshes:c.children.length}));
    const arrowDirection = (name, target, direction) => {
      const arrow = waymarker.getObjectByName(name), origin = new T.Vector3();arrow.getWorldPosition(origin);
      return new T.Vector3(direction,0,0).transformDirection(arrow.matrixWorld).dot(new T.Vector3(target.x-origin.x,0,target.z-origin.z).normalize());
    };
    return { borders, oldBridgeSign:!!g.scene.getObjectByName('sign-bridge'), oldTreeSign:!!g.scene.getObjectByName('sign-tree'), waymarker:{position:waymarker.position.toArray(),leafDirection:arrowDirection('waymarker-leaf-arrow',at('tree'),-1),windDirection:arrowDirection('waymarker-wind-arrow',at('windmill'),1)}, nook: { position: nook.position.toArray(), min: nookBounds.min.toArray(), max: nookBounds.max.toArray() }, benches, finite, triangles, batches: batches.children.length, uniqueMaterials: materials.size, pathClear,
      trailMin: bounds.min.toArray(), trailMax: bounds.max.toArray(), normalsUp: Array.from({length:normals.count},(_,i)=>normals.getY(i)).every(y=>y>.99),
      gates: [reachable(false,false,false), reachable(true,false,false), reachable(true,true,true)] };
  });
  assert.equal(layout.benches.length, 1);
  assert.equal(layout.borders.length,2);assert.ok(layout.borders.every(b=>b.meshes===2));
  assert.equal(layout.oldTreeSign,false, 'The old Old Oak Plaza text sign must be removed');
  assert.equal(layout.oldBridgeSign,false, 'The freestanding Windmill Bridge sign must be removed');
  assert.ok(Math.abs(layout.waymarker.position[0]-6.5)<.001&&Math.abs(layout.waymarker.position[2]-37.8)<.001,
    'The new sign must sit on the north shoulder before the windmill turn, away from the south lamp/hedge');
  assert.ok(layout.waymarker.leafDirection>.9&&layout.waymarker.windDirection>.65, 'The two arrows must point toward the oak and windmill rather than away from their destinations');
  assert.ok(layout.nook.max[0] < -12, 'Pergola must stay west of the main exit route');
  assert.ok(Math.abs(layout.nook.position[0]+17)<.001 && Math.abs(layout.nook.position[2]-35.4)<.001 && layout.nook.min[2]>33,
    'Pergola must sit at the requested hedge-side planting spot with clearance behind it');
  assert.ok(layout.finite && layout.normalsUp && layout.pathClear);
  assert.ok(layout.batches <= 24 && layout.batches === layout.uniqueMaterials, 'Low planting and reused paving must batch by shared material');
  assert.ok(layout.trailMin[2] < -20 && layout.trailMax[2] >= -.01, 'A continuous visible trail must continue beyond the win trigger');
  assert.deepEqual(layout.gates, [{ finish:false, tools:true, boss:false }, { finish:false, tools:true, boss:false }, { finish:true, tools:true, boss:false }]);
  await page.screenshot({ path: `${output}/desktop.png` });
  const metrics = await page.evaluate(() => {
    const g = game;
    g.camera.position.set(6, 25, 76); g.camera.lookAt(-5, 0, 36); g.camera.updateMatrixWorld();
    g.renderer.render(g.scene, g.camera);
    const gl=g.renderer.getContext(), pixel=new Uint8Array(4), colors=new Set();
    for(let y=20;y<gl.drawingBufferHeight;y+=80)for(let x=20;x<gl.drawingBufferWidth;x+=80){gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);colors.add([...pixel].join(','));}
    return { calls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles, geometries: g.renderer.info.memory.geometries, textures: g.renderer.info.memory.textures, bodies: g.world.bodies.len(), colliders: g.world.colliders.len(), pixelColors:colors.size };
  });
  assert.ok(metrics.pixelColors>20, 'The actual canvas must contain varied scene pixels');
  await page.screenshot({ path: `${output}/overview.png` });
  await page.evaluate(({position:[x,,z]})=>{
    game.camera.position.set(x+4,9,z+13);game.camera.lookAt(x,1,z);game.camera.updateMatrixWorld();game.renderer.render(game.scene,game.camera);
  },layout.nook);
  await page.screenshot({path:`${output}/pergola-location.png`});
  await page.evaluate(({position:[x,,z]})=>{
    game.camera.position.set(x+1,7,z+10);game.camera.lookAt(x,1.9,z);game.camera.updateMatrixWorld();game.renderer.render(game.scene,game.camera);
  },layout.waymarker);
  await page.screenshot({path:`${output}/waymarker-location.png`});
  await page.evaluate(({position:[x,,z]})=>{
    game.camera.position.set(x-4,6,z-7);game.camera.lookAt(x,.25,z);game.camera.updateMatrixWorld();game.renderer.render(game.scene,game.camera);
  },layout.borders[1]);
  await page.screenshot({path:`${output}/flowerbed-edging.png`});
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { game.resize(); game.render(0); });
  await page.screenshot({ path: `${output}/mobile.png` });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => { game.resize(); game.render(0); });
  await page.screenshot({ path: `${output}/landscape.png` });
  async function place(x, z) {
    await page.evaluate(({x,z}) => {
      const g=game; g.body.setTranslation({x,y:.8,z},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.render(0);
    }, {x,z});
  }
  async function move(key, frames) {
    await page.keyboard.down(key);
    const p = await page.evaluate(frames => { for(let i=0;i<frames&&game.state==='racing';i++) game.step(); game.render(0);return game.body.translation(); }, frames);
    await page.keyboard.up(key); return p;
  }
  for(const {position:[x,,z]}of layout.borders){
    await place(x,z-3);const back=await move('ArrowDown',70);
    assert.ok(back.z>z-2.1&&back.z<z-1.7,`The rear stone curb must stop the player: ${JSON.stringify(back)}`);
    await place(x,z+2.6);const front=await move('ArrowUp',70);
    assert.ok(front.z>z+1.7&&front.z<z+2.1,`The newly closed front curb must stop the player: ${JSON.stringify(front)}`);
  }
  const [wx,,wz]=layout.waymarker.position;
  await place(wx-3,wz);
  const markerLeft=await move('ArrowRight',100);
  assert.ok(markerLeft.x>wx-1.2&&markerLeft.x<wx-.7, 'The stone plinth must physically stop the player');
  await place(wx+2.4,wz);
  const markerRight=await move('ArrowLeft',100);
  assert.ok(markerRight.x>wx+1.9&&markerRight.x<wx+2.3, `The lower arrow must not clip through the player: ${JSON.stringify(markerRight)}`);
  await place(wx,wz-2.6);
  assert.ok(await page.evaluate(()=>{const materials=[];game.scene.getObjectByName('garden-wind-leaf-waymarker').traverse(m=>{if(m.isMesh)materials.push(m.material);});return materials.every(m=>m.opacity<.2);}), 'The sign must fade if it obscures the player');
  await place(-10,50);
  assert.ok(await page.evaluate(()=>{const materials=[];game.scene.getObjectByName('garden-wind-leaf-waymarker').traverse(m=>{if(m.isMesh)materials.push(m.material);});return materials.every(m=>m.opacity===1);}), 'Sign materials must restore after leaving');
  await place(7,40);
  const toBridge=await move('ArrowRight',120);
  assert.ok(toBridge.x>13, 'The central route toward the windmill bridge must stay open');
  await place(16,40);
  const blockedBridge=await move('ArrowRight',90);
  assert.ok(blockedBridge.x>16.8&&blockedBridge.x<17.2,'The raised bridge must still block the route');
  await page.evaluate(()=>{game.camera.position.set(10,11,55);game.camera.lookAt(18,1,40);game.camera.updateMatrixWorld();game.renderer.render(game.scene,game.camera);});
  await page.screenshot({path:`${output}/bridge-no-sign.png`});
  await page.setViewportSize({width:1280,height:800});
  const flow=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),g=game,stream=g.bridgeWater;
    g.resize();g.render(0);g.camera.position.set(25,9,50);g.camera.lookAt(20,-.1,40);g.camera.updateMatrixWorld();
    const gl=g.renderer.getContext(),pixel=new Uint8Array(4),points=[];
    for(const x of [-1.6,-.8,0,.8,1.6])for(const z of [-1.6,-.8,0,.8,1.6]){
      const p=new T.Vector3(20+x,stream.root.getObjectByName('bridge-water-surface').position.y,40+z).project(g.camera);
      points.push([Math.round((p.x*.5+.5)*gl.drawingBufferWidth),Math.round((p.y*.5+.5)*gl.drawingBufferHeight)]);
    }
    const sample=t=>{stream.time.value=t;g.renderer.render(g.scene,g.camera);return points.map(([x,y])=>{gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return [...pixel].join(',');});};
    const before=sample(0),after=sample(1.7),again=sample(0),changes=before.filter((v,i)=>v!==after[i]).length;
    const wasReduced=g.reducedMotion,clock=g.time;
    g.reducedMotion=true;g.time=9;g.render(0);const still=stream.time.value===0;
    g.reducedMotion=false;g.render(0);const running=stream.time.value===9;
    g.reducedMotion=wasReduced;g.time=clock;g.render(0);
    g.camera.position.set(25,9,50);g.camera.lookAt(20,-.1,40);g.camera.updateMatrixWorld();stream.time.value=1.7;g.renderer.render(g.scene,g.camera);
    return {changes,repeat:before.every((v,i)=>v===again[i]),still,running};
  });
  assert.ok(flow.changes>=5&&flow.repeat&&flow.still&&flow.running,`Water must animate actual surface pixels deterministically and honor reduced motion: ${JSON.stringify(flow)}`);
  await page.screenshot({path:`${output}/bridge-water-detail.png`});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{game.resize();game.render(0);game.camera.position.set(24,10,53);game.camera.lookAt(20,1,40);game.camera.updateMatrixWorld();game.renderer.render(game.scene,game.camera);});
  await page.screenshot({path:`${output}/bridge-water-mobile.png`});
  await page.setViewportSize({width:1280,height:800});await page.evaluate(()=>{game.resize();game.render(0);});
  await place(14,40);
  const mechanism=await page.evaluate(()=>{
    game.wand=true;game.interact();
    const rotor=game.mill.getObjectByName('rotor'),before=rotor.rotation.z;
    for(let i=0;i<200;i++)game.step();game.render(.1);
    return {open:game.bridgeOpen,blocked:game.bridgeBody.isEnabled(),angle:game.bridgeDeck.rotation.z,rotating:rotor.rotation.z!==before};
  });
  assert.ok(mechanism.open&&!mechanism.blocked&&Math.abs(mechanism.angle)<.001&&mechanism.rotating,JSON.stringify(mechanism));
  await page.evaluate(()=>{game.camera.position.set(10,11,55);game.camera.lookAt(18,1,40);game.camera.updateMatrixWorld();game.renderer.render(game.scene,game.camera);});
  await page.screenshot({path:`${output}/windmill-bridge-open.png`});
  await page.evaluate(()=>{game.camera.position.set(25,9,50);game.camera.lookAt(20,-.1,40);game.camera.updateMatrixWorld();game.renderer.render(game.scene,game.camera);});
  await page.screenshot({path:`${output}/bridge-water-lowered.png`});
  await place(16,40);const across=await move('ArrowRight',200);
  assert.ok(across.x>24,'The lowered bridge must be physically traversable');
  await place(5,33);const shortcutClosed=await move('ArrowUp',150);
  assert.ok(shortcutClosed.z>25.8&&shortcutClosed.z<26.2,'The decorated shortcut must remain locked before the key');
  const [nx,,nz] = layout.nook.position;
  await place(nx,nz+3);
  const entered = await move('ArrowUp',70);
  assert.ok(entered.z-nz < .8 && entered.z-nz > -.2, `The pergola entrance must admit the player and the seat must stop them: ${JSON.stringify(entered)}`);
  assert.ok(await page.evaluate(()=>game.scene.getObjectByName('garden-pergola-rest-nook').children.every(m=>m.material.opacity<.2)), 'Pergola must fade while it obscures the player');
  await page.setViewportSize({width:1280,height:800});
  await page.evaluate(()=>{game.resize();game.render(0);});
  await page.screenshot({path:`${output}/pergola-entered.png`});
  const left = await move('ArrowDown',85);
  assert.ok(left.z > nz+3.5, 'The player must be able to walk back out');
  await place(nx-5,nz-.5);
  const sideStop = await move('ArrowRight',120);
  assert.ok(sideStop.x < nx-2.1 && sideStop.x > nx-2.6, 'The side lattice must stop the player');
  await place(-10,50);
  assert.ok(await page.evaluate(()=>game.scene.getObjectByName('garden-pergola-rest-nook').children.every(m=>m.material.opacity===1)), 'Pergola materials must restore after leaving');
  await place(-30,40);
  const fromGardener = await move('ArrowRight',350);
  assert.ok(fromGardener.x > -12, `The gardener-to-plaza route must remain clear: ${JSON.stringify(fromGardener)}`);
  await place(-2.5,33);
  assert.ok(await page.evaluate(()=>game.scene.getObjectByName('plaza-oak-crown').material.opacity<.2), 'The reused oak crown must fade when it obscures the player');
  await place(-10,50);
  assert.equal(await page.evaluate(()=>game.scene.getObjectByName('plaza-oak-crown').material.opacity),1);
  for (const bench of layout.benches) {
    for (const side of [-1,1]) {
      const edge=side<0?bench.min[0]:bench.max[0];await place(edge+side*2,bench.center[2]);
      const stopped=await move(side<0?'ArrowRight':'ArrowLeft',90);
      assert.ok((stopped.x-edge)*side>.3&&(stopped.x-edge)*side<.7,'Both curved seating sections must physically stop the player');
    }
    for (const side of [-1,1]) {
      await place(bench.center[0],bench.center[2]+side*4.6);
      const inside=await move(side<0?'ArrowDown':'ArrowUp',70);
      assert.ok(Math.abs(inside.z-bench.center[2])<2,`Both bench openings must allow walking to the tree: ${JSON.stringify(inside)}`);
    }
  }
  await place(-10, 50);
  const atGate = await move('ArrowUp', 600);
  assert.ok(atGate.z>25.8&&atGate.z<27, `The wide plaza route must reach the closed exit without furniture in the way: ${JSON.stringify(atGate)}`);
  for(const [width,height,name]of [[1280,800,'desktop'],[390,844,'mobile']]){
    await page.setViewportSize({width,height});await page.evaluate(()=>{game.resize();game.render(0);});
    await page.screenshot({path:`${output}/exit-nameplate-${name}.png`});
  }
  await page.setViewportSize({width:1280,height:800});
  await page.evaluate(()=>{game.resize();game.render(0);game.camera.position.set(-10,7,36);game.camera.lookAt(-10,2,25);game.camera.updateMatrixWorld();game.renderer.render(game.scene,game.camera);});
  await page.screenshot({path:`${output}/exit-nameplate-detail.png`});
  await page.evaluate(()=>{game.key=true;game.shortcut.body.setEnabled(false);game.interact();game.render(0);});
  assert.ok(await page.evaluate(()=>game.exitOpen));
  assert.ok(await page.evaluate(()=>game.shortcut.mesh.position.y===-4&&game.exit.mesh.position.y===-4),'Both decorated grilles must retract below the walkway');
  await page.screenshot({path:`${output}/exit-nameplate-open.png`});
  await place(5,27);const shortcutOpen=await move('ArrowUp',100);
  assert.ok(shortcutOpen.z<23,'The opened shortcut must remain physically traversable');
  await page.setViewportSize({width:1280,height:800});
  await place(-10,24);
  await page.screenshot({path:`${output}/exit-open.png`});
  const finish = await move('ArrowUp', 400);
  assert.ok(await page.evaluate(()=>game.state==='qualified'));
  assert.ok(finish.z<8, 'Completion must happen after walking out into the meadow, rather than immediately behind the gate');
  await page.screenshot({path:`${output}/finish.png`});
  await page.evaluate(()=>{game.reset();game.render(0);});
  assert.deepEqual(await page.evaluate(()=>({bodies:game.world.bodies.len(),colliders:game.world.colliders.len()})),{bodies:metrics.bodies,colliders:metrics.colliders});
  await page.locator('#pause').click();assert.ok(await page.evaluate(()=>game.paused));
  await page.evaluate(()=>game.render(0));
  await page.locator('#primary').click();assert.ok(await page.evaluate(()=>!game.paused));
  assert.deepEqual(errors, []);
  await writeFile(`${output}/metrics.json`, JSON.stringify({metrics,layout,flow}, null, 2));
  console.log('PASS recessed stream, animated water pixels/reduced motion, windmill activation, drawbridge motion/walk, dual-gate blocking/retraction/walk, closed flowerbed collision, marker/fade, pergola, gardener route, exit/meadow win, reset, pause and responsive views', JSON.stringify({metrics,layout,flow}));
} finally { await browser.close(); }
