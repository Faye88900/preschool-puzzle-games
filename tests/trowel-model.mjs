import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pushGardenCart, plantGarden, collectGardenTool } from './garden-quest-helpers.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 900 }, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
await mkdir('test-results', { recursive: true });
const base = process.env.TEST_URL || 'http://127.0.0.1:5192/';
try {
  await page.route('**/__trowel-model', route => route.fulfill({ contentType: 'text/html', body: '<body style="margin:0;background:#faf6ec"></body>' }));
  await page.goto(base + '__trowel-model');
  const metrics = await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js');
    const { createGardenTrowel } = await import('/src/garden-trowel.ts');
    const trowel = createGardenTrowel(), scene = new T.Scene(); scene.add(trowel);
    const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setSize(900, 900);
    renderer.setClearColor('#faf6ec'); renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#e3f7ff', '#a2ab68', 2));
    const sun = new T.DirectionalLight('#fff0c5', 2.6); sun.position.set(-3, 6, 5); sun.castShadow = true;
    sun.shadow.mapSize.setScalar(1024); Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: .1, far: 20 });
    sun.shadow.normalBias = .015; scene.add(sun);
    const ground = new T.Mesh(new T.PlaneGeometry(100, 100), new T.MeshStandardMaterial({ color: '#faf6ec', roughness: .95 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -.025; ground.receiveShadow = true; scene.add(ground);
    const camera = new T.OrthographicCamera(-1.05, 1.05, 1.05, -1.05, .1, 20);
    camera.position.set(.6, 1.35, 4); camera.lookAt(.12, .8, 0);
    scene.updateMatrixWorld(true);
    const ray = new T.Raycaster(), grip = trowel.getObjectByName('trowel-grip'), blade = trowel.getObjectByName('trowel-blade');
    function hit(x, y, object) { ray.set(new T.Vector3(x, y, 1), new T.Vector3(0, 0, -1)); return ray.intersectObject(object, false); }
    const holeOpen = !hit(0, 1.5, grip).length && hit(.1, 1.5, grip).length > 0;
    const scoopDepth = hit(.25, .42, blade)[0].point.z - hit(0, .42, blade)[0].point.z;
    let triangles = 0, finite = true, smallestArea = Infinity;
    trowel.traverse(mesh => {
      if (!mesh.isMesh) return;
      const p = mesh.geometry.attributes.position, n = mesh.geometry.attributes.normal, index = mesh.geometry.index;
      triangles += (index?.count ?? p.count) / 3;
      finite &&= Array.from(p.array).every(Number.isFinite) && Array.from(n.array).every(Number.isFinite);
      if (mesh !== blade) return;
      const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
      for (let i = 0; i < index.count; i += 3) {
        a.fromBufferAttribute(p, index.getX(i)); b.fromBufferAttribute(p, index.getX(i + 1)); c.fromBufferAttribute(p, index.getX(i + 2));
        smallestArea = Math.min(smallestArea, b.sub(a).cross(c.sub(a)).length() / 2);
      }
    });
    const edges = new Map(), index = blade.geometry.index;
    for (let i = 0; i < index.count; i += 3) for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      const x = index.getX(i + a), y = index.getX(i + b), key = `${Math.min(x, y)},${Math.max(x, y)}`;
      edges.set(key, (edges.get(key) || 0) + 1);
    }
    window.trowelTest = { T, trowel, scene, renderer, camera };
    trowel.rotation.z = -.22; renderer.render(scene, camera);
    return { holeOpen, scoopDepth, triangles, finite, smallestArea, closedBlade: [...edges.values()].every(n => n === 2),
      bounds: new T.Box3().setFromObject(createGardenTrowel()).getSize(new T.Vector3()).toArray() };
  });
  assert.ok(metrics.holeOpen, 'Hanging hole must go all the way through the wooden grip');
  assert.ok(metrics.scoopDepth > .04, 'Blade must be concave rather than flat');
  assert.ok(metrics.closedBlade && metrics.smallestArea > 1e-9 && metrics.finite, 'Blade must be a closed, nondegenerate mesh with finite normals');
  assert.ok(metrics.triangles < 20000 && metrics.bounds[1] > 1.5 && metrics.bounds[1] < 1.8);
  await page.screenshot({ path: 'test-results/garden-trowel-hero.png' });
  for (const [name, angle] of [['front', 0], ['side', Math.PI / 2], ['back', Math.PI]]) {
    await page.evaluate(angle => { const s = trowelTest; s.trowel.rotation.set(0, angle, 0); s.camera.position.set(0, .82, 4); s.camera.lookAt(0, .82, 0); s.renderer.render(s.scene, s.camera); }, angle);
    await page.screenshot({ path: `test-results/garden-trowel-${name}.png` });
  }
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: 'export function startJourney(){return {arrive:async()=>{},dispose(){}}}' }));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + '\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await init.call(this)};MazeAdventure.prototype.tick=function(){};' });
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(base + '?level=3&lang=zh');
  await page.waitForFunction(() => window.game?.body && window.game?.root);
  await page.locator('.game-loading').waitFor({ state: 'detached', timeout: 60000 });
  await page.locator('#primary').click();
  await pushGardenCart(page);
  const grounding = await page.evaluate(async () => {
    const { Box3 } = await import('/node_modules/.vite/deps/three.js');
    const g = game, p = g.toolMesh.position;
    g.body.setTranslation({ x: p.x + 1.8, y: .8, z: p.z + 1.5 }, true); g.previous.copy(g.body.translation()); g.render(0);
    g.camera.position.set(p.x, 3.4, p.z + 3.5); g.camera.lookAt(p.x - .2, .3, p.z - .4); g.camera.updateMatrixWorld();
    g.renderer.render(g.scene, g.camera);
    const bounds = new Box3().setFromObject(g.toolMesh.getObjectByName('garden-trowel'));
    return { minY: bounds.min.y, maxY: bounds.max.y };
  });
  assert.ok(Math.abs(grounding.minY - .025) < .001 && grounding.maxY < .3, 'Trowel must lie flat on the path, scoop facing up, without floating');
  assert.ok(await page.evaluate(() => !!game.toolMesh.getObjectByName('garden-trowel')));
  assert.equal(await page.evaluate(() => game.toolMesh.children.length), 1, 'Well pickup must contain only the trowel');
  await page.screenshot({ path: 'test-results/garden-trowel-well.png' });
  await page.keyboard.press('KeyE');
  assert.ok(await page.evaluate(() => game.tools && !game.toolMesh.visible), 'Keyboard pickup must hide the trowel');
  await plantGarden(page);
  assert.ok(await page.evaluate(() => game.wand && !game.tools), 'Helping plant must award the wind wand');
  await page.evaluate(() => game.reset());
  assert.ok(await page.evaluate(() => game.toolMesh.visible && !game.wand && !game.tools), 'Reset must restore the new tool');
  await page.setViewportSize({ width: 390, height: 844 });
  await collectGardenTool(page, true);
  assert.ok(await page.evaluate(() => game.tools && !game.toolMesh.visible), 'Touch pickup must work with the new model');
  assert.deepEqual(errors, []);
  console.log('PASS trowel geometry, open hanging hole, scoop depth, desktop views, well placement, keyboard/touch pickup, wand reward and reset', JSON.stringify(metrics));
} finally { await browser.close(); }
