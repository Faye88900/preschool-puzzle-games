import { test, expect, type Page } from '@playwright/test';

async function prepare(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => { speechSynthesis.speak = () => {}; });
}
const state = (page: Page) => page.evaluate(() => (window as any).__PUZZLE_TEST__.snapshot());
const warp = (page: Page, x: number, z: number) => page.evaluate(([x, z]) => (window as any).__PUZZLE_TEST__.warp(x, z), [x, z]);

test('home and race share the name and player avatar across small and wide screens', async ({ page }) => {
  await prepare(page);
  await page.goto('/');
  await expect(page.locator('.home-logo')).toHaveAttribute('aria-label', '云端冒险 · Bean Rush');
  const avatar = await page.locator('.home-avatar').innerHTML();
  for (const [width, height] of [[1440, 900], [390, 844], [844, 390]]) {
    await page.setViewportSize({ width, height });
    for (const selector of ['.home-logo', '.home-start', '.home-levels']) {
      const box = (await page.locator(selector).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
    }
    await page.screenshot({ path: `artifacts/identity-home-${width}.png` });
  }
  await page.goto('/?level=1');
  await expect(page.locator('.wordmark')).toHaveAttribute('aria-label', '云端冒险 · Bean Rush');
  await expect(page.locator('.wordmark')).not.toContainText('GUMMY');
  expect(await page.locator('.brand-avatar').innerHTML()).toBe(avatar);
  expect(await page.locator('.player-face').innerHTML()).toBe(avatar);
  await expect(page.locator('.course-title strong')).toHaveText('天空赛道');
  await page.screenshot({ path: 'artifacts/identity-race.png' });
});

test('one chicken road sign remains and the key counter tracks pickups and restart', async ({ page }) => {
  await prepare(page);
  await page.goto('/?level=2&test=1');
  await expect(page.locator('#menu-tips svg')).toHaveCount(3);
  await page.locator('#primary').click();
  await expect(page.locator('.task-item')).toHaveCount(0);
  await expect(page.locator('.key-count-icon svg')).toHaveCount(1);
  await expect(page.locator('#finished')).toHaveText('0 / 3');
  await expect.poll(() => page.evaluate(() => (window as any).__PUZZLE_TEST__.signs().filter((sign: any) => sign.loaded).length)).toBe(3);
  expect(await page.evaluate(() => (window as any).__PUZZLE_TEST__.signs().filter((sign: any) => sign.name === 'task-sign-2').length)).toBe(1);
  await warp(page, 0, 2);
  await page.screenshot({ path: 'artifacts/identity-road-signs.png' });
  await warp(page, -29, -11.5); await page.keyboard.press('KeyE');
  await warp(page, -24, -16); await page.keyboard.press('KeyE');
  await expect(page.locator('#finished')).toHaveText('0 / 3');
  await warp(page, -24, -31);
  await expect(page.locator('#finished')).toHaveText('1 / 3');
  for (const [x, z, turns] of [[22, -13.9, 3], [22, -24.1, 2], [29.1, -21, 1]]) {
    await warp(page, x, z);
    for (let i = 0; i < turns; i++) await page.keyboard.press('KeyE');
  }
  await warp(page, -4, -47); await page.keyboard.press('KeyE');
  for (const [x, z] of [[0, -50], [4, -51], [8, -53], [13, -54], [13, -58]]) {
    await warp(page, x, z);
    await expect.poll(async () => {
      const p = (await state(page)).animal.position;
      return Math.hypot(p[0] - x, p[2] - z);
    }).toBeLessThan(1.25);
  }
  await page.keyboard.press('KeyE');
  await expect(page.locator('#finished')).toHaveText('2 / 3');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const badge = (await page.locator('.race-stats').boundingBox())!;
    const tools = (await page.locator('.hud-tools').boundingBox())!;
    expect(badge.x + badge.width).toBeLessThanOrEqual(tools.x);
    await page.screenshot({ path: `artifacts/identity-tasks-${width}.png` });
  }
  await page.keyboard.press('Escape'); await page.locator('#restart').click();
  await expect(page.locator('#finished')).toHaveText('0 / 3');
});
