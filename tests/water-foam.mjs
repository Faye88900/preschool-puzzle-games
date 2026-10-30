import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
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


 await page.evaluate(()=>{game.treasure=true;game.startBoatTrip(true);});await page.keyboard.down('KeyW');await page.evaluate(()=>advance(240));await page.keyboard.down('KeyD');await page.evaluate(()=>advance(75));await page.keyboard.up('KeyD');await page.keyboard.up('KeyW');
 const trace=await page.evaluate(()=>game.ferryCoast.wake.filter(p=>p.w>0).map(p=>p.toArray()));assert.ok(trace.length>20);assert.ok(Math.max(...trace.map(p=>p[1]))-Math.min(...trace.map(p=>p[1]))>2,'Wake records curved path');
 await page.evaluate(()=>{const b=game.boat.position;game.render(0);game.camera.position.set(b.x+10,14,b.z+12);game.camera.lookAt(b.x-3,0,b.z-2);game.renderer.render(game.scene,game.camera);});await page.screenshot({path:output+'/foam-wake.png'});
 await page.evaluate(()=>game.pause());const frozen=await page.evaluate(()=>game.ferryCoast.wake.map(p=>p.toArray()));await page.evaluate(()=>advance(30));assert.deepEqual(await page.evaluate(()=>game.ferryCoast.wake.map(p=>p.toArray())),frozen);await page.evaluate(()=>game.pause());
 for(const [name,time] of [['incoming',0],['breaking',1.5]]){await page.evaluate(time=>{game.boatTrip=undefined;game.ferryCoast.clearWake();game.ferryCoast.time.value=time;game.render(0);game.camera.position.set(110,11,-19);game.camera.lookAt(100,-.2,-23);game.renderer.render(game.scene,game.camera);},time);await page.screenshot({path:output+'/shore-'+name+'.png'});}
 const shoreMotion=await page.evaluate(async()=>{
 const {gardenCoastX,bossCoastX}=await import('/src/ferry-shore-layout.ts'),g=game;
 return [1,-1].map(side=>{const z=-20,c=side===1?gardenCoastX(z):bossCoastX(z),x=c+side*2.2;
 const t=(Math.ceil((side*x+z*.08)/8.-.5)*8.+4.-side*x-z*.08)/1.65;
 const peak=(time)=>{g.ferryCoast.time.value=time;let best=-Infinity,position=0;for(let d=.6;d<2.9;d+=.01){const px=c+side*d,fade=.15+.85*Math.max(0,Math.min(1,(d-1.5)/6))**2*(3-2*Math.max(0,Math.min(1,(d-1.5)/6)));const h=g.ferryCoast.heightAt(px,z)/fade;if(h>best){best=h;position=px;}}return position;};
 const from=peak(t),to=peak(t+.35);return{side,from,to,towardShore:(from-to)*side};});
 });assert.ok(shoreMotion.every(m=>m.towardShore>.45&&m.towardShore<.7),'Wave crests on both banks must move from sea toward land');
 assert.notDeepEqual(await readFile(output+'/shore-incoming.png'),await readFile(output+'/shore-breaking.png'),'Shore foam must advance between phases');
 await page.evaluate(()=>game.ferryCoast.clearWake());assert.ok(await page.evaluate(()=>game.ferryCoast.wake.every(p=>p.w===0)),'Reset removes all residual wake');
 const detail=await page.evaluate(()=>{
 const mesh=game.scene.getObjectByName('ferry-rock-contact-foam'),texture=mesh.material.uniforms.uFoamTexture.value,image=texture.image;
 let clear=0,white=0;for(let i=0;i<image.data.length;i+=4){if(image.data[i]<20)clear++;if(image.data[i]>230)white++;}
 return{size:[image.width,image.height],clear:clear/(image.width*image.height),white:white/(image.width*image.height),mipmaps:texture.generateMipmaps,contacts:mesh.count,rocks:game.scene.getObjectByName('ferry-shore-reefs').count};
 });assert.ok(detail.clear>.35&&detail.white<.35&&detail.mipmaps&&detail.contacts===detail.rocks);assert.deepEqual(detail.size,[256,256]);
 assert.deepEqual(errors,[]);await writeFile(output+'/foam.json',JSON.stringify({samples:trace.length,trace,shoreMotion,detail,errors},null,2));console.log('PASS shader compilation, curved trail history, pause, shoreline renders');
}finally{await browser.close();}
