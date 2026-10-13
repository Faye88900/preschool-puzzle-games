import { test, expect, type Page } from '@playwright/test';

const state = (page: Page) => page.evaluate(() => (window as any).__PUZZLE_TEST__.snapshot());
const pond = (page: Page) => page.evaluate(() => (window as any).__PUZZLE_TEST__.pond());
const warp = async (page: Page, x: number, z: number, y = .8) => {
  await page.evaluate(([x, z, y]) => (window as any).__PUZZLE_TEST__.warp(x, z, y), [x, z, y]);
};
async function start(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => { speechSynthesis.speak = () => {}; });
  await page.goto('/?level=2&test=1');
  await page.locator('#primary').click();
}
async function turn(page: Page, x: number, z: number, count: number) {
  await warp(page, x, z);
  for (let i = 0; i < count; i++) await page.keyboard.press('KeyE');
}

test('each newly connected water segment lights briefly and reports progress', async ({ page }) => {
  await start(page);
  await turn(page, 22, -13.9, 3);
  await expect(page.locator('#pipe-feedback')).toHaveText('✓ 已接通 1 / 3 段水管');
  expect((await pond(page)).mouths).toEqual([[1.4, 1.4], [0, 0], [0, 0]]);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1700);
  expect((await pond(page)).mouths[0][0]).toBe(1.4);
  await page.keyboard.press('Escape');
  await expect(page.locator('#pipe-feedback')).toBeHidden();
  expect((await pond(page)).mouths[0][0]).toBe(0);
  await turn(page, 22, -24.1, 2);
  await expect(page.locator('#pipe-feedback')).toContainText('2 / 3');
  await page.screenshot({ path: 'artifacts/feedback-water.png' });
  await turn(page, 29.1, -21, 1);
  await expect(page.locator('#pipe-feedback')).toContainText('3 / 3');
  expect((await state(page)).pipesSolved).toBe(true);
});

test('blocked and distant chickens keep a visible, bounded location marker, even with sound off', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await page.locator('#sound').click();
  await warp(page, -4, -47); await page.locator('#dive').click();
  await warp(page, -4, -50);
  await expect.poll(async () => (await state(page)).animal.position[2]).toBeLessThan(-48.5);
  await warp(page, -4, -55);
  await expect.poll(async () => (await state(page)).animal.mood).toBe('blocked');
  await expect(page.locator('#chicken-marker')).toHaveText('🐥');
  await expect(page.locator('#chicken-marker')).toHaveAttribute('aria-label', '小鸡被挡住了');
  await page.screenshot({ path: 'artifacts/feedback-chicken-blocked.png' });
  await warp(page, 15, -50);
  await expect.poll(async () => (await state(page)).animal.mood).toBe('waiting');
  await expect(page.locator('#chicken-marker')).toHaveText('🐥');
  await expect(page.locator('#chicken-marker')).toHaveAttribute('aria-label', '小鸡落后了');
  const bounds = await page.locator('#chicken-marker').boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'artifacts/feedback-chicken-waiting.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('#chicken-marker')).toBeHidden();
  await page.locator('#restart').click();
  await expect(page.locator('#chicken-marker')).toBeHidden();
});

test('first guide visit keeps the full story; later visits use progress hints and restart restores it', async ({ page }) => {
  await start(page);
  const ask = async () => {
    const [x, , z] = await page.evaluate(() => (window as any).__PUZZLE_TEST__.workshop().position);
    await warp(page, x + 2.2, z + .5); await page.keyboard.press('KeyE');
  };
  await ask();
  await expect(page.locator('#workshop-line')).toHaveText('我想找钥匙，你有看到吗？');
  for (let i = 0; i < 5; i++) await page.locator('.workshop-next').click();
  await expect(page.locator('#workshop-line')).toHaveText('我去试试看！');
  await page.locator('.workshop-next').click();
  await expect.poll(() => page.evaluate(() => (window as any).__PUZZLE_TEST__.workshop().active)).toBe(false);
  await ask();
  await expect(page.locator('#workshop-line')).toHaveText('看看正方体积木，它和机关的形状一样。');
  await expect(page.locator('.workshop-next')).toContainText('出发吧');
  await page.locator('.workshop-next').click();
  await expect.poll(() => page.evaluate(() => (window as any).__PUZZLE_TEST__.workshop().active)).toBe(false);
  await warp(page, -29, -11.5); await page.keyboard.press('KeyE');
  await warp(page, -24, -16); await page.keyboard.press('KeyE');
  await ask();
  await expect(page.locator('#workshop-line')).toHaveText('铁门打开了！快去拿里面的钥匙吧。');
  await page.locator('.workshop-next').click();
  await expect.poll(() => page.evaluate(() => (window as any).__PUZZLE_TEST__.workshop().active)).toBe(false);
  await page.keyboard.press('Escape'); await page.locator('#restart').click();
  await ask();
  await expect(page.locator('#workshop-line')).toHaveText('我想找钥匙，你有看到吗？');
});

test('larger blue-key pickup range still requires reaching the flower height', async ({ page }) => {
  await start(page);
  await turn(page, 22, -13.9, 3);
  await turn(page, 22, -24.1, 2);
  await turn(page, 29.1, -21, 1);
  await warp(page, 27.6, -25.5);
  await page.waitForTimeout(200);
  expect((await state(page)).collected[1]).toBe(false);
  await warp(page, 27.6, -25.5, 3.4);
  await expect.poll(async () => (await state(page)).collected[1]).toBe(true);
});
