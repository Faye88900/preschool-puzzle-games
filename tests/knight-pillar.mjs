import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='test-results/knight-pillar',errors=[];
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:false,reducedMotion:'no-preference'});
  page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:'export function startJourney(){return {arrive:async()=>{},dispose(){}}}'}));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+'\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;return init.call(this)};MazeAdventure.prototype.tick=function(){};'});});
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5207/')+'?level=3&lang=zh');
  await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  await page.evaluate(()=>{
    const g=game;
    window.effectPixels=object=>{
      const gl=g.renderer.getContext(),canvas=g.renderer.domElement;
      const read=()=>{const pixels=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;};
      g.renderer.render(g.scene,g.camera);const before=read();object.visible=false;g.renderer.render(g.scene,g.camera);const after=read();
      let changed=0;for(let i=0;i<before.length;i+=4)if(Math.abs(before[i]-after[i])+Math.abs(before[i+1]-after[i+1])+Math.abs(before[i+2]-after[i+2])>30)changed++;
      object.visible=true;g.renderer.render(g.scene,g.camera);return changed;
    };
    window.advance=(seconds,until)=>{
      for(let i=0;i<Math.ceil(seconds*120);i++){if(!g.active())break;g.step();if(until&&g.enemies[1].phase===until)break;}
      g.render(0);const e=g.enemies[1];return {phase:e.phase,timer:e.timer,hp:e.hp,hearts:g.hearts,position:e.mesh.position.toArray(),player:g.body.translation(),ready:g.chargePillarReady,laneColor:g.chargeLane.material.color.getHexString(),stars:e.mesh.getObjectByName('pillar-stun-stars').visible,shield:e.mesh.getObjectByName('shield').rotation.x,cue:document.querySelector('#cue').textContent};
    };
    window.setup=(x=28,z=-6.35,enemyX=25,enemyZ=0)=>{
      g.reset();g.wand=g.bridgeOpen=true;g.bridgeProgress=1;g.bridgeBody.setEnabled(false);
      g.enemies[0].hp=0;g.enemies[0].timer=0;g.encounterGateProgress=1;g.encounterGate.body.setEnabled(false);
      const e=g.enemies[1];e.mesh.position.set(enemyX,0,enemyZ);e.mesh.rotation.y=Math.atan2(enemyX-x,enemyZ-z);
      g.body.setTranslation({x,y:.8,z},true);g.previous.copy(g.body.translation());g.render(0);
    };
    setup();
  });
  assert.equal(await page.evaluate(()=>game.objective()),'pillarHint','Approaching the live courtyard knight introduces pillar bait');
  await page.keyboard.press('KeyH');assert.equal(await page.evaluate(()=>game.message),'pillarHint');
  const warning=await page.evaluate(()=>advance(8,'warn'));assert.equal(warning.phase,'warn');
  assert.ok(warning.ready&&warning.cue.includes('石柱')&&warning.laneColor==='edbf38','A reachable pillar gives a gold lane and a clear cue');
  const lanePixels=await page.evaluate(()=>effectPixels(game.chargeLane));assert.ok(lanePixels>300,'Charge lane must render above the mosaic floor: '+lanePixels);
  await page.screenshot({path:output+'/bait-warning-pc.png'});
  await page.keyboard.down('KeyA');await page.keyboard.press('ShiftLeft');
  await page.evaluate(()=>advance(.4));await page.keyboard.up('KeyA');
  const impact=await page.evaluate(()=>advance(3,'dazed'));
  assert.equal(impact.phase,'dazed',JSON.stringify(impact));assert.equal(impact.timer,5);assert.equal(impact.hearts,3);assert.equal(impact.hp,2);
  assert.ok(impact.stars&&impact.cue.includes('石柱')&&impact.cue.includes('吹风'));
  const settled=await page.evaluate(()=>advance(.3));assert.ok(settled.shield<-.95);
  assert.ok(await page.evaluate(()=>!game.chargePillars.some(b=>b.containsPoint(game.enemies[1].mesh.position))),'Knight stops before the expanded pillar collider');
  const starPixels=await page.evaluate(()=>effectPixels(game.enemies[1].mesh.getObjectByName('pillar-stun-stars')));
  assert.ok(starPixels>20,'Stars must actually render above the knight: '+starPixels);
  await page.screenshot({path:output+'/pillar-dazed-pc.png'});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{game.resize();game.render(0);});
  await page.screenshot({path:output+'/pillar-dazed-narrow.png'});
  await page.setViewportSize({width:1280,height:800});
  const extended=await page.evaluate(()=>advance(3.1));assert.equal(extended.phase,'dazed');assert.ok(extended.timer>1.5&&extended.timer<1.7);assert.deepEqual(extended.position,impact.position);
  const paused=await page.evaluate(()=>{const g=game;g.pause();const before=g.enemies[1].timer;advance(1);g.render(.3);const after=g.enemies[1].timer;g.pause();return {before,after};});
  assert.equal(paused.before,paused.after,'Pause freezes the long stun');
  await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>game.enemies[1].hp),1,'The extended window stays vulnerable beyond normal recovery');
  await page.evaluate(()=>advance(.1));assert.equal(await page.evaluate(()=>game.enemies[1].mesh.getObjectByName('pillar-stun-stars').visible),false);
  const cases=[];
  for(const [name,x,z,ex,ez,key,phase] of [
    ['right rear pillar with standing space',28,-5.2,25,0,'KeyA','dazed'],
    ['left rear pillar with standing space',22.5,-5.2,25,0,'KeyD','dazed'],
    ['left rear pillar',22.5,-6.35,25,0,'KeyD','dazed'],
    ['left entry pillar',23.4,10.5,23.4,9,'KeyD','dazed'],
    ['right entry pillar',26.6,10.5,26.6,9,'KeyA','dazed'],
    ['central stone wall',25,-6.35,25,0,'KeyA','rest'],
    ['flowerbed',31.6,-3.7,31.6,-1.4,'KeyA','rest'],
    ['hedge',31.8,3.5,28,3.5,'KeyW','rest'],
    ['open courtyard',25,4,25,0,'KeyD','rest']
  ]) {
    await page.evaluate(({x,z,ex,ez})=>{setup(x,z,ex,ez);advance(8,'warn');},{x,z,ex,ez});
    assert.equal(await page.evaluate(()=>game.enemies[1].phase),'warn',name+' tell');
    assert.equal(await page.evaluate(()=>game.chargePillarReady),phase==='dazed',name+' accurate pillar preview');
    await page.keyboard.down(key);await page.keyboard.press('ShiftLeft');await page.evaluate(()=>advance(.4));await page.keyboard.up(key);
    const result=await page.evaluate(phase=>advance(3,phase),phase);
    assert.equal(result.phase,phase,name+' '+JSON.stringify(result));assert.equal(result.timer,phase==='dazed'?5:3,name+' recovery');assert.equal(result.hearts,3,name+' clean dodge');
    assert.equal(result.stars,phase==='dazed',name+' feedback');cases.push({name,...result});
  }
  // Walk in from the normal entrance with the knight active throughout; do not teleport to the bait spot.
  const approach=await page.evaluate(()=>{
    setup(25,9);const g=game,route=[];
    for(const [x,z]of [[25,7],[29,6],[29,-3],[28,-5.2]]){
      for(let i=0;i<700;i++){
        const p=g.body.translation();if(Math.hypot(p.x-x,p.z-z)<.2)break;
        g.keys.clear();if(Math.abs(x-p.x)>.12)g.keys.add(x>p.x?'KeyD':'KeyA');if(Math.abs(z-p.z)>.12)g.keys.add(z>p.z?'KeyS':'KeyW');g.step();
      }
      const p=g.body.translation();route.push({target:[x,z],distance:Math.hypot(p.x-x,p.z-z)});
    }
    g.keys.clear();let lastPhase='';const phases=[];
    for(let i=0;i<2400;i++){
      const e=g.enemies[1];g.step();
      if(e.phase!==lastPhase){g.render(0);phases.push(e.phase);lastPhase=e.phase;if(e.phase==='warn'&&g.chargePillarReady)break;}
    }
    g.render(0);return {route,phases,ready:g.chargePillarReady,hearts:g.hearts,cue:document.querySelector('#cue').textContent};
  });
  assert.ok(approach.route.every(p=>p.distance<.35)&&approach.ready&&approach.hearts===3,JSON.stringify(approach));
  await page.screenshot({path:output+'/gold-warning-natural-approach.png'});
  await page.keyboard.down('KeyA');await page.keyboard.press('ShiftLeft');await page.evaluate(()=>advance(.4));await page.keyboard.up('KeyA');
  const naturalImpact=await page.evaluate(()=>advance(3,'dazed'));
  assert.ok(naturalImpact.phase==='dazed'&&naturalImpact.hearts===3,JSON.stringify(naturalImpact));
  // Recover naturally without attacking, then verify the reduced-motion cue and reset cleanup.
  const lifecycle=await page.evaluate(()=>{
    setup();advance(8,'warn');game.keys.add('KeyA');game.dodge();advance(.4);game.keys.clear();advance(3,'dazed');
    const afterFour=advance(4.1),afterFive=advance(1);
    setup();game.reducedMotion=true;advance(8,'warn');game.keys.add('KeyA');game.dodge();advance(.4);game.keys.clear();advance(3,'dazed');advance(.2);
    const stars=game.enemies[1].mesh.getObjectByName('pillar-stun-stars'),before=stars.children.map(s=>s.position.toArray());advance(.5);
    const reduced={visible:stars.visible,before,after:stars.children.map(s=>s.position.toArray()),lean:game.enemies[1].mesh.getObjectByName('body').rotation.z};
    game.reset();return {afterFour,afterFive,reduced,reset:{phase:game.enemies[1].phase,stars:stars.visible,pillars:game.chargePillars.length,hp:game.enemies[1].hp}};
  });
  assert.equal(lifecycle.afterFour.phase,'dazed');assert.notEqual(lifecycle.afterFive.phase,'dazed');assert.ok(!lifecycle.afterFive.cue.includes('晕住'));
  assert.ok(lifecycle.reduced.visible);assert.deepEqual(lifecycle.reduced.before,lifecycle.reduced.after);assert.equal(lifecycle.reduced.lean,0);
  assert.deepEqual(lifecycle.reset,{phase:'idle',stars:false,pillars:4,hp:2});
  assert.deepEqual(errors,[]);await writeFile(output+'/report.json',JSON.stringify({warning,lanePixels,impact,settled,starPixels,extended,paused,cases,approach,naturalImpact,lifecycle,errors},null,2));
  console.log('PASS live pillar bait/dodge, 5s vulnerable daze, four pillars, no bonus for walls/beds/hedges, natural recovery, pause/reset and reduced motion '+JSON.stringify({impact,extended,cases,lifecycle,errors}));
}finally {await browser.close();}
