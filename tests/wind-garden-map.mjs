import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = 'test-results/wind-garden-expanded', before = process.env.CAPTURE_BEFORE === '1';
const browser = await chromium.launch({ headless: true });
const errors = [], captures = [];
try {
  await mkdir(output, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, hasTouch: true, reducedMotion: 'reduce' });
  page.setDefaultTimeout(90000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/, r => r.fulfill({ contentType: 'text/javascript', body: 'export function startJourney(){return {arrive:async()=>{},dispose(){}}}' }));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + '\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;return init.call(this)};MazeAdventure.prototype.tick=function(){};' });
  });
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5188/') + '?level=3&lang=zh');
  await page.locator('.game-loading').waitFor({ state: 'detached' });
  await page.locator('#primary').click();
  await page.evaluate(async () => {
    const g = game, { at } = await import('/src/maze-map.ts');
    window.placePlayer = (x, z) => {
      g.body.setTranslation({ x, y: .8, z }, true); g.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      g.previous.copy(g.body.translation()); g.render(0);
    };
    g.wand = g.bridgeOpen = true; g.bridgeProgress = 1; g.bridgeBody.setEnabled(false);
    g.enemies[0].hp = 0; g.enemies[0].timer = 0; g.encounterGateProgress = 1; g.encounterGate.body.setEnabled(false);
    g.message = 'findGuardian'; g.messageUntil = 999;
    const p = at('shield'); placePlayer(p.x, p.z + 6);
  });
  async function capture(name, width, height, x, z, overview = false) {
    await page.setViewportSize({ width, height });
    const stats = await page.evaluate(({x,z,overview}) => {
      const g = game; placePlayer(x,z); g.resize(); g.render(0);
      if (overview) { g.camera.position.set(115,65,85); g.camera.lookAt(55,0,3); g.camera.updateMatrixWorld(); g.renderer.render(g.scene,g.camera); }
      const gl = g.renderer.getContext(), c = g.renderer.domElement, pixels = new Uint8Array(c.width*c.height*4);
      gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      let min=255,max=0; for(let i=0;i<pixels.length;i+=16){const v=(pixels[i]+pixels[i+1]+pixels[i+2])/3; min=Math.min(min,v);max=Math.max(max,v);}
      return { calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,geometries:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures,contrast:max-min };
    }, {x,z,overview});
    assert.ok(stats.contrast > 35, 'Canvas must show a varied, nonblank scene');
    await page.screenshot({ path: `${output}/${name}-${before?'before':'after'}.png` });
    captures.push({name,width,height,...stats});
  }
  await capture('overview',1440,900,25,12,true);
  await capture('courtyard-desktop',1280,800,25,9);
  const distances = await page.evaluate(async () => {
    const {maze,spots,position,walkable,CELL,COLS} = await import('/src/maze-map.ts');
    const distance = (from,to) => {
      const [sc,sr]=spots[from].map(Math.round),[tc,tr]=spots[to].map(Math.round),queue=[[sc,sr,0]],seen=new Set();
      for(let i=0;i<queue.length;i++) {const [c,r,d]=queue[i],id=c+','+r,p=position(c,r);if(seen.has(id)||!walkable(p.x,p.z,true,false,false))continue;
        if(c===tc&&r===tr)return d*CELL;seen.add(id);for(const [dc,dr]of [[1,0],[-1,0],[0,1],[0,-1]])if(maze[r+dr]?.[c+dc])queue.push([c+dc,r+dr,d+1]);}
      return null;
    };
    return {width:COLS*CELL,practiceToBoss:distance('practice','boss'),practiceToDock:distance('practice','dock'),shieldToChest:distance('shield','chest'),chestToBoss:distance('chest','boss')};
  });
  if (before) { await writeFile(output+'/baseline.json',JSON.stringify(distances,null,2));assert.deepEqual(errors,[]); console.log(JSON.stringify({distances,captures})); }
  else {
    const baseline={width:105,practiceToBoss:95,shieldToChest:15,chestToBoss:55};
    assert.ok(distances.width>=baseline.width+50,'The actual island must be wider');
    assert.equal(distances.practiceToBoss,null,'The guardian must require a boat crossing');
    assert.ok(distances.practiceToDock>=130,'The expanded walking route must still reach the dock');
    assert.ok(distances.shieldToChest>=baseline.shieldToChest*3,'The new garden route must separate the courtyard and pavilion');
    await capture('flowers-desktop',1280,800,79,4);
    await capture('courtyard-center',1280,800,25,-3);
    await capture('long-garden-desktop',1280,800,55,13);
    await capture('pavilion-desktop',1280,800,85,4);
    await capture('dock-desktop',1280,800,99,-9);
    await capture('courtyard-mobile',390,844,25,9);
    await capture('pavilion-mobile',390,844,85,4);
    await capture('courtyard-landscape',844,390,25,9);
    const structure = await page.evaluate(async () => {
      const g = game, { maze, spots, position, walkable } = await import('/src/maze-map.ts');
      const T=await import('/node_modules/three/build/three.module.js');
      function reach(bridge,shortcut,exit) {
        const seen=new Set(),queue=[spots.spawn];
        for(let i=0;i<queue.length;i++) { const [c,r]=queue[i],id=c+','+r,p=position(c,r); if(seen.has(id)||!walkable(p.x,p.z,bridge,shortcut,exit))continue;
          seen.add(id);for(const [dc,dr]of [[1,0],[-1,0],[0,1],[0,-1]])if(maze[r+dr]?.[c+dc])queue.push([c+dc,r+dr]); }
        return Object.fromEntries(Object.entries(spots).map(([k,p])=>[k,seen.has(p.map(Math.round).join(','))]));
      }
      const root=g.scene.getObjectByName('wind-garden');let finite=true,meshes=0,triangles=0,staticMeshes=0;
      for(const component of root.children)if(component.name!=='wind-garden-flowers')component.traverse(m=>{if(m.isMesh)staticMeshes++;});
      root.traverse(m=>{if(!m.isMesh)return; meshes++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1);
        for(const a of Object.values(m.geometry.attributes))finite&&=Array.from(a.array).every(Number.isFinite);});
      const flowers=root.getObjectByName('wind-garden-flowers'),lawn=new T.Box3().setFromObject(g.scene.getObjectByName('maze-lawn'));
      return { locks:[reach(false,false,false),reach(true,false,false),reach(true,true,true)],finite,meshes,triangles,staticMeshes,
        flowerPosition:flowers.position.toArray(),flowerFacing:new T.Vector3(0,0,1).transformDirection(flowers.matrixWorld).toArray(),
        lawn:{min:lawn.min.toArray(),max:lawn.max.toArray()},
        componentTriangles:root.children.map(c=>{let triangles=0;c.traverse(m=>{if(m.isMesh)triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1);});return {name:c.name,triangles};}),
        components:root.children.map(c=>c.name),enemies:g.enemies.map(e=>[e.maxHp,e.shielded]),bodies:g.world.bodies.len(),colliders:g.world.colliders.len() };
    });
    // The new sail crystal adds 392 triangles to the existing boat assembly.
    assert.ok(structure.finite && structure.staticMeshes < 60 && structure.meshes < 130 && structure.triangles < 101000,JSON.stringify(structure));
    assert.ok(structure.flowerPosition.every((v,i)=>Math.abs(v-[75,0,-4.4][i])<.00001),'Flowerbed must occupy the reference player position to the left of the pavilion');
    assert.ok(structure.flowerFacing[2]>.999&&Math.abs(structure.flowerFacing[0])<.001,'Flowers face forward toward the gameplay camera');
    assert.equal(structure.lawn.min[0],-52.5);assert.equal(structure.lawn.max[0],102.5);
    assert.equal(structure.locks[0].boss,false);assert.equal(structure.locks[0].finish,false);
    for(const name of ['shield','scout','chest','dock'])assert.ok(structure.locks[1][name],name+' reachable');
    assert.equal(structure.locks[1].boss,false);assert.equal(structure.locks[2].boss,false);
    assert.ok(structure.locks[2].finish);assert.deepEqual(structure.enemies,[[1,false],[2,true],[3,true]]);
    // Drive the actual input/physics loop through each authored connector, with enemies disabled only for traversal.
    const traversal = await page.evaluate(() => {
      const g=game; const hp=g.enemies.map(e=>e.hp);g.enemies.forEach(e=>e.hp=0);g.invulnerable=999;
      placePlayer(40,25); const route=[[40,20],[30,20],[25,20],[25,10],[25,0],[40,0],[55,0],[55,15],
        [75,15],[75,0],[85,0],[85,-10],[100,-10]];
      const reached=[];
      for(const [x,z] of route) {
        for(let i=0;i<700;i++) { const p=g.body.translation();if(Math.hypot(p.x-x,p.z-z)<.22)break;
          g.keys.clear();if(Math.abs(x-p.x)>.12)g.keys.add(x>p.x?'KeyD':'KeyA');if(Math.abs(z-p.z)>.12)g.keys.add(z>p.z?'KeyS':'KeyW');g.step(); }
        const p=g.body.translation();reached.push({target:[x,z],position:[p.x,p.z],distance:Math.hypot(p.x-x,p.z-z)});
      }
      g.keys.clear(); g.enemies.forEach((e,i)=>e.hp=hp[i]); return reached;
    });
    for(const p of traversal)assert.ok(p.distance<.35,'Blocked route '+JSON.stringify(p));
    const collision = await page.evaluate(() => {
      const g=game; g.enemies.forEach(e=>e.hp=0);
      // The dock end must stop walking and jumping out of the island.
      placePlayer(100,-10);g.keys.add('KeyD');
      for(let i=0;i<200;i++){if(i===30)g.jumpRequested=true;g.step();}g.keys.clear();
      const end=g.body.translation();
      placePlayer(100,-10);g.keys.add('KeyW');
      for(let i=0;i<200;i++){if(i===30)g.jumpRequested=true;g.step();}g.keys.clear();
      const water=g.body.translation();
      // The flowerbed is solid rather than merely painted over the route.
      placePlayer(80,-4.4);g.keys.add('KeyA');for(let i=0;i<100;i++)g.step();g.keys.clear();
      return {dock:[end.x,end.z],water:[water.x,water.z],flower:g.body.translation()};
    });
    assert.ok(collision.dock[0]<102 && collision.dock[0]>99,'Dock boundary '+JSON.stringify(collision));
    assert.ok(collision.water[1]>-11.2 && collision.water[1]<-10,'Pond railing '+JSON.stringify(collision));
    assert.ok(collision.flower.x>78&&collision.flower.x<78.6,'Front-facing flowerbed collision '+JSON.stringify(collision));
    await page.evaluate(async()=>{const {at}=await import('/src/maze-map.ts');const p=at('chest');placePlayer(p.x,p.z+1.5);game.treasure=false;game.hearts=1;});
    await page.keyboard.press('KeyE');await page.locator('[data-chest-answer="wind"]').click();assert.ok(await page.evaluate(()=>game.chestOpened&&!game.treasure),'Correct answer opens the chest before pickup');
    await page.keyboard.press('KeyE');assert.ok(await page.evaluate(()=>game.treasure&&game.hearts===3),'Crystal pickup grants the reward');
    await page.evaluate(()=>{const e=game.enemies[1];e.hp=2;e.mesh.position.copy(e.home);e.phase='idle';e.timer=0;game.cooldown=0;placePlayer(25,5.5);});
    await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>game.enemies[1].hp),2,'Raised shield blocks wind');
    for(const hp of [1,0]) {
      await page.evaluate(()=>{game.enemies[1].phase='rest';game.enemies[1].timer=2.6;game.cooldown=0;});
      await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>game.enemies[1].hp),hp,'Exposed shield knight can be hit');
    }
    // Shared obstacles also prevent the transform-driven knight from walking through stone props.
    assert.ok(await page.evaluate(()=>!game.knightClear({x:80,z:-4.4},{x:73,z:-4.4})),'Knight must respect the front-facing flowerbed');
    await page.locator('#pause').click();assert.ok(await page.evaluate(()=>{game.render(0);return game.paused;}));await page.locator('#primary').click();
    await page.evaluate(async()=>{const {at}=await import('/src/maze-map.ts');const p=at('boss');placePlayer(p.x,p.z+1);});
    await page.keyboard.press('KeyE');assert.ok(await page.evaluate(()=>game.key&&!game.shortcut.body.isEnabled()),'Key still opens the return shortcut');
    await page.evaluate(async()=>{const {at}=await import('/src/maze-map.ts');const p=at('exit');placePlayer(p.x,p.z+2);});
    await page.keyboard.press('KeyE');assert.ok(await page.evaluate(()=>game.exitOpen&&!game.exit.body.isEnabled()),'Original exit still unlocks');
    const progression=await page.evaluate(async()=>{const {at}=await import('/src/maze-map.ts');const p=at('finish');placePlayer(p.x,p.z);game.step();return {key:game.key,exitOpen:game.exitOpen,state:game.state};});
    assert.equal(progression.state,'qualified','Original finish trigger still completes the level');
    const reset=await page.evaluate(()=>{const g=game,b=g.world.bodies.len(),c=g.world.colliders.len();g.reset();return {b,c,afterB:g.world.bodies.len(),afterC:g.world.colliders.len(),shield:g.enemies[1].hp};});
    assert.equal(reset.b,reset.afterB);assert.equal(reset.c,reset.afterC);assert.equal(reset.shield,2);
    assert.deepEqual(errors,[]);
    const report={baseline,distances,structure,traversal,collision,progression,reset,captures,errors};
    await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
    console.log('PASS wind garden map '+JSON.stringify(report));
  }
} finally { await browser.close(); }
