import { test, expect } from '@playwright/test';
test.use({ video: 'on' });

test('homepage opens without a cloud ride; starting a level plays it', async ({ page }) => {
  const journeys: string[] = [];
  page.on('request', request => { if (request.url().includes('/src/journey.ts')) journeys.push(request.url()); });
  await page.goto('/');
  await expect(page.getByRole('link', { name: '开始游戏', exact: true })).toBeVisible();
  await expect(page.locator('.game-loading')).toHaveCount(0);
  await expect(page.locator('.cloud-journey')).toHaveCount(0);
  expect(journeys).toEqual([]);
  await page.getByRole('link', { name: '开始游戏', exact: true }).click();
  await expect(page.locator('.cloud-journey')).toBeVisible();
});

for (const level of [1, 2]) {
  test(`level ${level} returns home with a ride; reloading home bypasses it`, async ({ page }) => {
    if (level === 2) await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/?level=${level}`);
    await expect(page.locator('#primary')).toBeVisible();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByRole('link', { name: '返回首页' }).click();
    await expect(page.getByRole('dialog', { name: '乘云前往空岛' })).toBeVisible();
    await page.getByRole('button', { name: '跳过动画' }).click();
    await expect(page.getByRole('link', { name: '开始游戏', exact: true })).toBeVisible();
    await expect(page).toHaveURL('http://127.0.0.1:5188/');
    await page.reload();
    await expect(page.getByRole('link', { name: '开始游戏', exact: true })).toBeVisible();
    await expect(page.locator('.cloud-journey')).toHaveCount(0);
  });
}

test('cloud ride takes off, lands, and releases the level controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const frames: { time: number; heading: number; twist: number; charge: number; height: number; passing: number; wind: number }[] = [];
    Object.assign(window, { __JOURNEY_FRAMES__: frames });
    const sample = () => {
      const d = (window as any).__JOURNEY_DIAGNOSTICS__;
      if (d && !d.revealed && frames.at(-1)?.time !== d.elapsed) frames.push({ time: d.elapsed, heading: d.pose.heading, twist: d.pose.body[1], charge: d.charge, height: d.cloudHeight, passing: d.passing, wind: d.windLevel });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.goto('/?level=1&test=1');
  const ride = page.locator('.cloud-journey');
  await expect(ride).toHaveAttribute('data-phase', 'takeoff');
  const takeoffCamera = await page.evaluate(() => (window as any).__JOURNEY_DIAGNOSTICS__.camera);
  await ride.locator('canvas').click({ position: { x: 20, y: 20 } });
  await expect(ride).toHaveAttribute('data-phase', 'flying');

  const first = await page.evaluate(() => (window as any).__JOURNEY_DIAGNOSTICS__);
  await page.screenshot({ path: 'artifacts/journey-desktop.png' });
  await page.waitForTimeout(1600);
  const second = await page.evaluate(() => (window as any).__JOURNEY_DIAGNOSTICS__);
  expect(second.streaks).toHaveLength(10);
  expect(second.streaks.some((streak: any) => streak.visible && streak.opacity > .3)).toBe(true);
  expect(second.streaks.map((streak: any) => streak.z)).not.toEqual(first.streaks.map((streak: any) => streak.z));
  expect(second.camera).not.toEqual(takeoffCamera);
  expect(second.player).not.toEqual(first.player);
  expect(second.pose.arms).not.toEqual(first.pose.arms);
  expect(second.pose.feet).not.toEqual(first.pose.feet);
  expect(second.pose.body).not.toEqual(first.pose.body);
  expect(first.pose.arms[0][1]).toBeGreaterThan(second.pose.arms[0][1]);
  expect(second.calls).toBeLessThan(150);
  expect(second.triangles).toBeLessThan(300000);
  console.log('Journey render:', JSON.stringify(second));
  await page.screenshot({ path: 'artifacts/journey-flight.png' });
  await expect.poll(() => page.evaluate(() => (window as any).__JOURNEY_FRAMES__.some((frame: any) => frame.passing > .75))).toBe(true);
  await page.screenshot({ path: 'artifacts/journey-cloud-pass.png' });
  await expect.poll(() => page.evaluate(() => (window as any).__JOURNEY_DIAGNOSTICS__?.elapsed)).toBeGreaterThan(6);
  const far = await page.evaluate(() => (window as any).__JOURNEY_DIAGNOSTICS__);
  expect(far.distance).toBeGreaterThan(first.distance * 3);
  expect(first.player[0]).toBeLessThan(0);
  expect(second.player[0]).toBeGreaterThan(first.player[0]);
  await page.screenshot({ path: 'artifacts/journey-far.png' });
  await expect(ride).toHaveAttribute('data-phase', 'arriving');
  await expect.poll(() => page.evaluate(() => (window as any).__JOURNEY_DIAGNOSTICS__?.elapsed)).toBeGreaterThan(7);
  const endHeading = await page.evaluate(() => (window as any).__JOURNEY_DIAGNOSTICS__.pose.heading);
  expect(Math.abs(endHeading)).toBeLessThan(.3);
  const frames = await page.evaluate(() => (window as any).__JOURNEY_FRAMES__ as { time: number; heading: number; twist: number; charge: number; height: number; passing: number; wind: number }[]);
  expect(frames.length).toBeGreaterThan(30);
  const chargeFrame = frames.find(frame => frame.charge > .9)!;
  expect(chargeFrame).toBeDefined();
  expect(chargeFrame.height).toBeLessThan(.8);
  expect(frames.some(frame => frame.time > 4 && frame.height > 1.05)).toBe(true);
  expect(frames.some(frame => frame.passing > .7)).toBe(true);
  const loudest = Math.max(...frames.map(frame => frame.wind));
  expect(loudest).toBeGreaterThan(chargeFrame.wind * 2);
  expect(frames.at(-1)!.wind).toBeLessThan(loudest * .5);
  expect(frames.some(frame => Math.abs(frame.twist) > .04)).toBe(true);
  for (let i = 1; i < frames.length; i++) {
    const speed = Math.abs(frames[i].heading - frames[i - 1].heading) / (frames[i].time - frames[i - 1].time);
    expect(speed).toBeLessThan(2.45);
  }
  await expect.poll(() => page.evaluate(() => (window as any).__JOURNEY_DIAGNOSTICS__?.revealed)).toBe(true);
  await expect(ride.locator('canvas')).toBeHidden();
  await expect(page.locator('#game')).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'artifacts/journey-arrival.png' });
  await expect(ride).toHaveCount(0);
  await expect(page.locator('#primary')).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile ride can be skipped without starting gameplay; reduced motion bypasses the ride', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?level=1');
  await expect(page.locator('.cloud-journey')).toHaveAttribute('data-phase', 'flying');
  await page.screenshot({ path: 'artifacts/journey-mobile.png' });
  await page.getByRole('button', { name: '跳过动画' }).click();
  await expect(page.locator('.cloud-journey')).toHaveCount(0);
  await expect(page.locator('#game-ui')).toHaveAttribute('data-state', 'ready');
  await page.locator('#primary').click();
  await expect(page.locator('#game-ui')).toHaveAttribute('data-state', /countdown|racing/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?level=1&test=1');
  await expect(page.locator('.cloud-journey')).toHaveCount(0);
  await expect(page.locator('#primary')).toBeVisible();
  await page.goto('/?test=1');
  await expect(page.locator('.cloud-journey')).toHaveCount(0);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await expect(page.locator('#settings-dialog')).toBeVisible();
});

test('skipping waits for destination loading and boot failures remove the ride', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/src/race.ts*', async route => { await gate; await route.continue(); });
  await page.goto('/?level=1&test=1');
  await page.getByRole('button', { name: '跳过动画' }).click();
  await expect(page.locator('.cloud-journey')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('正在准备');
  release();
  await expect(page.locator('.cloud-journey')).toHaveCount(0);
  await page.unroute('**/src/race.ts*');
  await page.route('**/src/race.ts*', route => route.abort());
  await page.reload();
  await expect(page.getByText('暂时无法打开游戏，请刷新再试一次。')).toBeVisible();
  await expect(page.locator('.cloud-journey')).toHaveCount(0);
});





test('pending animation module shows a full cloud cover without the old loading pill', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/src/journey.ts*', async route => { await gate; await route.continue(); });
  await page.goto('/?level=1&test=1');
  const loading = page.locator('.game-loading');
  await expect(loading).toBeVisible();
  await expect(loading).toHaveText('');
  await expect(loading).toHaveCSS('border-radius', '0px');
  expect(await loading.boundingBox()).toEqual({ x: 0, y: 0, ...page.viewportSize()! });
  await page.screenshot({ path: 'artifacts/journey-before-animation.png' });
  release();
  await expect(page.locator('.cloud-journey')).toBeVisible();
  await page.getByRole('button', { name: '跳过动画' }).click();
  await expect(page.locator('.game-loading')).toHaveCount(0);
});
