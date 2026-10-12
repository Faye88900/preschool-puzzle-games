import { test, expect } from '@playwright/test';

test('slow guide walk visibly alternates shoes, settles on stopping and preserves pointing', async ({ page }) => {
  await page.goto('/?character=npc&test=1');
  await page.waitForFunction(() => !!(window as any).__CHARACTER_PREVIEW__);
  const result = await page.evaluate(async () => {
    const url = '/src/workshop-guide.ts';
    const { createWorkshopGuide, animateWorkshopGuide, animateGuideWalk } = await import(url);
    const guide = createWorkshopGuide();
    const feet = () => [-1, 1].map(side => guide.getObjectByName('foot' + side).position.toArray());
    const samples: number[][][] = [];
    for (let i = 0; i < 180; i++) {
      animateWorkshopGuide(guide, 'idle', i / 60, 1 / 60, false);
      animateGuideWalk(guide, i / 60 * .8 * 7, .8, 1 / 60, false);
      samples.push(feet());
    }
    for (let i = 0; i < 90; i++) {
      animateWorkshopGuide(guide, 'point', Math.min(i / 60, 1), 1 / 60, false);
      animateGuideWalk(guide, 3 * .8 * 7, 0, 1 / 60, false);
    }
    return { samples, stopped: feet(), point: guide.getObjectByName('arm1').rotation.z };
  });
  for (let side = 0; side < 2; side++) {
    const z = result.samples.map(feet => feet[side][2]);
    expect(Math.max(...z) - Math.min(...z)).toBeGreaterThan(.4);
    expect(Math.max(...result.samples.map(feet => feet[side][1]))).toBeGreaterThan(-.4);
    expect(result.stopped[side][1]).toBeCloseTo(-.535, 4);
    expect(result.stopped[side][2]).toBeCloseTo(-.13, 4);
  }
  expect(result.samples.some(feet => feet[0][1] > feet[1][1] + .08)).toBe(true);
  expect(result.samples.some(feet => feet[1][1] > feet[0][1] + .08)).toBe(true);
  expect(result.point).toBeLessThan(-1.4);
});
