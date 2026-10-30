import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='test-results/shield-courtyard',errors=[];
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:false,reducedMotion:'reduce'});
  page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:'export function startJourney(){return {arrive:async()=>{},dispose(){}}}'}));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+'\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;return init.call(this)};MazeAdventure.prototype.tick=function(){};'});});
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5207/')+'?level=3&lang=zh');
  await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  await page.evaluate(()=>{
    const g=game;g.wand=g.bridgeOpen=true;g.bridgeProgress=1;g.bridgeBody.setEnabled(false);
    g.enemies[0].hp=0;g.encounterGateProgress=1;g.encounterGate.body.setEnabled(false);
    g.enemies[1].mesh.rotation.y=Math.PI;g.say('scoutHint');
    window.place=(x,z)=>{g.body.setTranslation({x,y:.8,z},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.render(0);};
    place(25,9);
  });
  const views=[];
  for(const [width,height,z,name] of [[1280,800,9,'approach-pc'],[1280,800,4,'combat-pc'],[390,844,9,'narrow-pc'],[844,390,9,'landscape-pc']]) {
    await page.setViewportSize({width,height});
    const result=await page.evaluate(async({z})=>{
      const g=game,T=await import('/node_modules/three/build/three.module.js');place(25,z);g.resize();g.render(0);
      const target=g.enemies[1].mesh.position.clone().add(new T.Vector3(0,.8,0)),direction=target.clone().sub(g.camera.position);
      const ray=new T.Raycaster(g.camera.position,direction.clone().normalize(),0,direction.length());
      const entry=g.scene.getObjectByName('wind-garden-courtyard-entrance');
      return {coarse:matchMedia('(pointer:coarse)').matches,touchVisible:getComputedStyle(document.querySelector('.touch-controls')).display!=='none',
        entryBlocksKnight:ray.intersectObject(entry,true).length>0,calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles};
    },{z});
    assert.ok(!result.coarse&&!result.touchVisible,'Mouse PC must hide touch controls at every width');
    assert.equal(result.entryBlocksKnight,false,'Entry arch must not hide the knight '+name);
    views.push({name,width,height,...result});await page.screenshot({path:output+'/'+name+'.png'});
  }
  await page.setViewportSize({width:1280,height:800});
  const states=await page.evaluate(()=>{
    const g=game,trail=g.scene.getObjectByName('courtyard-victory-leaves'),crest=g.scene.getObjectByName('courtyard-crest-veins').children[0].material;
    const initial={visible:trail.visible,light:crest.emissiveIntensity};g.enemies[1].hp=0;g.enemies[1].timer=0;g.updateEnemies(0);g.say('findCrystal');place(29,5);g.resize();g.render(0);
    return {initial,cleared:{visible:trail.visible,light:crest.emissiveIntensity},floor:g.scene.getObjectByName('courtyard-wind-mosaic').material.map.image.width};
  });
  assert.deepEqual(states.initial,{visible:false,light:.04});assert.deepEqual(states.cleared,{visible:true,light:.65});assert.equal(states.floor,1024);
  await page.screenshot({path:output+'/victory-pc.png'});
  const collisions=await page.evaluate(()=>{
    const g=game;g.enemies.forEach(e=>e.hp=0);g.invulnerable=999;
    const walk=(x,z,key)=>{place(x,z);g.keys.add(key);for(let i=0;i<120;i++)g.step();g.keys.clear();return g.body.translation();};
    const wall=walk(25,-5,'KeyW'),bed=walk(29.5,-5.25,'KeyD'),entry=walk(27.5,14,'KeyW'),entranceWalk=walk(25,14,'KeyW');
    return {wall,bed,entry,entranceWalk,center:g.knightClear({x:21.5,z:4},{x:28.5,z:4}),exit:g.knightClear({x:25,z:0},{x:38,z:0})};
  });
  assert.ok(collisions.wall.z>-6.8&&collisions.wall.z<-5.7,JSON.stringify(collisions));
  assert.ok(collisions.bed.x<30.3&&collisions.entry.z>12.7&&collisions.center&&collisions.exit,JSON.stringify(collisions));
  assert.ok(Math.abs(collisions.entranceWalk.x-25)<.02&&collisions.entranceWalk.z<8,'Straight entry must stay clear on the path centre');
  const reset=await page.evaluate(()=>{game.reset();game.render(0);return {trail:game.scene.getObjectByName('courtyard-victory-leaves').visible,light:game.scene.getObjectByName('courtyard-crest-veins').children[0].material.emissiveIntensity};});
  assert.deepEqual(reset,{trail:false,light:.04});assert.deepEqual(errors,[]);
  await writeFile(output+'/report.json',JSON.stringify({views,states,collisions,reset,errors},null,2));
  console.log('PASS courtyard visibility, mouse UI, victory/reset, edge collisions and clear dodge/exit lanes '+JSON.stringify({views,states,collisions,reset,errors}));
} finally {await browser.close();}
