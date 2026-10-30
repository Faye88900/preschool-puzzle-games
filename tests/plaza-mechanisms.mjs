import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='artifacts/models/plaza-mechanisms',errors=[];
try{
  await mkdir(output,{recursive:true});const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('**/__plaza-mechanisms',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5218/')+'__plaza-mechanisms');
  const metrics=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),F=await import('/src/plaza-mechanisms.ts');
    const roots=[F.createGardenWindmill(),F.createGardenBridge(),F.createGardenGate('exit'),F.createGardenGate('shortcut')];
    const scene=new T.Scene(),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1280,900);renderer.setPixelRatio(1);
    renderer.setClearColor('#f7f2e7');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#eef4ff','#aa9678',1.8));const sun=new T.DirectionalLight('#fff0d4',2.6);sun.position.set(-5,10,7);sun.castShadow=true;sun.shadow.mapSize.setScalar(2048);
    Object.assign(sun.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:.1,far:40});sun.shadow.normalBias=.008;scene.add(sun);
    const floor=new T.Mesh(new T.PlaneGeometry(60,60),new T.MeshStandardMaterial({color:'#f7f2e7',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.06;floor.receiveShadow=true;scene.add(floor);
    const camera=new T.OrthographicCamera(-4.5,4.5,3.164,-3.164,.1,60);
    const result=roots.map(root=>{
      root.updateMatrixWorld(true);let finite=true,triangles=0,meshes=0;root.traverse(m=>{if(m.isMesh){meshes++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;finite&&=[...m.geometry.attributes.position.array,...m.geometry.attributes.normal.array,...m.geometry.attributes.uv.array].every(Number.isFinite);}});
      const b=new T.Box3().setFromObject(root);return {name:root.name,finite,meshes,triangles,min:b.min.toArray(),max:b.max.toArray()};
    });
    const exit=roots[2],plaque=exit.getObjectByName('exit-nameplate'),label=exit.getObjectByName('exit-nameplate-text');
    if(plaque?.parent!==exit.getObjectByName('gate-frame')||label?.userData.label!=='出口'||roots[3].getObjectByName('exit-nameplate'))throw Error('Exit plaque must belong only to the fixed exit frame');
    const plaqueBounds=new T.Box3().setFromObject(plaque),closedTop=new T.Box3().setFromObject(exit.getObjectByName('gate-grille')).max.y;
    if(plaqueBounds.min.y<=closedTop+.04)throw Error('Exit plaque must clear the closed grille');
    for(const text of ['Exit','Keluar']){const translated=F.createGardenGate('exit',text).getObjectByName('exit-nameplate-text');if(translated.userData.label!==text||translated.material.map===label.material.map)throw Error('Exit text cache must respect the selected language');}
    const ray=new T.Raycaster(),passages=[];
    for(const root of roots.slice(2)){
      const grille=root.getObjectByName('gate-grille');root.updateMatrixWorld(true);ray.set(new T.Vector3(0,1.43,3),new T.Vector3(0,0,-1));
      const closed=ray.intersectObject(root,true).length>0;grille.position.y=-4;root.updateMatrixWorld(true);
      const open=[-1.5,0,1.5].every(x=>{ray.set(new T.Vector3(x,1,3),new T.Vector3(0,0,-1));return ray.intersectObject(root,true).length===0;});
      const below=new T.Box3().setFromObject(grille).max.y<0;
      if(root===exit&&!plaqueBounds.equals(new T.Box3().setFromObject(plaque)))throw Error('Opening the grille moved the exit plaque');
      grille.position.y=0;passages.push({closed,open,below});
    }
    const bridge=roots[1],deck=bridge.getObjectByName('bridge-deck'),anchor=bridge.getObjectByName('bridge-abutments');bridge.updateMatrixWorld(true);
    const fixed=new T.Box3().setFromObject(anchor),pivot=deck.position.clone();deck.rotation.z=1.15;bridge.updateMatrixWorld(true);
    const raised=new T.Box3().setFromObject(deck).max.y>4&&fixed.equals(new T.Box3().setFromObject(anchor))&&deck.position.equals(pivot);deck.rotation.z=0;
    const clone=F.createGardenWindmill(),original=[],copies=[];roots[0].traverse(m=>{if(m.isMesh)original.push(m);});clone.traverse(m=>{if(m.isMesh)copies.push(m);});
    const shared=original.every((m,i)=>m.geometry===copies[i].geometry&&m.material===copies[i].material);
    for(const root of roots){root.visible=false;scene.add(root);}
    window.mechanismTest={T,roots,scene,renderer,camera};return {models:result,passages,raised,shared};
  });
  assert.ok(metrics.shared&&metrics.raised&&metrics.passages.every(p=>p.closed&&p.open&&p.below),JSON.stringify(metrics));
  assert.ok(metrics.models.every(m=>m.finite&&m.meshes<=14&&m.triangles<40000),JSON.stringify(metrics));
  for(const [i,name]of ['windmill','bridge-lowered','exit-closed','shortcut-closed'].entries()){
    await page.evaluate(i=>{const s=window.mechanismTest;s.roots.forEach((r,j)=>r.visible=i===j);const x=i===1?2.5:0,y=i===1?.4:1.9;s.camera.position.set(x+7,y+5.5,9);s.camera.lookAt(x,y,0);if(i===0)s.roots[0].rotation.y=Math.PI;s.renderer.render(s.scene,s.camera);},i);
    await page.screenshot({path:`${output}/${name}.png`});
  }
  for(const [i,name,part,axis,value]of [[1,'bridge-raised','bridge-deck','z',1.15],[2,'exit-open','gate-grille','y',-4],[3,'shortcut-open','gate-grille','y',-4]]){
    await page.evaluate(({i,part,axis,value})=>{const s=window.mechanismTest;s.roots.forEach((r,j)=>r.visible=i===j);const target=s.roots[i].getObjectByName(part);if(axis==='z')target.rotation.z=value;else target.position.y=value;const x=i===1?2.5:0;s.camera.position.set(x+7,7.4,9);s.camera.lookAt(x,1.9,0);s.renderer.render(s.scene,s.camera);},{i,part,axis,value});
    await page.screenshot({path:`${output}/${name}.png`});
  }
  const glbs=await page.evaluate(async()=>{
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');const {T,roots}=window.mechanismTest,result=[];
    for(const source of roots){const root=source.clone(true);root.visible=true;root.rotation.y=0;const grille=root.getObjectByName('gate-grille'),deck=root.getObjectByName('bridge-deck');if(grille)grille.position.y=0;if(deck)deck.rotation.z=0;root.updateMatrixWorld(true);
      const buffer=await new GLTFExporter().parseAsync(root,{binary:true}),loaded=(await new GLTFLoader().parseAsync(buffer,'')).scene;
      const size=n=>new T.Box3().setFromObject(n).getSize(new T.Vector3()),count=n=>{let v=0;n.traverse(m=>{if(m.isMesh)v+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});return v;};
      if(count(root)!==count(loaded)||size(root).distanceTo(size(loaded))>.0001)throw Error('GLB roundtrip changed mechanism');result.push({name:root.name,bytes:Array.from(new Uint8Array(buffer))});}
    return result;
  });
  for(const item of glbs)await writeFile(`${output}/${item.name}.glb`,Buffer.from(item.bytes));assert.deepEqual(errors,[]);
  const files=glbs.map(({name,bytes})=>({name,bytes:bytes.length}));await writeFile(`${output}/metrics.json`,JSON.stringify({...metrics,files,errors},null,2));
  console.log('PASS four mechanism models, finite/shared geometry, independent bridge pivot, closed/open gate rays, seven state views, four GLB roundtrips',JSON.stringify({...metrics,files}));
}finally{await browser.close();}
