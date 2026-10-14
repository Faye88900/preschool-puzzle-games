import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', hasTouch: true });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await mkdir('test-results', { recursive: true });
const base = 'http://127.0.0.1:5191';
// Test-only access to simulation state; no diagnostics are added to shipped code.
for (const [file, name] of [['race', 'Race'], ['puzzle', 'PuzzleGarden']]) {
  await page.route(new RegExp(`/src/${file}\\.ts(?:\\?.*)?$`), async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `\nconst initForTest = ${name}.prototype.init; ${name}.prototype.init = async function() { window.__testGame = this; return initForTest.call(this); };` });
  });
}
async function ready(url) {
  console.log('Checking', url);
  await page.goto(base + url);
  await page.waitForLoadState('networkidle');
  await page.locator('.game-loading').waitFor({ state: 'detached', timeout: 60000 });
}
async function noChinese() {
  const body = await page.locator('#game-ui').innerText();
  assert.ok(!/\p{Script=Han}/u.test(body), body);
}
try {
  await ready('/?lang=zh');
  assert.equal(await page.locator('#language').isVisible(), false);
  await page.locator('#home-settings').click();
  await page.locator('#language').selectOption('en');
  await page.waitForURL('**lang=en');
  await page.getByRole('link', { name: 'Play', exact: true }).waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  await page.locator('#home-settings').click();
  await page.locator('#assist-setting').check();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.screenshot({ path: 'test-results/home-en.png' });
  await page.getByRole('link', { name: 'Play', exact: true }).click();
  await page.waitForURL('**level=1&lang=en');
  await page.locator('.game-loading').waitFor({ state: 'detached', timeout: 60000 });
  assert.equal(await page.locator('.race-assist-setting input').isChecked(), true);
  assert.equal(await page.locator('.race-assist-setting').isVisible(), false);
  await noChinese();
  await page.locator('#primary').click();
  await page.waitForFunction(() => window.__testGame?.state === 'racing');
  const startZ = await page.evaluate(() => window.__testGame.people[0].body.translation().z);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(650);
  await page.keyboard.up('ArrowUp');
  assert.ok(await page.evaluate(() => window.__testGame.people[0].body.translation().z) < startZ - .5);
  for (const [z, edge] of [[-15, 9], [-92, 7.5]]) {
    await page.evaluate(({z, edge}) => { const g = window.__testGame; const c = g.people[0]; c.body.setTranslation({x:edge,y:1,z},true); c.body.setLinvel({x:0,y:0,z:0},true); c.stun=0; }, {z,edge});
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(700);
    await page.keyboard.up('ArrowRight');
    const p = await page.evaluate(() => window.__testGame.people[0].body.translation());
    assert.ok(p.x < edge + .3 && p.y > .3, JSON.stringify(p));
  }
  await page.locator('#pause').click();
  assert.equal(await page.locator('.race-assist-setting').isVisible(), true);
  await page.locator('.race-assist-setting input').uncheck();
  await page.locator('#primary').click();
  assert.equal(await page.evaluate(() => window.__testGame.settings.assist), false);
  await page.evaluate(() => { const c=window.__testGame.people[0]; c.body.setTranslation({x:0,y:1,z:-15},true); c.body.setLinvel({x:0,y:0,z:0},true); });
  await page.keyboard.press('Space');
  await page.waitForTimeout(250);
  assert.ok(await page.evaluate(() => window.__testGame.people[0].body.translation().y) > 1.2);
  await page.locator('#pause').click();
  await page.locator('#restart').click();
  assert.equal(await page.evaluate(() => window.__testGame.people[0].checkpoint), 0);
  await page.screenshot({ path: 'test-results/race-en.png' });
  for (const lang of ['ms', 'en', 'zh']) {
    await ready('/?level=2&lang=' + lang);
    await page.locator('#primary').click();
    await page.evaluate(() => { const g = window.__testGame; const p=g.workshop.guide.position; g.body.setTranslation({x:p.x+1,y:.8,z:p.z},true); g.body.setLinvel({x:0,y:0,z:0},true); });
    await page.waitForTimeout(200);
    await page.keyboard.press('KeyE');
    await page.locator('.workshop-dialogue[open]').waitFor();
    for (let i=0;i<3;i++) await page.locator('.workshop-next').click();
    assert.equal(await page.locator('.workshop-shapes').isVisible(), false);
    for (let i=0;i<3;i++) await page.locator('.workshop-next').click();
    await page.waitForFunction(() => !window.__testGame.workshop.active);
    await page.keyboard.press('KeyE');
    await page.locator('.workshop-dialogue[open]').waitFor();
    assert.equal(await page.locator('.workshop-shapes').isVisible(), true);
    assert.equal(await page.locator('.workshop-shapes figure').count(), 4);
    if (lang !== 'zh') {
      await noChinese();
      assert.ok(!/\p{Script=Han}/u.test(await page.locator('.workshop-dialogue').innerText()));
    }
    await page.screenshot({ path: `test-results/workshop-${lang}.png` });
    await page.setViewportSize({width:390,height:844});
    const close = await page.locator('.workshop-leave').boundingBox();
    assert.ok(close.width >= 44 && close.height >= 44 && close.x >= 0 && close.y >= 0 && close.x+close.width<=390);
    await page.screenshot({path:`test-results/workshop-${lang}-mobile.png`});
    if (lang === 'en') {
      await page.setViewportSize({width:844,height:390});
      await page.screenshot({path:'test-results/workshop-en-landscape.png'});
      await page.locator('.workshop-leave').tap();
    } else {
    await page.touchscreen.tap(close.x + close.width / 2, close.y + close.height / 2);
    }
    assert.equal(await page.locator('.workshop-dialogue').isVisible(), false);
    await page.setViewportSize({width:1280,height:800});
  }
  await ready('/?lang=ms');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/home-ms-mobile.png'});
  await page.locator('#home-settings').tap();
  await page.screenshot({path:'test-results/settings-ms-mobile.png'});
  assert.ok(await page.locator('#assist-setting').isVisible());
  assert.deepEqual(errors, []);
  console.log('PASS: language navigation, settings, keyboard movement/jump, wide/narrow edge assist, toggle/restart, trilingual dialogue, mobile close; no page errors');
} finally { await browser.close(); }
