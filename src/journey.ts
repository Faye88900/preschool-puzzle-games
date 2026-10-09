import * as T from 'three';

import { createPlayerCharacter, setCharacterExpression } from './character';
import { readSettings } from './settings';
import './journey.css';

/** Cloud passage reveals the live destination; there is no stand-in island. */
export function startJourney(dialog: HTMLDialogElement, destination: string) {
  dialog.classList.add('cloud-journey');
  dialog.setAttribute('aria-label', '乘云前往' + destination);
  dialog.innerHTML = `<div class="journey-sky"></div><canvas aria-label="小精灵乘云穿过云海"></canvas><div class="journey-curtain"></div><div class="journey-caption"><small>云端冒险</small><p role="status">乘着云，出发吧</p></div><button class="journey-skip" autofocus>跳过动画 <span aria-hidden="true">↗</span></button>`;
  document.body.classList.add('journey-active');
  const canvas = dialog.querySelector('canvas')!;
  const sky = dialog.querySelector<HTMLElement>('.journey-sky')!;
  sky.style.backgroundImage = `url(${import.meta.env.BASE_URL}images/journey-cloudscape.png)`;
  const curtain = dialog.querySelector<HTMLElement>('.journey-curtain')!;
  const caption = dialog.querySelector('p')!;
  const skip = dialog.querySelector('button')!;
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0, 0);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  scene.fog = new T.FogExp2('#c4dfed', .012);
  scene.add(new T.HemisphereLight('#fff1e3', '#b2b9da', 1.25));
  const sun = new T.DirectionalLight('#ffdfb5', 3.1); sun.position.set(5, 6, -3); scene.add(sun);
  const fill = new T.DirectionalLight('#fff0df', .85); fill.position.set(2, 3, 8); scene.add(fill);
    sun.castShadow = true; sun.shadow.mapSize.setScalar(1024);
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: .1, far: 20 });
  sun.shadow.normalBias = .025; sun.shadow.bias = -.0001; sun.shadow.radius = 3;
  scene.add(sun.target);
  const camera = new T.PerspectiveCamera(42, 1, .1, 120);
  const cloudMaterial = new T.MeshStandardMaterial({ color: '#fff1dd', roughness: 1, emissive: '#dfbbad', emissiveIntensity: .045 });
  const cloudGeometry = new T.SphereGeometry(1, 48, 32);
  const cloud = new T.Group();
  // Large cushions carry the rider; smaller uneven lobes soften the silhouette.
  const lobes = [[0,.06,0,1.05,.48,.78],[-.82,.04,.02,.67,.49,.62],[.85,.02,.06,.64,.45,.57],[-.43,.28,-.28,.58,.47,.55],[.43,.24,-.32,.6,.46,.53],[-1.26,-.08,.12,.36,.3,.38],[1.28,-.1,.08,.34,.29,.35],[-.62,-.14,.55,.42,.3,.35],[.05,-.15,.62,.47,.3,.34],[.67,-.13,.5,.4,.31,.35]];
  for (const [x,y,z,sx,sy,sz] of lobes) {
    const puff = new T.Mesh(cloudGeometry, cloudMaterial);
    puff.position.set(x,y,z); puff.scale.set(sx,sy,sz); puff.receiveShadow = true; cloud.add(puff);
  }
  const ride = new T.Group(); ride.add(cloud); scene.add(ride);
  const seat = .51;
  const player = createPlayerCharacter(); setCharacterExpression(player, 'neutral');
  const marker = player.getObjectByName('player-marker')!; marker.visible = false;
  player.scale.setScalar(.75); player.position.y = seat + .61 * .75; ride.add(player);

  // A shared, feathered cloud texture adds vapor around the solid riding surface.
  const vaporCanvas = document.createElement('canvas'); vaporCanvas.width = vaporCanvas.height = 128;
  const context = vaporCanvas.getContext('2d')!;
  const gradient = context.createRadialGradient(64, 64, 5, 64, 64, 64);
  gradient.addColorStop(0, '#ffffffff'); gradient.addColorStop(.35, '#ffffffaa'); gradient.addColorStop(1, '#ffffff00');
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
  const vaporTexture = new T.CanvasTexture(vaporCanvas);
  const vaporMaterial = new T.SpriteMaterial({ map: vaporTexture, color: '#f4f4ff', transparent: true, opacity: .45, depthWrite: false });
  const wisps = Array.from({ length: 12 }, (_, i) => {
    const sprite = new T.Sprite(vaporMaterial); sprite.scale.set(1.4, .7, 1); scene.add(sprite); sprite.userData.phase = i / 12; return sprite;
  });
  const clouds = Array.from({ length: 36 }, (_, i) => {
    const sprite = new T.Sprite(vaporMaterial); const size = 7 + i % 5 * 2;
    sprite.scale.set(size * 1.5, size, 1); scene.add(sprite); return sprite;
  });
  const passingMaterial = new T.SpriteMaterial({ map: vaporTexture, color: '#fff8ee', transparent: true, opacity: 0, depthTest: false, depthWrite: false });
  const passingCloud = new T.Group(); scene.add(passingCloud);
  for (let i = 0; i < 7; i++) {
    const puff = new T.Sprite(passingMaterial);
    puff.position.set((i - 3) * .65, Math.sin(i * 2.1) * .35, 0);
    puff.scale.set(2.5, 1.6 + i % 3 * .25, 1); puff.renderOrder = 5; passingCloud.add(puff);
  }
  const edgeMaterial = new T.SpriteMaterial({ map: vaporTexture, color: '#fff3df', transparent: true, opacity: .35, depthWrite: false });
  for (let i = 0; i < 22; i++) {
    const edge = new T.Sprite(edgeMaterial), angle = i / 22 * Math.PI * 2;
    edge.position.set(Math.cos(angle) * 1.35, -.08 + Math.sin(i * 2.4) * .1, Math.sin(angle) * .55);
    edge.scale.set(.55 + i % 3 * .09, .43, 1); cloud.add(edge);
  }
  const shadowMaterial = new T.MeshBasicMaterial({ map: vaporTexture, color: '#8b789d', transparent: true, opacity: .28, depthWrite: false });
  const shadowGeometry = new T.PlaneGeometry(1, 1);
  const shadow = new T.Group(); ride.add(shadow);
  for (const side of [-1, 1]) {
    const contact = new T.Mesh(shadowGeometry, shadowMaterial);
    contact.rotation.x = -Math.PI / 2; contact.position.set(side * .3 * .75, .515, -.13 * .75); contact.scale.set(.56 * .75,.65 * .75,1); shadow.add(contact);
  }
  // Tapered ribbons stream behind the cloud in its direction of travel.
  const streakGeometry = new T.PlaneGeometry(1, 1, 1, 16);
  streakGeometry.rotateX(-Math.PI / 2); streakGeometry.translate(0, 0, .5);
  const streakVertices = streakGeometry.getAttribute('position');
  for (let i = 0; i < streakVertices.count; i++) {
    const z = streakVertices.getZ(i);
    streakVertices.setX(i, streakVertices.getX(i) * Math.sin(z * Math.PI) + Math.sin(z * Math.PI) * .12);
  }
  const streaks = Array.from({ length: 10 }, () => {
    const material = new T.MeshBasicMaterial({ color: '#fff8e7', transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false });
    const mesh = new T.Mesh(streakGeometry, material); scene.add(mesh); return mesh;
  });
  const fromExit = new URLSearchParams(location.search).has('cloudArrival');
  if (fromExit) { curtain.style.opacity = '1'; sky.hidden = true; canvas.hidden = true; }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ready = false, skipped = reduced, elapsed = fromExit ? 5.3 : 0, landing = 0, frame = 0, last = performance.now(), disposed = false, revealed = false;
  let resolve: () => void;
  const finished = new Promise<void>(done => { resolve = done; });
  // Start on entry; retry on a gesture if the browser blocks autoplay.
  let audio: AudioContext | undefined, wind: GainNode | undefined, filter: BiquadFilterNode | undefined;
  function startWind() {
    if (!readSettings().effects || reduced) return;
    if (audio) { void audio.resume().catch(() => {}); return; }
    audio = new AudioContext();
    const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
    const data = buffer.getChannelData(0);
    let smooth = 0;
    for (let i = 0; i < data.length; i++) { smooth = (smooth + (Math.random() * 2 - 1) * .04) / 1.04; data[i] = smooth * 3; }
    const source = audio.createBufferSource(); source.buffer = buffer; source.loop = true;
    filter = audio.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 650;
    wind = audio.createGain(); wind.gain.value = 0; source.connect(filter).connect(wind).connect(audio.destination); source.start();
    void audio.resume().catch(() => {});
  }
  startWind();
  dialog.addEventListener('pointerdown', startWind);
  const requestSkip = () => { skipped = true; skip.disabled = true; caption.textContent = '正在准备' + destination + '…'; };
  skip.onclick = requestSkip;
  const cancel = (event: Event) => { event.preventDefault(); requestSkip(); };
  dialog.addEventListener('cancel', cancel);
  const blockKeys = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.type === 'keydown') startWind();
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') { event.preventDefault(); requestSkip(); }
  };
  dialog.addEventListener('keydown', blockKeys); dialog.addEventListener('keyup', blockKeys);
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();
  const diagnostics = new URLSearchParams(location.search).has('test');
  function dispose() {
    if (disposed) return; disposed = true;
    cancelAnimationFrame(frame); removeEventListener('resize', resize);
    dialog.removeEventListener('cancel', cancel); dialog.removeEventListener('pointerdown', startWind);
    dialog.removeEventListener('keydown', blockKeys); dialog.removeEventListener('keyup', blockKeys);
    document.body.classList.remove('journey-active');
    if (audio) void audio.close().catch(() => {});
    passingMaterial.dispose();
    streakGeometry.dispose(); streaks.forEach(streak => streak.material.dispose());
    cloudGeometry.dispose(); shadowGeometry.dispose(); edgeMaterial.dispose(); cloudMaterial.dispose(); vaporMaterial.dispose(); shadowMaterial.dispose(); vaporTexture.dispose();
    // Shared character surfaces belong to the destination; only its marker is instance-owned.
    marker.traverse(node => { if (node instanceof T.Mesh) { node.geometry.dispose(); (node.material as T.Material).dispose(); } });
    renderer.dispose(); renderer.forceContextLoss(); resolve();
  }
  const smooth = T.MathUtils.smootherstep;
  const look = new T.Vector3();
  const flightPoint = (time: number, point: T.Vector3) => {
    const t = Math.max(0, Math.min(time, 6.8));
    return point.set(
      -2.2 * smooth(t, 1.1, 2.5) + 5 * smooth(t, 2.5, 3.65) - 2.8 * smooth(t, 4.2, 6.8),
      -.6 + 1.2 * smooth(t, .15, 1.6) + 3.2 * smooth(t, 4, 6.8),
      -Math.max(0, time) * .8 + .12 * smooth(t, 3.55, 3.95) - 36 * smooth(t, 4, 6.8));
  };
  const ahead = new T.Vector3(), behind = new T.Vector3(), direction = new T.Vector3();
  player.rotation.y = Math.PI;
  let turningSpeed = 0;
  const avatar = player.getObjectByName('avatar')!;
  const limbs = [-1, 1].map(side => ({ side, arm: player.getObjectByName('arm' + side)!, foot: player.getObjectByName('foot' + side)!, ear: player.getObjectByName('ear' + side)! }));
  function render(now: number) {
    const dt = Math.min((now - last) / 1000, .05); last = now;
    if (!document.hidden) { elapsed += dt; if (ready && (elapsed >= (fromExit ? 5.3 : 6.8) || skipped)) landing += dt; }
    const travel = reduced ? 0 : elapsed;
    const lift = reduced ? 1 : smooth(elapsed, .15, 1.6);
    const turn = reduced ? 0 : smooth(elapsed, 1.4, 4.6);
    const surge = reduced ? 0 : smooth(elapsed, 1.6, 3.8);
    const pulse = reduced ? 0 : Math.sin(Math.min(elapsed / 1.2, 1) * Math.PI);
    const charge = reduced ? 0 : smooth(travel, 3.55, 3.9) * (1 - smooth(travel, 3.95, 4.18));
    const kick = reduced ? 0 : Math.sin(Math.PI * smooth(travel, 4.02, 4.55));
    const boost = reduced ? 0 : smooth(travel, 3.98, 4.48);
    const compression = pulse * .2 + charge * .28 - kick * .13;
    flightPoint(travel, ride.position);
    const headingTime = Math.min(travel, 6.76);
    direction.subVectors(flightPoint(headingTime + .04, ahead), flightPoint(headingTime - .04, behind)).normalize();
    sun.position.copy(ride.position).add(new T.Vector3(5, 6, -3)); sun.target.position.copy(ride.position);
    ride.rotation.z = reduced ? 0 : T.MathUtils.damp(ride.rotation.z, -direction.x * .34, 5, dt);
    ride.rotation.x = charge * .07 - kick * .08;
    cloud.scale.set(1 + compression * .35, 1 - compression, 1 + compression * .2 + kick * .14);
    player.position.y = seat * cloud.scale.y + .61 * .75;
    const facing = Math.PI * (1 - turn) + Math.atan2(-direction.x, -direction.z) * turn;
    const yawError = Math.atan2(Math.sin(facing - player.rotation.y), Math.cos(facing - player.rotation.y));
    const yawStep = reduced ? 0 : T.MathUtils.clamp(yawError * (1 - Math.exp(-5 * dt)), -2.4 * dt, 2.4 * dt);
    player.rotation.y += yawStep;
    turningSpeed = T.MathUtils.damp(turningSpeed, dt > 0 ? yawStep / dt : 0, 6, dt);
    shadow.rotation.y = player.rotation.y; shadow.scale.y = cloud.scale.y;
    // Anticipation, a farewell wave, then a loose surfing stance; ears lag behind the body.
    const wave = reduced ? 0 : smooth(elapsed, .65, 1.05) * (1 - smooth(elapsed, 2.15, 2.65));
    const settle = reduced ? 0 : smooth(elapsed, 4.6, 5.25);
    const balance = reduced ? 0 : direction.x * .12 + Math.sin(travel * 2.8) * .04 * surge;
    const pivot = reduced ? 0 : Math.sin(turn * Math.PI);
    const crouch = reduced ? 0 : pulse * .14 + settle * .1 + pivot * .045 + charge * .13;
    avatar.rotation.set(-.2 * surge - settle * .1 - charge * .13 + kick * .18, turningSpeed * .07, balance + pivot * .045);
    avatar.scale.set(1 + crouch * .45, 1 - crouch, 1 + crouch * .3);
    // Lower the center as the body compresses, keeping the feet against the cloud.
    avatar.position.y = -crouch * .67;
    for (const { side, arm, foot, ear } of limbs) {
      const waving = side === -1 ? wave : 0;
      arm.position.set(side * (.49 - waving * .1 + surge * .025), -.13 + waving * .43 + surge * .13, -.04 - surge * .1);
      arm.rotation.set(-surge * .35 - side * turningSpeed * .07, -turningSpeed * .12, side * (.15 + surge * .4) - waving * (.85 + Math.sin(travel * 12) * .4));
      const step = Math.max(0, Math.sin(turn * Math.PI * 4 + (side < 0 ? 0 : Math.PI))) * pivot;
      foot.position.set(side * (.30 + surge * .055), -.535 + step * .075, -.13 + side * surge * .1 + side * pivot * .045);
      foot.rotation.set(-settle * .14 + balance * side - step * .14, side * surge * .14 - turningSpeed * .1, -balance * .5);
      ear.rotation.set(surge * .14 + kick * .22 + Math.sin(travel * 5 - .6) * .035, -turningSpeed * .14, -side * (.22 + Math.sin(travel * 6 - side * .5) * .055 + surge * .07));
    }
    setCharacterExpression(player, 'neutral');
    wisps.forEach((sprite, i) => {
      const t = (travel * .65 + i / wisps.length) % 1;
      flightPoint(travel - t * 1.1, sprite.position);
      sprite.position.x += Math.sin(i * 2.4) * (.5 + t * .4);
      sprite.position.y -= .15;
      sprite.position.z += .5 + t * 1.2;
      sprite.scale.set(1.3 * (1 - t) + .2, .55 * (1 - t) + .1, 1);
    });
    streaks.forEach((streak, i) => {
      const t = (travel * (.75 + i % 3 * .1) + i / streaks.length) % 1;
      const side = i % 2 ? 1 : -1;
      flightPoint(travel - t * .8, streak.position);
      direction.subVectors(flightPoint(travel - t * .8 - .15, behind), streak.position).normalize();
      streak.rotation.y = Math.atan2(direction.x, direction.z);
      streak.position.x += side * (1.05 + i % 5 * .24);
      streak.position.y += -.18 + i % 3 * .16;
      streak.position.z += .3;
      streak.scale.set(.04 + i % 3 * .014, 1, (1.2 + i % 3 * .45) * (1 + surge * .65 + boost * .9) * (1 - charge * .55));
      streak.material.opacity = Math.sin(t * Math.PI) * .8 * lift * (1 - smooth(landing, 0, .75));
      streak.visible = !reduced;
    });
    clouds.forEach((sprite, i) => {
      const depth = ((i * 4.7 + travel * 4) % 80) - 62;
      sprite.position.set((i % 2 ? 1 : -1) * (7 + i % 5 * 2), -3.5 + Math.sin(i * 1.7) * 2.5, ride.position.z + depth);
    });
    const distance = camera.aspect < .85 ? 10.6 : 7.7;
    camera.position.set(0, 2.6, distance + .9 - .6 * smooth(travel, 0, 2));
    look.set(0, .9, -3);
    camera.lookAt(look); camera.fov = 42 + surge * 4; camera.updateProjectionMatrix();
    const pass = smooth(travel, 4.45, 5.2);
    passingCloud.position.set(5 - pass * 12, 1.8 + pass * .4, camera.position.z - 3.5);
    passingMaterial.opacity = reduced ? 0 : Math.sin(pass * Math.PI) ** 2 * .82;
    passingCloud.visible = passingMaterial.opacity > .001 && !revealed;
    sky.style.transform = `scale(${1.04 + Math.min(travel, 6) * .018}) translateX(${-turn * 1.2}%)`;
    const cover = fromExit && landing < .85 ? 1 : landing < .85 ? smooth(landing, 0, .75) : 1 - smooth(landing, .95, 2.35);
    curtain.style.opacity = String(cover);
    if (landing >= .8 && !revealed) {
      revealed = true; sky.hidden = true; canvas.hidden = true;
      document.dispatchEvent(new Event('journey-arrival'));
    }
    const phase = landing > 0 ? 'arriving' : elapsed < 1.6 ? 'takeoff' : 'flying';
    dialog.dataset.phase = phase;
    if (!skipped) caption.textContent = landing > .9 ? destination + '，我们来啦' : elapsed < 1.6 ? '乘着云，出发吧' : '下一站 · ' + destination;
    const windLevel = (.06 * surge + .22 * boost + kick * .09) * (1 - charge * .65) * Math.min(1, Math.pow(8 / camera.position.distanceTo(ride.position), 1.1)) * (1 - cover);
    if (audio && wind && filter) {
      wind.gain.setTargetAtTime(readSettings().effects ? windLevel : 0, audio.currentTime, .08);
      filter.frequency.setTargetAtTime(600 + surge * 500 + boost * 1200 + kick * 450, audio.currentTime, .1);
    }
    if (!revealed) renderer.render(scene, camera);
    if (diagnostics) Object.assign(window, { __JOURNEY_DIAGNOSTICS__: { phase, elapsed, charge, kick, cloudHeight: cloud.scale.y, passing: passingMaterial.opacity, windLevel, distance: camera.position.distanceTo(ride.position), bank: ride.rotation.z, streaks: streaks.map(streak => ({ z: streak.position.z, opacity: streak.material.opacity, visible: streak.visible })), pose: { heading: player.rotation.y, body: avatar.rotation.toArray().slice(0, 3), arms: limbs.map(({ arm }) => [...arm.position.toArray(), arm.rotation.z]), feet: limbs.map(({ foot }) => foot.rotation.toArray().slice(0, 3)), expression: player.userData.expression }, camera: camera.position.toArray(), player: ride.position.toArray(), revealed, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, dpr: renderer.getPixelRatio() } });
    if (ready && (skipped || landing >= (fromExit ? 3.0 : 2.5))) {
      if (fromExit && !revealed) document.dispatchEvent(new Event('journey-arrival'));
      dispose();
    }
    else frame = requestAnimationFrame(render);
  }
  frame = requestAnimationFrame(render);
  return { arrive: () => { ready = true; return finished; }, dispose };
}
