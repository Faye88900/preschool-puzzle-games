import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  page.setDefaultTimeout(90000);
  await mkdir('artifacts/flower-choir/sleep-frames', { recursive: true });
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/, r => r.fulfill({ contentType: 'text/javascript', body: 'export function startJourney(){return {arrive:async()=>{},dispose(){}}}' }));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + '\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;return init.call(this)};MazeAdventure.prototype.tick=function(){};' });
  });
  await page.goto('http://127.0.0.1:5208/?level=3&lang=zh');
  await page.locator('.game-loading').waitFor({ state: 'detached' }); await page.locator('#primary').click();
  await page.evaluate(() => {
    const c = game.flowerChoir; c.start(2); c.pause(); c.offset = 21.7; c.animate(21.7, false);
    c.update(0, true, 9, game.settings, false);
    game.camera.position.set(75, 3.3, 2.4); game.camera.lookAt(75, 1, -4.4); game.camera.updateMatrixWorld();
    document.querySelector('#game-ui').style.visibility = 'hidden';
  });
  const heads = [];
  for (let frame = 0; frame < 30; frame++) {
    heads.push(await page.evaluate(dt => {
      const c = game.flowerChoir; c.update(dt, true, 9, game.settings, false); game.renderer.render(game.scene, game.camera);
      return c.flowers[0].head.rotation.x;
    }, frame ? .1 : 0));
    await page.screenshot({ path: `artifacts/flower-choir/sleep-frames/${String(frame).padStart(2, '0')}.png` });
  }
  assert.ok(heads[0] < .001 && heads[8] > .1 && heads[8] < .5 && Math.abs(heads[29] - .55) < .001);
  assert.ok(await page.evaluate(() => game.flowerChoir.status === 'sleeping' && !game.flowerChoir.source));
  console.log('PASS 30 game frames: awake at departure, gradual head lowering and eye closure, sleeping after two seconds');
} finally { await browser.close(); }
