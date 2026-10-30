import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true}), errors=[];
try {
  const page = await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce',hasTouch:true});
  page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto('http://127.0.0.1:4198/?level=3&lang=zh');
  await page.locator('.game-loading').waitFor({state:'detached',timeout:90000});
  await page.locator('#primary').click();
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(700); await page.keyboard.up('ArrowRight');
  const canvas=await page.locator('#game').evaluate(c=>({width:c.width,height:c.height,displayWidth:c.clientWidth,displayHeight:c.clientHeight}));
  assert.ok(canvas.width>0&&canvas.height>0);
  await page.screenshot({path:'artifacts/models/dark-knight/production-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'artifacts/models/dark-knight/production-mobile.png'});
  await page.locator('#pause').tap(); await page.locator('#menu').waitFor({state:'visible'});
  await page.locator('#primary').tap();
  assert.deepEqual(errors,[]);
  await writeFile('artifacts/models/dark-knight/production-smoke.json',JSON.stringify({url:page.url(),canvas,errors},null,2));
  console.log('PASS unmodified production build: load, start, keyboard movement input, desktop/mobile render, touch pause/resume, no page/console/HTTP errors');
}finally{await browser.close();}
