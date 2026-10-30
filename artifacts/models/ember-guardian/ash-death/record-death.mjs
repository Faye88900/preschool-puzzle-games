import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output=process.env.GUARDIAN_OUTPUT||'artifacts/models/ember-guardian',errors=[];
try{
  await mkdir(output,{recursive:true});const page=await browser.newPage({viewport:{width:1100,height:900}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/__ember-guardian',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5397/')+'__ember-guardian');
  const metrics=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),{createEmberGuardian}=await import('/src/ember-guardian.ts'),{createDarkKnight}=await import('/src/dark-knight.ts'),F=await import('/src/guardian-combat.ts');
    const {loadGuardianFlameTexture}=await import('/src/guardian-flames.ts');
    const texture=await loadGuardianFlameTexture(),model=createEmberGuardian(texture),minion=createDarkKnight();let triangles=0,meshes=0;model.updateMatrixWorld(true);
    for(const phase of ['idle','chase','rest']) {
      F.poseEmberGuardian(model,phase,0,1,0,true);model.rotation.y=1.2;model.updateMatrixWorld(true);
      const sword=model.getObjectByName('ember-sword'),wrist=model.getObjectByName('wrist1'),grip=wrist.getWorldPosition(new T.Vector3()),tip=new T.Vector3(0,1.38,0).applyMatrix4(sword.matrixWorld);
      const bladeEdge=new T.Vector3(1,0,0).transformDirection(sword.matrixWorld),knuckles=new T.Vector3(0,0,-1).transformDirection(wrist.matrixWorld);
      if(sword.parent!==wrist||sword.position.length()>.0001||grip.y<.54||grip.y>.7||tip.y<.01||tip.y>.13||tip.y>grip.y-.45||bladeEdge.dot(knuckles)<.999)throw Error('One-handed low grip must keep the blade upright relative to the fist and its tip near the ground: '+JSON.stringify({phase,grip:grip.toArray(),tip:tip.toArray()}));
    }
    const blade=model.getObjectByName('forged-blade');blade.geometry.computeBoundingBox();
    const bladeSize=blade.geometry.boundingBox.getSize(new T.Vector3());
    if(bladeSize.z<.10||bladeSize.x<.18||blade.geometry.groups.length<6)throw Error('Forged blade needs a solid double bevel and central ridge');
    for(const attack of [0,1,2])for(const progress of [0,.25,.5,.75,1]) {
      F.poseEmberGuardian(model,'lunge',attack,progress,0,true);model.updateMatrixWorld(true);
      if(new T.Box3().setFromObject(blade,true).min.y<-.03)throw Error('Swing clips floor '+JSON.stringify({attack,progress,minY:new T.Box3().setFromObject(blade,true).min.y}));
      const wrist=model.getObjectByName('wrist1'),sword=model.getObjectByName('ember-sword');
      if(new T.Vector3(1,0,0).transformDirection(sword.matrixWorld).dot(new T.Vector3(0,0,-1).transformDirection(wrist.matrixWorld))<.999)throw Error('Cutting edge must stay aligned with the knuckles throughout the swing');
    }
    let previousAcross;
    for(let frame=0;frame<=40;frame++) {
      F.poseEmberGuardian(model,'lunge',2,frame/40,0,true);model.updateMatrixWorld(true);
      const across=new T.Vector3(1,0,0).transformDirection(model.getObjectByName('ember-sword').matrixWorld);
      if(previousAcross&&previousAcross.dot(across)<.99)throw Error('Overhead cut must not flip the gripping wrist');
      previousAcross=across;
    }
    model.rotation.y=0;F.poseEmberGuardian(model,'idle',0,0,0,true);model.updateMatrixWorld(true);
    for(const i of [0,1,2]) {
      if(!F.guardianSwordHits(i,{x:0,z:0},{x:0,z:1},{x:0,z:2}))throw Error('Sword must hit inside its warning');
      if(F.guardianSwordHits(i,{x:0,z:0},{x:0,z:1},{x:0,z:-1}))throw Error('Sword must not hit behind the guardian');
      if(F.guardianSwordHits(i,{x:0,z:0},{x:0,z:1},{x:0,z:4}))throw Error('Sword must not hit outside its range');
    }
    if(F.guardianSwordHits(2,{x:0,z:0},{x:1,z:0},{x:2,z:.8})||!F.guardianSwordHits(2,{x:0,z:0},{x:1,z:0},{x:2,z:.6}))throw Error('Slam lane must rotate with locked aim');
    model.traverse(m=>{if(!m.isMesh)return;meshes++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;for(const a of Object.values(m.geometry.attributes))if(!Array.from(a.array).every(Number.isFinite))throw Error('Invalid geometry');});
    const cloth=model.getObjectByName('cape').children.find(m=>m.isMesh&&m.geometry.attributes.color),cp=cloth.geometry.attributes.position;
    let clothVolume=0;const ca=new T.Vector3(),cb=new T.Vector3(),cc=new T.Vector3();
    for(let i=0;i<cp.count;i+=3){ca.fromBufferAttribute(cp,i);cb.fromBufferAttribute(cp,i+1);cc.fromBufferAttribute(cp,i+2);clothVolume+=ca.dot(cb.cross(cc))/6;}
    if(clothVolume<.008||clothVolume>.025)throw Error('The draped cape must be a closed, outward-facing cloth shell: '+clothVolume);
    const flame=model.getObjectByName('sword-residual-flames'),sword=flame.parent;flame.removeFromParent();
    const bounds=new T.Box3().setFromObject(model),old=new T.Box3().setFromObject(minion.getObjectByName('body')),size=bounds.getSize(new T.Vector3()),oldSize=old.getSize(new T.Vector3());sword.add(flame);
    const badge=model.getObjectByName('side-crest');
    const outward=new T.Vector3(0,0,-1).transformDirection(badge.matrixWorld);
    if(outward.x<.90||Math.abs(outward.z)>.05)throw Error('Crest must face outward on the sloped shoulder, not the front');
    const scene=new T.Scene(),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1100,900);renderer.setClearColor('#f7f2e7');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;
    document.body.append(renderer.domElement);scene.add(model,new T.HemisphereLight('#d8efff','#c3b597',1.5));
    const sun=new T.DirectionalLight('#fff0d5',2.6);sun.position.set(-3,5,-4);sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-2,right:2,top:2,bottom:-2,near:.1,far:20});sun.shadow.mapSize.setScalar(1024);sun.shadow.normalBias=.006;scene.add(sun);
    const fill=new T.DirectionalLight('#d8eaff',.4);fill.position.set(3,3,4);scene.add(fill);
    const floor=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:'#f7f2e7',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;scene.add(floor);
    const camera=new T.OrthographicCamera(-1.38,1.38,1.13,-1.13,.1,30),combat=new F.GuardianCombat(model);scene.add(combat.root);
    window.guardianTest={T,F,model,scene,renderer,camera,combat,minion};
    return{meshes,triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},size:size.toArray(),heightRatio:size.y/oldSize.y};
  });
  assert.ok(metrics.meshes<=76&&metrics.triangles<65000&&metrics.bounds.min[1]>-.035&&metrics.heightRatio>1.3&&metrics.heightRatio<1.55,JSON.stringify(metrics));
  const recording=await page.evaluate(async()=>{
    const s=guardianTest,{KNIGHT_DEATH_TIME}=await import('/src/dark-knight.ts');s.combat.reset(s.model,false);
    s.camera.position.set(2.8,1.7,-4);s.camera.lookAt(0,.85,-.2);s.camera.zoom=.9;s.camera.updateProjectionMatrix();
    s.renderer.setSize(550,450);s.renderer.render(s.scene,s.camera);
    const stream=s.renderer.domElement.captureStream(24),recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks=[],images=[];
    recorder.ondataavailable=e=>chunks.push(e.data);const done=new Promise(resolve=>recorder.onstop=resolve);recorder.start();
    const enemy={mesh:s.model,home:new s.T.Vector3(),aim:new s.T.Vector3(0,0,-1),hp:0,phase:'stun',timer:KNIGHT_DEATH_TIME,block:0};
    for(let i=0;i<54;i++){
      if(i>=12)s.combat.update(enemy,{x:0,y:0,z:-2},1/24,i/24,false,()=>true);
      s.renderer.render(s.scene,s.camera);if([18,27,36].includes(i))images.push({frame:i-12,png:s.renderer.domElement.toDataURL()});
      await new Promise(resolve=>setTimeout(resolve,1000/24));
    }
    recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());return{images,video:Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))};
  });
  await writeFile(output+'/animations.webm',Buffer.from(recording.video));
  for(const f of recording.images)await writeFile(`${output}/ash-${f.frame}.png`,Buffer.from(f.png.split(',')[1],'base64'));
  assert.deepEqual(errors,[]);console.log('PASS full-frame ash death preview');
}finally{await browser.close();}
