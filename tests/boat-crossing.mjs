import {driveBoat} from './boat-driving-helpers.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {advanceGarden} from './garden-quest-helpers.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='test-results/boat-crossing',errors=[];
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true,reducedMotion:'no-preference'});
  page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:'export function startJourney(){return {arrive:async()=>{},dispose(){}}}'}));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+'\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;return init.call(this)};MazeAdventure.prototype.tick=function(){};'});});
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5207/')+'?level=3&lang=zh');
  await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  await page.evaluate(async()=>{
    const {at}=await import('/src/maze-map.ts'),g=game;
    window.nearBoatSpot=(name,dx=0,dz=0)=>{const p=at(name);g.body.setTranslation({x:p.x+dx,y:.8,z:p.z+dz},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.render(0);};
    g.wand=g.bridgeOpen=true;g.bridgeBody.setEnabled(false);g.bridgeProgress=1;g.enemies[0].hp=0;g.encounterGateProgress=1;g.encounterGate.body.setEnabled(false);
    nearBoatSpot('dock');
  });
  const topology=await page.evaluate(async()=>{
    const {maze,spots,position,walkable}=await import('/src/maze-map.ts'),g=game;
    const reachable=key=>{const q=[spots.spawn],seen=new Set();for(let i=0;i<q.length;i++){const[c,r]=q[i],id=c+','+r,p=position(c,r);if(seen.has(id)||!walkable(p.x,p.z,true,key,key))continue;seen.add(id);for(const[dc,dr]of[[1,0],[-1,0],[0,1],[0,-1]])if(maze[r+dr]?.[c+dc])q.push([c+dc,r+dr]);}return{dock:seen.has(spots.dock.join(',')),boss:seen.has(spots.boss.join(',')),exit:seen.has(spots.finish.join(','))};};
    const R=await import('/node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs');
    return {closed:reachable(false),key:reachable(true),waterWalkable:walkable(115,-12,true,true,true),
      waterFloor:!!g.world.castRay(new R.Ray({x:115,y:10,z:-12},{x:0,y:-1,z:0}),20,true),bodies:g.world.bodies.len(),colliders:g.world.colliders.len()};
  });
  assert.ok(topology.closed.dock&&!topology.closed.boss&&!topology.key.boss&&topology.key.exit,'Both key states require the ferry');
  assert.equal(topology.waterWalkable,false);assert.equal(topology.waterFloor,false,'No invisible land bridge across the water');
  await page.keyboard.press('KeyE');assert.ok(await page.evaluate(()=>!game.boatTrip&&game.body.isEnabled()&&game.message==='boatNeedsCrystal'));
  await page.evaluate(()=>nearBoatSpot('chest',0,1.5));await page.keyboard.press('KeyE');await page.evaluate(()=>game.render(0));
  await page.locator('[data-chest-answer="wind"]').click();
  assert.ok(await page.evaluate(()=>game.chestOpened&&!game.treasure),'Opening alone does not unlock the boat');
  await page.evaluate(async()=>{const {movement}=await import('/src/movement.ts');for(let t=0;t<1.3;t+=movement.step)game.step();game.render(0);});
  await page.keyboard.press('KeyE');await page.evaluate(()=>game.render(0));
  await page.evaluate(()=>{game.render(.75);game.render(0);});
  assert.ok(await page.evaluate(()=>game.treasure&&game.boat.getObjectByName('wind-sail-crystal').visible));
  await page.evaluate(()=>nearBoatSpot('dock'));await page.keyboard.press('KeyE');
  assert.ok(await page.evaluate(()=>!!game.boatTrip&&!game.active()&&!game.body.isEnabled()));
  await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>game.boatTrip.elapsed),0,'Extra input cannot launch a second trip or jump off');
  await page.keyboard.down('KeyD');await advanceGarden(page,2.5);await page.keyboard.up('KeyD');
  const midpoint=await page.evaluate(()=>({boat:game.boat.position.toArray(),player:game.body.translation(),elapsed:game.boatTrip.elapsed}));
  assert.ok(midpoint.boat[0]>105&&midpoint.boat[0]<125);
  await page.screenshot({path:output+'/sailing-desktop.png'});
  await page.locator('#pause').click();await page.evaluate(()=>game.render(0));await advanceGarden(page,1);
  assert.equal(await page.evaluate(()=>game.boatTrip.elapsed),midpoint.elapsed,'Pause freezes the whole crossing');
  assert.deepEqual(await page.evaluate(()=>game.boat.position.toArray()),midpoint.boat);
  await page.locator('#primary').click();await driveBoat(page);
  assert.ok(await page.evaluate(()=>game.boatAtBossIsland&&!game.boatTrip&&game.body.isEnabled()&&game.body.translation().x===165&&game.checkpoint.x===165));
  await page.screenshot({path:output+'/arrival-desktop.png'});
  await page.evaluate(()=>{game.hearts=1;game.invulnerable=0;game.hurt();});
  assert.ok(await page.evaluate(()=>game.boatAtBossIsland&&game.body.translation().x===165&&game.hearts===3&&game.treasure),'Recovery stays at the island landing with the boat available');
  // An early return remains available; the player is not trapped until defeating the boss.
  await page.keyboard.press('KeyE');await driveBoat(page);
  assert.ok(await page.evaluate(()=>!game.boatAtBossIsland&&!game.key&&game.body.translation().x===100));
  await page.keyboard.press('KeyE');await driveBoat(page);
  const arena=await page.evaluate(()=>{
    const g=game;g.invulnerable=0;const reached=[];
    for(const[x,z]of[[169,-15],[175,-15],[180,-20],[180,-24.5]]){
      for(let i=0;i<500;i++){const p=g.body.translation();if(Math.hypot(x-p.x,z-p.z)<.2)break;g.keys.clear();if(Math.abs(x-p.x)>.1)g.keys.add(x>p.x?'KeyD':'KeyA');if(Math.abs(z-p.z)>.1)g.keys.add(z>p.z?'KeyS':'KeyW');g.step();}
      const p=g.body.translation();reached.push(Math.hypot(x-p.x,z-p.z));
    }g.keys.clear();g.render(0);return reached;
  });
  assert.ok(arena.every(d=>d<.35),'The landing must lead into the arena');
  await page.screenshot({path:output+'/boss-desktop.png'});
  await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>game.enemies[2].hp),3,'Boss shield still blocks wind');
  for(const hp of [2,1,0]){
    const exposed=await page.evaluate(()=>{for(let i=0;i<1600;i++){if(game.enemies[2].phase==='rest'&&game.cooldown===0)return true;game.step();}return false;});
    assert.ok(exposed,'The boss must naturally enter a punishable rest');
    await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>game.enemies[2].hp),hp);
  }
  await page.evaluate(()=>nearBoatSpot('boss',0,1));await page.keyboard.press('KeyE');
  assert.ok(await page.evaluate(()=>game.key&&!game.shortcut.body.isEnabled()));
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{game.resize();nearBoatSpot('bossDock');});
  await page.screenshot({path:output+'/return-mobile.png'});
  await page.locator('#dive').tap();await driveBoat(page);
  assert.ok(await page.evaluate(()=>!game.boatAtBossIsland&&game.key&&game.treasure&&game.body.isEnabled()));
  const returnRoute=await page.evaluate(()=>{
    const g=game,reached=[];
    for(const[x,z]of[[85,-10],[85,0],[75,0],[75,15],[55,15],[55,0],[25,0],[5,0],[5,25],[5,35],[-10,35],[-10,27]]){
      for(let i=0;i<700;i++){const p=g.body.translation();if(Math.hypot(x-p.x,z-p.z)<.2)break;g.keys.clear();if(Math.abs(x-p.x)>.1)g.keys.add(x>p.x?'KeyD':'KeyA');if(Math.abs(z-p.z)>.1)g.keys.add(z>p.z?'KeyS':'KeyW');g.step();}
      const p=g.body.translation();reached.push({target:[x,z],distance:Math.hypot(x-p.x,z-p.z)});
    }g.keys.clear();g.render(0);return reached;
  });
  assert.ok(returnRoute.every(p=>p.distance<.35),'The return boat must connect to the original exit route: '+JSON.stringify(returnRoute));
  await page.keyboard.press('KeyE');assert.ok(await page.evaluate(()=>game.exitOpen));
  await page.evaluate(()=>nearBoatSpot('finish'));await page.evaluate(()=>game.step());assert.equal(await page.evaluate(()=>game.state),'qualified');
  // Reset a crossing while the player body is disabled; no stale ferry state may survive.
  const reset=await page.evaluate(()=>{
    const g=game;g.reset();g.wand=g.bridgeOpen=g.treasure=true;g.bridgeBody.setEnabled(false);nearBoatSpot('dock');g.interact();g.render(1.5);
    const crossing=!!g.boatTrip&&!g.body.isEnabled();g.reset();return{crossing,enabled:g.body.isEnabled(),trip:!!g.boatTrip,onBoss:g.boatAtBossIsland,boat:g.boat.position.toArray(),key:g.key,treasure:g.treasure,bodies:g.world.bodies.len(),colliders:g.world.colliders.len()};
  });
  assert.ok(reset.crossing&&reset.enabled&&!reset.trip&&!reset.onBoss&&!reset.key&&!reset.treasure);
  assert.equal(reset.bodies,topology.bodies);assert.equal(reset.colliders,topology.colliders);
  await page.evaluate(()=>{const g=game;g.reducedMotion=true;g.wand=g.bridgeOpen=g.treasure=true;g.bridgeBody.setEnabled(false);nearBoatSpot('dock');});
  await page.locator('#dive').tap();await driveBoat(page);assert.ok(await page.evaluate(()=>game.boatAtBossIsland&&!game.boatTrip&&game.body.isEnabled()));
  await page.locator('#dive').tap();await driveBoat(page);assert.ok(await page.evaluate(()=>!game.boatAtBossIsland&&!game.boatTrip&&game.body.isEnabled()));
  const metrics=await page.evaluate(()=>({calls:game.renderer.info.render.calls,triangles:game.renderer.info.render.triangles}));
  assert.deepEqual(errors,[]);await writeFile(output+'/report.json',JSON.stringify({topology,midpoint,arena,returnRoute,reset,metrics,errors},null,2));
  console.log('PASS boat-only boss island, crystal prerequisite, boarding/sailing/landing, pause, recovery, early return, boss shield/rest/key, touch return, original exit, reset and reduced motion',JSON.stringify({topology,reset,metrics}));
}finally{await browser.close();}
