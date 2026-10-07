import { test, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('approved character renders all views, animates, and exports a self-contained GLB', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const output = resolve('artifacts/design/character-a-3d');
  await mkdir(output, { recursive: true });
  await page.goto('/?character=1&test=1');
  await page.waitForFunction(() => !!(window as any).__CHARACTER_PREVIEW__);
  await page.waitForTimeout(250);
  const stats = await page.evaluate(() => {
    const { model, renderer } = (window as any).__CHARACTER_PREVIEW__;
    const names: string[] = []; model.traverse((node: any) => names.push(node.name));
    return { names, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures };
  });
  for (const part of ['avatar', 'body', 'face', 'ear-1', 'ear1', 'foot-1', 'foot1', 'arm-1', 'arm1']) expect(stats.names).toContain(part);
  expect(stats.names).not.toContain('tail');
  expect(stats.triangles).toBeLessThan(40000);
  expect(stats.textures).toBeGreaterThan(0);
  for (const name of ['正面', '侧面', '背面', '立体']) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForTimeout(100);
    await page.screenshot({ path: resolve(output, `${name}.png`) });
  }
  await page.locator('#pose').selectOption('run');
  await expect.poll(() => page.evaluate(() => (window as any).__CHARACTER_PREVIEW__.model.userData.expression)).toBe('determined');
  await expect.poll(() => page.evaluate(() => {
    const model = (window as any).__CHARACTER_PREVIEW__.model;
    return model.getObjectByName('foot-1').rotation.x * model.getObjectByName('foot1').rotation.x;
  })).toBeLessThan(-.015);
  await page.locator('#pose').selectOption('jump');
  await expect.poll(() => page.evaluate(() => (window as any).__CHARACTER_PREVIEW__.model.position.y)).toBeGreaterThan(1);
  await expect.poll(() => page.evaluate(() => (window as any).__CHARACTER_PREVIEW__.model.userData.expression)).toBe('surprised');
  await page.locator('#pose').selectOption('idle');
  for (const expression of ['happy', 'surprised', 'determined', 'neutral']) {
    await page.locator('#expression').selectOption(expression);
    await expect.poll(() => page.evaluate(() => (window as any).__CHARACTER_PREVIEW__.model.userData.expression)).toBe(expression);
  }
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 GLB' }).click();
  await (await downloaded).saveAs(resolve(output, 'character-a.glb'));
  const data = await readFile(resolve(output, 'character-a.glb'));
  expect(data.toString('utf8', 0, 4)).toBe('glTF');
  const gltf = JSON.parse(data.toString('utf8', 20, 20 + data.readUInt32LE(12)));
  expect(gltf.images.every((image: any) => image.bufferView !== undefined)).toBe(true);
  expect(gltf.nodes.some((node: any) => node.name === 'body')).toBe(true);
  expect(gltf.nodes.some((node: any) => node.name === 'player-marker')).toBe(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '正面', exact: true }).click();
  await page.screenshot({ path: resolve(output, 'mobile.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
