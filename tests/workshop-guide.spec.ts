import { test, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('workshop guide: hard hat, poses, orbit, mobile framing and reusable GLB', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const output = resolve('test-results/outputs/workshop-guide-3d');
  await mkdir(output, { recursive: true });
  await page.goto('/?character=npc&test=1');
  await page.waitForFunction(() => !!(window as any).__CHARACTER_PREVIEW__);
  const stats = await page.evaluate(() => {
    const { model, renderer } = (window as any).__CHARACTER_PREVIEW__;
    const names: string[] = []; model.traverse((node: any) => names.push(node.name));
    return { names, triangles: renderer.info.render.triangles, color: model.getObjectByName('body').material.color.getHexString() };
  });
  for (const part of ['hard-hat', 'helmet-shell', 'helmet-center-ridge', 'helmet-rim', 'helmet-brim', 'helmet-adjustment-band']) expect(stats.names).toContain(part);
  expect(stats.names).not.toContain('ear1');
  expect(stats.names).not.toContain('player-marker');
  expect(stats.color).toBe('afe1be');
  expect(stats.triangles).toBeGreaterThan(1000);
  expect(stats.triangles).toBeLessThan(40000);
  for (const name of ['正面', '侧面', '背面', '立体']) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.screenshot({ path: resolve(output, `${name}.png`) });
  }
  const cameraBefore = await page.evaluate(() => (window as any).__CHARACTER_PREVIEW__.camera.position.toArray());
  await page.mouse.move(650, 400); await page.mouse.down(); await page.mouse.move(900, 450, { steps: 10 }); await page.mouse.up();
  await expect.poll(() => page.evaluate(() => (window as any).__CHARACTER_PREVIEW__.camera.position.toArray())).not.toEqual(cameraBefore);
  await page.getByRole('button', { name: '正面', exact: true }).click();
  await page.locator('#pose').selectOption('point');
  await expect.poll(() => page.evaluate(() => (window as any).__CHARACTER_PREVIEW__.model.getObjectByName('arm1').children[0].scale.y), { intervals: [30] }).toBeGreaterThan(.39);
  expect(await page.evaluate(() => Math.abs((window as any).__CHARACTER_PREVIEW__.camera.position.x))).toBeLessThan(.001);
  await page.screenshot({ path: resolve(output, 'point.png') });
  await expect.poll(() => page.evaluate(() => Math.abs((window as any).__CHARACTER_PREVIEW__.model.getObjectByName('guide-torso').rotation.y))).toBeLessThan(.01);
  await page.getByRole('button', { name: '重播动作' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__CHARACTER_PREVIEW__.model.getObjectByName('arm1').children[0].scale.y), { intervals: [30] }).toBeGreaterThan(.39);
  await page.locator('#pose').selectOption('nod');
  await expect.poll(() => page.evaluate(() => (window as any).__CHARACTER_PREVIEW__.model.userData.expression)).toBe('happy');
  await expect.poll(() => page.evaluate(() => (window as any).__CHARACTER_PREVIEW__.model.getObjectByName('guide-torso').rotation.x)).toBeLessThan(-.12);
  await page.screenshot({ path: resolve(output, 'nod.png') });
  await page.locator('#pose').selectOption('idle');
  await expect.poll(() => page.evaluate(() => (window as any).__CHARACTER_PREVIEW__.model.getObjectByName('arm1').rotation.z)).toBeLessThan(.01);
  await expect.poll(() => page.evaluate(() => (window as any).__CHARACTER_PREVIEW__.model.userData.expression)).toBe('neutral');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 GLB' }).click();
  await (await downloaded).saveAs(resolve(output, 'workshop-guide.glb'));
  await expect(page.locator('#export-status')).toContainText('已导出静态模型');
  const data = await readFile(resolve(output, 'workshop-guide.glb'));
  expect(data.toString('utf8', 0, 4)).toBe('glTF');
  const gltf = JSON.parse(data.toString('utf8', 20, 20 + data.readUInt32LE(12)));
  expect(gltf.images.every((image: any) => image.bufferView !== undefined)).toBe(true);
  expect(gltf.nodes.some((node: any) => node.name === 'helmet-center-ridge')).toBe(true);
  expect(gltf.nodes.some((node: any) => node.name === 'player-marker' || node.name === 'ear1')).toBe(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '立体', exact: true }).click();
  await page.screenshot({ path: resolve(output, 'mobile.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const header = await page.locator('.studio-header').boundingBox();
  const status = await page.locator('#export-status').boundingBox();
  expect(status!.y).toBeGreaterThan(header!.y + header!.height);
  const frame = await page.evaluate(() => {
    const { model, camera } = (window as any).__CHARACTER_PREVIEW__;
    return ['helmet-center-ridge', 'foot1', 'arm-1'].map(name => {
      const part = model.getObjectByName(name); return part.getWorldPosition(part.position.clone()).project(camera).toArray();
    });
  });
  for (const [x, y] of frame) { expect(Math.abs(x)).toBeLessThan(.9); expect(Math.abs(y)).toBeLessThan(.75); }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '正面', exact: true }).click();
  await page.locator('#pose').selectOption('point');
  await expect.poll(() => page.evaluate(() => (window as any).__CHARACTER_PREVIEW__.model.getObjectByName('arm1').children[0].scale.y)).toBe(.4);
  await page.screenshot({ path: resolve(output, 'mobile-point.png') });
  await page.locator('#pose').selectOption('nod');
  await expect.poll(() => page.evaluate(() => (window as any).__CHARACTER_PREVIEW__.model.getObjectByName('guide-torso').rotation.x)).toBe(0);
  expect(errors).toEqual([]);
});

