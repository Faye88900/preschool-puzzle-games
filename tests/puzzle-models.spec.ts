import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

test('Free GLBs decode, sit on the ground, render on desktop/mobile and survive restart', async ({ page }) => {
  const errors: string[] = [], loaded = new Set<string>();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => errors.push(request.url()));
  page.on('response', response => {
    if (response.url().includes('/models/')) {
      expect(response.ok()).toBe(true); loaded.add(new URL(response.url()).pathname);
    }
  });
  await page.goto('/?level=2&test=1');
  await page.locator('#primary').click();
  await mkdir('artifacts/models', { recursive: true });
  const models = () => page.evaluate(() => (window as any).__PUZZLE_TEST__.models());
  let report = await models();
  expect(new Set(report.instances.map((m: any) => m.name)).size).toBe(18);
  expect(report.instances.filter((m: any) => m.name === 'cattail-reed-clump')).toHaveLength(3);
  expect(report.instances.filter((m: any) => m.name === 'chicken')).toHaveLength(4);
  expect(report.instances.filter((m: any) => m.name === 'fire-hydrant')).toHaveLength(2);
  expect(report.instances.filter((m: any) => m.name === 'road-cobble-corner-01')).toHaveLength(4);
  expect(report.instances.filter((m: any) => m.name === 'picket-fence-01').length).toBeGreaterThan(60);
  expect(report.instances.filter((m: any) => m.name === 'terrain-grass-01')).toHaveLength(25);
  for (const name of ['bld-general-store-01', 'home-cottage-01', 'home-thatched-house-01', 'water-pond-01']) {
    expect(report.instances.filter((m: any) => m.name === name)).toHaveLength(1);
  }
  for (const model of report.instances) {
    expect(model.max.every(Number.isFinite)).toBe(true);
    expect(model.min[1]).toBeGreaterThanOrEqual(model.name === 'terrain-grass-01' ? -.366 : -.061);
    if (model.name.startsWith('home-') || model.name.startsWith('bld-')) expect(model.min[1]).toBeCloseTo(0, 4);
  }
  const instanceCount = report.instances.length;
  await page.evaluate(() => (window as any).__PUZZLE_TEST__.warp(26, -41));
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1700); await page.keyboard.up('KeyW');
  const blocked = await page.evaluate(() => (window as any).__PUZZLE_TEST__.snapshot().position);
  expect(blocked.z).toBeGreaterThan(-45); expect(blocked.z).toBeLessThan(-42);
  for (const [name, x, z] of [['entrance', 0, 17], ['streetscape', 29, 6], ['workshop', -27, -16], ['pond', 25, -22], ['grove', 0, -48], ['locked-gate', 0, -65]] as const) {
    await page.evaluate(({ x, z }) => (window as any).__PUZZLE_TEST__.warp(x, z), { x, z });
    await page.waitForTimeout(150);
    report = await models();
    expect(report.instances.some((m: any) => Math.abs(m.ndc[0]) < .9 && Math.abs(m.ndc[1]) < .9 && Math.abs(m.ndc[2]) < 1)).toBe(true);
    await page.screenshot({ path: `artifacts/models/${name}-desktop.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => (window as any).__PUZZLE_TEST__.warp(25, -22));
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'artifacts/models/pond-mobile.png' });
  await page.keyboard.press('Escape');
  await page.locator('#restart').click();
  expect((await models()).instances).toHaveLength(instanceCount);
  expect(loaded.has('/models/apple-tree.glb')).toBe(true);
  expect(loaded.has('/models/chicken.glb')).toBe(true);
  expect(loaded.has('/models/draco/draco_decoder.wasm')).toBe(true);
  expect(loaded.has('/models/cattail-reed-clump.glb')).toBe(true);
  expect([...loaded].filter(url => url.endsWith('.glb'))).toHaveLength(18);
  expect(errors).toEqual([]);
  await writeFile('artifacts/models/runtime.json', JSON.stringify({ loaded: [...loaded], errors, report }, null, 2));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => (window as any).__PUZZLE_TEST__.overview());
  await page.screenshot({ path: 'artifacts/models/garden-overview.png' });
  const pixels = PNG.sync.read(await page.locator('#game').screenshot()), palette = new Set<string>();
  for (let i = 0; i < pixels.data.length; i += 400) palette.add(`${pixels.data[i]},${pixels.data[i + 1]},${pixels.data[i + 2]}`);
  expect(palette.size).toBeGreaterThan(30);
});
