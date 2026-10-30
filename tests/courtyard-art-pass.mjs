import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const baseline=process.argv.includes('--baseline'),output='artifacts/models/courtyard-art-pass/'+(baseline?'before':'after');
const browser=await chromium.launch({headless:true}),errors=[];
try {
  await mkdir(output,{recursive:true});const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nconst __artInit=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await __artInit.call(this)};MazeAdventure.prototype.tick=function(){};'});});
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:4409/')+'?level=3&lang=zh');await page.locator('.journey-skip').click();await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  await page.evaluate(()=>{
    const g=game;g.wand=g.treasure=true;g.enemies[0].hp=g.enemies[1].hp=0;g.invulnerable=1000;g.world.step();
    window.artPlace=(x,z)=>{g.body.setTranslation({x,y:.85,z},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.clearInput();g.render(0);};
    window.artView=kind=>{artPlace(187.5,-13);if(kind==='combat'){artPlace(187.5,-29);return;}if(kind==='entrance'){artPlace(174,-15);return;}
      if(kind==='overview'){g.camera.position.set(187.5,22,12);g.camera.lookAt(187.5,1,-28);}
      if(kind==='water'){g.camera.position.set(196,9,-21);g.camera.lookAt(207,1.5,-35);}
      if(kind==='camp'){g.camera.position.set(180,7,-28);g.camera.lookAt(173,1,-42);}
      g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);
    };
  });
  for(const kind of ['overview','entrance','combat','water','camp']){await page.evaluate(kind=>artView(kind),kind);await page.screenshot({path:`${output}/${kind}.png`});}
  const metrics=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),{createBossIsland}=await import('/src/boss-island.ts'),{createWrappingSwordRoots}=await import('/src/wrapping-sword-roots.ts');
    const g=game,island=g.scene.getObjectByName('boss-island'),floor=island.getObjectByName('boss-courtyard-wind-mosaic'),ground=island.getObjectByName('boss-island-ground');
    const materials=new Map();island.traverse(n=>{if(n.isMesh&&n.material.name)materials.set(n.material.name,n.material.color?.getHexString());});
    const colors=Object.fromEntries(materials),factoryRoot=createWrappingSwordRoots(),source=factoryRoot.children.find(m=>m.material?.name==='sword-roots-wood').material;
    const before=source.color.getHexString(),copy=createBossIsland(g.courtyardFloor),copyRoot=copy.root.getObjectByName('wrapping-sword-roots').children.find(m=>m.material?.name==='sword-roots-wood');
    const sharedGeometry=copyRoot.geometry===factoryRoot.children.find(m=>m.material?.name==='sword-roots-wood').geometry;
    const privateMaterial=copyRoot.material!==source,sourceUnchanged=source.color.getHexString()===before;
    artView('combat');g.renderer.render(g.scene,g.camera);
    const placements=Object.fromEntries(['weapon-rack','campfire','chime-0','marker','pots'].map(name=>[name,island.getObjectByName('boss-blockout-'+name).getWorldPosition(new T.Vector3()).toArray()]));
    return {ground:ground.material.color.getHexString(),colors,placements,sharedGeometry,privateMaterial,sourceUnchanged,sourceWood:before,
      sharedFloor:floor.material.map===g.courtyardFloor&&floor.material.map===g.scene.getObjectByName('courtyard-wind-mosaic').material.map,
      render:{...g.renderer.info.render},memory:{...g.renderer.info.memory},bodies:g.world.bodies.len(),colliders:g.world.colliders.len()};
  });
  if(!baseline){assert.equal(metrics.ground,'596d65');assert.ok(metrics.privateMaterial&&metrics.sourceUnchanged&&metrics.sharedGeometry,'Boss palette must isolate cached materials and share geometry');assert.equal(metrics.sourceWood,'e6d2ae');assert.equal(metrics.colors['sword-roots-wood'],'806044');assert.ok(metrics.sharedFloor);assert.deepEqual(metrics.placements['weapon-rack'],[173.5,0,-43]);assert.deepEqual(metrics.placements['chime-0'],[169.5,0,-39.5]);}
  for(const [width,height]of [[390,844],[844,390]]){await page.setViewportSize({width,height});await page.evaluate(()=>{game.resize();artView('combat');});await page.screenshot({path:`${output}/combat-${width}.png`});}
  assert.deepEqual(errors,[]);await writeFile(output+'/metrics.json',JSON.stringify({pass:true,metrics,errors},null,2));console.log('PASS art pass '+JSON.stringify(metrics));
}finally{await browser.close();}
