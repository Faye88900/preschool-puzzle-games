import { test, expect } from '@playwright/test';

test('dialogue fits long lines, mouse and Enter advance once, and exit stays keyboard accessible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => { speechSynthesis.speak = () => {}; });
  await page.goto('/?level=2&test=1');
  await page.locator('#primary').click();
  await page.evaluate(() => {
    const hooks = (window as any).__PUZZLE_TEST__, [x, , z] = hooks.workshop().position;
    hooks.warp(x + 2.2, z + .5);
  });
  await page.keyboard.press('KeyE');
  await expect(page.locator('#workshop-speaker')).toHaveText('玩家');
  await expect(page.locator('#workshop-progress')).toHaveCount(0);
  await page.locator('#workshop-line').click();
  await expect(page.locator('#workshop-line')).toHaveText('你看，铁门后面是不是有东西在发光？');
  await page.locator('.workshop-next').click();
  await expect(page.locator('#workshop-line')).toHaveText('看到了！可是门关着……');
  await page.keyboard.press('Enter');
  await expect(page.locator('#workshop-line')).toContainText('它的形状和哪块积木一样呢');
  for (const [width, height] of [[1440, 900], [768, 1024], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height });
    const fit = await page.locator('.workshop-dialogue').evaluate(el => {
      const rect = (selector: string) => el.querySelector(selector)!.getBoundingClientRect().toJSON();
      return { overflow: el.scrollHeight > el.clientHeight, line: rect('#workshop-line'),
        next: rect('.workshop-next'), exit: rect('.workshop-leave'), speaker: rect('#workshop-speaker') };
    });
    expect(fit.overflow).toBe(false);
    for (const rect of [fit.next, fit.exit, fit.speaker, fit.line]) {
      expect(rect.left).toBeGreaterThanOrEqual(0); expect(rect.right).toBeLessThanOrEqual(width);
      expect(rect.top).toBeGreaterThanOrEqual(0); expect(rect.bottom).toBeLessThanOrEqual(height);
    }
    for (const rect of [fit.next, fit.exit]) {
      expect(rect.height).toBeGreaterThanOrEqual(44); expect(rect.width).toBeGreaterThanOrEqual(44);
    }
    expect(fit.line.bottom).toBeLessThanOrEqual(fit.next.top);
  }
  await page.locator('.workshop-bubble').click({ position: { x: 25, y: 65 } });
  await expect(page.locator('#workshop-speaker')).toHaveText('观察一下');
  await page.locator('#workshop-speaker').click();
  await expect(page.locator('#workshop-line')).toHaveText('我去试试看！');
  await page.locator('.workshop-leave').focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('touching dialogue text and blank space advances once; close does not advance', async ({ browser }) => {
  const page = await browser.newPage({ hasTouch: true, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await page.addInitScript(() => { speechSynthesis.speak = () => {}; });
  await page.goto('http://127.0.0.1:5188/?level=2&test=1');
  await page.locator('#primary').tap();
  await page.evaluate(() => {
    const hooks = (window as any).__PUZZLE_TEST__, [x, , z] = hooks.workshop().position;
    hooks.warp(x + 2.2, z + .5);
  });
  await page.locator('#dive').tap();
  await expect(page.locator('#workshop-line')).toHaveText('我想找钥匙，你有看到吗？');
  await page.locator('#workshop-line').tap();
  await expect(page.locator('#workshop-line')).toHaveText('你看，铁门后面是不是有东西在发光？');
  await page.locator('.workshop-bubble').tap({ position: { x: 28, y: 125 } });
  await expect(page.locator('#workshop-line')).toHaveText('看到了！可是门关着……');
  await page.locator('.workshop-leave').tap();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('#workshop-line')).toHaveText('看到了！可是门关着……');
  await page.close();
});
