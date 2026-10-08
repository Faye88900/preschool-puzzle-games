import * as T from 'three';
import { createPlayerCharacter, setCharacterExpression } from './character';

/** An independent, decorative title scene; no level physics or game loop is started. */
export function createHomeScene(canvas: HTMLCanvasElement): () => void {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  const scene = new T.Scene();
  scene.background = new T.Color('#8ed7f3');
  scene.fog = new T.Fog('#bfe5ff', 28, 70);
  const camera = new T.PerspectiveCamera(39, 1, .1, 150);
  const geometries = new Set<T.BufferGeometry>();
  const materials = new Set<T.Material>();
  const own = <G extends T.BufferGeometry>(geometry: G) => { geometries.add(geometry); return geometry; };
  const material = (color: string, roughness = .85) => {
    const m = new T.MeshStandardMaterial({ color, roughness }); materials.add(m); return m;
  };
  const grass = material('#86b85a'), grassEdge = material('#79a552');
  const rock = material('#e8d7d1'), darkRock = material('#bfabc9');
  const cream = material('#fff4cd'), wood = material('#c99563');
  const pink = material('#f898b2'), mint = material('#8fdbae');
  const green = material('#6dbd69'), yellow = material('#ffe373');
  const cloudMaterial = material('#ffffff');
  const sphere = own(new T.SphereGeometry(1, 24, 16));
  const cube = own(new T.BoxGeometry(1, 1, 1));
  const stone = own(new T.DodecahedronGeometry(1, 1));
  const grassCanvas = document.createElement('canvas'); grassCanvas.width = grassCanvas.height = 256;
  const context = grassCanvas.getContext('2d')!; context.fillStyle = '#e2edca'; context.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) {
    const x = (Math.sin(i * 78.233) * 43758.5453 % 1 + 1) % 1 * 256;
    const y = (Math.sin(i * 39.425) * 19642.349 % 1 + 1) % 1 * 256;
    context.strokeStyle = i % 2 ? '#ffffff26' : '#46772824'; context.lineWidth = 1;
    context.beginPath(); context.moveTo(x, y); context.lineTo(x + Math.sin(i) * 2, y - 2 - i % 4); context.stroke();
  }
  const grassTexture = new T.CanvasTexture(grassCanvas); grassTexture.colorSpace = T.SRGBColorSpace;
  grassTexture.wrapS = grassTexture.wrapT = T.RepeatWrapping; grassTexture.repeat.set(4, 4); grassTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  grass.map = grassTexture; grassEdge.map = grassTexture;
  cloudMaterial.emissive.set('#dceaff'); cloudMaterial.emissiveIntensity = .17;
  const sky = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, uniforms: {}, vertexShader: 'varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'varying vec3 vPosition; void main(){float h=smoothstep(-0.2,0.30,normalize(vPosition).y);gl_FragColor=vec4(mix(vec3(0.70,0.88,1.),vec3(0.08,0.43,0.95),h),1.);}' });
  materials.add(sky); scene.add(new T.Mesh(own(new T.SphereGeometry(90, 32, 20)), sky));
  function mesh(parent: T.Object3D, geometry: T.BufferGeometry, m: T.Material, x: number, y: number, z: number, sx = 1, sy = sx, sz = sx) {
    const object = new T.Mesh(geometry, m); object.position.set(x, y, z); object.scale.set(sx, sy, sz);
    object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  scene.add(new T.HemisphereLight('#cfe6ff', '#766b92', 1.05));
  const fill = new T.DirectionalLight('#dbe9ff', .45); fill.position.set(2, 6, 18); scene.add(fill);
  const sunlight = new T.DirectionalLight('#ffe4ba', 3.4); sunlight.position.set(-8, 12, 8);
  sunlight.castShadow = true; sunlight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunlight.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 50 });
  sunlight.shadow.normalBias = .04; sunlight.shadow.bias = -.0001;
  scene.add(sunlight);
  const rimLight = new T.DirectionalLight('#fff2d9', 1.25);
  rimLight.position.set(8, 7, -6); rimLight.target.position.set(4.3, 0, 6.8);
  scene.add(rimLight, rimLight.target);

  // Soft, irregular sides are built in rings so islands read as floating land, not cylinders.
  function island(x: number, y: number, z: number, radius: number) {
    const group = new T.Group(); group.position.set(x, y, z); scene.add(group);
    const rings = [[0, 1], [-.23, 1.02], [-.7, .94], [-1.6, .63], [-2.4, .28], [-2.8, .03]];
    const vertices: number[] = [], indices: number[] = [], count = 48;
    rings.forEach(([height, width], ring) => {
      for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 2;
        const ripple = 1 + .035 * Math.sin(angle * 5) + .025 * Math.cos(angle * 9 + ring * .6);
        vertices.push(Math.cos(angle) * radius * width * ripple, height * radius / 3.8, Math.sin(angle) * radius * width * ripple);
        if (ring < rings.length - 1) {
          const a = ring * count + i, b = ring * count + (i + 1) % count;
          indices.push(a, a + count, b, b, a + count, b + count);
        }
      }
    });
    const side = own(new T.BufferGeometry()); side.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); side.setIndex(indices); side.computeVertexNormals();
    mesh(group, side, rock, 0, 0, 0);
    mesh(group, sphere, grassEdge, 0, -.04, 0, radius, .21, radius);
    mesh(group, sphere, grass, 0, .025, 0, radius * .98, .15, radius * .98);
    for (let i = 0; i < 15; i++) {
      const a = i / 15 * Math.PI * 2;
      const crag = mesh(group, stone, i % 4 ? rock : darkRock, Math.cos(a) * radius * .77, -radius * .37, Math.sin(a) * radius * .77, radius * .24, radius * (.32 + Math.sin(i) * .055), radius * .24);
      crag.rotation.y = a;
    }
    for (let i = 0; i < 42; i++) {
      const a = i / 42 * Math.PI * 2, s = .09 + (Math.sin(i * 2.4) + 1) * .018;
      mesh(group, sphere, i % 4 ? grassEdge : grass, Math.cos(a) * radius * .95, -.01 + Math.sin(i * 1.3) * .07, Math.sin(a) * radius * .95, radius * s, .13 + radius * .025, radius * s);
    }
    return group;
  }
  const foreground = island(6.5, -.75, 7, 8.5);
  const race = island(-2.1, .45, -9.5, 3.8);
  const pond = island(-8, -2, -5, 2.2);
  island(-11, -1.3, -18, 1.5);

  function tree(parent: T.Object3D, x: number, z: number, size: number, foliage: T.Material) {
    const group = new T.Group(); group.position.set(x, .08, z); parent.add(group);
    mesh(group, sphere, wood, 0, size * .65, 0, size * .13, size * .75, size * .13);
    mesh(group, sphere, foliage, 0, size * 1.55, 0, size * .68, size * .85, size * .63);
    mesh(group, sphere, foliage, -size * .3, size * 1.3, size * .15, size * .48);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      mesh(group, sphere, i % 3 ? foliage : green, Math.sin(a) * size * .48, size * (1.4 + Math.cos(a) * .32), Math.cos(a) * size * .4, size * .48, size * .55, size * .48);
    }
  }
  tree(foreground, 5, -4, 1.8, green);
  tree(race, -2.7, -.9, 1.5, green);
  tree(pond, -1.5, -.85, 1.1, mint);
  function flowers(parent: T.Object3D, x: number, z: number, n: number) {
    for (let i = 0; i < n; i++) {
      const px = x + Math.sin(i * 2.4) * .65, pz = z + Math.cos(i * 3.2) * .4;
      mesh(parent, sphere, green, px, .18, pz, .025, .16, .025);
      for (let j = 0; j < 5; j++) mesh(parent, sphere, i % 3 ? cream : pink, px + Math.cos(j * Math.PI * .4) * .07, .33, pz + Math.sin(j * Math.PI * .4) * .07, .07, .035, .07);
      mesh(parent, sphere, yellow, px, .35, pz, .045, .03, .045);
    }
  }
  flowers(foreground, -3.8, 2.4, 5); flowers(foreground, .8, .8, 4); flowers(race, 1.5, .65, 8);
  for (let i = 0; i < 18; i++) {
    const a = i * 2.4, r = 6.4 + Math.sin(i * 1.7) * .9;
    // Keep an open stage around the hero and along the approach path.
    if (Math.abs(Math.cos(a) * r + .5) < 1.65) continue;
    mesh(foreground, sphere, i % 2 ? grass : green, Math.cos(a) * r, .23, Math.sin(a) * r, .22 + (i % 3) * .09, .26, .24);
    for (let j = 0; j < 3; j++) {
      const leaf = mesh(foreground, sphere, i % 2 ? grass : mint, Math.cos(a) * r + j * .08, .38, Math.sin(a) * r, .045, .18, .045);
      leaf.rotation.z = (j - 1) * .45;
    }
  }
  const pathMaterial = material('#eace90');
  const pathCurve = new T.CatmullRomCurve3([new T.Vector3(-4.5, 0, -6.1), new T.Vector3(-3.3, 0, -4.1), new T.Vector3(-1.8, 0, -2), new T.Vector3(-2.2, 0, .3)]);
  const pathVertices: number[] = [], pathIndices: number[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, p = pathCurve.getPoint(t), tangent = pathCurve.getTangent(t);
    for (const side of [-1, 1]) {
      const x = p.x + tangent.z * (1.05 - t * .3) * side;
      const z = p.z - tangent.x * (1.05 - t * .3) * side;
      const y = .025 + .15 * Math.sqrt(Math.max(0, 1 - (x * x + z * z) / (8.5 * .98) ** 2)) + .008;
      pathVertices.push(x, y, z);
    }
    if (i < 40) { const a = i * 2; pathIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const pathGeometry = own(new T.BufferGeometry());
  pathGeometry.setAttribute('position', new T.Float32BufferAttribute(pathVertices, 3)); pathGeometry.setIndex(pathIndices); pathGeometry.computeVertexNormals();
  mesh(foreground, pathGeometry, pathMaterial, 0, 0, 0);
  const pathEnd = mesh(foreground, own(new T.CircleGeometry(.75, 32)), pathMaterial, -2.2, .178, .3);
  pathEnd.rotation.x = -Math.PI / 2;

  // A rising curved footbridge connects the welcome island to the race portal.
  const bridge = new T.CatmullRomCurve3([new T.Vector3(2, -.55, .9), new T.Vector3(-.6, -.1, -1.8), new T.Vector3(-3, .25, -4.3), new T.Vector3(-2.2, .65, -6.4)]);
  for (let i = 0; i <= 27; i++) {
    const t = i / 27, p = bridge.getPoint(t), tangent = bridge.getTangent(t);
    const plank = mesh(scene, cube, i % 3 ? cream : wood, p.x, p.y, p.z, 2.1, .13, .32);
    plank.rotation.y = Math.atan2(tangent.x, tangent.z);
    if (i % 4 === 0) {
      for (const side of [-1, 1]) mesh(scene, sphere, wood, p.x + tangent.z * 1.08 * side, p.y + .4, p.z - tangent.x * 1.08 * side, .065, .5, .065);
    }
  }
  for (const side of [-1, 1]) {
    const points = Array.from({ length: 40 }, (_, i) => {
      const t = i / 39, p = bridge.getPoint(t), tangent = bridge.getTangent(t);
      return new T.Vector3(p.x + tangent.z * 1.08 * side, p.y + .8, p.z - tangent.x * 1.08 * side);
    });
    mesh(scene, own(new T.TubeGeometry(new T.CatmullRomCurve3(points), 48, .026, 5, false)), wood, 0, 0, 0);
  }
  const violet = material('#ad8ada');
  const gateway = new T.Group(); race.add(gateway); gateway.scale.setScalar(1.5);
  for (let i = 0; i < 9; i++) {
    const segment = own(new T.TorusGeometry(1.02, .25, 8, 6, Math.PI / 9));
    const block = mesh(gateway, segment, i % 2 ? cream : violet, 0, 1.1, -.5); block.rotation.z = i * Math.PI / 9;
  }
  for (const x of [-1.02, 1.02]) {
    mesh(gateway, sphere, pink, x, .64, -.5, .17, .6, .17);
    mesh(gateway, sphere, cream, x, .13, -.5, .32, .15, .32);
  }
  for (let i = 0; i < 7; i++) mesh(race, cube, i % 2 ? cream : mint, -.9 + i * .3, .18, .75, .29, .07, .65);
  const water = material('#53c5d8', .25);
  mesh(pond, sphere, cream, .25, .15, .2, 1.4, .11, 1.1);
  mesh(pond, sphere, water, .25, .22, .2, 1.22, .065, .93);
  for (const [x, z] of [[.7, .1], [-.2, .6]]) mesh(pond, sphere, green, x, .285, z, .18, .015, .15);

  const player = createPlayerCharacter();
  setCharacterExpression(player, 'happy');
  player.getObjectByName('player-marker')!.visible = false;
  player.position.set(4.3, 0, 6.8); player.rotation.y = Math.PI - .35; player.scale.setScalar(1.35); scene.add(player);
  const avatar = player.getObjectByName('avatar')!;
  const wavingArm = player.getObjectByName('arm-1')!;
  wavingArm.position.set(-.5, .24, -.2);
  player.getObjectByName('arm1')!.rotation.z = -.3;
  player.getObjectByName('face')!.rotation.z = .05;
  player.updateWorldMatrix(true, true);
  foreground.updateWorldMatrix(true, true);
  const groundRay = new T.Raycaster(new T.Vector3(player.position.x, 5, player.position.z), new T.Vector3(0, -1, 0));
  const groundMeshes = foreground.children.filter(node => node instanceof T.Mesh && [grass, grassEdge, pathMaterial].includes(node.material as T.MeshStandardMaterial));
  const groundY = groundRay.intersectObjects(groundMeshes)[0].point.y;
  player.position.y += groundY - .012 - new T.Box3().setFromObject(avatar).min.y;
  // Small contact shadows keep the feet grounded even under the bright sky fill light.
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
  const shadowContext = shadowCanvas.getContext('2d')!;
  const gradient = shadowContext.createRadialGradient(32, 32, 4, 32, 32, 32);
  gradient.addColorStop(0, '#34294188'); gradient.addColorStop(1, '#34294100');
  shadowContext.fillStyle = gradient; shadowContext.fillRect(0, 0, 64, 64);
  const contactTexture = new T.CanvasTexture(shadowCanvas);
  const contactMaterial = new T.MeshBasicMaterial({ map: contactTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  materials.add(contactMaterial);
  const contactShadow = new T.Group(); scene.add(contactShadow);
  player.updateWorldMatrix(true, true);
  for (const side of [-1, 1]) {
    const foot = player.getObjectByName('foot' + side)!;
    const footPosition = foot.getWorldPosition(new T.Vector3());
    groundRay.ray.origin.set(footPosition.x, 5, footPosition.z);
    const shadow = new T.Mesh(own(new T.PlaneGeometry(.85, .95)), contactMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(footPosition.x, groundRay.intersectObjects(groundMeshes)[0].point.y + .004, footPosition.z);
    contactShadow.add(shadow);
  }

  const clouds: { group: T.Group; x: number; phase: number }[] = [];
  function cloud(x: number, y: number, z: number, size: number, phase: number) {
    const group = new T.Group(); group.position.set(x, y, z); scene.add(group);
    for (let i = 0; i < 8; i++) {
      const puff = mesh(group, sphere, cloudMaterial, Math.sin(i * 2.4) * size * 1.15, Math.sin(i * 1.7) * size * .32, Math.cos(i * 2.4) * size * .65, size * (.6 + (i % 3) * .12), size * (.5 + (i % 3) * .12), size * .64);
      puff.castShadow = false; puff.receiveShadow = false;
    }
    clouds.push({ group, x, phase });
  }
  cloud(-11, 3.1, -22, 2, 0); cloud(5, 5.4, -25, 2, 1); cloud(14, 1.5, -17, 2.1, 2);
  cloud(-12, -3.5, -8, 3, 3); cloud(-1, -4.4, -10, 3, 4); cloud(9, -4, -6, 3, 5);
  cloud(-8, -5.8, 5, 3.3, 6); cloud(4, -5.6, 7, 3.4, 7); cloud(13, -4.7, 3, 2.5, 8);
  for (let i = 0; i < 24; i++) cloud(-22 + (i % 8) * 6.3, -4 + Math.sin(i * 2.4) * .8, -27 + Math.floor(i / 8) * 9, 2.2 + (i % 3) * .4, i);
  tree(race, 2.6, -1.2, 1.3, green);
  for (const [x, z, r] of [[-6, -20, 1.5], [3, -24, 2], [9, -22, 1.7]]) {
    const distant = island(x, 1.5, z, r); tree(distant, 0, 0, .75, mint);
  }
  // Batch repeated static landscape pieces; animated character and cloud roots stay independent.
  const batches = new Map<string, T.Mesh[]>(), instances: T.InstancedMesh[] = [];
  const moving = new Set<T.Object3D>([player, contactShadow, ...clouds.map(c => c.group)]);
  scene.updateMatrixWorld(true);
  scene.traverse(object => {
    if (!(object instanceof T.Mesh) || object.material === sky) return;
    for (let ancestor: T.Object3D | null = object; ancestor; ancestor = ancestor.parent) if (moving.has(ancestor)) return;
    const key = object.geometry.uuid + (object.material as T.Material).uuid;
    const batch = batches.get(key) ?? []; batch.push(object); batches.set(key, batch);
  });
  for (const batch of batches.values()) {
    if (batch.length < 2) continue;
    const instance = new T.InstancedMesh(batch[0].geometry, batch[0].material, batch.length);
    instance.castShadow = true; instance.receiveShadow = true;
    batch.forEach((object, index) => { instance.setMatrixAt(index, object.matrixWorld); object.removeFromParent(); });
    instance.instanceMatrix.needsUpdate = true; scene.add(instance); instances.push(instance);
  }
  for (const { group } of clouds) {
    const puffs = [...group.children] as T.Mesh[];
    const instance = new T.InstancedMesh(sphere, cloudMaterial, puffs.length);
    puffs.forEach((puff, index) => { puff.updateMatrix(); instance.setMatrixAt(index, puff.matrix); });
    group.clear(); group.add(instance); instances.push(instance);
  }

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let portrait = false;
  const target = new T.Vector3(), position = new T.Vector3();
  function resize() {
    const width = canvas.clientWidth || innerWidth, height = canvas.clientHeight || innerHeight;
    portrait = width / height < .85;
    renderer.setSize(width, height, false); camera.aspect = width / height;
    camera.fov = portrait ? 46 : 39;
    position.set(portrait ? 4.3 : -1.5, portrait ? 9 : 7, portrait ? 24 : 22);
    target.set(portrait ? 4.3 : -1.5, portrait ? -.8 : 1, 0);
    camera.position.copy(position); camera.lookAt(target); camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  let frame = 0;
  const diagnostics = new URLSearchParams(location.search).has('test');
  const start = performance.now();
  const groundedY = player.position.y;
  let arrivalStart: number | undefined;
  const arrive = () => { arrivalStart = performance.now(); };
  document.addEventListener('journey-arrival', arrive);
  function render(now: number) {
    const time = reducedMotion.matches ? 0 : (now - start) / 1000;
    const wave = Math.sin(time * 7) * Math.sin(Math.PI * Math.min((time % 6) / 3, 1));
    wavingArm.rotation.z = -.65 + wave * .5;
    wavingArm.position.y = .24 + wave * .045;
    for (const side of [-1, 1]) player.getObjectByName('ear' + side)!.rotation.z = .05 - side * (.22 + Math.sin(time * 1.6) * .018);
    for (const { group, x, phase } of clouds) group.position.x = x + Math.sin(time * .07 + phase) * .45;
    if (arrivalStart !== undefined && !reducedMotion.matches) {
      const progress = T.MathUtils.smoothstep((now - arrivalStart) / 1000, 0, 1.65);
      camera.position.copy(position).add(new T.Vector3(0, 2 * (1 - progress), 5 * (1 - progress)));
      camera.lookAt(target);
      player.position.y = groundedY + .9 * (1 - progress);
      avatar.scale.y = 1 - Math.sin(Math.PI * T.MathUtils.smoothstep(progress, .75, 1)) * .08;
      contactShadow.visible = progress > .8;
      if (progress === 1) arrivalStart = undefined;
    }
    renderer.render(scene, camera);
    if (diagnostics) {
      const bounds = new T.Box3().setFromObject(player.getObjectByName('avatar')!);
      const points: T.Vector3[] = [];
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) points.push(new T.Vector3(x, y, z).project(camera));
      Object.assign(window, { __HOME_DIAGNOSTICS__: {
        calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
        hero: { heightRatio: (Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y))) / 2, x: (player.position.clone().project(camera).x + 1) / 2 },
        portrait, reducedMotion: reducedMotion.matches,
      } });
    }
    frame = requestAnimationFrame(render);
  }
  frame = requestAnimationFrame(render);
  return () => {

    cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('journey-arrival', arrive);
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    grassTexture.dispose(); contactTexture.dispose();
    instances.forEach(instance => instance.dispose());
    if (diagnostics) Reflect.deleteProperty(window, '__HOME_DIAGNOSTICS__');

    // Character geometry/materials are shared with levels; only its per-instance marker is owned here.
    player.getObjectByName('player-marker')!.traverse(node => {
      if (node instanceof T.Mesh) { node.geometry.dispose(); (node.material as T.Material).dispose(); }
    });
    renderer.dispose();
  };
}
