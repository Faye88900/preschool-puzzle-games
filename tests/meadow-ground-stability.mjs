import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true});
const output='test-results/meadow-ground-stability', before=process.env.CAPTURE_BEFORE==='1', errors=[];
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1000,height:700},reducedMotion:'reduce'});
  page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:'export function startJourney(){return {arrive:async()=>{},dispose(){}}}'}));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:await response.text()+'\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await init.call(this)};MazeAdventure.prototype.tick=function(){};'});
  });
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5230/')+'?level=3&lang=zh');
  await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  const metrics=await page.evaluate(async()=>{
    const T=await import('/node_modules/.vite/deps/three.js'),g=game,old=[];
    g.scene.traverse(o=>{if(o.name==='garden-turf')old.push(new T.Box3().setFromObject(o).max.y);});
    const cover=g.scene.getObjectByName('meadow-ground-cover'),plaza=g.scene.getObjectByName('plaza-groundcover'),underlayY=cover.position.y;
    const ray=new T.Raycaster(new T.Vector3(-44.1,2,2.2),new T.Vector3(0,-1,0));
    const hits=ray.intersectObjects(g.scene.children,true).filter(h=>h.object.name==='meadow-ground-cover'||h.object.material?.map===g.models.get('terrain-grass-01')?.children[0]?.material?.map).map(h=>({name:h.object.name,y:h.point.y}));
    const legacyLoaded=g.models.has('terrain-grass-01');
    const ground=g.scene.getObjectByName('maze-ground'),groundHeights=ground.children.filter(o=>o.name!=='maze-lawn').map(o=>{o.geometry.computeBoundingBox();return o.geometry.boundingBox.max.y;});
    const bodies=[g.world.bodies.len(),g.world.colliders.len()],memory={...g.renderer.info.memory};g.reset();g.render(0);
    window.groundView=(kind,angle=0)=>{
      const center=kind==='plaza'?new T.Vector3(-17,.15,46):new T.Vector3(-44.1,.15,2.2);
      g.camera.position.copy(center).add(new T.Vector3(Math.sin(angle)*5,2.6,Math.cos(angle)*5));g.camera.lookAt(center);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);
    };
    return{old,underlayY,hits,legacyLoaded,plazaMeshes:plaza.children.length,groundHeights,bodies,resetBodies:[g.world.bodies.len(),g.world.colliders.len()],memory,resetMemory:{...g.renderer.info.memory}};
  });
  await writeFile(`${output}/${before?'before':'after'}.json`,JSON.stringify(metrics,null,2));
  for(const [name,kind,angle]of [['bench','well',.75],['bench-left','well',.72],['bench-right','well',.78],['plaza','plaza',.75]]){
    await page.evaluate(({kind,angle})=>groundView(kind,angle),{kind,angle});await page.screenshot({path:`${output}/${name}-${before?'before':'after'}.png`});
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{game.resize();groundView('well',.75);});await page.screenshot({path:`${output}/mobile-${before?'before':'after'}.png`});
  if(!before){
    assert.deepEqual(metrics.old,[],'Legacy ground tiles must not compete with the continuous meadow');
    assert.equal(metrics.legacyLoaded,false,'Third-level ground tiles are fully replaced');
    assert.ok(metrics.groundHeights.every(y=>y<metrics.underlayY-.002),'Retain separation between the meadow cover and path/verge surfaces');
    assert.deepEqual(metrics.resetBodies,metrics.bodies);assert.deepEqual(metrics.resetMemory,metrics.memory);
    assert.deepEqual(errors,[]);
  }
  console.log(before?'BEFORE ground layers':'PASS single meadow surface, separated path/verge layers, reset and bench/plaza camera sweep desktop/mobile',JSON.stringify(metrics));
}finally{await browser.close();}
