import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),errors=[],output='artifacts/models/dark-knight/health';
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true,reducedMotion:'no-preference'});
  page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:'export function startJourney(){return {arrive:async()=>{},dispose(){}}}'}));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async route=>{
    const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;return init.call(this)};MazeAdventure.prototype.tick=function(){};'});
  });
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5198/')+'?level=3&lang=zh');
  await page.locator('.game-loading').waitFor({state:'detached',timeout:90000});await page.locator('#primary').click();
  await page.evaluate(()=>{
    window.prepareHealth=()=>{
      const g=game;g.reset();g.wand=g.bridgeOpen=true;g.bridgeProgress=1;g.bridgeBody.setEnabled(false);
      const e=g.enemies[1];e.phase='rest';e.timer=2.6;e.mesh.rotation.y=Math.PI;
      g.body.setTranslation({x:e.home.x+3,y:.8,z:e.home.z+1.5},true);g.body.setLinvel({x:0,y:0,z:0},true);
      g.previous.copy(g.body.translation());g.updateEnemies(1/120);g.render(0);
    };
    prepareHealth();
  });
  const bar=page.locator('.knight-health').nth(1);
  assert.ok(await bar.isVisible());assert.equal(await bar.getAttribute('aria-valuetext'),'2/2');
  assert.equal(await bar.innerText(),'','Health values must not crowd the small meter');
  await page.screenshot({path:`${output}/desktop-full.png`});
  await page.evaluate(()=>{
    const bar=game.enemyBars[1];window.healthProbe=new Promise(resolve=>{
      const samples=[],waiting=performance.now();let start;
      function sample(now){
        if(now-waiting>5000){resolve(samples);return;}
        if(bar.dataset.hp==='1'){
          start??=now;const fill=bar.querySelector('i').getBoundingClientRect().width,trail=bar.querySelector('em').getBoundingClientRect().width;
          samples.push({t:now-start,fill,trail});
          if(now-start>700&&fill<50&&Math.abs(fill-trail)<.2){resolve(samples);return;}
        }
        requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
  });
  await page.keyboard.press('KeyE');await page.evaluate(()=>game.render(0));
  const samples=await page.evaluate(()=>healthProbe);
  await writeFile(`${output}/damage-samples.json`,JSON.stringify(samples,null,2));
  assert.ok(samples.some(s=>s.trail>s.fill+5),'Lost health must leave a brief warm damage trail');
  assert.ok(Math.abs(samples.at(-1).fill-samples.at(-1).trail)<.2,`Damage trail must settle at current health: ${JSON.stringify(samples.at(-1))}`);
  assert.equal(await bar.getAttribute('aria-valuenow'),'1');assert.equal(await bar.getAttribute('aria-valuetext'),'1/2');
  assert.equal(await bar.locator('i').evaluate(e=>e.style.width),'50%');
  await page.screenshot({path:`${output}/desktop-half.png`});
  await bar.screenshot({path:`${output}/meter-half.png`});
  await page.screenshot({path:`${output}/close-half.png`,clip:{x:440,y:455,width:350,height:180}});
  const viewports=[];
  for(const [name,width,height] of [['tablet',768,1024],['mobile',390,844],['landscape',844,390]]){
    await page.setViewportSize({width,height});await page.evaluate(()=>game.render(0));
    const bounds=await bar.boundingBox();assert.ok(bounds&&bounds.x>0&&bounds.y>0&&bounds.x+bounds.width<width&&bounds.y+bounds.height<height);
    assert.ok(bounds.width<95&&bounds.height<20,'An ordinary enemy needs a compact meter');
    await page.screenshot({path:`${output}/${name}-half.png`});viewports.push({name,width,height,bounds});
  }
  await page.evaluate(()=>{game.pause();game.render(0);});assert.equal(await bar.isVisible(),false);
  await page.evaluate(()=>{game.pause();game.render(0);});assert.equal(await bar.isVisible(),true);
  await page.evaluate(()=>{game.enemies[1].phase='rest';game.cooldown=0;game.render(0);});
  await page.keyboard.press('KeyE');await page.evaluate(()=>game.render(0));assert.equal(await bar.isVisible(),false);
  await page.evaluate(()=>prepareHealth());
  assert.equal(await bar.locator('i').evaluate(e=>e.style.width),'100%');
  assert.equal(await bar.locator('em').evaluate(e=>e.style.width),'100%');
  assert.equal(await bar.getAttribute('aria-valuenow'),'2');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await bar.locator('em').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
  await page.keyboard.press('KeyE');await page.evaluate(()=>game.render(0));
  const reduced=await bar.evaluate(e=>({fill:e.querySelector('i').getBoundingClientRect().width,trail:e.querySelector('em').getBoundingClientRect().width}));
  assert.ok(Math.abs(reduced.fill-reduced.trail)<.2);
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/report.json`,JSON.stringify({samples,viewports,reduced,errors},null,2));
  console.log('PASS authored health meter, real wind damage, delayed trail, accessible values, desktop/tablet/mobile/landscape, pause/death/reset and reduced motion');
}finally{await browser.close();}
