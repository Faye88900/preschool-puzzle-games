import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';

const snapshot = (page: Page) => page.evaluate(() => (window as any).__PUZZLE_TEST__.snapshot());
const motion = (page: Page) => page.evaluate(() => (window as any).__PUZZLE_TEST__.motion());
const appearance = (page: Page) => page.evaluate(() => (window as any).__PUZZLE_TEST__.appearance());
const outputs = resolve('test-results/outputs');
const keySpots = [[-24, -31], [26, -25.5], [13, -57]];
const pipeSpots = [[22, -17], [22, -21], [26, -21]];
const pipeApproaches = [[22, -13.9], [22, -24.1], [29.1, -21]];
const audioState = (page: Page) => page.evaluate(() => (window as any).__PUZZLE_TEST__.audio());
const warp = async (page: Page, x: number, z: number) => {
  await page.evaluate(({ x, z }) => (window as any).__PUZZLE_TEST__.warp(x, z), { x, z });
  await page.waitForTimeout(80);
};
const action = async (page: Page) => { await page.keyboard.press('KeyE'); await page.waitForTimeout(80); };
// Blocks are solid, so reach one from the side rather than standing inside it.
const beside = (page: Page, x: number, z: number) => warp(page, x, z + 1.5);
async function jumpToFlower(page: Page) {
  await warp(page, 26, -29);
  await page.evaluate(async () => {
    const hooks = (window as any).__PUZZLE_TEST__;
    const trail: any[] = [];
    const key = (code: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
    const until = async (condition: () => boolean) => {
      const deadline = performance.now() + 8000;
      while (!condition()) {
        if (performance.now() > deadline) throw new Error(`Flower jump timed out: ${JSON.stringify({trail, position:hooks.snapshot().position})}`);
        await new Promise(requestAnimationFrame);
      }
    };
    key('KeyS', true); await until(() => hooks.snapshot().position.z > -27.5); key('KeyS', false);
    await until(() => Math.abs(hooks.motion().velocity.z) < .02);
    trail.push(['approach', hooks.snapshot().position]);
    for (const [z, height] of [[-26.5, 1.28], [-25.5, 2.55]]) {
      key('Space', true); key('Space', false);
      await until(() => hooks.motion().velocity.y > 3);
      trail.push(['jump', z, hooks.snapshot().position]);
      key('KeyS', true); await until(() => hooks.snapshot().position.z > z); key('KeyS', false);
      trail.push(['stop', z, hooks.snapshot().position]);
      await until(() => hooks.snapshot().position.y > height + .5 && Math.abs(hooks.motion().velocity.y) < .02);
      await until(() => Math.abs(hooks.motion().velocity.z) < .02);
    }
  });
}
async function start(page: Page) {
  await page.goto('/?level=2&test=1');
  await page.locator('#primary').click();
  await mkdir(outputs, { recursive: true });
}
async function solve(page: Page, index: number) {
  if (index === 0) {
    await beside(page, -29, -13); await action(page);
    await warp(page, -24, -16); await action(page);
  } else if (index === 1) {
    for (const i of [2, 0, 1]) {
      await warp(page, ...pipeApproaches[i] as [number, number]);
      for (let j = 0; j < [3, 2, 1][i]; j++) {
        await action(page); await page.waitForTimeout(400);
      }
    }
  } else {
    await warp(page, -4, -47); await action(page);
    for (const [x, z] of [[0, -50], [4, -51], [8, -53], [13, -54], [13, -58]]) {
      await warp(page, x, z);
      await expect.poll(async () => {
        const p = (await snapshot(page)).animal.position;
        return Math.hypot(p[0] - x, p[2] - z);
      }).toBeLessThan(1.25);
    }
    await action(page);
    await expect.poll(async () => (await snapshot(page)).animal.solved).toBe(true);
  }
  if (index === 1) await jumpToFlower(page);
  else await warp(page, ...keySpots[index] as [number, number]);
  await expect.poll(async () => (await snapshot(page)).collected[index]).toBe(true);
}

test('expressions follow running, jumping, solved tasks and keys, with paused celebration and clean restart', async ({ page }) => {
  await start(page);
  await expect.poll(async () => (await snapshot(page)).expression).toBe('neutral');
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await snapshot(page)).expression).toBe('determined');
  await page.keyboard.up('KeyW');
  await expect.poll(async () => (await snapshot(page)).expression).toBe('neutral');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).expression).toBe('surprised');
  await expect.poll(async () => (await snapshot(page)).expression).toBe('neutral');
  await beside(page, -29, -13); await action(page);
  await warp(page, -24, -16); await action(page);
  await expect.poll(async () => (await snapshot(page)).gateOpen).toBe(true);
  await expect.poll(async () => (await snapshot(page)).expression).toBe('happy');
  await expect.poll(async () => (await snapshot(page)).expression).toBe('neutral');
  await warp(page, ...keySpots[0] as [number, number]);
  await expect.poll(async () => (await snapshot(page)).collected[0]).toBe(true);
  await expect.poll(async () => (await snapshot(page)).expression).toBe('happy');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2800);
  expect((await snapshot(page)).expression).toBe('happy');
  await page.locator('#primary').click();
  expect((await snapshot(page)).expression).toBe('happy');
  await expect.poll(async () => (await snapshot(page)).expression).toBe('neutral');
  await page.keyboard.press('Escape');
  await page.locator('#restart').click();
  await expect.poll(async () => (await snapshot(page)).expression).toBe('neutral');
  expect((await snapshot(page)).collected).toEqual([false, false, false]);
});

