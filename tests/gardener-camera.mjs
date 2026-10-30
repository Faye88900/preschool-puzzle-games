import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { advanceGarden, nearGarden, collectGardenTool } from './garden-quest-helpers.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
await mkdir('test-results', { recursive: true });
await page.route(/\/src\/journey\.ts(?:\?.*)?$/, r => r.fulfill({ contentType: 'text/javascript', body: 'export function startJourney(){return {arrive:async()=>{},dispose(){}}}' }));
await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async r => {
  const response = await r.fetch();
  await r.fulfill({ response, body: await response.text() + '\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await init.call(this)};const tick=MazeAdventure.prototype.tick;window.tickGarden=dt=>{game.last ||= 100;tick.call(game,game.last+dt*1000)};MazeAdventure.prototype.tick=function(){};' });
});
try {
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5192/') + '?level=3&lang=zh');
  await page.waitForFunction(() => window.game?.body && window.game?.root, null, { timeout: 90000 });
  await page.locator('.game-loading').waitFor({ state: 'detached', timeout: 90000 }); await page.locator('#primary').click();
  await collectGardenTool(page); await nearGarden(page, 'gardener'); await page.keyboard.press('KeyE'); await advanceGarden(page, 1.3);
  assert.ok(await page.evaluate(() => !!game.dialogue?.lines.includes('gardenerFollow')));
  await page.locator('#maze-next').click(); await page.locator('#maze-next').click();
  const traces = [];
  for (const [stage, hz, mobile] of [['walking', 60, false], ['digging', 30, false], ['plant', 30, true]]) {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(stage => {
      game.gardenQuest.stage = stage; game.gardenQuest.elapsed = 0;
      game.body.setTranslation({ x: -40, y: .8, z: 42 }, true); game.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      game.previous.copy(game.body.translation());
    }, stage);
    assert.ok(await page.evaluate(() => game.active()), 'Walking, NPC digging and awaiting planting must leave player control active');
    for (const key of ['ArrowRight', 'ArrowLeft']) {
      await page.keyboard.down(key);
      const trace = await page.evaluate(({ hz }) => {
        const samples = [], draw = game.renderer.render; game.renderer.render = () => {};
        try {
          for (let i = 0; i < hz * 1.6; i++) {
            const before = game.camera.position.clone(), beforeLook = game.cameraLook.clone(); window.tickGarden(1 / hz);
            const p = game.player.position, portrait = innerWidth < innerHeight;
            const expected = before.lerp(game.cameraGoal, 1 - Math.exp(-5 / hz));
            const aim = p.clone().set(p.x, Math.max(0, p.y) * .32 + 1.8, p.z - 8);
            samples.push({ x: p.x, z: p.z, stage: game.gardenQuest.stage, active: game.active(),
              goalOffset: game.cameraGoal.clone().sub(p).toArray(),
              followError: game.camera.position.distanceTo(expected), lookError: game.cameraLook.distanceTo(beforeLook.lerp(aim, 1 - Math.exp(-5 / hz))),
              distance: Math.hypot(p.x - game.gardenQuest.bed.position.x, p.z - game.gardenQuest.bed.position.z), portrait });
          }
        } finally { game.renderer.render = draw; }
        game.renderer.render(game.scene, game.camera); return samples;
      }, { hz });
      await page.keyboard.up(key);
      assert.ok(trace.every(s => s.active && Math.abs(s.goalOffset[0]) < .001 && Math.abs(s.goalOffset[2] - (mobile ? 18 : 16)) < .001), 'Camera must follow the player without a flowerbed offset or a movement lock');
      assert.ok(trace.every(s => s.followError < .001 && s.lookError < .001), 'Follow position and aim must ease continuously, without a second camera rewrite');
      assert.ok(Math.abs(trace.at(-1).x - trace[0].x) > 5, 'Real movement must continue while approaching and leaving the flowerbed');
      assert.ok(trace.some(s => s.distance < 4.8) && trace.some(s => s.distance > 5.2), 'Exercise both sides of the former camera-lock boundary');
      traces.push({ stage, hz, key, trace });
    }
    await page.screenshot({ path: `test-results/gardener-camera-${stage}.png` });
  }
  await writeFile('test-results/gardener-camera-traces.json', JSON.stringify(traces));
  assert.deepEqual(errors, []);
  console.log('PASS handoff confirmation -> normal player follow, no flowerbed snap, free movement during NPC digging, 30/60 FPS and portrait');
} finally { await browser.close(); }
