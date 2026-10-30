import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='artifacts/models/boss-arena-expanded',errors=[];
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route(/\/assets\/maze-[^/]+\.js$/,async route=>{
    const response=await route.fetch(),body=await response.text(),name=body.match(/export\{([\w$]+) as MazeAdventure\}/)?.[1];assert.ok(name);
    await route.fulfill({response,body:body+`\nconst init=${name}.prototype.init;${name}.prototype.init=async function(){window.game=this;return init.call(this)};${name}.prototype.tick=function(){};`});
  });
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:4397/')+'?level=3&lang=zh');
  await page.locator('.journey-skip').click();await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  const arena=await page.evaluate(()=>{
    const g=game;g.wand=g.treasure=true;g.enemies[0].hp=g.enemies[1].hp=0;g.enemies[2].mesh.visible=true;g.invulnerable=1000;
    window.arenaPlace=(x,z)=>{g.body.setTranslation({x,y:.85,z},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.clearInput();g.render(0);};
    window.arenaWalk=(x,z)=>{for(let i=0;i<900;i++){const p=g.body.translation();if(Math.hypot(x-p.x,z-p.z)<.2)break;g.keys.clear();if(Math.abs(x-p.x)>.1)g.keys.add(x>p.x?'KeyD':'KeyA');if(Math.abs(z-p.z)>.1)g.keys.add(z>p.z?'KeyS':'KeyW');g.step();}g.keys.clear();g.render(0);const p=g.body.translation();return{target:[x,z],distance:Math.hypot(x-p.x,z-p.z),y:p.y,grounded:g.grounded};};
    const physical=(x,z)=>{const hit=g.world.castRay({origin:{x,y:8,z},dir:{x:0,y:-1,z:0}},25,true);return hit?8-hit.timeOfImpact:null;};
    g.world.step();
    const floors=[[200,-40],[200,-9],[175,-40],[175,-9]].map(([x,z])=>physical(x,z));
    const walls=[[210,-25],[200,-47.5],[200,-2.5],[165,-35],[165,-7.5]].map(([x,z])=>physical(x,z));
    arenaPlace(165,-15);const reached=[[175,-15],[200,-15],[200,-40],[175,-40],[175,-9],[200,-9],[175,-9],[175,-15],[165,-15]].map(([x,z])=>arenaWalk(x,z));
    const edges=[];for(const[x,z,key,steps]of[[200,-25,'KeyD',200],[200,-40,'KeyW',160],[200,-9,'KeyS',160],[172,-35,'KeyA',160]]){arenaPlace(x,z);g.keys.add(key);for(let i=0;i<steps;i++)g.step();g.clearInput();edges.push({...g.body.translation(),grounded:g.grounded});}
    const ground=g.scene.getObjectByName('boss-island-ground');ground.geometry.computeBoundingBox();
    const sea=g.scene.getObjectByName('ferry-sea');
    return{floors,walls,reached,edges,groundWidth:ground.geometry.boundingBox.max.x-ground.geometry.boundingBox.min.x,groundDepth:ground.geometry.boundingBox.max.z-ground.geometry.boundingBox.min.z,bay:[sea.geometry.parameters.width,sea.geometry.parameters.height]};
  });
  assert.ok(arena.floors.every(y=>y!==null&&Math.abs(y)<.02),JSON.stringify(arena));
  assert.ok(arena.walls.every(y=>y!==null&&Math.abs(y-1.8)<.02),JSON.stringify(arena));
  assert.ok(arena.reached.every(p=>p.distance<.35&&p.y>.6&&p.grounded),JSON.stringify(arena.reached));
  assert.ok(arena.edges.every(p=>p.grounded&&p.y>.6)&&arena.edges[0].x<207.5&&arena.edges[1].z>-45&&arena.edges[2].z<-5&&arena.edges[3].x>167.5,JSON.stringify(arena.edges));
  assert.ok(arena.groundWidth>=49.9&&arena.groundDepth===50);assert.deepEqual(arena.bay,[90,70]);
  await page.evaluate(()=>{const g=game;arenaPlace(175,-15);g.scene.fog=null;g.camera.position.set(220,57,34);g.camera.lookAt(184,0,-24);g.renderer.render(g.scene,g.camera);});
  await page.screenshot({path:output+'/overview.png'});
  await page.evaluate(()=>{const g=game,e=g.enemies[2];e.mesh.position.copy(e.home);e.phase='idle';e.timer=0;arenaPlace(e.home.x,e.home.z+5.5);});
  await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>game.enemies[2].hp),3,'Shield still blocks wind');
  for(const hp of [2,1,0]){
    const exposed=await page.evaluate(()=>{for(let i=0;i<1600;i++){if(game.enemies[2].phase==='rest'&&game.cooldown===0)return true;game.step();}return false;});
    assert.ok(exposed,'Boss must naturally expose itself');await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>game.enemies[2].hp),hp);
  }
  await page.evaluate(()=>{const p=game.enemies[2].home;arenaPlace(p.x,p.z+1);});await page.keyboard.press('KeyE');
  assert.ok(await page.evaluate(()=>game.key&&!game.keyMesh.visible&&!game.shortcut.body.isEnabled()));
  const boat=await page.evaluate(()=>{
    const g=game;arenaPlace(100,-10);g.startBoatTrip(true);
    g.boat.position.set(159,-.8,-35);g.boatYaw=Math.PI/2;g.boatSpeed=9;g.keys.add('KeyW');for(let i=0;i<120;i++)g.updateBoat(1/60);g.keys.clear();
    const shore=g.boat.position.x<160.1;g.boat.position.copy(g.boatMooring(false));g.boatSpeed=0;
    const drive=toBoss=>{const p=g.boatMooring(toBoss);g.keys.add('KeyW');for(let i=0;i<2200;i++){const b=g.boat.position;if(Math.hypot(p.x-b.x,p.z-b.z)<1.5)break;g.boatYaw=Math.atan2(p.x-b.x,p.z-b.z);g.updateBoat(1/60);}g.keys.clear();g.dockBoat();return !g.boatTrip&&g.body.isEnabled()&&g.boatAtBossIsland===toBoss;};
    const arrived=drive(true);g.hearts=1;g.invulnerable=0;g.hurt();const recovery=g.boatAtBossIsland&&Math.hypot(g.body.translation().x-g.checkpoint.x,g.body.translation().z-g.checkpoint.z)<.01;
    g.startBoatTrip(false);const returned=drive(false);g.reset();return{shore,arrived,recovery,returned,reset:!g.key&&!g.boatTrip&&!g.boatAtBossIsland&&g.enemies[2].hp===3};
  });
  assert.ok(boat.shore&&boat.arrived&&boat.recovery&&boat.returned&&boat.reset,JSON.stringify(boat));
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{game.resize();arenaPlace(175,-15);});await page.screenshot({path:output+'/mobile.png'});
  assert.deepEqual(errors,[]);await writeFile(output+'/result.json',JSON.stringify({pass:true,arena,boat,errors},null,2));
  console.log('PASS production expanded arena floors, boundaries, traversal, dock return, boss shield/rest/key, ferry round trip, recovery, reset and mobile render',JSON.stringify({arena,boat}));
}finally{await browser.close();}
