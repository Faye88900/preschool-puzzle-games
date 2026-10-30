import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),errors=[],output='artifacts/models/dark-knight/animation';
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true,reducedMotion:'reduce'});
  page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:'export function startJourney(){return {arrive:async()=>{},dispose(){}}}'}));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async route=>{
    const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;return init.call(this)};MazeAdventure.prototype.tick=function(){};'});
  });
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5198/')+'?level=3&lang=zh');
  await page.locator('.game-loading').waitFor({state:'detached',timeout:90000});await page.locator('#primary').click();
  await page.evaluate(async()=>{
    const g=window.game,{at,walkable}=await import('/src/maze-map.ts');
    g.reducedMotion=false;g.wand=g.bridgeOpen=true;g.bridgeProgress=1;g.bridgeBody.setEnabled(false);
    window.nearKnight=(index,distance)=>{
      const e=g.enemies[index];g.body.setTranslation({x:e.mesh.position.x,y:.8,z:e.mesh.position.z+distance},true);
      g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.render(0);
    };
    window.knightFrames=(seconds,untilPhase,index=0)=>{
      const frames=[];
      for(let i=0;i<Math.ceil(seconds*60);i++){
        const dt=1/60;g.time+=dt;g.cooldown=Math.max(0,g.cooldown-dt);g.invulnerable=Math.max(0,g.invulnerable-dt);g.updateEnemies(dt);
        frames.push(g.enemies.slice(0,2).map(e=>{
          const k=e.mesh,foot=k.getObjectByName('foot1'),body=k.getObjectByName('body');
          if(![-.55,.55].every(x=>[-.55,.55].every(z=>walkable(k.position.x+x,k.position.z+z,g.bridgeOpen,g.key,g.exitOpen))))throw Error('Knight crossed a hedge');
          const p=g.body.translation();
          return {x:k.position.x,z:k.position.z,yaw:k.rotation.y,speed:e.speed,phase:e.phase,foot:foot.rotation.x,pitch:body.rotation.x,shield:k.getObjectByName('shield').rotation.x,
            distance:Math.hypot(k.position.x-p.x,k.position.z-p.z),home:k.position.distanceTo(e.home),hearts:g.hearts};
        }));
        if(untilPhase&&g.enemies[index].phase===untilPhase)break;
      }
      g.render(0);return frames;
    };
    window.knightSnapshot=index=>{
      const e=g.enemies[index],k=e.mesh;return {phase:e.phase,hp:e.hp,visible:k.visible,alert:e.alert,speed:e.speed,shield:k.getObjectByName('shield').rotation.x,
        eye:k.getObjectByName('eye1')?.scale.y,dazed:k.getObjectByName('dazed-eye1')?.visible,scale:k.getObjectByName('body').scale.x};
    };
    window.drawKnight=index=>{
      const e=g.enemies[index],p=e.mesh.position,a=e.mesh.rotation.y;
      g.windTime=0;g.render(0);
      const distance=3.3;g.camera.position.set(p.x-Math.sin(a-.35)*distance,1.65,p.z-Math.cos(a-.35)*distance);
      g.camera.lookAt(p.x,.65,p.z);g.camera.updateMatrixWorld();const playerVisible=g.player.visible;g.player.visible=false;
      g.updateUI();g.renderer.render(g.scene,g.camera);g.player.visible=playerVisible;
    };
    const p=at('spawn');g.body.setTranslation({x:p.x,y:.8,z:p.z},true);g.previous.copy(g.body.translation());
  });
  const patrol=await page.evaluate(()=>knightFrames(22));
  const paths=[0,1].map(index=>{
    const samples=patrol.map(f=>f[index]);let distance=0,forward=false,backward=false,maxTurn=0,maxFoot=0;
    for(let i=1;i<samples.length;i++){
      const a=samples[i-1],b=samples[i],dz=b.z-a.z;distance+=Math.hypot(b.x-a.x,dz);
      forward ||= dz>.001;backward ||= dz<-.001;maxTurn=Math.max(maxTurn,Math.abs(b.yaw-a.yaw));maxFoot=Math.max(maxFoot,Math.abs(b.foot-a.foot));
    }
    return {distance,forward,backward,maxTurn,maxFoot,span:Math.max(...samples.map(s=>s.z))-Math.min(...samples.map(s=>s.z))};
  });
  assert.ok(paths.every(p=>p.distance>4&&p.forward&&p.backward&&p.span>1.5&&p.maxTurn<.061&&p.maxFoot<.2),JSON.stringify(paths));
  assert.ok(await page.evaluate(()=>game.enemies[2].phase==='idle'&&game.enemies[2].mesh.position.distanceTo(game.enemies[2].home)===0),'Boss must not patrol');
  await page.evaluate(()=>drawKnight(0));await page.screenshot({path:`${output}/patrol.png`});
  await page.evaluate(()=>nearKnight(0,9.5));await page.evaluate(()=>knightFrames(1.2));
  const alert=await page.evaluate(()=>knightSnapshot(0));
  assert.ok(alert.phase==='chase'&&alert.alert>.98&&alert.speed>1&&alert.eye>1.1,JSON.stringify(alert));
  await page.evaluate(()=>drawKnight(0));await page.screenshot({path:`${output}/alert.png`});
  assert.equal(await page.locator('.knight-health').nth(0).getAttribute('aria-valuenow'),'1');
  assert.ok(await page.locator('.knight-health').nth(0).isVisible());
  const approach=await page.evaluate(()=>knightFrames(12,'warn'));
  assert.equal(await page.evaluate(()=>game.enemies[0].phase),'warn');
  assert.ok(approach.at(-1)[0].distance<=2.53&&approach.at(-1)[0].home>2.4,'Must approach within actual reach, beyond the old spawn leash');
  await page.evaluate(()=>knightFrames(.3));
  await page.evaluate(()=>drawKnight(0));await page.screenshot({path:`${output}/wind-up.png`});
  const attack=await page.evaluate(()=>knightFrames(2,'rest')),charge=attack.map(f=>f[0]).filter(f=>f.phase==='lunge');
  const speeds=charge.map(f=>f.speed);
  assert.ok(speeds.length>15&&Math.max(...speeds)>3.5&&speeds[0]<1&&speeds.at(-1)<1,JSON.stringify(speeds));
  assert.equal(await page.evaluate(()=>game.enemies[0].phase),'rest');
  assert.equal(await page.evaluate(()=>game.hearts),2,'A stationary player must actually be reachable by the attack');
  const maxPitch=Math.max(...attack.slice(1).map((f,i)=>Math.abs(f[0].pitch-attack[i][0].pitch)));
  assert.ok(maxPitch<.08,`Pose transition snapped: ${maxPitch}`);
  await page.evaluate(()=>drawKnight(0));await page.screenshot({path:`${output}/recover.png`});
  await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>game.enemies[0].hp),0);
  await page.evaluate(()=>knightFrames(.22));const defeated=await page.evaluate(()=>knightSnapshot(0));
  assert.ok(defeated.visible&&defeated.dazed,JSON.stringify(defeated));
  assert.equal(await page.evaluate(()=>game.enemies[1].mesh.getObjectByName('dazed-eye1').visible),false,'Hit expression must be local to the struck enemy');
  await page.evaluate(()=>drawKnight(0));await page.screenshot({path:`${output}/hit-expression.png`});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>game.render(0));await page.screenshot({path:`${output}/hit-mobile.png`});
  await page.evaluate(()=>knightFrames(.35));
  const ash=await page.evaluate(()=>{
    const k=game.enemies[0].mesh,other=game.enemies[1].mesh;
    return {body:k.getObjectByName('body').visible,scale:k.getObjectByName('body').scale.x,dust:k.getObjectByName('ash-dust').visible,
      opacity:k.getObjectByName('ash-dust').material.opacity,local:k.getObjectByName('helmet-dome').material!==other.getObjectByName('helmet-dome').material,
      otherColor:other.getObjectByName('helmet-dome').material.color.getHexString()};
  });
  assert.ok(ash.body&&Math.abs(ash.scale-1)<.001&&ash.dust&&ash.opacity>0&&ash.local&&ash.otherColor==='414956',JSON.stringify(ash));
  await page.setViewportSize({width:1280,height:800});await page.evaluate(()=>drawKnight(0));await page.screenshot({path:`${output}/ash-dissolve.png`});
  await page.evaluate(()=>knightFrames(.62));await page.evaluate(()=>drawKnight(0));await page.screenshot({path:`${output}/ash-dust.png`});
  await page.evaluate(()=>knightFrames(.1));assert.equal(await page.evaluate(()=>game.enemies[0].mesh.visible),false,'Defeated knight must retire after ash dissolves');
  assert.equal(await page.locator('.knight-health').nth(0).isVisible(),false);
  assert.equal(await page.evaluate(()=>game.keyMesh.visible),false,'Regular knight must not drop the boss key');
  await page.evaluate(()=>nearKnight(1,3.4));await page.evaluate(()=>{game.cooldown=0;knightFrames(.2);});
  await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>game.enemies[1].hp),2);
  assert.ok(await page.evaluate(()=>game.enemies[1].block>0),'Blocked wind must trigger a shield recoil');
  await page.evaluate(()=>knightFrames(.1));await page.evaluate(()=>drawKnight(1));await page.screenshot({path:`${output}/block.png`});
  await page.evaluate(()=>knightFrames(5,'rest',1));assert.equal(await page.evaluate(()=>game.enemies[1].phase),'rest');
  await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>game.enemies[1].hp),1);
  await page.evaluate(()=>knightFrames(.22));assert.equal(await page.evaluate(()=>knightSnapshot(1).dazed),true);
  assert.equal(await page.locator('.knight-health').nth(1).getAttribute('aria-valuenow'),'1');
  assert.equal(await page.locator('.knight-health').nth(1).locator('i').evaluate(e=>e.style.width),'50%');
  await page.evaluate(()=>knightFrames(.7));assert.equal(await page.evaluate(()=>knightSnapshot(1).dazed),false,'Survivor must recover its expression');
  await page.evaluate(()=>{game.reset();game.render(0);});
  assert.ok(await page.evaluate(()=>game.enemies.slice(0,2).every(e=>e.mesh.visible&&e.hp===e.maxHp&&e.mesh.getObjectByName('body').scale.x===1&&!e.mesh.getObjectByName('dazed-eye1').visible)));
  assert.ok(await page.evaluate(()=>game.enemies[0].mesh.getObjectByName('body').visible&&!game.enemies[0].mesh.getObjectByName('ash-dust').visible
    &&game.enemies[0].mesh.getObjectByName('helmet-dome').material===game.enemies[1].mesh.getObjectByName('helmet-dome').material),'Reset must restore original shared materials and remove ash');
  await page.evaluate(()=>{game.reducedMotion=true;knightFrames(4);});
  assert.ok(await page.evaluate(()=>game.enemies.slice(0,2).every(e=>e.mesh.getObjectByName('foot1').rotation.x===0&&e.mesh.getObjectByName('cape').rotation.x===0&&e.mesh.getObjectByName('body').rotation.z===0)));
  const behavior=await page.evaluate(async()=>{
    const g=game;
    const setup=(index,distance)=>{
      g.reset();g.reducedMotion=false;g.wand=g.bridgeOpen=true;g.bridgeProgress=1;g.bridgeBody.setEnabled(false);
      nearKnight(index,distance);
    };
    // Pull away during the tell: chase again instead of endlessly attacking empty ground.
    setup(0,2.4);knightFrames(5,'warn');nearKnight(0,6);
    const retreat=knightFrames(2);
    if(retreat.some(f=>f[0].phase==='lunge')||g.enemies[0].phase!=='chase')throw Error('Out-of-reach windup must become chase');
    // The committed aim must allow a real sidestep, with an exploitable recovery.
    setup(0,2.4);knightFrames(5,'warn');knightFrames(.8);
    const e=g.enemies[0],p=g.body.translation();g.body.setTranslation({x:p.x+2.4,y:.8,z:e.mesh.position.z+.2},true);
    const dodge=knightFrames(1.1,'rest');
    if(g.hearts!==3||e.phase!=='rest')throw Error('A late sidestep must dodge the committed attack');
    // Breaking sight keeps only the last seen position, then returns without seeing through hedges.
    setup(1,5);knightFrames(.8);const seen=g.enemies[1].lastSeen.clone();
    const hidden={x:33.6,y:.8,z:-3.1};g.body.setTranslation(hidden,true);g.previous.copy(hidden);
    if(g.clearSight(g.enemies[1].mesh.position))throw Error('Occlusion fixture must be behind a hedge');
    knightFrames(.5);
    if(g.enemies[1].lastSeen.distanceTo(seen)>0||g.enemies[1].phase!=='chase')throw Error('Lost target must use its last seen position');
    knightFrames(20);const returned=g.enemies[1].mesh.position.distanceTo(g.enemies[1].home);
    if(returned>1.3||g.enemies[1].phase!=='idle')throw Error('Lost target must return to patrol');
    // Route home around the expanded garden bend rather than cutting through its hedge.
    const k=g.enemies[1],home=k.home.clone();k.home.set(55,0,3);k.mesh.position.set(60,0,15);k.phase='return';k.speed=0;k.path=[];k.repath=0;
    const blocked=!g.knightClear(k.mesh.position,k.home);g.moveKnight(k,k.home,1.3,1/60);const routeLength=k.path.length;
    const corner=knightFrames(30);
    if(!blocked||routeLength<2||k.mesh.position.distanceTo(k.home)>1.3)throw Error('Return must navigate the corridor corner');
    k.home.copy(home);k.mesh.position.copy(home);
    // A player outside the encounter area cannot hold the enemy against an invisible attack wall.
    setup(0,7);knightFrames(2);nearKnight(0,14);const escaped=knightFrames(25);
    if(escaped.some(f=>f[0].phase==='warn'||f[0].phase==='lunge')||g.enemies[0].phase!=='idle')throw Error('Escape must disengage without futile attacks');
    // Checkpoint recovery clears all target/path memory and animation state.
    setup(0,7);knightFrames(2);g.hearts=1;g.invulnerable=0;g.hurt();
    if(!g.enemies.slice(0,2).every(e=>e.memory===0&&!e.path.length&&e.speed===0&&e.phase==='idle'))throw Error('Recovery kept stale chase state');
    return {retreatFrames:retreat.length,dodgeHearts:dodge.at(-1)[0].hearts,returned,routeLength,cornerFrames:corner.length,escapeFrames:escaped.length};
  });
  await page.evaluate(()=>{
    window.setupEncounter=()=>{
      const g=game;g.reset();g.reducedMotion=false;g.wand=g.bridgeOpen=true;g.bridgeProgress=1;g.bridgeBody.setEnabled(false);nearKnight(0,7);
    };
    window.playKnight=seconds=>{
      const g=game,start=g.body.translation();let minHearts=g.hearts;
      for(let i=0;i<Math.ceil(seconds*120);i++){g.step();minHearts=Math.min(minHearts,g.hearts);}
      g.render(0);const end=g.body.translation();return {frames:Math.ceil(seconds*120),minHearts,moved:Math.hypot(end.x-start.x,end.z-start.z),phase:g.enemies[0].phase};
    };
    setupEncounter();knightFrames(10,'warn');knightFrames(2,'lunge');
  });
  await page.keyboard.down('ArrowLeft');const inputDodge=await page.evaluate(()=>playKnight(.55));await page.keyboard.up('ArrowLeft');
  assert.ok(inputDodge.moved>2&&inputDodge.minHearts===3&&inputDodge.phase==='rest',JSON.stringify(inputDodge));
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>game.render(0));await page.screenshot({path:`${output}/dodge-mobile.png`});
  await page.setViewportSize({width:672,height:420});await page.evaluate(()=>setupEncounter());
  await mkdir(`${output}/encounter-frames`,{recursive:true});let framesAdvanced=0,minHearts=3;
  for(let i=0;i<34;i++){
    const result=await page.evaluate(()=>playKnight(.2));framesAdvanced+=result.frames;minHearts=Math.min(minHearts,result.minHearts);
    await page.screenshot({path:`${output}/encounter-frames/${String(i).padStart(3,'0')}.png`});
  }
  assert.equal(minHearts,2,'Physics-step encounter must reach and hit an idle player');
  const input={dodge:inputDodge,stationary:{framesAdvanced,minHearts}};
  await page.setViewportSize({width:720,height:520});await page.evaluate(()=>{setupEncounter();nearKnight(1,3.4);knightFrames(8,'rest',1);});
  await mkdir(`${output}/feedback-frames`,{recursive:true});let feedbackFrame=0;
  const captureFeedback=async(seconds)=>{
    for(let t=0;t<seconds;t+=.1){
      await page.evaluate(()=>{knightFrames(.1);drawKnight(1);});
      await page.screenshot({path:`${output}/feedback-frames/${String(feedbackFrame++).padStart(3,'0')}.png`});
    }
  };
  await captureFeedback(.4);await page.keyboard.press('KeyE');await captureFeedback(.8);
  assert.equal(await page.evaluate(()=>game.enemies[1].hp),1);
  await page.evaluate(()=>knightFrames(8,'rest',1));await captureFeedback(.4);await page.keyboard.press('KeyE');await captureFeedback(1.4);
  assert.equal(await page.evaluate(()=>game.enemies[1].mesh.visible),false);
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/report.json`,JSON.stringify({paths,alert,approach:approach.at(-1)[0],charge:speeds,maxPitch,defeated,ash,behavior,input,errors},null,2));
  console.log('PASS patrol, chase into real attack range, stationary hit, retreat/committed dodge, last-seen search, corner navigation, disengage/return, animation, shield, hit reaction, reset and keyboard/physics encounter',JSON.stringify({paths,maxPitch,behavior,input}));
}finally{await browser.close();}
