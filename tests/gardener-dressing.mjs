import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { collectGardenTool, plantGarden } from './garden-quest-helpers.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const base = process.env.TEST_URL || 'http://127.0.0.1:5192/';
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, hasTouch: true, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await mkdir('test-results', { recursive: true });
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: 'export function startJourney(){return {arrive:async()=>{},dispose(){}}}' }));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + '\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await init.call(this)};MazeAdventure.prototype.tick=function(){};' });
  });
  await page.goto(base + '?level=3&lang=zh');
  await page.waitForFunction(() => window.game?.body && window.game?.root);
  await page.locator('.game-loading').waitFor({ state: 'detached', timeout: 60000 });
  await page.locator('#primary').click();
  const metrics = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const g = game;
    const props = g.scene.children.filter(o => o.name.startsWith('garden-') && !['garden-bloom', 'garden-flower-bed'].includes(o.name));
    const bounds = props.filter(o => !['garden-turf', 'garden-stones', 'garden-birdhouse', 'garden-wood-wind-chime', 'garden-songbird'].includes(o.name)).map(o => {
      const box = new T.Box3().setFromObject(o);
      return { name: o.name, minY: box.min.y, size: box.getSize(new T.Vector3()).toArray() };
    });
    const cottage = new T.Box3().setFromObject(g.scene.getObjectByName('garden-cottage'));
    const shedBounds = new T.Box3().setFromObject(g.scene.getObjectByName('garden-shed'));
    const bench = new T.Box3().setFromObject(g.scene.getObjectByName('garden-potting-workbench'));
    const cart = new T.Box3().setFromObject(g.scene.getObjectByName('garden-flower-cart'));
    const bird = g.scene.getObjectByName('garden-birdhouse'); bird.updateMatrixWorld(true);
    const birdBounds = new T.Box3().setFromObject(bird), mount = bird.localToWorld(new T.Vector3(0,.43,-.318));
    const wallRay = new T.Raycaster(mount.clone().add(new T.Vector3(2,0,0)),new T.Vector3(-1,0,0));
    const wallHit = wallRay.intersectObject(g.scene.getObjectByName('garden-cottage'),true)[0];
    const stoneWell=g.scene.getObjectByName('garden-stone-well'),wellBounds=new T.Box3().setFromObject(stoneWell),toolOverlaps=[];
    const trellis=g.scene.getObjectByName('garden-vine-trellis'),trellisBounds=new T.Box3().setFromObject(trellis);
    const seatBounds=new T.Box3().setFromObject(g.scene.getObjectByName('garden-bench-01'));
    const trellisOverlaps=g.walls.some(w=>trellisBounds.intersectsBox(w.bounds))||trellisBounds.intersectsBox(wellBounds)||trellisBounds.intersectsBox(seatBounds);
    const tree=g.scene.getObjectByName('garden-shade-tree'),chime=g.woodWindChime,anchor=tree.getObjectByName('garden-chime-anchor').getWorldPosition(new T.Vector3());
    const chimeBounds=new T.Box3().setFromObject(chime),crown=tree.getObjectByName('garden-shade-crown');
    const rack=g.scene.getObjectByName('garden-tool-rack'),rackBounds=new T.Box3().setFromObject(rack),rackPosition=rack.getWorldPosition(new T.Vector3());
    g.toolMesh.traverse(mesh=>{if(mesh.isMesh&&wellBounds.intersectsBox(new T.Box3().setFromObject(mesh)))toolOverlaps.push(mesh.name||mesh.type);});
    return { treePosition:tree.position.toArray(),treeSize:new T.Box3().setFromObject(tree).getSize(new T.Vector3()).toArray(),chimePosition:chime.position.toArray(),chimeMountGap:chime.position.distanceTo(anchor),
      chimeMin:chimeBounds.min.toArray(),chimeMax:chimeBounds.max.toArray(),crownTracked:g.buildingOccluders.some(o=>o.materials.some(layer=>layer.material===crown.material)),
      trellisPosition:trellis.position.toArray(),trellisMin:trellisBounds.min.toArray(),trellisMax:trellisBounds.max.toArray(),trellisOverlaps,
      rackPosition:rackPosition.toArray(),rackMin:rackBounds.min.toArray(),rackMax:rackBounds.max.toArray(),wellPosition:stoneWell.position.toArray(),wellMin:wellBounds.min.toArray(),wellMax:wellBounds.max.toArray(),toolOverlaps,
      birdMin:birdBounds.min.toArray(),birdMax:birdBounds.max.toArray(),mountGap:mount.x-wallHit.point.x,birdRotation:bird.rotation.y,
      cartMin: cart.min.toArray(), cartMax: cart.max.toArray(), benchMin: bench.min.toArray(), benchMax: bench.max.toArray(), cottageMinX: cottage.min.x, cottageMaxX: cottage.max.x, wellSign: !!g.scene.getObjectByName('sign-tools'), cottageRotation: g.scene.getObjectByName('garden-cottage').rotation.y,
      shedRotation: g.scene.getObjectByName('garden-shed').rotation.y, shedMin:shedBounds.min.toArray(),shedMax:shedBounds.max.toArray(),bounds,
      beds: g.scene.children.filter(o => o.name === 'garden-flower-bed').map(o => ({ flowers: o.children.filter(c => c.name === 'garden-bed-flower').length, min: new T.Box3().setFromObject(o).min.toArray(), max: new T.Box3().setFromObject(o).max.toArray() })),
      wellFlowers: g.scene.children.filter(o => o.name === 'garden-bloom').length,
      obstruction: g.scene.children.some(o => Math.abs(o.position.x + 31.4) < .01 && Math.abs(o.position.z - 46.3) < .01),
      shedRock: g.scene.children.some(o => Math.abs(o.position.x + 46.4) < .01 && Math.abs(o.position.z - 46.3) < .01),
      yardPaving: g.scene.children.filter(o=>o.name==='garden-stones'&&o.position.z>30).length,
      loaded: [...g.models.keys()], bodies: g.world.bodies.len() };
  });
  assert.equal(metrics.wellSign, false);
  assert.ok(Math.abs(metrics.treePosition[0]+46.8)<.001&&Math.abs(metrics.treePosition[2]+.4)<.001);
  assert.ok(metrics.chimeMountGap<.00001&&metrics.chimeMin[1]>2.3&&metrics.chimeMax[1]<3.5,'Wind chime must hang on the real tree branch above the walking space');
  assert.ok(metrics.crownTracked&&metrics.treeSize[1]>6,'Round tree canopy needs player visibility protection');
  assert.ok(Math.abs(metrics.trellisPosition[0]+44.2)<.001&&Math.abs(metrics.trellisPosition[2]+1.8)<.001);
  assert.equal(metrics.trellisOverlaps,false,'Trellis must fit behind the bench without touching the well or maze hedge');
  assert.ok(metrics.trellisMin[2]>-2.5&&metrics.trellisMax[2]<-.9&&metrics.trellisMax[0]<-40.3,'Trellis must leave the pickup space and well approaches clear');
  assert.deepEqual(metrics.rackPosition,[-37.4,0,37.9]);
  assert.ok(metrics.rackMin[0]>-38.7&&metrics.rackMax[0]<-36.1&&metrics.rackMin[2]>37.25&&metrics.rackMax[2]<38.55,'Rack must stay inside the existing NPC avoidance footprint');
  assert.deepEqual(metrics.wellPosition,[-38.6,0,3.5]);
  assert.deepEqual(metrics.toolOverlaps,[],'Existing trowel and watering can meshes must remain outside the new well bounds');
  assert.ok(metrics.wellMin[0]>-40&&metrics.wellMax[0]<-36.8&&metrics.wellMin[2]>2.4&&metrics.wellMax[2]<4.6,'New well must remain inside the original nook');
  assert.equal(metrics.cottageRotation, 0);
  assert.ok(metrics.benchMin[0] > -47.5 && metrics.benchMax[0] < -45 && metrics.benchMax[2] < 44.9, 'Workbench must fit along the hedge, clear of both buildings and the route');
  assert.ok(metrics.cartMin[0] > -36.3 && metrics.cartMax[0] < -32 && metrics.cartMin[2] > 32.5 && metrics.cartMax[2] < 35.5, 'Flower cart must fit before the hedge, clear of the barrel, NPC and both well passages');
  assert.equal(metrics.birdRotation,Math.PI/2);
  assert.ok(metrics.mountGap>=0&&metrics.mountGap<.008,'Birdhouse rear cleat must sit against the actual cottage wall');
  assert.ok(metrics.birdMin[1]>2.19&&metrics.birdMax[1]<3.4&&metrics.birdMin[2]>36.5&&metrics.birdMax[2]<38.1,'Birdhouse must stay below the eaves, beside the window and above the walking route');
  assert.ok(metrics.cottageMinX > -47.5 && metrics.cottageMaxX <= -41, 'Cottage must stay inside the left hedge and clear the x=-40 passage');
  assert.equal(metrics.shedRotation, Math.PI/2);
  assert.ok(Math.abs(metrics.shedMin[0]-metrics.benchMin[0])<.001&&metrics.shedMax[2]<49.2&&metrics.shedMin[2]-metrics.benchMax[2]>1.4,'Shed back must align with the workbench along the hedge, with space between them');
  assert.equal(metrics.shedRock,false);assert.equal(metrics.yardPaving,0);
  assert.ok(metrics.loaded.includes('wheelbarrow'));
  assert.equal(metrics.beds.length, 2);
  assert.ok(metrics.beds.every(b => b.flowers === 10 && b.min[0] > -32.5 && b.max[0] < -27.5 && b.max[2] < 52.5 && Math.abs(b.min[1] - .019) < .001), 'Both framed beds must fit beside the hedge, clear of the route');
  assert.equal(metrics.wellFlowers, 14);
  assert.equal(metrics.obstruction, false, 'The bush that hid the courtyard flowers must be removed');
  const border = await page.evaluate(() => {
    const g=game, trees=g.scene.children.filter(o=>o.name==='garden-border-tree');
    return {trees:trees.length,bushes:g.scene.children.filter(o=>o.name==='garden-border-bush').length,
      tracked:trees.every(o=>g.buildingOccluders.some(b=>b.bounds.containsPoint(o.position))),
      stones:g.scene.children.filter(o=>o.name==='garden-stones').map(o=>({x:o.position.x,z:o.position.z,scale:o.scale.x,angle:o.rotation.y}))};
  });
  assert.equal(border.trees,4);assert.equal(border.bushes,8);assert.ok(border.tracked);
  assert.equal(border.stones.length,3);
  assert.ok(border.stones.every((p,i)=>p.z===6.5&&p.scale===1.2&&p.angle===0&&Math.abs(p.x-(-39.7+2*i))<.001),'Paving must be equal-sized, aligned and evenly spaced');
  assert.ok(metrics.bounds.every(p => Math.abs(p.minY) < .002 && p.size.every(v => Number.isFinite(v) && v > 0)));
  const glb = await readFile('public/models/wheelbarrow.glb');
  assert.equal(glb.toString('ascii', 0, 4), 'glTF');
  assert.equal(glb.readUInt32LE(8), glb.length);
  async function near(x, z) {
    await page.evaluate(({x,z}) => { const g=game; g.body.setTranslation({x,y:.8,z},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.render(0); }, {x,z});
  }
  async function frame(position, target, path) {
    await page.evaluate(({position,target}) => { const g=game; g.render(0);g.camera.position.fromArray(position);g.camera.lookAt(...target);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera); }, {position,target});
    await page.screenshot({path, style: '.gardener-mutter{visibility:hidden}'});
  }
  await near(-42.8,48.8);
  await page.screenshot({path:'test-results/garden-shed-player-view.png'});
  await frame([-36.5,7,54.5],[-45.2,1,46.5],'test-results/garden-shed-door-desktop.png');
  await near(-41.8,47);
  await page.keyboard.down('ArrowLeft');
  const stoppedAtShed=await page.evaluate(()=>{for(let i=0;i<100;i++)game.step();return game.body.translation().x;});
  await page.keyboard.up('ArrowLeft');
  assert.ok(stoppedAtShed>metrics.shedMax[0]+.35&&stoppedAtShed<metrics.shedMax[0]+.55,'Moved collider must stop the player at the new right-facing door');
  await near(-43,44);
  await page.keyboard.down('ArrowDown');
  const throughOldShed=await page.evaluate(()=>{for(let i=0;i<100;i++)game.step();return game.body.translation();});
  await page.keyboard.up('ArrowDown');
  assert.ok(throughOldShed.z>49.3,'The former building footprint must allow walking south without an invisible collider');
  await near(-43,49.4);
  await page.keyboard.down('ArrowUp');
  const returnFromOldShed=await page.evaluate(()=>{for(let i=0;i<120;i++)game.step();return game.body.translation();});
  await page.keyboard.up('ArrowUp');
  assert.ok(returnFromOldShed.z<43.2,'The cleared corridor must also allow walking north');
  await near(-35, 43);
  await frame([-33.2,3.2,42.5],[-37.4,.9,37.9],'test-results/garden-tool-rack-yard.png');
  const rackRender=await page.evaluate(()=>{const g=game,materials=new Set();g.scene.traverse(m=>{if(m.isMesh)for(const a of Array.isArray(m.material)?m.material:[m.material])materials.add(a);});return {...g.renderer.info.render,...g.renderer.info.memory,materials:materials.size,dpr:g.renderer.getPixelRatio()};});
  assert.ok(rackRender.calls<300&&rackRender.triangles<750000);
  await mkdir('artifacts/models/garden-tool-rack',{recursive:true});
  await writeFile('artifacts/models/garden-tool-rack/after-metrics.json',JSON.stringify(rackRender,null,2));
  await frame([-16, 34, 70], [-36, 0, 28], 'test-results/garden-free-overview.png');
  await frame([-25, 14, 59], [-39, 1, 42], 'test-results/garden-free-yard.png');
  await frame([-42.2, 3, 43.3], [-46.45, 1, 42], 'test-results/potting-workbench-yard.png');
  await frame([-29, 3.4, 40], [-34, 1, 34.2], 'test-results/flower-cart-yard.png');
  await frame([-37.8, 3.4, 39.9], [-41, 2.72, 37.4], 'test-results/birdhouse-yard.png');
  await frame([-36, 8, 52], [-30, .3, 48], 'test-results/garden-flowerbeds-desktop.png');
  await near(-40, 8);
  await frame([-38, 9, 21], [-38, .6, 5], 'test-results/well-border-trees.png');
  await frame([-32, 8, 17], [-39.2, .7, 4], 'test-results/garden-free-well.png');
  await frame([-38.5,6.5,12],[-43.8,2.4,1.6],'test-results/garden-tree-rest-corner.png');
  await frame([-43.4,3.25,5.8],[-45.864,2.9,2.096],'test-results/wood-wind-chime-yard.png');
  await frame([-32, 8, 17], [-39.2, .7, 4], 'test-results/garden-free-well.png');
  const cornerRender=await page.evaluate(()=>{
    const g=game,tree=g.scene.getObjectByName('garden-shade-tree'),chime=g.woodWindChime;tree.visible=chime.visible=false;g.renderer.render(g.scene,g.camera);
    const before={...g.renderer.info.render};tree.visible=chime.visible=true;g.renderer.render(g.scene,g.camera);
    return {before,after:{...g.renderer.info.render},memory:{...g.renderer.info.memory},bodies:g.world.bodies.len()};
  });
  await mkdir('artifacts/models/wood-wind-chime',{recursive:true});
  await writeFile('artifacts/models/wood-wind-chime/yard-metrics.json',JSON.stringify(cornerRender,null,2));
  const trellisRender=await page.evaluate(()=>{
    const g=game,trellis=g.scene.getObjectByName('garden-vine-trellis');trellis.visible=false;g.renderer.render(g.scene,g.camera);
    const before={...g.renderer.info.render};trellis.visible=true;g.renderer.render(g.scene,g.camera);
    return {before,after:{...g.renderer.info.render},memory:{...g.renderer.info.memory},dpr:g.renderer.getPixelRatio()};
  });
  await mkdir('artifacts/models/vine-trellis',{recursive:true});
  await writeFile('artifacts/models/vine-trellis/yard-metrics.json',JSON.stringify(trellisRender,null,2));
  // Allow the added quest cart/planting props while preserving the trellis's eight-draw budget.
  assert.ok(trellisRender.after.calls-trellisRender.before.calls<=8&&trellisRender.after.calls<320&&trellisRender.after.triangles<750000);
  await frame([-39,3.6,5],[-44.2,1.35,-1.6],'test-results/vine-trellis-yard.png');
  await frame([-34, 4.8, 9.3], [-38.6, 1.1, 3.5], 'test-results/stone-well-yard.png');
  const pixels = await page.evaluate(() => {
    const g=game;g.renderer.render(g.scene,g.camera);const gl=g.renderer.getContext(),p=new Uint8Array(4),colors=new Set();
    for(let x=1;x<10;x++)for(let y=1;y<8;y++){gl.readPixels(Math.floor(gl.drawingBufferWidth*x/10),Math.floor(gl.drawingBufferHeight*y/8),1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);colors.add([...p].join(','));}
    return {colors:colors.size,...g.renderer.info.render, geometries:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures};
  });
  assert.ok(pixels.colors > 12);
  await near(-38.6,7);
  await page.keyboard.down('ArrowUp');
  const stoppedAtWell=await page.evaluate(()=>{for(let i=0;i<100;i++)game.step();return game.body.translation().z;});
  await page.keyboard.up('ArrowUp');
  assert.ok(stoppedAtWell>4.85&&stoppedAtWell<5,'The new stone ring collider must stop the player outside the well');
  await near(-43,.1);
  await page.keyboard.down('ArrowUp');
  const stoppedAtTrellis=await page.evaluate(()=>{for(let i=0;i<75;i++)game.step();return game.body.translation().z;});
  await page.keyboard.up('ArrowUp');
  assert.ok(stoppedAtTrellis>-1.4&&stoppedAtTrellis<-1.1,'Trellis collider must stop the player outside the wooden frame');
  await near(-45.3,-.4);
  await page.keyboard.down('ArrowLeft');
  const stoppedAtTree=await page.evaluate(()=>{for(let i=0;i<60;i++)game.step();return game.body.translation().x;});
  await page.keyboard.up('ArrowLeft');
  assert.ok(stoppedAtTree>-46&&stoppedAtTree<-45.8,'Tree trunk must stop the player with a round proxy');
  await near(-45.7,-1);
  await page.keyboard.down('ArrowDown');
  const pastTree=await page.evaluate(()=>{for(let i=0;i<100;i++)game.step();return game.body.translation().z;});
  await page.keyboard.up('ArrowDown');
  assert.ok(pastTree>4,'The space between tree and bench must allow southbound walking');
  await near(-45.7,5);
  await page.keyboard.down('ArrowUp');
  const backPastTree=await page.evaluate(()=>{for(let i=0;i<95;i++)game.step();return game.body.translation().z;});
  await page.keyboard.up('ArrowUp');
  assert.ok(backPastTree<.4,'The tree-side passage must also allow northbound walking');
  const occlusion=await page.evaluate(()=>{
    const g=game,crown=g.scene.getObjectByName('garden-shade-crown');
    g.body.setTranslation({x:-46.8,y:.8,z:-1.4},true);g.previous.copy(g.body.translation());g.render(0);
    const hidden=crown.material.opacity;g.body.setTranslation({x:-40,y:.8,z:8},true);g.previous.copy(g.body.translation());g.render(0);
    return {hidden,restored:crown.material.opacity};
  });
  assert.ok(occlusion.hidden<.2&&occlusion.restored===1,'Tree crown should fade only while it hides the player');
  await near(-43.8, 42);
  await page.keyboard.down('ArrowLeft');
  const stoppedAtBench = await page.evaluate(() => { for(let i=0;i<100;i++)game.step();return game.body.translation().x; });
  await page.keyboard.up('ArrowLeft');
  assert.ok(stoppedAtBench < -44.7 && stoppedAtBench > metrics.benchMax[0] + .35, 'The simple workbench collider must stop the player outside the render mesh');
  await near(-33.5, 38);
  await page.keyboard.down('ArrowUp');
  const stoppedAtCart = await page.evaluate(() => { for(let i=0;i<100;i++)game.step();return game.body.translation().z; });
  await page.keyboard.up('ArrowUp');
  assert.ok(stoppedAtCart < 36 && stoppedAtCart > metrics.cartMax[2] + .35, 'The flower cart collider must stop the player outside the render mesh');
  await near(-30, 40);
  await page.keyboard.down('ArrowUp');
  const route = await page.evaluate(() => { for(let i=0;i<520;i++)game.step(); return game.body.translation(); });
  await page.keyboard.up('ArrowUp');
  assert.ok(route.z < 12, `East passage to well blocked at ${JSON.stringify(route)}`);
  await near(-40, 43);
  await page.keyboard.down('ArrowUp');
  const west = await page.evaluate(() => { for(let i=0;i<640;i++)game.step();return game.body.translation(); });
  await page.keyboard.up('ArrowUp');
  assert.ok(west.z > 17, `The quest cart must initially block the western shortcut: ${JSON.stringify(west)}`);
  await collectGardenTool(page);
  assert.ok(await page.evaluate(() => game.tools && !game.toolMesh.visible), 'Freed trowel pickup must work');
  await plantGarden(page);
  assert.ok(await page.evaluate(() => game.wand && !game.tools), 'Planting must award the wand');
  await page.locator('#maze-close').click();
  await page.setViewportSize({width:390,height:844});
  await near(-42.8,48.8);
  await frame([-36.5,8,56],[-45.2,1,46.5],'test-results/garden-shed-door-mobile.png');
  await near(-35,44);
  await frame([-34,2.8,42],[-37.4,.9,37.9],'test-results/garden-tool-rack-yard-mobile.png');
  await frame([-23,25,65],[-38,0,36],'test-results/garden-free-yard-mobile.png');
  await frame([-41.3, 3.4, 43],[-46.45,1,42],'test-results/potting-workbench-yard-mobile.png');
  await frame([-29, 4.5, 41],[-34,1,34.2],'test-results/flower-cart-yard-mobile.png');
  await frame([-38.2, 3.6, 39.5],[-41,2.72,37.4],'test-results/birdhouse-yard-mobile.png');
  await frame([-35,9,53],[-30,.3,48],'test-results/garden-flowerbeds-mobile.png');
  await near(-40,8);
  await frame([-34,10,19],[-39,.7,4],'test-results/garden-free-well-mobile.png');
  await frame([-39.8,6.8,14],[-43.8,2.5,1.6],'test-results/garden-tree-rest-corner-mobile.png');
  await frame([-45.2,3.3,6.3],[-45.864,2.9,2.096],'test-results/wood-wind-chime-yard-mobile.png');
  await frame([-41,3.5,5],[-44.2,1.35,-1.6],'test-results/vine-trellis-yard-mobile.png');
  await frame([-34.3,5,10],[-38.6,1.1,3.5],'test-results/stone-well-yard-mobile.png');
  await page.locator('#pause').tap(); assert.ok(await page.evaluate(() => game.paused));
  assert.ok(await page.evaluate(()=>{
    const g=game,pose=()=>{const values=[];g.woodWindChime.traverse(n=>values.push(...n.rotation.toArray()));return values.join(',');};
    const reduced=g.reducedMotion;g.reducedMotion=false;g.render(0);const moving=Math.abs(g.woodWindChime.getObjectByName('chime-tube-0').rotation.z)>0;
    const paused=pose();g.render(.05);g.render(.05);const stopped=paused===pose();g.reducedMotion=reduced;g.render(0);return moving&&stopped;
  }),'Wind chime must stay still while game time is paused');
  await page.locator('#pause').tap(); assert.equal(await page.evaluate(() => game.paused), false);
  assert.equal(await page.evaluate(() => game.world.bodies.len()), metrics.bodies);
  assert.ok(await page.evaluate(()=>{
    const g=game,count=g.world.bodies.len();g.reset(false);g.render(0);g.reset(true);g.render(0);
    return g.world.bodies.len()===count&&g.scene.children.filter(n=>n.name==='garden-shade-tree').length===1&&g.scene.children.filter(n=>n.name==='garden-wood-wind-chime').length===1;
  }),'Replay must not duplicate the rest-corner tree, wind chime or physics bodies');
  assert.deepEqual(errors, []);
  console.log('PASS free models, grounded props, visible canvas, both physical routes, pickup/reward, mobile and stable physics bodies', JSON.stringify({metrics,pixels,route,west}));
} catch (error) {
  throw error;
} finally { await browser.close(); }
