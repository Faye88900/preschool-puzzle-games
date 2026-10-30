import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),errors=[];
const output='artifacts/models/vine-trellis';
try{
  await mkdir(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1200,height:900}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('**/__vine-trellis',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5194/')+'__vine-trellis');
  const metrics=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js');
    const {createVineTrellis}=await import('/src/vine-trellis.ts');
    const root=createVineTrellis(),copy=createVineTrellis(),scene=new T.Scene();scene.add(root);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,900);renderer.setPixelRatio(1);
    renderer.setClearColor('#faf6eb');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#f5f8ff','#a2a590',2));
    const sun=new T.DirectionalLight('#fff0d5',2.8);sun.position.set(-3,6,5);sun.castShadow=true;sun.shadow.mapSize.setScalar(2048);
    Object.assign(sun.shadow.camera,{left:-2,right:2,top:3,bottom:-1,near:.1,far:20});sun.shadow.normalBias=.005;scene.add(sun);
    const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:'#faf6eb',roughness:1}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-.003;floor.receiveShadow=true;scene.add(floor);
    const camera=new T.OrthographicCamera(-1.52,1.52,1.14,-1.14,.1,20);camera.position.set(2.5,2.0,4);camera.lookAt(0,.95,0);renderer.render(scene,camera);
    let triangles=0,finite=true;root.traverse(m=>{if(!m.isMesh)return;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
      finite&&=Array.from(m.geometry.attributes.position.array).every(Number.isFinite)&&Array.from(m.geometry.attributes.normal.array).every(Number.isFinite);});
    const ray=new T.Raycaster(),lattice=root.getObjectByName('trellis-lattice'),hit=(x,y,z=1,d=-1,object=lattice)=>{
      ray.set(new T.Vector3(x,y,z),new T.Vector3(0,0,d));return ray.intersectObject(object,true)[0]?.point.z;
    };
    const holes=[.61,.95,1.29].map(y=>({front:hit(0,y)??null,back:hit(0,y,-1,1)??null}));
    const crossings=[.44,.78,1.12,1.46].map(y=>hit(0,y));
    let open=0,total=0;for(let x=-.65;x<.7;x+=.09)for(let y=.5;y<1.6;y+=.09){total++;if(hit(x,y,1,-1,root)===undefined)open++;}
    const flowers=root.getObjectByName('trellis-flower-centers'),petals=root.getObjectByName('trellis-petals');
    const box=new T.Box3().setFromObject(root);window.trellisTest={T,root,renderer,scene,camera,triangles};
    return {triangles,finite,meshes:root.children.length,min:box.min.toArray(),size:box.getSize(new T.Vector3()).toArray(),holes,crossings,openFraction:open/total,
      flowerTriangles:(flowers.geometry.index?.count??flowers.geometry.attributes.position.count)/3,petalTriangles:(petals.geometry.index?.count??petals.geometry.attributes.position.count)/3,
      shared:root!==copy&&root.children.every((m,i)=>m.geometry===copy.children[i].geometry&&m.material===copy.children[i].material)};
  });
  await page.screenshot({path:`${output}/three-quarter.png`});
  assert.ok(metrics.finite&&metrics.triangles<26000&&metrics.meshes===8);
  assert.ok(Math.abs(metrics.min[1])<.0001&&metrics.size[0]<2.3&&metrics.size[1]>1.88&&metrics.size[1]<2.15&&metrics.size[2]<.65);
  assert.ok(metrics.holes.every(h=>h.front===null&&h.back===null),'Diamond openings must be open from both sides');
  assert.ok(metrics.crossings.every(z=>z>.03),'Diagonal strips must physically cross in two depth layers');
  assert.ok(metrics.openFraction>.35,'Foliage must leave a readable open lattice');
  assert.equal(metrics.petalTriangles,metrics.flowerTriangles*5,'Five flowers must each have five petals');assert.ok(metrics.shared);
  for(const[name,position]of [['front',[0,1.25,4]],['side',[4,1.25,0]],['back',[0,1.25,-4]]]){
    await page.evaluate(position=>{const s=window.trellisTest;s.camera.position.fromArray(position);s.camera.lookAt(0,.95,0);s.renderer.render(s.scene,s.camera);},position);
    await page.screenshot({path:`${output}/${name}.png`});
  }
  const bytes=await page.evaluate(async()=>{
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
    const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {T,root,triangles}=window.trellisTest,buffer=await new GLTFExporter().parseAsync(root,{binary:true});
    const loaded=(await new GLTFLoader().parseAsync(buffer,'')).scene,size=node=>new T.Box3().setFromObject(node).getSize(new T.Vector3());
    let count=0,meshes=0;loaded.traverse(m=>{if(m.isMesh){meshes++;count+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;}});
    if(size(root).distanceTo(size(loaded))>.0001||count!==triangles||meshes!==root.children.length)throw new Error('GLB reload changed model');
    return Array.from(new Uint8Array(buffer));
  });
  const glb=Buffer.from(bytes);assert.equal(glb.toString('ascii',0,4),'glTF');assert.equal(glb.readUInt32LE(8),glb.length);
  await writeFile(`${output}/vine-trellis.glb`,glb);assert.deepEqual(errors,[]);
  await writeFile(`${output}/metrics.json`,JSON.stringify({...metrics,glbBytes:glb.length},null,2));
  console.log('PASS trellis openings from both sides, crossed slats, sparse foliage, five-petal flowers, finite geometry, shared resources and GLB roundtrip',JSON.stringify({...metrics,glbBytes:glb.length}));
}finally{await browser.close();}
