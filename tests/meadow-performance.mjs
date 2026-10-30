import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),before=process.env.CAPTURE_BEFORE==='1';
const output='test-results/meadow-performance',errors=[];
try{
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:'export function startJourney(){return {arrive:async()=>{},dispose(){}}}'}));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await init.call(this)};MazeAdventure.prototype.tick=function(){};'});});
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5230/')+'?level=3&lang=zh');await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  const views=[];
  for(const [name,x,z,width,height]of [['plaza',-10,50,1280,800],['well',-40,8,1280,800],['boss',187.5,-27,1280,800],['mobile',-10,50,390,844]]){
    await page.setViewportSize({width,height});
    const view=await page.evaluate(({x,z})=>{
      const g=game;g.body.setTranslation({x,y:.8,z},true);g.previous.copy(g.body.translation());g.resize();g.render(0);
      const meshes=g.meadow.root.children.flatMap(tile=>tile.children),count=meshes.reduce((n,m)=>n+m.geometry.instanceCount,0);
      g.meadow.root.visible=false;g.renderer.render(g.scene,g.camera);const bare={...g.renderer.info.render};
      g.meadow.root.visible=true;g.renderer.render(g.scene,g.camera);const grass={...g.renderer.info.render};
      const gl=g.renderer.getContext(),samples=[];
      for(let i=0;i<12;i++){g.renderer.render(g.scene,g.camera);gl.finish();const t=performance.now();g.renderer.render(g.scene,g.camera);gl.finish();if(i>2)samples.push(performance.now()-t);}
      samples.sort((a,b)=>a-b);
      return{instances:count,triangles:grass.triangles-bare.triangles,calls:grass.calls-bare.calls,medianMs:samples[Math.floor(samples.length/2)]};
    },{x,z});views.push({name,...view});
    if(!before)await page.screenshot({path:`${output}/${name}-after.png`});
  }
  let culling;
  if(!before){
    culling=await page.evaluate(()=>{
      const g=game;g.camera.position.set(500,30,500);g.meadow.update(0,true,g.camera.position);
      const far=g.meadow.root.children.filter(o=>o.name.startsWith('meadow-tile-')&&o.visible).length;
      g.camera.position.set(-10,20,50);g.meadow.update(0,true,g.camera.position);
      const near=g.meadow.root.children.filter(o=>o.name.startsWith('meadow-tile-')&&o.visible).length;
      const total=g.meadow.root.children.filter(o=>o.name.startsWith('meadow-tile-')).length;
      const ground=g.scene.getObjectByName('meadow-ground-cover').visible;return{far,near,total,ground};
    });
    assert.equal(culling.far,0);assert.ok(culling.near>0&&culling.near<culling.total&&culling.ground);
    const baseline=JSON.parse(await readFile(output+'/before.json','utf8'));
    for(const view of views){const old=baseline.views.find(v=>v.name===view.name);assert.ok(view.instances<old.instances*.65,view.name+' total grass budget');assert.ok(view.triangles<old.triangles*.6,view.name+' visible grass geometry');assert.ok(view.calls<=old.calls,view.name+' draw calls');}
  }
  assert.deepEqual(errors,[]);await writeFile(`${output}/${before?'before':'after'}.json`,JSON.stringify({views,culling,errors},null,2));
  console.log(before?'BEFORE grass profile':'PASS reduced grass density, camera distance culling, persistent green terrain, desktop/mobile budgets',JSON.stringify({views,culling}));
}finally{await browser.close();}
