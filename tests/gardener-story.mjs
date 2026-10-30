import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { collectGardenTool, plantGarden } from './garden-quest-helpers.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await mkdir('test-results', { recursive: true });
await page.addInitScript(() => {
  window.spoken = [];
  speechSynthesis.speak = utterance => window.spoken.push({ text: utterance.text, lang: utterance.lang });
});
// Drive the scene deterministically; the unrelated cloud journey is outside this test.
await page.route(/\/src\/journey\.ts(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: 'export function startJourney(){return {arrive:async()=>{},dispose(){}}}' }));
await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: await response.text() + '\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await init.call(this)};MazeAdventure.prototype.tick=function(){};' });
});
async function render() { await page.evaluate(() => game.render(0)); }
async function sceneVisible() {
  const colors = await page.evaluate(() => {
    game.render(0);
    const gl = game.renderer.getContext(), pixel = new Uint8Array(4), samples = new Set();
    for (let x = 1; x < 9; x++) for (let y = 1; y < 7; y++) {
      gl.readPixels(Math.floor(gl.drawingBufferWidth * x / 9), Math.floor(gl.drawingBufferHeight * y / 7), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      samples.add(Array.from(pixel).join(','));
    }
    return samples.size;
  });
  assert.ok(colors > 6, `Scene must be visible, found only ${colors} colors`);
}
async function advance(seconds) {
  await page.evaluate(seconds => {
    const g = window.game;
    const followLook = g.cameraGoal.clone().set(g.player.position.x, 2, g.player.position.z - 8);
    for (let t = 0; t < seconds; t += .05) g.gardenerStory.update(.05, g.paused, g.reducedMotion,
      g.active(), g.cameraGoal, followLook, !g.gardenQuest.returned);
    g.render(0);
  }, seconds);
}
async function near(name) {
  await page.evaluate(async name => {
    const g = window.game, { at } = await import('/src/maze-map.ts');
    const p = name === 'gardener' ? g.guide.position : at(name);
    g.body.setTranslation({ x: p.x, y: .8, z: p.z + 1.8 }, true);
    g.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    g.previous.copy(g.body.translation()); g.render(0);
  }, name);
}
async function next() { await page.locator('#maze-next').click(); await render(); }
try {
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5192/') + '?level=3&lang=zh');
  await page.waitForFunction(() => window.game?.root && window.game?.body);
  await page.locator('.game-loading').waitFor({ state: 'detached', timeout: 60000 });
  await page.locator('#primary').click();
  const shed = await page.evaluate(async () => {
    const { Box3, Vector3 } = await import('/node_modules/.vite/deps/three.js');
    const object = game.scene.getObjectByName('garden-shed');
    const bounds = new Box3().setFromObject(object), size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    game.body.setTranslation({ x: center.x, y: .8, z: bounds.max.z + 1 }, true);
    game.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    for (let i = 0; i < 30; i++) game.step();
    game.keys.add('ArrowUp'); for (let i = 0; i < 90; i++) game.step(); game.keys.clear();
    const stoppedZ = game.body.translation().z;
    game.reset(); game.render(0);
    game.camera.position.set(-29, 18, 64); game.camera.lookAt(-38, 0, 42); game.camera.updateMatrixWorld();
    game.renderer.render(game.scene, game.camera);
    return { size: size.toArray(), min: bounds.min.toArray(), max: bounds.max.toArray(), stoppedZ };
  });
  assert.ok(Math.abs(shed.size[2] - 4.2) < .01 && Math.abs(shed.size[0] - 3.26065) < .01 && Math.abs(shed.min[1]) < .01, 'The right-facing shed must retain its intended width/depth and sit on the ground');
  assert.ok(shed.stoppedZ >= shed.max[2] + .35, 'Players must not walk through the shed');
  await page.screenshot({ path: 'test-results/garden-shed-yard.png' });
  await near('gardener');
  const beforeSearch = await page.evaluate(() => game.guide.position.toArray());
  await page.keyboard.down('ArrowRight');
  const moved = await page.evaluate(() => { const x = game.body.translation().x; for (let i = 0; i < 10; i++) game.step(); return game.body.translation().x - x; });
  await page.keyboard.up('ArrowRight');
  assert.ok(moved > 0, 'Discovery must leave movement under player control');
  await advance(5);
  assert.notDeepEqual(await page.evaluate(() => game.guide.position.toArray()), beforeSearch);
  assert.equal(await page.evaluate(() => game.gardenerStory.active), false);
  await page.screenshot({ path: 'test-results/gardener-story-01-search.png' });
  await near('gardener'); await page.keyboard.press('KeyE'); await render();
  assert.equal(await page.evaluate(() => game.gardenerStory.stage), 0);
  await page.evaluate(() => game.nextDialogue());
  assert.equal(await page.evaluate(() => game.dialogue.index), 0, 'Rapid clicks must not skip the first action');
  assert.equal(await page.evaluate(() => game.active()), false);
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => game.keys.size), 0);
  for (const [stage, seconds, caption] of [[0, 1.7, '这里也没有'], [1, 1.1, '湿脚印'], [2, 1.9, '提过水'], [3, 1.8, '去看看']]) {
    if (stage === 3) {
      await advance(1); await sceneVisible();
      await page.screenshot({ path: 'test-results/gardener-story-05-route.png' });
      await advance(seconds - 1);
    } else await advance(seconds);
    assert.equal(await page.evaluate(() => game.gardenerStory.stage), stage);
    assert.ok((await page.locator('#maze-line').innerText()).includes(caption));
    const portraitImage = page.locator('.maze-dialogue .workshop-portrait img');
    assert.ok((await portraitImage.getAttribute('src')).endsWith(['gardener-puzzled.png', 'player-dialogue/thinking.png', 'gardener-remember.png', 'gardener-dialogue.png'][stage]));
    await portraitImage.evaluate(img => img.decode());
    for (const [layout, width, height] of [['desktop', 1280, 800], ['portrait', 390, 844], ['landscape', 844, 390]]) {
      await page.setViewportSize({ width, height });
      await page.waitForFunction(() => game.camera.aspect === innerWidth / innerHeight);
      await advance(.01); await sceneVisible();
      const camera = await page.evaluate(() => ({ position: game.camera.position.toArray(), look: game.cameraLook.toArray(), aspect: game.camera.aspect, guide: game.guide.position.toArray(), player: game.player.position.toArray() }));
      assert.ok([...camera.position, ...camera.look, camera.aspect].every(Number.isFinite), JSON.stringify(camera));
      await page.screenshot({ path: `test-results/gardener-story-0${stage + 2}-${layout}.png` });
      const panel = await page.locator('.maze-dialogue').boundingBox();
      const close = await page.locator('#maze-close').boundingBox();
      const portrait = await page.locator('.maze-dialogue .workshop-portrait').boundingBox();
      const line = await page.locator('#maze-line').boundingBox();
      assert.ok(portrait.x + portrait.width <= line.x, 'Portrait must not overlap dialogue text');
      assert.ok(panel.x >= 0 && panel.x + panel.width <= width + 1 && panel.y >= 0 && panel.y + panel.height <= height + 1);
      assert.ok(close.width >= 44 && close.height >= 44);
    }
    if (stage === 3) {
      const elapsed = await page.evaluate(() => { game.pause(); return game.gardenerStory.elapsed; });
      await advance(.5);
      assert.equal(await page.evaluate(() => game.gardenerStory.elapsed), elapsed, 'Pause must freeze the shot');
      await page.evaluate(() => game.pause()); await render();
    }
    await next();
  }
  assert.equal(await page.evaluate(() => game.gardenerStory.stage), 4);
  await advance(3.2);
  const completion = await page.evaluate(() => ({ introduced: game.gardenerStory.introduced, active: game.active(),
    guide: game.guide.position.toArray(), marker: game.player.getObjectByName('player-marker').visible,
    sign: !!game.scene.getObjectByName('sign-gardener'), quest: game.quest, wand: game.wand }));
  assert.ok(completion.introduced && completion.active && completion.marker && !completion.sign && completion.quest && !completion.wand);
  const roamingPositions = [];
  for (let i = 0; i < 18; i++) {
    await advance(1);
    roamingPositions.push(await page.evaluate(() => game.guide.position.toArray()));
  }
  assert.ok(roamingPositions.some(p => Math.hypot(p[0] - completion.guide[0], p[2] - completion.guide[2]) > 1), 'Gardener must resume walking after the introduction');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForFunction(() => game.camera.aspect === innerWidth / innerHeight); await render();
  await page.screenshot({ path: 'test-results/gardener-story-06-control-return.png' });
  await near('gardener'); await page.keyboard.press('KeyE'); await render();
  assert.equal(await page.evaluate(() => game.dialogue.gardenerIntro), false, 'Revisits should use the short hint');
  const talkingPosition = await page.evaluate(() => game.guide.position.toArray());
  await advance(2);
  assert.deepEqual(await page.evaluate(() => game.guide.position.toArray()), talkingPosition, 'Gardener must stop while talking');
  await next();
  const directions = [];
  for (const side of [-1, 1]) {
    await page.evaluate(side => {
      game.reset(); game.gardenerStory.introduced = true;
      const p = game.guide.position;
      game.body.setTranslation({ x: p.x, y: .8, z: p.z + side * 5 }, true);
      game.previous.copy(game.body.translation()); game.render(0);
    }, side);
    await advance(4);
    directions.push(await page.evaluate(() => ({ position: game.guide.position.toArray(), yaw: game.guide.rotation.y })));
  }
  assert.deepEqual(directions[0], directions[1], 'Roaming direction must not follow the player');
  await page.evaluate(() => game.reset()); await near('gardener'); await page.keyboard.press('KeyE'); await render();
  await page.locator('#maze-close').tap(); await advance(1);
  assert.equal(await page.evaluate(() => game.gardenerStory.introduced), false);
  assert.ok(await page.evaluate(() => game.active()));
  await near('gardener'); await page.keyboard.press('KeyE'); await render();
  assert.ok(await page.evaluate(() => game.dialogue.gardenerIntro));
  await page.evaluate(() => game.reset()); await render();
  assert.ok(await page.evaluate(() => !game.gardenerStory.active && !game.gardenerStory.introduced && !game.dialogue));
  // Players may still collect the tools before asking for help.
  await collectGardenTool(page); await render();
  assert.ok(await page.evaluate(() => game.tools));
  await plantGarden(page); await render();
  assert.ok(await page.evaluate(() => game.wand && !game.dialogue.gardenerIntro && !game.gardenerStory.active));
  const gratefulPortrait = page.locator('.maze-dialogue .workshop-portrait img');
  assert.ok((await gratefulPortrait.getAttribute('src')).endsWith('gardener-grateful.png'));
  await gratefulPortrait.evaluate(img => img.decode());
  await page.screenshot({ path: 'test-results/gardener-grateful-dialogue.png' });
  await next(); await next();
  await near('tools');
  const rewardedPosition = await page.evaluate(() => game.guide.position.toArray());
  await advance(4);
  assert.deepEqual(await page.evaluate(() => game.guide.position.toArray()), rewardedPosition, 'Gardener must stop searching after planting');
  assert.ok(await page.evaluate(() => window.spoken.some(s => s.text.includes('湿脚印') && s.lang === 'zh-CN')));
  for (const [direction, dx, dz] of [['east', 2.9, 0], ['west', -2.9, 0], ['north', 0, -2.9], ['south', 0, 2.9]]) {
    await page.evaluate(({ dx, dz }) => {
      game.reset(); const p = game.guide.position;
      game.body.setTranslation({ x: p.x + dx, y: .8, z: p.z + dz }, true);
      game.previous.copy(game.body.translation()); game.render(0);
    }, { dx, dz });
    await page.keyboard.press('KeyE'); await render(); await advance(1.6); await next(); await advance(1.2);
    for (const [layout, width, height] of [['desktop', 1280, 800], ['portrait', 390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.waitForFunction(() => game.camera.aspect === innerWidth / innerHeight);
      await advance(.05); await sceneVisible();
      const framing = await page.evaluate(() => [game.guide, game.player].map(actor => {
        const center = actor.position.clone().project(game.camera);
        const edge = actor.position.clone().add(game.camera.position.clone().sub(game.cameraLook).setY(0).normalize().cross(game.camera.up).multiplyScalar(.8)).project(game.camera);
        return Math.max(Math.abs(center.x), Math.abs(edge.x));
      }));
      assert.ok(framing.every(x => x < .99), `Both actors must fit: ${direction} ${layout} ${framing}`);
      await page.screenshot({ path: `test-results/gardener-story-approach-${direction}-${layout}.png` });
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [lang, voice] of [['en', 'en-US'], ['ms', 'ms-MY']]) {
    await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5192/') + '?level=3&lang=' + lang);
    await page.waitForFunction(() => window.game?.root && window.game?.body);
    await page.locator('.game-loading').waitFor({ state: 'detached', timeout: 60000 });
    await page.locator('#primary').click(); await near('gardener'); await page.keyboard.press('KeyE'); await render();
    for (let i = 0; i < 4; i++) {
      await advance(.3);
      assert.equal(await page.evaluate(() => game.gardenerStory.stage), i);
      assert.ok((await page.locator('#maze-line').innerText()).length > 5);
      await next();
    }
    await advance(.3);
    assert.ok(await page.evaluate(() => game.active() && game.gardenerStory.introduced));
    assert.ok(await page.evaluate(voice => spoken.some(s => s.lang === voice), voice));
  }
  assert.deepEqual(errors, []);
  console.log('PASS: discovery movement, four dialogue shots, camera return, search stops after planting, pause, desktop/portrait/landscape, replay, reset, revisit, pre-collected tools, three languages and reduced motion');
} catch (error) {
  console.log(await page.evaluate(() => ({ state: window.game?.state, story: window.game?.gardenerStory?.stage, line: document.querySelector('#maze-line')?.textContent })));
  await page.screenshot({ path: 'test-results/gardener-story-failure.png' });
  throw error;
} finally { await browser.close(); }
