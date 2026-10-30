import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),errors=[],output='artifacts/models/wood-wind-chime';
const oakHash=createHash('sha256').update(await readFile('public/models/tree-oak-01.glb')).digest('hex');
try{
  await mkdir(output,{recursive:true});const page=await browser.newPage({viewport:{width:1200,height:900}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('**/__wood-wind-chime',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5194/')+'__wood-wind-chime');
  const metrics=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js');
    const {createWoodWindChime,animateWoodWindChime}=await import('/src/wood-wind-chime.ts');
    const root=createWoodWindChime(),copy=createWoodWindChime(),scene=new T.Scene();scene.add(root);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,900);renderer.setPixelRatio(1);
    renderer.setClearColor('#faf6eb');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#f5f8ff','#a2a590',2));
    const sun=new T.DirectionalLight('#fff0d5',2.8);sun.position.set(-2,3,4);sun.castShadow=true;sun.shadow.mapSize.setScalar(2048);
    Object.assign(sun.shadow.camera,{left:-1,right:1,top:1,bottom:-1,near:.1,far:10});sun.shadow.normalBias=.001;scene.add(sun);
    const box=new T.Box3().setFromObject(root);
    const floor=new T.Mesh(new T.PlaneGeometry(10,10),new T.MeshStandardMaterial({color:'#faf6eb',roughness:1}));
    floor.rotation.x=-Math.PI/2;floor.position.y=box.min.y-.004;floor.receiveShadow=true;scene.add(floor);
    const camera=new T.OrthographicCamera(-.56,.56,.42,-.42,.01,10);camera.position.set(.18,.18,1.4);camera.lookAt(0,-.34,0);renderer.render(scene,camera);
    const meshes=[];let triangles=0,finite=true;root.traverse(m=>{if(!m.isMesh)return;meshes.push(m);triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
      finite&&=Array.from(m.geometry.attributes.position.array).every(Number.isFinite)&&Array.from(m.geometry.attributes.normal.array).every(Number.isFinite);});
    const ray=new T.Raycaster(),front=(group,x,y,z=1,d=-1)=>{
      ray.set(group.localToWorld(new T.Vector3(x,y,z)),new T.Vector3(0,0,d));
      return ray.intersectObject(group.children.find(m=>m.isMesh&&m.material.name==='chime-honey-wood'),false)[0]?.point.z??null;
    };
    const tubes=[0,1,2].map(i=>root.getObjectByName('chime-tube-'+i));
    const holes=tubes.map((tube,i)=>{const y=[-.065,-.086,-.070][i]-.018;return {front:front(tube,0,y),back:front(tube,0,y,-1,1),wood:front(tube,.016,y)};});
    const sail=root.getObjectByName('chime-leaf-sail'),sailHole=front(sail,0,-.052);
    const ring=root.children.find(m=>m.isMesh&&m.material.name==='chime-honey-wood');
    ray.set(new T.Vector3(0,-.1,0),new T.Vector3(0,-1,0));const ringOpen=ray.intersectObject(ring,false).length===0;
    ray.set(new T.Vector3(.12,-.1,0),new T.Vector3(0,-1,0));const ringRim=ray.intersectObject(ring,false).length>0;
    const paths=node=>{const map=new Map();node.traverse(m=>{if(m.isMesh)map.set(m.parent.name+'/'+m.name,m);});return map;},other=paths(copy);
    const shared=meshes.every(m=>m.geometry===other.get(m.parent.name+'/'+m.name).geometry&&m.material===other.get(m.parent.name+'/'+m.name).material);
    animateWoodWindChime(root,1,false);const poseA=tubes.map(t=>t.rotation.toArray());animateWoodWindChime(root,2,false);
    const poseB=tubes.map(t=>t.rotation.toArray()),anchor=root.position.toArray(),independent=copy.rotation.z===0&&copy.getObjectByName('chime-tube-0').rotation.z===0;
    let maxSway=0,minY=0;for(let i=0;i<80;i++){animateWoodWindChime(root,i/4,false);maxSway=Math.max(maxSway,...tubes.flatMap(t=>[Math.abs(t.rotation.x),Math.abs(t.rotation.z)]));minY=Math.min(minY,new T.Box3().setFromObject(root).min.y);}
    animateWoodWindChime(root,2,true);const reduced=root.rotation.z===0&&tubes.every(t=>t.rotation.x===0&&t.rotation.z===0)&&sail.rotation.y===0;
    root.updateMatrixWorld(true);renderer.render(scene,camera);window.chimeTest={T,root,scene,renderer,camera,triangles,meshes:meshes.length};
    return {triangles,finite,meshes:meshes.length,min:box.min.toArray(),size:box.getSize(new T.Vector3()).toArray(),holes,sailHole,ringOpen,ringRim,shared,independent,poseA,poseB,anchor,reduced,maxSway,minY,
      tubeHeights:tubes.map(t=>new T.Box3().setFromObject(t).getSize(new T.Vector3()).y)};
  });
  await page.screenshot({path:`${output}/three-quarter.png`});
  assert.ok(metrics.finite&&metrics.meshes<=15&&metrics.triangles<22000);
  assert.ok(metrics.size[1]>.7&&metrics.size[1]<.85&&metrics.size[0]<.30&&metrics.size[2]<.33);
  assert.ok(metrics.holes.every(h=>h.front===null&&h.back===null&&h.wood!==null),'All three upper collars need genuine through-bores');
  assert.equal(metrics.sailHole,null);assert.ok(metrics.ringOpen&&metrics.ringRim);
  assert.equal(new Set(metrics.tubeHeights.map(h=>h.toFixed(3))).size,3);assert.notDeepEqual(metrics.poseA,metrics.poseB);
  assert.ok(metrics.reduced&&metrics.shared&&metrics.independent&&metrics.maxSway<=.036&&metrics.minY>-.78);assert.deepEqual(metrics.anchor,[0,0,0]);
  for(const[name,position]of [['front',[0,-.21,1.5]],['side',[1.5,-.21,0]],['back',[0,-.21,-1.5]]]){
    await page.evaluate(position=>{const s=window.chimeTest;s.camera.position.fromArray(position);s.camera.lookAt(0,-.34,0);s.renderer.render(s.scene,s.camera);},position);
    await page.screenshot({path:`${output}/${name}.png`});
  }
  const bytes=await page.evaluate(async()=>{
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
    const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {T,root,triangles,meshes}=window.chimeTest,buffer=await new GLTFExporter().parseAsync(root,{binary:true});
    const loaded=(await new GLTFLoader().parseAsync(buffer,'')).scene,size=node=>new T.Box3().setFromObject(node).getSize(new T.Vector3());
    let count=0,meshCount=0;loaded.traverse(m=>{if(m.isMesh){meshCount++;count+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;}});
    if(size(root).distanceTo(size(loaded))>.0001||count!==triangles||meshCount!==meshes||!loaded.getObjectByName('chime-leaf-sail'))throw new Error('GLB reload changed chime or pivots');
    return Array.from(new Uint8Array(buffer));
  });
  const glb=Buffer.from(bytes);assert.equal(glb.toString('ascii',0,4),'glTF');assert.equal(glb.readUInt32LE(8),glb.length);await writeFile(`${output}/wood-wind-chime.glb`,glb);
  const tree=await page.evaluate(async()=>{
    const T=window.chimeTest.T,{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {DRACOLoader}=await import('/node_modules/three/examples/jsm/loaders/DRACOLoader.js'),{createGardenShadeTree}=await import('/src/garden-shade-tree.ts');
    const draco=new DRACOLoader().setDecoderPath('/models/draco/'),source=(await new GLTFLoader().setDRACOLoader(draco).loadAsync('/models/tree-oak-01.glb')).scene;
    const bounds=new T.Box3().setFromObject(source),size=bounds.getSize(new T.Vector3()),scale=1/size.x;source.scale.setScalar(scale);
    source.position.set(-(bounds.min.x+bounds.max.x)*scale/2,-bounds.min.y*scale,-(bounds.min.z+bounds.max.z)*scale/2);
    const snapshot=()=>{const values=[];source.traverse(m=>{if(m.isMesh)for(const name of ['position','normal','color'])values.push(Array.from(m.geometry.attributes[name].array).join(','));});return values.join('|');};
    const before=snapshot(),shade=createGardenShadeTree(source),crown=shade.getObjectByName('garden-shade-crown');shade.updateMatrixWorld(true);
    let triangles=0,finite=true;shade.traverse(m=>{if(m.isMesh){triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;finite&&=Array.from(m.geometry.attributes.position.array).every(Number.isFinite)&&Array.from(m.geometry.attributes.normal.array).every(Number.isFinite);}});
    const b=new T.Box3().setFromObject(shade),anchor=shade.getObjectByName('garden-chime-anchor').position.toArray();draco.dispose();
    return {triangles,finite,unchanged:before===snapshot(),size:b.getSize(new T.Vector3()).toArray(),minY:b.min.y,anchor,crownTriangles:crown.geometry.index.count/3};
  });
  assert.ok(tree.finite&&tree.unchanged&&tree.triangles<3000&&tree.crownTriangles>1500&&Math.abs(tree.minY)<.0001);
  assert.ok(tree.anchor.every((value,i)=>Math.abs(value-[.18,.65,.48][i])<.000001));assert.deepEqual(errors,[]);
  assert.equal(createHash('sha256').update(await readFile('public/models/tree-oak-01.glb')).digest('hex'),oakHash);
  await writeFile(`${output}/metrics.json`,JSON.stringify({...metrics,glbBytes:glb.length,tree,oakHash},null,2));
  console.log('PASS three real suspension bores, leaf bore, open ring, gentle independent pivots, reduced motion, GLB reload and rounded oak derivative',JSON.stringify({...metrics,glbBytes:glb.length,tree}));
}finally{await browser.close();}
