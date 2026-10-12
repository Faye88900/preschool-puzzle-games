import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const shot = (page: Page) => page.evaluate(() => (window as any).__PUZZLE_TEST__.hintCamera());
const snapshot = (page: Page) => page.evaluate(() => (window as any).__PUZZLE_TEST__.snapshot());
const warp = (page: Page, x: number, z: number) => page.evaluate(([x, z]) => (window as any).__PUZZLE_TEST__.warp(x, z), [x, z]);
const inFrame = (point: number[]) => { expect(Math.abs(point[0])).toBeLessThan(.88); expect(Math.abs(point[1])).toBeLessThan(.88); expect(point[2]).toBeLessThan(1); };
async function start(page: Page, reduced = false) {
  await page.addInitScript(() => { speechSynthesis.speak = () => {}; });
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?level=2&test=1');
  if (!reduced) await page.getByRole('button', { name: '跳过动画' }).click();
  await page.locator('#primary').click();
  await mkdir('artifacts/pond-camera', { recursive: true });
}

for (const mobile of [false, true]) {
  test.describe(mobile ? 'touch pond camera' : 'desktop pond camera', () => {
    test.use({ hasTouch: mobile });
    test('water-level tracking, broken joint, overhead and flower; pause, replay and cancel', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      await start(page);
      await warp(page, 23, -9);
      await page.keyboard.down('KeyW');
      await expect.poll(async () => (await snapshot(page)).position.z).toBeLessThan(-12);
      expect((await shot(page)).elapsed).toBeNull();
      await page.keyboard.up('KeyW');
      for (const [time, name] of [[1.9, 'tracking'], [4.35, 'stop'], [6.95, 'overhead'], [9.05, 'flower']] as const) {
        await expect.poll(async () => (await shot(page)).elapsed ?? 0, { intervals: [30] }).toBeGreaterThan(time);
        await page.keyboard.press('Escape');
        const frozen = await snapshot(page), current = await shot(page);
        expect(current.pond).toBe(true);
        expect(current.blocked).toBe(0);
        if (name === 'stop') expect(frozen.camera.position[1]).toBeLessThan(3);
        if (name === 'overhead') current.pipes.forEach(inFrame);
        if (name === 'flower') inFrame(current.flower);
        await page.keyboard.press('Escape');
        await page.screenshot({ path: `artifacts/pond-camera/${mobile ? 'portrait' : 'desktop'}-${name}.png` });
      }
      await page.keyboard.press('Escape');
      const frozen = await snapshot(page), elapsed = (await shot(page)).elapsed;
      await page.waitForTimeout(250);
      expect((await snapshot(page)).camera).toEqual(frozen.camera);
      expect((await shot(page)).elapsed).toBe(elapsed);
      await page.keyboard.press('Escape');
      await expect.poll(async () => (await shot(page)).elapsed).toBeNull();
      await expect.poll(() => page.evaluate(() => (window as any).__PUZZLE_TEST__.audio().water)).toBeLessThan(.01);
      expect(await page.evaluate(() => (window as any).__PUZZLE_TEST__.audio().plays.water)).toBe(1);
      inFrame((await snapshot(page)).camera.playerNdc);
      await warp(page, 0, -10); await page.waitForTimeout(100);
      await warp(page, 23, -12); await page.waitForTimeout(200);
      expect((await shot(page)).elapsed).toBeNull();
      if (mobile) await page.locator('#hint').tap(); else await page.keyboard.press('KeyH');
      expect((await shot(page)).pond).toBe(true);
      if (mobile) await page.locator('#jump').tap(); else await page.keyboard.down('KeyD');
      await expect.poll(async () => (await shot(page)).returning).toBe(true);
      if (!mobile) await page.keyboard.up('KeyD');
      await expect.poll(async () => (await shot(page)).elapsed).toBeNull();
      expect(errors).toEqual([]);
    });
  });
}

