import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const output = 'test-results/flower-choir', errors = [], captures = [];
const base = process.env.TEST_URL || 'http://127.0.0.1:5208/';
try {
  await mkdir(output, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: false });
  const input = await page.context().newCDPSession(page);
  page.setDefaultTimeout(90000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/, r => r.fulfill({ contentType: 'text/javascript', body: 'export function startJourney(){return {arrive:async()=>{},dispose(){}}}' }));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + '\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;return init.call(this)};MazeAdventure.prototype.tick=function(){};' });
  });
  await page.goto(base + '?level=3&lang=zh');
  await page.locator('.game-loading').waitFor({ state: 'detached' }); await page.locator('#primary').click();
  await page.waitForFunction(() => game.audio.context.state === 'running');
  const asset = await page.evaluate(async () => {
    const g = game, c = g.flowerChoir, { CHOIR_CUES } = await import('/src/flower-choir-cues.ts');
    window.placeChoirPlayer = (x = 75, z = 0) => {
      g.body.setTranslation({ x, y: .8, z }, true); g.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      g.previous.copy(g.body.translation()); g.resize(); g.render(0);
    };
    window.seekChoir = time => { c.pause(); c.offset = time; c.play(); g.render(0); };
    g.wand = g.bridgeOpen = true; g.bridgeProgress = 1; g.bridgeBody.setEnabled(false);
    g.enemies.forEach(e => e.hp = 0); g.encounterGateProgress = 1; g.encounterGate.body.setEnabled(false);
    placeChoirPlayer();
    return { duration: c.buffer?.duration, envelope: c.envelope.length, context: g.audio.context.state,
      target: g.target(), closed: c.flowers.every(f => f.lids.visible && !f.eyes.visible && f.head.rotation.x > .5), cues: CHOIR_CUES };
  });
  assert.ok(Math.abs(asset.duration - 41.96) < .15 && asset.envelope > 1000, JSON.stringify(asset));
  assert.equal(asset.context, 'running'); assert.equal(asset.target.spot, 'choir'); assert.ok(asset.closed);
  assert.equal(asset.cues.length, 14); assert.equal(asset.cues[0].start, 10.44);
  for (const [i, cue] of asset.cues.entries()) {
    assert.ok(cue.start < cue.end && cue.end < asset.duration && cue.words.length === [...cue.text].length);
    assert.ok(cue.words.every((t, j) => t >= cue.start && t <= cue.end && (!j || t >= cue.words[j - 1])));
    if (i) assert.ok(cue.start >= asset.cues[i - 1].end);
  }
  async function capture(name) {
    const stats = await page.evaluate(() => {
      const g = game; g.render(0);
      const gl = g.renderer.getContext(), canvas = g.renderer.domElement, pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let min = 255, max = 0; for (let i = 0; i < pixels.length; i += 16) { const v = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3; min = Math.min(min, v); max = Math.max(max, v); }
      return { contrast: max - min, calls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles, geometries: g.renderer.info.memory.geometries, textures: g.renderer.info.memory.textures, time: g.flowerChoir.elapsed };
    });
    assert.ok(stats.contrast > 35); await page.screenshot({ path: `${output}/${name}.png` }); captures.push({ name, ...stats });
  }
  await capture('sleeping-desktop');
  assert.ok(await page.locator('.keyboard-guide').isVisible(), 'Ordinary desktop mouse mode must exercise the keyboard guide');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => game.flowerChoir.elapsed > .65);
  const waking = await page.evaluate(() => {
    game.render(0); const c = game.flowerChoir;
    return { status: c.status, first: c.firstFlower, time: c.elapsed, angles: c.flowers.map(f => f.head.rotation.x), hit: game.windHit, cooldown: game.cooldown };
  });
  assert.equal(waking.status, 'playing'); assert.equal(waking.first, 2); assert.ok(waking.hit && waking.cooldown > 0);
  assert.ok(!await page.locator('.keyboard-guide').isVisible(), 'Keyboard help must yield its space to the lyrics');
  assert.ok(waking.angles[2] < waking.angles[0], 'The flower hit by wind wakes first'); await capture('waking-desktop');
  await page.locator('#pause').click();
  const paused = await page.evaluate(() => { game.render(0); return { time: game.flowerChoir.elapsed, angles: game.flowerChoir.flowers.map(f => f.head.rotation.x) }; });
  await page.waitForTimeout(350);
  assert.ok(await page.evaluate(paused => { game.render(.35); return game.paused && Math.abs(game.flowerChoir.elapsed - paused.time) < .001 && game.flowerChoir.flowers.every((f, i) => f.head.rotation.x === paused.angles[i]) && game.flowerChoir.caption.hidden; }, paused));
  await page.locator('#primary').click(); await page.evaluate(() => game.render(0));
  await page.waitForFunction(t => game.flowerChoir.elapsed > t + .2, paused.time);
  const repeat = await page.evaluate(() => { const c = game.flowerChoir; window.firstChoirSource = c.source; game.cooldown = 0; return c.elapsed; });
  await page.keyboard.press('KeyE');
  assert.ok(await page.evaluate(t => game.flowerChoir.source === firstChoirSource && game.flowerChoir.elapsed >= t, repeat), 'Extra gusts must not restart an active performance');
  await page.evaluate(() => seekChoir(11.5)); await capture('verse-desktop');
  const lyric = await page.evaluate(() => {
    const c = game.flowerChoir; return { text: c.line.getAttribute('aria-label'), first: c.line.firstElementChild.style.getPropertyValue('--sung'), last: c.line.lastElementChild.style.getPropertyValue('--sung'), next: c.next.textContent, duck: game.audio.music.volume };
  });
  assert.equal(lyric.text, '风儿轻轻吹过来'); assert.equal(lyric.first, '100%'); assert.equal(lyric.last, '0%'); assert.equal(lyric.next, '叫醒花儿把头抬'); assert.ok(lyric.duck < .05);
  const animation = await page.evaluate(() => {
    const c = game.flowerChoir; c.pause(); c.offset = 21.4; game.render(0); const a = c.flowers.map(f => [f.root.rotation.z, f.head.rotation.z, f.leaves[0].rotation.z]);
    c.pause(); c.offset = 21.7; game.render(0); const b = c.flowers.map(f => [f.root.rotation.z, f.head.rotation.z, f.leaves[0].rotation.z]);
    c.pause(); c.offset = 21.7; game.render(0); const same = c.flowers.map(f => [f.root.rotation.z, f.head.rotation.z, f.leaves[0].rotation.z]);
    return { a, b, same, awake: c.flowers.every(f => f.head.rotation.x === 0 && (f.eyes.visible || f.lids.visible)) };
  });
  assert.ok(animation.awake); assert.notDeepEqual(animation.a, animation.b); assert.deepEqual(animation.b, animation.same);
  const expressions = await page.evaluate(() => {
    const c = game.flowerChoir;
    const pose = time => { c.animate(time, false); return c.flowers.map(f => [f.root.rotation.z, f.head.rotation.z, f.leaves[0].rotation.z, f.petals.rotation.z, f.root.scale.y]); };
    const introA = pose(4), introB = pose(4.3), gapA = pose(27.7), gapB = pose(28.1);
    c.animate(7.25, false); const blink = !c.flowers[0].eyes.visible && c.flowers[0].lids.visible && !c.flowers[0].glints.visible;
    c.animate(7.55, false); const open = c.flowers[0].eyes.visible && c.flowers[0].glints.visible;
    c.animate(4, false); const smiling = c.flowers.every(f => f.smile.visible && !f.mouth.visible);
    c.animate(11.5, false); const lead = c.flowers[c.firstFlower]; const singing = lead.mouth.visible && !lead.smile.visible && lead.mouth.scale.y > .04;
    return { introA, introB, gapA, gapB, blink, open, smiling, singing };
  });
  assert.notDeepEqual(expressions.introA, expressions.introB, 'Flowers dance during the instrumental intro, with idle time frozen');
  assert.notDeepEqual(expressions.gapA, expressions.gapB, 'Flowers keep dancing through the instrumental break');
  assert.ok(expressions.blink && expressions.open && expressions.smiling && expressions.singing, JSON.stringify(expressions));
  await page.evaluate(() => seekChoir(4.3)); await capture('dancing-intro-desktop');
  await page.evaluate(() => seekChoir(28.1)); await capture('dancing-instrumental-desktop');
  for (const cue of asset.cues) {
    await page.evaluate(time => seekChoir(time), cue.start + .08);
    assert.equal(await page.locator('.choir-line').getAttribute('aria-label'), cue.text);
  }
  await page.evaluate(() => seekChoir(21.7)); await capture('chorus-desktop');
  for (const [name, width, height] of [['laptop', 1024, 768], ['portrait', 390, 844], ['landscape', 844, 390], ['small-landscape', 667, 375]]) {
    await input.send('Emulation.setTouchEmulationEnabled', { enabled: width < 701 || height < 550 });
    await page.setViewportSize({ width, height }); await page.evaluate(() => { placeChoirPlayer(); seekChoir(21.7); });
    const fit = await page.evaluate(() => {
      const caption = game.flowerChoir.caption, r = caption.getBoundingClientRect(), line = game.flowerChoir.line;
      const feet = game.player.position.clone(); feet.y -= .8; feet.project(game.camera);
      const playerBottom = (1 - feet.y) * innerHeight / 2;
      const overlaps = [...document.querySelectorAll('.action-controls button,.touch-stick,.keyboard-guide')].filter(el => el.getBoundingClientRect().width).some(el => { const b = el.getBoundingClientRect(); return r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top; });
      return { left: r.left, right: r.right, bottom: r.bottom, width: innerWidth, height: innerHeight, overflow: line.scrollWidth > line.clientWidth, overlaps, playerClear: playerBottom < r.top, playerBottom, captionTop: r.top, aspect: game.camera.aspect };
    });
    assert.ok(fit.left >= 0 && fit.right <= width && fit.bottom <= height && !fit.overflow && !fit.overlaps && fit.playerClear, JSON.stringify({ name, fit }));
    assert.equal(fit.aspect, width / height); await capture(`chorus-${name}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { placeChoirPlayer(); seekChoir(2); }); await capture('intro-portrait');
  assert.ok(await page.evaluate(() => game.flowerChoir.line.scrollWidth <= game.flowerChoir.line.clientWidth));
  // Music and effects are separate preferences: the song follows music, the breath follows effects.
  await page.evaluate(() => { game.settings.music = false; game.audio.applySettings(game.settings); game.render(0); });
  await page.waitForTimeout(700);
  assert.ok(await page.evaluate(() => game.flowerChoir.gain.gain.value < .01 && game.flowerChoir.performing));
  await page.evaluate(() => { game.settings.music = true; game.audio.applySettings(game.settings); game.render(0); });
  await page.waitForTimeout(700); assert.ok(await page.evaluate(() => game.flowerChoir.gain.gain.value > .7));
  await page.evaluate(() => { game.render(0); game.keys.add('KeyD'); for (let i = 0; i < 35; i++) game.step(); game.keys.clear(); game.render(0); });
  assert.ok(await page.evaluate(() => game.body.translation().x > 76 && game.flowerChoir.performing && game.active()), 'Player can walk during the choir');
  await input.send('Emulation.setTouchEmulationEnabled', { enabled: false }); await page.setViewportSize({ width: 1280, height: 800 });
  const far = await page.evaluate(async () => {
    const { at } = await import('/src/maze-map.ts'), chest = at('chest'); placeChoirPlayer(chest.x, chest.z + 2);
    return { hidden: game.flowerChoir.caption.hidden, source: !!game.flowerChoir.source, dozing: game.flowerChoir.status === 'dozing', heads: game.flowerChoir.flowers.map(f => f.head.rotation.x), volume: game.audio.music.volume, target: game.target()?.spot };
  });
  assert.ok(far.hidden && !far.source && far.dozing && far.volume === .22 && far.target === 'chest', 'Music stops at the chest while flowers begin settling: ' + JSON.stringify(far));
  assert.ok(far.heads.every(angle => Math.abs(angle) < .001), 'Stopping music must not snap awake heads down');
  const doze = await page.evaluate(() => {
    const c = game.flowerChoir; game.render(.65);
    const middle = { time: c.sleepTime, heads: c.flowers.map(f => f.head.rotation.x), petals: c.flowers.map(f => f.petals.scale.x), eyes: c.flowers[0].eyes.scale.y };
    game.pause(); game.render(.7); const frozen = c.sleepTime === middle.time && c.flowers.every((f, i) => f.head.rotation.x === middle.heads[i]);
    game.pause(); game.render(1.5);
    return { middle, frozen, asleep: c.status === 'sleeping' && c.flowers.every(f => f.lids.visible && Math.abs(f.head.rotation.x - .55) < .001 && Math.abs(f.petals.scale.x - .75) < .001), source: !!c.source };
  });
  assert.ok(doze.frozen && doze.asleep && !doze.source, JSON.stringify(doze));
  assert.ok(doze.middle.heads.every(angle => angle > .05 && angle < .45) && doze.middle.petals.every(scale => scale > .75 && scale < 1) && doze.middle.eyes > 0 && doze.middle.eyes < 1, 'Heads lower, petals close and eyes gradually narrow');
  await capture('stopped-at-chest-desktop');
  assert.ok(await page.locator('.keyboard-guide').isVisible(), 'Keyboard help returns after leaving the choir');
  await page.evaluate(() => { placeChoirPlayer(); game.cooldown = 0; });
  assert.ok(await page.evaluate(() => !game.flowerChoir.source && game.flowerChoir.status === 'sleeping'), 'Returning alone must not wake the sleeping flowers');
  await page.keyboard.press('KeyE');
  await page.evaluate(() => { seekChoir(21.7); game.reducedMotion = true; game.render(0); });
  assert.ok(await page.evaluate(() => game.flowerChoir.flowers.every(f => f.root.rotation.z === 0 && f.head.rotation.z === 0 && f.eyes.visible) && game.flowerChoir.notes.every(n => !n.visible)));
  await capture('reduced-motion-portrait');
  await page.evaluate(() => { game.reducedMotion = false; seekChoir(game.flowerChoir.buffer.duration - .15); window.loopSource = game.flowerChoir.source; });
  await page.waitForFunction(() => game.flowerChoir.elapsed > game.flowerChoir.buffer.duration + .15);
  const loop = await page.evaluate(() => {
    game.render(0); const c = game.flowerChoir;
    return { playing: c.performing, sameSource: c.source === loopSource, loop: c.source.loop, awake: c.flowers.every(f => f.head.rotation.x === 0), caption: !c.caption.hidden, time: c.elapsed };
  });
  assert.ok(loop.playing && loop.sameSource && loop.loop && loop.awake && loop.caption, JSON.stringify(loop));
  assert.ok(!await page.locator('.keyboard-guide').isVisible());
  await page.evaluate(() => seekChoir(game.flowerChoir.buffer.duration * 2 + 11.5));
  assert.equal(await page.locator('.choir-line').getAttribute('aria-label'), '风儿轻轻吹过来', 'Lyrics wrap correctly on the third pass');
  await capture('looped-verse-desktop');
  const reawakenPose = await page.evaluate(() => { placeChoirPlayer(97, 0); game.render(.6); const heads = game.flowerChoir.flowers.map(f => f.head.rotation.x); placeChoirPlayer(); game.cooldown = 0; return heads; });
  await page.locator('#dive').dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', button: 0 });
  await page.locator('#dive').dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', button: 0 });
  assert.ok(await page.evaluate(() => { game.render(0); return game.flowerChoir.performing && game.flowerChoir.elapsed < 1; }), 'Touch can wake the flowers after leaving and returning');
  assert.ok(await page.evaluate(heads => game.flowerChoir.flowers.every((f, i) => Math.abs(f.head.rotation.x - heads[i]) < .04), reawakenPose), 'Wind during dozing starts from the current head pose');
  await page.evaluate(() => placeChoirPlayer(97, 0));
  await page.evaluate(() => game.reset());
  assert.ok(await page.evaluate(() => game.flowerChoir.status === 'sleeping' && !game.flowerChoir.source && game.flowerChoir.caption.hidden && game.flowerChoir.flowers.every(f => f.lids.visible)));
  assert.deepEqual(errors, []);
  const report = { asset, waking, paused, lyric, animation, expressions, far, doze, loop, captures, errors };
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log('PASS flower choir: real wind/touch triggers, continuous music and animation, wrapped lyrics, leave/stop/sleep, keyboard-help exclusion and restore, pause/resume, mute, reduced motion, responsive fit', JSON.stringify({ duration: asset.duration, loop, captures, errors }));
  if (process.env.SOURCE_AUDIO) assert.deepEqual(await readFile('public/audio/maze/flower-choir.mp3'), await readFile(process.env.SOURCE_AUDIO));
} finally { await browser.close(); }
