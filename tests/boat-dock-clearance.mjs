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
  await page.evaluate(boss=>{game.treasure=true;game.startBoatTrip(boss);game.boat.position.copy(game.boatMooring(boss));game.dockBoat();advance(1);},boss);
  const geometry=await page.evaluate(async boss=>{
   const T=await import('/node_modules/.vite/deps/three.js'),g=game;g.scene.updateMatrixWorld(true);
   const hull=new T.Box3().setFromObject(g.boat.getObjectByName('boat-hull'));
   const dock=new T.Box3().setFromObject(g.scene.getObjectByName(boss?'boss-island-dock':'wind-garden-dock').getObjectByName('dock-deck'));
   return{gap:boss?dock.min.x-hull.max.x:hull.min.x-dock.max.x,plankLength:g.boardingPlank.scale.x};
  },boss);assert.ok(geometry.gap>.4,JSON.stringify({boss,geometry}));
  await page.keyboard.down(boss?'KeyA':'KeyD');await page.evaluate(()=>{for(let i=0;i<240;i++){advance(1);if(Math.abs(game.body.translation().x-game.boat.position.x)<.25)break;}});await page.keyboard.up(boss?'KeyA':'KeyD');
  const aboard=await page.evaluate(()=>{advance(60);return{onBoat:game.onBoat(),p:game.body.translation(),b:game.boat.position.toArray()};});assert.ok(aboard.onBoat,'Must walk onto ship without jumping');
  await page.evaluate(()=>{const b=game.boat.position;game.render(0);game.camera.position.set(b.x+4,7,b.z+10);game.camera.lookAt(b.x-1,0,b.z);game.renderer.render(game.scene,game.camera);});await page.screenshot({path:output+'/'+(boss?'boss':'garden')+'-dock-clearance.png'});
  await page.keyboard.down(boss?'KeyD':'KeyA');await page.evaluate(()=>advance(130));await page.keyboard.up(boss?'KeyD':'KeyA');
  const ashore=await page.evaluate(()=>{advance(45);return game.body.translation();});assert.ok(ashore.y>.65,'Must walk back ashore');results.push({boss,geometry,aboard,ashore});
 }
 assert.deepEqual(errors,[]);await writeFile(output+'/dock-clearance.json',JSON.stringify({results,errors},null,2));console.log('PASS both hull/dock clearances, walk aboard and ashore, no jumping');
}finally{await browser.close();}
