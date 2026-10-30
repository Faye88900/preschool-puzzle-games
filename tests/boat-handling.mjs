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

 await page.evaluate(()=>{game.treasure=true;game.startBoatTrip(true);});
 const drive=async(keys,n)=>{for(const k of keys)await page.keyboard.down(k);await page.evaluate(n=>advance(n),n);for(const k of keys)await page.keyboard.up(k);};
 const initial=await page.evaluate(()=>game.boat.position.toArray());
 await drive(['KeyW'],60);const slow=await page.evaluate(()=>game.boatSpeed);await drive(['KeyW'],120);
 const fast=await page.evaluate(()=>game.boatSpeed);assert.ok(fast>slow&&slow>1&&fast>6);
 const coast=await page.evaluate(()=>{const x=game.boat.position.x,speed=game.boatSpeed;advance(30);return{distance:game.boat.position.x-x,speed:game.boatSpeed,before:speed};});assert.ok(coast.distance>1&&coast.speed<coast.before);
 await drive(['KeyW','KeyD'],120);
 const turn=await page.evaluate(()=>({yaw:game.boatYaw,rotation:game.boat.rotation.toArray(),z:game.boat.position.z,wake:game.boatWake.visible}));assert.ok(Math.abs(turn.yaw-Math.PI/2)>1&&turn.z>-8&&turn.wake);
 await page.evaluate(()=>game.pause());const paused=await page.evaluate(()=>({p:game.boat.position.toArray(),r:game.boat.rotation.toArray()}));await page.evaluate(()=>advance(60));assert.deepEqual(await page.evaluate(()=>({p:game.boat.position.toArray(),r:game.boat.rotation.toArray()})),paused);await page.evaluate(()=>game.pause());
 const framing=await page.evaluate(async()=>{
 game.render(0);const T=await import('/node_modules/.vite/deps/three.js');
 const relative=game.boat.quaternion.clone().invert().multiply(game.player.quaternion);
 const facing=new T.Vector3(0,0,-1).applyQuaternion(relative);
 const clouds=game.scene.getObjectByName('maze-island-clouds'),m=new T.Matrix4(),v=new T.Vector3();let low=0;
 for(let i=0;i<clouds.count;i++){clouds.getMatrixAt(i,m);v.setFromMatrixPosition(m);if(v.x>75&&v.y<25)low++;}
 return{facing:facing.toArray(),low,foundation:!!game.scene.getObjectByName('ferry-bay-foundation'),rim:game.scene.getObjectByName('ferry-bay-rock-rim').count};
 });assert.ok(framing.facing[2]>.999&&Math.abs(framing.facing[0])<.001&&framing.low===0&&framing.foundation&&framing.rim>0&&framing.rim<104);
 await page.evaluate(()=>{game.render(0);});await page.screenshot({path:output+'/steering.png'});
 const approaches=await page.evaluate(async()=>{
 const T=await import('/node_modules/.vite/deps/three.js'),rim=game.scene.getObjectByName('ferry-bay-rock-rim'),matrix=new T.Matrix4(),bounds=[];
 for(let i=0;i<rim.count;i++){rim.getMatrixAt(i,matrix);bounds.push(new T.Box3().setFromBufferAttribute(rim.geometry.attributes.position).applyMatrix4(matrix));}
 return [false,true].map(boss=>{const p=game.boatMooring(boss),route=new T.Box3(new T.Vector3(p.x+(boss?-14:-5),-2,p.z-5),new T.Vector3(p.x+(boss?5:14),3,p.z+5));return{boss,clear:bounds.every(b=>!b.intersectsBox(route))};});
 });assert.ok(approaches.every(p=>p.clear),'Both dock approaches must be clear of perimeter rocks');
 for(const boss of [true,false]) {
 await page.evaluate(boss=>{const p=game.boatMooring(boss);game.boat.position.copy(p);game.boat.position.x+=boss?-12:12;game.startBoatTrip(boss);},boss);
 await page.keyboard.down('KeyW');const arrived=await page.evaluate(boss=>{for(let i=0;i<360;i++){advance(1);const p=game.boatMooring(boss);if(Math.hypot(game.boat.position.x-p.x,game.boat.position.z-p.z)<2)return true;}return false;},boss);await page.keyboard.up('KeyW');assert.ok(arrived,'Must drive into either dock from the sea');await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>game.boatAtBossIsland),boss);assert.ok(await page.evaluate(()=>!game.boatTrip&&game.body.isEnabled()));
 }
 const dock=await page.evaluate(()=>{game.startBoatTrip(true);game.boat.position.copy(game.boatMooring(true));game.dockBoat();const ok=game.boatAtBossIsland&&game.body.isEnabled();game.startBoatTrip(false);const yaw=game.boatYaw;game.boat.position.copy(game.boatMooring(false));game.dockBoat();return{ok,yaw,returned:!game.boatAtBossIsland&&game.body.isEnabled(),level:game.boat.rotation.x===0&&game.boat.rotation.z===0};});assert.ok(dock.ok&&dock.returned&&dock.level&&dock.yaw<0);
 await page.evaluate(()=>{game.reducedMotion=true;game.startBoatTrip(true);});await drive(['KeyW','KeyD'],90);assert.ok(await page.evaluate(()=>game.boatSpeed>1&&game.boat.rotation.x===0&&game.boat.rotation.z===0));
 assert.deepEqual(errors,[]);await writeFile(output+'/handling.json',JSON.stringify({initial,slow,fast,coast,turn,dock,framing,approaches,errors},null,2));console.log('PASS acceleration, inertia, heading, free sea outside old corridor, wake, pause, dock/reset, reduced motion');
} finally {await browser.close();}

