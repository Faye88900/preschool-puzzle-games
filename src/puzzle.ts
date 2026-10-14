import { cloudTransfer } from './cloud-transfer';
import { t } from './i18n';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import R from '@dimforge/rapier3d-compat';
import { bean, mat, orb } from './models';
import { UI } from './ui';
import { TASKS } from './identity';
import { WorkshopDialogue } from './workshop-dialogue';
import { readSettings, saveSettings } from './settings';
import { movement, acceleration, animateWalk } from './movement';
import { setCharacterExpression } from './character';
import { PuzzleAudio, type PuzzleSound } from './puzzle-audio';
import { rounded, workshopBlock, workshopPressurePlate, workshopGate, chickenCoop, gardenFlower, pondFlower, colorFlower, gateMesh, padlock, lantern, entranceArch, elbowCurve, waterPipe, animateWater } from './puzzle-art';

const STEP = movement.step;
const colors = ['#ffd15a', '#76cde8', '#f29bbe'];
type Spot = { x: number; z: number };
type Interaction = Spot & { kind: 'drop' | 'piece' | 'guide' | 'pipe' | 'grain' | 'coop' | 'chicken' | 'exit'; label: string; index?: number };
type HintFrame = { at: number; position: T.Vector3; look: T.Vector3 };
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
  animalHintSeen = false;
  pondHintSeen = false;
  hintShot?: { elapsed: number; coopOnly: boolean; returning: boolean; position: T.Vector3; look: T.Vector3; pond?: HintFrame[]; demo?: HintFrame[]; blocked?: number; waterPath?: T.CatmullRomCurve3; waterOffset?: T.Vector3 };
  renderer!: T.WebGLRenderer;
  world!: R.World;
  body!: R.RigidBody;
  player = bean('#ee5798', true);
  models = new Map<string, T.Group>();
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
  workshop!: WorkshopDialogue;
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
  flowFeedbackUntil = 0;
  pavedBounds: T.Box3[] = [];
  animalSolved = false;
  region = -1;
  normalCue = '';
  hintActive = false;
  hintLevels = new Map<string, number>();
  interaction?: Interaction;
  interactionRing = new T.Mesh(new T.RingGeometry(.85, 1, 40), new T.MeshBasicMaterial({ color: '#ffe36b', side: T.DoubleSide, transparent: true, depthWrite: false }));
  hintDemo?: { mesh: T.Object3D; from: T.Vector3; to: T.Vector3; rotation: number; turn: boolean; hop: boolean; start: number };
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
  plateIndicator!: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
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
    this.audio = new PuzzleAudio();
    const syncMusic = () => {
      const music = this.audio!.music;
      if (this.paused || document.hidden || this.state === 'qualified') music.pause();
      else if (music.paused) void music.play().catch(() => {});
    };
    addEventListener('pointerdown', syncMusic);
    addEventListener('keydown', syncMusic);
    document.addEventListener('visibilitychange', syncMusic);
    addEventListener('pagehide', () => this.audio?.pause());
    syncMusic();
    await this.loadModels();
    this.build();
    await this.audio.load();
    this.body = this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(spawn.x, .8, spawn.z).lockRotations().setLinearDamping(movement.damping).setCcdEnabled(true));
    this.previous.copy(this.body.translation());
    this.world.createCollider(R.ColliderDesc.capsule(.25, .4).setMass(1).setFriction(movement.friction).setRestitution(0), this.body);
    this.scene.add(this.player);
    this.interactionRing.rotation.x = -Math.PI / 2;
    this.interactionRing.visible = false;
    this.scene.add(this.interactionRing);
    this.ui = new UI({ start: () => this.start(), pause: () => this.pause(), mute: () => {
      this.settings = { ...readSettings(), music: this.muted, effects: this.muted }; saveSettings(this.settings);
      if (!this.settings.effects) window.speechSynthesis?.cancel();
      this.audio?.applySettings(this.settings);
    }, move: (x, y) => { if (!this.hintShot) this.stick = { x, y }; }, jump: () => { if (!this.hintShot) this.jumpRequested = true; }, dive: () => this.interact(), hint: () => this.hint() });
    this.ui.configurePuzzle();
    this.workshop = new WorkshopDialogue(text => this.say(text), () => {
      this.clearInput(); this.previous.copy(this.body.translation());
    }, (x, z) => this.pieces.every((piece, i) => i === this.carried || Math.hypot(x - piece.x, z - piece.z) > piece.reach + .65));
    this.scene.add(this.workshop.guide);
    document.querySelector('#game')!.setAttribute('aria-label', t('第二关：解谜花园'));
    addEventListener('keydown', event => {
      if (this.workshop.active && !this.paused) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      if (this.hintShot && event.code !== 'Escape') return;
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
    if (new URLSearchParams(location.search).has('cloudArrival')) {
      document.addEventListener('journey-arrival', () => {
        this.start(); this.render(0);
        this.transfer = cloudTransfer(this.scene, this.camera, this.player, true, () => {
          this.clearInput(); this.last = performance.now(); this.accumulator = 0; this.transfer = undefined;
        });
      }, { once: true });
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
  sign(tasks: number[], x: number, z: number, color: string, scale = .8, directions = false) {
    const symbols = tasks.map((index, i) => `<svg x="${tasks.length === 1 ? 206 : 125 + i * 158}" y="14" width="100" height="100" viewBox="0 0 24 26">${TASKS[index].icon}</svg>`).join('');
    const arrows = directions ? tasks.length === 2 ? '<text x="55" y="82">←</text><text x="414" y="82">→</text>' : '<text x="120" y="82">↑</text>' : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="128"><rect width="512" height="128" fill="${color}"/><g fill="#355d57" font-size="64" font-family="sans-serif">${arrows}</g>${symbols}</svg>`;
    const texture = new T.TextureLoader().load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    texture.colorSpace = T.SRGBColorSpace;
    const mesh = new T.Mesh(new T.PlaneGeometry(7, 1.75), new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide }));
    mesh.name = `task-sign-${tasks.join('-')}`; mesh.scale.setScalar(scale);
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
        const file = name === 'chicken' ? 'chicken-rounded' : name;
        const { scene } = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${file}.glb`);
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
  piece(name: string, mesh: T.Mesh, home: Spot, rest: number, square = false): Piece {
    mesh.castShadow = mesh.receiveShadow = true; this.scene.add(mesh);
    const size = new T.Box3().setFromObject(mesh).getSize(new T.Vector3());
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
  door(x: number, z: number, width: number, color: string, mesh = gateMesh(width, color, z === -72)) {
    mesh.position.set(x, 0, z); this.scene.add(mesh);
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
    this.box(0, .02, 2, 17, .04, 14, '#f5e5b8', false);
    this.sign([0, 1], -6, -5, '#fff7d5', .9, true);
    this.sign([2], -7.5, -47, '#ffe0ed', .8, true);
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
    const workshop = workshopGate(10);
    this.gate = this.door(-24, -24, 10, '#3a756b', workshop.panel);
    workshop.frame.position.set(-24, 0, -24); this.scene.add(workshop.frame);
    for (const x of [-29, -19]) this.box(x, 1.825, -24, .6, 3.65, .6, '#dbb886').visible = false;
    const pressure = workshopPressurePlate();
    pressure.base.position.set(plateSpot.x, 0, plateSpot.z); this.scene.add(pressure.base);
    this.plate = pressure.top; this.plate.position.set(plateSpot.x, .34, plateSpot.z); this.scene.add(this.plate);
    this.plateIndicator = pressure.indicator;
    // One collider for the whole pedestal stack: the player stops at its rim or jumps on top.
    const pedestal = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(plateSpot.x, .205, plateSpot.z));
    this.world.createCollider(R.ColliderDesc.cuboid(1.4, .205, 1.4).setFriction(.7), pedestal);
    // The blocks are solid, so they flank the yard instead of standing on either walkway.
    this.pieces = [
      this.piece('正方体', workshopBlock('cube', colors[0]), cubeHome, .78, true),
      this.piece('圆柱积木', workshopBlock('cylinder', '#7fd0bb'), { x: -19, z: -13 }, .73),
      this.piece('三角积木', workshopBlock('triangle', '#c6a3e4'), { x: -29, z: -19 }, .68),
      this.piece('长方体', workshopBlock('rectangle', '#f0a079'), { x: -19, z: -19 }, .58),
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
    this.sign([1], 18, -27, '#d8f4ff', .7);
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
    this.waterFlower = pondFlower();
    this.waterFlower.position.set(26, .49, -25.5); this.scene.add(this.waterFlower);
    // Two thin discs approximate the broad leaves and petals as jumpable surfaces.
    for (const [y, radius, halfHeight] of [[.38, 1.2, .13], [1.24, 1.28, .09]]) {
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
    this.chicken = this.prop('chicken', chickenHome.x, chickenHome.z, .72);
    const grainBowl = new T.Mesh(new T.CylinderGeometry(.45, .32, .22, 16), mat('#cc8055'));
    this.grain.add(grainBowl);
    for (let i = 0; i < 12; i++) this.grain.add(orb('#ffe193', Math.sin(i * 2.4) * .28, .14, Math.cos(i * 2.4) * .28, .08));
    this.scene.add(this.grain);
    // Keep the coop forecourt open; two perimeter trees frame rather than hide it.
    for (const [x, z] of [[-15, -63], [22, -66]]) this.tree(x, z);
    for (const [x, z, angle] of [[32, -28, -.7], [34, -31, 1.4], [31, -38, 2.5]]) {
      this.prop('chicken', x, z, .888, angle);
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
      if (index === 0) {
        const gold = new T.MeshStandardMaterial({ color: '#ffdc55', emissive: '#ffb928', emissiveIntensity: 1.4, roughness: .3 });
        [ring, shaft, tooth].forEach(mesh => mesh.material = gold);
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
        const context = canvas.getContext('2d')!, glow = context.createRadialGradient(32, 32, 0, 32, 32, 32);
        glow.addColorStop(0, '#ffe69b99'); glow.addColorStop(.3, '#ffcf5444'); glow.addColorStop(1, '#ffbb0000');
        context.fillStyle = glow; context.fillRect(0, 0, 64, 64);
        const halo = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(canvas), depthWrite: false, blending: T.AdditiveBlending }));
        halo.scale.set(2.5, 2.5, 1); halo.position.y = -.3; key.add(halo);
      }
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
    for (const [x, z] of [[-3.8, 13], [3.8, 13], [-3.8, -72], [3.8, -72]]) {
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
    this.workshop.reset();
    window.speechSynthesis?.cancel();
    if (this.state !== 'ready') this.audio?.stop();
    this.audio?.resume();
    this.state = 'racing'; this.paused = false; this.time = 0; this.accumulator = 0;
    this.collected.fill(false); this.carried = -1;
    this.happyUntil = this.solvedCount = 0;
    this.carryingGrain = this.grainPlaced = this.animalSolved = false; this.chickenState = 'idle'; this.chickenMood = '';
    this.chicken.position.set(chickenHome.x, 0, chickenHome.z); this.chicken.rotation.set(0, 0, 0);
    this.pipeTurns = [1, 0, 3]; this.pipesSolved = false; this.pipeTouched = false; this.flowReached = 0;
    this.flowFeedbackUntil = 0;
    this.pipeMeshes.forEach(pipe => { pipe.userData.feedbackUntil = 0; });
    this.region = -1; this.normalCue = ''; this.hintActive = false;
    this.hintShot = undefined; this.animalHintSeen = this.pondHintSeen = false;
    this.hintLevels.clear(); this.clearHintDemo(); this.interaction = undefined;
    this.pieces.forEach(piece => this.place(piece, piece.home.x, piece.home.z, false));
    this.body.setTranslation({ x: spawn.x, y: .8, z: spawn.z }, true); this.clearInput();
    this.previous.copy(this.body.translation()); this.heading = this.gait = 0; this.grounded = true;
    this.coyote = this.jumpCooldown = 0;
    this.render();
    this.say('花园里藏着3把钥匙，会在哪里呢？');
  }
  pause() {
    if (this.state !== 'racing') return;
    if (!this.paused) this.workshop.close();
    this.paused = !this.paused; this.clearInput(); window.speechSynthesis?.cancel();
    if (this.paused) this.audio?.pause(); else this.audio?.resume();
  }
  near(x: number, z: number, distance = 1.9) { const p = this.body.translation(); return Math.hypot(p.x - x, p.z - z) < distance; }
  interactionTarget(): Interaction | undefined {
    const player = this.body.translation();
    if (this.carried >= 0) {
      const spot = this.near(plateSpot.x, plateSpot.z, 2.5) && this.pieces[this.carried].square ? plateSpot : this.dropSpot(this.pieces[this.carried]);
      return { ...spot, kind: 'drop', label: '放下' };
    }
    const candidates: (Interaction & { reach: number })[] = [];
    this.pieces.forEach((piece, index) => { if (!piece.placed) candidates.push({ x: piece.x, z: piece.z, index, kind: 'piece', label: '拿起', reach: 1.9 }); });
    if (!this.carryingGrain) candidates.push({ ...this.workshop.guide.position, kind: 'guide', label: '对话', reach: 3 });
    pipeSpots.forEach((spot, index) => candidates.push({ ...spot, index, kind: 'pipe', label: this.pipesSolved ? '看水管' : '转水管', reach: pipeReach }));
    if (!this.carryingGrain && !this.grainPlaced && !this.animalSolved) candidates.push({ ...grainSpot, kind: 'grain', label: '拿谷粒', reach: 1.9 });
    candidates.push({ ...tunnelSpot, kind: 'coop', label: this.carryingGrain ? '放谷粒' : '看鸡舍', reach: this.carryingGrain ? 2.5 : 3 },
      { ...this.chicken.position, kind: 'chicken', label: '招呼小鸡', reach: 6 },
      { x: 0, z: -71, kind: 'exit', label: '看大门', reach: 5 });
    const score = (target: Interaction) => {
      const dx = target.x - player.x, dz = target.z - player.z, distance = Math.hypot(dx, dz);
      const facing = distance ? (-Math.sin(this.heading) * dx - Math.cos(this.heading) * dz) / distance : 1;
      // Facing breaks close-distance ties without selecting a distant object behind a nearer one.
      return distance - facing * .2;
    };
    return candidates.filter(target => this.near(target.x, target.z, target.reach)).sort((a, b) => score(a) - score(b))[0];
  }
  updateInteraction() {
    this.interaction = this.interactionTarget();
    this.interactionRing.visible = !!this.interaction && this.state === 'racing' && !this.paused && !this.workshop.active && !this.hintShot;
    if (this.interaction) {
      this.interactionRing.position.set(this.interaction.x, this.interaction.kind === 'pipe' ? .38 : .12, this.interaction.z);
      this.interactionRing.scale.setScalar(this.interaction.kind === 'pipe' ? 1.85 : 1);
    }
    return this.interaction?.label ?? '看一看';
  }
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
    if (this.interactionTarget()?.kind === 'guide') return '工坊向导在这里 · 按 E 或点击「对话」问问线索。';
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
    if (this.state !== 'racing' || this.paused || this.workshop.active || this.hintShot) return;
    this.region = this.nearestZone(); this.normalCue = this.normalGuidance();
    const plan = this.nextHint();
    const level = Math.min(2, this.hintLevels.get(plan.key) ?? 0);
    this.hintLevels.set(plan.key, level + 1);
    this.hintActive = true;
    this.say(plan.lines[level], 'hint');
    if (level < 2) return;
    this.showHintDemo(plan);
    if (plan.local === 1) this.startPondHintShot();
    else if (plan.local === 2 && !this.animalSolved) this.startHintShot();
    else if (!this.reducedMotion) {
      const look = plan.from.clone().lerp(plan.to, .5);
      const position = look.clone().add(new T.Vector3(0, 9, innerWidth < innerHeight ? 16 : 12));
      this.hintShot = { elapsed: 0, coopOnly: false, returning: false, position: this.camera.position.clone(), look: this.cameraLook.clone(), demo: [
        { at: 0, position: this.camera.position.clone(), look: this.cameraLook.clone() },
        { at: 1.3, position, look }, { at: 5.5, position, look },
      ] };
    }
  }
  showHintDemo(plan = this.nextHint()) {
    this.clearHintDemo();
    const mesh = plan.object.clone(true);
    mesh.position.copy(plan.from);
    if (plan.hop) mesh.rotation.y = Math.PI;
    mesh.traverse(node => {
      if (!(node instanceof T.Mesh)) return;
      const ghost = (material: T.Material) => { const copy = material.clone(); copy.transparent = true; copy.opacity = .4; copy.depthWrite = false; return copy; };
      node.material = Array.isArray(node.material) ? node.material.map(ghost) : ghost(node.material);
      node.castShadow = node.receiveShadow = false;
    });
    this.scene.add(mesh);
    this.hintDemo = { mesh, from: plan.from, to: plan.to, rotation: mesh.rotation.y, turn: plan.turn, hop: plan.hop, start: this.time };
  }
  clearHintDemo() {
    if (!this.hintDemo) return;
    this.hintDemo.mesh.removeFromParent();
    this.hintDemo.mesh.traverse(node => { if (node instanceof T.Mesh) (Array.isArray(node.material) ? node.material : [node.material]).forEach(material => material.dispose()); });
    this.hintDemo = undefined;
  }
  startHintShot() {
    if (this.reducedMotion || this.hintShot || this.collected[2]) return;
    this.animalHintSeen = true;
    this.hintShot = { elapsed: 0, coopOnly: this.carryingGrain || this.grainPlaced || this.animalSolved, returning: false,
      position: this.camera.position.clone(), look: this.cameraLook.clone() };
  }
  startPondHintShot() {
    if (this.reducedMotion || this.hintShot || this.collected[1]) return;
    this.pondHintSeen = true;
    const portrait = innerWidth < innerHeight;
    const frames: HintFrame[] = [{ at: 0, position: this.camera.position.clone(), look: this.cameraLook.clone() }];
    const flower = this.waterFlower.position.clone().add(new T.Vector3(0, .5, 0));
    const flowerPosition = new T.Vector3(26, portrait ? 8 : 6, -23);
    const blocked = this.pipeTurns.findIndex((turn, i) => turn !== pipeSolution[i]);
    let waterPath: T.CatmullRomCurve3 | undefined;
    const waterOffset = new T.Vector3(portrait ? -2.5 : -1.8, portrait ? 2 : 1.5, portrait ? 4.5 : 3.6);
    if (blocked < 0) {
      frames.push({ at: 1.3, position: flowerPosition, look: flower }, { at: 2.5, position: flowerPosition, look: flower });
    } else {
      // Trace only the wet path; never preview the solution through disconnected elbows.
      const path: T.Vector3[] = [];
      const wetPipes = [this.supply, ...this.pipeMeshes.slice(0, blocked)];
      wetPipes.forEach(pipe => {
        const curve = pipe.userData.curve as T.Curve<T.Vector3>;
        const point = (t: number) => curve.getPoint(t).applyAxisAngle(new T.Vector3(0, 1, 0), pipe.rotation.y).add(pipe.position);
        const last = path[path.length - 1];
        const reverse = last && last.distanceToSquared(point(1)) < last.distanceToSquared(point(0));
        for (let i = 0; i <= 8; i++) {
          const sample = point(reverse ? 1 - i / 8 : i / 8);
          if (!path.length || sample.distanceToSquared(path[path.length - 1]) > .0001) path.push(sample);
        }
      });
      // Arc-length sampling avoids speed jumps and tiny stops at pipe joins.
      waterPath = new T.CatmullRomCurve3(path);
      waterPath.getLengths();
      frames.push({ at: 1.6, position: path[0].clone().add(waterOffset), look: path[0] },
        { at: 4.2, position: path[path.length - 1].clone().add(waterOffset), look: path[path.length - 1] });
      const stop = frames[frames.length - 1];
      frames.push({ ...stop, at: 4.7 });
      const overview = { position: new T.Vector3(23, portrait ? 29 : 15, -17), look: new T.Vector3(23, .5, -21) };
      frames.push({ ...overview, at: 6.9 }, { ...overview, at: 7.15 },
        { at: 8.95, position: flowerPosition, look: flower }, { at: 9.5, position: flowerPosition, look: flower });
    }
    this.hintShot = { elapsed: 0, coopOnly: false, returning: false, position: frames[0].position.clone(), look: frames[0].look.clone(), pond: frames, blocked, waterPath, waterOffset };
  }
  endHintShot() {
    this.clearHintDemo();
    const shot = this.hintShot;
    if (!shot || shot.returning) return;
    shot.returning = true; shot.elapsed = 0;
    shot.position.copy(this.camera.position); shot.look.copy(this.cameraLook);
  }
  renderHintCamera(dt: number, portrait: boolean, position: T.Vector3, look: T.Vector3) {
    const shot = this.hintShot;
    if (!shot) return false;
    if (!this.paused) shot.elapsed += dt;
    const t = shot.elapsed, smooth = T.MathUtils.smootherstep;
    const frames = shot.pond ?? shot.demo;
    if (!shot.returning && t >= (frames ? frames[frames.length - 1].at : shot.coopOnly ? 2.5 : 5.5)) this.endHintShot();
    if (shot.returning) {
      const blend = smooth(shot.elapsed, 0, shot.pond ? 1.6 : 1);
      this.camera.position.lerpVectors(shot.position, position, blend);
      this.cameraLook.lerpVectors(shot.look, look, blend);
      if (blend === 1) this.hintShot = undefined;
    } else if (frames) {
      if (shot.waterPath && t >= 1.6 && t <= 4.2) {
        // Floating-point smootherstep can exceed 1 at the endpoint, outside the curve's domain.
        shot.waterPath.getPointAt(T.MathUtils.clamp(smooth(t, 1.6, 4.2), 0, 1), this.cameraLook);
        this.camera.position.copy(this.cameraLook).add(shot.waterOffset!);
        return true;
      }
      const next = frames.findIndex(frame => frame.at > t);
      const from = frames[next - 1], to = frames[next];
      const blend = smooth(t, from.at, to.at);
      this.camera.position.lerpVectors(from.position, to.position, blend);
      this.cameraLook.lerpVectors(from.look, to.look, blend);
    } else {
      const grainPosition = new T.Vector3(grainSpot.x, 4, grainSpot.z + (portrait ? 9 : 7));
      const grainLook = new T.Vector3(grainSpot.x, .65, grainSpot.z - 1.4);
      const coopPosition = new T.Vector3(tunnelSpot.x, 5.5, tunnelSpot.z + (portrait ? 13 : 9));
      const coopLook = new T.Vector3(tunnelSpot.x, 1.6, tunnelSpot.z - 1);
      if (t < 1) {
        this.camera.position.lerpVectors(shot.position, shot.coopOnly ? coopPosition : grainPosition, smooth(t, 0, 1));
        this.cameraLook.lerpVectors(shot.look, shot.coopOnly ? coopLook : grainLook, smooth(t, 0, 1));
      } else {
        const pan = shot.coopOnly ? 1 : smooth(t, 2.5, 4);
        this.camera.position.lerpVectors(grainPosition, coopPosition, pan);
        this.cameraLook.lerpVectors(grainLook, coopLook, pan);
      }
      if (!this.paused && !shot.coopOnly && t >= 1 && t - dt < 1) this.audio?.play('chick');
    }
    return true;
  }
  nextHint() {
    let local = this.carried >= 0 ? 0 : this.carryingGrain ? 2 : this.nearestZone();
    if (local < 0 || this.collected[local]) local = this.collected.findIndex(done => !done);
    let object: T.Object3D = this.exit.mesh, to = object.position.clone(), turn = false;
    let from: T.Vector3 | undefined, hop = false;
    let key = 'exit', lines = ['三把钥匙齐了，看看远处的大门。', '沿着中间的小路走向打开的大门。', '示范：走过打开的大门，就完成冒险啦！'];
    if (local >= 0 && this.solved()[local]) {
      object = this.keyMeshes[local]; to = object.position.clone().add(new T.Vector3(0, .7, 0));
      if (local === 1) {
        object = this.player; from = new T.Vector3(26, .68, -28);
        to = new T.Vector3(26, .49 + .51 * this.waterFlower.scale.y + .68, -26.5); hop = true;
      }
      key = `${local}:key`;
      lines = [local === 1 ? '小花开了，跳上去看看吧！' : '谜题有变化了，看看哪里在发光。',
        ['钥匙就在打开的铁门后面。', '蓝色钥匙在花朵上方。', '粉色钥匙在鸡舍门口。'][local],
        local === 1 ? '示范：先跳上较低的花瓣，再跳到高处碰到钥匙。' : '示范：走近发光的钥匙，就能拿到它。'];
    } else if (local === 0) {
      const correct = this.carried === 0, wrong = this.carried > 0;
      object = this.pieces[wrong ? this.carried : 0].mesh;
      to = correct ? new T.Vector3(plateSpot.x, 1.005, plateSpot.z) : object.position.clone().add(new T.Vector3(0, wrong ? -.3 : 1, 0));
      key = `0:${correct ? 'place' : wrong ? 'wrong' : 'pick'}`;
      lines = ['机关上有一个正方形。工坊里有一样形状的积木吗？',
        wrong ? '手里的积木形状不同，找找正方体。' : correct ? '把手里的正方体带到方形机关旁。' : '看看正方体积木，它和机关的形状一样。',
        wrong ? '示范：先按互动放下这块积木，再去拿正方体。' : correct ? '示范：靠近方形机关，按互动放下正方体。' : '示范：走近正方体，按互动把它拿起来。'];
    } else if (local === 1) {
      const blocked = this.pipeTurns.findIndex((value, i) => value !== pipeSolution[i]);
      object = this.pipeMeshes[Math.max(0, blocked)]; to = object.position.clone(); turn = true;
      key = `1:${blocked}`;
      lines = ['沿着水流看一看，水停在哪一段水管前？', `看看水停住后面的第${blocked + 1}段水管，它的管口朝向哪里？`, '示范：靠近这段水管，按一次互动转一下，再看看水流。'];
    } else if (local === 2) {
      object = this.grainPlaced ? this.chicken : this.grain;
      to = this.carryingGrain ? new T.Vector3(tunnelSpot.x, .7, tunnelSpot.z) : object.position.clone().add(new T.Vector3(0, .7, 0));
      key = `2:${this.grainPlaced ? 'wait' : this.carryingGrain ? 'lead' : 'pick'}`;
      lines = ['小鸡喜欢谷粒，也能钻进你进不去的小门。',
        this.grainPlaced ? '小鸡在鸡舍里找东西，看看门口。' : this.carryingGrain ? '带着谷粒慢慢走向鸡舍的小门，等等小鸡。' : '看看小鸡旁边的那碗谷粒。',
        this.grainPlaced ? '示范：在门口等一等，小鸡会带回钥匙。' : this.carryingGrain ? '示范：带小鸡走到小门旁，等它跟上，再按互动放谷粒。' : '示范：走近谷粒，按互动拿起来，小鸡就会跟着你。'];
    }
    return { local, key, lines, object, from: from ?? object.position.clone(), to, turn, hop };
  }
  interact() {
    if (this.state !== 'racing' || this.paused || this.workshop.active || this.hintShot) return;
    this.endHintShot();
    const target = this.interactionTarget();
    if (!target) return;
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
    if (target.kind === 'piece') {
      const pick = target.index!;
      this.carried = pick;
      this.pieces[pick].body.setEnabled(false);
      this.say(this.pieces[pick].square ? '拿起来啦！这个形状能帮上什么忙呢？' : `拿起${this.pieces[pick].name}啦！看看机关要什么形状。`, 'pickup'); return;
    }
    if (target.kind === 'guide') { this.talkToGuide(); return; }
    if (target.kind === 'pipe') {
      const pipe = target.index!;
      if (this.pipesSolved) { this.say('水已经接通啦！小花替你找到一把钥匙。'); return; }
      const turn = (this.pipeTurns[pipe] + 1) % 4;
      this.pipeTurns[pipe] = turn;
      this.hintActive = false;
      this.audio?.play('pipe');
      if (!this.pipeTouched) this.say(zones[1].goal);
      else this.cue = this.normalGuidance();
      this.pipeTouched = true; return;
    }
    if (target.kind === 'coop' && this.carryingGrain) {
      if (Math.hypot(this.chicken.position.x - tunnelSpot.x, this.chicken.position.z - tunnelSpot.z) > 2.5) {
        this.say('小鸡还没跟上来，等等它吧。'); return;
      }
      this.carryingGrain = false; this.grainPlaced = true; this.chickenState = 'entering';
      this.audio?.play('grain');
      this.hintActive = false; this.say('小鸡钻进去了！', 'chick'); return;
    }
    if (target.kind === 'grain') {
      this.carryingGrain = true; this.chickenState = 'following';
      this.audio?.play('grain');
      this.hintActive = false; this.say('小鸡跟着谷粒走了', 'chick'); return;
    }
    if (target.kind === 'chicken' || target.kind === 'coop') {
      this.audio?.play('chick');
      this.say(this.animalSolved ? '粉色钥匙在鸡舍门口。' : this.grainPlaced ? '鸡舍里传来小鸡的声音。' : !this.carryingGrain ? '小鸡一直盯着那碗谷粒呢。' : this.chickenMood === 'blocked' ? '小鸡在原地打转，好像走不过去。' : '小鸡正看着你手里的谷粒。'); return;
    }
    if (target.kind === 'exit') this.say(this.collected.every(Boolean) ? '出口就在前面，走过去吧！' : `大门还差${3 - this.collected.filter(Boolean).length}把钥匙，再去探索吧。`);
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
        if (waiting && this.chickenMood !== 'waiting') this.audio?.play('chick');
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
      const width = this.chicken.scale.x;
      for (const side of [-width * .46, 0, width * .46]) {
        const ray = new R.Ray({ x: pos.x - uz * side, y: width * .625, z: pos.z + ux * side }, { x: ux, y: 0, z: uz });
        if (this.world.castRay(ray, travel + width * .54, true, undefined, undefined, undefined, this.body)) {
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
  talkToGuide() {
    this.clearHintDemo();
    this.hintShot = undefined;
    this.workshop.start(this.pieces[0].placed, this.collected[0], this.nextHint().lines[1]);
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
    if (this.state !== 'racing' || this.paused || this.workshop.active) return;
    this.time += STEP;
    if (this.hintShot) {
      this.clearInput(); this.previous.copy(this.body.translation());
      const velocity = this.body.linvel();
      this.body.setLinvel({ x: 0, y: velocity.y, z: 0 }, true);
      return;
    }
    let x = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) + this.stick.x;
    let z = Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) + this.stick.y;
    const length = Math.hypot(x, z); if (length > 1) { x /= length; z /= length; }
    if (length > .1 || this.jumpRequested) this.clearHintDemo();
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
      if (available[index] && !this.collected[index] && reachedHeight && this.near(spot.x, spot.z, index === 1 ? 1.75 : 1.55)) {
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
    // Let arrival movement stop before the introductory camera takes over.
    if (!this.hintShot && this.carried < 0 && !this.carryingGrain && this.grounded && length <= .1 && Math.hypot(velocity.x, velocity.z) < .15) {
      if (this.region === 2 && !this.animalHintSeen && !this.grainPlaced && !this.animalSolved) {
        this.animalHintSeen = true;
        this.hintActive = true; this.say(this.nextHint().lines[0], 'hint'); this.showHintDemo(); this.startHintShot();
      } else if (this.region === 1 && !this.pondHintSeen && !this.pipesSolved && this.near(22, -20, 10)) {
        this.pondHintSeen = true;
        this.hintActive = true; this.say(this.nextHint().lines[0], 'hint'); this.showHintDemo(); this.startPondHintShot();
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
    if (!this.paused && !this.workshop.active) {
      const velocity = this.body.linvel();
      animateWalk(this.player, this.heading, this.gait, Math.hypot(velocity.x, velocity.z), this.grounded, this.reducedMotion, dt, this.carried >= 0 || this.carryingGrain);
      setCharacterExpression(this.player, this.state === 'qualified' || this.time < this.happyUntil ? 'happy'
        : this.state !== 'racing' ? 'neutral' : !this.grounded ? 'surprised'
        : Math.hypot(velocity.x, velocity.z) > 2 ? 'determined' : 'neutral');
    }
    // Match the first level's third-person framing and frame-rate-independent follow.
    const portrait = innerWidth < innerHeight;
    const follow = this.paused ? 0 : dt === 0 ? 1 : 1 - Math.exp(-5 * dt);
    this.cameraGoal.set(p.x, Math.max(0, p.y) * .42 + (portrait ? 11 : 9.4), p.z + (portrait ? 18 : 16));
    const lookGoal = new T.Vector3(p.x, Math.max(0, p.y) * .32 + 1.8, p.z - 8);
    if (!this.workshop.update(dt, this.paused || this.state !== 'racing', this.reducedMotion, this.camera, this.cameraLook, this.player, this.cameraGoal, lookGoal)
      && !this.renderHintCamera(dt, portrait, this.cameraGoal, lookGoal)) {
      this.camera.position.lerp(this.cameraGoal, follow);
      this.cameraLook.lerp(lookGoal, follow);
    }
    this.camera.lookAt(this.cameraLook);
    this.camera.updateMatrixWorld();
    this.gate.mesh.position.y = this.pieces[0].placed ? 3.6 : 0;
    // The toy gate retracts into the wooden header instead of floating above its posts.
    this.gate.mesh.scale.y = this.pieces[0].placed ? .08 : 1;
    const exitOpen = this.collected.every(Boolean);
    this.exit.mesh.getObjectByName('left-leaf')!.rotation.y = exitOpen ? -Math.PI / 2 : 0;
    this.exit.mesh.getObjectByName('right-leaf')!.rotation.y = exitOpen ? Math.PI / 2 : 0;
    this.plateIndicator.material = mat(this.pieces[0].placed ? '#79efb0' : '#557c70');
    this.plate.position.y = this.pieces[0].placed ? .285 : .34;
    let connected = true, wetCount = 0;
    this.pipeMeshes.forEach((group, i) => {
      const target = this.pipeTurns[i] * Math.PI / 2;
      const delta = Math.atan2(Math.sin(target - group.rotation.y), Math.cos(target - group.rotation.y));
      if (dt === 0) group.rotation.y = target;
      connected = connected && this.pipeTurns[i] === pipeSolution[i] && Math.abs(delta) < .025;
      if (connected) wetCount++;
      animateWater(group, connected, this.reducedMotion ? 0 : this.time, i === 1);
    });
    if (this.state === 'racing' && !this.paused && wetCount > this.flowReached) {
      for (let i = this.flowReached; i < wetCount; i++) this.pipeMeshes[i].userData.feedbackUntil = this.time + 1.6;
      this.flowFeedbackUntil = this.time + 1.6;
      this.audio?.play('flow', 1 + (wetCount - 1) * .1); this.flowReached = wetCount;
    }
    this.pipeMeshes.forEach(pipe => {
      for (const end of [0, 1]) {
        const material = (pipe.getObjectByName(`mouth-${end}`) as T.Mesh).material as T.MeshStandardMaterial;
        material.emissive.set('#53dba4'); material.emissiveIntensity = pipe.userData.feedbackUntil > this.time ? 1.4 : 0;
      }
    });
    if (connected && !this.pipesSolved) {
      this.pipesSolved = true;
      this.say('小花开啦！跳到花上拿蓝色钥匙！', 'bloom');
    }
    animateWater(this.supply, true, this.reducedMotion ? 0 : this.time);
    animateWater(this.outlet, connected, this.reducedMotion ? 0 : this.time);
    colorFlower(this.waterFlower, '#fff1c5', this.pipesSolved);
    const bloom = this.pipesSolved ? 1.55 : .72;
    this.waterFlower.scale.lerp(new T.Vector3(bloom * 1.12, bloom, bloom * 1.12), dt === 0 || this.reducedMotion ? 1 : this.paused ? 0 : 1 - Math.exp(-3 * dt));
    if (this.flowerPlatformScale !== this.waterFlower.scale.y) this.flowerPlatforms.forEach((collider, i) => {
      const scale = this.waterFlower.scale.y;
      collider.setTranslation({ x: 26, y: .49 + (i === 0 ? .38 : 1.24) * scale, z: -25.5 });
      collider.setShape(new R.Cylinder((i === 0 ? .13 : .09) * scale, (i === 0 ? 1.2 : 1.28) * scale));
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
      mesh.rotation.y = this.reducedMotion || (i === 0 && this.workshop.active) ? 0 : this.time; mesh.position.y = i === 1 ? .49 + 1.33 * this.waterFlower.scale.y + 1.4 : i === 0 ? 2.15 : 1.5;
    });
    const animalKey = this.keyMeshes[2];
    if (this.animalSolved) animalKey.position.set(keySpots[2].x, 1.5, keySpots[2].z);
    else if (this.chickenState === 'returning') animalKey.position.set(this.chicken.position.x, this.chicken.position.y + .8, this.chicken.position.z);
    else animalKey.position.set(nestSpot.x, 1.5, nestSpot.z);
    this.grain.visible = this.grainPlaced || this.carried < 0;
    if (this.carryingGrain) this.grain.position.copy(this.carryPosition);
    else if (this.grainPlaced) this.grain.position.set(nestSpot.x, .66, nestSpot.z + 2);
    else this.grain.position.set(grainSpot.x, .4, grainSpot.z);
    const action = this.updateInteraction();
    if (this.hintDemo) {
      const demo = this.hintDemo, elapsed = this.time - demo.start;
      const blend = this.reducedMotion ? 1 : T.MathUtils.smoothstep(elapsed % 3, .6, 2.4);
      demo.mesh.position.lerpVectors(demo.from, demo.to, blend);
      if (demo.hop) demo.mesh.position.y += Math.sin(blend * Math.PI) * 1.2;
      if (demo.turn) demo.mesh.rotation.y = demo.rotation + blend * Math.PI / 2;
      if (elapsed > 12 || !this.hintActive) this.clearHintDemo();
    }
    const waterDistance = Math.hypot(p.x - 24, p.z + 22);
    const pondTour = this.hintShot?.pond && !this.hintShot.returning;
    const tourWater = pondTour ? 1 - T.MathUtils.smoothstep(this.hintShot!.elapsed, 4.2, 6.9) : 0;
    this.audio?.water(this.state === 'racing' ? Math.max(tourWater, this.pipesSolved ? Math.max(0, 1 - waterDistance / 14) : 0) : 0, !!window.speechSynthesis?.speaking);
    const cue = this.state === 'racing' && !this.hintActive ? this.normalCue || this.cue : this.cue;
    this.ui.updatePuzzle(this.state, this.paused, this.muted, cue, this.collected.filter(Boolean).length, action, !!this.hintShot);
    const showFeedback = this.state === 'racing' && !this.paused && !this.workshop.active;
    this.ui.pipeFeedback(showFeedback && this.time < this.flowFeedbackUntil ? `✓ 已接通 ${this.flowReached} / 3 段水管` : '');
    if (showFeedback && this.carryingGrain && ['waiting', 'blocked'].includes(this.chickenMood)) {
      const point = this.chicken.position.clone().add(new T.Vector3(0, 1.5, 0));
      const behind = point.clone().applyMatrix4(this.camera.matrixWorldInverse).z > 0;
      point.project(this.camera);
      if (behind) { point.x *= -1; point.y = -1; }
      this.ui.chickenMarker([point.x, point.y, behind], this.chickenMood);
    } else this.ui.chickenMarker(null, this.chickenMood);
    this.renderer.render(this.scene, this.camera);
  }
  transfer?: (now: number) => boolean;
  tick(now: number) {
    if (this.transfer) { this.transfer(now); this.renderer.render(this.scene, this.camera); requestAnimationFrame(t => this.tick(t)); return; }
    const dt = Math.min((now - (this.last || now)) / 1000, .1); this.last = now;
    if (this.state === 'racing' && !this.paused && !this.workshop.active) {
      this.accumulator += dt;
      while (this.accumulator >= STEP) { this.step(); this.accumulator -= STEP; }
    } else this.accumulator = 0;
    this.render(dt); requestAnimationFrame(t => this.tick(t));
  }
}
