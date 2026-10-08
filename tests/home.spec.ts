import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

test('button sounds follow effects settings for mouse, touch, and keyboard', async ({ browser }) => {
  const page = await browser.newPage({ hasTouch: true });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    (window as any).__BUTTON_PLAYS__ = 0;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.id === 'button-sound') (window as any).__BUTTON_PLAYS__++;
      return play.call(this);
    };
  });
  await page.goto('/');
  const sound = page.locator('#button-sound');
  const plays = () => page.evaluate(() => (window as any).__BUTTON_PLAYS__);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  expect(await plays()).toBe(1);
  await expect.poll(() => sound.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(0);
  expect(await sound.evaluate((audio: HTMLAudioElement) => audio.currentSrc.endsWith('/audio/ui/button-click.wav'))).toBe(true);
  expect(await sound.evaluate((audio: HTMLAudioElement) => audio.duration)).toBeCloseTo(.55, 2);
  expect(await sound.evaluate((audio: HTMLAudioElement) => audio.error)).toBeNull();
  await page.getByRole('switch', { name: '音效与语音' }).uncheck();
  const mutedPlays = await plays();
  await page.getByRole('button', { name: '完成' }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  expect(await plays()).toBe(mutedPlays);
  await page.getByRole('switch', { name: '音效与语音' }).check();
  await page.getByRole('button', { name: '完成' }).focus();
  await page.keyboard.press('Enter');
  expect(await plays()).toBe(mutedPlays + 1);
  await page.goto('/?level=1');
  await expect(page.locator('#primary')).toBeVisible();
  await page.locator('#pause').dispatchEvent('pointerdown', { pointerType: 'touch', button: 0 });
  expect(await plays()).toBe(0);
  await page.locator('#primary').tap();
  expect(await plays()).toBe(1);
  await expect(page.locator('#jump')).toBeVisible();
  await page.locator('#jump').focus();
  await page.keyboard.press('Space');
  expect(await plays()).toBe(2);
  expect(errors).toEqual([]);
  await page.close();
});

test('start game stays until the button click has been heard', async ({ page }) => {
  await page.goto('/');
  let heard = 0;
  let left = false;
  const watch = (async () => {
    while (!left) {
      if (/level=1/.test(page.url())) break;
      const time = await page.locator('#button-sound').evaluate((audio: HTMLAudioElement) => audio.currentTime).catch(() => -1);
      if (time > heard) heard = time;
      await page.waitForTimeout(20);
    }
  })();
  await page.getByRole('link', { name: '开始游戏' }).click();
  await expect(page).toHaveURL(/level=1/);
  left = true;
  await watch;
  expect(heard).toBeGreaterThan(0.4);
});

test('homepage music loads, plays, and follows the persisted switch', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  const music = page.locator('#home audio');
  await expect.poll(() => music.evaluate((audio: HTMLAudioElement) => audio.readyState)).toBeGreaterThanOrEqual(3);
  expect(await music.evaluate((audio: HTMLAudioElement) => ({ src: audio.currentSrc.endsWith('/audio/startime.mp3'), loop: audio.loop, error: audio.error }))).toEqual({ src: true, loop: true, error: null });
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await expect.poll(() => music.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(0);
  await page.getByRole('switch', { name: '背景音乐' }).uncheck();
  expect(await music.evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await expect(page.getByRole('switch', { name: '背景音乐' })).not.toBeChecked();
  expect(await music.evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
  await page.getByRole('switch', { name: '背景音乐' }).check();
  await expect.poll(() => music.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(0);
  await page.getByRole('button', { name: '完成' }).click();
  await page.getByRole('link', { name: '开始游戏' }).click();
  await expect(page).toHaveURL(/level=1/);
  await expect(page.locator('#home audio')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('homepage routes, persisted audio settings, and responsive controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('link', { name: '开始游戏' })).toBeVisible();
  await expect(page.locator('#game-ui')).toHaveCount(0);
  await page.waitForTimeout(1200);
  const pixels = PNG.sync.read(await page.locator('#game').screenshot());
  const colors = new Set<string>();
  for (let i = 0; i < pixels.data.length; i += 160) colors.add(pixels.data.subarray(i, i + 3).toString('hex'));
  expect(colors.size).toBeGreaterThan(100);
  await page.screenshot({ path: 'test-results/outputs/home-desktop.png' });
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('switch', { name: '背景音乐' }).uncheck();
  await page.getByRole('button', { name: '完成' }).click();
  await page.reload();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await expect(page.getByRole('switch', { name: '背景音乐' })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: '音效与语音' })).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.locator('#home-settings')).toBeFocused();
  await page.getByRole('link', { name: '开始游戏' }).click();
  await expect(page).toHaveURL(/level=1/);
  await expect(page.locator('#primary')).toBeVisible();
  await expect(page.locator('#home')).toHaveCount(0);
  await page.goto('/?level=1&test=1');
  await expect(page.locator('#primary')).toBeVisible();
  await page.locator('#primary').click();
  await expect.poll(() => page.evaluate(() => (window as any).__THREE_GAME_DIAGNOSTICS__?.media.music.muted)).toBe(true);
  expect(await page.evaluate(() => (window as any).__THREE_GAME_DIAGNOSTICS__.media.countdown.muted)).toBe(false);
  await page.locator('#pause').click();
  await page.getByRole('link', { name: '返回首页' }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('switch', { name: '背景音乐' }).check();
  await page.getByRole('switch', { name: '音效与语音' }).uncheck();
  await page.getByRole('button', { name: '完成' }).click();
  await page.getByRole('button', { name: '选择关卡' }).click();
  await page.screenshot({ path: 'test-results/outputs/home-levels.png' });
  await page.getByRole('link', { name: /第二关/ }).click();
  await expect(page).toHaveURL(/level=2/);
  await expect(page.locator('#primary')).toBeVisible();
  await page.goto('/?level=2&test=1');
  await expect(page.locator('#primary')).toBeVisible();
  const audio = await page.evaluate(() => (window as any).__PUZZLE_TEST__.audio());
  expect(audio.music.muted).toBe(false);
  expect(audio.master).toBe(0);
  await page.getByRole('link', { name: '返回首页' }).click();
  for (const viewport of [{width:390,height:844}, {width:844,height:390}, {width:768,height:1024}]) {
    await page.setViewportSize(viewport);
    for (const selector of ['.home-start', '#choose-level', '#home-settings']) {
      const box = (await page.locator(selector).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: `test-results/outputs/home-${viewport.width}.png` });
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await expect(page.getByRole('switch', { name: '音效与语音' })).not.toBeChecked();
    await page.getByRole('button', { name: '完成' }).click();
  }
  expect(errors).toEqual([]);
});
