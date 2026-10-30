import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true, reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
await mkdir('test-results', { recursive: true });
await page.route(/\/src\/journey\.ts(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: 'export function startJourney(){return {arrive:async()=>{},dispose(){}}}' }));
await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: await response.text() + '\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await init.call(this)};MazeAdventure.prototype.tick=function(){};' });
});
try {
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5207/') + '?level=3&lang=zh');
  await page.locator('.game-loading').waitFor({ state: 'detached', timeout: 90000 });
  await page.locator('#primary').click();
  const check = await page.evaluate(async () => {
    const { maze, CELL } = await import('/src/maze-map.ts');
    const g = window.game, ground = g.scene.getObjectByName('maze-ground');
    const paths = ground.getObjectByName('maze-dirt-paths'), verge = ground.getObjectByName('maze-grass-verge');
    const points = paths.geometry.getAttribute('position'), uv = paths.geometry.getAttribute('uv');
    let uvError = 0;
    for (let i = 0; i < points.count; i++) uvError = Math.max(uvError, Math.abs(uv.getX(i) - points.getX(i) / CELL), Math.abs(uv.getY(i) + points.getZ(i) / CELL));
    const normals = verge.geometry.getAttribute('normal');
    let minUp = 1;
    for (let i = 0; i < normals.count; i++) minUp = Math.min(minUp, normals.getY(i));
    const maps = [...new Set(ground.children.map(mesh => mesh.material.map))];
    const before = { bodies: g.world.bodies.len(), geometries: g.renderer.info.memory.geometries, textures: g.renderer.info.memory.textures };
    g.reset(); g.render(0);
    return { cells: maze.flat().filter(Boolean).length, pathTriangles: paths.geometry.index.count / 3,
      uvError, minUp, surfaces: ground.children.length, maps: maps.map(map => ({ width: map.image.width, height: map.image.height, colorSpace: map.colorSpace, wrap: [map.wrapS, map.wrapT] })),
      before, after: { bodies: g.world.bodies.len(), geometries: g.renderer.info.memory.geometries, textures: g.renderer.info.memory.textures } };
  });
  assert.equal(check.pathTriangles, (check.cells - 1) * 2, 'The bridge cell is open scenery for the recessed stream, without a dirt tile');
  assert.ok(check.uvError < .00001, 'Cell joins must share world-aligned texture coordinates');
  assert.ok(check.minUp > .99, 'Grass verge triangles must face upward');
  assert.equal(check.surfaces, 4); assert.equal(check.maps.length, 2);
  for (const map of check.maps) { assert.equal(map.width, 512); assert.equal(map.height, 512); assert.equal(map.colorSpace, 'srgb'); assert.deepEqual(map.wrap, [1002, 1002]); }
  assert.deepEqual(check.before, check.after, 'Reset must reuse terrain and physics resources');
  const island = await page.evaluate(async () => {
    const T=await import('/node_modules/three/build/three.module.js'),g=game,root=g.scene.getObjectByName('maze-island');
    const shell=root.getObjectByName('maze-island-rock'),bounds=new T.Box3().setFromObject(shell);
    const positions=shell.geometry.attributes.position,normals=shell.geometry.attributes.normal;
    g.camera.position.set(-110,65,135);g.camera.lookAt(0,-5,5);g.camera.updateMatrixWorld();
    root.visible=false;g.renderer.render(g.scene,g.camera);const before={...g.renderer.info.render};
    root.visible=true;g.renderer.render(g.scene,g.camera);const after={...g.renderer.info.render};
    return {min:bounds.min.toArray(),max:bounds.max.toArray(),finite:[...positions.array,...normals.array].every(Number.isFinite),outward:normals.getX(0),clouds:root.getObjectByName('maze-island-clouds').count,before,after};
  });
  assert.ok(island.finite&&island.outward>0&&island.max[1]<0&&island.min[1]<-35);
  assert.equal(island.clouds,120);assert.ok(island.after.calls-island.before.calls<=4);
  await page.screenshot({path:'test-results/maze-floating-island-overview.png'});
  const views = [];
  for (const [spot, width, height] of [['spawn',1280,800],['gardener',1280,800],['tools',1280,800],['boss',1280,800],['spawn',390,844],['gardener',844,390]]) {
    await page.setViewportSize({ width, height });
    const stats = await page.evaluate(async spot => {
      const { at } = await import('/src/maze-map.ts'); const p = at(spot), g = window.game;
      g.body.setTranslation({ x: p.x, y: .8, z: p.z + (spot === 'gardener' ? 3 : spot === 'boss' ? 4 : 0) }, true);
      g.previous.copy(g.body.translation()); g.render(0);
      return { calls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles, textures: g.renderer.info.memory.textures };
    }, spot);
    await page.screenshot({ path: `test-results/maze-ground-${spot}-${width}.png` }); views.push({ spot, width, ...stats });
  }
  assert.deepEqual(errors, []);
  console.log('PASS floating island shell/clouds, ground maps, continuous UV joins, upward grass edges, unchanged resource counts on reset, desktop/portrait/landscape views and no runtime/HTTP errors', JSON.stringify({ check, island, views }));
} finally { await browser.close(); }
