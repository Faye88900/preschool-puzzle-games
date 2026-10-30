import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const production=process.env.PRODUCTION==='1',output=`artifacts/models/garden-scout-v2/${production?'production':'scene'}`;
const browser=await chromium.launch({headless:true}),errors=[];
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route(production?/\/assets\/maze-[^/]+\.js$/:/\/src\/maze\.ts(?:\?.*)?$/,async route=>{
    const response=await route.fetch(),body=await response.text();
    const name=production?body.match(/export\{([\w$]+) as MazeAdventure\}/)?.[1]:'MazeAdventure';assert.ok(name);
    await route.fulfill({response,body:body+`\nconst init=${name}.prototype.init;${name}.prototype.init=async function(){window.game=this;return init.call(this)};${name}.prototype.tick=function(){};`});
  });
  if(!production)await page.route(/\/src\/journey\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:'export function startJourney(){return {arrive:async()=>{},dispose(){}}}'}));
  const base=process.env.TEST_URL||'http://127.0.0.1:5212/';
  await page.goto(base+'?level=3&lang=zh');
  if(production)await page.locator('.journey-skip').click();
  await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  const prepare=()=>page.evaluate(()=>{
    const g=game;g.reset();g.wand=g.bridgeOpen=true;
    g.enemies[2].hp=3;g.hearts=1;
    g.body.setTranslation({x:g.scout.position.x-2,y:.8,z:g.scout.position.z},true);
    g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.render(0);
  });
  await prepare();
  assert.ok(await page.evaluate(()=>game.scout.name==='garden-scout'&&game.scout.getObjectByName('scout-leaf-hood')&&game.scout.getObjectByName('scout-pinwheel')));
  const behavior=await page.evaluate(()=>{
    const g=game,yaw=g.scout.rotation.y,angles=[],cameraOffsets=[];
    for(const [dx,dz] of [[-2,0],[2,0],[0,-2],[0,2]]) {
      const p={x:g.scout.position.x+dx,y:.8,z:g.scout.position.z+dz};
      g.body.setTranslation(p,true);g.previous.copy(p);g.render(0);
      angles.push(g.scout.rotation.y);cameraOffsets.push([g.camera.position.x-p.x,g.camera.position.z-p.z]);
    }
    g.time=1;g.render(0);const first=g.scout.getObjectByName('arm1').rotation.z;
    g.time=1.25;g.render(0);const second=g.scout.getObjectByName('arm1').rotation.z;
    const raised=g.scout.getObjectByName('arm1').children[0].getWorldPosition(g.player.position.clone()).y;
    g.time=3.5;g.render(0);const waiting=g.scout.getObjectByName('arm1').rotation.z;
    const near={x:g.scout.position.x-2,y:.8,z:g.scout.position.z};
    g.body.setTranslation({...near,x:near.x-10},true);g.previous.copy(g.body.translation());g.render(0);
    const rest=g.scout.getObjectByName('arm1').rotation.z;
    const boots=g.scout.getObjectByName('scout-boot-details');
    return {yaw,angles,cameraOffsets,first,second,raised,waiting,rest,boots:!!boots,render:{...g.renderer.info.render}};
  });
  assert.ok(behavior.angles.every(a=>a===behavior.yaw),'NPC must retain its authored facing from all player positions');
  assert.ok(behavior.cameraOffsets.every(a=>a.every((n,i)=>Math.abs(n-behavior.cameraOffsets[0][i])<.001)),'Game camera keeps its normal player offset');
  assert.ok(behavior.first>1&&behavior.second>1&&Math.abs(behavior.first-behavior.second)>.01&&behavior.raised>.7,'Nearby greeting raises and waves the free hand');
  assert.equal(behavior.waiting,.05,'Nearby greeting must finish and return to waiting');
  assert.equal(behavior.rest,.05);assert.ok(behavior.boots);
  const captureScout=async name=>{
    await page.evaluate(()=>{
      const g=game,p=g.scout.position;
      g.camera.position.set(p.x+1.5,2.7,p.z+4);g.camera.lookAt(p.x,.7,p.z);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);
    });
    await page.screenshot({path:`${output}/${name}.png`,clip:{x:420,y:160,width:440,height:520}});
    await page.evaluate(()=>game.render(0));
  };
  await prepare();
  const idleStart=await page.evaluate(()=>{
    const g=game;g.body.setTranslation({x:g.scout.position.x-10,y:.8,z:g.scout.position.z},true);g.previous.copy(g.body.translation());
    g.time=3.8;g.render(0);const check=g.scout.userData.scoutIdle.phase;
    for(const t of [9,9.2,9.4,11]){g.time=t;g.render(0);}
    return {check,read:g.scout.userData.scoutIdle.phase,map:g.scout.getObjectByName('scout-open-map').visible,active:g.active(),dialogue:!!g.dialogue};
  });
  assert.deepEqual(idleStart,{check:'checking-wind',read:'reading-map',map:true,active:true,dialogue:false});
  await captureScout('reading-map-close');
  const idleApproach=await page.evaluate(()=>{
    const g=game;g.time=13.7;g.render(0);const look=g.scout.userData.scoutIdle.phase;
    g.body.setTranslation({x:g.scout.position.x-2,y:.8,z:g.scout.position.z},true);g.previous.copy(g.body.translation());
    g.time=13.75;g.render(0);const stow=g.scout.userData.scoutIdle.phase;
    for(const t of [13.95,14.15,14.35,15.35]){g.time=t;g.render(0);}
    const greeting=g.scout.userData.scoutIdle.phase,map=g.scout.getObjectByName('scout-open-map').visible;
    g.time=16.9;g.render(0);return {look,stow,greeting,map,waiting:g.scout.userData.scoutIdle.phase,active:g.active()};
  });
  assert.deepEqual(idleApproach,{look:'looking-up',stow:'stowing-map',greeting:'greeting',map:false,waiting:'attentive',active:true});
  await prepare();
  await page.screenshot({path:`${output}/garden.png`});
  await captureScout('scout-feet-close');
  await page.keyboard.press('KeyE');
  await page.evaluate(()=>game.render(0));assert.equal(await page.evaluate(()=>game.scout.userData.scoutIdle.phase),'talking');
  assert.match(await page.locator('#maze-line').innerText(),/风芽向导芽芽/);
  await page.waitForFunction(()=>{const i=game.dialogueBox.querySelector('img');return i.complete&&i.naturalWidth>0&&i.src.includes('garden-scout-dialogue/greeting.webp');});
  await page.screenshot({path:`${output}/greeting-dialogue.png`});
  assert.ok(await page.evaluate(()=>game.hearts===3&&!game.chestOpened&&!game.treasure&&!game.key));
  await page.locator('#maze-next').click();
  assert.match(await page.locator('#maze-line').innerText(),/答对小问题/);
  await page.waitForFunction(()=>{const i=game.dialogueBox.querySelector('img');return i.complete&&i.naturalWidth>0&&i.src.includes('garden-scout-dialogue/thinking.webp');});
  const layouts=[];
  for(const [name,width,height] of [['desktop',1280,800],['portrait',390,844],['landscape',844,390]]) {
    await page.setViewportSize({width,height});await page.evaluate(()=>{game.resize();game.render(0);});
    const layout=await page.evaluate(()=>{
      const rect=s=>{const r=game.dialogueBox.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      return {line:rect('#maze-line'),next:rect('#maze-next'),portrait:rect('.workshop-portrait')};
    });
    for(const r of Object.values(layout))assert.ok(r.x>=0&&r.y>=0&&r.right<=width&&r.bottom<=height,JSON.stringify({name,...layout}));
    assert.ok(layout.next.width>=44&&layout.next.height>=44);layouts.push({name,...layout});
    await page.screenshot({path:`${output}/${name}-dialogue.png`});
  }
  await page.locator('#maze-next').click();assert.ok(await page.evaluate(()=>!game.dialogue));
  await page.evaluate(()=>game.talk('gardenerName',['gardenerHello','playerTrail'],true));
  assert.match(await page.locator('.workshop-portrait img').getAttribute('src'),/\/images\/gardener-puzzled\.png$/);
  await page.evaluate(()=>{game.dialogue.index=1;game.showLine();});
  assert.match(await page.locator('.workshop-portrait img').getAttribute('src'),/\/images\/player-dialogue\/thinking\.png$/);
  await page.evaluate(()=>game.closeDialogue());
  const cues=await page.evaluate(()=>{
    const g=game,result=[g.scoutCue()];g.chestOpened=true;result.push(g.scoutCue());
    g.crystalPickup={elapsed:0};result.push(g.scoutCue());g.crystalPickup=undefined;
    g.treasure=true;result.push(g.scoutCue());g.enemies[2].hp=0;result.push(g.scoutCue());
    g.key=true;result.push(g.scoutCue());g.exitOpen=true;result.push(g.scoutCue());return result;
  });
  assert.deepEqual(cues,['scoutChest','scoutCollect','crystalFlying','scoutBoat','scoutKeyWaiting','scoutKey','scoutExit']);
  const expressions=[];
  for(const [line,expression] of [['scoutHello','greeting'],['scoutChest','thinking'],['scoutCollect','surprised'],['crystalFlying','surprised'],['scoutBoat','guiding'],['scoutKeyWaiting','encouraging'],['scoutKey','celebrating'],['scoutExit','celebrating']]) {
    await page.evaluate(line=>game.talk('scoutName',[line]),line);
    await page.waitForFunction(expression=>{const i=game.dialogueBox.querySelector('img');return i.src.endsWith(`/garden-scout-dialogue/${expression}.webp`)&&i.complete&&i.naturalWidth>0;},expression);
    const alpha=await page.evaluate(()=>{
      const i=game.dialogueBox.querySelector('img'),c=document.createElement('canvas');c.width=c.height=64;
      const context=c.getContext('2d');context.drawImage(i,0,0,64,64);const pixels=context.getImageData(0,0,64,64).data;
      let transparent=0,opaque=0;for(let p=3;p<pixels.length;p+=4){if(pixels[p]===0)transparent++;if(pixels[p]>=250)opaque++;}
      return {width:i.naturalWidth,height:i.naturalHeight,transparent:transparent/4096,opaque:opaque/4096,corners:[3,63*4+3,63*64*4+3,4095*4+3].map(p=>pixels[p])};
    });
    assert.ok(alpha.width===512&&alpha.height===512&&alpha.transparent>.15&&alpha.opaque>.2,JSON.stringify(alpha));
    assert.deepEqual(alpha.corners,[0,0,0,0]);expressions.push({line,expression,...alpha});
  }
  await page.evaluate(()=>game.closeDialogue());
  await prepare();await page.keyboard.press('KeyH');assert.equal(await page.evaluate(()=>game.message),'scoutChest');
  assert.ok(await page.evaluate(()=>{const g=game;g.time=2;g.render(0);g.pause();const r=g.scout.getObjectByName('scout-pinwheel').rotation.z;g.time=5;g.render(0);return r===g.scout.getObjectByName('scout-pinwheel').rotation.z;}));
  await page.evaluate(()=>{game.pause();game.reducedMotion=true;game.render(0);});
  assert.equal(await page.evaluate(()=>game.scout.getObjectByName('scout-pinwheel').rotation.z),0);
  await page.evaluate(()=>game.reset());assert.equal(await page.evaluate(()=>game.scoutCue()),'scoutChest');
  if(!production) {
    await page.close();
    const overview=await browser.newPage({viewport:{width:1200,height:920}});
    const titles={greeting:'招呼',thinking:'思考',surprised:'惊讶',guiding:'指路',encouraging:'鼓励',celebrating:'开心庆祝'};
    await overview.setContent(`<html lang="zh"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:24px 36px;background:#f6f3e9;color:#365847;font-family:'Microsoft YaHei',sans-serif}h1{font-size:28px;margin:0 0 18px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{background:#fffdf5;border:1px solid #d6dfcb;border-radius:22px;height:394px;text-align:center;padding:8px}img{display:block;width:348px;height:348px;object-fit:contain;margin:auto}b{font-size:20px}</style><h1>芽芽 · 对话表情立绘</h1><main>${Object.entries(titles).map(([name,title])=>`<div class="card"><img src="${base}images/garden-scout-dialogue/${name}.webp"><b>${title}</b></div>`).join('')}</main></html>`);
    await overview.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth===512));
    await overview.bringToFront();await overview.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await overview.screenshot({path:'artifacts/portraits/garden-scout-2026-10-27/expressions-overview.png'});await overview.close();
  }
  assert.deepEqual(errors,[]);await writeFile(`${output}/result.json`,JSON.stringify({pass:true,behavior,idleStart,idleApproach,cues,expressions,layouts,errors},null,2));
  console.log('PASS idle wind/map cycle, stow before one greeting, waiting/talking, fixed facing, six portraits, responsive layouts, pause/reset and quest behavior');
} finally {await browser.close();}
