import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1000, height: 750 }, reducedMotion: 'reduce', hasTouch: true });
page.setDefaultTimeout(90000);
const output = process.env.BRIDGE_CAPTURE_DIR || 'test-results/bridge-standing', errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
try {
  await mkdir(output, { recursive: true });
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: 'export function startJourney(){return {arrive:async()=>{},dispose(){}}}' }));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + '\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await init.call(this)};MazeAdventure.prototype.tick=function(){};' });
  });
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5226/') + '?level=3&lang=zh');
  await page.waitForFunction(() => window.game?.body && window.game?.root);
  await page.locator('.game-loading').waitFor({ state: 'detached' }); await page.locator('#primary').click();
  const standing = await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js'), { at } = await import('/src/maze-map.ts'), g = game, p = at('bridge');
    g.wand = true; g.body.setTranslation({ x: p.x - 6, y: .8, z: p.z }, true); g.previous.copy(g.body.translation()); g.render(0); g.interact();
    for (let i = 0; i < 200; i++) g.step();
    if (!g.bridgeOpen || g.bridgeBody.isEnabled()) throw Error('Windmill must finish lowering the bridge');
    g.body.setTranslation({ x: p.x, y: 2, z: p.z }, true); g.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    for (let i = 0; i < 180; i++) g.step(); g.render(0);
    const ray = new T.Raycaster(new T.Vector3(p.x + .2, 4, p.z), new T.Vector3(0, -1, 0));
    const surface = ray.intersectObject(g.bridgeDeck, true)[0].point.y;
    const feet = [-1, 1].map(side => new T.Box3().setFromObject(g.player.getObjectByName('foot' + side)).min.y);
    g.camera.position.set(p.x + 1, 7.5, p.z + 8); g.camera.lookAt(p.x, .6, p.z); g.camera.updateMatrixWorld();
    g.root.style.visibility = 'hidden'; g.renderer.render(g.scene, g.camera);
    return { surface, feet, gap: Math.min(...feet) - surface, bodyY: g.body.translation().y, grounded: g.grounded };
  });
  await page.screenshot({ path: `${output}/standing.png` });
  await writeFile(`${output}/standing.json`, JSON.stringify(standing, null, 2));
  console.log('Standing', JSON.stringify(standing));
  assert.ok(standing.gap > -.05 && standing.gap < .04 && standing.grounded, 'Feet must rest on the visible wooden deck');
  const movement = await page.evaluate(async () => {
    const { at } = await import('/src/maze-map.ts'), g = game, p = at('bridge'), walks = [];
    for (const direction of [1, -1]) {
      g.body.setTranslation({ x: p.x - direction * 3.3, y: .8, z: p.z }, true);
      g.body.setLinvel({ x: 0, y: 0, z: 0 }, true); g.keys.clear();
      for (let i = 0; i < 90; i++) g.step();
      g.keys.add(direction > 0 ? 'ArrowRight' : 'ArrowLeft');
      let onDeckY = 0;
      for (let i = 0; i < 220; i++) {
        g.step(); const pose = g.body.translation();
        if (Math.abs(pose.x - p.x) < .3) onDeckY = pose.y;
        if (direction * (pose.x - p.x) > 2.9) break;
      }
      g.keys.clear(); walks.push({ direction, x: g.body.translation().x, onDeckY });
    }
    g.body.setTranslation({ x: p.x, y: 1.4, z: p.z }, true); g.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    for (let i = 0; i < 120; i++) g.step();
    g.jumpRequested = true; let peak = 0;
    for (let i = 0; i < 240; i++) { g.step(); peak = Math.max(peak, g.body.translation().y); }
    g.render(0); return { walks, centerX: p.x, peak, landedY: g.body.translation().y, grounded: g.grounded };
  });
  assert.ok(movement.walks.every(w => w.direction * (w.x - movement.centerX) > 2.9 && w.onDeckY > .9), `Both approaches must remain walkable on the raised deck: ${JSON.stringify(movement)}`);
  assert.ok(movement.peak > 2 && Math.abs(movement.landedY - standing.bodyY) < .02 && movement.grounded, 'Jump must land back on the bridge');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(async () => { const { at } = await import('/src/maze-map.ts'), p = at('bridge'); game.resize(); game.render(0);
    game.camera.position.set(p.x + 1, 9, p.z + 11); game.camera.lookAt(p.x, .5, p.z); game.camera.updateMatrixWorld(); game.renderer.render(game.scene, game.camera); });
  await page.screenshot({ path: `${output}/mobile.png` });
  const reset = await page.evaluate(async () => {
    const { at } = await import('/src/maze-map.ts'), g = game, p = at('bridge'), bodies = g.world.bodies.len(); g.reset();
    const disabled = !g.bridgeSurface.isEnabled() && g.bridgeBody.isEnabled();
    g.body.setTranslation({ x: p.x - 3.3, y: .8, z: p.z }, true); g.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    g.keys.add('ArrowRight'); for (let i = 0; i < 160; i++) g.step(); g.keys.clear(); g.render(0);
    return { disabled, blocked: g.body.translation().x < p.x - 2.8, stable: g.world.bodies.len() === bodies };
  });
  assert.ok(reset.disabled && reset.blocked && reset.stable, 'Reset must remove deck support, restore the gate and reuse bodies');
  assert.deepEqual(errors, []);
  await writeFile(`${output}/report.json`, JSON.stringify({ standing, movement, reset, errors }, null, 2));
  console.log('PASS bridge height, both approaches, jump/landing, mobile, closed gate and reset', JSON.stringify({ movement, reset }));
} finally { await browser.close(); }