test('replays follow the current flow; interaction, resize and restart return control', async ({ page }) => {
  await start(page);
  await warp(page, 22, -13.9);
  await expect.poll(async () => (await shot(page)).pond).toBe(true);
  for (let i = 0; i < 3; i++) { await page.keyboard.press('KeyE'); await page.waitForTimeout(150); }
  expect((await shot(page)).returning).toBe(true);
  await expect.poll(async () => (await shot(page)).elapsed).toBeNull();
  await page.keyboard.press('KeyH');
  expect((await shot(page)).blocked).toBe(1);
  await expect.poll(async () => (await shot(page)).elapsed ?? 0, { intervals: [30] }).toBeGreaterThan(4.3);
  expect((await snapshot(page)).camera.look[2]).toBeCloseTo(-19, 1);
  await page.screenshot({ path: 'artifacts/pond-camera/desktop-second-stop.png' });
  await page.setViewportSize({ width: 1100, height: 800 });
  await expect.poll(async () => (await shot(page)).returning).toBe(true);
  await expect.poll(async () => (await shot(page)).elapsed).toBeNull();
  await warp(page, 22, -24.1);
  await page.keyboard.press('KeyE'); await page.waitForTimeout(150); await page.keyboard.press('KeyE');
  await page.waitForTimeout(650);
  await page.keyboard.press('KeyH');
  expect((await shot(page)).blocked).toBe(2);
  await expect.poll(async () => (await shot(page)).elapsed ?? 0, { intervals: [30] }).toBeGreaterThan(4.3);
  expect((await snapshot(page)).camera.look[0]).toBeCloseTo(24, 1);
  await page.screenshot({ path: 'artifacts/pond-camera/desktop-third-stop.png' });
  await warp(page, 29.1, -21); await page.keyboard.press('KeyE');
  await expect.poll(async () => (await shot(page)).elapsed).toBeNull();
  await expect.poll(async () => (await snapshot(page)).pipesSolved).toBe(true);
  await page.keyboard.press('KeyH');
  expect((await shot(page)).blocked).toBe(-1);
  await expect(page.locator('#cue')).toHaveText('小花开了，跳上去看看吧！');
  await expect.poll(async () => (await shot(page)).elapsed ?? 0).toBeGreaterThan(1.4);
  inFrame((await shot(page)).flower);
  await page.keyboard.press('Escape'); await page.locator('#restart').click();
  expect((await shot(page)).pondSeen).toBe(false);
  expect((await shot(page)).elapsed).toBeNull();
});

test('reduced motion keeps the water hint readable without a camera tour', async ({ page }) => {
  await start(page, true);
  await warp(page, 23, -12);
  await page.keyboard.press('KeyH');
  await expect(page.locator('#cue')).toHaveText('沿着水流看一看，水停在哪一段水管前？');
  expect((await shot(page)).elapsed).toBeNull();
  inFrame((await snapshot(page)).camera.playerNdc);
});

test('camera follows connected bends continuously without join stalls or fast fly-ins', async ({ page }) => {
  await start(page);
  await warp(page, 22, -13.9);
  for (let i = 0; i < 3; i++) { await page.keyboard.press('KeyE'); await page.waitForTimeout(150); }
  await warp(page, 22, -24.1);
  for (let i = 0; i < 2; i++) { await page.keyboard.press('KeyE'); await page.waitForTimeout(150); }
  await expect.poll(async () => (await shot(page)).elapsed).toBeNull();
  await page.keyboard.press('KeyH');
  const frames = await page.evaluate(() => new Promise<{ now: number; t: number | null; returning: boolean; position: number[] }[]>(resolve => {
    const samples: { now: number; t: number | null; returning: boolean; position: number[] }[] = [];
    const api = (window as any).__PUZZLE_TEST__, start = performance.now();
    function sample(now: number) {
      const shot = api.hintCamera();
      samples.push({ now, t: shot.elapsed, returning: shot.returning, position: api.snapshot().camera.position });
      if (now - start < 11500) requestAnimationFrame(sample); else resolve(samples);
    }
    requestAnimationFrame(sample);
  }));
  await writeFile('artifacts/pond-camera/smoothness-after.json', JSON.stringify(frames));
  const motion = frames.slice(1).map((f, i) => ({ t: f.t, returning: f.returning,
    speed: Math.hypot(...f.position.map((v, k) => v - frames[i].position[k])) / ((f.now - frames[i].now) / 1000) }));
  const tracking = motion.filter(f => !f.returning && f.t! > 1.9 && f.t! < 3.9);
  expect(tracking.length).toBeGreaterThan(20);
  expect(Math.min(...tracking.map(f => f.speed))).toBeGreaterThan(.1);
  expect(Math.max(...motion.map(f => f.speed))).toBeLessThan(35);
  expect((await shot(page)).elapsed).toBeNull();
});
