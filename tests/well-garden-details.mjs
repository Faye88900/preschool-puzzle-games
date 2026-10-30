import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),errors=[],output='artifacts/models/well-garden-details';
const base=process.env.TEST_URL||'http://127.0.0.1:5208/';
try {
 await mkdir(output,{recursive:true});
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.route(/\/src\/journey\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:'export function startJourney(){return {arrive:async()=>{},dispose(){}}}'}));
 await page.route(/\/src\/maze\.ts(?:\?.*)?$/,async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+'\nconst init=MazeAdventure.prototype.init;MazeAdventure.prototype.init=async function(){window.game=this;await init.call(this)};MazeAdventure.prototype.tick=function(){};'});});
 await page.goto(base+'?level=3&lang=zh');await page.waitForFunction(()=>window.game?.body&&window.game?.root);
 await page.locator('.game-loading').waitFor({state:'detached',timeout:60000});await page.locator('#primary').click();
 const metrics=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{wellGardenPots}=await import('/src/well-garden-details.ts'),g=game,root=g.scene.getObjectByName('garden-well-details');
  const poses=wellGardenPots.map(([dx,dz,width],i)=>{
   const source=g.models.get('kenney-nature/'+(i===2?'pot_large':'pot_small')),copy=source.clone(true);copy.position.set(-40+dx,0,5+dz);copy.scale.setScalar(width);
   const bounds=new T.Box3().setFromObject(copy),obstacles=g.scene.children.filter(o=>['garden-stone-well','garden-bench-01','garden-vine-trellis','garden-mossy-stump','garden-birdbath','garden-barrel-01'].includes(o.name));
   return {min:bounds.min.toArray(),max:bounds.max.toArray(),overlaps:obstacles.filter(o=>bounds.intersectsBox(new T.Box3().setFromObject(o))).map(o=>o.name),hedge:g.walls.some(w=>bounds.intersectsBox(w.bounds))};
  });
  let triangles=0,finite=true;root.traverse(m=>{if(m.isMesh){triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;finite&&=Array.from(m.geometry.attributes.position.array).every(Number.isFinite)&&Array.from(m.geometry.attributes.normal.array).every(Number.isFinite);}});
  const nature=[];g.models.forEach((model,name)=>{if(!name.startsWith('kenney-nature/'))return;let triangles=0;model.traverse(m=>{if(m.isMesh){triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;if(m.material.metalness!==0)throw new Error('Plant/pot must be dielectric');}});nature.push({name,triangles});});
  g.body.setTranslation({x:-39,y:.8,z:7},true);g.previous.copy(g.body.translation());g.render(0);
  g.camera.position.set(-30,8,15);g.camera.lookAt(-38.5,.7,2.4);g.camera.updateMatrixWorld();
  root.visible=false;g.renderer.render(g.scene,g.camera);const before={...g.renderer.info.render};
  root.visible=true;g.renderer.render(g.scene,g.camera);const after={...g.renderer.info.render};
  return {poses,triangles,finite,nature,meshes:root.children.length,before,after,bodies:g.world.bodies.len(),memory:{...g.renderer.info.memory}};
 });
 await page.evaluate(()=>{const g=game;g.scene.getObjectByName('garden-well-details').visible=false;g.renderer.render(g.scene,g.camera);});
 await page.screenshot({path:`${output}/well-yard-before.png`});
 await page.evaluate(()=>{const g=game;g.scene.getObjectByName('garden-well-details').visible=true;g.renderer.render(g.scene,g.camera);});
 await page.screenshot({path:`${output}/well-yard.png`});
 assert.ok(metrics.finite&&metrics.triangles<40000&&metrics.meshes<=14,JSON.stringify(metrics));
 assert.ok(metrics.poses.every(p=>!p.hedge&&!p.overlaps.length&&Math.abs(p.min[1])<.001),JSON.stringify(metrics.poses));
 assert.equal(metrics.nature.length,4);assert.equal(metrics.after.calls-metrics.before.calls,metrics.meshes);
 await page.evaluate(()=>{const g=game;g.camera.position.set(-37,4.2,7);g.camera.lookAt(-43,.8,.6);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);});
 await page.screenshot({path:`${output}/bench-pots.png`});
 await page.evaluate(()=>{const g=game;g.camera.position.set(-32,4.6,9);g.camera.lookAt(-35.8,.8,3.5);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);});
 await page.screenshot({path:`${output}/rope-and-plant.png`});
 await page.evaluate(()=>{const g=game;g.body.setTranslation({x:-41.4,y:.8,z:5.5},true);g.body.setLinvel({x:0,y:0,z:0},true);g.previous.copy(g.body.translation());});
 await page.keyboard.down('ArrowUp');const stoppedAtPot=await page.evaluate(()=>{for(let i=0;i<90;i++)game.step();return game.body.translation();});await page.keyboard.up('ArrowUp');
 assert.ok(stoppedAtPot.z>3.25&&stoppedAtPot.z<3.40,JSON.stringify(stoppedAtPot));
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{const g=game;g.resize();g.camera.position.set(-39,8,13);g.camera.lookAt(-42.8,.7,1);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);});
 await page.screenshot({path:`${output}/well-yard-mobile.png`});
 const hashes=[];for(const name of ['pot_small','pot_large','plant_flatShort','grass_leafs']){
  const data=await readFile(`public/models/kenney-nature/${name}.glb`);assert.equal(data.toString('ascii',0,4),'glTF');assert.equal(data.readUInt32LE(8),data.length);
  hashes.push({name,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});
 }
 assert.match(await readFile('public/models/kenney-nature/License.txt','utf8'),/CC0/);assert.deepEqual(errors,[]);
 await writeFile(`${output}/metrics.json`,JSON.stringify({...metrics,stoppedAtPot,hashes},null,2));
 console.log('PASS free CC0 GLBs, grounded/clear pots, merged finite detail, pot collision and desktop/mobile renders',JSON.stringify({...metrics,stoppedAtPot,hashes}));
}finally{await browser.close();}
