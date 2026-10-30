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
  for(const[name,x,y,z]of[['front',0,1.25,-4],['side',4,1.25,0],['back',0,1.25,4],['three-quarter',2.4,1.8,-4]]){
    await page.evaluate(({x,y,z})=>{const s=guardianTest;s.camera.position.set(x,y,z);s.camera.lookAt(0,.88,-.20);s.renderer.render(s.scene,s.camera);},{x,y,z});await page.screenshot({path:`${output}/${name}.png`});
  }
  await page.evaluate(()=>{const s=guardianTest;s.camera.left=-.48;s.camera.right=.48;s.camera.top=.393;s.camera.bottom=-.393;s.camera.updateProjectionMatrix();s.camera.position.set(2.4,1.45,-4);s.camera.lookAt(.35,.86,-.30);s.renderer.render(s.scene,s.camera);});await page.screenshot({path:output+'/grip-closeup.png'});
  await page.evaluate(()=>{const s=guardianTest;s.camera.left=-1.38;s.camera.right=1.38;s.camera.top=1.13;s.camera.bottom=-1.13;s.camera.updateProjectionMatrix();});
  await page.evaluate(()=>{const s=guardianTest;s.model.position.x=.65;s.minion.position.x=-.72;s.scene.add(s.minion);s.camera.position.set(2,1.8,-5);s.camera.lookAt(0,.84,0);s.renderer.render(s.scene,s.camera);});await page.screenshot({path:output+'/comparison.png'});
  await page.evaluate(()=>{guardianTest.minion.removeFromParent();guardianTest.model.position.x=0;});
  for(const t of [0,.2,.4,.6]) {
    await page.evaluate(t=>{
      const s=guardianTest;s.F.poseEmberGuardian(s.model,'chase',0,0,t,false,true);
      if(s.model.getObjectByName('chest').rotation.x>-.08)throw Error('Pursuit needs a forward torso lean');
      for(const side of [-1,1])if(Math.abs(s.model.getObjectByName(`knee${side}`).rotation.x)>.85)throw Error('Walk must not remain in a crouched seated pose');
      s.camera.position.set(4,1.2,0);s.camera.lookAt(0,.85,-.15);s.renderer.render(s.scene,s.camera);
    },t);
    await page.screenshot({path:`${output}/walk-side-${t}.png`});
  }
  await page.evaluate(()=>guardianTest.F.poseEmberGuardian(guardianTest.model,'idle',0,0,0,true));
  const fire=await page.evaluate(async()=>{
    const s=guardianTest,{animateGuardianFlames}=await import('/src/guardian-flames.ts'),flame=s.model.getObjectByName('sword-residual-flames');
    s.camera.position.set(2.4,1.8,-4);s.camera.lookAt(0,.88,-.20);
    const sample=(time,visible)=>{flame.visible=visible;animateGuardianFlames(s.model,time,false);s.renderer.render(s.scene,s.camera);const gl=s.renderer.getContext(),p=new Uint8Array(1100*900*4);gl.readPixels(0,0,1100,900,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
    const a=sample(.13,true),b=sample(.53,true),off=sample(.53,false);let changed=0,visible=0;
    for(let i=0;i<a.length;i+=4){if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>12)changed++;if(Math.abs(b[i]-off[i])+Math.abs(b[i+1]-off[i+1])+Math.abs(b[i+2]-off[i+2])>12)visible++;}
    flame.visible=true;animateGuardianFlames(s.model,1,true);s.renderer.render(s.scene,s.camera);const stillA=new Uint8Array(1100*900*4),gl=s.renderer.getContext();gl.readPixels(0,0,1100,900,gl.RGBA,gl.UNSIGNED_BYTE,stillA);
    animateGuardianFlames(s.model,5,true);s.renderer.render(s.scene,s.camera);const stillB=new Uint8Array(stillA.length);gl.readPixels(0,0,1100,900,gl.RGBA,gl.UNSIGNED_BYTE,stillB);
    const texture=flame.material.uniforms.uFlame.value;
    return{changed,visible,reducedStill:stillA.every((v,i)=>v===stillB[i]),instances:flame.geometry.instanceCount,texture:[texture.image.width,texture.image.height],calls:s.renderer.info.render.calls};
  });
  assert.ok(fire.changed>100&&fire.visible>100&&fire.reducedStill&&fire.instances<=12,JSON.stringify(fire));
  for(const phase of ['warn','lunge','rest','stun']){
    await page.evaluate(phase=>{const s=guardianTest;s.F.poseEmberGuardian(s.model,phase,0,.5,1,true);s.camera.position.set(2.4,1.8,-4);s.camera.lookAt(0,.88,0);s.renderer.render(s.scene,s.camera);},phase);await page.screenshot({path:`${output}/${phase}.png`});
  }
  for(const [name,phase,progress]of [['load','warn',1],['contact','lunge',.48],['follow-through','lunge',1],['recover','rest',.7]]) {
    await page.evaluate(({phase,progress})=>{
      const s=guardianTest;s.F.poseEmberGuardian(s.model,phase,1,progress,0,true);s.model.updateMatrixWorld(true);
      if(phase==='lunge') {
        const direction=new s.T.Vector3(0,1,0).transformDirection(s.model.getObjectByName('ember-sword').matrixWorld);
        if(Math.abs(direction.y)>.15)throw Error('Sweep must stay near horizontal');
      }
      if(phase==='warn'&&Math.abs(s.model.getObjectByName('chest').rotation.y)<.3)throw Error('Sweep must load the torso');
      for(const side of [-1,1])s.model.getObjectByName(`ankle${side}`).traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();if(new s.T.Box3().setFromObject(o,true).min.y<-.025)throw Error('Sweep foot sinks into floor');}});
      s.camera.position.set(2.8,1.7,-4);s.camera.lookAt(0,.85,-.20);s.renderer.render(s.scene,s.camera);
    },{phase,progress});
    await page.screenshot({path:`${output}/sweep-${name}.png`});
  }
  for(const [name,phase,progress]of [['raised','warn',1],['impact','lunge',.6],['settle','lunge',1],['recover','rest',.6]]) {
    await page.evaluate(({phase,progress})=>{
      const s=guardianTest;s.F.poseEmberGuardian(s.model,phase,2,progress,0,true);s.model.updateMatrixWorld(true);
      if(phase==='warn'&&s.model.getObjectByName('wrist1').getWorldPosition(new s.T.Vector3()).y<1.2)throw Error('Heavy slam must raise the gripping hand');
      if(phase==='lunge'&&s.model.getObjectByName('chest').rotation.x>-.15)throw Error('Heavy slam needs a forward torso drive');
      for(const side of [-1,1])s.model.getObjectByName(`ankle${side}`).traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();if(new s.T.Box3().setFromObject(o,true).min.y<-.025)throw Error('Heavy slam foot sinks into floor');}});
      s.camera.zoom=.66;s.camera.updateProjectionMatrix();s.camera.position.set(3.2,1.8,-4);s.camera.lookAt(0,1.3,-.2);s.renderer.render(s.scene,s.camera);
    },{phase,progress});
    await page.screenshot({path:`${output}/slam-${name}.png`});
  }
  for(const time of [0,.6,1.2,1.8]) {
    await page.evaluate(time=>{
      const s=guardianTest;s.F.poseEmberGuardian(s.model,'idle',0,0,time,false);s.model.updateMatrixWorld(true);
      if(Math.abs(s.model.getObjectByName('body').position.y)>.0001)throw Error('Idle should breathe without lifting the whole body');
      if(time===.6&&Math.abs(s.model.getObjectByName('chest').rotation.x)<.01)throw Error('Idle breathing must articulate the chest');
      if(new s.T.Box3().setFromObject(s.model.getObjectByName('forged-blade'),true).min.y<0)throw Error('Idle sword must remain above the ground');
      s.camera.zoom=1;s.camera.updateProjectionMatrix();s.camera.position.set(2.8,1.7,-4);s.camera.lookAt(0,.85,-.20);s.renderer.render(s.scene,s.camera);
    },time);
    await page.screenshot({path:`${output}/idle-${time}.png`});
  }
  for(const [name,progress]of [['impact',.10],['brace',.30],['recover',.70],['settled',1]]) {
    await page.evaluate(progress=>{
      const s=guardianTest;s.F.poseEmberGuardian(s.model,'stun',0,progress,0,true);s.model.updateMatrixWorld(true);
      if(progress===.10&&s.model.getObjectByName('chest').rotation.x<.2)throw Error('Hit reaction must respond within 80 ms');
      if(progress===1&&Math.abs(s.model.getObjectByName('chest').rotation.x)>.001)throw Error('Hit reaction must settle');
      if(new s.T.Box3().setFromObject(s.model.getObjectByName('forged-blade'),true).min.y<0)throw Error('Hit reaction sword clips the floor');
      s.camera.position.set(2.8,1.7,-4);s.camera.lookAt(0,.85,-.20);s.renderer.render(s.scene,s.camera);
    },progress);await page.screenshot({path:`${output}/hurt-${name}.png`});
  }
  const animation=await page.evaluate(async()=>{
    const s=guardianTest,bones=[];s.model.traverse(o=>{if(o.isBone)bones.push(o);});
    const snapshot=()=>bones.flatMap(b=>[...b.position.toArray(),...b.quaternion.toArray()]);
    const pose=(phase,attack,p,time,moving=false,dead=false)=>s.F.poseEmberGuardian(s.model,phase,attack,p,time,false,moving,dead);
    const hurtPoses=[];
    for(const attack of [0,1,2]) {
      pose('stun',attack,.18,0);hurtPoses.push(s.model.getObjectByName('chest').rotation.toArray().slice(0,3));
      for(let f=0;f<=40;f++) {
        pose('stun',attack,f/40,0);s.model.updateMatrixWorld(true);
        if(new s.T.Box3().setFromObject(s.model.getObjectByName('forged-blade'),true).min.y<-.01)throw Error('Contextual hurt clips sword through floor: '+attack+' '+f);
        for(const side of [-1,1])s.model.getObjectByName(`ankle${side}`).traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();if(new s.T.Box3().setFromObject(o,true).min.y<-.01)throw Error('Contextual hurt foot clips floor');}});
      }
    }
    if(hurtPoses[0][0]<.2||hurtPoses[1][1]<.3||hurtPoses[2][0]>-.3)throw Error('Each previous attack must cause a distinct reaction');
    for(const attack of [0,1,2]) {
      pose('warn',attack,1,0);const before=snapshot();pose('lunge',attack,0,0);
      const matches=values=>bones.every((b,i)=>b.position.distanceTo(new s.T.Vector3(...values.slice(i*7,i*7+3)))<.001&&Math.abs(b.quaternion.dot(new s.T.Quaternion(...values.slice(i*7+3,i*7+7))))>.9999);
      if(!matches(before))throw Error('Windup must connect to strike without snapping');
      pose('lunge',attack,1,0);const end=snapshot();pose('rest',attack,0,0);
      if(!matches(end))throw Error('Strike must connect to recovery without snapping');
      for(const phase of ['warn','lunge','rest'])for(let f=0;f<=20;f++) {
        pose(phase,attack,f/20,0);s.model.updateMatrixWorld(true);
        if(new s.T.Box3().setFromObject(s.model.getObjectByName('forged-blade'),true).min.y<-.04)throw Error('Animated sword clips floor: '+phase+attack+' '+f);
      }
    }
    for(const [phase,moving,period]of [['idle',false,2.4],['chase',true,.8]]) {
      pose(phase,0,0,0,moving);const start=snapshot();pose(phase,0,0,period-.0001,moving);
      if(start.some((x,i)=>Math.abs(x-snapshot()[i])>.002))throw Error('Locomotion loop must close');
    }
    const {poseGuardianSwordAttack}=await import('/src/guardian-footwork.ts'),{aimGuardianSword}=await import('/src/ember-guardian.ts');
    const sweepDirection=t=>{pose('idle',0,0,0);poseGuardianSwordAttack(s.model,t,1,aimGuardianSword);s.model.updateMatrixWorld(true);return new s.T.Vector3(0,1,0).transformDirection(s.model.getObjectByName('ember-sword').matrixWorld);};
    for(const t of [1.2,1.48]) {
      const before=sweepDirection(t-.001),at=sweepDirection(t),after=sweepDirection(t+.001),incoming=before.angleTo(at)/.001,outgoing=at.angleTo(after)/.001;
      if(incoming<.5||outgoing<.5||Math.abs(incoming-outgoing)/Math.max(incoming,outgoing)>.05)throw Error('Sword must pass through intermediate sweep keys with continuous velocity: '+JSON.stringify({t,incoming,outgoing}));
    }
    s.camera.position.set(2.8,1.7,-4);s.camera.lookAt(0,.85,-.20);
    for(const [phase,moving,dead]of [['chase',true,false],['stun',false,false],['stun',false,true]])for(let f=0;f<=10;f++) {
      pose(phase,0,f/10,f/10*.8,moving,dead);s.model.updateMatrixWorld(true);
      for(const side of [-1,1])s.model.getObjectByName(`ankle${side}`).traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();if(new s.T.Box3().setFromObject(o,true).min.y<-.005)throw Error('Foot sinks into floor');}});
    }
    s.renderer.setSize(550,450);s.renderer.shadowMap.enabled=false;
    const stream=s.renderer.domElement.captureStream(24),recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks=[];
    recorder.ondataavailable=e=>chunks.push(e.data);const done=new Promise(resolve=>recorder.onstop=resolve);recorder.start();
    const {KNIGHT_DEATH_TIME,animateKnightAsh}=await import('/src/dark-knight.ts');
    const ordinaryMaterials=new Map();s.minion.traverse(m=>{if(m.isMesh)ordinaryMaterials.set(m,m.material);});
    animateKnightAsh(s.minion,.5,true);s.scene.add(s.minion);s.renderer.render(s.scene,s.camera);
    if(!s.minion.getObjectByName('ash-dust').visible)throw Error('Ordinary knight ash must remain functional');
    animateKnightAsh(s.minion,0,true);s.minion.removeFromParent();
    for(const [mesh,material]of ordinaryMaterials)if(mesh.material!==material)throw Error('Ordinary knight materials must restore unchanged');
    const originalMaterials=new Map();s.model.traverse(m=>{if(m.isMesh)originalMaterials.set(m,m.material);});
    const swordMaterials=s.model.getObjectByName('forged-blade').material;
    const deadEnemy={mesh:s.model,home:new s.T.Vector3(),aim:new s.T.Vector3(0,0,-1),hp:0,phase:'stun',timer:KNIGHT_DEATH_TIME*.5,block:0};
    s.combat.update(deadEnemy,{x:0,y:0,z:-2},0,0,false,()=>true);s.renderer.render(s.scene,s.camera);
    if(!s.model.getObjectByName('ash-dust').visible||s.model.getObjectByName('sword-residual-flames').visible||s.model.getObjectByName('blade-glow').visible)throw Error('Boss death must emit ash and extinguish sword VFX');
    const dissolved=s.model.getObjectByName('forged-blade').material;
    if(!Array.isArray(dissolved)||dissolved.some((m,i)=>m===swordMaterials[i]))throw Error('Every multi-material sword surface must dissolve');
    deadEnemy.timer=0;s.combat.update(deadEnemy,{x:0,y:0,z:-2},0,1,false,()=>true);
    if(s.model.visible||s.model.getObjectByName('ash-dust').visible)throw Error('Defeated boss must finish disappearing');
    s.combat.reset(s.model,true);
    for(const [mesh,material]of originalMaterials)if(mesh.material!==material)throw Error('Reset must restore exact original material references');
    if(!s.model.visible||!s.model.getObjectByName('body').visible||!s.model.getObjectByName('sword-residual-flames').visible)throw Error('Reset must restore boss and fire');
    const sequences=[['idle',0,.5,false,false],['stun',0,KNIGHT_DEATH_TIME,false,true]];
    let clock=0;const deathFrames=[];
    for(const [phase,attack,duration,moving,dead]of sequences) {
      let enemy;
      if(phase==='stun') {
        s.combat.attack=attack;s.combat.reactToHit(s.model,{x:0,z:-2});
        enemy={mesh:s.model,home:new s.T.Vector3(),aim:new s.T.Vector3(0,0,-1),hp:dead?0:2,phase:'stun',timer:dead?KNIGHT_DEATH_TIME:.8,block:0};
      }else s.model.position.set(0,0,0);
      for(let f=0;f<Math.ceil(duration*24);f++) {
        const p=f/(Math.ceil(duration*24)-1);
        if(enemy)s.combat.update(enemy,{x:0,y:0,z:-2},1/24,clock,false,()=>true);else pose(phase,attack,p,clock,moving,dead);
        s.renderer.render(s.scene,s.camera);clock+=1/24;
        if(dead&&[6,15,24].includes(f))deathFrames.push({frame:f,png:s.renderer.domElement.toDataURL('image/png')});
        await new Promise(resolve=>setTimeout(resolve,1000/24));
      }
    }
    recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());
    s.renderer.setSize(1100,900);s.renderer.shadowMap.enabled=true;s.renderer.render(s.scene,s.camera);
    return{bones:bones.length,clips:s.model.animations.map(c=>c.name),deathFrames,video:Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))};
  });
  await writeFile(output+'/animations.webm',Buffer.from(animation.video));
  for(const frame of animation.deathFrames)await writeFile(`${output}/ash-${frame.frame}.png`,Buffer.from(frame.png.split(',')[1],'base64'));
  await page.screenshot({path:output+'/preview-end.png'});
  const data=await page.evaluate(async()=>{
    const s=guardianTest;s.model.position.set(0,0,0);s.combat.reset(s.model,true);
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    // Animated billboard fire is runtime VFX, not part of the reference GLB.
    const flame=s.model.getObjectByName('sword-residual-flames'),sword=flame.parent;flame.removeFromParent();
    const bytes=await new GLTFExporter().parseAsync(s.model,{binary:true,animations:s.model.animations}),gltf=await new GLTFLoader().parseAsync(bytes,''),loaded=gltf.scene;
    if(gltf.animations.length!==15)throw Error('All 15 animation clips must survive GLB export');
    let skins=0;loaded.traverse(m=>{if(m.isSkinnedMesh){skins++;if(m.skeleton.bones.length!==18)throw Error('Incomplete guardian skeleton');}});
    if(skins<60)throw Error('Armor must be bound to the exported skeleton');
    const mixer=new s.T.AnimationMixer(loaded),walk=mixer.clipAction(gltf.animations.find(a=>a.name==='walk'));walk.play();mixer.update(.2);
    if(Math.abs(loaded.getObjectByName('knee1').rotation.x)<.1)throw Error('Exported walk must articulate the knee');
    mixer.stopAllAction();mixer.clipAction(gltf.animations.find(a=>a.name==='idle')).play();mixer.update(0);
    // Exporter omits hidden dazed-eye overlays, so compare visible geometry on both sides.
    const visibleSize=root=>{const bounds=new s.T.Box3();root.updateMatrixWorld(true);root.traverseVisible(m=>{if(m.isMesh)bounds.union(new s.T.Box3().setFromObject(m,true));});return bounds.getSize(new s.T.Vector3());};
    const a=visibleSize(s.model),b=visibleSize(loaded);
    if(a.distanceTo(b)>.0001||!loaded.getObjectByName('ember-sword')||!loaded.getObjectByName('head'))throw Error('GLB roundtrip changed the model: '+JSON.stringify({before:a.toArray(),after:b.toArray()}));
    sword.add(flame);
    s.renderer.render(s.scene,s.camera);const gl=s.renderer.getContext(),pixels=new Uint8Array(1100*900*4);gl.readPixels(0,0,1100,900,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let dark=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<140&&pixels[i+1]<140&&pixels[i+2]<150)dark++;
    return{bytes:Array.from(new Uint8Array(bytes)),dark};
  });
  assert.ok(data.dark>20000);await writeFile(output+'/ember-guardian.glb',Buffer.from(data.bytes));assert.deepEqual(errors,[]);
  await writeFile(output+'/model-result.json',JSON.stringify({pass:true,metrics,fire,animation:{bones:animation.bones,clips:animation.clips},bytes:data.bytes.length,darkPixels:data.dark,errors},null,2));console.log('PASS model geometry, slim scale, side crest, views, sword poses, animated licensed fire pixels, reduced motion, GLB roundtrip',JSON.stringify({metrics,fire}));
}finally{await browser.close();}













