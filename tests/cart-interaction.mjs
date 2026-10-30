import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { advanceGarden, nearGarden } from './garden-quest-helpers.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
await mkdir('test-results', { recursive: true });
await mkdir('test-results/cart-push-sequence', { recursive: true });
await page.route(/\/src\/journey\.ts(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: 'export function startJourney(){return {arrive:async()=>{},dispose(){}}}' }));
await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: await response.text() + '\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await init.call(this)};MazeAdventure.prototype.tick=function(){};' });
});
try {
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5192/') + '?level=3&lang=zh');
  await page.waitForFunction(() => window.game?.root && window.game?.body, null, { timeout: 90000 });
  await page.locator('.game-loading').waitFor({ state: 'detached', timeout: 90000 });
  await page.locator('#primary').click();
  for (const [label, offset, touch] of [['center', 0, false], ['near-handle', .5, false], ['far-handle', -.5, false], ['mobile', 0, true]]) {
    await page.evaluate(() => game.reset());
    if (touch) await page.setViewportSize({ width: 390, height: 844 });
    const start = await page.evaluate(offset => {
      const p = game.gardenQuest.cart.position;
      game.body.setTranslation({ x: -45, y: .8, z: p.z + offset }, true); game.previous.copy(game.body.translation()); game.render(0);
      return p.toArray();
    }, offset);
    await page.keyboard.down('ArrowRight');
    await page.evaluate(() => { for (let i = 0; i < 300; i++) game.step(); game.render(0); });
    await page.keyboard.up('ArrowRight');
    const contact = await page.evaluate(() => ({ position: game.body.translation(), target: game.target() }));
    console.log(label, contact);
    assert.ok(contact.position.x < -42 && contact.position.x > -43, 'Real collision must stop the player at the two handle tips');
    await page.screenshot({ path: `test-results/cart-contact-${label}.png` });
    assert.equal(contact.target?.action, 'pushCart', 'Contact at either handle must keep the push action available');
    assert.equal(await page.locator('#dive b').innerText(), '推开小车');
    if (touch) await page.locator('#dive').tap(); else await page.keyboard.press('KeyE');
    assert.equal(await page.evaluate(() => game.gardenQuest.stage), 'moving');
    if (label === 'center') {
      for (let frame = 0; frame < 8; frame++) {
        await advanceGarden(page, .1);
        await page.screenshot({ path: `test-results/cart-push-sequence/frame${String(frame).padStart(3, '0')}.png` });
      }
    } else await advanceGarden(page, .8);
    const motion = await page.evaluate(async () => {
      const { Box3 } = await import('/node_modules/.vite/deps/three.js');
      const q = game.gardenQuest, bounds = new Box3().setFromObject(q.cart);
      const hands = [-1, 1].map(side => game.player.getObjectByName('arm' + side).children[0].getWorldPosition(q.pushPoint.clone())
        .distanceTo(q.cart.localToWorld(q.pushPoint.clone().set(-1.94, .91, side * .43))));
      return { cart: q.cart.position.toArray(), player: game.player.position.toArray(), body: game.body.translation(),
        hands, wheel: q.cart.getObjectByName('cart-wheel1').rotation.z,
        hedgeOverlap: game.walls.some(wall => bounds.intersectsBox(wall.bounds)) };
    });
    assert.ok(motion.cart[0] > start[0] && Math.abs(motion.cart[2] - start[2]) < .001, 'Cart must roll straight along its wheel axis');
    assert.ok(motion.player[0] < motion.cart[0] - 2.5 && Math.abs(motion.player[2] - start[2]) < .001, 'Player must walk behind the handles');
    assert.ok(Math.abs(motion.body.x - motion.player[0]) < .001 && motion.hands.every(gap => gap < .025), 'Physics/player and both hand contacts must stay synchronized');
    assert.ok(motion.wheel < -.1 && !motion.hedgeOverlap, 'Wheels must rotate without the cart entering the hedge');
    await page.screenshot({ path: `test-results/cart-push-moving-${label}.png` });
    if (label === 'center') {
      await page.evaluate(() => {
        const p = game.gardenQuest.cart.position;
        game.camera.position.set(p.x - 4, 3.5, p.z + 6.5); game.camera.lookAt(p.x - 1.2, .85, p.z);
        game.renderer.render(game.scene, game.camera);
      });
      await page.screenshot({ path: 'test-results/cart-push-hands-close.png' });
    }
    if (label === 'center') {
      for (let frame = 8; frame < 20; frame++) {
        await advanceGarden(page, .1);
        await page.screenshot({ path: `test-results/cart-push-sequence/frame${String(frame).padStart(3, '0')}.png` });
      }
      await advanceGarden(page, .1);
    } else await advanceGarden(page, 1.3);
    assert.equal(await page.evaluate(() => game.gardenQuest.stage), 'tool');
    assert.ok(await page.evaluate(start => Math.abs(game.gardenQuest.cart.position.x - start[0] - 5.5) < .001 && Math.abs(game.gardenQuest.cart.position.z - start[2]) < .001, start));
  }
  await page.evaluate(() => game.reset());
  await nearGarden(page, 'cart', 0, -3); await page.keyboard.press('KeyE');
  assert.equal(await page.evaluate(() => game.gardenQuest.stage), 'search', 'Wheel side must direct the player towards the handles');
  assert.equal(await page.evaluate(() => game.message), 'cartPushHint');
  assert.deepEqual(errors, []);
  assert.ok(await page.evaluate(() => game.player.getObjectByName('arm1').children[0].position.y === 0 && game.player.getObjectByName('avatar').rotation.x === 0), 'Restart must release the pushing pose');
  console.log('PASS handle-side push: physical contact at both handles, keyboard/touch, hand grip, synchronized player/body, straight travel, rotating wheels, clear hedge and pose reset');
} finally { await browser.close(); }
