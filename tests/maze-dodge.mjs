import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='test-results/maze-dodge',errors=[];
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true,reducedMotion:'no-preference'});
  page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:'export function startJourney(){return {arrive:async()=>{},dispose(){}}}'}));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+'\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;return init.call(this)};MazeAdventure.prototype.tick=function(){};'});});
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5207/')+'?level=3&lang=zh');
  await page.locator('.game-loading').waitFor({state:'detached'});
  async function resize(width,height) {
    await page.setViewportSize({width,height});
    await page.waitForFunction(()=>game.camera.aspect===innerWidth/innerHeight);
    const contrast=await page.evaluate(()=>{
      game.render(0);const gl=game.renderer.getContext(),c=game.renderer.domElement,pixels=new Uint8Array(c.width*c.height*4);
      gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      let min=255,max=0;for(let i=0;i<pixels.length;i+=16){const v=(pixels[i]+pixels[i+1]+pixels[i+2])/3;min=Math.min(min,v);max=Math.max(max,v);}return max-min;
    });
    assert.ok(contrast>35,'Resized canvas must show the game');
  }
  await page.evaluate(()=>game.dodge());assert.equal(await page.evaluate(()=>game.dodgeCooldown),0,'Ready screen blocks dodge');
  await page.locator('#primary').click();
  await page.evaluate(()=>{
    const g=game;
    window.place=(x,z)=>{g.body.setTranslation({x,y:.8,z},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.render(0);};
    window.advance=(seconds,until)=>{
      let minHearts=g.hearts,steps=0;
      for(let i=0;i<Math.ceil(seconds*120);i++){
        if(!g.active())break;g.step();steps++;minHearts=Math.min(minHearts,g.hearts);
        if(until&&g.enemies[1].phase===until)break;
      }
      g.render(0);return {steps,minHearts,phase:g.enemies[1].phase,hp:g.enemies[1].hp,hearts:g.hearts,position:g.body.translation()};
    };
    window.setup=()=>{
      g.reset();g.wand=g.bridgeOpen=true;g.bridgeProgress=1;g.bridgeBody.setEnabled(false);
      g.enemies[0].hp=0;g.enemies[0].timer=0;g.encounterGateProgress=1;g.encounterGate.body.setEnabled(false);
      const e=g.enemies[1];e.mesh.position.copy(e.home);e.mesh.rotation.y=Math.PI;
      place(e.home.x,e.home.z+4);advance(.4);
    };
    setup();
  });
  const warning=await page.evaluate(()=>{advance(8,'warn');return {timer:game.enemies[1].timer,aim:game.enemies[1].aim.toArray(),cue:document.querySelector('#cue').textContent,lane:game.chargeLane.visible,prompt:game.dodgeButton.classList.contains('action-required')};});
  assert.ok(warning.timer>1.9&&warning.lane&&warning.prompt&&warning.cue.includes('闪避'),JSON.stringify(warning));
  await page.screenshot({path:output+'/warning-desktop.png'});
  // Early input must work: the locked direction cannot follow the player after dodging.
  const start=await page.evaluate(()=>game.body.translation());await page.keyboard.press('ShiftLeft');
  const used=await page.evaluate(()=>({time:game.dodgeTime,cooldown:game.dodgeCooldown,protection:game.dodgeProtection,dir:game.dodgeDirection.toArray(),disabled:game.dodgeButton.disabled}));
  assert.ok(used.time>0&&used.protection>used.time&&used.disabled&&Math.abs(used.dir[0])>.99,JSON.stringify(used));
  await page.keyboard.press('ShiftLeft');assert.equal(await page.evaluate(()=>game.dodgeCooldown),used.cooldown,'Cooldown prevents repeated activation');
  const dash=await page.evaluate(()=>advance(.15));
  assert.ok(Math.abs(dash.position.x-start.x)>1&&dash.hearts===3);
  await page.screenshot({path:output+'/dodge-desktop.png'});
  const first=await page.evaluate(()=>advance(4,'rest'));
  assert.equal(first.hearts,3,'Early one-button dodge must avoid the committed attack');assert.equal(first.phase,'rest');
  assert.deepEqual(await page.evaluate(()=>game.enemies[1].aim.toArray()),warning.aim,'Aim remains fixed through warning and charge');
  assert.ok(await page.evaluate(()=>document.querySelector('#dive').classList.contains('action-required')&&document.querySelector('#cue').textContent.includes('吹风')));
  await page.screenshot({path:output+'/counter-desktop.png'});
  await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>game.enemies[1].hp),1);
  // Complete the next attack cycle with touch and no position/phase manipulation.
  const secondWarning=await page.evaluate(()=>advance(12,'warn'));assert.equal(secondWarning.phase,'warn',JSON.stringify(secondWarning));
  assert.ok(await page.evaluate(()=>game.enemies[1].timer<=1.4&&game.enemies[1].timer>1.3),'Later tells use the normal warning duration');
  await resize(390,844);
  await page.screenshot({path:output+'/warning-mobile.png'});
  await page.locator('#dodge').tap();const second=await page.evaluate(()=>advance(3,'rest'));
  assert.equal(second.hearts,3);assert.equal(second.phase,'rest');
  await page.locator('#dive').tap();assert.equal(await page.evaluate(()=>game.enemies[1].hp),0,'Keyboard + touch can defeat the second knight without taking damage');
  assert.equal(await page.evaluate(()=>game.message),'findCrystal','Defeat must replace the counter prompt with the next objective');
  const layout=[];
  for(const [width,height] of [[320,568],[390,844],[844,390],[1280,800]]){
    await resize(width,height);
    const bounds=await page.evaluate(()=>['stick','hint','jump','dodge','dive'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,x:r.x,y:r.y,w:r.width,h:r.height};}));
    for(const b of bounds)assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=width&&b.y+b.h<=height&&b.w>=44&&b.h>=44,JSON.stringify({width,height,b}));
    for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++){const a=bounds[i],b=bounds[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,JSON.stringify({width,height,a,b}));}
    layout.push({width,height,bounds});await page.screenshot({path:`${output}/controls-${width}x${height}.png`});
  }
  // A stationary player remains vulnerable; retreating during the tell still yields recovery.
  const stationary=await page.evaluate(()=>{setup();advance(8,'warn');return advance(4,'rest');});
  assert.equal(stationary.hearts,2,'Doing nothing must still get hit');
  await page.evaluate(()=>{setup();advance(8,'warn');});
  await page.keyboard.down('KeyS');await page.evaluate(()=>advance(.8));await page.keyboard.up('KeyS');
  const retreat=await page.evaluate(()=>advance(4,'rest'));assert.equal(retreat.phase,'rest');assert.equal(retreat.hearts,3,'A successful retreat cannot cancel the counter window');
  // Late invulnerability works even when sideways travel is obstructed.
  await page.evaluate(()=>{setup();advance(8,'warn');advance(3,'lunge');});
  await page.keyboard.press('ShiftRight');
  const late=await page.evaluate(()=>advance(1.5,'rest'));assert.equal(late.hearts,3);assert.equal(late.phase,'rest');
  await page.evaluate(()=>{
    setup();game.enemies.forEach(e=>e.hp=0);place(25,0);
    window.traceDodge=seconds=>{
      const g=game,draw=g.renderer.render,frames=[];g.renderer.render=()=>{};
      try {for(let i=0;i<Math.ceil(seconds*120);i++){
        g.step();g.render(1/120);const p=g.body.translation(),v=g.body.linvel();
        frames.push({t:(i+1)/120,x:p.x,z:p.z,vx:v.x,vz:v.z,lean:g.player.getObjectByName('avatar').rotation.z,remaining:g.dodgeTime});
      }}finally{g.renderer.render=draw;g.render(0);}return frames;
    };
  });
  await page.keyboard.down('KeyD');await page.keyboard.press('ShiftLeft');await page.keyboard.up('KeyD');
  const motion=await page.evaluate(()=>traceDodge(.8));
  const maxSpeedChange=Math.max(...motion.map((f,i)=>Math.abs(f.vx-(motion[i-1]?.vx??0))));
  const maxLeanChange=Math.max(...motion.map((f,i)=>Math.abs(f.lean-(motion[i-1]?.lean??0))));
  assert.ok(motion[5].x>25.08&&motion[0].vx<1,'Dodge must respond within 50ms while easing into speed');
  assert.ok(maxSpeedChange<2.1&&maxLeanChange<.07,JSON.stringify({maxSpeedChange,maxLeanChange}));
  assert.ok(motion.at(-1).x>28&&motion.at(-1).x<28.3,'Smoothing must preserve a useful dodge distance');
  assert.ok(Math.abs(motion.at(-1).x-motion[49].x)<.01&&Math.abs(motion[47].vx)<.15,'Idle dodge must settle without drifting after its easing');
  await page.evaluate(()=>{setup();game.enemies.forEach(e=>e.hp=0);place(25,0);});
  await page.keyboard.down('KeyD');await page.evaluate(()=>advance(.5));
  const runSpeed=await page.evaluate(()=>game.body.linvel().x);await page.keyboard.press('ShiftLeft');
  const handoff=await page.evaluate(()=>traceDodge(.6));await page.keyboard.up('KeyD');
  assert.ok(Math.abs(handoff[0].vx-runSpeed)<.5,'Starting a dodge while running cannot stop the player first');
  assert.ok(handoff.slice(40).every(f=>f.vx>6.9)&&Math.abs(handoff[47].vx-handoff[48].vx)<.15,'Dodge must blend continuously back into held movement');
  const protection=await page.evaluate(()=>{
    setup();game.dodge();const before=game.hearts;game.hurt();const during=game.hearts;
    advance(.6);game.invulnerable=0;game.hurt();return {before,during,after:game.hearts};
  });
  assert.deepEqual(protection,{before:3,during:3,after:2},'Invulnerability must end rather than becoming permanent');
  await page.evaluate(()=>{setup();game.enemies.forEach(e=>e.hp=0);place(25,0);});
  await page.keyboard.down('KeyA');await page.keyboard.press('ShiftLeft');const directional=await page.evaluate(()=>advance(.45));await page.keyboard.up('KeyA');
  assert.ok(directional.position.x<22&&Math.abs(directional.position.z)<.01,'Held direction overrides automatic sidestep');
  await page.evaluate(()=>{game.dodgeCooldown=0;game.render(0);document.querySelector('#dodge').click();});
  assert.ok(await page.evaluate(()=>game.dodgeCooldown>0),'Assistive button activation works without a pointer');
  await page.evaluate(()=>{setup();game.enemies.forEach(e=>e.hp=0);place(25,0);});
  const touch=await page.evaluate(()=>{const stick=document.querySelector('#stick').getBoundingClientRect(),button=document.querySelector('#dodge').getBoundingClientRect();return {stick:{x:stick.x+stick.width/2-25,y:stick.y+stick.height/2,id:1},button:{x:button.x+button.width/2,y:button.y+button.height/2,id:2}};});
  const input=await page.context().newCDPSession(page);
  await input.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch.stick]});
  assert.ok(await page.evaluate(()=>game.stick.x<-.5),'First finger controls the joystick');
  await input.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch.stick,touch.button]});
  assert.ok(await page.evaluate(()=>game.dodgeTime>0&&game.dodgeDirection.x<-.99),'Second finger activates dodge in the held joystick direction');
  const multiTouch=await page.evaluate(()=>advance(.45));
  await input.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await input.detach();
  assert.ok(multiTouch.position.x<22&&await page.evaluate(()=>game.stick.x===0&&game.stick.y===0&&!game.dodgeButton.classList.contains('pressed')),'Releasing both fingers clears the joystick and pressed state');
  const obstacles=await page.evaluate(()=>{
    const g=game;setup();g.enemies.forEach(e=>e.hp=0);
    place(31.5,-3.5);g.keys.add('KeyD');g.dodge();advance(.6);g.keys.clear();const hedge=g.body.translation();
    g.dodgeCooldown=0;g.bridgeOpen=false;g.bridgeBody.setEnabled(true);place(16,40);g.keys.add('KeyD');g.dodge();advance(.6);g.keys.clear();const bridge=g.body.translation();g.bridgeOpen=true;g.bridgeBody.setEnabled(false);
    const gatePosition=g.encounterGate.body.translation();g.dodgeCooldown=0;place(gatePosition.x,gatePosition.z+1.3);g.enemies[0].hp=1;g.encounterGateProgress=0;g.encounterGate.body.setEnabled(true);g.keys.add('KeyW');g.dodge();advance(.6);g.keys.clear();const gate=g.body.translation();
    g.enemies[0].hp=0;g.encounterGateProgress=1;g.encounterGate.body.setEnabled(false);g.dodgeCooldown=0;place(100,-10);g.keys.add('KeyD');g.dodge();advance(.6);g.keys.clear();const dock=g.body.translation();
    g.dodgeCooldown=0;g.keys.add('KeyW');g.dodge();advance(.6);g.keys.clear();const water=g.body.translation();
    return {hedge,bridge,gate,dock,water};
  });
  assert.ok(obstacles.hedge.x<32.2&&obstacles.bridge.x<17.2&&obstacles.gate.z>28.3&&obstacles.dock.x<102.1&&obstacles.water.z>-11.3,JSON.stringify(obstacles));
  const lifecycle=await page.evaluate(()=>{
    const g=game;setup();g.dodge();g.pause();const before=[g.dodgeTime,g.dodgeCooldown,g.dodgeProtection];advance(1);g.dodge();const paused=[g.dodgeTime,g.dodgeCooldown,g.dodgeProtection];
    g.pause();advance(.1);const resumed=g.dodgeTime;
    g.reset();return {before,paused,resumed,reset:[g.dodgeTime,g.dodgeCooldown,g.dodgeProtection,g.dodgeTaught],lane:g.chargeLane.visible,aura:g.dodgeAura.visible};
  });
  assert.deepEqual(lifecycle.paused,lifecycle.before);assert.ok(lifecycle.resumed<lifecycle.before[0]);assert.deepEqual(lifecycle.reset,[0,0,0,false]);assert.ok(!lifecycle.lane&&!lifecycle.aura);
  const blocked=await page.evaluate(()=>{
    const g=game;setup();g.talk('scoutName',['scoutHint']);g.dodge();const dialogue=g.dodgeCooldown;g.closeDialogue();
    g.treasure=true;place(100,-10);g.startBoatTrip(true);g.dodge();return {dialogue,boat:g.dodgeCooldown,trip:!!g.boatTrip};
  });
  assert.deepEqual(blocked,{dialogue:0,boat:0,trip:true},'Dialogue and sailing block dodge');
  await page.evaluate(()=>{setup();game.reducedMotion=true;advance(8,'warn');});await page.keyboard.press('ShiftLeft');
  const reduced=await page.evaluate(()=>{advance(.15);return {lean:game.player.getObjectByName('avatar').rotation.z,aura:game.dodgeAura.visible,hearts:advance(4,'rest').hearts};});
  assert.equal(reduced.lean,0);assert.ok(reduced.aura&&reduced.hearts===3,'Reduced motion preserves gameplay and static protection feedback');
  assert.deepEqual(errors,[]);
  const report={warning,used,first,second,layout,stationary,retreat,late,motion,handoff,maxSpeedChange,maxLeanChange,protection,directional,multiTouch,obstacles,lifecycle,blocked,reduced,errors};
  await writeFile(output+'/report.json',JSON.stringify(report,null,2));
  console.log('PASS eased dodge, running handoff, keyboard/touch no-damage encounter, warning/counter cues, cooldown, collisions, pause/reset/dialogue/ferry, reduced motion '+JSON.stringify({maxSpeedChange,maxLeanChange,first,second,stationary,retreat,late,obstacles,lifecycle,errors}));
} finally {await browser.close();}
