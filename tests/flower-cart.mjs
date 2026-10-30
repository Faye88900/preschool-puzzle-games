import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true}), errors=[];
try {
  await mkdir('artifacts/models/flower-cart',{recursive:true});
  const page=await browser.newPage({viewport:{width:1200,height:900}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/__flower-cart',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5194/')+'__flower-cart');
  const metrics=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js');
    const {createFlowerCart}=await import('/src/flower-cart.ts');
    const root=createFlowerCart(),copy=createFlowerCart(),scene=new T.Scene();scene.add(root);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,900);renderer.setPixelRatio(1);
    renderer.setClearColor('#faf6eb');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#f5f8ff','#a2a590',2));
    const sun=new T.DirectionalLight('#fff0d5',2.8);sun.position.set(-3,6,5);sun.castShadow=true;sun.shadow.mapSize.setScalar(2048);
    Object.assign(sun.shadow.camera,{left:-3,right:3,top:3,bottom:-2,near:.1,far:20});sun.shadow.normalBias=.008;scene.add(sun);
    const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:'#faf6eb',roughness:1}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-.003;floor.receiveShadow=true;scene.add(floor);
    const camera=new T.OrthographicCamera(-2.05,2.05,1.5375,-1.5375,.1,25);
    camera.position.set(2.8,2.7,4.3);camera.lookAt(-.38,.82,0);renderer.render(scene,camera);
    let triangles=0,finite=true;
    root.traverse(m=>{if(!m.isMesh)return;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
      finite&&=Array.from(m.geometry.attributes.position.array).every(Number.isFinite)&&Array.from(m.geometry.attributes.normal.array).every(Number.isFinite);});
    root.updateMatrixWorld(true);
    const ray=new T.Raycaster(),wood=root.getObjectByName('cart-timber'),rim=root.getObjectByName('cart-planks'),iron=root.getObjectByName('cart-iron');
    const wheelHit=angle=>{
      ray.set(new T.Vector3(.23+Math.cos(angle)*.23,.46+Math.sin(angle)*.23,1.5),new T.Vector3(0,0,-1));
      return ray.intersectObjects([wood,rim,iron],false).map(hit=>hit.point.z);
    };
    const gap=wheelHit(7*Math.PI/6),spokes=wheelHit(4*Math.PI/3);
    const pots=root.getObjectByName('cart-terracotta'),soil=root.getObjectByName('cart-soil');
    const height=(x,z,objects)=>{ray.set(new T.Vector3(x,3,z),new T.Vector3(0,-1,0));return ray.intersectObjects(objects,false)[0]?.point.y;};
    const potDepths=[],soilDepths=[];
    for(const [x,z,size]of [[-.43,-.255,1],[.43,-.255,1],[-.43,.29,.9],[.43,.29,.9]]){
      const lip=height(x+.252*size,z,[pots]);potDepths.push(lip-height(x,z,[pots]));soilDepths.push(lip-height(x,z,[soil]));
    }
    const box=new T.Box3().setFromObject(root);
    window.cartTest={T,root,renderer,scene,camera,triangles};
    return {triangles,finite,meshes:root.children.length,min:box.min.toArray(),size:box.getSize(new T.Vector3()).toArray(),gapHits:gap.length,
      spokeSides:[spokes.some(z=>z>.64),spokes.some(z=>z<-.64)],potDepths,soilDepths,
      shared:root!==copy&&root.children.every((m,i)=>m.geometry===copy.children[i].geometry&&m.material===copy.children[i].material)};
  });
  assert.ok(metrics.finite&&metrics.triangles<32000&&metrics.meshes<=12);
  assert.ok(Math.abs(metrics.min[1])<.0001&&metrics.size[0]>3&&metrics.size[0]<3.1&&metrics.size[1]>1.6&&metrics.size[1]<2);
  assert.equal(metrics.gapHits,0,'Both wheels must have real open gaps between their spokes');
  assert.ok(metrics.spokeSides.every(Boolean),'Both wheels must contain solid spokes');
  assert.ok(metrics.potDepths.every(d=>d>.24)&&metrics.soilDepths.every(d=>d>.025),'Four pots must have open cavities and recessed soil');
  assert.ok(metrics.shared,'Instances must reuse geometry and materials');
  await page.screenshot({path:'artifacts/models/flower-cart/three-quarter.png'});
  for(const [name,position]of [['front',[4,1.5,0]],['side',[-.4,1.5,5]],['back',[-5,1.5,0]]]){
    await page.evaluate(position=>{const s=window.cartTest;s.camera.position.fromArray(position);s.camera.lookAt(-.38,.82,0);s.renderer.render(s.scene,s.camera);},position);
    await page.screenshot({path:`artifacts/models/flower-cart/${name}.png`});
  }
  const bytes=await page.evaluate(async()=>{
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
    const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {T,root,triangles}=window.cartTest,buffer=await new GLTFExporter().parseAsync(root,{binary:true});
    const loaded=(await new GLTFLoader().parseAsync(buffer,'')).scene;
    const size=node=>new T.Box3().setFromObject(node).getSize(new T.Vector3());
    let reloadedTriangles=0,meshes=0;loaded.traverse(m=>{if(m.isMesh){meshes++;reloadedTriangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;}});
    if(size(root).distanceTo(size(loaded))>.0001||triangles!==reloadedTriangles||meshes!==root.children.length)throw new Error('GLB reload changed model');
    return Array.from(new Uint8Array(buffer));
  });
  const glb=Buffer.from(bytes);assert.equal(glb.toString('ascii',0,4),'glTF');assert.equal(glb.readUInt32LE(8),glb.length);
  await writeFile('artifacts/models/flower-cart/flower-cart.glb',glb);assert.deepEqual(errors,[]);
  await writeFile('artifacts/models/flower-cart/metrics.json',JSON.stringify({...metrics,glbBytes:glb.length},null,2));
  console.log('PASS flower cart grounding, open spoked wheels, four open pots, shared resources, views and GLB export/reload',JSON.stringify({...metrics,glbBytes:glb.length}));
}finally{await browser.close();}
