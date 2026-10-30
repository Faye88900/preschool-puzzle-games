import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),errors=[],output='artifacts/models/boat-boarding';
try {
 await mkdir(output,{recursive:true});
 const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route(/\/src\/journey\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:'export function startJourney(){return{arrive:async()=>{},dispose(){}}}'}));
 await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+'\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;return init.call(this)};MazeAdventure.prototype.tick=function(){};'});});
 await page.goto((process.env.TEST_URL||'http://127.0.0.1:5212/')+'?level=3&lang=zh');await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
 await page.evaluate(()=>{
  const g=game;g.enemies.forEach(e=>e.hp=0);g.wand=g.bridgeOpen=true;g.encounterGateProgress=1;g.encounterGate.body.setEnabled(false);
  window.advance=(n)=>{const draw=g.renderer.render;g.renderer.render=()=>{};for(let i=0;i<n;i++){if(g.active())g.step();g.render(1/60);}g.renderer.render=draw;};
  window.placeDock=()=>{const b=g.boatMooring(g.boatAtBossIsland);g.body.setTranslation({x:b.x+(g.boatAtBossIsland?4.45:-4.45),y:.8,z:b.z},true);g.body.setLinvel({x:0,y:0,z:0},true);g.clearInput();g.previous.copy(g.body.translation());advance(60);};placeDock();
 });
 const results=[];
 for(const boss of [false,true]) {
  await page.keyboard.down(boss?'KeyA':'KeyD');
  await page.evaluate(()=>{for(let i=0;i<150;i++){advance(1);if(Math.abs(game.body.translation().x-game.boat.position.x)<.3)break;}});
  await page.keyboard.up(boss?'KeyA':'KeyD');
  const standing=await page.evaluate(()=>{advance(30);let min=Infinity,max=-Infinity,off=0;for(let i=0;i<600;i++){advance(1);const h=game.body.translation().y-game.boat.position.y;min=Math.min(min,h);max=Math.max(max,h);if(!game.onBoat())off++;}return{p:game.body.translation(),b:game.boat.position.toArray(),min,max,off,trip:!!game.boatTrip};});
  console.log('standing',boss,standing);assert.ok(!standing.trip&&standing.min>1.42&&standing.max<1.55&&standing.off<5);
  await page.evaluate(()=>game.render(0));await page.screenshot({path:`${output}/${boss?'boss':'garden'}-aboard.png`});
  const jump=await page.evaluate(()=>{game.jumpRequested=true;let peak=0;for(let i=0;i<180;i++){advance(1);peak=Math.max(peak,game.body.translation().y-game.boat.position.y);}return{peak,landed:game.onBoat()};});assert.ok(jump.peak>2&&jump.landed);
  const edges=[];
  for(const keys of [['KeyW'],['KeyS'],[boss?'KeyA':'KeyD'],[boss?'KeyA':'KeyD','KeyW'],[boss?'KeyA':'KeyD','KeyS']]) {
   await page.evaluate(()=>{const b=game.boat.position;game.body.setTranslation({x:b.x,y:b.y+1.487,z:b.z},true);game.body.setLinvel({x:0,y:0,z:0},true);advance(5);});
   for(const key of keys)await page.keyboard.down(key);
   await page.evaluate(()=>advance(300));
   for(const key of keys)await page.keyboard.up(key);
   const edge=await page.evaluate(()=>{advance(30);const p=game.body.translation(),b=game.boat.position;return{x:p.x-b.x,z:p.z-b.z,y:p.y-b.y,aboard:game.onBoat()};});
   assert.ok(edge.aboard&&Math.abs(edge.x)<2.55&&Math.abs(edge.z)<1.1&&edge.y>1.2,JSON.stringify({keys,edge}));edges.push({keys,edge});
  }
  await page.evaluate(()=>{const b=game.boat.position;game.body.setTranslation({x:b.x,y:b.y+1.487,z:b.z},true);game.body.setLinvel({x:0,y:0,z:0},true);advance(5);});
  await page.keyboard.down(boss?'KeyD':'KeyA');await page.evaluate(()=>advance(100));await page.keyboard.up(boss?'KeyD':'KeyA');
  const ashore=await page.evaluate(()=>{advance(45);return game.body.translation();});console.log('ashore',ashore);assert.ok(ashore.y>.65);
  await page.keyboard.down(boss?'KeyA':'KeyD');await page.evaluate(()=>{for(let i=0;i<150;i++){advance(1);if(Math.abs(game.body.translation().x-game.boat.position.x)<.3)break;}});await page.keyboard.up(boss?'KeyA':'KeyD');await page.evaluate(()=>advance(30));
  if(!boss){await page.keyboard.press('KeyE');assert.ok(await page.evaluate(()=>!game.boatTrip&&game.message==='boatNeedsCrystal'));await page.evaluate(()=>game.treasure=true);}
  await page.keyboard.press('KeyE');assert.ok(await page.evaluate(()=>!!game.boatTrip));const idle=await page.evaluate(()=>{const b=game.boat.position.clone();advance(180);return Math.hypot(b.x-game.boat.position.x,b.z-game.boat.position.z);});assert.equal(idle,0);
  if(boss) {
   await page.evaluate(()=>game.reducedMotion=true);
   const stick=await page.locator('#stick').boundingBox();await page.mouse.move(stick.x+stick.width/2,stick.y+stick.height/2);await page.mouse.down();await page.mouse.move(stick.x+2,stick.y+stick.height/2);await page.evaluate(()=>advance(180));await page.mouse.up();
  } else {await page.keyboard.down('KeyD');await page.evaluate(()=>advance(180));await page.keyboard.up('KeyD');}
  assert.ok(await page.evaluate(()=>Math.abs(game.boat.position.x-game.boatMooring(game.boatAtBossIsland).x)>10),'Keyboard and touch stick both propel boat');
  await page.keyboard.press('KeyE');assert.ok(await page.evaluate(()=>!!game.boatTrip),'Cannot disembark in open water');
  const paused=await page.evaluate(()=>{game.pause();const b=game.boat.position.clone();advance(60);const same=b.equals(game.boat.position);game.pause();return same;});assert.ok(paused);
  await page.keyboard.down(boss?'KeyA':'KeyD');await page.evaluate(()=>advance(600));await page.keyboard.up(boss?'KeyA':'KeyD');
  await page.keyboard.down(boss?'KeyS':'KeyW');await page.evaluate(()=>advance(50));await page.keyboard.up(boss?'KeyS':'KeyW');
  await page.locator('#dive').tap();assert.equal(await page.evaluate(()=>game.boatAtBossIsland),!boss);
  results.push({boss,standing,jump,edges,ashore});await page.evaluate(()=>placeDock());
 }
 const reset=await page.evaluate(()=>{const count=game.world.bodies.len();game.reset();return{stable:count===game.world.bodies.len(),deck:game.boatDeck.translation(),boat:game.boat.position.toArray()};});assert.ok(reset.stable);assert.deepEqual(errors,[]);
 await writeFile(`${output}/report.json`,JSON.stringify({results,reset,errors},null,2));console.log('PASS walk aboard, swell standing, jump, walk ashore, E sailing both directions, reset');
} finally {await browser.close();}


