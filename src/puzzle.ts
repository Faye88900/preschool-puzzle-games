import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import R from '@dimforge/rapier3d-compat';
import { bean, label, mat, orb } from './models';
import { UI } from './ui';
import { readSettings, saveSettings } from './settings';
import { movement, acceleration, animateWalk } from './movement';
import { setCharacterExpression } from './character';
import { PuzzleAudio, type PuzzleSound } from './puzzle-audio';
import { rounded, chickenCoop, gardenFlower, colorFlower, gateMesh, padlock, lantern, entranceArch, elbowCurve, waterPipe, animateWater } from './puzzle-art';

const STEP = movement.step;
const colors = ['#ffd15a', '#76cde8', '#f29bbe'];
type Spot = { x: number; z: number };
const spawn = { x: 0, z: 10 };
const plateSpot = { x: -24, z: -17 };
const cubeHome = { x: -29, z: -13 };
const keySpots = [{ x: -24, z: -31 }, { x: 26, z: -25.5 }, { x: 13, z: -57 }];
const pipeSpots = [{ x: 22, z: -17 }, { x: 22, z: -21 }, { x: 26, z: -21 }];
const pipeSolution = [0, 2, 0]; // Each elbow joins west+north, rotated in quarter turns.
const pipeReach = 3.3;
const grainSpot = { x: -4, z: -47 };
const chickenHome = { x: -4, z: -50 };
const tunnelSpot = { x: 13, z: -58 };
const nestSpot = { x: 13, z: -62 };
const zones = [
  { x: -24, z: -18, name: '积木工坊', goal: '积木工坊 · 铁门关着，地上的图案有点特别。' },
  { x: 24, z: -22, name: '流水池塘', goal: '流水池塘 · 水在这里停住了，小花好像有些口渴。' },
  { x: 0, z: -54, name: '动物朋友', goal: '动物朋友 · 小鸡盯着谷粒，鸡舍里似乎藏着什么。' },
];
// Only the square block fits the plate; the rest are shape decoys the player can still carry.
type Piece = Spot & { home: Spot; mesh: T.Mesh; body: R.RigidBody; reach: number; placed: boolean; name: string; square: boolean; rest: number };

