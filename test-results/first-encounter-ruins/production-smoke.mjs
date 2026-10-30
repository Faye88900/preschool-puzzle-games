import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),errors=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true,reducedMotion:'reduce'});
  page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.goto('http://127.0.0.1:4206/?level=3&lang=zh');
  await page.locator('.game-loading').waitFor({state:'detached'});
  await page.locator('#primary').click();
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(500);await page.keyboard.up('ArrowRight');
  await page.screenshot({path:'test-results/first-encounter-ruins/production-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/first-encounter-ruins/production-mobile.png'});
  await page.locator('#pause').tap();await page.locator('#menu').waitFor({state:'visible'});
  await page.locator('#primary').tap();await page.locator('#menu').waitFor({state:'hidden'});
  assert.deepEqual(errors,[]);
  await writeFile('test-results/first-encounter-ruins/production-report.json',JSON.stringify({url:page.url(),errors,scope:'Unmodified dist build: start, keyboard input, desktop/mobile render, touch pause/resume. These captures are at spawn, not the encounter.'},null,2));
  console.log('PASS unmodified production build loads/starts, keyboard input, desktop/mobile screenshots, touch pause/resume, no page/console/HTTP errors');
}finally{await browser.close();}

