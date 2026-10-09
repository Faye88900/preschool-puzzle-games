import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const contexts: AudioContext[] = [];
    Object.assign(window, { __AUDIO_CONTEXTS__: contexts });
    window.AudioContext = class extends AudioContext {
      constructor(options?: AudioContextOptions) { super(options); contexts.push(this); }
    };
  });
});

test('cloud wind starts on navigation in both directions without another click and closes on skip', async ({ page }) => {
  const audio = () => page.evaluate(() => {
    const context = (window as any).__AUDIO_CONTEXTS__[0] as AudioContext | undefined;
    return context ? { state: context.state, time: context.currentTime } : null;
  });
  await page.goto('/');
  await page.getByRole('link', { name: '开始游戏', exact: true }).click();
  for (let trip = 0; trip < 2; trip++) {
    await expect(page.locator('.cloud-journey')).toBeVisible();
    await expect.poll(async () => (await audio())?.state).toBe('running');
    await expect.poll(async () => (await audio())?.time).toBeGreaterThan(.2);
    await page.getByRole('button', { name: '跳过动画' }).click();
    await expect(page.locator('.cloud-journey')).toHaveCount(0);
    await expect.poll(async () => (await audio())?.state).toBe('closed');
    if (trip === 0) await page.getByRole('link', { name: '返回首页' }).click();
  }
});

test('a suspended wind context resumes on a gesture without creating another context', async ({ page }) => {
  await page.goto('/?level=1');
  await expect(page.locator('.cloud-journey')).toBeVisible();
  // Autoplay policy varies across browsers; suspend explicitly to exercise its retry path.
  await page.evaluate(() => ((window as any).__AUDIO_CONTEXTS__[0] as AudioContext).suspend());
  const state = () => page.evaluate(() => (window as any).__AUDIO_CONTEXTS__[0]?.state);
  await expect.poll(state).toBe('suspended');
  await page.locator('.cloud-journey canvas').click({ position: { x: 20, y: 20 } });
  await expect.poll(state).toBe('running');
  expect(await page.evaluate(() => (window as any).__AUDIO_CONTEXTS__.length)).toBe(1);
});

test('effects disabled keeps cloud wind off', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gummy-rush-settings', JSON.stringify({ music: false, effects: false })));
  await page.goto('/');
  await page.getByRole('link', { name: '开始游戏', exact: true }).click();
  await expect(page.locator('.cloud-journey')).toBeVisible();
  await page.locator('.cloud-journey canvas').click({ position: { x: 20, y: 20 } });
  expect(await page.evaluate(() => (window as any).__AUDIO_CONTEXTS__.length)).toBe(0);
});
