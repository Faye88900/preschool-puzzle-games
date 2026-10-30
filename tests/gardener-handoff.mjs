import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { advanceGarden, nearGarden, collectGardenTool } from './garden-quest-helpers.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
await mkdir('test-results/gardener-handoff-sequence', { recursive: true });
await page.route(/\/src\/journey\.ts(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: 'export function startJourney(){return {arrive:async()=>{},dispose(){}}}' }));
await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: await response.text() + '\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await init.call(this)};const tick=MazeAdventure.prototype.tick;window.tickGarden=()=>{game.last ||= 100;tick.call(game,game.last+50)};MazeAdventure.prototype.tick=function(){};' });
});
async function shot(name) { await page.screenshot({ path: `test-results/gardener-${name}.png` }); }
async function advanceShot() {
  await page.evaluate(() => {
    const draw = game.renderer.render; game.renderer.render = () => {};
    try { for (let i = 0; i < 4; i++) window.tickGarden(); }
    finally { game.renderer.render = draw; }
    game.renderer.render(game.scene, game.camera);
  });
}
async function snapshot() {
  return page.evaluate(() => ({ stage: game.gardenQuest.stage, guide: game.guide.position.toArray(),
    toolHolder: game.gardenQuest.heldTool.parent.parent.name, toolVisible: game.gardenQuest.heldTool.visible,
    foot: game.guide.getObjectByName('foot1').position.toArray(), active: game.active(), wand: game.wand }));
}
try {
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5192/') + '?level=3&lang=zh');
  await page.waitForFunction(() => window.game?.root && window.game?.body, null, { timeout: 90000 });
  await page.locator('.game-loading').waitFor({ state: 'detached', timeout: 90000 });
  await page.locator('#primary').click();
  await collectGardenTool(page); await nearGarden(page, 'gardener');
  assert.ok(await page.evaluate(() => game.player.getObjectByName('arm1').children.includes(game.gardenQuest.heldTool)), 'The recovered trowel must be visible in the player hand');
  await shot('carrying-trowel');
  await page.keyboard.press('KeyE');
  const start = await snapshot();
  assert.equal(start.stage, 'handoff'); assert.ok(!start.wand && !start.active);
  const path = [], stages = new Set();
  for (let frame = 0; frame < 70; frame++) {
    await advanceShot(); const state = await snapshot(); stages.add(state.stage);
    await page.screenshot({ path: `test-results/gardener-handoff-sequence/frame${String(frame).padStart(3, '0')}.png` });
    if (state.stage === 'handoff' && frame === 1) {
      await shot('handoff-desktop');
      await page.keyboard.press('Escape'); const elapsed = await page.evaluate(() => game.gardenQuest.elapsed);
      await advanceGarden(page, .5); assert.equal(await page.evaluate(() => game.gardenQuest.elapsed), elapsed);
      await page.keyboard.press('Escape');
    }
    if (state.stage === 'walking') {
      if (await page.evaluate(() => !!game.dialogue?.lines.includes('gardenerFollow'))) {
        await page.locator('#maze-next').click(); await shot('invitation-desktop'); await page.locator('#maze-next').click();
        continue;
      }
      assert.ok(state.active && state.toolVisible && !state.wand, 'Player keeps control and the gardener carries the trowel before planting');
      path.push(state);
      if (path.length === 3) await shot('walking-desktop');
    }
    if (state.stage === 'digging' && !stages.has('digging-shot')) { await shot('digging-desktop'); stages.add('digging-shot'); }
    if (state.stage === 'plant') break;
  }
  assert.ok(stages.has('handoff') && stages.has('walking') && stages.has('digging') && stages.has('plant'));
  assert.ok(path.length > 5 && path.some((p, i) => i && Math.abs(p.foot[2] - path[i - 1].foot[2]) > .03), 'Feet must visibly step while the NPC moves');
  assert.ok(path.every((p, i) => !i || Math.hypot(p.guide[0] - path[i - 1].guide[0], p.guide[2] - path[i - 1].guide[2]) <= .34), 'Walking must not teleport');
  assert.ok(await page.evaluate(() => game.guide.getObjectByName('arm-1').children.includes(game.gardenQuest.heldTool)), 'The NPC must actually receive the tool');
  const layout = await page.evaluate(async () => {
    const { Box3 } = await import('/node_modules/.vite/deps/three.js');
    const q = game.gardenQuest, beds = [q.bed, ...game.scene.children.filter(o => o.name === 'garden-flower-bed')];
    const boxes = beds.map(b => new Box3().setFromObject(b));
    let finite = true, triangles = 0, meshes = 0;
    q.seedling.traverse(node => { if (node.isMesh) { meshes++; triangles += (node.geometry.index?.count || node.geometry.attributes.position.count) / 3; finite &&= Array.from(node.geometry.attributes.position.array).every(Number.isFinite); } });
    return { centers: beds.map(b => b.position.toArray()), widths: boxes.map(b => b.max.x - b.min.x),
      sign: !!game.scene.getObjectByName('sign-gardener'), overlap: boxes.slice(1).some(b => b.intersectsBox(boxes[0])),
      meshes, triangles, finite, leaves: q.seedling.children.length, grounded: new Box3().setFromObject(q.seedling).min.y };
  });
  assert.ok(Math.abs(layout.centers[0][0] + 36) < .001 && Math.abs(layout.centers[0][2] - 46.4) < .001, 'Quest bed must occupy the player position in the supplied image');
  assert.ok(layout.centers.slice(1).every(p => Math.abs(p[0] + 30) < .001) && Math.abs(layout.centers[1][2] - layout.centers[0][2]) < .001, 'Quest bed sits beside the first decorative bed');
  assert.ok(!layout.sign && !layout.overlap && layout.widths.every(w => Math.abs(w - layout.widths[0]) < .001), 'Remove only the gardener sign and keep the beds separate');
  assert.ok(layout.finite && layout.triangles < 15000 && layout.meshes < 16 && layout.grounded >= -.02 && layout.grounded < .05);
  await nearGarden(page, 'flowerbed'); await shot('flowerbeds-ready-desktop');
  await page.evaluate(() => {
    const p = game.gardenQuest.seedling.position;
    game.camera.position.set(p.x - 1.6, p.y + 1.5, p.z + 2.2); game.camera.lookAt(p.x, p.y + .55, p.z);
    game.renderer.render(game.scene, game.camera);
  });
  await shot('seedling-close');
  await page.evaluate(() => {
    game.camera.position.set(-37, 9, 56); game.camera.lookAt(-33, .4, 46.4); game.renderer.render(game.scene, game.camera);
  });
  await shot('three-flowerbeds');
  await nearGarden(page, 'seedling', 0, 1.2); await page.keyboard.press('KeyE');
  await advanceGarden(page, .3); assert.ok(await page.evaluate(() => game.gardenQuest.seedling.visible && !game.wand));
  await advanceGarden(page, .5); assert.ok(await page.evaluate(() => game.gardenQuest.seedling.parent === game.player && !game.wand));
  await advanceGarden(page, 2.5); assert.ok(await page.evaluate(() => game.gardenQuest.stage === 'watering' && game.gardenQuest.flower.visible && !game.wand));
  await advanceGarden(page, 2.9); assert.ok(await page.evaluate(() => game.wand));
  await page.locator('#maze-close').click();
  await page.setViewportSize({ width: 390, height: 844 }); await nearGarden(page, 'flowerbed'); await shot('flowerbeds-mobile');
  await page.evaluate(() => game.reset()); await collectGardenTool(page, true); await nearGarden(page, 'gardener');
  await page.locator('#dive').tap(); await advanceGarden(page, .6); await shot('handoff-mobile');
  assert.equal(await page.evaluate(() => game.gardenQuest.stage), 'handoff');
  await page.evaluate(() => game.reset());
  assert.ok(await page.evaluate(() => !game.gardenQuest.heldTool.visible && game.guide.getObjectByName('arm-1').children[0].position.y === 0 && game.player.getObjectByName('arm1').children[0].position.y === 0));
  assert.deepEqual(errors, []);
  console.log('PASS visible trowel handoff, pause/reset, stepping NPC, player control, aligned beds, grounded seedling, planting and delayed reward, desktop/touch', layout);
} finally { await browser.close(); }
