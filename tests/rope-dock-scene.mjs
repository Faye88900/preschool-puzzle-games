import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {advanceGarden} from './garden-quest-helpers.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='artifacts/models/rope-dock/production',errors=[];
try {
  await mkdir(output,{recursive:true});const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route(/\/assets\/maze-[^/]+\.js$/,async route=>{
    const response=await route.fetch(),body=await response.text(),name=body.match(/export\{([\w$]+) as MazeAdventure\}/)?.[1];assert.ok(name);
    await route.fulfill({response,body:body+`\nconst init=${name}.prototype.init;${name}.prototype.init=async function(){window.game=this;return init.call(this)};${name}.prototype.tick=function(){};`});
  });
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:4212/')+'?level=3&lang=zh');
  await page.locator('.journey-skip').click();await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  await page.evaluate(()=>{
    const g=game;g.wand=g.bridgeOpen=true;g.bridgeBody.setEnabled(false);g.bridgeProgress=1;g.enemies.forEach(e=>e.hp=0);g.encounterGateProgress=1;g.encounterGate.body.setEnabled(false);
    window.dockPlace=(x,z)=>{g.body.setTranslation({x,y:.85,z},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.clearInput();g.render(0);};
    window.dockWalk=(key,steps)=>{g.keys.add(key);for(let i=0;i<steps;i++)g.step();g.keys.clear();g.render(0);return{...g.body.translation(),grounded:g.grounded};};
    dockPlace(96.7,-10);
  });
  const bridge=await page.evaluate(()=>{
    const g=game;g.bridgeOpen=false;g.bridgeProgress=0;g.bridgeBody.setEnabled(true);g.bridgeSurface.setEnabled(false);
    dockPlace(14,40);g.interact();for(let i=0;i<220;i++)g.step();
    const opened=g.bridgeOpen;dockPlace(16,40);const crossed=dockWalk('ArrowRight',200);dockPlace(96.7,-10);return{opened,...crossed};
  });
  assert.ok(bridge.opened&&bridge.x>24&&bridge.y>.5,JSON.stringify(bridge));
  const approach=await page.evaluate(()=>dockWalk('KeyD',80));assert.ok(approach.x>100&&approach.x<101.8&&approach.grounded,JSON.stringify(approach));
  const edges=await page.evaluate(()=>{
    const result=[];for(const key of ['KeyW','KeyS']){dockPlace(100,-10);result.push({key,...dockWalk(key,100)});}dockPlace(101,-10);result.push({key:'KeyD',...dockWalk('KeyD',24)});return result;
  });
  assert.ok(edges[0].z>-11.15&&edges[0].z<-10.7&&edges[1].z<-8.85&&edges[1].z>-9.3&&edges[2].x>101.65,JSON.stringify(edges));
  const contact=await page.evaluate(()=>{dockPlace(100,-10);for(let i=0;i<120;i++)game.step();game.render(0);return{bodyY:game.body.translation().y,grounded:game.grounded,visible:game.player.visible};});
  assert.ok(contact.grounded&&contact.bodyY>.72&&contact.bodyY<.79,JSON.stringify(contact));
  const structure=await page.evaluate(()=>{
    const g=game,a=g.scene.getObjectByName('wind-garden-dock'),b=g.scene.getObjectByName('boss-island-dock');
    const sea=g.scene.getObjectByName('ferry-sea');
    return {both:!!a?.getObjectByName('dock-ropes')&&!!b?.getObjectByName('dock-ropes'),mooringParent:g.dockMooring.parent.name,bossMooringParent:g.bossMooring.parent.name,
      bayDimensions:[sea.geometry.parameters.width,sea.geometry.parameters.height],bayCenter:sea.position.toArray(),cloudFirstY:g.scene.getObjectByName('maze-island-clouds').instanceMatrix.array[13],bodies:g.world.bodies.len(),colliders:g.world.colliders.len()};
  });
  assert.ok(structure.both&&structure.mooringParent==='wind-garden-dock'&&structure.bossMooringParent==='boss-island-dock');
  assert.deepEqual(structure.bayDimensions,[90,70]);assert.deepEqual(structure.bayCenter,[135,-.65,-12]);assert.equal(structure.cloudFirstY,-7);
  await page.screenshot({path:`${output}/dock-desktop.png`});
  await page.evaluate(()=>{const g=game;g.camera.position.set(107,5.6,-18);g.camera.lookAt(99.9,.35,-10);g.renderer.render(g.scene,g.camera);});
  await page.screenshot({path:`${output}/dock-detail.png`});
  await page.evaluate(()=>dockPlace(100,-10));await page.keyboard.press('KeyE');assert.ok(await page.evaluate(()=>!game.boatTrip&&game.dockMooring.visible&&!game.bossMooring.visible&&game.message==='boatNeedsCrystal'));
  await page.evaluate(()=>{game.treasure=true;game.render(0);});await page.keyboard.press('KeyE');await advanceGarden(page,2.5);
  assert.ok(await page.evaluate(()=>!game.dockMooring.visible&&!game.bossMooring.visible&&!game.body.isEnabled()));
  await page.locator('#pause').click();const elapsed=await page.evaluate(()=>game.boatTrip.elapsed);await advanceGarden(page,1);assert.equal(await page.evaluate(()=>game.boatTrip.elapsed),elapsed);
  await page.locator('#primary').click();await advanceGarden(page,7);
  assert.ok(await page.evaluate(()=>game.boatAtBossIsland&&!game.dockMooring.visible&&game.bossMooring.visible&&game.body.isEnabled()));
  const landing=await page.evaluate(()=>dockWalk('KeyD',45));assert.ok(landing.x>166.7,JSON.stringify(landing));
  await page.evaluate(()=>dockPlace(165,-15));
  await page.screenshot({path:`${output}/island-dock-desktop.png`});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{game.resize();game.render(0);});
  await page.screenshot({path:`${output}/island-dock-mobile.png`});
  await page.locator('#dive').tap();await advanceGarden(page,9.2);assert.ok(await page.evaluate(()=>!game.boatAtBossIsland&&game.dockMooring.visible&&!game.bossMooring.visible&&game.body.isEnabled()));
  await page.screenshot({path:`${output}/dock-mobile.png`});
  await page.evaluate(()=>{game.reset();game.render(0);});assert.ok(await page.evaluate(()=>game.dockMooring.visible&&!game.bossMooring.visible&&!game.boatTrip));
  assert.deepEqual(errors,[]);await writeFile(`${output}/result.json`,JSON.stringify({pass:true,bridge,approach,edges,contact,structure,landing,errors},null,2));
  console.log('PASS built docks: approach/floor, side barriers/open entrance, mooring states, crystal prerequisite, boarding/landing, pause, touch return and reset',JSON.stringify({approach,edges,contact,structure}));
}finally{await browser.close();}
