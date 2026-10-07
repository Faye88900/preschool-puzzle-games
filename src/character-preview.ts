import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createPlayerCharacter, setCharacterExpression, type Expression } from './character';
import { animateWalk } from './movement';

export function showCharacterPreview() {
  document.title = 'A 版角色 · 三维预览';
  document.body.innerHTML = `<style>
    body{margin:0;background:#f4f0f7;color:#423351;font:15px system-ui}#studio{width:100%;height:100%;display:block}
    .studio-header{position:fixed;top:24px;left:28px;pointer-events:none}.studio-header h1{font-size:23px;margin:4px 0}.studio-header p{margin:6px 0;color:#71667e}
    .studio-tools{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);width:min(740px,calc(100% - 28px));box-sizing:border-box;padding:14px;background:#fffefcee;border:1px solid #ded5e5;border-radius:20px;display:flex;flex-wrap:wrap;gap:10px;justify-content:center;box-shadow:0 10px 32px #4c356018}
    .studio-tools button,.studio-tools select,.studio-tools a{font:inherit;border:1px solid #d8cde2;border-radius:10px;background:white;color:#493858;padding:10px 13px;min-height:44px;text-decoration:none;cursor:pointer}
    .studio-tools button:hover{background:#eee7f6}.studio-tools :focus-visible{outline:3px solid #8570be;outline-offset:2px}.studio-tools label{display:flex;gap:7px;align-items:center}
    #export-status{position:fixed;right:20px;top:22px;max-width:40%;color:#67507d} @media(max-width:600px){.studio-header{top:12px;left:16px}.studio-header h1{font-size:19px}.studio-tools{bottom:10px;gap:6px;padding:10px}.studio-tools button,.studio-tools a{padding:8px 10px;font-size:13px}}
  </style><canvas id="studio" aria-label="A版圆球精灵三维预览，可拖动旋转"></canvas>
  <header class="studio-header"><h1>A 版 · 圆球精灵</h1><p>拖动旋转 · 滚轮缩放</p></header>
  <div id="export-status" role="status"></div>
  <nav class="studio-tools" aria-label="角色预览控制">
    <button data-view="front">正面</button><button data-view="side">侧面</button><button data-view="back">背面</button><button data-view="three">立体</button>
    <label>动作<select id="pose"><option value="idle">站立</option><option value="run">奔跑</option><option value="jump">跳跃</option></select></label>
    <label>表情<select id="expression"><option value="auto">随动作</option><option value="neutral">微笑</option><option value="happy">开心</option><option value="surprised">惊讶</option><option value="determined">认真</option></select></label>
    <button id="export">下载 GLB</button><a href="./">进入游戏</a>
  </nav>`;
  const renderer = new T.WebGLRenderer({ canvas: document.querySelector('#studio')!, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene(); scene.background = new T.Color('#f4f0f7');
  const camera = new T.PerspectiveCamera(33, 1, .1, 50);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, .85, 0); controls.enableDamping = true; controls.enablePan = false;
  controls.minDistance = 2.5; controls.maxDistance = 12; controls.maxPolarAngle = Math.PI * .49;
  scene.add(new T.HemisphereLight('#fff9f5', '#a4a1bc', 1.7));
  const key = new T.DirectionalLight('#fff7ed', 2.5); key.position.set(-3, 6, -4); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = key.shadow.camera.bottom = -2.5;
  key.shadow.camera.right = key.shadow.camera.top = 2.5; key.shadow.normalBias = .02; scene.add(key);
  const fill = new T.DirectionalLight('#dfd9ff', 1.4); fill.position.set(4, 2, 2); scene.add(fill);
  const ground = new T.Mesh(new T.PlaneGeometry(200, 200), new T.ShadowMaterial({ opacity: .15 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const model = createPlayerCharacter(); model.position.y = .68; model.getObjectByName('player-marker')!.visible = false; scene.add(model);
  const avatar = model.getObjectByName('avatar')!;
  const views: Record<string, number[]> = { front: [0, 1.05, -5], side: [-5, 1.05, 0], back: [0, 1.05, 5], three: [-3.2, 1.9, -4.2] };
  const fit = () => camera.position.sub(controls.target).setLength(5.3 * Math.max(1, .78 / camera.aspect)).add(controls.target);
  const view = (name: string) => { camera.position.fromArray(views[name]); fit(); controls.update(); };
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.onclick = () => view(button.dataset.view!));
  view('three');
  const pose = document.querySelector<HTMLSelectElement>('#pose')!;
  const expression = document.querySelector<HTMLSelectElement>('#expression')!;
  const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); fit(); };
  addEventListener('resize', resize); resize();
  document.querySelector<HTMLButtonElement>('#export')!.onclick = async () => {
    const status = document.querySelector('#export-status')!;
    status.textContent = '正在导出…';
    try {
      const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
      const asset = createPlayerCharacter(); asset.remove(asset.getObjectByName('player-marker')!);
      asset.position.y = .68;
      const data = await new GLTFExporter().parseAsync(asset, { binary: true });
      const url = URL.createObjectURL(new Blob([data as ArrayBuffer], { type: 'model/gltf-binary' }));
      const link = document.createElement('a'); link.href = url; link.download = 'character-a.glb'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); status.textContent = '已导出静态模型；动作由游戏驱动';
    } catch (error) { status.textContent = '导出失败，请重试'; console.error(error); }
  };
  let previous = performance.now(), elapsed = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function frame(now: number) {
    const dt = Math.min((now - previous) / 1000, .05); previous = now; elapsed += dt;
    const run = pose.value === 'run', jump = pose.value === 'jump';
    const phase = (elapsed % 1.5) / 1.5;
    const height = jump ? Math.sin(Math.PI * Math.min(phase / .72, 1)) * .65 : 0;
    animateWalk(model, 0, run ? elapsed * 12 : 0, run ? 7.2 : 0, height < .01, reduced.matches, dt);
    model.position.y = .68 + height;
    const squash = jump && phase > .72 && phase < .9 ? 1 - Math.sin((phase - .72) / .18 * Math.PI) * .16 : 1;
    avatar.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    setCharacterExpression(model, expression.value === 'auto' ? height > .01 ? 'surprised' : run ? 'determined' : 'neutral' : expression.value as Expression);
    controls.update(); renderer.render(scene, camera); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('test')) {
    Object.assign(window, { __CHARACTER_PREVIEW__: { model, scene, camera, renderer } });
  }
}
