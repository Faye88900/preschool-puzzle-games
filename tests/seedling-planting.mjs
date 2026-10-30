import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { advanceGarden } from './garden-quest-helpers.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
await mkdir('test-results/seedling-planting-sequence', { recursive: true });
await page.route(/\/src\/journey\.ts(?:\?.*)?$/, r => r.fulfill({ contentType: 'text/javascript', body: 'export function startJourney(){return {arrive:async()=>{},dispose(){}}}' }));
await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async r => {
  const response = await r.fetch();
  await r.fulfill({ response, body: await response.text() + '\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await init.call(this)};const tick=MazeAdventure.prototype.tick;window.tickGarden=()=>{game.last ||= 100;tick.call(game,game.last+50)};MazeAdventure.prototype.tick=function(){};' });
});
async function setup(reduced = false, offset = [0, 1.2]) {
  await page.evaluate(({ reduced, offset }) => {
    game.reset(); game.reducedMotion = reduced; const q = game.gardenQuest; q.stage = 'plant';
    q.bed.getObjectByName('planting-hole').visible = true;
    game.guide.position.copy(q.bed.position).add({ x: -2.95, y: .66, z: 0 });
    const p = q.seedling.position; game.body.setTranslation({ x: p.x + offset[0], y: .8, z: p.z + offset[1] }, true);
    game.body.setLinvel({ x: 0, y: 0, z: 0 }, true); game.previous.copy(game.body.translation()); game.render(0);
  }, { reduced, offset });
}
async function tick() {
  await page.evaluate(() => {
    const draw = game.renderer.render; game.renderer.render = () => {};
    try { window.tickGarden(); window.tickGarden(); }
    finally { game.renderer.render = draw; }
    game.renderer.render(game.scene, game.camera);
  });
}
async function metrics() {
  return page.evaluate(() => {
    const q = game.gardenQuest;
    return { stage: q.stage, player: game.player.position.toArray(), body: game.body.translation(),
      seedling: q.seedling.getWorldPosition(q.pushPoint.clone()).toArray(), attached: q.seedling.parent === game.player,
      can: q.can.visible, wand: game.wand, visible: q.seedling.visible,
      hands: [-1, 1].map(side => game.player.getObjectByName('arm' + side).children[0].getWorldPosition(q.pushPoint.clone())
        .distanceTo(q.seedling.localToWorld(q.pushPoint.clone().set(side * .24, .12, 0)))) };
  });
}
try {
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5192/') + '?level=3&lang=zh');
  await page.waitForFunction(() => window.game?.body && window.game?.root, null, { timeout: 90000 });
  await page.locator('.game-loading').waitFor({ state: 'detached', timeout: 90000 }); await page.locator('#primary').click();
  const counts = await page.evaluate(() => [game.world.bodies.len(), game.world.colliders.len()]);
  await setup(); const start = await metrics(); await page.keyboard.press('KeyE');
  for (let frame = 0; frame < 32; frame++) {
    await tick(); const m = await metrics();
    await page.screenshot({ path: `test-results/seedling-planting-sequence/frame${String(frame).padStart(3, '0')}.png` });
    if (frame === 2) assert.deepEqual(m.seedling, start.seedling, 'Seedling stays on the ground until the player reaches it');
    if (frame === 7 || frame === 14) {
      assert.ok(m.attached && m.hands.every(gap => gap < .025), 'Both hands must hold the rootball while carrying');
      assert.ok(!m.can && !m.wand && m.stage === 'planting');
      assert.ok(Math.abs(m.player[0] - m.body.x) < .001 && Math.abs(m.player[2] - m.body.z) < .001);
    }
    if (frame === 14) {
      assert.ok(Math.hypot(m.player[0] - start.player[0], m.player[2] - start.player[2]) > .25, 'Player must walk with the seedling');
      await page.keyboard.press('Escape'); const paused = await metrics(); await advanceGarden(page, 1);
      const frozen = await metrics();
      assert.deepEqual(frozen.body, paused.body);
      assert.ok(frozen.stage === paused.stage && frozen.attached && frozen.seedling.every((v, i) => Math.abs(v - paused.seedling[i]) < .0001), 'Pause freezes the pose and held plant');
      await page.keyboard.press('Escape');
    }
    if (frame === 27) assert.ok(!m.attached && m.visible && !m.can, 'Plant stays in the hole during the soil pats, before watering');
  }
  await advanceGarden(page, .1); assert.equal((await metrics()).stage, 'watering');
  await page.screenshot({ path: 'test-results/seedling-planted-desktop.png' });
  await page.screenshot({ path: 'test-results/seedling-planting-sequence/frame032.png' });
  assert.ok(!(await metrics()).attached && !(await metrics()).visible && !(await metrics()).wand);
  for (let frame = 33; frame <= 60; frame++) {
    await tick(); await page.screenshot({ path: `test-results/seedling-planting-sequence/frame${String(frame).padStart(3, '0')}.png` });
  }
  assert.ok((await metrics()).wand);
  // Reset while holding the plant must detach it and restore its starting position.
  await setup(); await page.keyboard.press('KeyE'); await advanceGarden(page, 1.3);
  assert.ok((await metrics()).attached); await page.evaluate(() => game.reset());
  assert.ok(await page.evaluate(() => game.gardenQuest.seedling.parent === game.scene && game.player.getObjectByName('avatar').rotation.x === 0 && game.player.getObjectByName('arm1').children[0].position.y === 0));
  // Opposite approach and reduced-motion touch input share the same complete action.
  await page.setViewportSize({ width: 390, height: 844 }); await setup(true, [1, .3]);
  await page.locator('#dive').tap(); await advanceGarden(page, 1.3);
  assert.ok((await metrics()).attached && (await metrics()).hands.every(gap => gap < .025));
  await page.screenshot({ path: 'test-results/seedling-held-mobile.png' });
  await advanceGarden(page, 2.1); assert.equal((await metrics()).stage, 'watering');
  await advanceGarden(page, 1); assert.ok((await metrics()).wand);
  assert.deepEqual(await page.evaluate(() => [game.world.bodies.len(), game.world.colliders.len()]), counts);
  assert.deepEqual(errors, []);
  console.log('PASS one-action lift, two-hand attachment, synchronized carrying, place/pat before watering, pause/reset, keyboard/touch/reduced motion and delayed reward');
} finally { await browser.close(); }
