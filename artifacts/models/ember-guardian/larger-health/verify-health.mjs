import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output=process.env.GUARDIAN_OUTPUT||'artifacts/models/ember-guardian/production',errors=[];
try{
  await mkdir(output,{recursive:true});const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route(/\/assets\/maze-[^/]+\.js$/,async route=>{const response=await route.fetch(),body=await response.text(),name=body.match(/export\{([\w$]+) as MazeAdventure\}/)?.[1];assert.ok(name);await route.fulfill({response,body:body+`\nconst init=${name}.prototype.init;${name}.prototype.init=async function(){window.game=this;return init.call(this)};${name}.prototype.tick=function(){};`});});
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:4397/')+'?level=3&lang=zh');await page.locator('.journey-skip').click();await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  await page.evaluate(()=>{
    const g=game;
    window.swordPlace=(x,z)=>{g.body.setTranslation({x,y:.8,z},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.clearInput();g.render(0);};
    window.swordFrames=(n,until)=>{for(let i=0;i<n;i++){if(g.active())g.step();if(until&&g.enemies[2].phase===until)break;}g.render(0);};
    window.swordSetup=(attack=0)=>{g.reset();g.wand=g.bridgeOpen=g.treasure=true;g.bridgeBody.setEnabled(false);g.bridgeProgress=1;g.boatAtBossIsland=true;g.guardian.attack=attack;const e=g.enemies[2];swordPlace(e.home.x,e.home.z+2);g.checkpoint={x:165,z:-15};g.invulnerable=0;g.reducedMotion=false;g.step();g.render(0);};
    swordSetup();
  });
  const layouts=[];
  for(const [width,height]of [[1280,800],[390,844],[844,390]]){
    await page.setViewportSize({width,height});await page.evaluate(()=>{game.resize();swordSetup();});
    const layout=await page.locator('.boss-health').evaluate(el=>{const r=el.getBoundingClientRect(),f=el.querySelector('.knight-health-frame').getBoundingClientRect(),g=document.querySelector('.guidance').getBoundingClientRect();return{width:r.width,left:r.left,right:r.right,top:r.top,bottom:r.bottom,frameHeight:f.height,guidance:g.bottom};});
    assert.ok(layout.left>=0&&layout.right<=width&&layout.top>=layout.guidance&&layout.bottom<height&&layout.frameHeight===19,JSON.stringify(layout));
    if(width===1280)assert.equal(layout.width,640);
    layouts.push({width,height,...layout});await page.screenshot({path:`${output}/health-${width}.png`});
  }
  await page.setViewportSize({width:1280,height:800});await page.evaluate(()=>{game.resize();swordSetup();const e=game.enemies[2];e.phase='rest';e.timer=1;game.cooldown=0;game.blow();game.render(0);});
  assert.equal(await page.locator('.boss-health').getAttribute('aria-valuenow'),'2');await page.screenshot({path:output+'/health-damaged.png'});
  assert.deepEqual(errors,[]);await writeFile(output+'/result.json',JSON.stringify({pass:true,layouts,errors},null,2));console.log('PASS larger boss health desktop portrait landscape and real wind damage');
}finally{await browser.close();}