test('local garden sounds follow puzzle events, loop once, and respect mute, pause and restart', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/Cannot .*puzzle (audio|music)|Cannot load puzzle sound/.test(message.text())) errors.push(message.text()); });
  page.on('response', response => { if (response.url().includes('/audio/puzzle/') && !response.ok()) errors.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(() => {
    (window as any).__SPOKEN__ = [];
    (window as any).__VOICE_ACTIVE__ = false;
    speechSynthesis.speak = utterance => { (window as any).__SPOKEN__.push(utterance.text); };
    Object.defineProperty(speechSynthesis, 'speaking', { get: () => (window as any).__VOICE_ACTIVE__ });
  });
  await start(page);
  expect((await audioState(page)).loaded).toHaveLength(21);
  await expect.poll(async () => (await audioState(page)).state).toBe('running');
  await expect.poll(async () => (await audioState(page)).music.time).toBeGreaterThan(0);
  expect((await audioState(page)).music).toMatchObject({ paused: false, loop: true, error: null });
  await page.keyboard.press('KeyH');
  expect((await audioState(page)).plays.hint).toBe(1);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await audioState(page)).plays.jump).toBe(1);
  await expect.poll(async () => (await audioState(page)).plays.land).toBeGreaterThan(0);
  await solve(page, 0);
  const workshop = await audioState(page);
  expect(workshop.plays.pickup).toBe(1); expect(workshop.plays.drop).toBe(1);
  expect(workshop.plays.switch).toBe(1); expect(workshop.plays.gate).toBe(1); expect(workshop.plays.key).toBe(1);
  await solve(page, 1);
  const pond = await audioState(page);
  expect(pond.plays.pipe).toBe(6); expect(pond.plays.bloom).toBe(1); expect(pond.plays.key).toBe(2);
  expect(pond.plays.water).toBe(1); expect(pond.active.filter((id: string) => id === 'water')).toHaveLength(1);
  expect(await page.evaluate(() => (window as any).__SPOKEN__.filter((text: string) => text === '流水池塘 · 水在这里停住了，小花好像有些口渴。').length)).toBe(1);
  await page.waitForTimeout(8000);
  expect((await audioState(page)).plays.water).toBe(1);
  await page.evaluate(() => { (window as any).__VOICE_ACTIVE__ = true; });
  await expect.poll(async () => (await audioState(page)).water).toBeLessThan(.3);
  expect((await audioState(page)).music.volume).toBe(.07);
  await page.evaluate(() => { (window as any).__VOICE_ACTIVE__ = false; });
  await expect.poll(async () => (await audioState(page)).water).toBeGreaterThan(.4);
  await page.locator('#sound').click();
  await expect.poll(async () => (await audioState(page)).master).toBe(0);
  expect((await audioState(page)).music.muted).toBe(true);
  const mutedPlays = (await audioState(page)).plays;
  await page.keyboard.press('Space'); await page.waitForTimeout(850);
  expect((await audioState(page)).plays).toEqual(mutedPlays);
  await page.locator('#sound').click();
  await expect.poll(async () => (await audioState(page)).master).toBe(1);
  expect((await audioState(page)).music.muted).toBe(false);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await audioState(page)).state).toBe('suspended');
  expect((await audioState(page)).music.paused).toBe(true);
  await page.locator('#primary').click();
  await expect.poll(async () => (await audioState(page)).state).toBe('running');
  await expect.poll(async () => (await audioState(page)).music.time).toBeGreaterThan(0);
  expect((await audioState(page)).music).toMatchObject({ paused: false, loop: true, error: null });
  expect((await audioState(page)).plays.water).toBe(1);
  await solve(page, 2);
  const animal = await audioState(page);
  expect(animal.plays.grain).toBe(2); expect(animal.plays.chick).toBeGreaterThanOrEqual(2);
  expect(animal.plays.key).toBe(3); expect(animal.plays.gate).toBe(2);
  await warp(page, 0, -73.5);
  await expect.poll(async () => (await audioState(page)).plays.win).toBe(1);
  await expect(page.locator('#menu-title')).toHaveText('大门打开啦！');
  expect((await audioState(page)).winDuration).toBeCloseTo(7, 2);
  expect((await audioState(page)).active).toContain('win');
  await page.waitForTimeout(2500);
  expect((await audioState(page)).active).toContain('win');
  expect((await audioState(page)).plays.win).toBe(1);
  expect((await audioState(page)).music).toMatchObject({ paused: true, time: 0 });
  expect((await audioState(page)).active).not.toContain('water');
  await page.locator('#primary').click();
  expect((await audioState(page)).active).not.toContain('win');
  expect((await audioState(page)).active).not.toContain('water');
  expect((await audioState(page)).water).toBe(0);
  // Restart also resets the one-time spoken pipe instruction.
  await warp(page, ...pipeApproaches[0] as [number, number]); await action(page);
  expect(await page.evaluate(() => (window as any).__SPOKEN__.filter((text: string) => text === '流水池塘 · 水在这里停住了，小花好像有些口渴。').length)).toBe(2);
  expect(errors).toEqual([]);
});

