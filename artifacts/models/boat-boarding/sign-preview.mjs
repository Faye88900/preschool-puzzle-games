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



 await page.evaluate(()=>{game.render(0);game.camera.position.set(96,5,-3.5);game.camera.lookAt(95.5,1,-11.35);game.renderer.render(game.scene,game.camera);});
 await page.screenshot({path:output+'/sign-lamp-aligned.png'});console.log(await page.evaluate(()=>({sign:game.scene.getObjectByName('ferry-boarding-sign').position.toArray(),lamp:game.scene.getObjectByName('ferry-leaf-lamp').position.toArray()})));
}finally{await browser.close();}