export class PuzzleGarden {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(55, 1, .5, 340);
  cameraLook = new T.Vector3();
  cameraGoal = new T.Vector3();
  renderer!: T.WebGLRenderer;
  world!: R.World;
  body!: R.RigidBody;
  player = bean('#ee5798', true);
  models = new Map<string, T.Group>();
  overviewMode = false;
  previous = new T.Vector3();
  carryPosition = new T.Vector3();
  heading = 0;
  gait = 0;
  grounded = true;
  jumpRequested = false;
  coyote = 0;
  jumpBuffer = 0;
  jumpCooldown = 0;
  ui!: UI;
  state = 'ready';
  paused = false;
  settings = readSettings();
  get muted() { return !this.settings.music && !this.settings.effects; }
  keys = new Set<string>();
  stick = { x: 0, y: 0 };
  collected = [false, false, false];
  happyUntil = 0;
  solvedCount = 0;
  carryingGrain = false;
  grainPlaced = false;
  chickenState: 'idle' | 'following' | 'entering' | 'fetching' | 'returning' | 'delivered' = 'idle';
  chickenMood = '';
  chicken!: T.Group;
  grain = new T.Group();
  pipeTurns = [1, 0, 3];
  pipesSolved = false;
  pipeTouched = false;
  flowReached = 0;
  pavedBounds: T.Box3[] = [];
  animalSolved = false;
  region = -1;
  normalCue = '';
  hintActive = false;
  pieces: Piece[] = [];
  carried = -1;
  gate!: { mesh: T.Group; body: R.RigidBody };
  exit!: { mesh: T.Group; body: R.RigidBody };
  keyMeshes: T.Group[] = [];
  pipeMeshes: T.Group[] = [];
  supply!: T.Group;
  outlet!: T.Group;
  watering = new T.Group();
  waterFlower!: T.Group;
  flowerPlatforms: R.Collider[] = [];
  flowerPlatformScale = 0;
  locks: T.Group[] = [];
  plate!: T.Mesh;
  sun = new T.DirectionalLight('#ffe2b5', 3);
  cue = '花园里藏着3把钥匙，会在哪里呢？';
  last = 0;
  accumulator = 0;
  time = 0;
  audio?: PuzzleAudio;
  reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  async init() {
    await R.init();
    this.world = new R.World({ x: 0, y: -23, z: 0 });
    this.world.timestep = STEP;
    this.renderer = new T.WebGLRenderer({ canvas: document.querySelector('#game')!, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setClearColor('#b9d5e3');
    this.scene.fog = new T.Fog('#dce3d8', 65, 170);
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.03;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.scene.add(new T.HemisphereLight('#c7dfff', '#b5a791', 1.5));
    const sun = this.sun;
    // A fixed afternoon sun covers the whole garden, so distant trees keep their shadows.
    sun.position.set(-48, 52, -68); sun.target.position.set(0, 0, -28); sun.castShadow = true;
    sun.shadow.mapSize.setScalar(matchMedia('(pointer: coarse)').matches || innerWidth < 700 ? 2048 : 4096);
    Object.assign(sun.shadow.camera, { left: -65, right: 65, top: 55, bottom: -55, near: 1, far: 150 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -.00008;
    sun.shadow.normalBias = .04;
    sun.shadow.radius = 2;
    this.scene.add(sun, sun.target);
    await this.loadModels();
    this.build();
    this.audio = new PuzzleAudio(); await this.audio.load();
    this.body = this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(spawn.x, .8, spawn.z).lockRotations().setLinearDamping(movement.damping).setCcdEnabled(true));
    this.previous.copy(this.body.translation());
    this.world.createCollider(R.ColliderDesc.capsule(.25, .4).setMass(1).setFriction(movement.friction).setRestitution(0), this.body);
    this.scene.add(this.player);
    this.ui = new UI({ start: () => this.start(), pause: () => this.pause(), mute: () => {
      this.settings = { music: this.muted, effects: this.muted }; saveSettings(this.settings);
      if (!this.settings.effects) window.speechSynthesis?.cancel();
      this.audio?.applySettings(this.settings);
    }, move: (x, y) => this.stick = { x, y }, jump: () => this.jumpRequested = true, dive: () => this.interact(), hint: () => this.hint() });
    this.ui.configurePuzzle();
    document.querySelector('#game')!.setAttribute('aria-label', '第二关：三把钥匙的解谜花园');
    addEventListener('keydown', event => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
      if (event.repeat) return;
      if (event.code === 'KeyE' || event.code.startsWith('Shift')) this.interact();
      if (event.code === 'Space') this.jumpRequested = true;
      if (event.code === 'KeyH') this.hint();
      if (event.code === 'Escape') this.pause();
    });
    addEventListener('keyup', event => this.keys.delete(event.code));
    const suspend = () => { this.clearInput(); if (this.state === 'racing' && !this.paused) this.pause(); };
    addEventListener('blur', suspend);
    document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
    addEventListener('resize', () => { this.clearInput(); this.resize(); });
    this.resize(); this.render();
    if (new URLSearchParams(location.search).has('test')) {
      Object.assign(window, { __PUZZLE_TEST__: {
        audio: () => ({ music: { paused: this.audio!.music.paused, muted: this.audio!.music.muted, loop: this.audio!.music.loop, time: this.audio!.music.currentTime, volume: this.audio!.music.volume, error: this.audio!.music.error?.code ?? null }, state: this.audio?.context.state, loaded: [...this.audio!.buffers.keys()], plays: { ...this.audio!.plays }, active: [...this.audio!.sources.keys()], master: this.audio!.master.gain.value, water: this.audio!.waterGain.gain.value, flowReached: this.flowReached, winDuration: this.audio!.buffers.get('win')?.duration }),
        pond: () => ({ wet: this.pipeMeshes.map(pipe => pipe.getObjectByName('flow')!.visible),
          angles: this.pipeMeshes.map(pipe => pipe.rotation.y), watering: this.watering.visible,
          bloom: this.waterFlower.scale.y, key: this.keyMeshes[1].position.toArray(), flowerTop: .49 + 1.33 * this.waterFlower.scale.y,
          drops: this.outlet.getObjectByName('flow')!.children.slice(1).map(drop => drop.position.toArray()) }),
        appearance: () => ({ plateY: this.plate.position.y, workshopY: this.gate.mesh.position.y,
          blocks: this.pieces.map(piece => piece.mesh.position.toArray()),
          exitYaw: ['left-leaf', 'right-leaf'].map(name => this.exit.mesh.getObjectByName(name)!.rotation.y),
          outletColor: ((this.scene.getObjectByName('water-outlet') as T.Mesh).material as T.MeshStandardMaterial).color.getHexString(),
        }),
        models: () => ({ instances: this.scene.children.filter(node => this.models.has(node.name)).map(node => {
          const bounds = new T.Box3().setFromObject(node);
          return { name: node.name, min: bounds.min.toArray(), max: bounds.max.toArray(), ndc: bounds.getCenter(new T.Vector3()).project(this.camera).toArray() };
        }), calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles }),
        overview: () => {
          this.overviewMode = true;
          this.scene.fog = null;
          this.camera.fov = 43; this.camera.updateProjectionMatrix();
          this.camera.position.set(6, 77, 50); this.camera.lookAt(0, 0, -27);
          this.renderer.render(this.scene, this.camera);
        },
        snapshot: () => ({ state: this.state, paused: this.paused, expression: this.player.userData.expression, collected: [...this.collected], animal: { state: this.chickenState, mood: this.chickenMood, position: this.chicken.position.toArray(), carryingGrain: this.carryingGrain, grainPlaced: this.grainPlaced, grainPosition: this.grain.position.toArray(), solved: this.animalSolved, key: this.keyMeshes[2].position.toArray() }, pipeTurns: [...this.pipeTurns], pipesSolved: this.pipesSolved, carried: this.carried, carriedName: this.carried < 0 ? null : this.pieces[this.carried].name, placed: this.pieces.map(p => p.placed), position: this.body.translation(), region: this.region, hintActive: this.hintActive, gateOpen: this.pieces[0].placed, exitOpen: this.collected.every(Boolean), camera: { type: this.camera.type, fov: this.camera.fov, position: this.camera.position.toArray(), look: this.cameraLook.toArray(), playerNdc: this.player.position.clone().project(this.camera).toArray() } }),
        motion: () => ({ velocity: this.body.linvel(), heading: this.heading, rotation: this.player.rotation.y, gait: this.gait, bob: this.player.getObjectByName('avatar')!.position.y, roll: this.player.getObjectByName('avatar')!.rotation.z, feet: [-1, 1].map(s => this.player.getObjectByName('foot' + s)!.rotation.x), arms: [-1, 1].map(s => this.player.getObjectByName('arm' + s)!.rotation.x), carriedPosition: this.carried >= 0 ? this.pieces[this.carried].mesh.position.toArray() : null, playerPosition: this.player.position.toArray() }),
        warp: (x: number, z: number) => { this.body.setTranslation({ x, y: .8, z }, true); this.previous.copy(this.body.translation()); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true); this.render(); },
      } });
    }
    requestAnimationFrame(t => this.tick(t));
  }

  box(x: number, y: number, z: number, w: number, h: number, d: number, color: string, solid = true) {
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), mat(color));
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; this.scene.add(mesh);
    if (solid) {
      const body = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x, y, z));
      this.world.createCollider(R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setFriction(.7), body);
    }
    return mesh;
  }
  sign(text: string, x: number, z: number, color: string, scale = .8) {
    const mesh = label(text, '#355d57', color); mesh.scale.setScalar(scale);
    mesh.position.set(x, 3.1, z + .12); this.scene.add(mesh);
    const w = 7 * scale + .22, h = 1.75 * scale + .22;
    this.box(x, 3.1, z, w, h, .2, '#bb955d', false).geometry = rounded(w, h, .2);
    this.box(x, 1.2, z, .16, 2.4, .16, '#d5ae79', false);
  }
  async loadModels() {
    const draco = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}models/draco/`);
    const loader = new GLTFLoader().setDRACOLoader(draco);
    try {
      await Promise.all(['apple-tree', 'chicken', 'bld-general-store-01', 'home-cottage-01', 'home-thatched-house-01', 'tree-oak-01', 'bush-round-01', 'water-pond-01', 'cattail-reed-clump', 'bench-01', 'streetlamp-01', 'picket-fence-01', 'road-cobble-straight-01', 'road-cobble-corner-01', 'fire-hydrant', 'terrain-grass-01', 'crate-01', 'barrel-01'].map(async name => {
        const { scene } = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`);
        const bounds = new T.Box3().setFromObject(scene);
        if (name.startsWith('road-cobble-')) {
          // Fit the tile's earth slab, not the grass tufts protruding beyond its grid edges.
          bounds.makeEmpty();
          scene.traverse(node => {
            if (!(node instanceof T.Mesh)) return;
            const positions = node.geometry.getAttribute('position'), colors = node.geometry.getAttribute('color');
            const point = new T.Vector3();
            for (let i = 0; i < colors.count; i++) if (colors.getY(i) < colors.getX(i) * .65) {
              bounds.expandByPoint(point.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld));
            }
          });
        }
        const size = bounds.getSize(new T.Vector3());
        const scale = 1 / size.x;
        scene.scale.setScalar(scale);
        scene.position.set(-(bounds.min.x + bounds.max.x) / 2 * scale, -bounds.min.y * scale, -(bounds.min.z + bounds.max.z) / 2 * scale);
        scene.traverse(node => {
          if (!(node instanceof T.Mesh)) return;
          node.receiveShadow = true;
          node.castShadow = name !== 'water-pond-01' && name !== 'terrain-grass-01' && !name.startsWith('road-cobble-');
          if (name.startsWith('road-cobble-') || name === 'picket-fence-01') {
            const fence = name === 'picket-fence-01';
            const colors = node.geometry.getAttribute('color'), tint = new T.Color(fence ? '#fff0cf' : '#c9cbce'), grass = new T.Color('#8fba55'), color = new T.Color();
            for (let i = 0; i < colors.count; i++) {
              color.fromBufferAttribute(colors, i);
              if (!fence && (color.g > color.r * 1.5 || color.g < color.r * .65)) color.copy(grass);
              else color.lerp(tint, fence ? .9 : .45);
              colors.setXYZ(i, color.r, color.g, color.b);
            }
            colors.needsUpdate = true;
          }
        });
        const root = new T.Group(); root.add(scene); root.name = name;
        this.models.set(name, root);
      }));
    } finally { draco.dispose(); }
  }
  tree(x: number, z: number) {
    this.prop('apple-tree', x, z, 4.46);
  }
  prop(name: string, x: number, z: number, width: number, angle = 0, solid = false) {
    const root = this.models.get(name)!.clone();
    root.scale.setScalar(width); root.position.set(x, 0, z); root.rotation.y = angle; this.scene.add(root);
    if (solid) {
      const bounds = new T.Box3().setFromObject(root), size = bounds.getSize(new T.Vector3()), center = bounds.getCenter(new T.Vector3());
      const body = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z));
      this.world.createCollider(R.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2), body);
    }
    return root;
  }
  piece(name: string, geometry: T.BufferGeometry, color: string, home: Spot, rest: number, square = false): Piece {
    const mesh = new T.Mesh(geometry, mat(color));
    mesh.castShadow = mesh.receiveShadow = true; this.scene.add(mesh);
    geometry.computeBoundingBox();
    const size = geometry.boundingBox!.getSize(new T.Vector3());
    const body = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(home.x, rest, home.z));
    this.world.createCollider(R.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2), body);
    return { ...home, home: { ...home }, mesh, body, reach: Math.max(size.x, size.z) / 2, placed: false, name, square, rest };
  }
  // A resting block is solid, so its collider follows it and switches off only while it is carried.
  place(piece: Piece, x: number, z: number, placed: boolean) {
    piece.x = x; piece.z = z; piece.placed = placed;
    piece.body.setTranslation({ x, y: placed ? 1.005 : piece.rest, z }, true);
    piece.body.setEnabled(true);
  }
  // Put a dropped block at arm's length so its collider never spawns around the player.
  dropSpot(piece: Piece): Spot {
    const p = this.body.translation();
    const offset = new T.Vector3(0, 0, -(.4 + piece.reach + .25)).applyQuaternion(this.player.quaternion);
    return { x: p.x + offset.x, z: p.z + offset.z };
  }
  flower(x: number, z: number, symbol?: number) {
    const flower = gardenFlower(symbol); flower.position.set(x, .18, z);
    this.scene.add(flower); return flower;
  }
  door(x: number, z: number, width: number, color: string) {
    const mesh = gateMesh(width, color, z === -72); mesh.position.set(x, 0, z); this.scene.add(mesh);
    const body = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x, 1.5, z));
    this.world.createCollider(R.ColliderDesc.cuboid(width / 2, 1.5, .15), body);
    return { mesh, body };
  }
  build() {
    // A walkable hub, two side trails and a northern grove; every puzzle is independent.
    this.box(0, -.5, -28, 78, 1, 96, '#8fba55');
    for (const x of [-38, 38]) this.box(x, .55, -28, .4, 1.1, 96, '#fff2d4');
    this.box(0, .55, 19, 76, 1.1, .4, '#fff2d4');
    this.box(0, .55, -75, 76, 1.1, .4, '#fff2d4');
    this.box(0, .012, -26, 6, .025, 88, '#f5e5b8', false);
    for (const z of [-9, -40]) this.box(0, .015, z, 52, .03, 5, '#f5e5b8', false);
    for (const x of [-24, 24]) this.box(x, .017, -25, 5, .035, 34, '#f5e5b8', false);
    this.box(0, .02, 2, 17, .04, 14, '#eee1c0', false);
    this.sign('← 工坊   池塘 →', -6, -5, '#fff7d5', .9);
    this.sign('↑ 动物朋友', -6, -35, '#ffe0ed');
    for (const x of [-6, 6]) {
      this.prop('bench-01', x, 4, 3.5, 0, true);
    }

    // Square workshop: the key can be seen through the iron bars before solving.
    this.box(-24, .025, -20, 22, .05, 31, '#dfd3ae', false);
    for (const x of [-29, -19]) {
      this.box(x, 1.5, -29, .3, 3, 10, '#3a756b').visible = false;
      const fence = gateMesh(10, '#3a756b', false); fence.position.set(x, 0, -29); fence.rotation.y = Math.PI / 2; this.scene.add(fence);
    }
    this.box(-24, 1.5, -34, 10.3, 3, .3, '#3a756b').visible = false;
    const rearFence = gateMesh(10.3, '#3a756b', false); rearFence.position.set(-24, 0, -34); this.scene.add(rearFence);
    this.gate = this.door(-24, -24, 10, '#3a756b');
    this.box(plateSpot.x, .13, plateSpot.z, 2.8, .26, 2.8, '#e8d9b6', false).geometry = rounded(2.8, .26, 2.8);
    this.box(plateSpot.x, .265, plateSpot.z, 2.35, .08, 2.35, '#8c8065', false).geometry = rounded(2.35, .08, 2.35, .03);
    this.plate = this.box(plateSpot.x, .34, plateSpot.z, 2.1, .14, 2.1, colors[0], false);
    this.plate.geometry = rounded(2.1, .14, 2.1, .04);
    // One collider for the whole pedestal stack: the player stops at its rim or jumps on top.
    const pedestal = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(plateSpot.x, .205, plateSpot.z));
    this.world.createCollider(R.ColliderDesc.cuboid(1.4, .205, 1.4).setFriction(.7), pedestal);
    // The blocks are solid, so they flank the yard instead of standing on either walkway.
    this.pieces = [
      this.piece('正方体', rounded(1.3, 1.3, 1.3, .09), colors[0], cubeHome, .78, true),
      this.piece('圆柱积木', new T.CylinderGeometry(.62, .62, 1.2, 24), '#7fd0bb', { x: -19, z: -13 }, .73),
      this.piece('三角积木', new T.CylinderGeometry(.82, .82, 1.1, 3), '#c6a3e4', { x: -29, z: -19 }, .68),
      this.piece('长方体', rounded(1.9, .9, 1.1, .08), '#f0a079', { x: -19, z: -19 }, .58),
    ];
    for (let z = -18; z > -24; z -= 1) this.box(-24, .055, z, .15, .04, .5, '#eab443', false);
    for (const [x, z] of [[-32, -9], [-33, -13], [-16, -30]]) this.box(x, .55, z, 2, 1.1, 2, '#b5bdab');

    // Three rotatable elbows form a visible, continuous source-to-flower water path.
    this.box(24, .026, -23, 22, .052, 31, '#eddbad', false);
    this.box(17, .28, -21.5, 6, .56, 7, '#fff0cd').visible = false;
    const pond = this.prop('water-pond-01', 17, -21.5, 6);
    pond.scale.y *= .48; pond.scale.z = 7;
    pond.position.y = .06; // Keep the shallow water mesh above the pond plaza.
    for (const [x, z, angle] of [[14.8, -19, .3], [15, -24, 1.8], [19.1, -24, -.6]]) {
      const reeds = this.prop('cattail-reed-clump', x, z, 1.25, angle);
      reeds.position.y = .35;
    }
    this.sign('让水流到小花', 18, -27, '#d8f4ff', .7);
    this.box(18, .75, -17, 1.4, 1.4, 1.4, '#88ad4d').geometry = rounded(1.4, 1.4, 1.4);
    this.box(18, 1.455, -17, .8, .025, .8, '#276f89', false);
    this.box(18, 1.47, -17, .58, .015, .58, '#73d6e8', false);
    this.supply = waterPipe(new T.CatmullRomCurve3([new T.Vector3(18, .71, -18.5), new T.Vector3(18, .71, -17), new T.Vector3(20, .71, -17)]));
    this.scene.add(this.supply);
    pipeSpots.forEach(spot => {
      const base = new T.Mesh(new T.CylinderGeometry(1.8, 1.9, .25, 16), mat('#e8d9b6'));
      base.position.set(spot.x, .18, spot.z); base.receiveShadow = true; this.scene.add(base);
      const pedestal = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(spot.x, .18, spot.z));
      this.world.createCollider(R.ColliderDesc.cylinder(.125, 1.9).setFriction(.7), pedestal);
      const turf = new T.Mesh(new T.CylinderGeometry(1.48, 1.48, .035, 24), mat('#90b458'));
      turf.position.set(spot.x, .325, spot.z); this.scene.add(turf);
      const group = waterPipe(elbowCurve); group.position.set(spot.x, .85, spot.z);
      // The turf turns with the pipe; the stone plinth stays fixed.
      group.attach(turf);
      this.scene.add(group); this.pipeMeshes.push(group);
    });
    this.supply.position.y = .14;
    this.outlet = waterPipe(new T.CatmullRomCurve3([new T.Vector3(26, .85, -23), new T.Vector3(26, .85, -24.1), new T.Vector3(26, .45, -25)]));
    this.scene.add(this.outlet);
    const bowl = new T.Mesh(new T.CylinderGeometry(1.4, 1.25, .38, 20), mat('#e8d9b6'));
    bowl.position.set(26, .25, -25.5); bowl.receiveShadow = true; this.scene.add(bowl);
    const flowerBase = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(26, .25, -25.5));
    this.world.createCollider(R.ColliderDesc.cylinder(.19, 1.4).setFriction(.7), flowerBase);
    const basin = new T.Mesh(new T.CylinderGeometry(1.13, 1.13, .04, 24), mat('#a5b4b8'));
    basin.position.set(26, .46, -25.5); basin.name = 'water-outlet'; this.scene.add(basin);
    this.waterFlower = this.flower(26, -25.5);
    this.waterFlower.position.y = .49;
    // Two thin discs approximate the broad leaves and petals as jumpable surfaces.
    for (const [y, radius, halfHeight] of [[.38, 1.05, .13], [1.24, 1.12, .09]]) {
      const collider = this.world.createCollider(R.ColliderDesc.cylinder(halfHeight, radius).setFriction(.7));
      collider.setTranslation({ x: 26, y: .49 + y * .72, z: -25.5 });
      this.flowerPlatforms.push(collider);
    }
    this.watering.position.set(26, .52, -25.5); this.scene.add(this.watering);
    for (let i = 0; i < 9; i++) this.watering.add(orb('#b9f3ff', 0, 0, 0, .075));
    for (const [x, z, width] of [[17, -29, 3.2], [20, -30, 2.4], [30, -34, 3], [32, -24, 2.5], [15.5, -14, 2]]) this.prop('bush-round-01', x, z, width, z);
    for (const [x, z] of [[17, -33], [30, -35]]) this.tree(x, z);
    this.prop('bench-01', 29, -30, 3.5, 0, true);
    for (const x of [16, 20, 24, 28, 32]) this.prop('picket-fence-01', x, -37, 4, 0, true);
    for (const [x, z] of [[16, -30], [21, -33], [32, -32]]) {
      const grass = this.prop('terrain-grass-01', x, z, 3.5); grass.scale.y = 1.75; grass.position.y = -.16;
    }
    for (const [x, z] of [[15, -27], [16, -28], [20, -29], [29, -33], [31, -28], [32, -26], [30, -16]]) {
      const flower = this.flower(x, z); flower.scale.setScalar(.35); colorFlower(flower, '#fff4d4', true);
    }

    // Guide a small friend around crates to a passage too low for the player.
    // Two little farm yards linked across the clear central avenue.
    const yard = (x: number, z: number, rx: number, rz: number) => {
      const patch = new T.Mesh(new T.CircleGeometry(1, 48), mat('#d9c799'));
      patch.rotation.x = -Math.PI / 2; patch.scale.set(rx, rz, 1); patch.position.set(x, .045, z);
      patch.receiveShadow = true; this.scene.add(patch);
    };
    yard(-5, -49, 4.4, 3.8); yard(13, -59, 5.8, 5.4);
    const trail = new T.CatmullRomCurve3([new T.Vector3(-4, .04, -49), new T.Vector3(-.5, .04, -51), new T.Vector3(6, .04, -52), new T.Vector3(11, .04, -54), new T.Vector3(13, .04, -57)]);
    const outline = new T.Shape(), edges: T.Vector3[][] = [[], []];
    for (let i = 0; i <= 32; i++) {
      const t = i / 32, point = trail.getPoint(t), tangent = trail.getTangent(t);
      for (let side = 0; side < 2; side++) edges[side].push(new T.Vector3(point.x + tangent.z * (side ? -1.25 : 1.25), -point.z + tangent.x * (side ? -1.25 : 1.25)));
    }
    [...edges[0], ...edges[1].reverse()].forEach((point, i) => i ? outline.lineTo(point.x, point.y) : outline.moveTo(point.x, point.y));
    outline.closePath();
    const path = new T.Mesh(new T.ShapeGeometry(outline), mat('#d9c799')); path.rotation.x = -Math.PI / 2; path.position.y = .05; path.receiveShadow = true; this.scene.add(path);
    for (const [x, z] of [[4, -51.8], [5.3, -52], [6.6, -52.3], [7.9, -52.7], [9.2, -53.2]]) {
      const stone = this.box(x, .09, z, .85, .13, .62, '#e4dcc5', false); stone.geometry = rounded(.85, .13, .62, .15); stone.rotation.y = x * .18;
    }
    // Low planted beds balance the coop without hiding the animal or the next turn.
    for (const z of [-57.5, -62]) {
      this.box(-9.5, .1, z, 4.8, .2, 2.7, '#765d41', false).geometry = rounded(4.8, .2, 2.7, .2);
      for (const x of [-12, -7]) this.box(x, .23, z, .15, .3, 2.95, '#c7a16c', false);
      for (const edge of [-1.4, 1.4]) this.box(-9.5, .23, z + edge, 5.15, .3, .15, '#c7a16c', false);
      for (let i = 0; i < 5; i++) for (const row of [-.6, .6]) {
        const bloom = this.flower(-11.3 + i * .9, z + row); bloom.scale.setScalar(.3);
        colorFlower(bloom, z < -60 ? '#f3ca67' : '#f1aeb9', true);
      }
    }
    this.prop('bench-01', -10.8, -51, 3.1, .15, true);
    this.prop('barrel-01', 17.5, -62.5, 1.1, 0, true);
    this.prop('crate-01', 18.1, -61, 1, .12, true);
    for (const x of [9.5, 13.2, 16.9]) this.prop('picket-fence-01', x, -66.5, 3.5);
    for (const z of [-62.8, -59]) this.prop('picket-fence-01', 20, z, 3.5, Math.PI / 2);
    for (const x of [-11.5, -7.8]) this.prop('picket-fence-01', x, -66, 3.5);
    for (const [x, z, width] of [[-13.5, -64, 2.1], [-13.6, -55, 1.8], [8, -64.8, 1.6], [18.7, -65, 2], [19.8, -56.5, 1.6], [7.3, -57.8, 1.4]]) this.prop('bush-round-01', x, z, width);
    for (const [x, z] of [[-7.6, -45.5], [-2, -46.5], [6, -55], [7, -55.5], [17, -55.5], [18, -56], [8.3, -65]]) {
      const bloom = this.flower(x, z); bloom.scale.setScalar(.27); colorFlower(bloom, '#fff3c5', true);
    }
    this.sign('谷粒在这里', -7.5, -47, '#fff8e8', .6);
    this.box(grainSpot.x, .14, grainSpot.z, 1.1, .28, 1.1, '#e8d9b6', false).geometry = rounded(1.1, .28, 1.1);
    for (const x of [-5, -3]) this.prop('crate-01', x, -54, 2, 0, true);
    const coop = chickenCoop(); coop.position.set(13, 0, -61.5); this.scene.add(coop);
    // Simple wall proxies preserve the enclosure while the timber mesh supplies its detail.
    for (const x of [11.35, 14.65]) this.box(x, 1.6, -59, 2.7, 3.2, .55, '#c9a878').visible = false;
    this.box(13, 2.3, -59, .6, 1.8, .55, '#c9a878').visible = false;
    for (const x of [10, 16]) this.box(x, 1.6, -61.5, .4, 3.2, 5.5, '#c9a878').visible = false;
    this.box(13, 1.6, -64, 6.4, 3.2, .4, '#c9a878').visible = false;
    const rampBody = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(13, .28, -58).setRotation(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), .255)));
    this.world.createCollider(R.ColliderDesc.cuboid(.475, .06, 1.075), rampBody);
    for (const z of [-57.8, -58.4]) for (const x of [12.88, 13.12]) this.scene.add(orb('#9b7754', x, .07, z, .085, .025, .12));
    this.chicken = this.prop('chicken', chickenHome.x, chickenHome.z, .48);
    const grainBowl = new T.Mesh(new T.CylinderGeometry(.45, .32, .22, 16), mat('#cc8055'));
    this.grain.add(grainBowl);
    for (let i = 0; i < 12; i++) this.grain.add(orb('#ffe193', Math.sin(i * 2.4) * .28, .14, Math.cos(i * 2.4) * .28, .08));
    this.scene.add(this.grain);
    // Keep the coop forecourt open; two perimeter trees frame rather than hide it.
    for (const [x, z] of [[-15, -63], [22, -66]]) this.tree(x, z);
    for (const [x, z, angle] of [[32, -28, -.7], [34, -31, 1.4], [31, -38, 2.5]]) {
      this.prop('chicken', x, z, .592, angle);
    }

    for (const x of [-20.5, 20.5]) this.box(x, 1.5, -72, 35, 3, .4, '#ead5a3');
    this.exit = this.door(0, -72, 6, '#dcb45b');
    for (let i = 0; i < 3; i++) {
      const lock = padlock(colors[i]); lock.position.set((i - 1) * 1.4, 1.7, -71.65);
      this.scene.add(lock); this.locks.push(lock);
    }
    keySpots.forEach((spot, index) => {
      if (index === 0) this.box(spot.x, .15, spot.z, 1.9, .3, 1.9, '#e8d9b6', false).geometry = rounded(1.9, .3, 1.9);
      const key = new T.Group(); key.position.set(spot.x, 1.2, spot.z);
      const ring = new T.Mesh(new T.TorusGeometry(.3, .1, 8, 20), mat(colors[index])); key.add(ring);
      const shaft = new T.Mesh(new T.BoxGeometry(.17, .8, .18), mat(colors[index])); shaft.position.y = -.6; key.add(shaft);
      const tooth = new T.Mesh(new T.BoxGeometry(.4, .17, .18), mat(colors[index])); tooth.position.set(.12, -.9, 0); key.add(tooth);
      this.scene.add(key); this.keyMeshes.push(key);
    });
    // Landmarks break sightlines between exhibits without closing the connecting trails.
    for (let z = 12; z > -70; z -= 12) for (const x of [-34.5, 34.5]) {
      if (x < 0 && z === -24) continue; // Leave the workshop storefront clear.
      this.prop('tree-oak-01', x, z, 5.2, x < 0 ? .4 : -.5);
    }
    for (const [x, z] of [[-8, -16], [-8, -27], [8, -18], [8, -30], [-19, -43], [19, -44]]) this.tree(x, z);
    this.decorate();
    for (let i = 0; i < 12; i++) {
      const x = i % 2 ? 52 : -52, z = 10 - Math.floor(i / 2) * 22;
      for (let j = 0; j < 4; j++) this.scene.add(orb('#ffffff', x + j * 2, 7 + Math.sin(j) * 1.5, z, 3.3, 2, 2.4));
    }
  }
  decorate() {
    // The original four-metre tile has its grass cap at y=.5; bury only the soil layers.
    const grass = (x: number, z: number, width: number, depth = width) => {
      const tile = this.prop('terrain-grass-01', x, z, width);
      tile.scale.z = depth; tile.scale.y *= .5; tile.position.y = .01 - tile.scale.y * .125;
    };
    for (const side of [-1, 1]) {
      for (const z of [-16, -22, -28, -34]) grass(side * 6, z, 6);
      for (const x of [12, 18, 24, 30]) grass(side * x, 8, 6);
      for (const x of [9, 15, 21]) grass(side * x, -4, 6, 5);

    }
    this.prop('bld-general-store-01', -33.7, -29, 7.5, 0, true);
    this.prop('home-cottage-01', 26, -51, 11, -.12, true);
    this.prop('home-thatched-house-01', -23, -59, 12, .12, true);
    for (const [x, z] of [[-36, -23], [-34.5, -23]]) this.prop('crate-01', x, z, 1.2);
    this.prop('barrel-01', -30.5, -23, 1.1);
    // Thin paving above the old path surfaces, with no overlapping tile bounds.
    const pave = (x: number, z: number, width: number, length: number, angle = 0, corner = false) => {
      const name = corner ? 'road-cobble-corner-01' : 'road-cobble-straight-01';
      const road = this.prop(name, x, z, width, angle);
      road.scale.z = length; road.scale.y *= .1; road.position.y = .06;
      // ponytail: tile bounds approximate curved corners; use mesh raycasts if finer surface detail matters.
      this.pavedBounds.push(new T.Box3().setFromObject(road));
    };
    for (let z = 13; z >= -69; z -= 6) {
      pave(0, z, 6, 6);
    }
    for (const z of [-9, -40]) for (const x of [-24, -18, -12, -6, 6, 12, 18, 24]) {
      pave(x, z, 5, 6, Math.PI / 2);
    }
    // Curved forecourt loops join the two puzzle approaches; inner trails join the rear cross street.
    for (const side of [-1, 1]) {
      for (const x of [6, 12, 18, 24]) pave(side * x, 1, 5, 6, Math.PI / 2);
      pave(side * 29.5, 1, 5, 5, side === 1 ? -Math.PI / 2 : Math.PI, true);
      pave(side * 29.5, -4, 5, 5);
      pave(side * 29.5, -9, 5, 5, side === 1 ? 0 : Math.PI / 2, true);
      for (const z of [-14.75, -21.25, -27.75, -34.25]) pave(side * 12, z, 5, 6.5);
      this.prop('fire-hydrant', side * 34, 1, 1.2, side * .3, true);
      // Keep the entrance open and tuck the perimeter fence behind the garden planting.
      for (const x of [6, 10, 14, 18, 22, 26, 30, 34]) this.prop('picket-fence-01', side * x, 14, 4, 0, true);
      for (let z = 12; z >= -68; z -= 4) {
        if (side === -1 && z <= -24 && z >= -32) continue; // Storefront footprint.
        this.prop('picket-fence-01', side * 36, z, 4, Math.PI / 2, true);
      }
      // Short returns frame the planting beds without closing either cross street.
      for (const z of [-15, -19, -27, -31]) this.prop('picket-fence-01', side * 9, z, 4, Math.PI / 2, true);
      for (const z of [-13, -33]) this.prop('picket-fence-01', side * 7, z, 4, 0, true);
    }
    for (const x of [-5, 5]) for (const z of [0, -19, -34]) this.prop('streetlamp-01', x, z, .62);
    for (const z of [8]) for (const x of [-12, -8, 8, 12]) this.prop('picket-fence-01', x, z, 3.7);
    for (const x of [-7, 7]) for (const z of [-16, -25, -32]) this.prop('bush-round-01', x, z, 3.2, z);
    for (const x of [-35, 35]) for (let z = 14; z >= -68; z -= 5) {
      if (x < 0 && z > -36 && z < -20) continue;
      this.prop('bush-round-01', x, z, 2.8, z);
    }
    for (const [x, z] of [[-15, 8], [15, 8], [-18, -4], [17, -4], [-14, -35], [14, -35], [-30, -52], [33, -59]]) {
      this.prop('bush-round-01', x, z, 3.6, x);
      this.prop('bush-round-01', x + 1.7, z - 1.3, 2.4, z);
    }
    // Lantern pillars frame the existing entrances without narrowing the passages.
    for (const [x, z] of [[-3.8, 13], [3.8, 13], [-3.8, -72], [3.8, -72], [-29.6, -24], [-18.4, -24]]) {
      this.box(x, .2, z, 1.2, .4, 1.2, '#e8d9b6').geometry = rounded(1.2, .4, 1.2);
      this.box(x, 2, z, .8, 4, .8, '#ecd6a6');
      this.box(x, 4.05, z, 1.1, .25, 1.1, '#fff0ce', false);
      this.scene.add(orb('#ffdc76', x, 4.45, z, .35));
      const lamp = lantern(); lamp.position.set(x, 2.65, z + .65); this.scene.add(lamp);
    }
    const arch = entranceArch(); arch.position.z = 13; this.scene.add(arch);
  }
  clearInput() {
    this.keys.clear(); this.stick = { x: 0, y: 0 }; this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.jumpRequested = false; this.jumpBuffer = 0;
  }
  start() {
    window.speechSynthesis?.cancel(); this.audio?.stop(); this.audio?.resume();
    this.state = 'racing'; this.paused = false; this.time = 0; this.accumulator = 0;
    this.collected.fill(false); this.carried = -1;
    this.happyUntil = this.solvedCount = 0;
    this.carryingGrain = this.grainPlaced = this.animalSolved = false; this.chickenState = 'idle'; this.chickenMood = '';
    this.chicken.position.set(chickenHome.x, 0, chickenHome.z); this.chicken.rotation.set(0, 0, 0);
    this.pipeTurns = [1, 0, 3]; this.pipesSolved = false; this.pipeTouched = false; this.flowReached = 0;
    this.region = -1; this.normalCue = ''; this.hintActive = false;
    this.pieces.forEach(piece => this.place(piece, piece.home.x, piece.home.z, false));
    this.body.setTranslation({ x: spawn.x, y: .8, z: spawn.z }, true); this.clearInput();
    this.previous.copy(this.body.translation()); this.heading = this.gait = 0; this.grounded = true;
    this.coyote = this.jumpCooldown = 0;
    this.render();
    this.say('花园里藏着3把钥匙，会在哪里呢？');
  }
  pause() {
    if (this.state !== 'racing') return;
    this.paused = !this.paused; this.clearInput(); window.speechSynthesis?.cancel();
    if (this.paused) this.audio?.pause(); else this.audio?.resume();
  }
  near(x: number, z: number, distance = 1.9) { const p = this.body.translation(); return Math.hypot(p.x - x, p.z - z) < distance; }
  nearestZone() {
    const p = this.body.translation();
    const index = zones.reduce((best, zone, i) => Math.hypot(p.x - zone.x, p.z - zone.z) < Math.hypot(p.x - zones[best].x, p.z - zones[best].z) ? i : best, 0);
    return this.near(zones[index].x, zones[index].z, 16) ? index : -1;
  }
  solved() { return [this.pieces[0].placed, this.pipesSolved, this.animalSolved]; }
  normalGuidance() {
    const count = this.collected.filter(Boolean).length;
    if (count === 3) return '3把钥匙齐了 · 远处传来了开门的声音。';
    if (this.carried >= 0) return '手里的积木沉甸甸的，会有什么用呢？';
    if (this.carryingGrain) {
      if (this.chickenMood === 'waiting') return '小鸡在后面等你，谷粒离它太远了。';
      if (this.chickenMood === 'blocked') return '小鸡被挡住了，它需要一条能走过去的小路。';
      return this.near(tunnelSpot.x, tunnelSpot.z, 2.5)
        ? '小鸡在鸡舍门口张望，怎样让它愿意进去呢？'
        : '小鸡跟着谷粒走了';
    }
    const local = this.region;
    if (local < 0 || this.collected[local]) {
      if (!count) return '花园里藏着3把钥匙，会在哪里呢？';
      return `已找到${count}/3把钥匙 · 花园里还有新的发现。`;
    }
    if (this.solved()[local]) return [
      '工坊铁门开了 · 里面闪着一点金光。',
      '跳上花朵拿钥匙',
      '小鸡带回了粉色钥匙，快看看它的发现！',
    ][local];
    if (local === 2 && this.grainPlaced) return '小鸡在鸡舍里翻找，等它带回发现吧。';
    if (local === 1) {
      const next = this.pipeTurns.findIndex((turn, i) => turn !== pipeSolution[i]);
      if (next < 0) return '水流过去了，小花好像有了变化。';
      if (next > 0) return '水往前流了一点，又在哪里停住了呢？';
    }
    return zones[local].goal;
  }
  hint() {
    if (this.state !== 'racing' || this.paused) return;
    this.hintActive = true;
    this.say(this.nextHint(), 'hint');
  }
  nextHint() {
    const local = this.carried >= 0 ? 0 : this.carryingGrain ? 2 : this.nearestZone();
    return [
      '机关上有一个正方形。工坊里有一样形状的积木吗？',
      '沿着水流看一看，水停在哪一段水管前？',
      '小鸡喜欢谷粒，也能钻进你进不去的小门。',
    ][local] ?? '三个地方藏着钥匙，到周围探索吧！';
  }
  interact() {
    if (this.state !== 'racing' || this.paused) return;
    if (this.carried >= 0) {
      const piece = this.pieces[this.carried];
      const atPlate = this.near(plateSpot.x, plateSpot.z, 2.5);
      const fits = atPlate && piece.square;
      const target = fits ? plateSpot : this.dropSpot(piece);
      this.place(piece, target.x, target.z, fits); this.carried = -1;
      this.hintActive = false;
      this.audio?.play('drop');
      if (fits) { this.audio?.play('switch'); this.audio?.play('gate'); }
      // Putting a block down anywhere but the plate needs a sound, not a sentence.
      if (fits || atPlate) this.say(fits ? '正方体压住机关，铁门开啦！' : `${piece.name}和方形机关对不上，再找找正方体！`);
      return;
    }
    const pick = this.pieces.findIndex(p => !p.placed && this.near(p.x, p.z));
    if (pick >= 0) {
      this.carried = pick;
      this.pieces[pick].body.setEnabled(false);
      this.say(this.pieces[pick].square ? '拿起来啦！这个形状能帮上什么忙呢？' : `拿起${this.pieces[pick].name}啦！看看机关要什么形状。`, 'pickup'); return;
    }
    const pipe = pipeSpots.findIndex(spot => this.near(spot.x, spot.z, pipeReach));
    if (pipe >= 0) {
      if (this.pipesSolved) { this.say('水已经接通啦！小花替你找到一把钥匙。'); return; }
      const turn = (this.pipeTurns[pipe] + 1) % 4;
      this.pipeTurns[pipe] = turn;
      this.hintActive = false;
      this.audio?.play('pipe');
      if (!this.pipeTouched) this.say(zones[1].goal);
      else this.cue = this.normalGuidance();
      this.pipeTouched = true; return;
    }
    if (this.carryingGrain && this.near(tunnelSpot.x, tunnelSpot.z, 2.5)) {
      if (Math.hypot(this.chicken.position.x - tunnelSpot.x, this.chicken.position.z - tunnelSpot.z) > 2.5) {
        this.say('小鸡还没跟上来，等等它吧。'); return;
      }
      this.carryingGrain = false; this.grainPlaced = true; this.chickenState = 'entering';
      this.audio?.play('grain');
      this.hintActive = false; this.say('小鸡钻进去了！', 'chick'); return;
    }
    if (!this.carryingGrain && !this.grainPlaced && !this.animalSolved && this.near(grainSpot.x, grainSpot.z)) {
      this.carryingGrain = true; this.chickenState = 'following';
      this.audio?.play('grain');
      this.hintActive = false; this.say('小鸡跟着谷粒走了', 'chick'); return;
    }
    if (this.near(this.chicken.position.x, this.chicken.position.z, 6) || this.near(tunnelSpot.x, tunnelSpot.z, 3)) {
      this.audio?.play('chick');
      this.say(this.animalSolved ? '粉色钥匙在鸡舍门口。' : this.grainPlaced ? '鸡舍里传来小鸡的声音。' : !this.carryingGrain ? '小鸡一直盯着那碗谷粒呢。' : this.chickenMood === 'blocked' ? '小鸡在原地打转，好像走不过去。' : '小鸡正看着你手里的谷粒。'); return;
    }
    if (this.near(0, -71, 5)) this.say(this.collected.every(Boolean) ? '出口就在前面，走过去吧！' : `大门还差${3 - this.collected.filter(Boolean).length}把钥匙，再去探索吧。`);
  }
  updateChicken() {
    if (this.chickenState === 'idle' || this.chickenState === 'delivered') return;
    const pos = this.chicken.position, player = this.body.translation();
    const following = this.chickenState === 'following';
    let target: Spot = this.chickenState === 'entering' ? tunnelSpot : this.chickenState === 'fetching' ? nestSpot : keySpots[2];
    if (following) {
      const distance = Math.hypot(player.x - pos.x, player.z - pos.z);
      const waiting = distance > 12 || this.carried >= 0;
      if (waiting || distance < 1.2) {
        if (waiting && this.chickenMood !== 'waiting' && distance < 18) this.audio?.play('chick');
        this.chickenMood = waiting ? 'waiting' : 'following'; this.chicken.rotation.z = 0; return;
      }
      target = player;
    }
    const dx = target.x - pos.x, dz = target.z - pos.z, distance = Math.hypot(dx, dz);
    if (distance < .12) {
      if (this.chickenState === 'entering') this.chickenState = 'fetching';
      else if (this.chickenState === 'fetching') this.chickenState = 'returning';
      else if (this.chickenState === 'returning') {
        this.chickenState = 'delivered'; this.animalSolved = true; this.carryingGrain = false;
        this.chicken.rotation.z = 0; this.say('谢谢小鸡！快来拿粉色钥匙吧！', 'chick');
      }
      return;
    }
    const ux = dx / distance, uz = dz / distance, travel = Math.min(distance, 4.2 * STEP);
    // Three swept rays keep this small ground follower clear of the existing solid props.
    if (following) {
      for (const side of [-.22, 0, .22]) {
        const ray = new R.Ray({ x: pos.x - uz * side, y: .3, z: pos.z + ux * side }, { x: ux, y: 0, z: uz });
        if (this.world.castRay(ray, travel + .26, true, undefined, undefined, undefined, this.body)) {
          if (this.chickenMood !== 'blocked') this.audio?.play('chick');
          this.chickenMood = 'blocked'; this.chicken.rotation.z = 0; return;
        }
      }
    }
    this.chickenMood = following ? 'following' : 'searching';
    pos.x += ux * travel; pos.z += uz * travel;
    if (!following) pos.y = T.MathUtils.clamp((-pos.z - 57) * .275, 0, .55);
    this.chicken.rotation.y = Math.atan2(ux, uz);
    this.chicken.rotation.z = this.reducedMotion ? 0 : Math.sin(this.time * 18) * .08;
  }
  say(text: string, sound?: PuzzleSound) {
    if (sound !== 'hint') { this.hintActive = false; }
    this.cue = text;
    if (!this.settings.effects) return;
    if (sound) this.audio?.play(sound);
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN'; utterance.rate = .85; speechSynthesis.speak(utterance);
    }
  }
  step() {
    if (this.state !== 'racing' || this.paused) return;
    this.time += STEP;
    let x = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) + this.stick.x;
    let z = Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) + this.stick.y;
    const length = Math.hypot(x, z); if (length > 1) { x /= length; z /= length; }
    this.previous.copy(this.body.translation());
    const velocity = this.body.linvel(), p = this.body.translation();
    const ray = new R.Ray({ x: p.x, y: p.y - .57, z: p.z }, { x: 0, y: -1, z: 0 });
    const wasGrounded = this.grounded;
    this.grounded = !!this.world.castRay(ray, .24, true, undefined, undefined, undefined, this.body) && velocity.y < 1 && p.y > .2;
    if (this.grounded && !wasGrounded && velocity.y < -1) this.audio?.play('land');
    // Coyote time and an input buffer keep the hop forgiving for small hands.
    this.coyote = this.grounded ? .11 : Math.max(0, this.coyote - STEP);
    this.jumpBuffer = this.jumpRequested ? .13 : Math.max(0, this.jumpBuffer - STEP);
    this.jumpCooldown = Math.max(0, this.jumpCooldown - STEP);
    this.jumpRequested = false;
    let vy = velocity.y;
    if (this.jumpBuffer > 0 && this.coyote > 0 && this.jumpCooldown === 0) {
      vy = 8; this.jumpCooldown = .34; this.coyote = this.jumpBuffer = 0; this.grounded = false;
      this.audio?.play('jump');
    }
    const blend = acceleration(this.grounded, STEP);
    this.body.setLinvel({ x: T.MathUtils.lerp(velocity.x, x * movement.speed, blend), y: vy, z: T.MathUtils.lerp(velocity.z, z * movement.speed, blend) }, true);
    if (length > .1) this.heading = Math.atan2(-x, -z);
    this.gate.body.setEnabled(!this.pieces[0].placed);
    this.exit.body.setEnabled(!this.collected.every(Boolean));
    // Leaves and petals catch a landing from above without blocking the next upward hop.
    this.flowerPlatforms.forEach((collider, i) => {
      const top = .49 + (i === 0 ? .51 : 1.33) * this.waterFlower.scale.y;
      collider.setEnabled(p.y - .65 >= top - .08 && velocity.y <= 0);
    });
    this.pipeMeshes.forEach((pipe, i) => {
      const target = this.pipeTurns[i] * Math.PI / 2;
      const delta = Math.atan2(Math.sin(target - pipe.rotation.y), Math.cos(target - pipe.rotation.y));
      pipe.rotation.y = this.reducedMotion ? target : pipe.rotation.y + delta * (1 - Math.exp(-14 * STEP));
    });
    this.world.step();
    this.updateChicken();
    const footfall = Math.floor(this.gait / Math.PI);
    this.gait += Math.hypot(velocity.x, velocity.z) * STEP * movement.gait;
    const walked = this.body.translation();
    if (this.grounded && walked.y < 1.05 && Math.hypot(walked.x - p.x, walked.z - p.z) > .4 * STEP && Math.floor(this.gait / Math.PI) !== footfall) {
      this.audio?.footstep(this.pavedBounds.some(bounds => walked.x >= bounds.min.x && walked.x <= bounds.max.x && walked.z >= bounds.min.z && walked.z <= bounds.max.z));
    }
    const available = this.solved();
    const solvedCount = available.filter(Boolean).length;
    if (solvedCount > this.solvedCount) this.happyUntil = this.time + 2.5;
    this.solvedCount = solvedCount;
    keySpots.forEach((spot, index) => {
      const reachedHeight = index !== 1 || this.body.translation().y > .49 + 1.33 * this.waterFlower.scale.y + .35;
      if (available[index] && !this.collected[index] && reachedHeight && this.near(spot.x, spot.z, 1.3)) {
        this.collected[index] = true;
        this.happyUntil = this.time + 2.5;
        this.hintActive = false;
        this.audio?.play('key');
        if (this.collected.every(Boolean)) this.audio?.play('gate');
        this.say(this.collected.every(Boolean) ? '三把钥匙都找到啦！走去出口吧！' : `拿到第${index + 1}把钥匙啦！真棒！`);
      }
    });
    const current = this.body.translation();
    if (this.collected.every(Boolean) && current.z < -72.7 && Math.abs(current.x) < 3) { this.state = 'qualified'; this.clearInput(); this.audio?.stop(); this.say('大门打开啦！你是小小解谜高手！', 'win'); }
    this.region = this.nearestZone();
    if (this.state === 'racing') {
      const cue = this.normalGuidance();
      // Update only when the next task changes; footsteps must not repeat speech or DOM updates.
      if (cue !== this.normalCue) {
        this.normalCue = this.cue = cue;
        this.hintActive = false;
      }
    }
  }
  resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
  render(dt = 0) {
    this.player.position.copy(this.previous).lerp(this.body.translation(), dt === 0 || this.paused || this.state !== 'racing' ? 1 : this.accumulator / STEP);
    const p = this.player.position;
    const avatar = this.player.getObjectByName('avatar')!;
    if (!this.paused) {
      const velocity = this.body.linvel();
      animateWalk(this.player, this.heading, this.gait, Math.hypot(velocity.x, velocity.z), this.grounded, this.reducedMotion, dt, this.carried >= 0 || this.carryingGrain);
      setCharacterExpression(this.player, this.state === 'qualified' || this.time < this.happyUntil ? 'happy'
        : this.state !== 'racing' ? 'neutral' : !this.grounded ? 'surprised'
        : Math.hypot(velocity.x, velocity.z) > 2 ? 'determined' : 'neutral');
    }
    // Match the first level's third-person framing and frame-rate-independent follow.
    const portrait = innerWidth < innerHeight;
    const follow = dt === 0 ? 1 : 1 - Math.exp(-5 * dt);
    this.cameraGoal.set(p.x, Math.max(0, p.y) * .42 + (portrait ? 11 : 9.4), p.z + (portrait ? 18 : 16));
    this.camera.position.lerp(this.cameraGoal, follow);
    this.cameraLook.lerp(this.cameraGoal.set(p.x, Math.max(0, p.y) * .32 + 1.8, p.z - 8), follow);
    this.camera.lookAt(this.cameraLook);
    this.gate.mesh.position.y = this.pieces[0].placed ? 3.6 : 0;
    const exitOpen = this.collected.every(Boolean);
    this.exit.mesh.getObjectByName('left-leaf')!.rotation.y = exitOpen ? -Math.PI / 2 : 0;
    this.exit.mesh.getObjectByName('right-leaf')!.rotation.y = exitOpen ? Math.PI / 2 : 0;
    this.plate.material = mat(this.pieces[0].placed ? '#7bd39c' : colors[0]);
    this.plate.position.y = this.pieces[0].placed ? .285 : .34;
    let connected = true, wetCount = 0;
    this.pipeMeshes.forEach((group, i) => {
      const target = this.pipeTurns[i] * Math.PI / 2;
      const delta = Math.atan2(Math.sin(target - group.rotation.y), Math.cos(target - group.rotation.y));
      if (dt === 0) group.rotation.y = target;
      connected = connected && this.pipeTurns[i] === pipeSolution[i] && Math.abs(delta) < .025;
      if (connected) wetCount++;
      animateWater(group, connected, this.reducedMotion ? 0 : this.time);
    });
    if (this.state === 'racing' && !this.paused && wetCount > this.flowReached) {
      this.audio?.play('flow', 1 + (wetCount - 1) * .1); this.flowReached = wetCount;
    }
    if (connected && !this.pipesSolved) {
      this.pipesSolved = true;
      this.say('小花开啦！跳到花上拿蓝色钥匙！', 'bloom');
    }
    animateWater(this.supply, true, this.reducedMotion ? 0 : this.time);
    animateWater(this.outlet, connected, this.reducedMotion ? 0 : this.time);
    colorFlower(this.waterFlower, '#fff1c5', this.pipesSolved);
    const bloom = this.pipesSolved ? 1.55 : .72;
    this.waterFlower.scale.lerp(new T.Vector3(bloom, bloom, bloom), dt === 0 || this.reducedMotion ? 1 : this.paused ? 0 : 1 - Math.exp(-3 * dt));
    if (this.flowerPlatformScale !== this.waterFlower.scale.y) this.flowerPlatforms.forEach((collider, i) => {
      const scale = this.waterFlower.scale.y;
      collider.setTranslation({ x: 26, y: .49 + (i === 0 ? .38 : 1.24) * scale, z: -25.5 });
      collider.setShape(new R.Cylinder((i === 0 ? .13 : .09) * scale, (i === 0 ? 1.05 : 1.12) * scale));
    });
    this.flowerPlatformScale = this.waterFlower.scale.y;
    this.watering.visible = connected;
    this.watering.children.forEach((drop, i) => {
      const phase = this.reducedMotion ? .35 : (this.time * .8 + i / 9) % 1, angle = i * Math.PI * 2 / 9;
      drop.position.set(Math.cos(angle) * phase, Math.sin(phase * Math.PI) * .65, Math.sin(angle) * phase);
    });
    (this.scene.getObjectByName('water-outlet') as T.Mesh).material = mat(this.pipesSolved ? '#45b6db' : '#a5b4b8');
    this.locks.forEach((lock, i) => { lock.visible = !this.collected[i]; });
    this.carryPosition.set(0, .45 + avatar.position.y, -.9).applyQuaternion(this.player.quaternion).add(p);
    this.pieces.forEach((piece, i) => {
      if (i === this.carried) piece.mesh.position.copy(this.carryPosition);
      else piece.mesh.position.set(piece.x, piece.placed ? 1.005 : piece.rest, piece.z);
      piece.mesh.rotation.y = i === this.carried ? this.player.rotation.y : 0;
    });
    this.keyMeshes.forEach((mesh, i) => {
      mesh.visible = !this.collected[i] && (i !== 1 || this.pipesSolved);
      mesh.rotation.y = this.reducedMotion ? 0 : this.time; mesh.position.y = i === 1 ? .49 + 1.33 * this.waterFlower.scale.y + 1.4 : 1.5;
    });
    const animalKey = this.keyMeshes[2];
    if (this.animalSolved) animalKey.position.set(keySpots[2].x, 1.5, keySpots[2].z);
    else if (this.chickenState === 'returning') animalKey.position.set(this.chicken.position.x, this.chicken.position.y + .8, this.chicken.position.z);
    else animalKey.position.set(nestSpot.x, 1.5, nestSpot.z);
    this.grain.visible = this.grainPlaced || this.carried < 0;
    if (this.carryingGrain) this.grain.position.copy(this.carryPosition);
    else if (this.grainPlaced) this.grain.position.set(nestSpot.x, .66, nestSpot.z + 2);
    else this.grain.position.set(grainSpot.x, .4, grainSpot.z);
    const grain = !this.carryingGrain && !this.grainPlaced && !this.animalSolved && this.near(grainSpot.x, grainSpot.z);
    const chicken = this.near(this.chicken.position.x, this.chicken.position.z, 6);
    const pipe = pipeSpots.some(spot => this.near(spot.x, spot.z, pipeReach));
    const pickable = this.pieces.some(piece => !piece.placed && this.near(piece.x, piece.z));
    const action = this.carried >= 0 ? '放下' : pipe ? '转水管' : this.carryingGrain && this.near(tunnelSpot.x, tunnelSpot.z, 2.5) ? '放谷粒' : grain ? '拿谷粒' : chicken ? '招呼小鸡' : pickable ? '拿起' : '看一看';
    const waterDistance = Math.hypot(p.x - 24, p.z + 22);
    this.audio?.water(this.state === 'racing' && this.pipesSolved ? Math.max(0, 1 - waterDistance / 14) : 0, !!window.speechSynthesis?.speaking);
    const cue = this.state === 'racing' && !this.hintActive ? this.normalCue || this.cue : this.cue;
    this.ui.updatePuzzle(this.state, this.paused, this.muted, cue, this.collected.filter(Boolean).length, action);
    this.renderer.render(this.scene, this.camera);
  }
  tick(now: number) {
    if (this.overviewMode) {
      this.renderer.render(this.scene, this.camera); requestAnimationFrame(t => this.tick(t)); return;
    }
    const dt = Math.min((now - (this.last || now)) / 1000, .1); this.last = now;
    if (this.state === 'racing' && !this.paused) {
      this.accumulator += dt;
      while (this.accumulator >= STEP) { this.step(); this.accumulator -= STEP; }
    } else this.accumulator = 0;
    this.render(dt); requestAnimationFrame(t => this.tick(t));
  }
}

