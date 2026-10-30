import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='artifacts/models/wind-sail-boat',errors=[];
try {
  await mkdir(output,{recursive:true});const page=await browser.newPage({viewport:{width:1000,height:900}});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/__boat-model',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5212/')+'__boat-model');
  const result=await page.evaluate(async()=>{
    const T=await import('/node_modules/.vite/deps/three.js'),{createWindSailBoat}=await import('/src/wind-sail-boat.ts');
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const boat=createWindSailBoat(),crystal=boat.getObjectByName('wind-sail-crystal'),initiallyHidden=!crystal.visible;crystal.visible=true;
    const scene=new T.Scene();scene.background=new T.Color('#edf1e7');scene.add(boat,new T.HemisphereLight('#f0faff','#b2a786',2.1));
    const light=new T.DirectionalLight('#fff0d3',2.4);light.position.set(-3,6,5);scene.add(light);
    const camera=new T.OrthographicCamera(-3.6,3.6,3.24,-3.24,.1,40);camera.position.set(6,5.2,8);camera.lookAt(0,1.9,0);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,900);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);renderer.render(scene,camera);
    let triangles=0,meshes=0,finite=true;boat.traverse(m=>{if(!m.isMesh)return;meshes++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;for(const a of Object.values(m.geometry.attributes))finite&&=Array.from(a.array).every(Number.isFinite);});
    const ray=new T.Raycaster(),hull=boat.getObjectByName('boat-hull');
    ray.set(new T.Vector3(0,.84,.3),new T.Vector3(1,0,0));const inner=ray.intersectObject(hull,true)[0]?.point.x;
    ray.set(new T.Vector3(2,.84,.3),new T.Vector3(-1,0,0));const outer=ray.intersectObject(hull,true)[0]?.point.x;
    const floor=[];for(const z of [-.7,.7])for(const x of [-.3,.3]) {
      ray.set(new T.Vector3(x,1.9,z),new T.Vector3(0,-1,0));floor.push(ray.intersectObject(boat.getObjectByName('boat-deck'),true)[0]?.point.y);
    }
    const exterior=[];
    for(const z of [-1.45,-1.35,-.7,0,.7,1.35,1.45])for(const y of [.56,.64,.80,.85])for(const side of [-1,1]) {
      ray.set(new T.Vector3(side*2,y,z),new T.Vector3(-side,0,0));
      const hit=ray.intersectObjects([hull,boat.getObjectByName('boat-deck')],true)[0];
      exterior.push(hit?.object.parent.name==='boat-hull');
    }
    const sail=boat.getObjectByName('boat-sail-cloth'),p=sail.geometry.attributes.position;
    let minX=Infinity,maxX=-Infinity;for(let i=0;i<p.count;i++){minX=Math.min(minX,p.getX(i));maxX=Math.max(maxX,p.getX(i));}
    const bounds=new T.Box3().setFromObject(boat).getSize(new T.Vector3()).toArray();
    const glb=await new GLTFExporter().parseAsync(boat,{binary:true}),loaded=await new GLTFLoader().parseAsync(glb,'');
    window.boatView={T,boat,scene,camera,renderer};
    return {glb:Array.from(new Uint8Array(glb)),metrics:{triangles,meshes,finite,initiallyHidden,inner,outer,thickness:outer-inner,floor,exteriorSamples:exterior.length,contained:exterior.every(Boolean),billow:maxX-minX,bounds,roundtrip:new T.Box3().setFromObject(loaded.scene).getSize(new T.Vector3()).toArray(),calls:renderer.info.render.calls}};
  });
  const m=result.metrics;assert.ok(m.finite&&m.meshes<=28&&m.triangles<35000,JSON.stringify(m));
  assert.ok(m.initiallyHidden&&m.inner>.7&&m.outer>m.inner&&m.thickness>.03,JSON.stringify(m));
  assert.ok(m.floor.every(y=>Math.abs(y-(1.3-.68))<.01),JSON.stringify(m.floor));assert.ok(m.billow>.35);
  assert.ok(m.contained,'Deck and benches must remain inside the hull');
  assert.ok(m.bounds[0]<2.6&&m.bounds[1]<4.8&&m.bounds[2]<4.7,JSON.stringify(m.bounds));
  assert.ok(m.bounds.every((n,i)=>Math.abs(n-m.roundtrip[i])<.001));
  await writeFile(`${output}/wind-sail-boat.glb`,Buffer.from(result.glb));
  for(const component of ['boat-hull','boat-deck']) {
    await page.evaluate(name=>{const s=boatView;for(const c of s.boat.children)c.visible=c.name===name;s.renderer.render(s.scene,s.camera);},component);
    await page.screenshot({path:`${output}/${component}.png`});
  }
  await page.evaluate(()=>{for(const c of boatView.boat.children)c.visible=true;});
  for(const [name,x,y,z] of [['three-quarter',6,5.2,8],['side',8,3,0],['front',0,2.4,8],['back',0,2.4,-8],['top',0,10,.01]]) {
    await page.evaluate(({name,x,y,z})=>{const s=boatView;s.camera.up.set(0,name==='top'?0:1,name==='top'?-1:0);s.camera.position.set(x,y,z);s.camera.lookAt(0,1.9,0);s.renderer.render(s.scene,s.camera);},{name,x,y,z});
    await page.screenshot({path:`${output}/${name}.png`});
  }
  await page.evaluate(async()=>{
    const s=boatView,{createPlayerCharacter}=await import('/src/character.ts');const rider=createPlayerCharacter();rider.remove(rider.getObjectByName('player-marker'));rider.position.set(0,1.3,.7);rider.rotation.y=Math.PI;s.boat.add(rider);
    s.camera.up.set(0,1,0);s.camera.position.set(6,5.2,8);s.camera.lookAt(0,1.9,0);s.renderer.render(s.scene,s.camera);window.boatRider=rider;
  });
  await page.screenshot({path:`${output}/passenger-outbound.png`});
  await page.evaluate(()=>{boatRider.position.z=-.7;boatRider.rotation.y=0;boatView.renderer.render(boatView.scene,boatView.camera);});
  await page.screenshot({path:`${output}/passenger-return.png`});
  assert.deepEqual(errors,[]);await writeFile(`${output}/model-metrics.json`,JSON.stringify(m,null,2));
  console.log('PASS boat thickness/open interior, billowed sail, both rider floor positions, crystal state, model budget and GLB roundtrip',JSON.stringify(m));
} finally {await browser.close();}
