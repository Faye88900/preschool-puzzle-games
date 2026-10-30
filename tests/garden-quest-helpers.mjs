import assert from 'node:assert/strict';

// Focused tests stop requestAnimationFrame; advance the actual render/state path.
export async function advanceGarden(page, seconds) {
  await page.evaluate(seconds => {
    const draw = game.renderer.render;
    // Simulate every state/animation frame, then draw once for software WebGL QA.
    game.renderer.render = () => {};
    try { for (let t = 0; t < seconds; t += .05) game.render(.05); }
    finally { game.renderer.render = draw; }
    game.render(0);
  }, seconds);
}
export async function nearGarden(page, name, dx = 0, dz = 1.8) {
  await page.evaluate(async ({ name, dx, dz }) => {
    const { at } = await import('/src/maze-map.ts');
    const p = name === 'gardener' ? game.guide.position : name === 'tools' ? game.toolMesh.position : name === 'handles' ? game.gardenQuest.pushPoint : name === 'seedling' ? game.gardenQuest.seedling.position : at(name);
    game.body.setTranslation({ x: p.x + dx, y: .8, z: p.z + dz }, true);
    game.body.setLinvel({ x: 0, y: 0, z: 0 }, true); game.previous.copy(game.body.translation()); game.render(0);
  }, { name, dx, dz });
}
export async function pushGardenCart(page, touch = false) {
  await nearGarden(page, 'handles', -.2, 0);
  if (touch) await page.locator('#dive').tap(); else await page.keyboard.press('KeyE');
  await advanceGarden(page, 2);
  assert.equal(await page.evaluate(() => game.gardenQuest.stage), 'tool');
}
export async function collectGardenTool(page, touch = false) {
  await pushGardenCart(page, touch); await nearGarden(page, 'tools');
  if (touch) await page.locator('#dive').tap(); else await page.keyboard.press('KeyE');
  assert.ok(await page.evaluate(() => game.tools && !game.wand));
}
export async function plantGarden(page, touch = false) {
  await nearGarden(page, 'gardener');
  if (touch) await page.locator('#dive').tap(); else await page.keyboard.press('KeyE');
  assert.ok(await page.evaluate(() => !game.wand && !game.tools), 'Returning the trowel must wait for planting');
  await advanceGarden(page, 1.3);
  assert.ok(await page.evaluate(() => game.dialogue?.lines.includes('gardenerFollow')), 'The gardener must thank and invite the player before walking');
  for (let i = 0; i < 2; i++) {
    if (touch) await page.locator('#maze-next').tap(); else await page.locator('#maze-next').click();
  }
  for (let i = 0; i < 30 && await page.evaluate(() => game.gardenQuest.stage !== 'plant'); i++) await advanceGarden(page, .5);
  assert.equal(await page.evaluate(() => game.gardenQuest.stage), 'plant');
  await nearGarden(page, 'seedling', 0, 1.2);
  if (touch) await page.locator('#dive').tap(); else await page.keyboard.press('KeyE');
  await advanceGarden(page, 6.5);
  assert.ok(await page.evaluate(() => game.wand && game.gardenQuest.stage === 'grown'));
}