test('pointing looks before reaching, holds outside body, retracts and resets across frame rates', async ({ page }) => {
  await page.goto('/?character=npc&test=1');
  const runs = await page.evaluate(async () => {
    const modulePath = '/src/workshop-guide.ts';
    const { createWorkshopGuide, animateWorkshopGuide } = await import(modulePath);
    return [30, 60, 120].map(fps => {
      const model = createWorkshopGuide();
      const torso = model.getObjectByName('guide-torso');
      const arm = model.getObjectByName('arm1'), hand = arm.children[0];
      const samples: any[] = [];
      for (let i = 0; i <= fps * 2.5; i++) {
        animateWorkshopGuide(model, 'point', i / fps, 1 / fps, false);
        if ([.1, 1, 2.5].some(t => Math.abs(i / fps - t) < .001)) {
          model.updateMatrixWorld(true);
          const shoulder = arm.getWorldPosition(arm.position.clone());
          const tip = hand.localToWorld(hand.position.clone().set(0, 1, 0));
          samples.push({ turn: torso.rotation.y, length: hand.scale.y, tip: tip.toArray(), shoulder: shoulder.toArray() });
        }
      }
      animateWorkshopGuide(model, 'point', 1, 1 / fps, true);
      animateWorkshopGuide(model, 'idle', 0, 1 / fps, true);
      return { samples, reset: { turn: torso.rotation.y, length: hand.scale.y, arm: arm.rotation.toArray().slice(0, 3) } };
    });
  });
  for (const { samples: [look, hold, end], reset } of runs) {
    expect(look.turn).toBeLessThan(-.05);
    expect(look.length).toBeCloseTo(.22, 5);
    expect(hold.tip[0]).toBeGreaterThan(.75); // Hand extends beyond the .56-wide body.
    expect(hold.tip[0] - hold.shoulder[0]).toBeGreaterThan(.45);
    expect(Math.abs(hold.tip[1] - hold.shoulder[1])).toBeLessThan(.16);
    expect(hold.tip[2]).toBeLessThan(hold.shoulder[2]);
    expect(end.length).toBeCloseTo(.22, 3);
    expect(Math.abs(end.turn)).toBeLessThan(.015);
    expect(reset.length).toBeCloseTo(.22, 5);
    for (const angle of [reset.turn, ...reset.arm]) expect(Math.abs(angle)).toBeLessThan(.00001);
  }
  expect(Math.abs(runs[0].samples[1].turn - runs[2].samples[1].turn)).toBeLessThan(.01);
});
