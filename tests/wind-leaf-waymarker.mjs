import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless:true }), output='artifacts/models/wind-leaf-waymarker', errors=[];
try {
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('**/__wind-leaf-waymarker',route=>route.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5218/')+'__wind-leaf-waymarker');
  const metrics=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),{createWindLeafWaymarker,windLeafWaymarkerColliders}=await import('/src/wind-leaf-waymarker.ts');
    const root=createWindLeafWaymarker(),copy=createWindLeafWaymarker(),scene=new T.Scene();scene.add(root);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1280,900);renderer.setPixelRatio(1);
    renderer.setClearColor('#f7f2e7');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#eef4ff','#aa9678',1.8));
    const sun=new T.DirectionalLight('#fff0d4',2.6);sun.position.set(-4,9,6);sun.castShadow=true;sun.shadow.mapSize.setScalar(2048);
    Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:30});sun.shadow.normalBias=.008;scene.add(sun);
    const floor=new T.Mesh(new T.PlaneGeometry(60,60),new T.MeshStandardMaterial({color:'#f7f2e7',roughness:1}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-.005;floor.receiveShadow=true;scene.add(floor);
    const camera=new T.OrthographicCamera(-3.6,3.6,2.531,-2.531,.1,40);camera.position.set(7,6.5,9);camera.lookAt(0,2,0);renderer.render(scene,camera);
    let finite=true,triangles=0;root.traverse(m=>{if(m.isMesh){triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;finite&&=[...m.geometry.attributes.position.array,...m.geometry.attributes.normal.array,...m.geometry.attributes.uv.array].every(Number.isFinite);}});
    const bounds=new T.Box3().setFromObject(root),ray=new T.Raycaster();
    const arrows=['waymarker-leaf-arrow','waymarker-wind-arrow'].map(name=>{
      const bounds=new T.Box3().setFromObject(root.getObjectByName(name));return {min:bounds.min.toArray(),max:bounds.max.toArray()};
    });
    const rotor=root.getObjectByName('waymarker-rotor');
    const rotorHits=[0,1,2].map(i=>{
      const angle=.18+i*Math.PI*2/3;
      ray.set(new T.Vector3(-Math.sin(angle)*.6,3.19+Math.cos(angle)*.6,2),new T.Vector3(0,0,-1));
      return ray.intersectObject(rotor,true).length>0;
    });
    const parts=root.children.map(p=>p.name),meshes=[];root.traverse(m=>{if(m.isMesh)meshes.push(m);});
    const copyMeshes=[];copy.traverse(m=>{if(m.isMesh)copyMeshes.push(m);});
    const pivot=rotor.position.clone(),before=new T.Box3().setFromObject(root.getObjectByName('waymarker-frame'));
    rotor.rotation.z=.45;root.updateMatrixWorld(true);
    const independent=rotor.position.equals(pivot)&&before.equals(new T.Box3().setFromObject(root.getObjectByName('waymarker-frame')));
    rotor.rotation.z=0;root.updateMatrixWorld(true);
    window.waymarkerTest={T,root,scene,renderer,camera,triangles};
    return {triangles,finite,meshes:meshes.length,min:bounds.min.toArray(),max:bounds.max.toArray(),size:bounds.getSize(new T.Vector3()).toArray(),arrows,rotorHits,parts,independent,
      colliders:windLeafWaymarkerColliders.length,shared:root!==copy&&meshes.every((m,i)=>m.geometry===copyMeshes[i].geometry&&m.material===copyMeshes[i].material),render:{...renderer.info.render},textures:renderer.info.memory.textures};
  });
  await page.screenshot({path:`${output}/three-quarter.png`});
  assert.ok(metrics.finite&&metrics.shared&&metrics.meshes<=16&&metrics.triangles<30000,JSON.stringify(metrics));
  assert.ok(Math.abs(metrics.min[1])<.001&&metrics.size[0]>3&&metrics.size[0]<3.5&&metrics.size[1]>4&&metrics.size[1]<4.5);
  assert.deepEqual(metrics.rotorHits,[true,true,true],'Three separate leaf blades must occupy the three radial directions');
  assert.ok(metrics.arrows[0].min[0]<-1.6&&metrics.arrows[0].max[0]<-.14&&metrics.arrows[1].min[0]>.14&&metrics.arrows[1].max[0]>1.6,'Leaf arrow must point left and wind arrow right');
  assert.ok(metrics.independent&&metrics.parts.includes('waymarker-rotor'),'The rotor must have an independent axle pivot');
  for(const[name,position]of [['top',[0,11,.001]],['front',[0,2,11]],['side',[11,2,0]]]){
    await page.evaluate(position=>{const s=window.waymarkerTest;s.camera.position.fromArray(position);s.camera.lookAt(0,2,0);s.renderer.render(s.scene,s.camera);},position);
    await page.screenshot({path:`${output}/${name}.png`});
  }
  const bytes=await page.evaluate(async()=>{
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {T,root,triangles}=window.waymarkerTest,buffer=await new GLTFExporter().parseAsync(root,{binary:true}),loaded=(await new GLTFLoader().parseAsync(buffer,'')).scene;
    let count=0;loaded.traverse(m=>{if(m.isMesh)count+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});
    const size=node=>new T.Box3().setFromObject(node).getSize(new T.Vector3());
    if(count!==triangles||size(root).distanceTo(size(loaded))>.0001)throw Error('GLB reload changed waymarker geometry');
    return Array.from(new Uint8Array(buffer));
  });
  await writeFile(`${output}/wind-leaf-waymarker.glb`,Buffer.from(bytes));
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/metrics.json`,JSON.stringify({...metrics,glbBytes:bytes.length,errors},null,2));
  console.log('PASS wind-leaf waymarker, shared resources, two directions, three blades, independent axle pivot, four views and GLB roundtrip',JSON.stringify({...metrics,glbBytes:bytes.length}));
}finally{await browser.close();}