test('portrait garden touch controls unlock audio and mute new effects', async ({ browser, baseURL }) => {
  const page = await browser.newPage({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await start(page);
  await expect.poll(async () => (await audioState(page)).state).toBe('running');
  await expect.poll(async () => (await audioState(page)).music.time).toBeGreaterThan(0);
  expect((await audioState(page)).music).toMatchObject({ paused: false, loop: true, error: null });
  await beside(page, -29, -13); await page.locator('#dive').tap();
  expect((await audioState(page)).plays.pickup).toBe(1);
  await page.locator('#sound').tap();
  await page.locator('#dive').tap();
  await expect.poll(async () => (await audioState(page)).master).toBe(0);
  expect((await audioState(page)).music.muted).toBe(true);
  expect((await audioState(page)).plays.drop).toBeUndefined();
  await page.locator('#pause').tap();
  await expect.poll(async () => (await audioState(page)).state).toBe('suspended');
  expect((await audioState(page)).music.paused).toBe(true);
  await page.locator('#restart').tap();
  await expect.poll(async () => (await audioState(page)).state).toBe('running');
  await expect.poll(async () => (await audioState(page)).music.time).toBeGreaterThan(0);
  expect((await audioState(page)).music).toMatchObject({ paused: false, loop: true, error: null });
  await expect.poll(async () => (await audioState(page)).master).toBe(0);
  expect((await audioState(page)).music.muted).toBe(true);
  await page.locator('#sound').tap();
  await beside(page, -29, -13); await page.locator('#dive').tap();
  expect((await audioState(page)).plays.pickup).toBe(2);
  await page.close();
});

test('footsteps follow ground movement and water cues follow newly wetted pipe segments', async ({ page }) => {
  await page.addInitScript(() => { speechSynthesis.speak = () => {}; });
  await start(page);
  const steps = async (surface: 'Stone' | 'Grass') => {
    const plays = (await audioState(page)).plays;
    return [0, 1, 2].reduce((sum, i) => sum + (plays[`step${surface}${i}`] ?? 0), 0);
  };
  await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await page.keyboard.up('KeyW');
  expect(await steps('Stone')).toBeGreaterThan(2); expect(await steps('Grass')).toBe(0);
  await page.waitForTimeout(400);
  const stopped = await steps('Stone');
  await page.waitForTimeout(500); expect(await steps('Stone')).toBe(stopped);
  await warp(page, 6, -16);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await page.keyboard.up('KeyW');
  expect(await steps('Grass')).toBeGreaterThan(2);
  await page.waitForTimeout(400);
  await page.keyboard.down('KeyW'); await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).position.y).toBeGreaterThan(1.5);
  const airborne = await steps('Grass');
  await page.waitForTimeout(200); expect(await steps('Grass')).toBe(airborne);
  await page.keyboard.up('KeyW'); await page.waitForTimeout(600);
  await page.locator('#sound').click();
  const muted = (await audioState(page)).plays;
  await page.keyboard.down('KeyW'); await page.waitForTimeout(750); await page.keyboard.up('KeyW');
  expect((await audioState(page)).plays).toEqual(muted);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await audioState(page)).state).toBe('suspended');
  expect((await audioState(page)).music.paused).toBe(true);
  await page.locator('#restart').click(); await page.locator('#sound').click();
  await expect.poll(async () => (await audioState(page)).state).toBe('running');
  await expect.poll(async () => (await audioState(page)).music.time).toBeGreaterThan(0);
  expect((await audioState(page)).music).toMatchObject({ paused: false, loop: true, error: null });
  // A correct downstream elbow is dry until the upstream elbows connect.
  await warp(page, ...pipeApproaches[2] as [number, number]); await action(page); await page.waitForTimeout(400);
  expect((await audioState(page)).plays.flow).toBeUndefined();
  await warp(page, ...pipeApproaches[0] as [number, number]);
  for (let i = 0; i < 3; i++) { await action(page); await page.waitForTimeout(400); }
  await expect.poll(async () => (await audioState(page)).flowReached).toBe(1);
  expect((await audioState(page)).plays.flow).toBe(1);
  // Disconnecting and reconnecting the same segment earns no repeated cue.
  for (let i = 0; i < 4; i++) { await action(page); await page.waitForTimeout(400); }
  expect((await audioState(page)).plays.flow).toBe(1);
  await warp(page, ...pipeApproaches[1] as [number, number]);
  for (let i = 0; i < 2; i++) { await action(page); await page.waitForTimeout(400); }
  await expect.poll(async () => (await audioState(page)).flowReached).toBe(3);
  expect((await audioState(page)).plays.flow).toBe(2);
  await page.waitForTimeout(600); expect((await audioState(page)).plays.flow).toBe(2);
  await page.keyboard.press('Escape'); await page.locator('#restart').click();
  expect((await audioState(page)).flowReached).toBe(0);
  await warp(page, ...pipeApproaches[0] as [number, number]);
  for (let i = 0; i < 3; i++) { await action(page); await page.waitForTimeout(400); }
  await expect.poll(async () => (await audioState(page)).plays.flow).toBe(3);
});

test('round pipe bases block walking and remain reachable from the rim', async ({ page }) => {
  await start(page);
  for (const [i, x, z, key, axis, sign] of [[0, 26, -17, 'KeyA', 'x', 1], [1, 22, -25, 'KeyS', 'z', -1], [2, 26, -17, 'KeyW', 'z', 1]] as const) {
    await warp(page, x, z);
    await page.keyboard.down(key); await page.waitForTimeout(1000); await page.keyboard.up(key);
    const p = (await snapshot(page)).position, center = pipeSpots[i][axis === 'x' ? 0 : 1];
    expect((p[axis] - center) * sign).toBeGreaterThan(2.1);
    expect((p[axis] - center) * sign).toBeLessThan(2.9);
    await warp(page, ...pipeApproaches[i] as [number, number]);
    const before = (await snapshot(page)).pipeTurns[i];
    await action(page); expect((await snapshot(page)).pipeTurns[i]).toBe((before + 1) % 4);
  }
});

test('pipes allow passage and close rotation without pushing the player', async ({ page }) => {
  await start(page);
  // Stand where the rotating elbow overlaps the player, outside the solid base.
  await warp(page, 24.5, -17);
  const before = (await snapshot(page)).position;
  for (const turn of [2, 3, 0, 1]) {
    await action(page);
    expect((await snapshot(page)).pipeTurns[0]).toBe(turn);
    await expect.poll(async () => {
      const angle = await page.evaluate(() => (window as any).__PUZZLE_TEST__.pond().angles[0]);
      return Math.abs(Math.atan2(Math.sin(angle - turn * Math.PI / 2), Math.cos(angle - turn * Math.PI / 2)));
    }).toBeLessThan(.01);
    const p = (await snapshot(page)).position;
    expect(Math.hypot(p.x - before.x, p.z - before.z)).toBeLessThan(.05);
    expect(p.y).toBeLessThan(.85);
    await expect(page.locator('#cue')).not.toContainText('退后');
  }
  // The fixed inlet and outlet tubes are also passable.
  for (const [x, z, key, axis, boundary] of [[19.5, -14.5, 'KeyW', 'z', -17.6], [29, -23.7, 'KeyA', 'x', 25.2]] as const) {
    await warp(page, x, z);
    await page.keyboard.down(key); await page.waitForTimeout(800); await page.keyboard.up(key);
    expect((await snapshot(page)).position[axis]).toBeLessThan(boundary);
  }
});

