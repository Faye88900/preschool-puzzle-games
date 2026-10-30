import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  page.setDefaultTimeout(90000);
  await mkdir('artifacts/flower-choir/dance-frames', { recursive: true });
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/, r => r.fulfill({ contentType: 'text/javascript', body: 'export function startJourney(){return {arrive:async()=>{},dispose(){}}}' }));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + '\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;return init.call(this)};MazeAdventure.prototype.tick=function(){};' });
  });
  await page.goto('http://127.0.0.1:5208/?level=3&lang=zh');
  await page.locator('.game-loading').waitFor({ state: 'detached' }); await page.locator('#primary').click();
  await page.evaluate(() => {
    game.flowerChoir.start(2); game.flowerChoir.pause();
    game.camera.position.set(75, 3.3, 2.4); game.camera.lookAt(75, 1, -4.4); game.camera.updateMatrixWorld();
    document.querySelector('#game-ui').style.visibility = 'hidden';
  });
  const poses = [];
  for (let frame = 0; frame < 30; frame++) {
    poses.push(await page.evaluate(time => {
      game.flowerChoir.animate(time, false); game.renderer.render(game.scene, game.camera);
      return game.flowerChoir.flowers[0].root.rotation.z;
    }, 6.2 + frame / 10));
    await page.screenshot({ path: `artifacts/flower-choir/dance-frames/${String(frame).padStart(2, '0')}.png` });
  }
  assert.ok(Math.max(...poses) - Math.min(...poses) > .25, 'The instrumental intro must visibly sway');
  console.log('PASS 30 actual game frames during the instrumental intro, before vocals');
} finally { await browser.close(); }
