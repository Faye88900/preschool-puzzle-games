import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),errors=[];
try{
  await mkdir('test-results',{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:'export function startJourney(){return {arrive:async()=>{},dispose(){}}}'}));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+'\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await init.call(this)};MazeAdventure.prototype.tick=function(){};'});});
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5194/')+'?level=3&lang=zh');
  await page.waitForFunction(()=>window.game?.body&&window.game?.root);await page.locator('.game-loading').waitFor({state:'detached',timeout:60000});await page.locator('#primary').click();
  async function place(x,z){await page.evaluate(({x,z})=>{const g=game;g.body.setTranslation({x,y:.8,z},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.render(0);},{x,z});}
  async function state(){return page.evaluate(()=>{
    const g=game,materials=name=>{const list=new Set();g.scene.getObjectByName(name).traverse(m=>{if(m.isMesh)for(const s of Array.isArray(m.material)?m.material:[m.material])list.add(s);});return [...list];};
    const shed=materials('garden-shed'),cottage=materials('garden-cottage'),original=[];
    for(const name of ['garden-shed','home-cottage-01'])g.models.get(name).traverse(m=>{if(m.isMesh)for(const s of Array.isArray(m.material)?m.material:[m.material])original.push(s);});
    return {shed:shed.map(m=>m.opacity),cottage:cottage.map(m=>m.opacity),shedDepth:shed.map(m=>m.depthWrite),cottageDepth:cottage.map(m=>m.depthWrite),sourceOpacity:original.map(m=>m.opacity),
      isolated:[...shed,...cottage].every(m=>!original.includes(m)),playerVisible:g.player.visible,bodies:g.world.bodies.len()};
  });}
  await place(-40,47);const clear=await state();assert.ok(clear.shed.every(a=>a===1)&&clear.cottage.every(a=>a===1));assert.ok(clear.isolated);
  await place(-45.42,44);const shed=await state();assert.ok(shed.shed.every(a=>a<.2)&&shed.shedDepth.every(v=>!v));assert.ok(shed.cottage.every(a=>a===1)&&shed.sourceOpacity.every(a=>a===1)&&shed.playerVisible);
  await page.screenshot({path:'test-results/garden-shed-see-through.png',style:'.gardener-mutter{visibility:hidden}'});
  await place(-44,33);const cottage=await state();assert.ok(cottage.cottage.every(a=>a<.2)&&cottage.cottageDepth.every(v=>!v));assert.ok(cottage.shed.every(a=>a===1)&&cottage.playerVisible);
  await page.screenshot({path:'test-results/garden-cottage-see-through.png',style:'.gardener-mutter{visibility:hidden}'});
  await place(-40,47);
  const easing=await page.evaluate(()=>{const g=game;g.body.setTranslation({x:-45.42,y:.8,z:44},true);g.previous.copy(g.body.translation());g.camera.position.set(-45.42,9.736,60);g.cameraLook.set(-45.42,2.056,36);g.render(.05);return g.buildingOccluders.find(o=>o.bounds.containsPoint(g.scene.getObjectByName('garden-shed').position)).opacity;});
  assert.ok(easing>.16&&easing<1,'Occlusion must fade smoothly during live frames');
  await page.evaluate(()=>{for(let i=0;i<30;i++)game.render(.05);});assert.ok((await state()).shed.every(a=>a<.17));
  await place(-40,47);const restored=await state();assert.deepEqual(restored.shed,clear.shed);assert.deepEqual(restored.shedDepth,clear.shedDepth);assert.equal(restored.bodies,clear.bodies);
  await page.setViewportSize({width:390,height:844});await place(-45.42,44);const mobile=await state();assert.ok(mobile.shed.every(a=>a<.2)&&mobile.playerVisible);
  await page.screenshot({path:'test-results/garden-shed-see-through-mobile.png',style:'.gardener-mutter{visibility:hidden}'});
  await place(-40,47);assert.deepEqual((await state()).shed,clear.shed);assert.deepEqual(errors,[]);
  await writeFile('test-results/garden-building-visibility.json',JSON.stringify({clear,shed,cottage,easing,restored,mobile},null,2));
  console.log('PASS building occlusion, material isolation, independent fading, live easing, restore, mobile and unchanged physics bodies');
}finally{await browser.close();}