test('pond flow follows connected pipes, blooms, pauses and resets', async ({ page }) => {
  await start(page);
  const pond = () => page.evaluate(() => (window as any).__PUZZLE_TEST__.pond());
  expect((await pond()).wet).toEqual([false, false, false]);
  await warp(page, ...pipeApproaches[0] as [number, number]);
  for (let i = 0; i < 3; i++) await action(page);
  await expect.poll(async () => (await pond()).wet).toEqual([true, false, false]);
  await warp(page, ...pipeApproaches[2] as [number, number]); await action(page);
  expect((await pond()).watering).toBe(false);
  await warp(page, ...pipeApproaches[1] as [number, number]); await action(page); await action(page);
  await expect.poll(async () => (await pond()).wet).toEqual([true, true, true]);
  await expect.poll(async () => (await pond()).bloom).toBeGreaterThan(1.5);
  expect((await pond()).watering).toBe(true);
  await warp(page, 23, -12);
  await page.screenshot({ path: resolve(outputs, 'pond-flow-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await warp(page, 24, -17);
  await page.screenshot({ path: resolve(outputs, 'pond-flow-mobile.png') });
  const moving = (await pond()).drops;
  await page.waitForTimeout(200); expect((await pond()).drops).not.toEqual(moving);
  await page.keyboard.press('Escape');
  const paused = await pond(); await page.waitForTimeout(200); expect(await pond()).toEqual(paused);
  await page.locator('#restart').click();
  expect((await pond()).wet).toEqual([false, false, false]);
  expect((await pond()).watering).toBe(false); expect((await pond()).bloom).toBe(.72);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload(); await page.locator('#primary').click(); await solve(page, 1);
  const still = (await pond()).drops;
  await page.waitForTimeout(200); expect((await pond()).drops).toEqual(still);
});

test('blue key sits above the flower and requires a jump', async ({ page }) => {
  await start(page);
  for (const i of [2, 0, 1]) for (let j = 0; j < [3, 2, 1][i]; j++) {
    await warp(page, ...pipeApproaches[i] as [number, number]); await action(page);
  }
  await page.waitForTimeout(1800);
  const pond = await page.evaluate(() => (window as any).__PUZZLE_TEST__.pond());
  expect(pond.key[0]).toBe(26); expect(pond.key[2]).toBe(-25.5);
  expect(pond.key[1]).toBeGreaterThan(pond.flowerTop + 1);
  await warp(page, 26, -27); await page.waitForTimeout(300);
  expect((await snapshot(page)).collected[1]).toBe(false);
  await page.screenshot({ path: resolve(outputs, 'flower-key-above.png') });
  await jumpToFlower(page);
  expect((await snapshot(page)).collected[1]).toBe(true);
  await page.screenshot({ path: resolve(outputs, 'flower-key-jump.png') });
});

test('garden movement: alternating steps, smooth turn, stop, pause and carried pose', async ({ page }) => {
  await start(page);
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await motion(page)).velocity.x).toBeGreaterThan(3);
  await expect.poll(async () => Math.abs((await motion(page)).feet[0])).toBeGreaterThan(.1);
  const walking = await motion(page);
  expect(walking.feet[0] * walking.feet[1]).toBeLessThan(0);
  expect(Math.abs(walking.arms[0])).toBeGreaterThan(.03);
  expect(walking.bob).toBeGreaterThan(.005);
  await page.screenshot({ path: resolve(outputs, 'puzzle-walk-stride-a.png') });
  await page.waitForTimeout(200);
  expect((await motion(page)).gait).toBeGreaterThan(walking.gait + .4);
  const beforeTurn = await motion(page);
  await page.keyboard.up('KeyD'); await page.keyboard.down('KeyW');
  await page.waitForTimeout(80);
  const turning = await motion(page);
  expect(Math.abs(turning.heading)).toBe(0);
  expect(turning.rotation).toBeGreaterThan(beforeTurn.rotation);
  expect(turning.rotation).toBeLessThan(0);
  await page.keyboard.up('KeyW');
  await expect.poll(async () => Math.hypot((await motion(page)).velocity.x, (await motion(page)).velocity.z)).toBeLessThan(.02);
  await page.waitForTimeout(200);
  const stopped = await motion(page);
  expect(Math.abs(stopped.feet[0])).toBeLessThan(.01);
  expect(stopped.bob).toBeLessThan(.002);
  await beside(page, -29, -13); await action(page);
  await page.keyboard.down('KeyD'); await page.waitForTimeout(300);
  const carrying = await motion(page);
  expect(carrying.arms.every((angle: number) => angle > 1)).toBe(true);
  expect(carrying.carriedPosition[0]).toBeGreaterThan(carrying.playerPosition[0] + .7);
  await page.screenshot({ path: resolve(outputs, 'puzzle-walk-carry.png') });
  await page.keyboard.press('Escape'); await page.keyboard.up('KeyD');
  const paused = await motion(page);
  await page.waitForTimeout(250);
  expect((await motion(page)).gait).toBe(paused.gait);
  expect((await motion(page)).feet).toEqual(paused.feet);
  await page.locator('#restart').click();
  expect((await motion(page)).gait).toBe(0);
  expect((await motion(page)).rotation).toBe(0);
  expect((await motion(page)).arms.every((angle: number) => angle === 0)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload(); await page.locator('#primary').click();
  await page.keyboard.down('KeyW'); await page.waitForTimeout(350);
  const reduced = await motion(page);
  expect(reduced.velocity.z).toBeLessThan(-3);
  expect(reduced.bob).toBe(0); expect(reduced.roll).toBe(0);
  await page.keyboard.up('KeyW');
});

test('both levels share running speed, with stable puzzle HUD text between changes', async ({ page }) => {
  await start(page);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(800);
  const puzzleSpeed = (await motion(page)).velocity.x;
  expect(puzzleSpeed).toBeGreaterThan(6.3);
  expect(puzzleSpeed).toBeLessThan(7.3);
  await page.keyboard.up('KeyD');
  const mutations = await page.evaluate(async () => {
    let count = 0;
    const observer = new MutationObserver(records => count += records.length);
    for (const id of ['finished', 'cue']) observer.observe(document.getElementById(id)!, { childList: true, subtree: true, characterData: true });
    await new Promise(resolve => setTimeout(resolve, 250));
    observer.disconnect(); return count;
  });
  expect(mutations).toBe(0);
  await page.goto('/?test=1');
  await page.locator('#primary').click();
  await expect.poll(() => page.evaluate(() => (window as any).__THREE_GAME_DIAGNOSTICS__?.state)).toBe('racing');
  await page.evaluate(() => (window as any).__THREE_GAME_TEST_HOOKS__.teleport(0, .65, -4));
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(800);
  const raceSpeed = await page.evaluate(() => (window as any).__THREE_GAME_DIAGNOSTICS__.people[0].velocity.x);
  expect(raceSpeed).toBeGreaterThan(6.3);
  await page.keyboard.up('KeyD');
  expect(Math.abs(raceSpeed - puzzleSpeed)).toBeLessThan(.2);
});

test('normal guidance follows the current task without pressing H', async ({ page }) => {
  await start(page);
  await expect(page.locator('#cue')).toHaveText('花园里藏着3把钥匙，会在哪里呢？');
  await page.screenshot({ path: resolve(outputs, 'normal-guidance-start.png') });
  await warp(page, -24, -12);
  await expect(page.locator('#cue')).toHaveText('积木工坊 · 铁门关着，地上的图案有点特别。');
  await expect(page.locator('#cue')).not.toContainText('方形');
  // Walking around the same task must not rewrite the banner.
  const rewrites = await page.evaluate(async () => {
    const cue = document.getElementById('cue')!;
    const seen: string[] = [];
    const observer = new MutationObserver(() => seen.push(cue.textContent!));
    observer.observe(cue, { childList: true, subtree: true, characterData: true });
    for (let i = 0; i < 6; i++) {
      (window as any).__PUZZLE_TEST__.warp(-24, i % 2 ? -12 : -11);
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    observer.disconnect(); return seen;
  });
  expect(rewrites).toEqual([]);
  await beside(page, -29, -13); await action(page);
  await expect(page.locator('#cue')).toContainText('会有什么用呢');
  await expect(page.locator('#cue')).not.toContainText('放下');
  await page.screenshot({ path: resolve(outputs, 'normal-guidance-block.png') });
  await warp(page, -24, -16); await action(page);
  await expect(page.locator('#cue')).toContainText('里面闪着一点金光');
  await warp(page, ...pipeApproaches[0] as [number, number]);
  await expect(page.locator('#cue')).toContainText('小花好像有些口渴');
  await action(page); await action(page); await action(page);
  await expect(page.locator('#cue')).toContainText('又在哪里停住了呢');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(outputs, 'normal-guidance-pond-mobile.png') });
  await warp(page, -4, -47);
  await expect(page.locator('#cue')).toContainText('小鸡盯着谷粒');
  await solve(page, 2);
  await expect(page.locator('#cue')).toHaveText('已找到1/3把钥匙 · 花园里还有新的发现。');
  await warp(page, -24, -12);
  await expect(page.locator('#cue')).toContainText('里面闪着一点金光');
  expect((await snapshot(page)).hintActive).toBe(false);
});

test('H repeats only the opening clue without numbered steps', async ({ page }) => {
  await start(page);
  for (const [x, z, clue] of [
    [-24, -12, '机关上有一个正方形。工坊里有一样形状的积木吗？'],
    [22, -13.9, '沿着水流看一看，水停在哪一段水管前？'],
    [-4, -47, '小鸡喜欢谷粒，也能钻进你进不去的小门。'],
  ] as const) {
    await warp(page, x, z);
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('KeyH');
      await expect(page.locator('#cue')).toHaveText(clue);
      await expect(page.locator('#cue')).not.toContainText('/3');
      await expect(page.locator('#hint')).toHaveText('?提示');
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#dive').click();
  await expect.poll(async () => (await snapshot(page)).hintActive).toBe(false);
  await page.locator('#hint').click();
  await expect(page.locator('#cue')).toHaveText('小鸡喜欢谷粒，也能钻进你进不去的小门。');
  await page.locator('#hint').click();
  await expect(page.locator('#cue')).toHaveText('小鸡喜欢谷粒，也能钻进你进不去的小门。');
  await page.screenshot({ path: resolve(outputs, 'hint-opening-mobile.png') });
});
test('only the square block presses the plate', async ({ page }) => {
  await start(page);
  // Every decoy can be carried to the plate, and none of them opens the workshop gate.
  for (const [x, z, name] of [[-19, -13, '圆柱积木'], [-29, -19, '三角积木'], [-19, -19, '长方体']] as const) {
    await beside(page, x, z); await action(page);
    expect((await snapshot(page)).carriedName).toBe(name);
    await page.keyboard.press('KeyH'); // While a decoy is held the hint names the square block.
    await expect(page.locator('#cue')).toContainText('正方形');
    await warp(page, -24, -16); await action(page);
    const dropped = await snapshot(page);
    expect(dropped.carried).toBe(-1);
    expect(dropped.placed).toEqual([false, false, false, false]);
    expect(dropped.gateOpen).toBe(false);
    await expect(page.locator('#cue')).toContainText('图案');
  }
  expect((await appearance(page)).plateY).toBe(.34);
  expect((await appearance(page)).workshopY).toBe(0);
  await page.screenshot({ path: resolve(outputs, 'workshop-shape-decoys.png') });

  // The square block is still the one that works.
  await beside(page, -29, -13); await action(page);
  expect((await snapshot(page)).carriedName).toBe('正方体');
  await warp(page, -24, -16); await action(page);
  expect((await snapshot(page)).placed).toEqual([true, false, false, false]);
  expect((await snapshot(page)).gateOpen).toBe(true);
});

test('every workshop block is solid until it is picked up', async ({ page }) => {
  await start(page);
  // Walking north into each resting block stops the bean short of its centre.
  for (const [x, z] of [[-29, -13], [-19, -13], [-29, -19], [-19, -19]] as const) {
    await warp(page, x, z + 4);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(900);
    await page.keyboard.up('KeyW');
    expect((await snapshot(page)).position.z).toBeGreaterThan(z + .5);
  }
  await page.screenshot({ path: resolve(outputs, 'workshop-blocks-solid.png') });

  // A carried block stops colliding, so the bean can walk through where it used to stand.
  await beside(page, -29, -13); await action(page);
  expect((await snapshot(page)).carried).toBe(0);
  await warp(page, -29, -9);
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await snapshot(page)).position.z, { timeout: 4000, intervals: [100] }).toBeLessThan(-15);
  await page.keyboard.up('KeyW');

  // Dropping lands the block clear of the bean, who is then blocked by it again.
  await action(page);
  const dropped = await snapshot(page);
  expect(dropped.carried).toBe(-1);
  const block = (await appearance(page)).blocks[0];
  expect(Math.hypot(block[0] - dropped.position.x, block[2] - dropped.position.z)).toBeGreaterThan(1);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyW');
  expect((await snapshot(page)).position.z).toBeGreaterThan(block[2] + .5);
});

