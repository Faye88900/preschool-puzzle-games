import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),errors=[],output='artifacts/models/chest-quiz';
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:'export function startJourney(){return {arrive:async()=>{},dispose(){}}}'}));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async r=>{
    const response=await r.fetch();await r.fulfill({response,body:await response.text()+'\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;return init.call(this)};MazeAdventure.prototype.tick=function(){};'});
  });
  const base=process.env.TEST_URL||'http://127.0.0.1:5212/';
  async function prepare(lang='zh') {
    await page.goto(base+'?level=3&lang='+lang);await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
    await page.evaluate(()=>{
      const g=game;g.wand=g.bridgeOpen=true;g.hearts=1;g.enemies.forEach(e=>e.hp=0);g.encounterGateProgress=1;g.encounterGate.body.setEnabled(false);
      g.body.setTranslation({x:85,y:.8,z:.7},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.render(0);
    });
  }
  await prepare();await page.keyboard.press('KeyE');
  assert.equal(await page.locator('#chest-question').innerText(),'想让小船的船帆鼓起来，需要什么？');
  assert.deepEqual(await page.locator('.chest-quiz-choices b').allTextContents(),['风','石头','泥土']);
  const closed=()=>page.evaluate(()=>!game.chestOpened&&!game.treasure&&game.chestProgress===0&&game.hearts===1);
  assert.ok(await closed());assert.equal(await page.evaluate(()=>game.active()),false);
  await page.locator('[data-chest-answer="stone"]').focus();
  await page.keyboard.press('KeyW');await page.keyboard.press('Space');await page.keyboard.press('Shift');await page.keyboard.press('KeyE');
  assert.equal(await page.evaluate(()=>game.keys.size),0,'Question input must not move or attack in the game');
  await page.locator('[data-chest-answer="stone"]').click();assert.ok(await closed());
  await page.locator('[data-chest-answer="soil"]').click();assert.ok(await closed());
  assert.match(await page.locator('#chest-quiz-feedback').innerText(),/树叶轻轻摇动/);
  const layouts=[];
  for(const [name,width,height] of [['desktop',1280,800],['portrait',390,844],['landscape',844,390]]) {
    await page.setViewportSize({width,height});await page.evaluate(()=>{game.resize();game.render(0);});
    const layout=await page.evaluate(()=>{
      const q=game.chestQuiz,r=q.getBoundingClientRect();
      return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,scroll:q.scrollHeight,client:q.clientHeight,
        buttons:[...q.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};})};
    });
    assert.ok(layout.x>=0&&layout.y>=0&&layout.right<=width&&layout.bottom<=height,JSON.stringify(layout));
    assert.ok(layout.buttons.every(b=>b.w>=44&&b.h>=44&&b.y>=0&&b.bottom<=height),JSON.stringify(layout));
    layouts.push({name,...layout});await page.screenshot({path:`${output}/${name}.png`});
  }
  await page.locator('#chest-quiz-close').focus();
  for(let i=0;i<3;i++) {
    await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>game.chestQuiz.contains(document.activeElement)),'Tab visits modal answers instead of background game controls');
  }
  await page.keyboard.press('Escape');assert.ok(await page.evaluate(()=>!game.chestQuiz.open&&!game.paused));
  await page.keyboard.press('KeyE');assert.ok(await closed());
  await page.evaluate(()=>{game.pause();game.render(0);});assert.ok(await page.evaluate(()=>game.paused&&!game.chestQuiz.open));
  await page.locator('#primary').click();await page.evaluate(()=>game.render(0));await page.keyboard.press('KeyE');
  await page.evaluate(()=>game.reset());assert.ok(await page.evaluate(()=>!game.chestQuiz.open&&!game.chestOpened&&!game.treasure));
  await page.evaluate(()=>{
    game.reducedMotion=true;game.body.setTranslation({x:85,y:.8,z:.7},true);game.previous.copy(game.body.translation());game.render(0);
  });
  await page.locator('#dive').tap();
  await page.locator('[data-chest-answer="wind"]').focus();await page.keyboard.press('Enter');
  assert.ok(await page.evaluate(()=>!game.chestQuiz.open&&game.chestOpened&&game.chestProgress===1&&!game.treasure));
  await page.evaluate(()=>game.render(0));await page.locator('#dive').tap();await page.evaluate(()=>game.render(0));
  assert.ok(await page.evaluate(()=>game.treasure&&!game.chest.getObjectByName('chest-crystal').visible));
  for(const [lang,answer] of [['en','Wind'],['ms','Angin']]) {
    await prepare(lang);await page.keyboard.press('KeyE');assert.equal(await page.locator('[data-chest-answer="wind"] b').innerText(),answer);
    await page.locator('[data-chest-answer="wind"]').click();assert.ok(await page.evaluate(()=>game.chestOpened));
  }
  assert.deepEqual(errors,[]);await writeFile(`${output}/result.json`,JSON.stringify({pass:true,layouts,errors},null,2));
  console.log('PASS exact quiz/choices, both wrong answers retry without loss, correct-only opening, modal input/focus, cancel/pause/reset, touch/keyboard pickup, responsive views and three languages');
} finally {await browser.close();}
