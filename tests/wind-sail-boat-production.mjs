import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='artifacts/models/wind-sail-boat/production',errors=[];
try {
  await mkdir(output,{recursive:true});const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route(/\/assets\/maze-[^/]+\.js$/,async route=>{
    const response=await route.fetch(),body=await response.text(),name=body.match(/export\{([\w$]+) as MazeAdventure\}/)?.[1];assert.ok(name);
    await route.fulfill({response,body:body+`\nconst init=${name}.prototype.init;${name}.prototype.init=async function(){window.game=this;return init.call(this)};`});
  });
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:4212/')+'?level=3&lang=zh');
  await page.locator('.journey-skip').click();await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  await page.evaluate(()=>{
    const g=game;g.wand=g.bridgeOpen=true;g.bridgeBody.setEnabled(false);g.bridgeProgress=1;g.enemies.forEach(e=>e.hp=0);
    g.encounterGateProgress=1;g.encounterGate.body.setEnabled(false);
    window.atDock=()=>{g.body.setTranslation({x:100,y:.8,z:-10},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.render(0);};atDock();
  });
  async function finishDriving(boss) {
    const xkey=boss?'KeyD':'KeyA';await page.keyboard.down(xkey);await page.waitForFunction(b=>Math.abs(game.boat.position.x-game.boatMooring(b).x)<.2,boss);await page.keyboard.up(xkey);
    const zkey=boss?'KeyW':'KeyS';await page.keyboard.down(zkey);await page.waitForFunction(b=>Math.abs(game.boat.position.z-game.boatMooring(b).z)<.5,boss);await page.keyboard.up(zkey);await page.locator('#dive').tap();
  }
  const model=await page.evaluate(()=>({hull:!!game.boat.getObjectByName('boat-hull'),sail:!!game.boat.getObjectByName('boat-sail-cloth'),crystal:game.boat.getObjectByName('wind-sail-crystal').visible}));
  assert.deepEqual(model,{hull:true,sail:true,crystal:false});
  await page.keyboard.press('KeyE');assert.ok(await page.evaluate(()=>!game.boatTrip&&game.message==='boatNeedsCrystal'));
  await page.screenshot({path:`${output}/moored-desktop.png`});
  await page.evaluate(()=>{game.treasure=true;game.render(0);});
  assert.ok(await page.evaluate(()=>game.boat.getObjectByName('wind-sail-crystal').visible));
  await page.keyboard.press('KeyE');await page.keyboard.down('KeyD');await page.waitForFunction(()=>game.boatTrip?.elapsed>2);await page.keyboard.up('KeyD');
  await page.locator('#pause').click();
  const riding=await page.evaluate(()=>{
    const g=game,p=g.body.translation(),b=g.boat.position;
    return {elapsed:g.boatTrip.elapsed,offset:[p.x-b.x,p.y-b.y,p.z-b.z],enabled:g.body.isEnabled(),visible:g.player.visible};
  });
  assert.ok(Math.abs(riding.offset[0]-.945)<.001&&Math.abs(riding.offset[1]-1.487)<.001&&!riding.enabled&&riding.visible);
  await page.screenshot({path:`${output}/sailing-desktop.png`,style:'#menu{visibility:hidden!important}'});
  await page.evaluate(()=>{
    const g=game,b=g.boat.position;window.boatRender=g.render;g.render=()=>{};g.camera.position.set(b.x+6,b.y+4.5,b.z+7);g.camera.lookAt(b.x,b.y+1.8,b.z);g.renderer.render(g.scene,g.camera);
  });
  await page.screenshot({path:`${output}/sailing-detail.png`,style:'#menu{visibility:hidden!important}'});
  await page.evaluate(()=>{game.render=boatRender;});
  assert.equal(await page.evaluate(()=>game.boatTrip.elapsed),riding.elapsed,'Paused real tick freezes the boat');
  await page.locator('#primary').click();await finishDriving(true);await page.waitForFunction(()=>game.boatAtBossIsland&&!game.boatTrip);
  assert.ok(await page.evaluate(()=>game.body.isEnabled()&&game.checkpoint.x===165));
  await page.setViewportSize({width:390,height:844});
  await page.locator('#dive').tap();
  await page.evaluate(()=>{game.invulnerable=2;game.time=(Math.floor(game.time*4)+.75)/4;game.render(0);});
  await page.waitForFunction(()=>game.boatTrip?.elapsed>2);await page.locator('#pause').click();
  await page.screenshot({path:`${output}/return-mobile.png`,style:'#menu{visibility:hidden!important}'});
  const returning=await page.evaluate(()=>{const p=game.body.translation(),b=game.boat.position;return[p.x-b.x,p.y-b.y,p.z-b.z];});
  assert.ok(Math.abs(returning[0]+.945)<.001&&Math.abs(returning[1]-1.487)<.001);
  assert.ok(await page.evaluate(()=>game.player.visible),'A frozen invulnerability blink must not hide the passenger');
  await page.locator('#primary').click();await finishDriving(false);await page.waitForFunction(()=>!game.boatAtBossIsland&&!game.boatTrip);
  assert.ok(await page.evaluate(()=>game.body.isEnabled()&&game.checkpoint.x===100));
  await page.evaluate(()=>{game.reset();game.render(0);});
  assert.ok(await page.evaluate(()=>!game.boat.getObjectByName('wind-sail-crystal').visible&&!game.boatTrip&&game.body.isEnabled()));
  assert.deepEqual(errors,[]);await writeFile(`${output}/result.json`,JSON.stringify({pass:true,model,riding,returning,errors},null,2));
  console.log('PASS built boat with real tick: new hull/sail, crystal gating, keyboard outbound, pause, touch return, both rider positions and reset');
}finally{await browser.close();}
