import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { default: sharp } = await import(process.env.SHARP_MODULE || 'sharp');
const output = 'test-results/first-encounter-ruins', errors = [], captures = [];
const browser = await chromium.launch({ headless: true });
try {
  await mkdir(output, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true, reducedMotion: 'reduce' });
  page.setDefaultTimeout(90000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/, r => r.fulfill({ contentType: 'text/javascript', body: 'export function startJourney(){return {arrive:async()=>{},dispose(){}}}' }));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + '\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;return init.call(this)};MazeAdventure.prototype.tick=function(){};' });
  });
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5206/') + '?level=3&lang=zh');
  await page.locator('.game-loading').waitFor({ state: 'detached' });
  await page.locator('#primary').click();
  await page.evaluate(async () => {
    const g = game, { at } = await import('/src/maze-map.ts');
    window.prepareEncounter = (dx = 0, dz = 6.2) => {
      g.reset(); g.wand = g.bridgeOpen = true; g.bridgeProgress = 1; g.bridgeBody.setEnabled(false);
      g.message = 'practiceGate'; g.messageUntil = 999;
      const p = at('practice');
      g.body.setTranslation({ x: p.x + dx, y: .8, z: p.z + dz }, true);
      g.body.setLinvel({ x: 0, y: 0, z: 0 }, true); g.previous.copy(g.body.translation());
      g.enemies[0].mesh.rotation.y = Math.PI; g.render(0);
    };
    prepareEncounter();
  });
  const geometry = await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js');
    const root = game.scene.getObjectByName('first-encounter-ruins'), arch = root.getObjectByName('ruins-arch');
    root.updateMatrixWorld(true);
    let meshes = 0, triangles = 0, finite = true;
    const materials = new Set();
    root.traverse(m => {
      if (!m.isMesh) return;
      meshes++; triangles += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3; materials.add(m.material);
      for (const a of Object.values(m.geometry.attributes)) finite &&= Array.from(a.array).every(Number.isFinite);
    });
    const hits = [], ray = new T.Raycaster();
    // Actual onward passage stays visually clear at player/knight height across the capsule width.
    for (const x of [38.15, 40, 41.85]) for (const y of [.5, 1.2, 2]) {
      ray.set(new T.Vector3(x,y,22),new T.Vector3(0,0,1)); ray.far = 12;
      if (ray.intersectObject(arch,true).length) hits.push({x,y});
    }
    const paving = new T.Box3().setFromObject(root.getObjectByName('ruins-paving'));
    return {meshes,triangles,materials:materials.size,finite,hits,pavingTop:paving.max.y,bounds:new T.Box3().setFromObject(root).getSize(new T.Vector3()).toArray()};
  });
  assert.ok(geometry.finite && geometry.meshes <= 52 && geometry.triangles < 80000, JSON.stringify(geometry));
  assert.deepEqual(geometry.hits, [], 'Arch must not visually obstruct the existing 5m passage');
  assert.ok(geometry.pavingTop < .08, 'Paving must remain flush and require no stair collider');
  const clipping = await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js'), root = game.scene.getObjectByName('first-encounter-ruins');
    const hedges = game.walls.map(w => w.mesh);
    const point = new T.Vector3(), down = new T.Vector3(0,-1,0), ray = new T.Raycaster(), counts = {};
    ray.far = 10;
    for (const name of ['ruins-arch','ruins-walls','ruins-planters','ruins-paving','ruins-columns','ruins-bench','ruins-pavilion','ruins-watch-traces','ruins-gate']) {
      let inside = 0;
      root.getObjectByName(name).traverse(m => {
        if (!m.isMesh) return;
        const positions = m.geometry.attributes.position;
        for (let i=0;i<positions.count;i++) {
          point.fromBufferAttribute(positions,i).applyMatrix4(m.matrixWorld);
          if (point.y<=.002 || point.y>=3.248) continue;
          ray.set(new T.Vector3(point.x,10,point.z),down);
          if (ray.intersectObjects(hedges,false).some(hit => hit.point.y>point.y+.002)) inside++;
        }
      });
      counts[name] = inside;
    }
    return counts;
  });
  assert.ok(Object.values(clipping).every(count => count===0),'Stone and urn vertices must not be buried inside hedge volumes: '+JSON.stringify(clipping));
  const additions = await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js'), { walkable } = await import('/src/maze-map.ts');
    const root = game.scene.getObjectByName('first-encounter-ruins'), bounds = {};
    for (const name of ['ruins-columns','ruins-bench','ruins-pavilion']) {
      const box = new T.Box3().setFromObject(root.getObjectByName(name)); bounds[name] = {min:box.min.toArray(),max:box.max.toArray()};
    }
    const b = bounds['ruins-pavilion'], routeOverlap = [];
    for(let x=b.min[0];x<=b.max[0];x+=.25)for(let z=b.min[2];z<=b.max[2];z+=.25)if(walkable(x,z,true,false,false))routeOverlap.push([x,z]);
    return {bounds,routeOverlap,colliders:root.userData.colliders.length};
  });
  assert.ok(additions.colliders>=8,'Columns and curved bench require collision proxies');
  assert.deepEqual(additions.routeOverlap,[],'Distant pavilion must stay outside the playable route');
  assert.ok(additions.bounds['ruins-pavilion'].max[0]<=52.5,'Pavilion must fit on the existing island');
  assert.ok(additions.bounds['ruins-bench'].min[0]>27.5 && additions.bounds['ruins-bench'].max[0]<32,'Bench stays in the left corner');
  assert.deepEqual(await page.evaluate(() => game.enemies.map(e => [e.maxHp,e.shielded])), [[1,false],[2,true],[3,true]]);
  const routes = await page.evaluate(async () => {
    const { spots, walkable } = await import('/src/maze-map.ts');
    return { practice:spots.practice, bridge:spots.bridge, corridor:[walkable(40,22,true,false,false),walkable(40,26,true,false,false)], locked:walkable(20,40,false,false,false) };
  });
  assert.deepEqual(routes,{practice:[17,17],bridge:[14,18],corridor:[true,true],locked:false},'Existing encounter, onward corridor and bridge lock stay intact');

  async function capture(name, width, height, dx = 0, dz = 6.2) {
    await page.setViewportSize({ width, height });
    await page.evaluate(({dx,dz}) => { prepareEncounter(dx,dz); game.resize(); game.render(0); }, {dx,dz});
    const stats = [];
    for (const [suffix, visible] of [['before',false],['after',true]]) {
      stats.push(await page.evaluate(visible => {
        const g = game, root = g.scene.getObjectByName('first-encounter-ruins'); root.visible = visible;
        for (const wall of g.walls) if (wall.mesh.name === 'ruins-hedge-base') {
          const height = visible ? 4.5 : 3.25; wall.mesh.scale.y = height / 4.5; wall.mesh.position.y = height / 2; wall.bounds.setFromObject(wall.mesh);
        }
        g.render(0);
        const gl = g.renderer.getContext(), c = g.renderer.domElement;
        const pixels = new Uint8Array(c.width*c.height*4); gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let min=255,max=0; for(let i=0;i<pixels.length;i+=16){const v=(pixels[i]+pixels[i+1]+pixels[i+2])/3;min=Math.min(min,v);max=Math.max(max,v);}
        return { calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,geometries:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures,contrast:max-min,player:g.player.position.toArray(),camera:g.camera.position.toArray() };
      }, visible));
      await page.screenshot({ path: output + '/' + name + '-' + suffix + '.png' });
    }
    const a=await sharp(output+'/'+name+'-before.png').removeAlpha().raw().toBuffer();
    const b=await sharp(output+'/'+name+'-after.png').removeAlpha().raw().toBuffer();
    let changed=0;for(let i=0;i<a.length;i+=3)if(Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>20)changed++;
    assert.ok(changed > 2000 && stats[1].contrast > 60, name + ' must show visible authored scene detail and nonblank canvas');
    assert.ok(stats[1].calls - stats[0].calls <= 52, 'Keep scene batched: ' + JSON.stringify(stats));
    captures.push({ name,width,height,changedPixels:changed,before:stats[0],after:stats[1] });
  }
  await capture('desktop',1280,800);
  await capture('mobile',390,844);
  await capture('landscape',844,390);
  await capture('bridge-approach',1280,800,-6,5);
  await capture('user-view',1906,921,0,14.3);
  await capture('bench-mobile',390,844,-5.2,.8);
  const benchFramed = await page.evaluate(async () => {
    const T=await import('/node_modules/.vite/deps/three.js'), box=new T.Box3().setFromObject(game.scene.getObjectByName('ruins-bench'));
    const corners=[];
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])corners.push(new T.Vector3(x,y,z).project(game.camera));
    return corners.every(p=>Math.abs(p.x)<.98&&Math.abs(p.y)<.98);
  });
  assert.ok(benchFramed,'Portrait camera must show the whole bench when the player approaches it');

  await page.setViewportSize({width:1280,height:800});
  await page.evaluate(() => {prepareEncounter(5,-5);game.enemies[0].phase='stun';game.enemies[0].timer=999;});
  assert.equal(await page.evaluate(() => game.clearSight({x:40,z:24})),false,'Closed leaf gate blocks wind targeting through the passage');
  assert.equal(await page.evaluate(() => game.knightClear({x:40,z:30},{x:40,z:24})),false,'Knights cannot path through the closed gate');
  await page.keyboard.down('ArrowUp');await page.keyboard.press('Space');
  const lockedStop=await page.evaluate(() => {let z=Infinity;for(let i=0;i<240;i++){game.step();z=Math.min(z,game.body.translation().z);}return z;});
  await page.keyboard.up('ArrowUp');
  assert.ok(lockedStop>28,'Closed half-height gate must stop walking and jumping: '+lockedStop);

  await page.evaluate(() => prepareEncounter(0,5.5));
  await page.keyboard.press('KeyE'); assert.equal(await page.evaluate(() => game.enemies[0].hp),0);
  await page.evaluate(() => {for(let i=0;i<90;i++)game.step();game.render(0);});
  assert.ok(await page.evaluate(() => game.enemies[0].timer>0&&game.encounterGateProgress===0&&game.encounterGate.body.isEnabled()),'Gate waits for the knight death animation');
  await page.evaluate(() => {for(let i=0;i<78;i++)game.step();game.render(0);});
  assert.ok(await page.evaluate(() => game.encounterGateProgress>0&&game.encounterGateProgress<1&&game.encounterGate.body.isEnabled()),'Gate animates before releasing the collision');
  await page.screenshot({path:output+'/gate-opening.png'});
  await page.evaluate(() => {for(let i=0;i<180;i++)game.step();game.render(0);});
  assert.equal(await page.evaluate(() => game.enemies[0].mesh.visible),false, 'One-hit first knight still completes death animation');
  assert.ok(await page.evaluate(() => game.encounterGateProgress===1&&!game.encounterGate.body.isEnabled()&&game.encounterCrest.visible&&game.encounterTrail.visible&&!game.key),'Knight victory opens the leaf gate without granting the final exit key');
  await page.screenshot({path:output+'/knight-cleared.png'});
  await page.evaluate(() => {
    game.hearts=1;game.invulnerable=0;game.hurt();game.render(0);
  });
  assert.ok(await page.evaluate(() => game.encounterGateProgress===1&&!game.encounterGate.body.isEnabled()&&game.enemies[0].hp===0),'Recovery must preserve the defeated knight and open gate');
  await page.evaluate(() => {game.body.setTranslation({x:35,y:.8,z:49.3},true);game.previous.copy(game.body.translation());game.render(0);});
  await page.screenshot({path:output+'/user-view-victory.png'});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(() => {game.resize();game.body.setTranslation({x:40,y:.8,z:35},true);game.previous.copy(game.body.translation());game.render(0);});
  await page.screenshot({path:output+'/mobile-victory.png'});
  await page.setViewportSize({width:1280,height:800});

  // Teleport only for setup; traverse the bridge entry and arch using actual keyboard events and fixed-step physics.
  await page.evaluate(() => { prepareEncounter(-12,5);game.enemies[0].hp=0; });
  await page.keyboard.down('ArrowRight');
  await page.evaluate(() => {for(let i=0;i<180;i++)game.step();});
  await page.keyboard.up('ArrowRight');
  assert.ok(await page.evaluate(() => game.body.translation().x>32), 'Bridge entry stays traversable');
  await page.evaluate(() => {prepareEncounter(5,-3);game.enemies[0].hp=0;});
  await page.keyboard.down('ArrowUp');
  await page.evaluate(() => {for(let i=0;i<210;i++)game.step();});
  await page.keyboard.up('ArrowUp');
  const onward = await page.evaluate(() => {game.render(0);return game.body.translation();});
  assert.ok(onward.z < 22 && Math.abs(onward.x-40)<.2, 'Player must walk through the arch into the original corridor: '+JSON.stringify(onward));
  await page.screenshot({path:output+'/through-arch.png'});

  for (const [dx,dz,key,axis,edge] of [[-6,-3,'ArrowLeft','x',27.85],[0,-5,'ArrowUp','z',27.85]]) {
    await page.evaluate(({dx,dz}) => {prepareEncounter(dx,dz);game.enemies[0].hp=0;for(let i=0;i<30;i++)game.step();},{dx,dz});
    await page.keyboard.down(key);await page.keyboard.press('Space');
    const boundary = await page.evaluate(axis => {
      let nearest=Infinity;for(let i=0;i<180;i++){game.step();nearest=Math.min(nearest,game.body.translation()[axis]);}return nearest;
    },axis);
    await page.keyboard.up(key);
    assert.ok(boundary>=edge,'Raised hedges must keep the solid boundary even during a jump: '+boundary);
  }

  await page.evaluate(() => {prepareEncounter(8.1,-4.2);game.enemies[0].hp=0;});
  await page.keyboard.down('ArrowRight');
  await page.evaluate(() => {for(let i=0;i<180;i++)game.step();});
  await page.keyboard.up('ArrowRight');
  const columnStop = await page.evaluate(() => game.body.translation().x);
  assert.ok(columnStop>43.2&&columnStop<45,'Player must stop at the tall stone column rather than pass through: '+columnStop);
  const benchAndKnight = await page.evaluate(() => {
    const g=game, root=g.scene.getObjectByName('first-encounter-ruins'), shapes=root.userData.colliders;
    const bench=shapes.find(s=>s.x<-3.5 && s.height>.6), angle=bench.angle;
    const center={x:35+bench.x,y:bench.y,z:35+bench.z}, direction={x:-Math.sin(angle),y:0,z:-Math.cos(angle)};
    const origin={x:center.x-direction.x*(bench.depth/2+1),y:center.y,z:center.z-direction.z*(bench.depth/2+1)};
    const hit=g.world.castRay({origin,dir:direction},2.5,true,undefined,undefined,undefined,g.body);
    prepareEncounter(-2.4,-7.05);const e=g.enemies[0];e.mesh.position.set(32.6,0,31);e.phase='chase';e.timer=0;
    let penetrations=0,travelled=0,previous=e.mesh.position.clone();
    for(let i=0;i<240;i++){
      g.time+=1/60;g.updateEnemies(1/60);travelled+=previous.distanceTo(e.mesh.position);previous.copy(e.mesh.position);
      for(const s of shapes){const dx=e.mesh.position.x-35-s.x,dz=e.mesh.position.z-35-s.z,c=Math.cos(s.angle),n=Math.sin(s.angle);
        if(Math.abs(dx*c-dz*n)<s.width/2+.35 && Math.abs(dx*n+dz*c)<s.depth/2+.35)penetrations++;
      }
    }
    g.render(0);return {benchHit:!!hit,penetrations,travelled};
  });
  assert.ok(benchAndKnight.benchHit,'Bench must have real physics collision');
  assert.ok(benchAndKnight.travelled>.2&&benchAndKnight.penetrations===0,'Knight must move around the new stonework: '+JSON.stringify(benchAndKnight));

  await page.setViewportSize({width:390,height:844});await page.evaluate(() => prepareEncounter(0,5.5));
  await page.locator('#dive').tap();assert.equal(await page.evaluate(() => game.enemies[0].hp),0,'Touch wind still defeats the first knight');
  const pad=await page.locator('#stick').boundingBox();
  await page.mouse.move(pad.x+pad.width/2,pad.y+pad.height/2);await page.mouse.down();
  await page.mouse.move(pad.x+pad.width/2+25,pad.y+pad.height/2);
  const startX=await page.evaluate(() => game.body.translation().x);
  await page.evaluate(() => {for(let i=0;i<60;i++)game.step();});
  await page.mouse.up();
  assert.ok(await page.evaluate(x => game.body.translation().x>x+1,startX),'Mobile joystick pointer input moves the player');
  assert.deepEqual(await page.evaluate(() => game.stick),{x:0,y:0},'Joystick release clears input');
  await page.locator('#pause').tap();await page.evaluate(() => game.render(0));assert.ok(await page.evaluate(() => game.paused));
  await page.locator('#primary').tap();await page.evaluate(() => game.render(0));assert.equal(await page.evaluate(() => game.paused),false);
  const bodies=await page.evaluate(() => game.world.bodies.len());
  await page.evaluate(() => {game.reset();game.render(0);});
  assert.ok(await page.evaluate(() => !game.wand&&!game.bridgeOpen&&game.enemies[0].hp===1&&game.scene.getObjectByName('first-encounter-ruins').visible));
  assert.ok(await page.evaluate(() => game.encounterGateProgress===0&&game.encounterGate.body.isEnabled()&&!game.encounterCrest.visible&&!game.encounterTrail.visible&&game.encounterGate.mesh.getObjectByName('ruins-gate-left').rotation.y===0),'Restart restores the gate, crest and leaves');
  assert.equal(await page.evaluate(() => game.world.bodies.len()),bodies,'Reset must not create extra scene bodies');
  assert.deepEqual(errors,[]);
  await writeFile(output+'/report.json',JSON.stringify({geometry,clipping,additions,lockedStop,columnStop,benchAndKnight,captures,onward,bodies,errors,scope:'Focused local dev browser verification; setup teleports and frozen render loop; actual inputs and physics tested'},null,2));
  console.log('PASS ruins geometry/budget, open arch, unchanged topology, before/after desktop/mobile/landscape, keyboard bridge/arch traversal, one-hit wind and death, mobile wind/joystick, pause/reset, no browser errors');
  console.log(JSON.stringify({geometry,captures:captures.map(c=>({name:c.name,changed:c.changedPixels,before:c.before.calls,after:c.after.calls,triangles:c.after.triangles})),onward,bodies}));
} finally { await browser.close(); }

