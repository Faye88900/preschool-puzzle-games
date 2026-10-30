import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { default: sharp } = await import(process.env.SHARP_MODULE || 'sharp');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
page.setDefaultTimeout(90000);
const output = 'test-results/wind-effect', errors = [], captures = [];
const base = process.env.TEST_URL || 'http://127.0.0.1:5204/';
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
async function changedPixels(a, b) {
  const x = await sharp(a).removeAlpha().raw().toBuffer(), y = await sharp(b).removeAlpha().raw().toBuffer();
  let count = 0;
  for (let i = 0; i < x.length; i += 3) if (Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2])) > 24) count++;
  return count;
}
try {
  await mkdir(output, { recursive: true });
  await page.route('**/__wind-effect', r => r.fulfill({ contentType: 'text/html', body: '<body></body>' }));
  await page.goto(base + '__wind-effect');
  const model = await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js'), { createWindEffect } = await import('/src/wind-effect.ts');
    const effect = createWindEffect(), from = new T.Vector3(0, 1.2, 0), to = new T.Vector3(6, 1.2, 0);
    let finite = true, triangles = 0, meshes = 0;
    effect.mesh.traverse(m => { if (m.isMesh) {
      meshes++; triangles += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3;
      finite &&= [...m.geometry.attributes.position.array, ...m.geometry.attributes.normal.array].every(Number.isFinite);
    } });
    const gust = effect.mesh.getObjectByName('wind-gust'), impact = effect.mesh.getObjectByName('wind-impact');
    effect.update(.34, from, to, false, true);
    const first = gust.matrixWorld.clone(); effect.mesh.updateMatrixWorld(true); first.copy(gust.matrixWorld);
    effect.update(.34, from, to, false, true); effect.mesh.updateMatrixWorld(true);
    const idempotent = first.equals(gust.matrixWorld), travels = gust.position.x > 0 && gust.position.x < 6;
    effect.update(.15, from, to, false, true); const hit = impact.visible && !gust.visible;
    effect.update(.15, from, to, false, false); const empty = !impact.visible && gust.visible;
    effect.update(.35, from, to, true, true); const reduced = gust.rotation.y === 0 && gust.visible;
    effect.update(0, from, to, false, true); const stopped = !effect.mesh.visible;
    return { finite, triangles, meshes, idempotent, travels, hit, empty, reduced, stopped };
  });
  assert.ok(model.finite && model.triangles < 12000 && model.meshes <= 16);
  assert.ok(model.idempotent && model.travels && model.hit && model.empty && model.reduced && model.stopped);
  console.log('PASS effect geometry, deterministic animation, hit/empty finish, reduced motion', JSON.stringify(model));
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: 'export function startJourney(){return {arrive:async()=>{},dispose(){}}}' }));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + '\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await init.call(this)};MazeAdventure.prototype.tick=function(){};' });
  });
  await page.goto(base + '?level=3&lang=zh');
  await page.waitForFunction(() => window.game?.body && window.game?.root);
  await page.locator('.game-loading').waitFor({ state: 'detached' }); await page.locator('#primary').click();
  await page.evaluate(() => { game.wand = true; game.heading = -Math.PI / 2; game.render(0); });
  for (const [name, width, height] of [['desktop', 1280, 800], ['mobile', 390, 844], ['landscape', 844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(async () => {
      const T = await import('/node_modules/.vite/deps/three.js'), g = game;
      g.resize(); g.windTime = 0; g.render(0);
      g.cast({ x: g.player.position.x + 6, z: g.player.position.z }, false);
      g.windTime = 0; g.render(0);
      // Preserve the old six-ring effect as a visual baseline under the same camera and lighting.
      const legacy = new T.Group(); legacy.name = 'legacy-wind-test';
      for (let i = 0; i < 6; i++) {
        const gust = new T.Mesh(new T.TorusGeometry(.3 + i * .1, .035, 5, 24, Math.PI * 1.5),
          new T.MeshBasicMaterial({ color: i % 2 ? '#fff6bb' : '#bcffff', transparent: true, depthWrite: false }));
        const progress = .32 + i * .07; gust.position.lerpVectors(g.windOrigin, g.windTarget, progress);
        gust.lookAt(g.windTarget); gust.rotateZ(g.time * 4 + i); gust.material.opacity = (1 - progress) * .85; legacy.add(gust);
      }
      legacy.visible = false; g.scene.add(legacy);
    });
    const idle = await page.screenshot();
    await page.evaluate(() => { game.scene.getObjectByName('legacy-wind-test').visible = true; game.renderer.render(game.scene, game.camera); });
    const before = await page.screenshot({ path: `${output}/${name}-before.png` });
    await page.evaluate(() => { game.scene.getObjectByName('legacy-wind-test').visible = false; game.windTime = .34; game.render(0); });
    const after = await page.screenshot({ path: `${output}/${name}-flight.png` });
    const beforePixels = await changedPixels(idle, before), afterPixels = await changedPixels(idle, after);
    const render = await page.evaluate(() => ({ calls: game.renderer.info.render.calls, triangles: game.renderer.info.render.triangles,
      geometries: game.renderer.info.memory.geometries, textures: game.renderer.info.memory.textures }));
    captures.push({ name, beforePixels, afterPixels, ratio: afterPixels / Math.max(1, beforePixels), render });
    assert.ok(afterPixels > beforePixels * 1.5 && afterPixels > 120, `Wind must be more visible at ${name}: ${JSON.stringify(captures.at(-1))}`);
    await page.evaluate(() => { game.windHit = true; game.windTime = .14; game.render(0); });
    await page.screenshot({ path: `${output}/${name}-impact.png` });
    await page.evaluate(() => {
      const legacy = game.scene.getObjectByName('legacy-wind-test'); legacy.removeFromParent();
      legacy.traverse(m => { if (m.isMesh) { m.geometry.dispose(); m.material.dispose(); } });
    });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  const state = await page.evaluate(() => {
    const g = game; g.resize(); g.windTime = .34; g.render(0); g.paused = true;
    const before = g.wind.mesh.getObjectByName('wind-gust').rotation.y; g.render(.2);
    const paused = g.windTime === .34 && g.wind.mesh.getObjectByName('wind-gust').rotation.y === before;
    g.paused = false; g.reducedMotion = true; g.render(0);
    const reduced = g.wind.mesh.getObjectByName('wind-gust').rotation.y === 0;
    g.cooldown = 0; g.windTime = 0; g.render(0); return { paused, reduced };
  });
  assert.ok(state.paused && state.reduced);
  await page.keyboard.press('KeyE'); await page.evaluate(() => game.render(0));
  assert.ok(await page.evaluate(() => game.windTime > 0 && game.wind.mesh.visible && !game.windHit));
  await page.evaluate(() => { game.cooldown = 0; game.windTime = 0; });
  await page.locator('#dive').tap(); await page.evaluate(() => game.render(0));
  assert.ok(await page.evaluate(() => game.windTime > 0 && game.wind.mesh.visible));
  await page.evaluate(() => { game.reset(); game.render(0); });
  assert.ok(await page.evaluate(() => !game.wind.mesh.visible));
  assert.deepEqual(errors, []);
  await writeFile(`${output}/report.json`, JSON.stringify({ model, captures, state, errors }, null, 2));
  console.log('PASS actual camera visibility, desktop/mobile/landscape, keyboard/touch, pause and reset', JSON.stringify(captures));
} finally { await browser.close(); }
