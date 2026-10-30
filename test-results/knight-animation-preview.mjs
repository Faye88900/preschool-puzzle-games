import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true}),output='artifacts/models/dark-knight/animation/preview-frames';
try {
  await mkdir(output,{recursive:true});const page=await browser.newPage({viewport:{width:600,height:500}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__knight-animation-preview',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0;background:#f7f2e7"><div id="caption" style="position:absolute;bottom:15px;width:100%;text-align:center;font:600 18px system-ui;color:#48444a"></div></body>'}));
  await page.goto('http://127.0.0.1:5198/__knight-animation-preview');
  const frames=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),F=await import('/src/dark-knight.ts');
    const scene=new T.Scene(),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(600,500);renderer.setClearColor('#f7f2e7');renderer.toneMapping=T.ACESFilmicToneMapping;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#d8efff','#c3b597',1.5));const sun=new T.DirectionalLight('#fff0d5',2.6);sun.position.set(-3,5,-4);sun.castShadow=true;
    Object.assign(sun.shadow.camera,{left:-2,right:2,top:2,bottom:-2,near:.1,far:20});sun.shadow.mapSize.setScalar(1024);sun.shadow.normalBias=.006;scene.add(sun);
    const fill=new T.DirectionalLight('#d8eaff',.4);fill.position.set(3,3,4);scene.add(fill);
    const floor=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:'#f7f2e7',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.015;floor.receiveShadow=true;scene.add(floor);
    const knight=F.createDarkKnight();scene.add(knight);const camera=new T.OrthographicCamera(-1.08,1.08,.9,-.9,.1,30);camera.position.set(1.8,1.5,-4);camera.lookAt(0,.6,0);
    const frames=[];F.animateDarkKnight(knight,'idle',true,0,0,false,{speed:0,alert:0,timer:0,block:0,hp:2});
    for(let i=0;i<498;i++){
      const t=i/60,motion={speed:0,alert:1,timer:0,block:0,hp:2};let phase='idle',label='发现玩家 · 警觉举盾';
      if(t<2.5){motion.speed=.8;motion.alert=0;label='巡逻 · 脚步与披风';}
      else if(t<3.2){}
      else if(t<4.3){phase='warn';motion.timer=4.3-t;label='举盾 · 蓄力';}
      else if(t<4.75){phase='lunge';const p=(t-4.3)/.45;motion.speed=5*T.MathUtils.smoothstep(p,0,.18)*(1-T.MathUtils.smoothstep(p,.78,1));motion.timer=4.75-t;label='冲刺攻击';}
      else if(t<5.6){phase='rest';motion.timer=2.6;label='放盾 · 露出破绽';}
      else if(t<6.4){phase='stun';motion.timer=6.4-t;motion.hp=1;label='被击中 · 晕眩表情';}
      else if(t<7.5){motion.alert=0;motion.speed=.5;motion.hp=1;label='恢复 · 继续移动';}
      else {phase='stun';motion.timer=8.3-t;motion.hp=0;label='被击退 · 延迟退场';}
      F.animateDarkKnight(knight,phase,true,t,1/60,false,motion);
      if(i%3===0){document.querySelector('#caption').textContent=label;renderer.render(scene,camera);frames.push(renderer.domElement.toDataURL('image/png').split(',')[1]);}
    }
    return frames;
  });
  assert.equal(frames.length,166);assert.deepEqual(errors,[]);
  for(const [i,frame]of frames.entries())await writeFile(`${output}/${String(i).padStart(3,'0')}.png`,Buffer.from(frame,'base64'));
  console.log('PASS actual model preview: 166 rendered frames at 20 fps, using 60 Hz animation updates');
}finally{await browser.close();}