test('the pressure plate is solid and the bean can jump onto it', async ({ page }) => {
  await start(page);
  // Walking into the pedestal stops at its rim (z = -15.6 + capsule radius) instead of clipping through.
  await warp(page, -24, -13);
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await snapshot(page)).position.z, { timeout: 5000, intervals: [100] }).toBeLessThan(-15);
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyW');
  const blocked = (await snapshot(page)).position;
  expect(blocked.z).toBeGreaterThan(-15.5);
  expect(blocked.y).toBeLessThan(.8);
  await page.screenshot({ path: resolve(outputs, 'plate-blocks-player.png') });

  // Space launches a hop, and the pedestal top is a standable surface.
  await page.keyboard.press('Space');
  await expect.poll(async () => (await motion(page)).velocity.y, { timeout: 1000, intervals: [30] }).toBeGreaterThan(3);
  await expect.poll(async () => (await snapshot(page)).position.y, { timeout: 2000, intervals: [50] }).toBeGreaterThan(1.3);
  await expect.poll(async () => Math.abs((await motion(page)).velocity.y), { timeout: 3000, intervals: [50] }).toBeLessThan(.1);
  await warp(page, -24, -17);
  await expect.poll(async () => (await snapshot(page)).position.y, { timeout: 2000, intervals: [50] }).toBeCloseTo(1.06, 1);

  // Jumping is blocked while paused, and a restart clears any airborne state.
  await page.keyboard.press('Escape');
  const paused = (await snapshot(page)).position;
  await page.keyboard.press('Space');
  await page.waitForTimeout(250);
  expect((await snapshot(page)).position).toEqual(paused);
  await page.locator('#restart').click();
  await expect.poll(async () => (await snapshot(page)).position.z, { timeout: 2000, intervals: [50] }).toBeCloseTo(10, 0);
  await expect.poll(async () => Math.abs((await motion(page)).velocity.y), { timeout: 2000, intervals: [50] }).toBeLessThan(.1);
});

