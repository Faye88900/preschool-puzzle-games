import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='artifacts/models/garden-scout-idle',errors=[];
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:900,height:900}});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/__scout',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5212/')+'__scout');
  const result=await page.evaluate(async()=>{
    const T=await import('/node_modules/.vite/deps/three.js');
    const {createGardenScout,animateGardenScout,resetGardenScout}=await import('/src/garden-scout.ts');
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
    const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const model=createGardenScout(),scene=new T.Scene();scene.add(model,new T.HemisphereLight('#edfcff','#a0a48b',2));
    const light=new T.DirectionalLight('#fff1db',2.3);light.position.set(-3,5,-4);scene.add(light);
    const camera=new T.OrthographicCamera(-1.1,1.1,1.25,-.95,.1,20);camera.position.set(0,.2,-5);camera.lookAt(0,.2,0);
    const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(900,900);renderer.setClearColor(0,0);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
    renderer.render(scene,camera);const portrait=renderer.domElement.toDataURL('image/png');
    const data=await new GLTFExporter().parseAsync(model,{binary:true});const loaded=await new GLTFLoader().parseAsync(data,'');
    let triangles=0,meshes=0,finite=true;model.traverse(m=>{if(!m.isMesh)return;meshes++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;for(const a of Object.values(m.geometry.attributes))finite&&=Array.from(a.array).every(Number.isFinite);});
    const bounds=new T.Box3().setFromObject(model),roundtrip=new T.Box3().setFromObject(loaded.scene).getSize(new T.Vector3()).toArray();
    const costume=['scout-leaf-hood','scout-leaf-cape','scout-scarf','scout-map-satchel','scout-map-strap','scout-wind-staff'].every(name=>!!model.getObjectByName(name));
    const ray=new T.Raycaster(),boots=model.getObjectByName('scout-boot-details'),soles=model.getObjectByName('scout-soles');
    const height=(objects,x,z,up)=>{
      ray.set(new T.Vector3(x,up?-1:0,z),new T.Vector3(0,up?1:-1,0));
      return ray.intersectObjects(objects,true)[0]?.point.y;
    };
    const footing={bodyOverlap:Infinity,soleOverlap:Infinity,groundError:0,bodySamples:0,soleSamples:0};
    let simulated=0;
    for(const [time,near] of [[0,true],[Math.PI/3.6,true],[Math.PI*3/3.6,true],[3.8,false],[10.5,false],[13.5,false]]) {
      while(simulated<time){simulated=Math.min(time,simulated+.05);animateGardenScout(model,simulated,near,false);}
      animateGardenScout(model,time,near,false);model.updateMatrixWorld(true);
      for(const side of [-1,1])for(const dx of [-.085,0,.085])for(const dz of [-.04,0,.04]) {
        const x=side*.30+dx,z=-.035+dz;
        const bottom=height([model.getObjectByName('body')],x,z,true);
        const top=height([model.getObjectByName('foot'+side),boots],x,z,false);
        if(!Number.isFinite(bottom)||!Number.isFinite(top))throw new Error('Missing solid ankle contact');
        footing.bodyOverlap=Math.min(footing.bodyOverlap,top-bottom);footing.bodySamples++;
      }
    }
    for(const side of [-1,1])for(const dx of [-.10,0,.10])for(const dz of [-.16,0,.16]) {
      const x=side*.30+dx,z=-.13+dz;
      const shoeBottom=height([model.getObjectByName('foot'+side)],x,z,true);
      const soleTop=height([soles],x,z,false),soleBottom=height([soles],x,z,true);
      if(![shoeBottom,soleTop,soleBottom].every(Number.isFinite))throw new Error('Missing shoe or sole surface');
      footing.soleOverlap=Math.min(footing.soleOverlap,soleTop-shoeBottom);
      footing.groundError=Math.max(footing.groundError,Math.abs(.612+soleBottom*.9));footing.soleSamples++;
    }
    resetGardenScout(model);animateGardenScout(model,0,true,false);animateGardenScout(model,1,true,false);const wave=model.getObjectByName('arm1').rotation.z;
    animateGardenScout(model,2,false,true);const reduced=model.getObjectByName('scout-upper').position.y===0&&model.getObjectByName('scout-pinwheel').rotation.z===0;
    window.modelView={T,model,scene,camera,renderer};
    return {portrait,glb:Array.from(new Uint8Array(data)),metrics:{triangles,meshes,finite,costume,footing,bounds:bounds.getSize(new T.Vector3()).toArray(),bottom:bounds.min.y,roundtrip,wave,reduced}};
  });
  assert.ok(result.metrics.finite&&result.metrics.costume&&result.metrics.triangles<45000&&result.metrics.meshes<42,JSON.stringify(result.metrics));assert.ok(result.metrics.reduced&&result.metrics.wave>1);
  assert.ok(result.metrics.bounds.every((n,i)=>Math.abs(n-result.metrics.roundtrip[i])<.001));
  assert.ok(result.metrics.footing.bodyOverlap>.02&&result.metrics.footing.soleOverlap>.005&&result.metrics.footing.groundError<.00001,JSON.stringify(result.metrics.footing));
  await writeFile('public/images/garden-scout-dialogue.png',Buffer.from(result.portrait.split(',')[1],'base64'));
  await writeFile(`${output}/garden-scout.glb`,Buffer.from(result.glb));
  for(const [name,x,y,z] of [['front',0,.2,-5],['side',5,.2,0],['back',0,.2,5],['three-quarter',3,.2,-5],['game-angle',1.5,3.2,-5]]) {
    await page.evaluate(({x,y,z,zoom})=>{const s=modelView;s.scene.background=new s.T.Color('#edf1e6');s.camera.zoom=zoom;s.camera.updateProjectionMatrix();s.camera.position.set(x,y,z);s.camera.lookAt(0,.2,0);s.renderer.render(s.scene,s.camera);},{x,y,z,zoom:name==='game-angle'?.85:1});
    await page.screenshot({path:`${output}/${name}.png`});
  }
  await page.evaluate(async()=>{
    const s=modelView,{animateGardenScout,resetGardenScout}=await import('/src/garden-scout.ts');
    resetGardenScout(s.model);animateGardenScout(s.model,0,true,false);animateGardenScout(s.model,1,true,false);s.camera.zoom=1;s.camera.updateProjectionMatrix();s.camera.position.set(0,.2,-5);s.camera.lookAt(0,.2,0);s.renderer.render(s.scene,s.camera);
  });
  await page.screenshot({path:`${output}/greeting.png`});
  await page.evaluate(()=>{
    const s=modelView;s.camera.left=s.camera.bottom=-.7;s.camera.right=s.camera.top=.7;s.camera.position.set(0,-.35,-5);s.camera.lookAt(0,-.35,0);s.camera.updateProjectionMatrix();s.renderer.render(s.scene,s.camera);
  });
  await page.screenshot({path:`${output}/feet-front.png`});
  await page.evaluate(async()=>{
    const s=modelView,{animateGardenScout,resetGardenScout}=await import('/src/garden-scout.ts');
    const ground=new s.T.Mesh(new s.T.PlaneGeometry(5,5),new s.T.MeshStandardMaterial({color:'#e8ebdc',roughness:1}));
    ground.rotation.x=-Math.PI/2;ground.position.y=-.681;ground.receiveShadow=true;s.scene.add(ground);
    s.renderer.shadowMap.enabled=true;s.renderer.shadowMap.type=s.T.PCFSoftShadowMap;
    const light=s.scene.children.find(o=>o.isDirectionalLight);light.castShadow=true;light.shadow.mapSize.set(1024,1024);
    s.camera.left=s.camera.bottom=-1.25;s.camera.right=s.camera.top=1.25;s.camera.zoom=1;s.camera.updateProjectionMatrix();
    s.camera.position.set(2,2.5,-5);s.camera.lookAt(0,.20,0);
    resetGardenScout(s.model);
    window.idleDemo={time:0,reset(){resetGardenScout(s.model);this.time=0;},advance(to,near=false,reduced=false,talking=false){
      while(this.time<to){this.time=Math.min(to,this.time+.025);animateGardenScout(s.model,this.time,near,reduced,talking);}
      animateGardenScout(s.model,to,near,reduced,talking);s.renderer.render(s.scene,s.camera);
      return {phase:s.model.userData.scoutIdle.phase,map:s.model.getObjectByName('scout-open-map').visible,
        roll:s.model.getObjectByName('scout-map-roll').visible,arm:s.model.getObjectByName('arm1').rotation.z,
        rootYaw:s.model.rotation.y,soleY:s.model.getObjectByName('scout-soles').position.y};
    }};
  });
  const idle=[];
  for(const [name,time,near] of [['checking-wind',3.8,false],['reading-map',11,false],['looking-up',13.7,false],['rest',16,false],['greeting',17.1,true],['attentive',20,true]]) {
    const state=await page.evaluate(({time,near})=>idleDemo.advance(time,near),{time,near});
    assert.equal(state.phase,name);assert.equal(state.rootYaw,0);assert.equal(state.soleY,0);idle.push({name,...state});
    await page.screenshot({path:`${output}/${name}.png`});
  }
  const interruption=await page.evaluate(()=>{
    idleDemo.reset();idleDemo.advance(11,false);const stow=idleDemo.advance(11.05,true);
    const greeting=idleDemo.advance(12,true),waiting=idleDemo.advance(15,true);
    idleDemo.advance(15.1,false);const cooldown=idleDemo.advance(15.2,true);
    const talking=idleDemo.advance(16,true,false,true);
    idleDemo.advance(24,false);const reduced=idleDemo.advance(30,false,true);
    idleDemo.reset();const reset=idleDemo.advance(0,false);return {stow,greeting,waiting,cooldown,talking,reduced,reset};
  });
  assert.equal(interruption.stow.phase,'stowing-map');assert.equal(interruption.greeting.phase,'greeting');
  assert.ok(!interruption.greeting.map&&interruption.greeting.roll);
  assert.equal(interruption.waiting.arm,.05);assert.equal(interruption.cooldown.phase,'attentive');
  assert.equal(interruption.talking.phase,'talking');assert.equal(interruption.talking.arm,.05);
  assert.ok(!interruption.reduced.map&&interruption.reduced.arm===.05&&interruption.reset.phase==='rest');
  await writeFile(`${output}/idle-checks.json`,JSON.stringify({pass:true,idle,interruption},null,2));
  const recording=await page.evaluate(()=>new Promise(resolve=>{
    const s=modelView,stream=s.renderer.domElement.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'}),chunks=[],timeline=[];
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());resolve({bytes:Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer())),timeline});};
    idleDemo.reset();const start=performance.now();recorder.start();
    const frame=now=>{
      const time=Math.min(20.3,(now-start)/1000),state=idleDemo.advance(time,time>=11.2&&time<17.8);
      if(timeline.at(-1)?.phase!==state.phase)timeline.push({time,phase:state.phase});
      if(time<20.3)requestAnimationFrame(frame);else recorder.stop();
    };requestAnimationFrame(frame);
  }));
  await writeFile(`${output}/idle-and-greeting.webm`,Buffer.from(recording.bytes));
  await writeFile(`${output}/animation-timeline.json`,JSON.stringify(recording.timeline,null,2));
  assert.deepEqual(errors,[]);await writeFile(`${output}/model-metrics.json`,JSON.stringify(result.metrics,null,2));
  console.log('PASS scout model, GLB roundtrip, expressive pose/reduced motion, generated matching portrait',JSON.stringify(result.metrics));
} finally {await browser.close();}
