import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { createBrain, steerAI, type AIRunner } from '../src/ai';

const outputs = resolve(process.cwd(), 'test-results/outputs');
const snapshot = (page: Page) => page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.snapshot());
const diagnostics = (page: Page) => page.evaluate(() => (window as any).__THREE_GAME_DIAGNOSTICS__);
async function ready(page: Page) {
  await page.goto('/?test=1');
  await expect(page.locator('#primary')).toContainText('开始玩');
  await page.waitForFunction(() => !!(window as any).__THREE_GAME_TEST_HOOKS__);
  await page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.setPausedForScreenshot(true));
}
async function advance(page: Page, seconds: number) {
  await page.evaluate(seconds => (window as any).__THREE_GAME_TEST_HOOKS__.advance(seconds), seconds);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
async function racing(page: Page) {
  await page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.setState('racing'));
  await advance(page, .15);
}

test('balloons float gently and stop for reduced motion', async ({ page }) => {
  await ready(page);
  const balloons = () => page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.balloons());
  const initial = await balloons();
  expect(initial).toHaveLength(4);
  await page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.setPausedForScreenshot(false));
  await page.waitForTimeout(900);
  const floating = await balloons();
  expect(floating.some((b: any, i: number) => Math.abs(b.y - initial[i].y) > .1)).toBe(true);
  await page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.setReducedMotion(true));
  await expect.poll(balloons).toEqual([
    { y: 15, roll: 0 }, { y: 19, roll: 0 }, { y: 22, roll: 0 }, { y: 5, roll: 0 }
  ]);
});