test('exploration: real paths, independent mechanics, wrong attempts, locks and full exit', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await start(page);
  const initial = await snapshot(page);
  expect(initial.camera.type).toBe('PerspectiveCamera'); expect(initial.camera.fov).toBe(55);
  expect(initial.camera.position[2] - initial.position.z).toBeCloseTo(16, 1);
  expect(initial.hintActive).toBe(false);
  const desktopHint = (await page.locator('#guidance').boundingBox())!;
  expect(desktopHint.y).toBeLessThan(80);
  await page.screenshot({ path: resolve(outputs, 'exploration-hub.png') });
  await action(page); // Distant interaction cannot solve anything.
  expect((await snapshot(page)).collected).toEqual([false, false, false]);
  await page.keyboard.down('KeyW');
  // Release on the near side of the junction so a delayed key-up still stays clear of its garden fence.
  await expect.poll(async () => (await snapshot(page)).position.z, { timeout: 8000, intervals: [100] }).toBeLessThan(-6);
  await page.keyboard.up('KeyW'); await page.waitForTimeout(350);
  await page.keyboard.down('KeyA');
  await expect.poll(async () => (await snapshot(page)).position.x, { timeout: 9000, intervals: [100] }).toBeLessThan(-23);
  await page.keyboard.up('KeyA');
  expect((await snapshot(page)).region).toBe(0);
  await page.screenshot({ path: resolve(outputs, 'exploration-workshop.png') });
  await warp(page, -24, -22.8);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(650); await page.keyboard.up('KeyW');
  expect((await snapshot(page)).position.z).toBeGreaterThan(-23.6);
  await warp(page, 0, -70.8);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(650); await page.keyboard.up('KeyW');
  expect((await snapshot(page)).position.z).toBeGreaterThan(-71.6);
  for (const [x, z] of keySpots) await warp(page, x, z);
  expect((await snapshot(page)).collected).toEqual([false, false, false]);

  // The animal must fetch the key; simply walking to its delivery point does nothing.
  await warp(page, 13, -57); await action(page);
  expect((await snapshot(page)).animal.solved).toBe(false);
  await solve(page, 2);
  expect((await snapshot(page)).collected).toEqual([false, false, true]);
  await page.screenshot({ path: resolve(outputs, 'exploration-grove.png') });

  // Partial water connections do not award a key; complete pipes can be turned in any order.
  await warp(page, ...pipeApproaches[2] as [number, number]); await action(page);
  expect((await snapshot(page)).pipesSolved).toBe(false);
  for (const i of [0, 1]) {
    await warp(page, ...pipeApproaches[i] as [number, number]);
    for (let j = 0; j < [3, 2][i]; j++) await action(page);
  }
  await expect.poll(async () => (await snapshot(page)).pipesSolved).toBe(true);
  expect((await appearance(page)).outletColor).toBe('45b6db');
  await jumpToFlower(page);
  expect((await snapshot(page)).collected).toEqual([false, true, true]);
  await warp(page, 24, -12);
  await page.screenshot({ path: resolve(outputs, 'exploration-pond.png') });

  // Carrying can be abandoned safely, so it never locks the player into a route.
  await beside(page, -29, -13); await action(page);
  await warp(page, -25, -10); await action(page);
  expect((await snapshot(page)).carried).toBe(-1); expect((await snapshot(page)).gateOpen).toBe(false);
  await action(page); expect((await snapshot(page)).carried).toBe(0);
  await warp(page, -24, -16); await action(page);
  expect((await snapshot(page)).gateOpen).toBe(true);
  expect((await appearance(page)).workshopY).toBe(3.6);
  expect((await appearance(page)).plateY).toBe(.285);
  await page.screenshot({ path: resolve(outputs, 'workshop-plate-active.png') });
  await warp(page, -24, -22.8);
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await snapshot(page)).collected[0], { timeout: 4000, intervals: [100] }).toBe(true);
  await page.keyboard.up('KeyW');
  await expect(page.locator('#finished')).toHaveText('3 / 3');
  expect((await appearance(page)).exitYaw).toEqual([-Math.PI / 2, Math.PI / 2]);
  await warp(page, 0, -65);
  await page.screenshot({ path: resolve(outputs, 'garden-gate-open.png') });
  await warp(page, 0, -70.8);
  await page.keyboard.down('KeyW');
  await expect(page.locator('#menu-title')).toHaveText('大门打开啦！'); await page.keyboard.up('KeyW');
  await page.screenshot({ path: resolve(outputs, 'exploration-complete.png') });
  await page.locator('#primary').click();
  const replay = await snapshot(page);
  expect(replay.collected).toEqual([false, false, false]); expect(replay.pipeTurns).toEqual([1, 0, 3]);
  expect(replay.animal.state).toBe('idle'); expect(replay.animal.carryingGrain).toBe(false); expect(replay.placed).toEqual([false, false, false, false]);
  expect(replay.hintActive).toBe(false);
  expect(await appearance(page)).toEqual({ plateY: .34, workshopY: 0, exitYaw: [0, 0], outletColor: 'a5b4b8',
    blocks: [[-29, .78, -13], [-19, .73, -13], [-29, .68, -19], [-19, .58, -19]] });
  const pixels = PNG.sync.read(await page.locator('#game').screenshot());
  const palette = new Set<string>();
  for (let i = 0; i < pixels.data.length; i += 400) palette.add(`${pixels.data[i]},${pixels.data[i + 1]},${pixels.data[i + 2]}`);
  expect(palette.size).toBeGreaterThan(30); expect(errors).toEqual([]);
});

