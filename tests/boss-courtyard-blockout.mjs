import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='artifacts/models/boss-courtyard-blockout',errors=[];
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route(/\/assets\/maze-[^/]+\.js$/,async route=>{
    const response=await route.fetch(),body=await response.text(),name=body.match(/export\{([\w$]+) as MazeAdventure\}/)?.[1];assert.ok(name);
    await route.fulfill({response,body:body+`\nconst init=${name}.prototype.init;${name}.prototype.init=async function(){window.game=this;return init.call(this)};${name}.prototype.tick=function(){};`});
  });
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:4397/')+'?level=3&lang=zh');
  await page.locator('.journey-skip').click();await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  const layout=await page.evaluate(()=>{
    const g=game;g.wand=g.treasure=true;g.enemies[0].hp=g.enemies[1].hp=0;g.invulnerable=1000;
    window.courtyardPlace=(x,z)=>{
      g.body.setTranslation({x,y:.85,z},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.clearInput();g.render(0);
    };
    g.world.step();
    const root=g.scene.getObjectByName('boss-courtyard-blockout');
    let finite=true,triangles=0;root.traverse(m=>{if(m.isMesh){finite&&=Array.from(m.geometry.attributes.position.array).every(Number.isFinite);triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;}});
    const open=[];for(let x=176;x<=198;x+=2)for(let z=-36;z<=-14;z+=2){
      if(Math.hypot(x-187.5,z+25)>12)continue;
      const hit=g.world.castRay({origin:{x,y:6,z},dir:{x:0,y:-1,z:0}},8,true,undefined,undefined,undefined,g.body);
      open.push(hit?6-hit.timeOfImpact:null);
    }
    const bases=[[169.5,-19],[205,-11],[206,-38]].map(([x,z])=>{
      const hit=g.world.castRay({origin:{x,y:8,z},dir:{x:0,y:-1,z:0}},10,true,undefined,undefined,undefined,g.body);
      return hit?8-hit.timeOfImpact:null;
    });
    const floor=g.scene.getObjectByName('boss-courtyard-wind-mosaic'),earlier=g.scene.getObjectByName('courtyard-wind-mosaic');
    const center=floor.getWorldPosition(g.cameraGoal.clone()),sword=g.scene.getObjectByName('boss-blockout-sword').getWorldPosition(g.cameraGoal.clone());
    const names=[];root.traverse(c=>{if(c.name.startsWith('boss-blockout-'))names.push(c.name);});
    const vegetation=g.scene.getObjectByName('courtyard-vegetation');let vegetationTriangles=0,vegetationMeshes=0;
    vegetation?.traverse(m=>{if(m.isMesh){vegetationTriangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;vegetationMeshes++;}});
    return {stage:root.userData.stage,names,finite,triangles,open,bases,
      vegetation:{zones:vegetation?.children.length,placements:vegetation?.userData.placements.length,triangles:vegetationTriangles,meshes:vegetationMeshes},
      statues:root.children.filter(c=>c.name.startsWith('boss-blockout-statue-')).map(c=>c.children[0]?.name),
      chimes:[0,1].map(i=>root.getObjectByName('boss-blockout-chime-'+i)?.getObjectByName('leaf-chime-post')?.name),
      rack:root.getObjectByName('boss-blockout-weapon-rack')?.getObjectByName('leaf-weapon-rack')?.name,
      camp:root.getObjectByName('boss-blockout-campfire')?.getObjectByName('campfire-remains')?.name,
      stele:root.getObjectByName('boss-blockout-marker')?.getObjectByName('leaf-emblem-stele')?.name,
      pots:root.getObjectByName('boss-blockout-pots')?.getObjectByName('courtyard-garden-props')?.name,
      rocks:root.getObjectByName('boss-blockout-floating-rocks')?.children.map(c=>c.name),
      composition:{center:center.toArray(),sword:sword.toArray(),boss:g.enemies[2].home.toArray(),heading:g.enemies[2].mesh.rotation.y},
      floor:{shared:floor.material.map===g.courtyardFloor&&floor.material.map===earlier.material.map,
        width:floor.material.map.image.width,uvs:floor.geometry.attributes.uv.count,vertices:floor.geometry.attributes.position.count,
        radius:floor.geometry.parameters.radius,repeat:floor.material.map.repeat.toArray(),offset:floor.material.map.offset.toArray()}};
  });
  // Authored rocks replace the last three cuboids; vegetation has its own independent budget.
  assert.equal(layout.stage,'blockout');assert.ok(layout.finite&&layout.triangles<160000,JSON.stringify({finite:layout.finite,triangles:layout.triangles}));
  assert.deepEqual(layout.statues,['leaf-guardian-statue-intact']);
  assert.deepEqual(layout.chimes,['leaf-chime-post','leaf-chime-post']);
  assert.equal(layout.rack,'leaf-weapon-rack');
  assert.equal(layout.camp,'campfire-remains');
  assert.equal(layout.stele,'leaf-emblem-stele');
  assert.equal(layout.pots,'courtyard-garden-props');
  assert.deepEqual(layout.rocks,['floating-rock-c','floating-rock-b','floating-rock-a']);
  assert.ok(layout.vegetation.zones===4&&layout.vegetation.placements>100&&layout.vegetation.triangles<95000&&layout.vegetation.meshes<=16,JSON.stringify(layout.vegetation));
  assert.ok(!layout.names.includes('boss-blockout-statue-1'));
  for(const name of ['sword','roots','statue-0','chime-0','chime-1','water-channel-0','water-channel-1','water-channel-2','waterfall','weapon-rack','campfire','marker','pots','floating-rocks'])assert.ok(layout.names.includes('boss-blockout-'+name),name);
  assert.ok(layout.open.length>70&&layout.open.every(y=>y!==null&&Math.abs(y)<.03),'Central combat floor must remain clear: '+JSON.stringify(layout.open));
  assert.ok(layout.bases.every(y=>y>1),'Prop bases must have physical collision');
  assert.ok(layout.floor.shared&&layout.floor.width>0&&layout.floor.uvs===layout.floor.vertices,'Reuse the loaded courtyard texture and retain its mapping');
  assert.equal(layout.floor.radius,15);assert.deepEqual(layout.floor.repeat,[1,1]);assert.deepEqual(layout.floor.offset,[0,0]);
  const composition=layout.composition;
  assert.ok(Math.abs(composition.boss[0]-composition.center[0])<.01,'Boss must stand on the mosaic rear centerline');
  assert.ok(composition.boss[2]<composition.center[2]-6&&composition.boss[2]>composition.center[2]-12);
  assert.ok(composition.sword[0]>composition.boss[0]+3&&composition.sword[2]<composition.boss[2]-5,'Sword must frame the boss from behind-right');
  assert.equal(composition.heading,Math.PI,'Boss starts facing the central combat space');
  const routes=await page.evaluate(()=>{
    const g=game,targets=[[180,-15],[198,-15],[198,-36],[176,-36],[176,-15],[165,-15]],results=[];
    courtyardPlace(165,-15);
    for(const [x,z]of targets){
      for(let i=0;i<900;i++){
        const p=g.body.translation();if(Math.hypot(x-p.x,z-p.z)<.2)break;
        g.keys.clear();if(Math.abs(x-p.x)>.1)g.keys.add(x>p.x?'KeyD':'KeyA');if(Math.abs(z-p.z)>.1)g.keys.add(z>p.z?'KeyS':'KeyW');g.step();
      }
      g.clearInput();const p=g.body.translation();results.push({target:[x,z],distance:Math.hypot(x-p.x,z-p.z),y:p.y});
    }
    return results;
  });
  assert.ok(routes.every(r=>r.distance<.35&&r.y>.6),JSON.stringify(routes));
  const dodges=await page.evaluate(()=>{
    const g=game,results=[];
    for(const keys of [['KeyW'],['KeyS'],['KeyA'],['KeyD'],['KeyW','KeyA'],['KeyW','KeyD'],['KeyS','KeyA'],['KeyS','KeyD']]){
      courtyardPlace(187.5,-25);g.dodgeCooldown=0;g.dodgeTime=0;for(const key of keys)g.keys.add(key);g.dodge();
      for(let i=0;i<52;i++)g.step();g.clearInput();const p=g.body.translation();results.push({distance:Math.hypot(p.x-187.5,p.z+25),y:p.y});
    }
    return results;
  });
  assert.ok(dodges.every(d=>d.distance>2&&d.distance<5&&d.y>.6),JSON.stringify(dodges));
  const collision=await page.evaluate(()=>{
    const g=game;courtyardPlace(173,-19);g.keys.add('KeyA');for(let i=0;i<120;i++)g.step();g.clearInput();return {...g.body.translation()};
  });
  assert.ok(collision.x>170.7&&collision.x<171.5&&collision.y>.6,JSON.stringify(collision));
  await page.evaluate(()=>courtyardPlace(165,-15));await page.screenshot({path:output+'/desktop-entry.png'});
  const diagnostics=await page.evaluate(()=>{
    const g=game;courtyardPlace(g.enemies[2].home.x,g.enemies[2].home.z+6);g.renderer.render(g.scene,g.camera);
    const withBlockout={...g.renderer.info.render},root=g.scene.getObjectByName('boss-courtyard-blockout');root.visible=false;g.renderer.render(g.scene,g.camera);
    const withoutBlockout={...g.renderer.info.render};root.visible=true;g.renderer.render(g.scene,g.camera);
    return {withBlockout,withoutBlockout,geometries:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures};
  });
  assert.ok(diagnostics.withBlockout.calls>diagnostics.withoutBlockout.calls);
  assert.ok(diagnostics.withBlockout.calls-diagnostics.withoutBlockout.calls<130);
  await page.screenshot({path:output+'/desktop-combat.png'});
  const warning=await page.evaluate(()=>{
    const g=game,e=g.enemies[2];e.mesh.position.copy(e.home);e.phase='idle';g.guardian.reset(e.mesh,true);g.guardian.attack=1;
    courtyardPlace(e.home.x,e.home.z+2);g.step();g.render(0);
    const marker=g.scene.getObjectByName('guardian-sword-warning'),visible=marker.children[0].visible;
    const gl=g.renderer.getContext(),size={x:gl.drawingBufferWidth,y:gl.drawingBufferHeight},before=new Uint8Array(size.x*size.y*4),after=new Uint8Array(before.length);
    marker.visible=false;g.renderer.render(g.scene,g.camera);gl.readPixels(0,0,size.x,size.y,gl.RGBA,gl.UNSIGNED_BYTE,before);
    marker.visible=true;g.renderer.render(g.scene,g.camera);gl.readPixels(0,0,size.x,size.y,gl.RGBA,gl.UNSIGNED_BYTE,after);
    let strongPixels=0;for(let i=0;i<before.length;i+=4)if(Math.max(Math.abs(before[i]-after[i]),Math.abs(before[i+1]-after[i+1]),Math.abs(before[i+2]-after[i+2]))>40)strongPixels++;
    return {visible,strongPixels};
  });
  assert.ok(warning.visible&&warning.strongPixels>500,'Sword warning needs visible contrast over the mosaic: '+JSON.stringify(warning));
  await page.screenshot({path:output+'/desktop-floor-warning.png'});
  const occlusion=await page.evaluate(()=>{courtyardPlace(205,-14);return game.buildingOccluders.find(o=>o.object.name==='boss-blockout-chime-1').opacity;});
  assert.equal(occlusion,.16,'Foreground props must fade instead of hiding the player');
  await page.screenshot({path:output+'/foreground-fade.png'});
  await page.evaluate(()=>{const g=game;g.reset();g.wand=g.treasure=true;courtyardPlace(174,-15);g.scene.fog=null;g.camera.position.set(220,57,34);g.camera.lookAt(184,0,-24);g.renderer.render(g.scene,g.camera);});
  await page.screenshot({path:output+'/overview.png'});
  await page.evaluate(()=>{
    const g=game,camera=g.camera.clone();camera.fov=45;camera.updateProjectionMatrix();
    camera.position.set(212,30,4);camera.lookAt(187.5,2,-25);g.renderer.render(g.scene,camera);
  });
  await page.screenshot({path:output+'/concept-layout.png'});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{game.resize();courtyardPlace(game.enemies[2].home.x,game.enemies[2].home.z+6);});
  await page.screenshot({path:output+'/mobile-combat.png'});
  await page.setViewportSize({width:844,height:390});await page.evaluate(()=>{game.resize();courtyardPlace(game.enemies[2].home.x,game.enemies[2].home.z+6);});
  await page.screenshot({path:output+'/mobile-landscape.png'});
  assert.deepEqual(errors,[]);
  await writeFile(output+'/result.json',JSON.stringify({pass:true,layout,routes,dodges,collision,occlusion,warning,diagnostics,errors},null,2));
  console.log('PASS blockout layout, clear floor, prop collision, dock entry/return, eight-direction dodge, foreground fading and desktop/mobile rendering',JSON.stringify(diagnostics));
}finally{await browser.close();}