test('desktop: real inputs, checkpoints, pause, result and clean restart', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await ready(page);
  const initial = await diagnostics(page);
  await mkdir(outputs, { recursive: true });
  await page.screenshot({ path: resolve(outputs, 'gummy-ready.png') });
  await expect(page.locator('#fullscreen svg')).toHaveAttribute('data-icon', 'maximize');
  expect(initial.people).toHaveLength(12);
  expect(Math.abs(initial.people[0].position.x)).toBeCloseTo(.85);
  expect(initial.people[0].position.z).toBe(0);
  expect([...new Set(initial.people.map((p: any) => p.position.z))].map(z => initial.people.filter((p: any) => p.position.z === z).length)).toEqual([4, 4, 4]);
  expect(initial.models).toEqual({ pendulumFrames: 2, finishArch: true });
  const bumperX = initial.hazards.find((h: any) => h.kind === 'bumper').renderPosition.x;
  const spinnerY = initial.hazards.find((h: any) => h.kind === 'spinner').renderRotation.y;
  await page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.setPausedForScreenshot(false));
  await expect.poll(async () => Math.abs((await diagnostics(page)).hazards.find((h: any) => h.kind === 'bumper').renderPosition.x - bumperX)).toBeGreaterThan(.05);
  await expect.poll(async () => Math.abs((await diagnostics(page)).hazards.find((h: any) => h.kind === 'spinner').renderRotation.y - spinnerY)).toBeGreaterThan(.05);
  await page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.setPausedForScreenshot(true));
  await page.screenshot({ path: resolve(outputs, 'gummy-ready.png') });
  await page.getByRole('button', { name: '开始玩' }).click();
  expect((await snapshot(page)).state).toBe('countdown');
  await expect.poll(async () => (await diagnostics(page)).media.music.readyState).toBeGreaterThanOrEqual(2);
  await expect.poll(async () => (await diagnostics(page)).media.countdown.readyState).toBeGreaterThanOrEqual(2);
  expect((await diagnostics(page)).media.plays).toMatchObject({ countdown: 1, music: 1 });
  expect((await diagnostics(page)).media.music).toMatchObject({ paused: false, muted: false, loop: true });
  await advance(page, 3.2);
  expect((await snapshot(page)).state).toBe('racing');
  expect((await diagnostics(page)).media.plays.countdown).toBe(3);
  const start = (await diagnostics(page)).people[0].position;
  await page.keyboard.down('ArrowUp');
  await advance(page, 1);
  const moved = (await diagnostics(page)).people[0].position;
  expect(moved.z).toBeLessThan(start.z - 3);
  await page.keyboard.press('Space');
  await advance(page, .15);
  expect((await diagnostics(page)).people[0].position.y).toBeGreaterThan(moved.y + .5);
  await page.keyboard.press('Shift');
  const beforeDive = (await diagnostics(page)).people[0].position.z;
  await advance(page, .3);
  expect((await diagnostics(page)).people[0].position.z).toBeLessThan(beforeDive - 1.8);
  await page.keyboard.up('ArrowUp');
  await page.getByRole('button', { name: '暂停游戏' }).click();
  await expect(page.locator('#menu-title')).toHaveText('休息一下');
  await expect(page.locator('#pause svg')).toHaveAttribute('data-icon', 'play');
  expect((await snapshot(page)).paused).toBe(true);
  expect((await diagnostics(page)).media.music.paused).toBe(true);
  await page.getByRole('button', { name: '继续玩' }).click();
  expect((await snapshot(page)).paused).toBe(false);
  await expect.poll(async () => (await diagnostics(page)).media.music.paused).toBe(false);
  await page.getByRole('button', { name: '关闭声音' }).click();
  await expect(page.getByRole('button', { name: '打开声音' })).toBeVisible();
  await expect(page.locator('#sound svg')).toHaveAttribute('data-icon', 'volume-x');
  expect((await snapshot(page)).muted).toBe(true);
  expect((await diagnostics(page)).media.music.muted).toBe(true);
  await page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.teleport(0, 1, -54));
  await advance(page, .1);
  expect((await diagnostics(page)).people[0].checkpoint).toBe(53);
  await page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.teleport(0, -3, -58));
  await advance(page, 1.1);
  expect((await diagnostics(page)).people[0].position.z).toBeGreaterThan(-53);
  expect((await diagnostics(page)).people[0].position.y).toBeGreaterThan(0);
  await page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.teleport(0, 1, -35));
  await advance(page, .1);
  await mkdir(outputs, { recursive: true });
  await page.screenshot({ path: resolve(outputs, 'gummy-desktop.png') });
  const png = PNG.sync.read(await page.locator('#game').screenshot());
  const colors = new Set<string>();
  for (let i = 0; i < png.data.length; i += 160) colors.add(`${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`);
  expect(colors.size).toBeGreaterThan(40);
  await page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.teleport(0, 1, -124));
  await advance(page, .1);
  await page.screenshot({ path: resolve(outputs, 'gummy-finish.png') });
  await page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.teleport(0, 1, -149));
  await advance(page, .1);
  await expect(page.locator('#menu-title')).toHaveText('晋级啦！');
  await page.screenshot({ path: resolve(outputs, 'gummy-qualified.png') });
  const textAlignment = await page.locator('.menu-card').evaluate(card => {
    const center = card.getBoundingClientRect().left + card.getBoundingClientRect().width / 2;
    return ['#menu-eyebrow', '#menu-title', '#menu-description', '#primary', '#menu-footer'].map(selector => {
      const element = card.querySelector(selector)!;
      const text = document.createRange();
      selector === '#primary' ? text.selectNode(element.firstChild!) : text.selectNodeContents(element);
      const box = text.getBoundingClientRect();
      return Math.abs(center - (box.left + box.width / 2));
    });
  });
  expect(Math.max(...textAlignment)).toBeLessThan(2);
  expect((await snapshot(page)).state).toBe('qualified');
  expect((await diagnostics(page)).media.music.paused).toBe(true);
  expect((await diagnostics(page)).media.plays.finish).toBe(1);
  await page.getByRole('button', { name: '再玩一次' }).click();
  await advance(page, .1);
  const reset = await diagnostics(page);
  expect(reset.physics).toEqual(initial.physics);
  expect(reset.people.every((p: any) => p.finish === 0 && p.checkpoint === 0)).toBe(true);
  expect(errors).toEqual([]);
});

test('actual race rules: eighth place qualifies, eight AI eliminate, and 90-second timeout', async ({ page }) => {
  await ready(page);
  await expect(page.locator('#menu-tips')).toContainText('前 8 名晋级');
  await racing(page);
  // Let every racer finish reacting to the starting signal before testing the finish line.
  await advance(page, 1);
  await page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.finishAI(7));
  await advance(page, .1);
  expect((await snapshot(page)).state).toBe('racing');
  expect((await snapshot(page)).finished).toBe(7);
  await page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.teleport(0, 1, -149));
  await advance(page, .1);
  expect((await snapshot(page)).state).toBe('qualified');
  expect((await snapshot(page)).rank).toBe(8);
  await expect(page.locator('#finished')).toHaveText('8 / 8');
  await racing(page);
  await advance(page, 1);
  await page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.finishAI(8));
  await advance(page, .1);
  expect((await snapshot(page)).state).toBe('eliminated');
  const groundedY = (await diagnostics(page)).people[1].renderPosition.y;
  await page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.setPausedForScreenshot(false));
  await expect.poll(async () => Math.abs((await diagnostics(page)).people[1].renderPosition.y - groundedY)).toBeGreaterThan(.15);
  await page.evaluate(() => { (window as any).__THREE_GAME_TEST_HOOKS__.teleport(0, 1, -140); document.querySelector<HTMLElement>('#menu')!.hidden = true; });
  await page.waitForTimeout(700);
  await page.screenshot({ path: resolve(outputs, 'gummy-cheer.png') });
  await page.evaluate(() => document.querySelector<HTMLElement>('#menu')!.hidden = false);
  await expect(page.locator('#primary')).toContainText('再玩一次');
  await racing(page);
  await page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.setTime(89.95));
  await advance(page, .1);
  expect((await snapshot(page)).state).toBe('timeout');
  await expect(page.locator('#menu-description')).toContainText('没关系');
});

