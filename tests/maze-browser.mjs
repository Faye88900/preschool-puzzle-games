import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { collectGardenTool, plantGarden } from './garden-quest-helpers.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', hasTouch: true });
page.setDefaultTimeout(90000);
const errors = []; page.on('pageerror', e => { errors.push(e.message); console.log('PAGE ERROR',e.message); });
page.on('console', msg => {if(msg.type()==='error'){errors.push(msg.text());console.log('CONSOLE',msg.text());}});
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
await mkdir('test-results', { recursive: true });
await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: await response.text() + '\nconst originalInit=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await originalInit.call(this)};' });
});
async function near(name, dx=0, dz=0) {
  await page.evaluate(async ({name,dx,dz}) => { const {at}=await import('/src/maze-map.ts');const p=at(name),g=window.game;g.body.setTranslation({x:p.x+dx,y:.8,z:p.z+dz},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.render(0); }, {name,dx,dz});
  const shadow = await page.evaluate(() => {
    const g = window.game, p = g.player.position.clone().project(g.sun.shadow.camera);
    return { mapped: !!g.sun.shadow.map, inside: Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)) < 1 };
  });
  assert.ok(shadow.mapped && shadow.inside, `Player must stay inside the rendered sun shadow at ${name}`);
}
async function action(){await page.keyboard.press('KeyE');}
async function dismiss(){while(await page.locator('.maze-dialogue').isVisible())await page.locator('#maze-next').click();await page.waitForFunction(()=>game.active());}
try {
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5199/')+'?level=3&lang=zh');
  await page.locator('.game-loading').waitFor({state:'detached',timeout:90000});
  await page.locator('#primary').click();
  console.log('loaded');
  const z=await page.evaluate(()=>game.body.translation().z);
  await page.keyboard.down('ArrowRight');await page.waitForFunction(()=>game.body.translation().x>-9);await page.keyboard.up('ArrowRight');
  assert.ok(Number.isFinite(z));
  await page.screenshot({path:'test-results/maze-desktop.png'});
  // Compare actual canvas pixels to ensure the sun casts visible shadows.
  const shadowPixels = await page.evaluate(() => {
    const g = window.game, gl = g.renderer.getContext(), canvas = g.renderer.domElement;
    const sample = () => {
      g.renderer.render(g.scene, g.camera);
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    const shadowed = sample(); g.sun.castShadow = false;
    const unshadowed = sample(); g.sun.castShadow = true; g.renderer.render(g.scene, g.camera);
    let changed = 0;
    for (let i = 0; i < shadowed.length; i += 4) if (unshadowed[i] - shadowed[i] > 8) changed++;
    return changed;
  });
  assert.ok(shadowPixels > 1000, `Expected visible ground shadows, got ${shadowPixels} affected pixels`);
  console.log('Sun shadow pixels', shadowPixels);
  // Check authored connectivity, including both progression locks.
  const connectivity=await page.evaluate(async()=>{
    const {maze,spots,position,walkable}=await import('/src/maze-map.ts');
    function reachable(bridge,shortcut,exit){const seen=new Set(),q=[spots.spawn];while(q.length){const [c,r]=q.shift(),id=c+','+r;if(seen.has(id))continue;const p=position(c,r);if(!walkable(p.x,p.z,bridge,shortcut,exit))continue;seen.add(id);for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]])if(maze[r+dz]?.[c+dx])q.push([c+dx,r+dz]);}return Object.fromEntries(Object.entries(spots).map(([k,p])=>[k,seen.has(p.join(','))]));}
    return [reachable(false,false,false),reachable(true,false,false),reachable(true,true,true)];
  });
  assert.ok(connectivity[0].tools&&connectivity[0].gardener);assert.equal(connectivity[0].boss,false);assert.equal(connectivity[0].finish,false);assert.equal(connectivity[1].boss,false);assert.ok(connectivity[1].dock);assert.ok(connectivity[2].finish);
  await near('gardener',0,-1.8);await action();await dismiss();
  await collectGardenTool(page);
  await plantGarden(page);await dismiss();assert.ok(await page.evaluate(()=>game.wand));
  await near('bridge',-6,0);await action();await page.waitForFunction(()=>game.bridgeOpen);console.log('quest and bridge');
  await page.evaluate(() => {game.reducedMotion=false;});
  await near('practice',0,5.5);await action();
  await page.waitForFunction(() => game.encounterGateProgress>0&&game.encounterGateProgress<1);
  await page.locator('#pause').click();
  const pausedGate=await page.evaluate(() => game.encounterGateProgress);
  await page.waitForTimeout(450);
  assert.equal(await page.evaluate(() => game.encounterGateProgress),pausedGate,'Pausing freezes the leaf gate opening');
  await page.locator('#primary').click();await page.waitForFunction(() => game.encounterGateProgress===1);
  assert.ok(await page.evaluate(() => !game.encounterGate.body.isEnabled()&&game.enemies[0].hp===0&&!game.key),'First knight opens only its own gate');
  await page.evaluate(() => {game.reducedMotion=true;});console.log('first knight and gate, pause/resume');
  await near('chest',0,1.5);await action();await page.locator('[data-chest-answer="wind"]').click();assert.ok(await page.evaluate(()=>game.chestOpened&&!game.treasure));
  await page.waitForFunction(()=>game.chestProgress===1);await action();assert.ok(await page.evaluate(()=>game.treasure&&!game.chest.getObjectByName('chest-crystal').visible));
  await near('dock');await action();await page.waitForFunction(()=>game.boatAtBossIsland&&!game.boatTrip);
  await near('boss',0,5.5);
  await action();assert.equal(await page.evaluate(()=>game.enemies[2].hp),3);
  for(let i=0;i<3;i++){
    await page.waitForFunction(()=>game.enemies[2].phase==='rest'&&game.cooldown===0);
    await action();await page.waitForFunction(hp=>game.enemies[2].hp===hp,2-i);
  }
  await near('boss',0,1);await action();assert.ok(await page.evaluate(()=>game.key));console.log('guardian and key');
  await page.evaluate(()=>{game.hearts=1;game.invulnerable=0;game.hurt()});assert.ok(await page.evaluate(()=>game.wand&&game.key&&game.bridgeOpen&&game.hearts===3&&game.encounterGateProgress===1&&!game.encounterGate.body.isEnabled()));
  await near('bossDock');await action();await page.waitForFunction(()=>!game.boatAtBossIsland&&!game.boatTrip);
  await near('exit',0,2);await action();await near('finish');await page.waitForFunction(()=>game.state==='qualified');
  await page.screenshot({path:'test-results/maze-win.png'});
  await page.locator('#primary').click();assert.ok(await page.evaluate(()=>!game.wand&&!game.key&&!game.bridgeOpen&&game.enemies[2].hp===3&&game.encounterGateProgress===0&&game.encounterGate.body.isEnabled()));
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/maze-mobile.png'});
  await page.locator('#pause').click();assert.ok(await page.evaluate(()=>game.paused));await page.locator('#primary').click();
  await near('gardener',0,-1.8);await page.locator('#dive').tap();
  assert.ok(await page.locator('.maze-dialogue').isVisible());await page.screenshot({path:'test-results/maze-dialogue-mobile.png'});await dismiss();
  assert.deepEqual(errors,[]); console.log('PASS: movement, progression gates, NPC, tool, bridge, chest, shield, guardian, key, recovery, win, reset, mobile dialogue and pause');
  console.log(await page.evaluate(()=>({calls:game.renderer.info.render.calls,triangles:game.renderer.info.render.triangles})));
} catch(error) {console.log(await page.evaluate(()=>({state:game.state,paused:game.paused,story:game.gardenerStory.stage,elapsed:game.gardenerStory.elapsed,quest:game.gardenQuest.stage,reduced:game.reducedMotion,dialogue:game.dialogue})));console.log(await page.locator('body').innerText());await page.screenshot({path:'test-results/maze-failure.png'});throw error;} finally {await browser.close();}
