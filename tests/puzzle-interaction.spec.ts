import { test, expect, type Page } from '@playwright/test';

const state = (page: Page) => page.evaluate(() => (window as any).__PUZZLE_TEST__.snapshot());
const target = (page: Page) => page.evaluate(() => (window as any).__PUZZLE_TEST__.interaction());
async function warp(page: Page, x: number, z: number) {
  await page.evaluate(([x, z]) => (window as any).__PUZZLE_TEST__.warp(x, z), [x, z]);
  await page.waitForTimeout(300);
  await expect.poll(() => page.evaluate(() => (window as any).__PUZZLE_TEST__.hintCamera().elapsed), { timeout: 15000 }).toBeNull();
}
async function start(page: Page) {
  await page.addInitScript(() => { speechSynthesis.speak = () => {}; });
  await page.goto('/?level=2&test=1');
  await page.getByRole('button', { name: '跳过动画' }).click();
  await page.locator('#primary').click();
}

test('camera locks held keyboard and joystick input, then restores fresh movement', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await page.evaluate(() => (window as any).__PUZZLE_TEST__.warp(22, -13.9));
  const camera = () => page.evaluate(() => (window as any).__PUZZLE_TEST__.hintCamera());
  await expect.poll(async () => (await camera()).elapsed ?? 0).toBeGreaterThan(.1);
  const initial = await state(page);
  const stick = page.locator('#stick'), box = (await stick.boundingBox())!;
  await expect(stick).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#jump')).toBeDisabled();
  await page.keyboard.down('KeyW');
  await page.keyboard.press('Space'); await page.keyboard.press('KeyE');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width - 8, box.y + box.height / 2);
  await page.waitForTimeout(300);
  expect((await state(page)).position).toEqual(initial.position);
  expect((await state(page)).pipeTurns).toEqual(initial.pipeTurns);
  expect((await camera()).returning).toBe(false);
  await expect(page.locator('#stick-knob')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await expect.poll(async () => (await camera()).elapsed, { timeout: 15000 }).toBeNull();
  await expect(page.locator('#jump')).toBeEnabled();
  await expect(stick).toHaveAttribute('aria-disabled', 'false');
  await page.waitForTimeout(250);
  expect((await state(page)).position.x).toBeCloseTo(initial.position.x, 4);
  expect((await state(page)).position.z).toBeCloseTo(initial.position.z, 4);
  await page.keyboard.up('KeyW'); await page.mouse.up();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width - 8, box.y + box.height / 2);
  await expect.poll(async () => (await state(page)).position.x).toBeGreaterThan(initial.position.x + .3);
  await page.mouse.up();
});

test('nearest pipe and front-facing tie share highlight, label and actual action', async ({ page }) => {
  await start(page);
  await warp(page, 22, -19.6);
  await expect.poll(async () => (await target(page)).target?.index).toBe(1);
  await expect(page.locator('#dive b')).toHaveText('转水管');
  expect((await target(page)).ring).toEqual({ visible: true, position: [22, .38, -21] });
  await page.screenshot({ path: 'artifacts/interaction-target.png' });
  await page.keyboard.press('KeyE');
  expect((await state(page)).pipeTurns).toEqual([1, 1, 3]);
  await warp(page, 22, -19);
  expect((await target(page)).target.index).toBe(1);
  await page.keyboard.press('KeyE');
  expect((await state(page)).pipeTurns).toEqual([1, 2, 3]);
  await warp(page, 0, 10);
  await expect(page.locator('#dive b')).toHaveText('看一看');
  expect((await target(page)).ring.visible).toBe(false);
});

test('a dropped block overlapping a pipe wins when closer, including touch input', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await warp(page, -29, -11.5);
  await page.locator('#dive').click();
  expect((await state(page)).carried).toBe(0);
  await warp(page, 22, -14.4);
  await page.locator('#dive').click();
  await expect.poll(async () => (await target(page)).target?.kind).toBe('piece');
  await expect(page.locator('#dive b')).toHaveText('拿起');
  const before = (await state(page)).pipeTurns;
  await page.locator('#dive').click();
  expect((await state(page)).carried).toBe(0);
  expect((await state(page)).pipeTurns).toEqual(before);
});

