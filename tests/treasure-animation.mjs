import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='artifacts/models/treasure-animation',errors=[];
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'no-preference'});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route(/\/assets\/maze-[^/]+\.js$/,async route=>{
    const response=await route.fetch(),body=await response.text(),name=body.match(/export\{([\w$]+) as MazeAdventure\}/)?.[1];assert.ok(name);
    await route.fulfill({response,body:body+`\nconst init=${name}.prototype.init;${name}.prototype.init=async function(){window.game=this;return init.call(this)};`});
  });
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:4212/')+'?level=3&lang=zh');
  await page.locator('.journey-skip').click();await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  await page.evaluate(()=>{
    const g=game;g.wand=g.bridgeOpen=true;g.bridgeBody.setEnabled(false);g.bridgeProgress=1;g.hearts=1;
    g.enemies.forEach(e=>e.hp=0);g.encounterGateProgress=1;g.encounterGate.body.setEnabled(false);
    g.body.setTranslation({x:85,y:.8,z:.7},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.render(0);
  });
  await page.keyboard.press('KeyE');
  await page.evaluate(()=>{
    const stream=game.renderer.domElement.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'}),chunks=[];
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    window.stopChestRecording=()=>new Promise(resolve=>{
      recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());resolve(Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer())));};recorder.stop();
    });recorder.start();
  });
  await page.locator('[data-chest-answer="wind"]').click();
  await page.waitForFunction(()=>game.chestProgress===1);
  await page.screenshot({path:`${output}/ready.png`});
  await page.waitForTimeout(300);await page.keyboard.press('KeyE');
  assert.ok(await page.evaluate(()=>!!game.crystalPickup&&!game.treasure));
  await page.waitForFunction(()=>game.crystalPickup?.elapsed>.25);
  await page.screenshot({path:`${output}/flying.png`});
  await page.waitForFunction(()=>game.treasure&&!game.crystalPickup);
  assert.ok(await page.evaluate(()=>!game.chest.getObjectByName('chest-crystal').visible&&game.hearts===3));
  await page.screenshot({path:`${output}/collected.png`});await page.waitForTimeout(400);
  const video=await page.evaluate(()=>stopChestRecording());await writeFile(`${output}/open-to-pickup.webm`,Buffer.from(video));
  assert.deepEqual(errors,[]);await writeFile(`${output}/result.json`,JSON.stringify({pass:true,videoBytes:video.length,errors},null,2));
  console.log('PASS production animation: correct answer -> open/rise -> manual pickup -> arc flight/shrink -> inventory, normal game camera; silent WebM saved');
} finally {await browser.close();}
