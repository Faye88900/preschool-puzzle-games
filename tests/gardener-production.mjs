import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
// Full camera timing is covered in gardener-story; keep this production asset/input check short.
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true, reducedMotion: 'reduce' });
page.setDefaultTimeout(60000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
await mkdir('test-results', { recursive: true });
// Match the runtime's clamped frame time while using only real keyboard input.
async function move(key, seconds) {
  await page.keyboard.down(key);
  await page.evaluate(seconds => new Promise(resolve => {
    let last = performance.now(), elapsed = 0;
    function frame(now) { elapsed += Math.min((now - last) / 1000, .05); last = now; if (elapsed >= seconds) resolve(); else requestAnimationFrame(frame); }
    requestAnimationFrame(frame);
  }), seconds);
  await page.keyboard.up(key);
}
try {
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5193/?level=3&lang=zh');
  console.log('Production page opened');
  await page.locator('.journey-skip').click();
  await page.locator('.game-loading').waitFor({ state: 'detached', timeout: 90000 });
  await page.locator('#primary').click();
  console.log('Production game started');
  await move('ArrowUp', 1.42);
  console.log('Reached the cottage approach');
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => document.querySelector('#dive b')?.textContent === '交谈', null, { timeout: 90000, polling: 100 });
  await page.keyboard.up('ArrowLeft'); await page.keyboard.press('KeyE');
  await page.locator('.maze-dialogue:not([hidden])').waitFor();
  for (const [index, text] of ['这里也没有', '湿脚印', '提过水', '去看看'].entries()) {
    assert.ok((await page.locator('#maze-line').innerText()).includes(text));
    console.log('Production shot', index + 2);
    await page.locator('#maze-next:enabled').waitFor();
    if (index === 1) await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `test-results/gardener-production-${index + 2}.png` });
    await page.locator('#maze-next').click();
  }
  await page.locator('.maze-dialogue').waitFor({ state: 'hidden' });
  await page.locator('#dive:enabled').waitFor();
  await page.screenshot({ path: 'test-results/gardener-production-control.png' });
  if (await page.locator('#dive b').innerText() !== '交谈') {
    await page.keyboard.down('ArrowLeft');
    await page.waitForFunction(() => document.querySelector('#dive b')?.textContent === '交谈', null, { timeout: 90000, polling: 100 });
    await page.keyboard.up('ArrowLeft');
  }
  await page.locator('#dive').tap();
  await page.locator('.maze-dialogue:not([hidden])').waitFor();
  assert.ok((await page.locator('#maze-line').innerText()).includes('小屋后面'));
  await page.locator('#maze-close').tap();
  await page.locator('.maze-dialogue').waitFor({ state: 'hidden' });
  assert.deepEqual(errors, []);
  console.log('PASS production assets, real keyboard walk to gardener, four dialogue shots, mobile resize, control return and touch revisit; no page, console or HTTP errors');
} catch (e) {
  console.log(await page.locator('body').innerText());
  await page.screenshot({ path: 'test-results/gardener-production-failure.png' });
  throw e;
} finally { await browser.close(); }
