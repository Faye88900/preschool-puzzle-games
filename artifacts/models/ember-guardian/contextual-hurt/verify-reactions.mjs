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
  await page.evaluate(()=>{const e=game.enemies[2];swordPlace(e.home.x+3,e.home.z+5);e.phase='idle';game.guardian.reset(e.mesh,true);game.render(0);});
  await page.screenshot({path:output+'/boss-scale.png'});
  await page.evaluate(()=>swordSetup());
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
    await page.screenshot({path:`${output}/hurt-${attack}.png`});
    const recovery=await page.evaluate(start=>{swordFrames(78);const e=game.enemies[2];return{settled:Math.abs(e.mesh.getObjectByName('chest').rotation.x)<.025,distance:Math.hypot(e.mesh.position.x-start[0],e.mesh.position.z-start[2]),stars:game.guardian.root.getObjectByName('guardian-hit-stars').visible};},reaction.start);
    assert.ok(recovery.settled&&!recovery.stars&&(attack===2?recovery.distance<.001:recovery.distance>.15&&recovery.distance<.4),JSON.stringify(recovery));
    reactions.push({...reaction,...recovery});
  }
  assert.ok(reactions[0].pitch>.2&&reactions[1].yaw>.3&&reactions[2].pitch<-.3,'Previous boss attack must select the hit reaction');
  await writeFile(output+'/reactions.json',JSON.stringify(reactions,null,2));
  assert.deepEqual(errors,[]);console.log('PASS contextual reactions and final star feedback');
}finally{await browser.close();}
