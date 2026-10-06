import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

test('garden cards share aligned text, buttons and responsive styling', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?level=2&test=1');
  await page.waitForFunction(() => Boolean((window as any).__PUZZLE_TEST__));
  // Render the real shared UI independently of puzzle progression.
  await page.evaluate(async () => {
    const modulePath = '/src/ui.ts';
    const { UI } = await import(modulePath);
    document.getElementById('game-ui')!.remove();
    const calls = { start: 0, pause: 0 };
    const noop = () => {};
    const ui = new UI({ start: () => calls.start++, pause: () => calls.pause++, mute: noop, jump: noop, dive: noop, move: noop });
    ui.configurePuzzle();
    Object.assign(window, { __MENU_PREVIEW__: ui, __MENU_CALLS__: calls });
  });
  const outputs = resolve('test-results/outputs');
  await mkdir(outputs, { recursive: true });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    const styles = [];
    for (const state of ['ready', 'paused', 'qualified']) {
      await page.evaluate(state => (window as any).__MENU_PREVIEW__.updatePuzzle(state === 'paused' ? 'racing' : state, state === 'paused', false, '', state === 'qualified' ? 3 : 0, '互动'), state);
      await expect(page.locator('#menu-title')).toHaveText(state === 'ready' ? '找齐钥匙' : state === 'paused' ? '休息一下' : '大门打开啦！');
      const layout = await page.locator('.menu-card').evaluate(card => {
        const rect = card.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        const selectors = ['#menu-eyebrow', '#menu-title', '#menu-description', '#primary', '#menu-footer', '.level-link'];
        const offsets = selectors.filter(selector => !(card.querySelector(selector) as HTMLElement).hidden).map(selector => {
          const element = card.querySelector(selector)!;
          const range = document.createRange();
          range.selectNodeContents(element);
          if (selector === '#primary') range.selectNode(element.firstChild!);
          const box = range.getBoundingClientRect();
          return Math.abs(center - (box.left + box.width / 2));
        });
        const primary = card.querySelector('#primary')!.getBoundingClientRect();
        const link = card.querySelector('.level-link')!.getBoundingClientRect();
        const css = getComputedStyle(card);
        return { offsets, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, primaryWidth: primary.width, linkWidth: link.width, style: [rect.width, css.backgroundColor, css.borderRadius, getComputedStyle(card.querySelector('h1')!).fontSize] };
      });
      expect(Math.max(...layout.offsets)).toBeLessThan(2);
      expect(layout.top).toBeGreaterThanOrEqual(0);
      expect(layout.bottom).toBeLessThanOrEqual(viewport.height);
      expect(layout.left).toBeGreaterThanOrEqual(0);
      expect(layout.right).toBeLessThanOrEqual(viewport.width);
      expect(layout.linkWidth).toBe(layout.primaryWidth);
      styles.push(layout.style);
      await expect(page.locator('.level-link')).toHaveAttribute('href', '?level=1');
      await expect(page.locator('#restart')).toBeVisible({ visible: state === 'paused' });
      await expect(page.locator('#menu-footer')).toBeVisible({ visible: state === 'qualified' });
      if (viewport.width === 390 || viewport.width === 1440) await page.screenshot({ path: resolve(outputs, `garden-card-${state}-${viewport.width}.png`) });
      await page.locator('#primary').click();
    }
    expect(styles[1]).toEqual(styles[0]);
    expect(styles[2]).toEqual(styles[0]);
  }
  expect(await page.evaluate(() => (window as any).__MENU_CALLS__)).toEqual({ start: 8, pause: 4 });
  expect(errors).toEqual([]);
});
