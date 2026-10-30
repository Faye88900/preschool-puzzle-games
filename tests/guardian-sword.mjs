import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output=process.env.GUARDIAN_OUTPUT||'artifacts/models/ember-guardian/production',errors=[];
try{
  await mkdir(output,{recursive:true});const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route(/\/assets\/maze-[^/]+\.js$/,async route=>{const response=await route.fetch(),body=await response.text(),name=body.match(/export\{([\w$]+) as MazeAdventure\}/)?.[1];assert.ok(name);await route.fulfill({response,body:body+`\nconst init=${name}.prototype.init;${name}.prototype.init=async function(){window.game=this;return init.call(this)};${name}.prototype.tick=function(){};`});});
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:4397/')+'?level=3&lang=zh');await page.locator('.journey-skip').click();await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  await page.evaluate(()=>{
    const g=game;
    window.swordPlace=(x,z)=>{g.body.setTranslation({x,y:.8,z},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.clearInput();g.render(0);};
    window.swordFrames=(n,until)=>{for(let i=0;i<n;i++){if(g.active())g.step();if(until&&g.enemies[2].phase===until)break;}g.render(0);};
    window.swordSetup=(attack=0)=>{g.reset();g.wand=g.bridgeOpen=g.treasure=true;g.bridgeBody.setEnabled(false);g.bridgeProgress=1;g.boatAtBossIsland=true;g.guardian.attack=attack;const e=g.enemies[2];swordPlace(e.home.x,e.home.z+2);g.checkpoint={x:165,z:-15};g.invulnerable=0;g.reducedMotion=false;g.step();g.render(0);};
    swordSetup();
  });
  assert.deepEqual(await page.evaluate(()=>game.enemies.map(e=>e.mesh.name)),['dark-knight','dark-knight','ember-guardian']);
  assert.deepEqual(await page.evaluate(()=>game.enemies.map(e=>e.mesh.scale.x)),[1,1,1.6]);
  const recoveryFacing=await page.evaluate(()=>{swordSetup();const g=game,e=g.enemies[2];g.hearts=1;g.invulnerable=g.dodgeProtection=0;e.mesh.position.x+=4;e.mesh.rotation.y=-1;g.hurt();const result={hearts:g.hearts,heading:e.mesh.rotation.y,distance:e.mesh.position.distanceTo(e.home)};swordSetup();return result;});
  assert.ok(recoveryFacing.hearts===3&&recoveryFacing.distance<.001&&Math.abs(Math.atan2(Math.sin(recoveryFacing.heading-Math.PI),Math.cos(recoveryFacing.heading-Math.PI)))<.0001,'Player death recovery must restore the central-facing Boss pose: '+JSON.stringify(recoveryFacing));
  await page.evaluate(()=>{const e=game.enemies[2];swordPlace(e.home.x+3,e.home.z+5);e.phase='idle';game.guardian.reset(e.mesh,true);game.render(0);});
  await page.screenshot({path:output+'/boss-scale.png'});
  await page.evaluate(()=>swordSetup());
  await page.locator('.boss-health').waitFor({state:'visible'});
  assert.equal(await page.locator('.boss-health').getAttribute('aria-valuenow'),'3');
  assert.equal(await page.locator('.boss-health small').textContent(),'3 / 3');
  await page.screenshot({path:output+'/boss-health-full.png'});
  assert.equal(await page.evaluate(()=>!!game.enemies[2].mesh.getObjectByName('shield')),false);
  assert.ok(await page.evaluate(()=>game.enemies[2].mesh.getObjectByName('sword-residual-flames').material.uniforms.uFlame.value.image.width===512));
  const reactions=[];
  for(const [attack,side] of [[0,0],[1,1],[2,0]]) {
    const reaction=await page.evaluate(({attack,side})=>{
      swordSetup(attack);swordFrames(600,'rest');const g=game,e=g.enemies[2],wrist=e.mesh.getObjectByName('wrist1'),start=e.mesh.position.toArray();
      swordPlace(e.home.x+side*2,e.home.z+1);g.cooldown=0;
      const before=wrist.quaternion.clone();g.blow();g.step();const entryAngle=before.angleTo(wrist.quaternion);
      swordFrames(11);const chest=e.mesh.getObjectByName('chest'),roll=chest.rotation.z,pitch=chest.rotation.x;
      const hp=e.hp;g.cooldown=0;g.blow();const repeatedHp=e.hp;
      return{attack,start,entryAngle,roll,pitch,yaw:chest.rotation.y,hp,repeatedHp,stars:g.guardian.root.getObjectByName('guardian-hit-stars').visible};
    },{attack,side});
    assert.ok(reaction.entryAngle<.15&&reaction.hp===2&&reaction.repeatedHp===2&&reaction.stars,JSON.stringify(reaction));
    assert.equal(await page.locator('.boss-health').getAttribute('aria-valuenow'),'2');
    await page.screenshot({path:`${output}/hurt-${attack}.png`});
    const recovery=await page.evaluate(start=>{swordFrames(78);const e=game.enemies[2];return{settled:Math.abs(e.mesh.getObjectByName('chest').rotation.x)<.025,distance:Math.hypot(e.mesh.position.x-start[0],e.mesh.position.z-start[2]),stars:game.guardian.root.getObjectByName('guardian-hit-stars').visible};},reaction.start);
    assert.ok(recovery.settled&&!recovery.stars&&(attack===2?recovery.distance<.001:recovery.distance>.15&&recovery.distance<.4),JSON.stringify(recovery));
    reactions.push({...reaction,...recovery});
  }
  assert.ok(reactions[0].pitch>.2&&reactions[1].yaw>.3&&reactions[2].pitch<-.3,'Previous boss attack must select the hit reaction');
  await page.evaluate(()=>swordSetup());
  await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>game.enemies[2].hp),3);assert.equal(await page.evaluate(()=>game.message),'bossSwordGuard');
  const attacks=[];
  for(const attack of [0,1,2]){
    await page.evaluate(attack=>swordSetup(attack),attack);
    assert.equal(await page.evaluate(()=>game.enemies[2].phase),'warn');
    await page.screenshot({path:`${output}/warning-${attack}.png`});
    const warning=await page.evaluate(()=>({visible:game.scene.getObjectByName('guardian-sword-warning').children[0].visible,aim:game.enemies[2].aim.toArray(),position:game.enemies[2].mesh.position.toArray()}));assert.ok(warning.visible);
    await page.evaluate(()=>swordFrames(300,'lunge'));assert.equal(await page.evaluate(()=>game.enemies[2].phase),'lunge');assert.equal(await page.evaluate(()=>game.hearts),3,'Warning cannot damage the player');
    await page.evaluate(()=>swordFrames(40));
    const impact=await page.evaluate(()=>{const trail=game.guardian.root.getObjectByName('weapon-smear');return{hp:game.hearts,range:trail.children[0].geometry.drawRange.count,position:game.enemies[2].mesh.position.toArray(),phase:game.enemies[2].phase};});
    assert.equal(impact.hp,2,'A real sword hit must cost exactly one heart');assert.ok(impact.range>0,'Imported Ember VFX must track the actual blade');
    await page.evaluate(()=>{game.invulnerable=0;game.render(0);});await page.screenshot({path:`${output}/strike-${attack}.png`});
    await page.evaluate(()=>swordFrames(90,'rest'));assert.equal(await page.evaluate(()=>game.enemies[2].phase),'rest');
    assert.equal(await page.evaluate(()=>game.hearts),2,'One swing must never damage twice');attacks.push({attack,warning,impact});
  }
  // Leaving the telegraph behind the boss must work after the aim has locked.
  await page.evaluate(()=>{swordSetup(2);swordFrames(300,'lunge');swordFrames(30);});
  assert.equal(await page.evaluate(()=>game.hearts),3,'Heavy slam must not hit before the sword descends');
  await page.evaluate(()=>swordFrames(12));
  assert.equal(await page.evaluate(()=>game.hearts),2,'Heavy slam must hit on the downward contact');
  const escapes=[];
  for(const attack of [0,1,2]){
    const result=await page.evaluate(attack=>{swordSetup(attack);const e=game.enemies[2],aim=e.aim.toArray();swordPlace(e.home.x,e.home.z-2);swordFrames(400,'rest');return{hearts:game.hearts,phase:e.phase,aim:e.aim.toArray(),oldAim:aim};},attack);
    assert.equal(result.hearts,3);assert.equal(result.phase,'rest');assert.deepEqual(result.aim,result.oldAim);escapes.push(result);
  }
  await page.evaluate(()=>{swordSetup();swordFrames(130);});await page.keyboard.down('KeyD');await page.keyboard.press('ShiftLeft');await page.evaluate(()=>swordFrames(130));await page.keyboard.up('KeyD');
  assert.equal(await page.evaluate(()=>game.hearts),3,'Actual dodge input must avoid the sword');
  await page.evaluate(()=>swordSetup());await page.locator('#pause').click();
  const paused=await page.evaluate(()=>({timer:game.enemies[2].timer,wrist:game.enemies[2].mesh.getObjectByName('wrist1').quaternion.toArray(),fireTime:game.enemies[2].mesh.getObjectByName('sword-residual-flames').material.uniforms.uTime.value,trail:game.guardian.root.getObjectByName('weapon-smear').children[0].geometry.drawRange.count}));
  await page.evaluate(()=>swordFrames(120));assert.deepEqual(await page.evaluate(()=>({timer:game.enemies[2].timer,wrist:game.enemies[2].mesh.getObjectByName('wrist1').quaternion.toArray(),fireTime:game.enemies[2].mesh.getObjectByName('sword-residual-flames').material.uniforms.uTime.value,trail:game.guardian.root.getObjectByName('weapon-smear').children[0].geometry.drawRange.count})),paused);await page.locator('#primary').click();
  await page.evaluate(()=>{swordSetup(1);game.reducedMotion=true;swordFrames(300,'lunge');swordFrames(40);});
  assert.equal(await page.evaluate(()=>game.guardian.root.getObjectByName('weapon-smear').visible),false);assert.equal(await page.evaluate(()=>game.hearts),2,'Reduced motion must preserve combat timing and damage');
  const sequence=await page.evaluate(()=>{swordSetup();game.invulnerable=1000;const phases=[];for(let i=0;i<4;i++){swordFrames(1000,'rest');phases.push(game.guardian.attack);while(game.enemies[2].phase==='rest')game.step();}return phases;});assert.deepEqual(sequence,[0,1,2,0],'Three sword attacks must cycle naturally');
  const pursuit=await page.evaluate(()=>{swordSetup();const g=game,e=g.enemies[2];e.phase='idle';swordPlace(e.home.x+10,e.home.z);swordFrames(480);swordPlace(e.home.x+16,e.home.z);swordFrames(1800,'warn');return{phase:e.phase,position:e.mesh.position.toArray(),distance:Math.hypot(e.mesh.position.x-g.body.translation().x,e.mesh.position.z-g.body.translation().z),homeDistance:e.mesh.position.distanceTo(e.home)};});
  assert.equal(pursuit.phase,'warn');assert.ok(pursuit.distance<2.4&&pursuit.homeDistance>8,'Boss must pursue into the expanded arena: '+JSON.stringify(pursuit));
  const retreat=await page.evaluate(()=>{
    swordSetup();const g=game,e=g.enemies[2];e.phase='idle';e.mesh.position.copy(e.home);e.mesh.position.x+=10;e.mesh.rotation.y=-Math.PI/2;
    const far={x:e.home.x+30,y:0,z:e.home.z+30};let maxSpeed=0,maxTurn=0,walked=false;
    for(let i=0;i<700;i++) {
      const p=e.mesh.position.clone(),angle=e.mesh.rotation.y;g.guardian.update(e,far,.02,i*.02,false,()=>true);
      maxSpeed=Math.max(maxSpeed,p.distanceTo(e.mesh.position)/.02);
      maxTurn=Math.max(maxTurn,Math.abs(Math.atan2(Math.sin(e.mesh.rotation.y-angle),Math.cos(e.mesh.rotation.y-angle)))/.02);
      if(p.distanceTo(e.mesh.position)>.001&&Math.abs(e.mesh.getObjectByName('knee1').rotation.x)>.05)walked=true;
    }
    const distance=e.mesh.position.distanceTo(e.home),end=e.mesh.position.clone();
    for(let i=0;i<20;i++)g.guardian.update(e,far,.02,14+i*.02,false,()=>true);
    const settled=end.distanceTo(e.mesh.position)<.00001;
    g.guardian.update(e,{x:e.home.x+5,y:0,z:e.home.z},.02,15,false,()=>true);
    const reacquired=e.phase==='chase',blockedAt=e.mesh.position.clone();
    g.guardian.update(e,far,.1,16,false,()=>false);const blocked=blockedAt.distanceTo(e.mesh.position)===0;
    g.reset();return{maxSpeed,maxTurn,walked,distance,settled,reacquired,blocked};
  });
  assert.ok(retreat.maxSpeed<=1.601&&retreat.maxTurn<=3.501&&retreat.walked&&retreat.distance<.03&&retreat.settled&&retreat.reacquired&&retreat.blocked,JSON.stringify(retreat));
  const returnVideo=await page.evaluate(async()=>{
    swordSetup();const g=game,e=g.enemies[2],camera=g.camera.clone();
    e.phase='idle';e.mesh.position.copy(e.home);e.mesh.position.x+=6;e.mesh.rotation.y=-Math.PI/2;
    camera.position.set(e.home.x+10,7,e.home.z+10);camera.lookAt(e.home.x+2.5,1,e.home.z);camera.zoom=1.5;camera.updateProjectionMatrix();
    const stream=g.renderer.domElement.captureStream(24),recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks=[];
    recorder.ondataavailable=e=>chunks.push(e.data);const done=new Promise(resolve=>recorder.onstop=resolve);recorder.start();
    for(let frame=0;frame<168;frame++) {
      g.guardian.update(e,{x:e.home.x+30,y:0,z:e.home.z+30},1/24,frame/24,false,(from,to)=>g.knightClear(from,to));
      g.renderer.render(g.scene,camera);await new Promise(resolve=>setTimeout(resolve,1000/24));
    }
    recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  });
  await writeFile(output+'/return-home.webm',Buffer.from(returnVideo));
  await page.evaluate(()=>{swordSetup();const e=game.enemies[2];e.mesh.position.x+=9;e.phase='idle';game.guardian.update(e,{x:220,y:0,z:20},.02,1,false,()=>true);game.render(0);});
  await page.screenshot({path:output+'/return-home.png'});
  await page.evaluate(()=>{swordSetup();const e=game.enemies[2];e.phase='idle';swordPlace(e.home.x+10,e.home.z);swordFrames(480);swordPlace(e.home.x+16,e.home.z);swordFrames(1800,'warn');});
  const displacedKey=await page.evaluate(()=>{const g=game,e=g.enemies[2];e.phase='rest';e.hp=1;g.cooldown=0;g.blow();const drop=g.keyMesh.position.clone(),distance=Math.hypot(drop.x-e.mesh.position.x,drop.z-e.mesh.position.z);swordPlace(drop.x,drop.z+1);g.interact();return{distance,collected:g.key};});
  assert.ok(displacedKey.distance<.001&&displacedKey.collected,'Key must drop at the chased boss and remain collectable');
  await page.evaluate(()=>{swordSetup();game.invulnerable=1000;});
  for(const hp of [2,1,0]){
    await page.evaluate(()=>swordFrames(600,'rest'));await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>game.enemies[2].hp),hp);
  }
  await page.evaluate(()=>game.render(0));
  assert.ok(await page.evaluate(()=>game.enemies[2].mesh.visible),'Defeated boss must play death before disappearing');
  assert.ok(await page.locator('.boss-health').isHidden(),'Defeated boss health must hide');
  await page.evaluate(()=>swordFrames(60));
  assert.ok(await page.evaluate(()=>game.enemies[2].mesh.visible&&game.enemies[2].mesh.getObjectByName('knee1').rotation.x<-.05),'Death must bend the knees');
  assert.ok(await page.evaluate(()=>{const m=game.enemies[2].mesh;return m.getObjectByName('ash-dust').visible&&!m.getObjectByName('sword-residual-flames').visible&&!m.getObjectByName('blade-glow').visible;}),'Boss must share knight ash death and extinguish the sword');
  await page.screenshot({path:output+'/death.png'});
  await page.evaluate(()=>swordFrames(200));
  assert.equal(await page.evaluate(()=>game.enemies[2].mesh.visible),false);
  await page.evaluate(()=>{const p=game.keyMesh.position;swordPlace(p.x,p.z+1);game.step();game.render(0);});await page.keyboard.press('KeyE');assert.ok(await page.evaluate(()=>game.key&&!game.keyMesh.visible&&!game.guardian.root.visible));
  await page.evaluate(()=>{game.hearts=1;game.invulnerable=0;game.hurt();});assert.ok(await page.evaluate(()=>game.key&&game.body.translation().x===165&&game.hearts===3));
  const reset=await page.evaluate(()=>{const counts=[game.world.bodies.len(),game.world.colliders.len()];swordSetup();swordFrames(300,'lunge');swordFrames(12);game.reset();return{counts,after:[game.world.bodies.len(),game.world.colliders.len()],hp:game.enemies[2].hp,key:game.key,attack:game.guardian.attack,range:game.guardian.root.getObjectByName('weapon-smear').children[0].geometry.drawRange.count,warning:game.scene.getObjectByName('guardian-sword-warning').children[0].visible,heading:game.enemies[2].mesh.rotation.y,homeDistance:game.enemies[2].mesh.position.distanceTo(game.enemies[2].home)};});
  assert.deepEqual(reset.counts,reset.after);assert.ok(reset.hp===3&&!reset.key&&reset.attack===0&&reset.range===0&&!reset.warning);
  assert.ok(reset.homeDistance<.001&&Math.abs(Math.atan2(Math.sin(reset.heading-Math.PI),Math.cos(reset.heading-Math.PI)))<.0001,'Reset must restore the central-facing Boss pose: '+JSON.stringify(reset));
  assert.ok(await page.evaluate(()=>{const m=game.enemies[2].mesh;return m.visible&&m.getObjectByName('body').visible&&!m.getObjectByName('ash-dust').visible&&m.getObjectByName('sword-residual-flames').visible;}),'Reset must restore a dissolved boss');
  await page.evaluate(()=>swordSetup());
  assert.equal(await page.locator('.boss-health').getAttribute('aria-valuenow'),'3');
  for(const [width,height]of [[390,844],[844,390]]) {
    await page.setViewportSize({width,height});await page.evaluate(()=>{game.resize();game.render(0);});
    const fit=await page.locator('.boss-health').evaluate(el=>{const r=el.getBoundingClientRect(),g=document.querySelector('.guidance').getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,guidance:g.bottom};});
    assert.ok(fit.left>=0&&fit.right<=width&&fit.bottom<height&&fit.top>=fit.guidance,JSON.stringify(fit));
    await page.screenshot({path:`${output}/boss-health-${width}.png`});
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{game.resize();swordSetup(2);});await page.screenshot({path:output+'/mobile-warning.png'});await page.evaluate(()=>swordFrames(400,'rest'));await page.locator('#dive').tap();assert.equal(await page.evaluate(()=>game.enemies[2].hp),2,'Touch wind must hit the exposed boss');
  const metrics=await page.evaluate(()=>({calls:game.renderer.info.render.calls,triangles:game.renderer.info.render.triangles,geometries:game.renderer.info.memory.geometries,textures:game.renderer.info.memory.textures}));
  assert.deepEqual(errors,[]);await writeFile(output+'/result.json',JSON.stringify({pass:true,recoveryFacing,reactions,attacks,escapes,sequence,pursuit,retreat,displacedKey,reset,metrics,errors},null,2));console.log('PASS production sword attacks, real hits, telegraphs, locked aim, escapes, keyboard dodge, guard/recovery, Ember VFX, pause, reduced motion, pursuit, key, recovery, reset and touch',JSON.stringify(metrics));
}finally{await browser.close();}






