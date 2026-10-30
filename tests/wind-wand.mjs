import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { collectGardenTool, plantGarden, nearGarden } from './garden-quest-helpers.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
page.setDefaultTimeout(90000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
await mkdir('test-results/wind-wand', { recursive: true });
const base = process.env.TEST_URL || 'http://127.0.0.1:5192/';
try {
  await page.route('**/__wind-wand', route => route.fulfill({ contentType: 'text/html', body: '<body style="margin:0"></body>' }));
  await page.goto(base + '__wind-wand');
  const model = await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js');
    const { windWand } = await import('/src/maze-art.ts');
    const { animateWindWand } = await import('/src/wind-wand.ts');
    const wand = windWand(), scene = new T.Scene(); scene.add(wand);
    const renderer = new T.WebGLRenderer({ antialias: true }); renderer.setSize(1280, 800);
    renderer.setClearColor('#f8f3e8'); renderer.toneMapping = T.ACESFilmicToneMapping; document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#e2f4ff', '#b6b58a', 2));
    const sun = new T.DirectionalLight('#fff0d5', 2.6); sun.position.set(-3, 5, -4); scene.add(sun);
    const camera = new T.PerspectiveCamera(35, 1.6, .1, 20);
    camera.position.set(.65, 1.1, -3.8); camera.lookAt(0, .49, 0);
    let meshes = 0, triangles = 0, finite = true;
    wand.traverse(m => {
      if (!m.isMesh) return;
      meshes++; triangles += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3;
      finite &&= [...m.geometry.attributes.position.array, ...m.geometry.attributes.normal.array].every(Number.isFinite);
    });
    const core = wand.getObjectByName('wind-core'), ribbon = wand.getObjectByName('wind-ribbon');
    const idle = core.material.emissiveIntensity;
    animateWindWand(wand, .1, .5, false);
    const casting = core.material.emissiveIntensity, spun = ribbon.rotation.y;
    animateWindWand(wand, .1, .5, true);
    const reducedStill = ribbon.rotation.y === spun;
    animateWindWand(wand, 0, 0, false);
    const pausedStill = ribbon.rotation.y === spun;
    renderer.render(scene, camera);
    window.wandTest = { T, wand, scene, renderer, camera };
    return { meshes, triangles, finite, size: new T.Box3().setFromObject(wand).getSize(new T.Vector3()).toArray(),
      rotor: !!wand.getObjectByName('rotor'), casting, idle, spun, reducedStill, pausedStill, calls: renderer.info.render.calls };
  });
  assert.ok(model.finite && model.triangles < 12000 && model.calls <= 24, 'Wand must fit its small-prop geometry/draw budget');
  assert.ok(model.size[0] < .7 && model.size[1] > 1.7 && model.size[1] < 1.95 && model.size[2] > .3, 'Staff needs a long shaft and a volumetric head');
  assert.ok(!model.rotor && model.casting > model.idle && model.spun > 0 && model.reducedStill && model.pausedStill);
  for (const [name, angle] of [['front', 0], ['side', Math.PI / 2], ['back', Math.PI]]) {
    await page.evaluate(angle => { const s = wandTest; s.wand.rotation.y = angle; s.renderer.render(s.scene, s.camera); }, angle);
    await page.screenshot({ path: `test-results/wind-wand/model-${name}.png` });
  }
  console.log('PASS model, volume, budgets, casting and reduced motion', JSON.stringify(model));
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: 'export function startJourney(){return {arrive:async()=>{},dispose(){}}}' }));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + '\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await init.call(this)};MazeAdventure.prototype.tick=function(){};' });
  });
  await page.goto(base + '?level=3&lang=zh');
  await page.waitForFunction(() => window.game?.body && window.game?.root);
  await page.locator('.game-loading').waitFor({ state: 'detached' });
  await page.locator('#primary').click();
  assert.equal(await page.evaluate(() => game.wandMesh.visible), false);
  await collectGardenTool(page); await plantGarden(page);
  while (await page.locator('.maze-dialogue').isVisible()) await page.locator('#maze-next').click();
  await page.evaluate(() => game.render(0));
  assert.ok(await page.evaluate(() => game.wand && game.wandMesh.visible && game.wandMesh.parent.name === 'arm1'));
  const attachment = await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js');
    const g = game, hand = g.wandMesh.parent.getObjectByName('hand'), distances = [], bottoms = [];
    for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      g.heading = heading; g.render(0);
      distances.push(hand.getWorldPosition(new T.Vector3()).distanceTo(g.wandMesh.getWorldPosition(new T.Vector3())));
      bottoms.push(new T.Box3().setFromObject(g.wandMesh).min.y);
    }
    g.heading = 0; g.render(0);
    return { maxGripGap: Math.max(...distances), minBottom: Math.min(...bottoms),
      calls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles,
      geometries: g.renderer.info.memory.geometries, textures: g.renderer.info.memory.textures };
  });
  console.log('Attachment metrics', JSON.stringify(attachment));
  await page.screenshot({ path: 'test-results/wind-wand/attachment-check.png' });
  assert.ok(attachment.maxGripGap < 1e-6 && attachment.minBottom > .04, `Grip must follow the hand through turns and the foot must clear the .025-high path: ${JSON.stringify(attachment)}`);
  await nearGarden(page, 'spawn');
  await page.screenshot({ path: 'test-results/wind-wand/desktop.png' });
  await page.evaluate(() => {
    const g = game, p = g.player.position;
    g.camera.position.set(p.x + 2.6, p.y + 1.4, p.z - 4.2); g.camera.lookAt(p.x + .2, p.y + .35, p.z);
    g.camera.updateMatrixWorld(); g.renderer.render(g.scene, g.camera);
  });
  await page.screenshot({ path: 'test-results/wind-wand/held-detail.png' });
  await nearGarden(page, 'bridge', -6, 0); await page.keyboard.press('KeyE');
  assert.ok(await page.evaluate(() => game.bridgeOpening && game.windTime > 0), 'New staff must still cast on the windmill');
  const socketGap = await page.evaluate(async () => {
    const { Vector3 } = await import('/node_modules/.vite/deps/three.js');
    return game.wandMesh.getObjectByName('wind-core').getWorldPosition(new Vector3()).distanceTo(game.windOrigin);
  });
  assert.ok(socketGap < 1e-6, 'Wind must originate at the crystal');
  await page.evaluate(() => { for (let i = 0; i < 190; i++) game.step(); game.render(0); });
  assert.ok(await page.evaluate(() => game.bridgeOpen));
  await nearGarden(page, 'boss', 0, 5.5);
  await page.evaluate(() => { game.cooldown = 0; game.enemies[2].phase = 'idle'; });
  await page.keyboard.press('KeyE');
  assert.equal(await page.evaluate(() => game.enemies[2].hp), 3, 'A cast must not bypass the guardian shield');
  await page.evaluate(() => { game.cooldown = 0; game.enemies[2].phase = 'rest'; });
  await page.keyboard.press('KeyE');
  assert.equal(await page.evaluate(() => game.enemies[2].hp), 2, 'Staff must still hit an exposed guardian');
  await nearGarden(page, 'spawn');
  await page.keyboard.down('KeyD');
  await page.evaluate(() => { for (let i = 0; i < 30; i++) game.step(); game.render(.05); });
  await page.keyboard.up('KeyD');
  assert.ok(await page.evaluate(async () => {
    const { Vector3 } = await import('/node_modules/.vite/deps/three.js'), wand = game.wandMesh;
    return wand.getWorldPosition(new Vector3()).distanceTo(wand.parent.getObjectByName('hand').getWorldPosition(new Vector3())) < 1e-6;
  }), 'Walking must not detach the staff from the hand');
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => { game.resize(); game.render(0); });
  await page.screenshot({ path: 'test-results/wind-wand/mobile.png' });
  await page.evaluate(() => { game.cooldown = 0; game.windTime = 0; });
  await page.locator('#dive').tap(); await page.evaluate(() => game.render(0));
  assert.ok(await page.evaluate(() => game.windTime > 0), 'Touch action must still cast');
  await page.screenshot({ path: 'test-results/wind-wand/mobile-cast.png' });
  const pause = await page.evaluate(() => {
    const g = game, ribbon = g.wandMesh.getObjectByName('wind-ribbon'); g.paused = true;
    const before = ribbon.rotation.y; g.render(.2); const same = ribbon.rotation.y === before;
    g.paused = false; g.reducedMotion = true; g.render(.2); return same && ribbon.rotation.y === before;
  });
  assert.ok(pause, 'Pause and reduced motion must stop ribbon spin');
  await page.evaluate(() => game.reset());
  assert.equal(await page.evaluate(() => game.wandMesh.visible), false);
  assert.deepEqual(errors, []);
  await writeFile('test-results/wind-wand/report.json', JSON.stringify({ model, attachment, socketGap, errors }, null, 2));
  console.log('PASS quest reward, grip/walking, windmill bridge, shield/exposed guardian, keyboard/touch, pause, reset, desktop/mobile', JSON.stringify(attachment));
} finally { await browser.close(); }
