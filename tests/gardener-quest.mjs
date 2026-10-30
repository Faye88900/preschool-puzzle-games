import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { advanceGarden, nearGarden, collectGardenTool, plantGarden } from './garden-quest-helpers.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
page.setDefaultTimeout(60000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
await mkdir('test-results', { recursive: true });
await page.route(/\/src\/journey\.ts(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: 'export function startJourney(){return {arrive:async()=>{},dispose(){}}}' }));
await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: await response.text() + '\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await init.call(this)};MazeAdventure.prototype.tick=function(){};' });
});
async function shot(name) { await page.screenshot({ path: `test-results/gardener-quest-${name}.png` }); }
try {
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5192/') + '?level=3&lang=zh');
  await page.waitForFunction(() => window.game?.root && window.game?.body);
  await page.locator('.game-loading').waitFor({ state: 'detached', timeout: 90000 });
  await page.locator('#primary').click();
  console.log('Quest loaded');
  const counts = await page.evaluate(() => [game.world.bodies.len(), game.world.colliders.len()]);
  await nearGarden(page, 'gardener'); await page.keyboard.press('KeyE');
  assert.equal(await page.locator('#maze-line').innerText(), '这里也没有……你有看到我的小铲子吗？');
  for (let i = 0; i < 4; i++) { await advanceGarden(page, 1.8); await page.locator('#maze-next').click(); }
  await advanceGarden(page, 3.2);
  console.log('Quest introduction and clues');
  assert.ok(await page.evaluate(() => game.active() && !game.wand));
  await page.keyboard.press('KeyH'); await page.evaluate(() => game.render(0)); assert.ok((await page.locator('#guidance').innerText()).includes('小屋后面'));
  await page.keyboard.press('KeyH'); await page.evaluate(() => game.render(0)); assert.ok((await page.locator('#guidance').innerText()).includes('水井'));
  // The eastern route remains walkable; the western route is blocked by the cart.
  async function walkNorth(x, z, steps) {
    await page.evaluate(({ x, z }) => {
      game.body.setTranslation({ x, y: .8, z }, true); game.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }, { x, z });
    await page.keyboard.down('ArrowUp');
    const result = await page.evaluate(steps => { for (let i = 0; i < steps; i++) game.step(); game.render(0); return game.body.translation(); }, steps);
    await page.keyboard.up('ArrowUp'); return result;
  }
  assert.ok((await walkNorth(-30, 30, 320)).z < 15, 'The clue route must remain open');
  assert.ok((await walkNorth(-40, 27, 240)).z > 17, 'The cart must block the short return route');
  await nearGarden(page, 'cart', 0, -3); await page.keyboard.press('KeyE');
  assert.equal(await page.evaluate(() => game.gardenQuest.stage), 'search', 'The cart must not move towards a player on its parking side');
  assert.equal(await page.evaluate(() => game.message), 'cartPushHint');
  await nearGarden(page, 'tools', 2.6, 0);
  assert.notEqual(await page.evaluate(() => game.target()?.action), 'takeTools', 'A covered trowel must not offer pickup');
  assert.ok(await page.evaluate(() => !game.tools && !game.wand), 'A covered trowel cannot be collected');
  await nearGarden(page, 'handles', -.2, 0); await shot('cart-before-desktop'); await page.keyboard.press('KeyE');
  await advanceGarden(page, .6);
  const moving = await page.evaluate(() => game.gardenQuest.cart.position.toArray());
  await page.keyboard.press('Escape'); await advanceGarden(page, 2);
  assert.deepEqual(await page.evaluate(() => game.gardenQuest.cart.position.toArray()), moving, 'Pause must freeze the cart');
  await page.keyboard.press('Escape'); await advanceGarden(page, 1.5);
  assert.equal(await page.evaluate(() => game.gardenQuest.stage), 'tool'); await shot('cart-after-desktop');
  console.log('Quest cart opened');
  assert.ok((await walkNorth(-40, 27, 240)).z < 15, 'Pushing must open the western shortcut');
  await nearGarden(page, 'tools'); await page.keyboard.press('KeyE');
  assert.ok(await page.evaluate(() => game.tools && !game.wand && !game.toolMesh.visible));
  const searches = await page.evaluate(() => {
    const draw = game.renderer.render; game.renderer.render = () => {};
    try {
      return [-4, 4].map(side => {
        game.gardenerStory.reset(); game.gardenerStory.introduced = true;
        const p = game.guide.position;
        game.body.setTranslation({ x: p.x + side, y: .8, z: p.z + 4 }, true); game.previous.copy(game.body.translation());
        const samples = [];
        for (let i = 0; i < 360; i++) {
          game.render(.05);
          if (i % 20 === 0) samples.push({ position: game.guide.position.toArray(), yaw: game.guide.rotation.y,
            lean: game.guide.getObjectByName('guide-torso').rotation.x, foot: game.guide.getObjectByName('foot1').position.y });
        }
        return samples;
      });
    } finally { game.renderer.render = draw; game.render(0); }
  });
  assert.deepEqual(searches[0].map(({ position, yaw }) => ({ position, yaw })), searches[1].map(({ position, yaw }) => ({ position, yaw })), 'Searching while the player carries the trowel must follow its own route, independent of player direction');
  assert.ok(searches[0].some(p => Math.hypot(p.position[0] - searches[0][0].position[0], p.position[2] - searches[0][0].position[2]) > 1), 'Gardener must keep walking before the trowel is returned');
  assert.ok(searches[0].some(p => p.lean < -.2) && searches[0].some((p, i) => i && Math.abs(p.foot - searches[0][i - 1].foot) > .03), 'Search must include looking down and visible steps');
  await page.keyboard.press('Escape'); const pausedSearch = await page.evaluate(() => game.guide.position.toArray());
  await advanceGarden(page, 1); assert.deepEqual(await page.evaluate(() => game.guide.position.toArray()), pausedSearch);
  await page.keyboard.press('Escape');
  await shot('searching-with-trowel');
  await nearGarden(page, 'gardener'); await page.keyboard.press('KeyE');
  assert.ok(await page.evaluate(() => !game.wand && game.gardenQuest.stage === 'handoff'));
  await advanceGarden(page, 1.3);
  assert.equal(await page.locator('#maze-line').innerText(), '谢谢你帮我找回小铲子！');
  const invitedPosition = await page.evaluate(() => game.guide.position.toArray());
  await advanceGarden(page, 3);
  assert.deepEqual(await page.evaluate(() => game.guide.position.toArray()), invitedPosition, 'NPC must wait for the player to read the invitation');
  await page.locator('#maze-next').click();
  assert.equal(await page.locator('#maze-line').innerText(), '跟我来，我们去旁边的空花坛种花吧！');
  assert.equal(await page.locator('#maze-next .workshop-next-label').innerText(), '跟你来');
  await shot('thank-you-invitation-desktop');
  await page.locator('#maze-next').click();
  for (let i = 0; i < 30 && await page.evaluate(() => game.gardenQuest.stage !== 'plant'); i++) await advanceGarden(page, .5);
  assert.equal(await page.evaluate(() => game.gardenQuest.stage), 'plant');
  await nearGarden(page, 'flowerbed', -1.53, 0);
  assert.notEqual(await page.evaluate(() => game.target()?.action), 'plantSeedling', 'Standing by the hole must not offer planting');
  await page.keyboard.press('KeyE');
  assert.equal(await page.evaluate(() => game.gardenQuest.stage), 'plant', 'Interacting at the hole must not plant the seedling');
  if (await page.evaluate(() => !!game.dialogue)) await page.locator('#maze-close').click();
  await nearGarden(page, 'seedling', 0, 1.2); await shot('plant-ready-desktop');
  assert.equal(await page.evaluate(() => game.target()?.spot), 'seedling');
  assert.ok(await page.evaluate(() => game.ring.visible && Math.hypot(game.ring.position.x - game.gardenQuest.seedling.position.x, game.ring.position.z - game.gardenQuest.seedling.position.z) < .001), 'Interaction ring must highlight the seedling');
  assert.ok(await page.evaluate(async () => {
    const { Ray, Vector3 } = await import('/node_modules/.vite/deps/three.js');
    const delta = game.ring.position.clone().sub(game.camera.position), ray = new Ray(game.camera.position, delta.clone().normalize()), hit = new Vector3();
    return game.walls.every(w => !ray.intersectBox(w.bounds, hit) || hit.distanceTo(game.camera.position) >= delta.length() || w.mesh.material.opacity < .9);
  }), 'Foreground hedges must not hide the seedling interaction ring');
  assert.equal(await page.locator('#dive b').innerText(), '种下花苗');
  await page.keyboard.press('KeyE'); await advanceGarden(page, 1.2); await shot('holding-seedling-desktop');
  assert.ok(await page.evaluate(() => game.gardenQuest.stage === 'planting' && game.gardenQuest.seedling.parent === game.player && !game.gardenQuest.can.visible && !game.wand));
  await page.keyboard.press('Escape'); const waterTime = await page.evaluate(() => game.gardenQuest.elapsed);
  await advanceGarden(page, 2); assert.equal(await page.evaluate(() => game.gardenQuest.elapsed), waterTime);
  await page.keyboard.press('Escape'); await advanceGarden(page, 2.2); await shot('watering-desktop');
  assert.ok(await page.evaluate(() => game.gardenQuest.stage === 'watering' && !game.wand));
  await advanceGarden(page, 2.9);
  assert.ok(await page.evaluate(() => game.wand && game.gardenQuest.flower.visible && !game.gardenQuest.seedling.visible));
  await shot('reward-desktop'); await page.locator('#maze-close').click();
  const resting = await page.evaluate(() => game.guide.position.toArray());
  await advanceGarden(page, 6); assert.deepEqual(await page.evaluate(() => game.guide.position.toArray()), resting, 'Gardener must stop searching after helping');
  await nearGarden(page, 'pinwheel'); const rotation = await page.evaluate(() => game.gardenQuest.rotor.rotation.z);
  await page.keyboard.press('KeyE'); await advanceGarden(page, .5);
  assert.ok(await page.evaluate(rotation => game.gardenQuest.rotor.rotation.z > rotation, rotation));
  await nearGarden(page, 'windmill', -1, 2); await page.keyboard.press('KeyE');
  await page.evaluate(() => { for (let i = 0; i < 180; i++) game.step(); game.render(0); });
  assert.ok(await page.evaluate(() => game.bridgeOpen), 'Wand reward must still unlock the bridge');
  // Restart while an animation is running, then solve before meeting the NPC on touch.
  for (const stage of ['moving', 'handoff', 'walking', 'digging', 'planting', 'watering']) {
    await page.evaluate(stage => { game.gardenQuest.stage = stage; game.reset(); }, stage);
    assert.ok(await page.evaluate(() => game.gardenQuest.stage === 'search' && !game.wand && !game.tools && game.toolMesh.visible));
    assert.deepEqual(await page.evaluate(() => [game.world.bodies.len(), game.world.colliders.len()]), counts);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.evaluate(() => game.reducedMotion = true);
  await nearGarden(page, 'handles', -.2, 0); await shot('cart-mobile');
  await collectGardenTool(page, true); await plantGarden(page, true); await shot('reward-mobile');
  assert.equal(await page.evaluate(() => game.gardenerStory.introduced), false, 'Exploring first must not require the introduction');
  assert.deepEqual(errors, []);
  console.log('PASS gardener quest: two routes, real keyboard/touch actions, clues/hints, blocked pickup, cart/collider, pause, delayed reward, planting, bloom, gardener stops searching, pinwheel, bridge, replay and reduced motion', { bodies: counts[0], colliders: counts[1] });
} catch (error) {
  console.log(error, errors);
  console.log(await page.evaluate(() => ({ stage: window.game?.gardenQuest?.stage, target: window.game?.target(), position: window.game?.body?.translation(), dialogue: window.game?.dialogue })).catch(() => 'Page navigated'));
  await shot('failure').catch(() => {}); throw error;
} finally { await browser.close(); }
