import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),errors=[],output='artifacts/models/treasure-v2/production';
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route(/\/assets\/maze-[^/]+\.js$/,async route=>{
    const response=await route.fetch(),body=await response.text();
    const name=body.match(/export\{([\w$]+) as MazeAdventure\}/)?.[1];assert.ok(name);
    await route.fulfill({response,body:body+`\nconst init=${name}.prototype.init;${name}.prototype.init=async function(){window.game=this;return init.call(this)};`});
  });
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:4212/')+'?level=3&lang=zh');
  await page.locator('.journey-skip').click();await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  await page.evaluate(()=>{
    const g=game;g.wand=g.bridgeOpen=true;g.bridgeBody.setEnabled(false);g.bridgeProgress=1;
    g.enemies.forEach(e=>e.hp=0);g.encounterGateProgress=1;g.encounterGate.body.setEnabled(false);
    g.body.setTranslation({x:85,y:.8,z:.7},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.render(0);
  });
  await page.keyboard.press('KeyE');
  assert.ok(await page.evaluate(()=>game.chestQuiz.open&&!game.chestOpened&&!game.treasure));
  await page.locator('[data-chest-answer="stone"]').click();
  assert.ok(await page.evaluate(()=>game.chestQuiz.open&&!game.chestOpened&&!game.treasure));
  await page.screenshot({path:`${output}/quiz-desktop.png`});
  await page.locator('[data-chest-answer="wind"]').click();
  assert.ok(await page.evaluate(()=>game.chestOpened&&!game.treasure));
  await page.waitForFunction(()=>game.chestProgress===1);
  assert.ok(await page.evaluate(()=>game.chest.getObjectByName('chest-crystal').visible&&!game.treasure));
  await page.screenshot({path:`${output}/ready-desktop.png`});
  await page.setViewportSize({width:390,height:844});
  await page.locator('#dive').tap();await page.waitForFunction(()=>game.treasure);
  await page.waitForFunction(()=>!game.chest.getObjectByName('chest-crystal').visible&&!game.chest.getObjectByName('chest-reward-glow').visible);
  assert.ok(await page.evaluate(()=>game.chest.getObjectByName('lid').rotation.x===1.9));
  await page.screenshot({path:`${output}/collected-portrait.png`});
  await page.locator('#pause').click();await page.locator('#primary').click();
  assert.ok(await page.evaluate(()=>!game.chest.getObjectByName('chest-crystal').visible));
  await page.evaluate(()=>game.reset());
  assert.ok(await page.evaluate(()=>!game.chestOpened&&!game.treasure&&game.chestProgress===0));
  assert.deepEqual(errors,[]);await writeFile(`${output}/result.json`,JSON.stringify({pass:true,errors},null,2));
  console.log('PASS built dist with real tick: keyboard open, rising reward, mobile pickup/disappearance, empty open chest, pause and reset');
} finally {await browser.close();}
