import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='artifacts/models/leaf-channel-visibility',errors=[];
try {
  await mkdir(output,{recursive:true});const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route(/\/assets\/maze-[^/]+\.js$/,async route=>{const response=await route.fetch(),body=await response.text(),name=body.match(/export\{([\w$]+) as MazeAdventure\}/)?.[1];assert.ok(name);await route.fulfill({response,body:body+`\nconst init=${name}.prototype.init;${name}.prototype.init=async function(){window.game=this;return init.call(this)};${name}.prototype.tick=function(){};`});});
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:4398/')+'?level=3&lang=zh');await page.locator('.journey-skip').click();await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  const result=await page.evaluate(()=>{
    const g=game,root=g.scene.getObjectByName('three-tier-leaf-water-channel');g.wand=g.treasure=true;g.enemies[0].hp=g.enemies[1].hp=0;g.invulnerable=1000;
    const groups=g.buildingOccluders.filter(o=>o.object.name.startsWith('boss-blockout-water-channel-')||o.object.name==='leaf-channel-inlet');
    const oldBounds=groups[0].bounds.clone().setFromObject(root).expandByScalar(.25);
    window.channelVisibilityPlace=(x,z)=>{g.body.setTranslation({x,y:.85,z},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.clearInput();g.render(0);};
    const sample=(x,z)=>{
      channelVisibilityPlace(x,z);const toActor=g.player.position.clone();toActor.y+=.4;toActor.sub(g.camera.position);const distance=toActor.length(),caster=g.cameraOcclusion;caster.set(g.camera.position,toActor.normalize());caster.far=distance;
      const hit=g.camera.position.clone(),point=caster.ray.intersectBox(oldBounds,hit);
      const blocked=groups.map(o=>caster.intersectObjects(o.opaqueMeshes,false).length>0);
      const curtain=root.getObjectByName('leaf-water-turbulent-cascades').material;
      return {x,z,oldBoxBlocked:!!point&&g.camera.position.distanceTo(hit)<distance,blocked,opacity:groups.map(o=>o.opacity),curtainOpacity:curtain.opacity,curtainFade:curtain.uniforms.uFade.value};
    };
    const near=[[206,-32],[206,-33],[205.5,-34],[205,-35.5],[204,-37],[203.5,-39]].map(([x,z])=>sample(x,z));
    const behind=[[205.7,-43],[204.8,-43],[207,-43],[206.5,-42.7]].map(([x,z])=>sample(x,z));
    const restored=sample(206,-32),before=[g.world.bodies.len(),g.world.colliders.len()];g.reset();const after=[g.world.bodies.len(),g.world.colliders.len()];g.wand=g.treasure=true;g.invulnerable=1000;channelVisibilityPlace(206,-32);
    return {groupNames:groups.map(o=>o.object.name),precise:groups.map(o=>({count:o.opaqueMeshes.length,waterExcluded:o.opaqueMeshes.every(m=>!m.material.isShaderMaterial)})),wholeGroupRegistered:g.buildingOccluders.some(o=>o.object===root),near,behind,restored,before,after};
  });
  assert.equal(result.wholeGroupRegistered,false);assert.equal(result.groupNames.length,4);assert.ok(result.precise.every(o=>o.count>0&&o.waterExcluded));
  assert.ok(result.near[0].opacity.every(o=>o===1),'Standing near the lower basins must keep all stonework visible: '+JSON.stringify(result.near));
  assert.ok(result.near.some(s=>s.oldBoxBlocked&&s.blocked.every(b=>!b)&&s.opacity.every(o=>o===1)),'Reproduce the former broad-box false positive and keep it opaque');
  for(const state of [...result.near,...result.behind]){
    assert.ok(state.opacity.every((o,i)=>o===(state.blocked[i] ? .16 : 1)),'Only genuinely blocking stone groups may fade: '+JSON.stringify(state));
    assert.equal(state.curtainOpacity,1);assert.equal(state.curtainFade,1,'Waterfall must stay independent of basin stone fading');
  }
  assert.ok(result.behind.some(s=>s.blocked.some(Boolean)&&s.opacity.some(o=>o===1)),'A genuinely blocking basin must fade independently');
  assert.ok(result.restored.opacity.every(o=>o===1));assert.deepEqual(result.before,result.after);
  await page.screenshot({path:output+'/nearby-visible.png'});
  await page.evaluate(()=>channelVisibilityPlace(205.7,-43));await page.screenshot({path:output+'/actual-occlusion.png'});
  for(const [width,height]of [[390,844],[844,390]]){await page.setViewportSize({width,height});const opacity=await page.evaluate(()=>{game.resize();channelVisibilityPlace(206,-32);return game.buildingOccluders.filter(o=>o.object.name.startsWith('boss-blockout-water-channel-')||o.object.name==='leaf-channel-inlet').map(o=>o.opacity);});assert.ok(opacity.every(o=>o===1),'Mobile approach must preserve model visibility');await page.screenshot({path:`${output}/nearby-${width}.png`});}
  assert.deepEqual(errors,[]);await writeFile(output+'/metrics.json',JSON.stringify({pass:true,...result,errors},null,2));console.log('PASS basin-specific solid-mesh occlusion, near-player visibility, false-positive regression, independent fading, waterfall preservation, reset and mobile',JSON.stringify(result));
}finally{await browser.close();}
