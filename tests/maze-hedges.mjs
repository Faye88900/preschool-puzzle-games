import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const output = 'test-results/maze-hedges', errors = [];
try {
  await mkdir(output, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(90000);
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/, r => r.fulfill({ contentType: 'text/javascript', body: 'export function startJourney(){return {arrive:async()=>{},dispose(){}}}' }));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + '\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await init.call(this)};MazeAdventure.prototype.tick=function(){};' });
  });
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5226/') + '?level=3&lang=zh');
  await page.locator('.game-loading').waitFor({ state: 'detached' });
  await page.locator('#primary').click();
  const result = await page.evaluate(async () => {
    const { default: R } = await import('/node_modules/.vite/deps/@dimforge_rapier3d-compat.js');
    const g = game;
    g.enemies.forEach(e => { e.hp = 0; e.timer = 0; }); g.invulnerable = 999;
    g.encounterGateProgress = 1; g.encounterGate.body.setEnabled(false);
    window.place = (x, z, y = .8) => {
      g.clearInput(); g.coyote = g.jumpCooldown = 0;
      g.body.setTranslation({ x, y, z }, true); g.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      for (let i = 0; i < 60; i++) g.step();
    };
    for (let i = 0; i < 60; i++) g.step();
    const heights = g.walls.map(w => [w.bounds.min.y, w.bounds.max.y]);
    const collisions = [[-25,50],[35,-5],[35,25]].map(([x,z]) => {
      const hit = g.world.castRay(new R.Ray({ x, y: 8, z }, { x: 0, y: -1, z: 0 }), 10, true);
      return hit ? 8 - hit.timeOfImpact : null;
    });
    const jumps = [];
    for (const [x,z,key,axis,direction,edge] of [[-20,50,'KeyA','x',-1,-22.5],[30,-5,'KeyD','x',1,32.5],[35,30,'KeyW','z',-1,27.5]]) {
      place(x,z); g.keys.add(key); let furthest = direction * g.body.translation()[axis];
      for (let i = 0; i < 240; i++) {
        g.jumpRequested = true; g.step(); furthest = Math.max(furthest, direction * g.body.translation()[axis]);
      }
      g.clearInput(); jumps.push({ x, z, furthest, limit: direction * edge });
    }
    const ledge = g.solid(30.5,.75,-5,2.8,1.5,2);
    place(30.5,-5,2.2); g.keys.add('KeyD'); let furthest = 0, peak = 0;
    for (let i = 0; i < 240; i++) { g.jumpRequested = true; g.step(); furthest = Math.max(furthest,g.body.translation().x); peak = Math.max(peak,g.body.translation().y); }
    g.clearInput(); g.world.removeRigidBody(ledge);
    place(40,25); const route = [[40,20],[30,20],[25,20],[25,10],[25,0],[40,0],[55,0],[55,15],[75,15],[75,0],[85,0],[85,-10],[100,-10]], distances = [];
    for (const [x,z] of route) {
      for (let i = 0; i < 700; i++) {
        const p = g.body.translation(); if (Math.hypot(p.x-x,p.z-z) < .22) break;
        g.keys.clear(); if (Math.abs(x-p.x) > .12) g.keys.add(x > p.x ? 'KeyD' : 'KeyA');
        if (Math.abs(z-p.z) > .12) g.keys.add(z > p.z ? 'KeyS' : 'KeyW'); g.step();
      }
      const p = g.body.translation(); distances.push(Math.hypot(p.x-x,p.z-z));
    }
    g.clearInput(); return { heights, collisions, jumps, ledge: { furthest, peak }, distances };
  });
  assert.ok(result.heights.length > 50 && result.heights.every(([min,max]) => Math.abs(min) < .001 && Math.abs(max-4.5) < .001), 'Every hedge, including ruins and wind garden, must be raised consistently');
  assert.ok(result.collisions.every(y => Math.abs(y-4.5) < .001), JSON.stringify(result.collisions));
  assert.ok(result.jumps.every(j => j.furthest < j.limit-.3), JSON.stringify(result.jumps));
  assert.ok(result.ledge.peak > 3 && result.ledge.furthest < 32.2, 'Jumping from a raised prop must not reach the hedge top: '+JSON.stringify(result.ledge));
  assert.ok(result.distances.every(d => d < .35), 'The route to the dock must remain walkable: '+JSON.stringify(result.distances));
  for (const [name,x,z,width,height] of [['spawn',-10,50,1280,800],['wind-garden',25,0,1280,800],['ruins',35,35,1280,800],['mobile',25,0,390,844]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(({x,z}) => { place(x,z); game.previous.copy(game.body.translation()); game.resize(); game.render(0); }, {x,z});
    await page.screenshot({ path: `${output}/${name}.png` });
  }
  assert.deepEqual(errors, []);
  console.log('PASS uniform hedge art/colliders, repeated jumps, raised-prop jump, dock route, desktop/mobile', JSON.stringify({ collisions: result.collisions, jumps: result.jumps, ledge: result.ledge }));
} finally { await browser.close(); }
