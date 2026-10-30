import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
await mkdir('test-results', { recursive: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/__gardener-model', route => route.fulfill({ contentType: 'text/html', body: '<body style="margin:0"></body>' }));
  await page.goto('http://127.0.0.1:5192/__gardener-model');
  const metrics = await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js');
    const model = await import('/src/workshop-guide.ts');
    const { createGardener } = await import('/src/gardener.ts');
    const scene = new T.Scene();
    const guide = createGardener(); scene.add(guide);
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(800, 800); renderer.setPixelRatio(1);
    renderer.setClearColor(0xffffff, 0); renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#fff9e8', '#a8b8ba', 2.5));
    const light = new T.DirectionalLight('#ffffff', 3); light.position.set(-3, 4, -5); scene.add(light);
    const camera = new T.OrthographicCamera(-1.05, 1.05, 1.05, -1.05, .1, 20);
    camera.position.set(0, .6, -4); camera.lookAt(0, .05, 0);
    window.modelTest = { T, model, scene, guide, renderer, camera };
    renderer.render(scene, camera);
    let meshes = 0, triangles = 0;
    guide.traverse(node => { if (node.isMesh) { meshes++; triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3; } });
    const apron = guide.getObjectByName('gardener-apron'); apron.geometry.computeBoundingBox();
    const neck = guide.getObjectByName('gardener-neck-strap'); neck.geometry.computeBoundingBox();
    let clothFinite = true, clearance = Infinity;
    for (const name of ['gardener-apron', 'gardener-neck-strap', 'gardener-pocket-chest', 'gardener-pocket-lower']) {
      const positions = guide.getObjectByName(name).geometry.attributes.position;
      clothFinite &&= Array.from(positions.array).every(Number.isFinite);
      for (let i = 0; i < positions.count; i++) clearance = Math.min(clearance,
        Math.hypot(positions.getX(i), positions.getY(i), positions.getZ(i) * .56 / .53));
    }
    return { meshes, triangles, costumeAttached: guide.getObjectByName('gardener-costume').parent.name,
      hasHardHat: !!guide.getObjectByName('hard-hat'), bounds: new T.Box3().setFromObject(guide).getSize(new T.Vector3()).toArray(),
      apronTop: apron.geometry.boundingBox.max.y, apronBottom: apron.geometry.boundingBox.min.y,
      strapTop: neck.geometry.boundingBox.max.y, clothFinite, clearance,
      apronColor: apron.material.color.getHexString() };
  });
  assert.equal(metrics.costumeAttached, 'guide-torso');
  assert.equal(metrics.hasHardHat, false);
  assert.ok(metrics.bounds[0] > 1.4 && metrics.bounds[0] < 1.7);
  assert.ok(metrics.bounds[1] < 1.6, 'Model must retain the existing compact proportions');
  assert.ok(metrics.apronTop > -.06 && metrics.apronBottom < -.49, 'A full bib must extend from chest to hem');
  assert.equal(metrics.apronColor, '4e72a8');
  assert.ok(metrics.strapTop > .3, 'The neck strap must wrap over the round body');
  assert.ok(metrics.clothFinite && metrics.clearance > .578, 'Clothes must stay outside the body');
  for (const [name, angle] of [['front', 0], ['side', Math.PI / 2], ['back', Math.PI]]) {
    await page.evaluate(angle => { const s = window.modelTest; s.guide.rotation.y = angle; s.renderer.render(s.scene, s.camera); }, angle);
    await page.screenshot({ path: `test-results/gardener-${name}.png` });
  }
  const animation = await page.evaluate(() => {
    const s = window.modelTest; s.guide.rotation.y = -.25;
    const foot = s.guide.getObjectByName('foot1');
    const before = foot.position.clone();
    for (let i = 0; i < 30; i++) {
      s.model.animateWorkshopGuide(s.guide, 'point', i / 30, 1 / 30, false);
      s.model.animateGuideWalk(s.guide, i / 5, .8, 1 / 30, false);
    }
    s.renderer.render(s.scene, s.camera);
    let finite = true;
    s.guide.traverse(n => { finite &&= n.matrixWorld.elements.every(Number.isFinite); });
    return { footMoved: before.distanceTo(foot.position) > .01, finite, pose: s.guide.userData.pose };
  });
  assert.ok(animation.footMoved && animation.finite);
  assert.equal(animation.pose, 'point');
  await page.screenshot({ path: 'test-results/gardener-point-walk.png' });
  await page.evaluate(() => {
    const s = window.modelTest;
    s.guide.rotation.y = -.15;
    for (let i = 0; i < 60; i++) {
      s.model.animateWorkshopGuide(s.guide, 'idle', 0, 1 / 30, true);
      s.model.animateGuideWalk(s.guide, 0, 0, 1 / 30, true);
    }
    s.renderer.render(s.scene, s.camera);
  });
  await page.screenshot({ path: 'test-results/gardener-portrait.png', omitBackground: true });
  console.log('PASS: full apron shape, blue fabric, body clearance and model animations');
  const workshopUnchanged = await page.evaluate(() => !!window.modelTest.model.createWorkshopGuide().getObjectByName('hard-hat'));
  assert.ok(workshopUnchanged, 'The level 2 workshop guide must retain its hard hat');
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + '\nconst init = MazeAdventure.prototype.init; MazeAdventure.prototype.init = async function() { window.game = this; return init.call(this); };' });
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://127.0.0.1:5192/?level=3&lang=zh');
  await page.waitForFunction(() => window.game?.root && window.game?.body);
  await page.locator('.game-loading').waitFor({ state: 'detached', timeout: 90000 });
  await page.locator('#primary').click();
  await page.evaluate(() => {
    const g = window.game, p = g.guide.position;
    g.body.setTranslation({ x: p.x, y: .8, z: p.z + 1.8 }, true);
    g.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    g.previous.copy(g.body.translation()); g.render(0);
  });
  assert.ok(await page.evaluate(() => !!window.game.guide.getObjectByName('gardener-apron')));
  await page.keyboard.press('KeyE');
  await page.locator('.maze-dialogue:not([hidden])').waitFor();
  assert.ok(await page.evaluate(() => window.game.quest));
  await page.screenshot({ path: 'test-results/gardener-cottage-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/gardener-cottage-mobile.png' });
  while (await page.locator('.maze-dialogue').isVisible()) await page.locator('#maze-next').click();
  assert.equal(await page.evaluate(() => !!window.game.dialogue), false);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => {
    const g = window.game, p = g.guide.position;
    g.paused = true; g.render = () => {};
    g.camera.position.set(p.x + 2, p.y + 1.2, p.z + 3.4);
    g.camera.lookAt(p.x, p.y + .05, p.z);
    g.renderer.render(g.scene, g.camera);
  });
  await page.screenshot({ path: 'test-results/gardener-cottage-closeup.png' });
  assert.deepEqual(errors, []);
  console.log('PASS gardener model, attached costume and animation', JSON.stringify(metrics));
} finally { await browser.close(); }
