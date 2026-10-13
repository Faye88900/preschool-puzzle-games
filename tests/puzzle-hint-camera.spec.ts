import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

async function requestDemo(page: Page) { for (let i = 0; i < 3; i++) await page.keyboard.press('KeyH'); }
const shot = (page: Page) => page.evaluate(() => (window as any).__PUZZLE_TEST__.hintCamera());
const snapshot = (page: Page) => page.evaluate(() => (window as any).__PUZZLE_TEST__.snapshot());
const warp = (page: Page, x: number, z: number) => page.evaluate(([x, z]) => (window as any).__PUZZLE_TEST__.warp(x, z), [x, z]);
const inFrame = (point: number[]) => { expect(Math.abs(point[0])).toBeLessThan(.85); expect(Math.abs(point[1])).toBeLessThan(.85); expect(point[2]).toBeLessThan(1); };
async function start(page: Page) {
  await page.addInitScript(() => { (window as any).__spokenHints = []; speechSynthesis.speak = utterance => (window as any).__spokenHints.push(utterance.text); });
  await page.goto('/?level=2&test=1');
  await page.getByRole('button', { name: '跳过动画' }).click();
  await page.locator('#primary').click();
  await mkdir('artifacts/hint-camera', { recursive: true });
}

for (const mobile of [false, true]) {
  test.describe(mobile ? 'touch' : 'keyboard', () => {
  test.use({ hasTouch: mobile });
  test(`animal hint frames grain then coop and returns without repeating (${mobile ? 'portrait' : 'desktop'})`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await start(page);
    await warp(page, 0, -37);
    await page.keyboard.down('KeyW');
    await expect.poll(async () => (await snapshot(page)).region).toBe(2);
    expect((await shot(page)).elapsed).toBeNull();
    await page.keyboard.up('KeyW');
    await expect.poll(async () => (await shot(page)).elapsed ?? 0).toBeGreaterThan(1.05);
    expect(await page.evaluate(() => (window as any).__spokenHints)).toContain('小鸡喜欢谷粒，也能钻进你进不去的小门。');
    let current = await shot(page);
    expect(current.elapsed).toBeLessThan(2.5);
    inFrame(current.grain); inFrame(current.chicken);
    const demo = await page.evaluate(() => (window as any).__PUZZLE_TEST__.interaction().demo);
    expect(demo).not.toBeNull();
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => (window as any).__PUZZLE_TEST__.interaction().demo)).not.toEqual(demo);
    expect((await snapshot(page)).animal.carryingGrain).toBe(false);
    await page.screenshot({ path: `artifacts/hint-camera/${mobile ? 'portrait' : 'desktop'}-grain.png` });
    const still = (await snapshot(page)).position;
    await page.keyboard.press('Escape');
    const frozen = await snapshot(page), time = (await shot(page)).elapsed;
    await page.waitForTimeout(350);
    expect((await shot(page)).elapsed).toBe(time);
    expect((await snapshot(page)).camera).toEqual(frozen.camera);
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await shot(page)).elapsed ?? 0).toBeGreaterThan(4.1);
    current = await shot(page);
    inFrame(current.door);
    await page.screenshot({ path: `artifacts/hint-camera/${mobile ? 'portrait' : 'desktop'}-coop.png` });
    await expect.poll(async () => (await shot(page)).elapsed).toBeNull();
    expect(await page.evaluate(() => (window as any).__PUZZLE_TEST__.interaction().demo)).toBeNull();
    const returned = await snapshot(page);
    expect(returned.position.x).toBeCloseTo(still.x, 2);
    expect(returned.position.z).toBeCloseTo(still.z, 2);
    inFrame(returned.camera.playerNdc);
    await page.screenshot({ path: `artifacts/hint-camera/${mobile ? 'portrait' : 'desktop'}-returned.png` });
    await warp(page, 0, -30); await page.waitForTimeout(100);
    await warp(page, 0, -40); await page.waitForTimeout(300);
    expect((await shot(page)).elapsed).toBeNull();
    if (mobile) { for (let i = 0; i < 3; i++) await page.locator('#hint').tap(); } else await requestDemo(page);
    await expect.poll(async () => (await shot(page)).elapsed ?? 0).toBeGreaterThan(.1);
    const locked = (await snapshot(page)).position;
    if (mobile) {
      await expect(page.locator('#jump')).toBeDisabled();
      const box = (await page.locator('#jump').boundingBox())!;
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    } else await page.keyboard.down('KeyD');
    await page.waitForTimeout(250);
    expect((await shot(page)).returning).toBe(false);
    expect((await snapshot(page)).position).toEqual(locked);
    if (!mobile) await page.keyboard.up('KeyD');
    await expect.poll(async () => (await shot(page)).elapsed).toBeNull();
    expect(errors).toEqual([]);
  });
  });
}

test('interaction and jump wait for the camera; carrying grain focuses the coop; restart resets the intro', async ({ page }) => {
  await start(page);
  await warp(page, -4, -45.6);
  await expect.poll(async () => (await shot(page)).elapsed ?? 0).toBeGreaterThan(.1);
  await page.keyboard.press('KeyE');
  expect((await snapshot(page)).animal.carryingGrain).toBe(false);
  expect((await shot(page)).returning).toBe(false);
  await expect.poll(async () => (await shot(page)).elapsed).toBeNull();
  await page.keyboard.press('KeyE');
  expect((await snapshot(page)).animal.carryingGrain).toBe(true);
  await requestDemo(page);
  expect((await shot(page)).coopOnly).toBe(true);
  await expect.poll(async () => (await shot(page)).elapsed ?? 0).toBeGreaterThan(1.1);
  inFrame((await shot(page)).door);
  await page.keyboard.press('Space');
  expect((await shot(page)).returning).toBe(false);
  await expect.poll(async () => (await shot(page)).elapsed).toBeNull();
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).position.y).toBeGreaterThan(1.2);
  await page.keyboard.press('Escape');
  await page.locator('#restart').click();
  expect((await shot(page)).elapsed).toBeNull();
  expect((await shot(page)).seen).toBe(false);
  await warp(page, 0, -40);
  await expect.poll(async () => (await shot(page)).elapsed ?? 0).toBeGreaterThan(.1);
});

test('reduced motion retains the text hint and normal camera', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => { speechSynthesis.speak = () => {}; });
  await page.goto('/?level=2&test=1');
  await page.locator('#primary').click();
  await warp(page, 0, -40);
  await expect(page.locator('#cue')).toHaveText('小鸡喜欢谷粒，也能钻进你进不去的小门。');
  await page.waitForTimeout(300);
  expect((await shot(page)).elapsed).toBeNull();
  inFrame((await snapshot(page)).camera.playerNdc);
});
