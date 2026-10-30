import {driveBoat} from './boat-driving-helpers.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {advanceGarden} from './garden-quest-helpers.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output=process.env.COAST_OUTPUT||'artifacts/models/ferry-coast',errors=[];
try {
  await mkdir(output,{recursive:true});await mkdir('artifacts/models/ferry-coast-scope',{recursive:true});const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:'export function startJourney(){return{arrive:async()=>{},dispose(){}}}'}));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+'\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;return init.call(this)};MazeAdventure.prototype.tick=function(){};'});});
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5212/')+'?level=3&lang=zh');
  await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  const geometry=await page.evaluate(async()=>{
    const g=game,T=await import('/node_modules/.vite/deps/three.js'),R=await import('/node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs');
    g.world.step();const ray=new T.Raycaster(),coast=g.ferryCoast.root;let triangles=0,meshes=0,finite=true;
    coast.traverse(m=>{if(!m.isMesh)return;meshes++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1);for(const a of Object.values(m.geometry.attributes))finite&&=Array.from(a.array).every(Number.isFinite);});
    const physical=(x,z)=>{const hit=g.world.castRay(new R.Ray({x,y:8,z},{x:0,y:-1,z:0}),25,true);return hit?8-hit.timeOfImpact:null;};
    const supports=g.scene.getObjectByName('wind-garden-dock').getObjectByName('dock-supports');
    const supportBounds=new T.Box3().setFromObject(supports),sea=g.scene.getObjectByName('ferry-sea'),boatBounds=new T.Box3().setFromObject(g.boat);
    const bayBounds=new T.Box3().setFromObject(sea),outsideSeaHits=[];
    for(const [x,z] of [[0,0],[-60,20],[135,40],[135,-60]]) {ray.set(new T.Vector3(x,8,z),new T.Vector3(0,-1,0));outsideSeaHits.push(ray.intersectObject(sea).length);}
    const matrix=new T.Matrix4(),clouds=g.scene.getObjectByName('maze-island-clouds'),distant=g.scene.getObjectByName('maze-distant-islands');
    const cloudHeights=[0,5,10,15].map(i=>{clouds.getMatrixAt(i,matrix);return matrix.elements[13];});
    const distantHeights=distant.children.map(island=>island.position.y);
    ray.set(new T.Vector3(99.65,.8,-10),new T.Vector3(1,0,0));const dock=g.scene.getObjectByName('wind-garden-dock');
    const opening=ray.intersectObject(dock,true).filter(h=>h.point.x>100.2).length;
    window.coastPlace=(x,z)=>{g.body.setTranslation({x,y:.85,z},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());g.clearInput();g.render(0);};
    window.coastView=(x,y,z,tx,ty,tz)=>{g.camera.position.set(x,y,z);g.camera.lookAt(tx,ty,tz);g.renderer.render(g.scene,g.camera);};
    return{finite,triangles,meshes,noPond:!g.scene.getObjectByName('wind-garden-pond'),noGate:!g.scene.getObjectByName('wind-garden-boarding-gate'),
      seaY:sea.position.y,boatY:g.boat.position.y,hullBottom:boatBounds.min.y,piles: supportBounds.min.y,opening,
      bayBounds:{min:bayBounds.min.toArray(),max:bayBounds.max.toArray()},outsideSeaHits,cloudHeights,distantHeights,
      sailingDistance:g.boatMooring(false).distanceTo(g.boatMooring(true)),oldIslandGround:physical(145,-25),bossLandingGround:physical(165,-15),bossArenaGround:physical(180,-25),
      waterGap:physical(115,-12),oldPondGround:physical(100,-16.8),besideDockGround:physical(100.7,-7.4),grassGround:physical(94,-10),
      lamp:!!g.scene.getObjectByName('ferry-leaf-lamp'),sign:!!g.scene.getObjectByName('ferry-boarding-sign')};
  });
  assert.ok(geometry.finite&&geometry.triangles<80000&&geometry.meshes<20,JSON.stringify(geometry));
  assert.ok(geometry.noPond&&geometry.noGate&&geometry.lamp&&geometry.sign&&geometry.opening===0);
  assert.equal(geometry.waterGap,null);assert.ok(geometry.oldPondGround<-.8&&geometry.besideDockGround<-.7&&Math.abs(geometry.grassGround)<.02,JSON.stringify(geometry));
  assert.ok(geometry.hullBottom<geometry.seaY&&geometry.piles<geometry.seaY&&geometry.seaY<-.5,JSON.stringify(geometry));
  assert.deepEqual(geometry.outsideSeaHits,[0,0,0,0]);assert.deepEqual(geometry.cloudHeights,[-7,-2,3,8]);assert.deepEqual(geometry.distantHeights,[8,-3,10,2,5,-6]);
  assert.ok(geometry.bayBounds.min[0]>=90&&geometry.bayBounds.max[0]<=180&&geometry.bayBounds.min[2]>=-47&&geometry.bayBounds.max[2]<=23,'Sea stays within the dock sub-area');
  assert.ok(geometry.sailingDistance>55&&geometry.oldIslandGround===null&&Math.abs(geometry.bossLandingGround-.095)<.001&&Math.abs(geometry.bossArenaGround)<.02,JSON.stringify(geometry));
  await page.evaluate(()=>{const g=game;g.wand=g.bridgeOpen=true;g.bridgeBody.setEnabled(false);g.bridgeProgress=1;g.enemies.forEach(e=>e.hp=0);g.encounterGateProgress=1;g.encounterGate.body.setEnabled(false);coastPlace(100,-10);});
  await page.evaluate(async()=>{const T=await import('/node_modules/.vite/deps/three.js'),g=game;window.scopeFog=g.scene.fog;g.scene.fog=null;const camera=new T.OrthographicCamera(-148,148,92.5,-92.5,.1,600);camera.position.set(205,170,180);camera.lookAt(60,-7,5);g.renderer.render(g.scene,camera);});
  await page.screenshot({path:'artifacts/models/ferry-coast-scope/island-overview.png'});
  await page.evaluate(()=>{game.scene.fog=scopeFog;coastPlace(-10,40);coastView(-82,27,80,-25,-5,15);});
  await page.screenshot({path:'artifacts/models/ferry-coast-scope/clouds-west.png'});
  await page.evaluate(()=>coastPlace(100,-10));
  await page.evaluate(()=>coastView(108,5.7,-18,99.3,.2,-10));await page.screenshot({path:`${output}/dock-overview.png`});
  await page.evaluate(()=>coastView(101.8,1.3,-5.4,99.8,-.2,-10));await page.screenshot({path:`${output}/piles-and-shore.png`});
  await page.evaluate(()=>coastView(98.5,4.2,-7,95.6,1.4,-10.1));await page.screenshot({path:`${output}/lamp-and-sign.png`});
  const animation=await page.evaluate(()=>{
    const g=game;coastView(111,14,-4,111,-.65,-16);const gl=g.renderer.getContext(),w=200,h=130;
    const pixels=phase=>{g.ferryCoast.time.value=phase;g.renderer.render(g.scene,g.camera);const p=new Uint8Array(w*h*4);gl.readPixels(Math.floor((g.renderer.domElement.width-w)/2),Math.floor((g.renderer.domElement.height-h)/2),w,h,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
    const a=pixels(0),b=pixels(2),c=pixels(0);let changed=0,same=0;for(let i=0;i<a.length;i+=4){if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>6)changed++;if(a[i]!==c[i]||a[i+1]!==c[i+1]||a[i+2]!==c[i+2])same++;}
    return{changed,repeatDifference:same};
  });
  assert.ok(animation.changed>150&&animation.repeatDifference===0,JSON.stringify(animation));
  await page.screenshot({path:`${output}/sea-detail.png`});
  const render=await page.evaluate(async()=>{
    const g=game,T=await import('/node_modules/.vite/deps/three.js'),sea=g.scene.getObjectByName('ferry-sea');
    const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
    sea.material.onBeforeCompile(shader,g.renderer);
    const texture=shader.uniforms.uSeaNormals.value,values=[];
    for(let i=0;i<texture.image.data.length;i+=4)values.push(texture.image.data[i],texture.image.data[i+1]);
    sea.visible=false;g.renderer.render(g.scene,g.camera);const withoutSea=g.renderer.info.render.calls;
    sea.visible=true;g.renderer.render(g.scene,g.camera);
    const {calls,triangles}=g.renderer.info.render,{geometries,textures}=g.renderer.info.memory;
    return{calls,triangles,geometries,textures,dpr:g.renderer.getPixelRatio(),seaCalls:calls-withoutSea,
      slopes:{width:texture.image.width,height:texture.image.height,min:Math.min(...values),max:Math.max(...values),
        repeat:texture.wrapS===T.RepeatWrapping&&texture.wrapT===T.RepeatWrapping,mipmaps:texture.generateMipmaps&&texture.minFilter===T.LinearMipmapLinearFilter}};
  });
  assert.equal(render.seaCalls,1,'Water stays in one render pass');
  assert.ok(render.slopes.width===128&&render.slopes.height===128&&render.slopes.min>0&&render.slopes.min<110&&render.slopes.max>145&&render.slopes.max<255&&render.slopes.repeat&&render.slopes.mipmaps,JSON.stringify(render.slopes));
  const swell=await page.evaluate(()=>{
    const sea=game.ferryCoast,heights=[];
    for(let i=0;i<80;i++){sea.time.value=i*.05;heights.push(sea.heightAt(120,-15));}
    sea.time.value=0;game.render(0);
    return{range:Math.max(...heights)-Math.min(...heights),boatError:Math.abs(game.boat.position.y+.8-sea.heightAt(game.boat.position.x,game.boat.position.z))};
  });
  assert.ok(swell.range>.6&&swell.range<.94&&swell.boatError<1e-6,JSON.stringify(swell));
  await page.evaluate(()=>{coastPlace(100,-10);game.ferryCoast.time.value=0;});await advanceGarden(page,1);
  assert.ok(await page.evaluate(()=>game.ferryCoast.time.value>.9));
  await page.locator('#pause').click();const paused=await page.evaluate(()=>game.ferryCoast.time.value),boatPaused=await page.evaluate(()=>game.boat.position.toArray());await advanceGarden(page,1);assert.equal(await page.evaluate(()=>game.ferryCoast.time.value),paused);assert.deepEqual(await page.evaluate(()=>game.boat.position.toArray()),boatPaused);
  await page.locator('#primary').click();await page.evaluate(()=>{game.treasure=true;game.render(0);});await page.keyboard.press('KeyE');const sailing=await page.evaluate(()=>game.ferryCoast.time.value);await advanceGarden(page,2.5);
  assert.ok(await page.evaluate(t=>game.boatTrip&&game.ferryCoast.time.value>t+2&&!game.dockMooring.visible&&!game.bossMooring.visible,sailing),'Sea continues during sailing, with both lines released');
  assert.ok(await page.evaluate(()=>Math.abs(game.body.translation().y-game.boat.position.y-1.487)<1e-6&&Math.abs(game.boat.position.y+.8-game.ferryCoast.heightAt(game.boat.position.x,game.boat.position.z))<1e-6),'Boat and passenger follow the same wave as the surface');
  await page.screenshot({path:`${output}/crossing-desktop.png`});
  if(process.env.COAST_CAPTURE_MOTION) {
    await mkdir(`${output}/motion-frames`,{recursive:true});await page.setViewportSize({width:800,height:500});
    const clip=await page.evaluate(()=>({time:game.ferryCoast.time.value,x:game.boat.position.x,z:game.boat.position.z}));
    for(let frame=0;frame<40;frame++) {
      await page.evaluate(({clip,frame})=>{game.ferryCoast.time.value=clip.time+frame/10;game.render(0);coastView(clip.x,9.6,clip.z+16,clip.x,1.8,clip.z-8);},{clip,frame});
      await page.screenshot({path:`${output}/motion-frames/${String(frame).padStart(3,'0')}.png`});
    }
    await page.setViewportSize({width:1280,height:800});await page.evaluate(time=>{game.ferryCoast.time.value=time;game.render(0);},clip.time);
  }
  await driveBoat(page);assert.ok(await page.evaluate(()=>game.boatAtBossIsland&&!game.dockMooring.visible&&game.bossMooring.visible));
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{game.resize();game.render(0);});await page.screenshot({path:`${output}/island-mobile.png`});
  await page.locator('#dive').tap();await driveBoat(page);assert.ok(await page.evaluate(()=>!game.boatAtBossIsland&&game.dockMooring.visible&&!game.bossMooring.visible));
  await page.screenshot({path:`${output}/dock-mobile.png`});
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{game.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;});await advanceGarden(page,1);assert.equal(await page.evaluate(()=>game.ferryCoast.time.value),0);
  await page.evaluate(()=>game.reset());assert.equal(await page.evaluate(()=>game.ferryCoast.time.value),0);
  assert.deepEqual(errors,[]);await writeFile(`${output}/result.json`,JSON.stringify({pass:true,geometry,animation,render,swell,paused,errors},null,2));
  console.log('PASS coast geometry/physics, removed pond/open entrance, floating hull/piles, lamp/sign, real water pixels, pause/reduced motion, sailing/mooring and touch return',JSON.stringify({geometry,animation}));
}finally{await browser.close();}