test('all six key orders are playable without cross-puzzle dependencies', async ({ page }) => {
  test.setTimeout(180_000);
  await start(page);
  for (const order of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
    const expected = [false, false, false];
    for (const index of order) {
      await solve(page, index); expected[index] = true;
      expect((await snapshot(page)).collected).toEqual(expected);
    }
    await warp(page, 0, -73);
    await expect(page.locator('#menu-title')).toHaveText('大门打开啦！');
    await page.locator('#primary').click();
    expect((await snapshot(page)).animal.state).toBe('idle');
  }
});

test('mobile: free exploration framing, local hints, touch interaction and map edges', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  expect((await snapshot(page)).hintActive).toBe(false);
  const initial = await snapshot(page);
  expect(initial.camera.position[2] - initial.position.z).toBeCloseTo(18, 1);
  const stick = (await page.locator('#stick').boundingBox())!;
  for (const id of ['hint', 'dive', 'jump', 'sound', 'pause']) {
    const box = (await page.locator(`#${id}`).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  }
  const actions = (await page.locator('.action-controls').boundingBox())!;
  expect(actions.x).toBeGreaterThanOrEqual(stick.x + stick.width);
  await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2);
  await page.mouse.down(); await page.mouse.move(stick.x + stick.width / 2, stick.y + 10);
  await page.waitForTimeout(450); await page.mouse.up();
  expect((await snapshot(page)).position.z).toBeLessThan(initial.position.z - .5);
  await warp(page, ...pipeApproaches[0] as [number, number]);
  await page.locator('#hint').click(); await expect(page.locator('#cue')).toContainText('水管');
  expect((await snapshot(page)).hintActive).toBe(true);
  await page.locator('#hint').click(); await expect(page.locator('#cue')).toContainText('水管');
  expect((await snapshot(page)).hintActive).toBe(true);
  await page.locator('#dive').click(); expect((await snapshot(page)).pipeTurns[0]).toBe(2);
  await page.locator('#sound').click(); await expect(page.locator('#sound')).toHaveAttribute('aria-label', '打开声音');
  await page.screenshot({ path: resolve(outputs, 'exploration-mobile-pond.png') });
  for (const [x, z] of [[-24, -12], [24, -12], [0, -48], [-37, 12], [37, -65]]) {
    await warp(page, x, z);
    const ndc = (await snapshot(page)).camera.playerNdc;
    expect(Math.abs(ndc[0])).toBeLessThan(.8); expect(Math.abs(ndc[1])).toBeLessThan(.8);
  }
  await page.keyboard.down('KeyD'); await page.waitForTimeout(500); await page.keyboard.up('KeyD');
  expect((await snapshot(page)).position.x).toBeLessThan(37.5);
  await warp(page, 0, -48);
  await page.screenshot({ path: resolve(outputs, 'exploration-mobile-grove.png') });
  const guidance = (await page.locator('#guidance').boundingBox())!;
  expect(guidance.x).toBeGreaterThanOrEqual(0); expect(guidance.x + guidance.width).toBeLessThanOrEqual(390);
  expect(guidance.y).toBeLessThan(180);
  expect(guidance.height).toBeLessThan(130);
  await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(1000);
  expect((await snapshot(page)).camera.position[2] - (await snapshot(page)).position.z).toBeCloseTo(16, 1);
  await page.screenshot({ path: resolve(outputs, 'exploration-landscape.png') });
  await page.goto('/?test=1'); await expect(page.locator('.level-link')).toHaveAttribute('href', '?level=2');
});



 test('animal guide: food, distance, obstacle, real movement, tunnel, pause and restart', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await start(page);
  await warp(page, -4, -51); await action(page);
  expect((await snapshot(page)).animal.state).toBe('idle');
  await warp(page, 13, -57.6);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(650); await page.keyboard.up('KeyW');
  expect((await snapshot(page)).position.z).toBeGreaterThan(-58.4);
  await warp(page, 13, -62);
  expect((await snapshot(page)).collected[2]).toBe(false);
  await warp(page, -4, -47);
  await action(page);
  expect((await snapshot(page)).animal.carryingGrain).toBe(true);
  // Follow beyond the former farm boundary and former seven-unit detection radius.
  await warp(page, -4, -40);
  await expect.poll(async () => (await snapshot(page)).animal.position[2]).toBeGreaterThan(-42);
  expect((await snapshot(page)).animal.mood).toBe('following');
  await warp(page, -4, -50);
  await expect.poll(async () => (await snapshot(page)).animal.position[2]).toBeLessThan(-48.5);
  // A direct route across the crates is blocked, even though the player can jump.
  await warp(page, -4, -55);
  await expect.poll(async () => (await snapshot(page)).animal.mood).toBe('blocked');
  expect((await snapshot(page)).animal.position[2]).toBeGreaterThan(-53);
  await warp(page, 15, -50);
  await expect.poll(async () => (await snapshot(page)).animal.mood).toBe('waiting');
  const waiting = (await snapshot(page)).animal.position;
  await page.waitForTimeout(250); expect((await snapshot(page)).animal.position).toEqual(waiting);
  await warp(page, -1, -51);
  await expect.poll(async () => (await snapshot(page)).animal.mood).toBe('following');
  await page.keyboard.press('Escape');
  const paused = (await snapshot(page)).animal;
  await page.waitForTimeout(250); expect((await snapshot(page)).animal).toEqual(paused);
  await page.keyboard.press('Escape');
  // Real keyboard movement guides the chicken around the east end of the crates.
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await snapshot(page)).position.x, { intervals: [30] }).toBeGreaterThan(2.8);
  await page.keyboard.up('KeyD');
  await expect.poll(async () => (await snapshot(page)).animal.position[0]).toBeGreaterThan(1.6);
  for (const targetX of [6, 9, 12.8]) {
    await page.keyboard.down('KeyD');
    await expect.poll(async () => (await snapshot(page)).position.x, { intervals: [30] }).toBeGreaterThan(targetX);
    await page.keyboard.up('KeyD');
    await expect.poll(async () => (await snapshot(page)).animal.position[0]).toBeGreaterThan(targetX - 1.5);
  }
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await snapshot(page)).position.z, { intervals: [30] }).toBeLessThan(-57.7);
  await page.keyboard.up('KeyW');
  await expect.poll(async () => (await snapshot(page)).animal.position[2]).toBeLessThan(-56.4);
  await page.waitForTimeout(1200);
  expect((await snapshot(page)).animal).toMatchObject({ state: 'following', carryingGrain: true, grainPlaced: false, solved: false });
  await expect(page.locator('#cue')).toContainText('怎样让它愿意进去呢');
  await page.keyboard.press('Escape'); await action(page);
  expect((await snapshot(page)).animal.grainPlaced).toBe(false);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#dive')).toContainText('放谷粒');
  await page.locator('#dive').click();
  await expect.poll(async () => (await snapshot(page)).animal).toMatchObject({ carryingGrain: false, grainPlaced: true, grainPosition: [13, .66, -60] });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(async () => (await snapshot(page)).animal.state).toBe('fetching');
  await page.screenshot({ path: resolve(outputs, 'animal-helper-desktop.png') });
  await expect.poll(async () => (await snapshot(page)).animal.state).toBe('returning');
  await page.keyboard.press('Escape');
  const returning = (await snapshot(page)).animal;
  await page.waitForTimeout(250); expect((await snapshot(page)).animal).toEqual(returning);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot(page)).animal.solved).toBe(true);
  await warp(page, 13, -57);
  await expect.poll(async () => (await snapshot(page)).collected[2]).toBe(true);
  await page.keyboard.press('Escape'); await page.locator('#restart').click();
  expect((await snapshot(page)).animal).toMatchObject({ state: 'idle', carryingGrain: false, grainPlaced: false, solved: false, position: [-4, 0, -50], key: [13, 1.5, -62] });
  await page.setViewportSize({ width: 390, height: 844 });
  await warp(page, -4, -47); await page.locator('#dive').click();
  expect((await snapshot(page)).animal.carryingGrain).toBe(true);
  await expect(page.locator('#cue')).toContainText('小鸡跟着谷粒');
  await page.locator('#hint').click(); await expect(page.locator('#cue')).toContainText('谷粒');
  expect((await snapshot(page)).hintActive).toBe(true);
  await page.locator('#hint').click(); await expect(page.locator('#cue')).toContainText('谷粒');
  await expect.poll(async () => (await snapshot(page)).hintActive).toBe(true);
  await page.screenshot({ path: resolve(outputs, 'animal-helper-mobile.png') });
  await warp(page, 10, -50);
  await page.screenshot({ path: resolve(outputs, 'coop-space-mobile.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  await warp(page, 0, -46);
  await page.screenshot({ path: resolve(outputs, 'coop-space-desktop.png') });
  expect(errors).toEqual([]);
});
