import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='artifacts/models/boat-scenery-visibility',errors=[];
const base=process.env.TEST_URL||'http://127.0.0.1:4409/';
try {
  await mkdir(output,{recursive:true});const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true,reducedMotion:'reduce'});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route(/\/src\/journey\.ts(?:\?.*)?$/,route=>route.fulfill({contentType:'text/javascript',body:'export function startJourney(){return{arrive:async()=>{},dispose(){}}}'}));
  await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nconst __sceneryInit=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;return __sceneryInit.call(this)};MazeAdventure.prototype.tick=function(){};'});});
  await page.goto(base+'?level=3&lang=zh');await page.locator('.game-loading').waitFor({state:'detached'});await page.locator('#primary').click();
  await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),{gardenCoastX,bossCoastX}=await import('/src/ferry-shore-layout.ts'),g=game,distant=g.scene.getObjectByName('maze-distant-islands');g.enemies.forEach(e=>e.hp=0);g.wand=g.treasure=true;g.invulnerable=1000;
    window.scenery={T,distant,positions:distant.children.map(o=>o.position.clone()),gardenCoastX,bossCoastX};
    window.boatView=(x,z,yaw)=>{g.clearInput();g.boat.position.set(x,-.8,z);g.boatSpeed=g.boatTurn=0;g.boatYaw=yaw;g.boatTrip={toBoss:true,elapsed:1,start:new T.Vector3(x,1,z)};g.body.setEnabled(false);g.say('sailing');g.render(0);};
    window.sceneryPlacement=before=>{for(const [i,island]of distant.children.entries())island.position.copy(scenery.positions[i]);if(before){distant.children[2].position.z=-48;distant.children[3].position.z=32;}distant.updateMatrixWorld(true);};
  });
  const screenshots=[];
  for(const [width,height]of [[1280,800],[390,844],[844,390]]){
    await page.setViewportSize({width,height});await page.evaluate(()=>game.resize());
    for(const [name,x,z,yaw]of [['north',128,-26,Math.PI],['south',140,5,0]])for(const before of [true,false]){
      await page.evaluate(({x,z,yaw,before})=>{sceneryPlacement(before);boatView(x,z,yaw);},{x,z,yaw,before});const file=`${name}-${width}-${before?'before':'after'}.png`;await page.screenshot({path:`${output}/${file}`});screenshots.push(file);
    }
  }
  const results=[];
  for(const [width,height]of [[1280,800],[390,844],[844,390]]){
    await page.setViewportSize({width,height});await page.evaluate(()=>game.resize());
    const result=await page.evaluate(()=>{
      const {T,distant,gardenCoastX,bossCoastX}=scenery,g=game;sceneryPlacement(false);const draw=g.renderer.render;g.renderer.render=()=>{};
      const boxes=distant.children.map(o=>new T.Box3().setFromObject(o)),ray=new T.Raycaster(),frustum=new T.Frustum(),projection=new T.Matrix4(),corners=boxes.map(b=>{const p=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])p.push(new T.Vector3(x,y,z));return p;});
      let samples=0,hits=0,maxArea=0,worst=null;const positions=[[135,-12]];
      for(const r of [.55,1])for(let i=0;i<16;i++){const a=i*Math.PI/8;positions.push([135+42*r*Math.cos(a),-12+32*r*Math.sin(a)]);}
      try{for(const [x,z]of positions){if(z>-32&&z<8&&x<gardenCoastX(z)+3||z>-50&&z<0&&x>bossCoastX(z)-3)continue;
        for(let i=0;i<16;i++){
          const yaw=i*Math.PI/8;boatView(x,z,yaw);samples++;
          for(const point of [g.player.position.clone().add(new T.Vector3(0,.4,0)),g.cameraLook.clone()]){const d=point.sub(g.camera.position);ray.set(g.camera.position,d.clone().normalize());ray.far=d.length();hits+=ray.intersectObject(distant,true).length;}
          projection.multiplyMatrices(g.camera.projectionMatrix,g.camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);
          boxes.forEach((box,index)=>{if(!frustum.intersectsBox(box))return;let minX=1,maxX=-1,minY=1,maxY=-1;for(const p of corners[index]){const v=p.clone().project(g.camera);minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);}const area=Math.max(0,Math.min(1,maxX)-Math.max(-1,minX))*Math.max(0,Math.min(1,maxY)-Math.max(-1,minY))/4;if(area>maxArea){maxArea=area;worst={x,z,yaw,island:index,area};}});
        }
      }}finally{g.renderer.render=draw;}
      return{viewport:[innerWidth,innerHeight],samples,hits,maxArea,worst,positions:distant.children.map(o=>o.position.toArray()),bodies:g.world.bodies.len(),colliders:g.world.colliders.len()};
    });results.push(result);
  }
  await writeFile(output+'/scan.json',JSON.stringify(results,null,2));
  assert.ok(results.every(r=>r.samples>=300&&r.hits===0&&r.maxArea<.12),JSON.stringify(results));assert.ok(results.every(r=>r.bodies===192&&r.colliders===265));
  await page.setViewportSize({width:1280,height:800});await page.evaluate(()=>{game.resize();sceneryPlacement(false);boatView(128,-26,Math.PI);});
  await page.keyboard.down('w');const motion=await page.evaluate(()=>{const g=game,start=g.boat.position.clone(),draw=g.renderer.render;g.renderer.render=()=>{};try{for(let i=0;i<60;i++)g.render(1/60);}finally{g.renderer.render=draw;}g.render(0);return{distance:start.distanceTo(g.boat.position),stillSailing:!!g.boatTrip};});await page.keyboard.up('w');assert.ok(motion.distance>.5&&motion.stillSailing,'Boat still responds to throttle');
  assert.deepEqual(errors,[]);await writeFile(output+'/metrics.json',JSON.stringify({pass:true,results,motion,screenshots,errors},null,2));console.log('PASS distant scenery clear of boat/player/focus sightlines, bounded screen area, bay turning sweep and desktop/mobile',JSON.stringify({results,motion}));
}finally{await browser.close();}
