import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const state = (page: Page) => page.evaluate(() => (window as any).__PUZZLE_TEST__.snapshot());
const shot = (page: Page) => page.evaluate(() => (window as any).__PUZZLE_TEST__.workshop());
const warp = (page: Page, x: number, z: number) => page.evaluate(([x, z]) => (window as any).__PUZZLE_TEST__.warp(x, z), [x, z]);
async function approachGuide(page: Page) {
  const [x, , z] = (await shot(page)).position;
  await warp(page, x + 2.2, z + .5);
}
async function start(page: Page, reduced = false) {
  await page.addInitScript(() => { speechSynthesis.speak = () => {}; });
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?level=2&test=1');
  if (!reduced) await page.getByRole('button', { name: '跳过动画' }).click();
  await page.locator('#primary').click();
  await approachGuide(page);
  await mkdir('artifacts/workshop-dialogue', { recursive: true });
}
function inFrame(point: number[]) {
  expect(Math.abs(point[0])).toBeLessThan(.93);
  expect(point[1]).toBeGreaterThan(-.48); // Leave the bottom of the image for dialogue.
  expect(point[1]).toBeLessThan(.95);
  expect(point[2]).toBeLessThan(1);
}
for (const mobile of [false, true]) {
  test.describe(mobile ? 'touch storyboard' : 'keyboard storyboard', () => {
    test.use({ hasTouch: mobile });
    test('six shots preserve the puzzle and return control', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      await start(page);
      await expect(page.locator('#cue')).toContainText('工坊向导在这里');
      await expect(page.locator('#dive b')).toHaveText('对话');
      if (mobile) await page.locator('#dive').tap(); else await page.keyboard.press('KeyE');
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.locator('#workshop-progress')).toHaveCount(0);
      await expect(page.getByRole('dialog')).not.toContainText(/\d\s*\/\s*\d/);
      const initial = (await state(page)).position;
      const guidePosition = (await shot(page)).position;
      await page.keyboard.down('KeyW'); await page.keyboard.press('KeyE');
      for (let i = 0; i < 6; i++) {
        await expect.poll(async () => (await shot(page)).stage).toBe(i);
        if (i === 1) {
          await expect.poll(async () => (await shot(page)).elapsed, { intervals: [30] }).toBeGreaterThan(.9);
          expect((await shot(page)).pose).toBe('point');
          await page.screenshot({ path: `artifacts/workshop-dialogue/${mobile ? 'mobile' : 'desktop'}-point.png` });
        }
        await expect.poll(async () => (await shot(page)).elapsed).toBeGreaterThan(i === 1 ? 3.6 : 1.25);
        const current = await shot(page);
        if (i === 0) { inFrame(current.guide); inFrame((await state(page)).camera.playerNdc); }
        if (i === 2) { inFrame(current.key); expect(current.keyClear).toBe(true); }
        if (i === 3) inFrame(current.plate);
        if (i === 4) { inFrame(current.plate); current.blocks.forEach(inFrame); }
        await page.screenshot({ path: `artifacts/workshop-dialogue/${mobile ? 'mobile' : 'desktop'}-${i + 1}.png` });
        expect((await state(page)).position).toEqual(initial);
        expect((await shot(page)).position).toEqual(guidePosition);
        expect((await state(page)).collected).toEqual([false, false, false]);
        expect((await state(page)).gateOpen).toBe(false);
        if (mobile) await page.locator('.workshop-next').tap(); else await page.locator('.workshop-next').press('Enter');
      }
      await page.keyboard.up('KeyW');
      await expect.poll(async () => (await shot(page)).active).toBe(false);
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await page.keyboard.down('KeyD');
      await expect.poll(async () => (await state(page)).position.x).toBeGreaterThan(initial.x + .5);
      await page.keyboard.up('KeyD');
      expect(errors).toEqual([]);
    });
  });
}

test('exit, resize, pause and solved dialogue do not trap input or reset puzzle progress', async ({ page }) => {
  await start(page, true);
  await page.keyboard.press('KeyE');
  await page.locator('.workshop-next').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await shot(page)).active).toBe(false);
  expect((await state(page)).paused).toBe(false);
  await page.keyboard.press('KeyE');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect.poll(async () => (await state(page)).paused).toBe(true);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await shot(page)).active).toBe(false);
  await warp(page, -29, -11.5); await page.keyboard.press('KeyE');
  expect((await state(page)).carried).toBe(0);
  await warp(page, -24, -16); await page.keyboard.press('KeyE');
  expect((await state(page)).gateOpen).toBe(true);
  await approachGuide(page); await page.keyboard.press('KeyE');
  await expect(page.locator('#workshop-line')).toHaveText('铁门打开了！快去拿里面的钥匙吧。');
  await page.locator('.workshop-leave').click();
  await expect.poll(async () => (await shot(page)).active).toBe(false);
  await warp(page, -24, -31);
  await expect.poll(async () => (await state(page)).collected[0]).toBe(true);
  await approachGuide(page); await page.keyboard.press('KeyE');
  await expect(page.locator('#workshop-line')).toHaveText('你找到工坊的钥匙啦！去其他地方看看吧。');
  await page.locator('.workshop-next').click();
  await expect.poll(async () => (await shot(page)).active).toBe(false);
  await page.keyboard.press('Escape'); await page.locator('#restart').click();
  expect((await shot(page)).active).toBe(false);
  expect((await state(page)).collected).toEqual([false, false, false]);
});

test('guide patrol stays in the workshop, ignores distant player direction and pauses with game', async ({ page }) => {
  await start(page, true);
  await warp(page, 0, 10);
  const initial = await shot(page);
  await expect.poll(async () => (await shot(page)).position[2]).toBeLessThan(initial.position[2] - .6);
  await page.keyboard.press('Escape');
  const paused = await shot(page);
  await page.waitForTimeout(300);
  expect((await shot(page)).position).toEqual(paused.position);
  await page.keyboard.press('Escape');
  const result = await page.evaluate(async () => {
    const threeUrl = '/node_modules/three/build/three.module.js', dialogueUrl = '/src/workshop-dialogue.ts';
    const T = await import(threeUrl);
    const { WorkshopDialogue } = await import(dialogueUrl);
    let blocked = false;
    const npc = new WorkshopDialogue(() => {}, () => {}, () => !blocked);
    const player = new T.Group(), camera = new T.PerspectiveCamera(), look = new T.Vector3();
    player.position.set(30, 0, 30);
    const update = () => npc.update(.1, false, true, camera, look, player, look, look);
    const positions: number[][] = [];
    for (let i = 0; i < 600; i++) { player.position.x = i % 2 ? 30 : -50; update(); positions.push(npc.guide.position.toArray()); }
    blocked = true;
    const before = npc.guide.position.toArray(); update();
    const stopped = npc.guide.position.toArray();
    npc.reset();
    return { positions, before, stopped, reset: npc.guide.position.toArray() };
  });
  expect(result.stopped).toEqual(result.before);
  expect(result.reset).toEqual([-26, .68, -9]);
  for (const [x, y, z] of result.positions) {
    expect(x).toBeGreaterThanOrEqual(-26); expect(x).toBeLessThanOrEqual(-22);
    expect(z).toBeGreaterThanOrEqual(-13); expect(z).toBeLessThanOrEqual(-9);
    expect(y).toBe(.68);
  }
  expect(Math.max(...result.positions.map(p => p[0]))).toBeGreaterThan(-22.1);
});