test('AI steering predicts hazards deterministically and respects movement limits', () => {
  const c: AIRunner = { id: 1, x: 0, y: 1, z: -10, vx: 0, vz: -3.8, speed: 3.8, lane: 0, jumpCD: 0, diveCD: 0, stuck: 0 };
  const hazards = [-4, 0, 4].map(x => ({ kind: 'bumper', x, z: -13, phase: 0 }));
  const a = createBrain(1), b = createBrain(1);
  expect(new Set([createBrain(1).style, createBrain(2).style, createBrain(3).style]).size).toBe(3);
  a.think = b.think = 0;
  const intent = steerAI(c, [c], hazards, a, 1, 1 / 60);
  expect(intent).toEqual(steerAI(c, [c], hazards, b, 1, 1 / 60));
  expect(Math.abs(a.targetX)).toBeGreaterThan(1.4);
  expect(Math.hypot(intent.x, intent.z)).toBeLessThanOrEqual(1.00001);
  c.x = 7;
  expect(steerAI(c, [c], [], a, 2, 1 / 60).x).toBeLessThan(0);
  c.x = 0; c.z = -81.7; a.think = 0;
  expect(steerAI(c, [c], [], a, 0, 1 / 60).jump).toBe(true);
  expect(a.mode).toBe('gap');
  c.z = -59.8; a.think = 0;
  expect(steerAI(c, [c], [{ kind: 'spinner', x: -1.3, z: -62, phase: 0, rate: .8 }], a, 0, 1 / 60).jump).toBe(true);
  c.jumpCD = .4;
  expect(steerAI(c, [c], [{ kind: 'spinner', x: -1.3, z: -62, phase: 0, rate: .8 }], a, 0, 1 / 60).jump).toBe(false);
});

test('all 11 AI traverse the full course using real simulation', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await ready(page);
  await racing(page);
  await page.evaluate(() => {
    const hooks = (window as any).__THREE_GAME_TEST_HOOKS__;
    hooks.seed(20260918);
    hooks.auto();
  });
  await advance(page, 2.5);
  await page.screenshot({ path: resolve(outputs, 'gummy-ai-race.png') });
  const samples: { time: number; people: any[] }[] = [];
  for (let time = 5; time <= 95; time += 5) {
    await advance(page, time === 5 ? 2.5 : 5);
    samples.push({ time, people: (await diagnostics(page)).people.filter((p: any) => p.id > 0) });
  }
  const people = (await diagnostics(page)).people;
  const modes = new Set(samples.flatMap(s => s.people.map(p => p.brain.mode)));
  const styles = new Set(people.filter((p: any) => p.id > 0).map((p: any) => p.brain.style));
  const metrics = people.filter((p: any) => p.id > 0).map((p: any) => {
    const positions = samples.map(s => s.people.find(r => r.id === p.id).position.x);
    return { id: p.id, speed: p.speed, progress: -p.position.z, checkpoint: p.checkpoint, finish: p.finish, resets: p.resets, decisions: p.brain.decisions,
      lateralRange: Math.max(...positions) - Math.min(...positions),
      finishBy: samples.find(s => s.people.find(r => r.id === p.id).finish > 0)?.time };
  });
  const final = await diagnostics(page);
  const report = JSON.stringify({ seed: 20260918, simulatedSeconds: 95, modes: [...modes], metrics, samples,
    renderer: final.renderer, physics: final.physics, fps: final.fps,
    performanceNote: 'Accelerated simulation with frozen render; FPS is not a real-device performance measurement.' }, null, 2);
  await testInfo.attach('ai-course-metrics', { body: report, contentType: 'application/json' });
  await mkdir(outputs, { recursive: true });
  await writeFile(resolve(outputs, 'skyway-metrics.json'), report);
  console.log('AI course metrics:', JSON.stringify({ modes: [...modes], metrics }));
  expect(styles).toEqual(new Set(['brave', 'careful', 'playful']));
  expect(modes.has('gap')).toBe(true);
  expect(modes.has('time-jump')).toBe(true);
  expect(people.filter((p: any) => p.id > 0 && p.finish > 0)).toHaveLength(11);
  expect(people.every((p: any) => p.checkpoint === 121)).toBe(true);
  expect(new Set(people.map((p: any) => p.finish)).size).toBe(12);
  expect(metrics.every((p: any) => p.speed >= 5.6 && p.speed < 7.2)).toBe(true);
  expect(metrics.every((p: any) => p.resets <= 3)).toBe(true);
  expect(metrics.filter((p: any) => p.lateralRange > 3)).toHaveLength(11);
  expect(metrics.every((p: any) => p.decisions > 30)).toBe(true);
  expect(people.filter((p: any) => p.id > 0).some((p: any) => p.brain.jumps > 0)).toBe(true);
  expect(people.filter((p: any) => p.id > 0).some((p: any) => p.brain.dives > 0)).toBe(true);
  expect(errors).toEqual([]);
});

