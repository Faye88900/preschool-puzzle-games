import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
await mkdir('test-results', { recursive: true });
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/\/src\/home-scene\.ts(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: 'export function createHomeScene(){ return () => {}; }' }));
  // Exercise menu state without waiting for physics, models, or an entire level playthrough.
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: `
    import '/src/style.css';
    import { showHome } from '/src/home.ts';
    import { UI } from '/src/ui.ts';
    import { language } from '/src/i18n.ts';
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : language;
    window.UI = UI;
    showHome();
  ` }));
  for (const [lang, title] of [['zh', '风语迷宫'], ['en', 'Whispering Maze'], ['ms', 'Labirin Bisikan']]) {
    console.log(`Checking level selector: ${lang}`);
    await page.goto(`${process.env.TEST_URL || 'http://127.0.0.1:5198/'}?lang=${lang}`);
    await page.locator('#choose-level').click();
    const cards = page.locator('.home-level-grid a');
    assert.equal(await cards.count(), 3);
    const maze = cards.nth(2);
    assert.equal(await maze.locator('strong').textContent(), title);
    const href = new URL(await maze.getAttribute('href'));
    assert.equal(href.searchParams.get('level'), '3');
    assert.equal(href.searchParams.get('lang'), lang);
    const cover = maze.locator('img.level-art');
    assert.ok((await cover.getAttribute('src')).endsWith('/images/whispering-maze-cover.png'));
    await cover.evaluate(image => image.decode());
    assert.deepEqual(await cover.evaluate(image => [image.naturalWidth, image.naturalHeight]), [1774, 887]);
    for (const [name, width, height] of [['desktop', 1280, 800], ['portrait', 390, 844], ['landscape', 844, 390]]) {
      await page.setViewportSize({ width, height });
      await maze.scrollIntoViewIfNeeded();
      assert.ok(await page.locator('#level-dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth + 1), `${lang} ${name}: horizontal overflow`);
      assert.ok(await maze.evaluate(card => card.scrollWidth <= card.clientWidth + 1), `${lang} ${name}: card text overflow`);
      await page.screenshot({ path: `test-results/level-select-${lang}-${name}.png` });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('#level-dialog').press('Escape');
    await page.evaluate(() => {
      const noop = () => {};
      window.testUI = new window.UI({ start: noop, pause: noop, mute: noop, jump: noop, dive: noop, move: noop });
      window.testUI.configurePuzzle();
    });
    for (const state of ['ready', 'racing', 'qualified', 'ready']) {
      await page.evaluate(state => window.testUI.updatePuzzle(state, false, false, '', 3, '互动', false), state);
      assert.equal(await page.locator('.level-link').isVisible(), state === 'qualified');
      assert.equal(new URL(await page.locator('.level-link').getAttribute('href')).searchParams.get('level'), '3');
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS: three-language level cards, responsive fit, level-2 completion and restart states');
} finally {
  await browser.close();
}