test('hints progress only on request, demonstrate without solving, lock controls and reset on restart', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await start(page);
  for (const [x, z] of [[-24, -20], [22, -13.9], [-4, -45.6]]) {
    await warp(page, x, z);
    await page.waitForTimeout(500);
    expect((await target(page)).demo).toBeNull();
    expect(await page.evaluate(() => (window as any).__PUZZLE_TEST__.hintCamera().elapsed)).toBeNull();
    const before = await state(page);
    await page.keyboard.press('KeyH');
    const first = await page.locator('#cue').innerText();
    expect((await target(page)).hintLevel).toBe(1);
    await page.keyboard.press('KeyH');
    expect(await page.locator('#cue').innerText()).not.toBe(first);
    expect((await target(page)).demo).toBeNull();
    await page.keyboard.press('KeyH');
    await expect(page.locator('#cue')).toContainText('示范');
    expect((await target(page)).demo).not.toBeNull();
    const initial = (await target(page)).demo;
    await page.waitForTimeout(1600);
    expect((await target(page)).demo).not.toEqual(initial);
    expect((await state(page)).pipeTurns).toEqual(before.pipeTurns);
    expect((await state(page)).placed).toEqual(before.placed);
    expect((await state(page)).animal.carryingGrain).toBe(before.animal.carryingGrain);
    await page.screenshot({ path: `test-results/hint-demo-${x}.png` });
    await page.keyboard.press('Space');
    expect((await target(page)).demo).not.toBeNull();
    await expect.poll(() => page.evaluate(() => (window as any).__PUZZLE_TEST__.hintCamera().elapsed), { timeout: 15000 }).toBeNull();
    expect((await target(page)).demo).toBeNull();
  }
  await page.keyboard.press('KeyE');
  expect((await state(page)).animal.carryingGrain).toBe(true);
  await page.keyboard.press('KeyH');
  expect((await target(page)).hintLevel).toBe(1);
  await page.keyboard.press('Escape');
  await page.locator('#restart').click();
  expect((await target(page)).hintLevel).toBe(0);
  expect((await target(page)).demo).toBeNull();
  expect(errors).toEqual([]);
});

test('challenge title states the qualification rule on desktop and small phones', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?level=1');
  await expect(page.locator('#menu-title')).toHaveText('前 8 名到达终点即可晋级');
  for (const width of [320, 1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const bounds = await page.locator('#menu-title').evaluate(el => ({ width: el.clientWidth, content: el.scrollWidth }));
    expect(bounds.content).toBeLessThanOrEqual(bounds.width);
  }
  await page.screenshot({ path: 'test-results/challenge-title-mobile.png' });
});

test('reduced motion keeps a static placement demonstration and never opens the gate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?level=2&test=1');
  await page.locator('#primary').click();
  await warp(page, -29, -11.5);
  await page.keyboard.press('KeyE');
  expect((await state(page)).carried).toBe(0);
  for (let i = 0; i < 3; i++) await page.keyboard.press('KeyH');
  await expect(page.locator('#cue')).toContainText('放下正方体');
  await expect.poll(async () => (await target(page)).demo?.position).toEqual([-24, 1.005, -17]);
  const demo = (await target(page)).demo;
  await page.waitForTimeout(400);
  expect((await target(page)).demo).toEqual(demo);
  expect((await state(page)).gateOpen).toBe(false);
  expect(await page.evaluate(() => (window as any).__PUZZLE_TEST__.hintCamera().elapsed)).toBeNull();
  await warp(page, -24, -16);
  await page.keyboard.press('KeyE');
  expect((await state(page)).gateOpen).toBe(true);
  expect((await target(page)).demo).toBeNull();
  await page.keyboard.press('KeyH');
  expect((await target(page)).hintLevel).toBe(1);
});
