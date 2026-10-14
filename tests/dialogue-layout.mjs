import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
await mkdir('test-results', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/\/src\/puzzle\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + '\nconst originalInit = PuzzleGarden.prototype.init; PuzzleGarden.prototype.init = async function() { window.__testGame = this; return originalInit.call(this); };' });
  });
  for (const lang of ['zh', 'en', 'ms']) {
    await page.goto('http://127.0.0.1:5191/?level=2&lang=' + lang);
    await page.locator('.game-loading').waitFor({ state: 'detached', timeout: 60000 });
    await page.locator('#primary').click();
    await page.evaluate(() => {
      const g = window.__testGame, p = g.workshop.guide.position;
      g.body.setTranslation({ x: p.x + 1, y: .8, z: p.z }, true);
      g.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    });
    await page.waitForTimeout(150);
    await page.evaluate(() => window.__testGame.workshop.start(false, false));
    await page.locator('.workshop-dialogue[open]').waitFor();
    for (const expression of ['curious', null, 'surprised', 'thinking']) {
      if (expression) {
        const image = page.locator('.workshop-portrait img');
        assert.ok((await image.getAttribute('src')).endsWith(`${expression}.png`));
        await image.evaluate(img => img.decode());
        for (const [name, width, height] of [['desktop', 1280, 800], ['portrait', 390, 844], ['landscape', 844, 390]]) {
          await page.setViewportSize({ width, height });
          const portrait = await page.locator('.workshop-portrait').boundingBox();
          const line = await page.locator('#workshop-line').boundingBox();
          assert.ok(portrait.x + portrait.width <= line.x, `${expression}: portrait overlaps text`);
          await page.screenshot({ path: `test-results/player-${lang}-${expression}-${name}.png` });
        }
      }
      await page.locator('.workshop-next').click();
    }
    assert.equal(await page.locator('.workshop-shapes').isVisible(), false);
    for (const [name, width, height, maxHeight] of [['desktop', 1280, 800, 230], ['portrait', 390, 844, 290], ['landscape', 844, 390, 180]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(150);
      const panel = await page.locator('.workshop-dialogue').boundingBox();
      const close = await page.locator('.workshop-leave').boundingBox();
      const glyph = await page.locator('.workshop-leave svg').boundingBox();
      assert.ok(panel.height <= maxHeight, `${lang} ${name}: panel ${panel.height}`);
      assert.ok(close.width >= 44 && close.height >= 44);
      assert.ok(glyph.width <= 24 && glyph.height <= 24);
      assert.ok(close.x >= 0 && close.y >= panel.y && close.x + close.width <= width);
      assert.equal(await page.locator('.workshop-shapes figure').count(), 4);
      const plate = await page.evaluate(async () => {
        const { Vector3 } = await import('/node_modules/.vite/deps/three.js');
        const g = window.__testGame;
        const point = new Vector3(-24, 0, -17).project(g.camera);
        return { x: (point.x + 1) * innerWidth / 2, y: (1 - point.y) * innerHeight / 2 };
      });
      assert.ok(plate.x > 0 && plate.x < width && plate.y > 0 && plate.y < panel.y, `${lang} ${name}: plate obscured ${JSON.stringify(plate)}`);
      await page.screenshot({ path: `test-results/dialogue-intro-${lang}-${name}.png` });
      console.log(`${lang} ${name}: panel ${Math.round(panel.height)}px; plate visible; close glyph ${glyph.width}px`);
    }
    await page.locator('.workshop-leave').tap();
    assert.equal(await page.locator('.workshop-dialogue').isVisible(), false);
    await page.waitForFunction(() => !window.__testGame.workshop.active);
    await page.setViewportSize({ width: 1280, height: 800 });
    const hint = '看看正方体积木，它和机关的形状一样。';
    await page.evaluate(hint => window.__testGame.workshop.start(false, false, hint), hint);
    // Exiting halfway must not skip the introductory camera sequence next time.
    assert.equal(await page.evaluate(() => window.__testGame.workshop.stage), 0);
    assert.equal(await page.locator('.workshop-shapes').isVisible(), false);
    for (let i = 0; i < 7; i++) await page.locator('.workshop-next').click();
    await page.waitForFunction(() => !window.__testGame.workshop.active);
    await page.evaluate(hint => window.__testGame.workshop.start(false, false, hint), hint);
    assert.equal(await page.locator('.workshop-shapes').isVisible(), true);
    const text = await page.locator('#workshop-line').innerText();
    assert.ok(text.length > 0);
    for (const [name, width, height] of [['desktop', 1280, 800], ['portrait', 390, 844], ['landscape', 844, 390]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(150);
      const panel = await page.locator('.workshop-dialogue').boundingBox();
      assert.ok(panel.height < height * .4, `${lang} ${name}: revisit height ${panel.height}`);
      await page.screenshot({ path: `test-results/dialogue-revisit-${lang}-${name}.png` });
    }
    await page.locator('.workshop-leave').tap();
    assert.equal(await page.locator('.workshop-dialogue').isVisible(), false);
    await page.waitForFunction(() => !window.__testGame.workshop.active);
    await page.evaluate(() => { const w = window.__testGame.workshop; w.reset(); w.start(false, false); });
    assert.equal(await page.locator('.workshop-shapes').isVisible(), false);
    await page.locator('.workshop-leave').tap();
    await page.setViewportSize({ width: 1280, height: 800 });
  }
  assert.deepEqual(errors, []);
  console.log('PASS: unified dialogue layout, first camera sequence without shapes, revisit with shapes, interrupted intro replay, reset, touch close in three languages');
} finally { await browser.close(); }