test('real keyboard turns accelerate and rotate smoothly instead of snapping', async ({ page }) => {
  await ready(page);
  await racing(page);
  await page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.teleport(0, 1, -4));
  await page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.setPausedForScreenshot(false));
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await diagnostics(page)).people[0].velocity.x).toBeGreaterThan(3);
  const before = (await diagnostics(page)).people[0];
  expect(before.rotation).toBeLessThan(-.7);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(100);
  const turning = (await diagnostics(page)).people[0];
  expect(Math.abs(turning.heading)).toBe(0);
  expect(turning.rotation).toBeGreaterThan(before.rotation);
  expect(turning.rotation).toBeLessThan(-.01);
  expect(turning.velocity.z).toBeLessThan(0);
  await page.keyboard.up('KeyW');
  await expect.poll(async () => Math.abs((await diagnostics(page)).people[0].rotation)).toBeLessThan(.02);
});

test('the moving yellow bumpers push racers away', async ({ page }) => {
  await ready(page);
  await racing(page);
  const bumper = (await diagnostics(page)).hazards.find((h: any) => h.kind === 'bumper').position;
  await page.evaluate(({ x, z }) => (window as any).__THREE_GAME_TEST_HOOKS__.teleport(x, 1, z + 1.25), bumper);
  await page.keyboard.down('ArrowUp');
  await advance(page, 1 / 60);
  const player = (await diagnostics(page)).people[0];
  expect(player.velocity.z).toBeGreaterThan(10);
  expect(player.velocity.y).toBeGreaterThan(4.7);
  await advance(page, .4);
  const after = (await diagnostics(page)).people[0].position;
  expect(Math.hypot(after.x - bumper.x, after.z - bumper.z)).toBeGreaterThan(3.5);
  await page.keyboard.up('ArrowUp');
});

test('mobile: fit, touch jump, joystick cancellation and orientation', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { speechSynthesis.getVoices = () => []; });
  await ready(page);
  await racing(page);
  await expect(page.locator('#section')).toHaveCount(0);
  await expect(page.locator('.course-progress')).toHaveCount(0);
  await expect(page.locator('#cue')).toHaveText('跟着箭头走！');
  const guidanceBox = await page.locator('#guidance').boundingBox();
  expect(guidanceBox!.height).toBeGreaterThanOrEqual(50);
  expect((await diagnostics(page)).speech.chinese).toBe(false);
  for (const id of ['jump', 'dive', 'sound', 'pause']) {
    const box = await page.locator(`#${id}`).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(64);
    expect(box!.height).toBeGreaterThanOrEqual(64);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
  await page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.teleport(0, 1, -8));
  await advance(page, .4);
  const ground = (await diagnostics(page)).people[0].position.y;
  await page.locator('#jump').tap();
  await advance(page, .15);
  expect((await diagnostics(page)).people[0].position.y).toBeGreaterThan(ground + .4);
  const stick = (await page.locator('#stick').boundingBox())!;
  await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2);
  await page.mouse.down();
  await page.mouse.move(stick.x + stick.width / 2, stick.y + 8);
  await advance(page, .8);
  const moved = (await diagnostics(page)).people[0].position.z;
  expect(moved).toBeLessThan(-2);
  await page.locator('#dive').tap();
  await advance(page, .3);
  expect((await diagnostics(page)).people[0].position.z).toBeLessThan(moved - 1.8);
  await page.locator('#stick').dispatchEvent('pointercancel', { pointerId: 1 });
  await page.mouse.up();
  await advance(page, .6);
  const stopped = (await diagnostics(page)).people[0].position.z;
  await advance(page, .4);
  expect(Math.abs((await diagnostics(page)).people[0].position.z - stopped)).toBeLessThan(.6);
  await expect(page.locator('#stick-knob')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.teleport(0, 1, -22));
  await advance(page, .1);
  await mkdir(outputs, { recursive: true });
  await page.screenshot({ path: resolve(outputs, 'gummy-mobile.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole('button', { name: '暂停游戏' }).click();
  await expect(page.getByRole('button', { name: '继续玩' })).toBeInViewport();
  await expect(page.getByRole('button', { name: '重新开始' })).toBeInViewport();
  expect(errors).toEqual([]);
  await context.close();
});
