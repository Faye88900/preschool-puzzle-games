import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless:true });
const errors = [], views = [];
try {
  await mkdir('test-results/plaza-production',{recursive:true});
  const page = await browser.newPage({viewport:{width:1280,height:800},hasTouch:true,reducedMotion:'reduce'});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
  await page.goto('http://127.0.0.1:5219/?level=3&lang=zh');
  await page.locator('.game-loading').waitFor({state:'detached',timeout:90000});
  await page.locator('#primary').click();
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(600);await page.keyboard.up('ArrowRight');
  assert.ok(await page.evaluate(()=>window.game instanceof HTMLCanvasElement && !window.game.scene),'Built game must retain the canvas named property, without the test-injected game instance');
  for(const [width,height]of [[1280,800],[390,844],[844,390]]) {
    await page.setViewportSize({width,height});
    const canvas=await page.locator('#game').boundingBox();assert.ok(canvas.width===width&&canvas.height===height);
    const pixels=await page.locator('#game').screenshot();assert.ok(pixels.length>15000);
    await page.screenshot({path:`test-results/plaza-production/${width}x${height}.png`});
    views.push({width,height,canvasBytes:pixels.length});
  }
  await page.locator('#pause').click();await page.locator('#primary').waitFor({state:'visible'});
  await page.locator('#primary').click();await page.locator('#primary').waitFor({state:'hidden'});
  assert.deepEqual(errors,[]);
  await writeFile('test-results/plaza-production/report.json',JSON.stringify({views,errors},null,2));
  console.log('PASS built preview, original asset loading, active desktop/portrait/landscape canvas, pause/resume, no test hook or runtime/HTTP errors',JSON.stringify(views));
}finally{await browser.close();}
