import './maze.css';
import * as T from 'three';
import R from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bean, mat, orb } from './models';
import { rounded, gardenFlower, gardenFlowerBed, colorFlower } from './puzzle-art';
import { movement, acceleration, animateWalk } from './movement';
import { setCharacterExpression, type Expression } from './character';
import { createGardener, setGardenerExpression } from './gardener';
import { createPottingWorkbench } from './potting-workbench';
import { createFlowerCart } from './flower-cart';
import { createBirdhouse } from './birdhouse';
import { createGardenCottage } from './garden-cottage';
import { createStoneWell } from './stone-well';
import { createVineTrellis } from './vine-trellis';
import { createWoodWindChime, animateWoodWindChime } from './wood-wind-chime';
import { createGardenShadeTree } from './garden-shade-tree';
import { createPlazaOldOak } from './plaza-old-oak';
import { createMossyStump } from './mossy-stump';
import { createGardenBirdbathSteps } from './garden-birdbath';
import { createGardenSongbird } from './garden-songbird';
import { createTreeBench, treeBenchColliders } from './tree-bench';
import { createPergolaRestNook, pergolaRestNookColliders } from './pergola-rest-nook';
import { createWindLeafWaymarker, windLeafWaymarkerColliders } from './wind-leaf-waymarker';
import { createFlowerbedBorder, flowerbedBorderColliders } from './flowerbed-edging';
import { createGardenGate, createGardenBridge, createGardenBridgeDrive } from './plaza-mechanisms';
import { createBridgeWater } from './bridge-water';
import { animateWindWand } from './wind-wand';
import { createWindEffect } from './wind-effect';
import { createDarkKnight, animateDarkKnight, KNIGHT_DEATH_TIME, KNIGHT_PILLAR_STUN_TIME, type KnightPhase } from './dark-knight';
import { createEmberGuardian } from './ember-guardian';
import { GuardianCombat } from './guardian-combat';
import { SneezeFlowers } from './sneeze-flowers';
import { loadGuardianFlameTexture } from './guardian-flames';
import { createWellGardenDetails, wellGardenPots } from './well-garden-details';
import { GardenerStory } from './gardener-story';
import { GardenerQuest } from './gardener-quest';
import { UI } from './ui';
import { type PuzzleSound } from './puzzle-audio';
import { MazeAudio } from './maze-audio';
import { readSettings, saveSettings } from './settings';
import { language, t } from './i18n';
import { at, maze, position, CELL, COLS, ROWS, walkable, type SpotName } from './maze-map';
import { mt, type MazeText } from './maze-text';
import { createMazeGround } from './maze-ground';
import { createMazeIsland } from './maze-island';
import { createFirstEncounterRuinsSteps } from './first-encounter-ruins';
import { createWindGarden, createWindGardenSteps } from './wind-garden';
import { createBossIslandSteps } from './boss-island';
import { createLeafChannelWater } from './leaf-channel-water';
import { createCourtyardAmbience } from './courtyard-ambience';
import { createMazeMeadow, createMazeMeadowSteps } from './painterly-grass';
import { runLoadingSteps } from './loading-steps';
import { createFerryCoast } from './ferry-coast';
import { BOSS_ARENA, FERRY_BOAT_Y, FERRY_BOAT_SCALE, FERRY_MOORING_DISTANCE, gardenCoastX, bossCoastX } from './ferry-shore-layout';
import { windmill, windWand, treasureChest, gardenTools, goldKey, gardenerYard, signpost } from './maze-art';
import { animateTreasureChest } from './treasure-chest';
import { createGardenScout, animateGardenScout, resetGardenScout, setGardenScoutExpression } from './garden-scout';

const SCOUT_PORTRAITS: Partial<Record<MazeText, string>> = {
  scoutHello: 'greeting', scoutChest: 'thinking', scoutCollect: 'surprised', crystalFlying: 'surprised',
  scoutBoat: 'guiding', scoutKeyWaiting: 'encouraging', scoutKey: 'celebrating', scoutExit: 'celebrating',
};
const DIALOGUE_REACTIONS: Partial<Record<MazeText, { player: Expression; npc: Expression }>> = {
  gardenerHello: { player: 'worried', npc: 'worried' },
  playerTrail: { player: 'thinking', npc: 'surprised' },
  playerWillLook: { player: 'determined', npc: 'happy' },
  gardenerRemember: { player: 'thinking', npc: 'thinking' },
  gardenerTogether: { player: 'happy', npc: 'happy' },
  gardenerHint: { player: 'thinking', npc: 'thinking' },
  gardenerPlant: { player: 'happy', npc: 'happy' },
  gardenerFollow: { player: 'happy', npc: 'happy' },
  gardenerThanks: { player: 'happy', npc: 'happy' },
  gardenerAgain: { player: 'thinking', npc: 'happy' },
  findBridge: { player: 'thinking', npc: 'happy' },
  scoutHello: { player: 'happy', npc: 'happy' },
  scoutChest: { player: 'thinking', npc: 'thinking' },
  scoutCollect: { player: 'surprised', npc: 'surprised' },
  crystalFlying: { player: 'surprised', npc: 'surprised' },
  scoutBoat: { player: 'happy', npc: 'happy' },
  scoutKeyWaiting: { player: 'determined', npc: 'happy' },
  scoutKey: { player: 'happy', npc: 'happy' },
  scoutExit: { player: 'happy', npc: 'happy' },
};

type Enemy = { mesh: T.Group; home: T.Vector3; hp: number; maxHp: number; shielded: boolean; phase: KnightPhase; timer: number; aim: T.Vector3; ring: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>; patrol: number; speed: number; alert: number; block: number; lastSeen: T.Vector3; memory: number; path: T.Vector3[]; repath: number };
type Gate = { mesh: T.Group; body: R.RigidBody };
const STEP = movement.step;
const HEDGE_HEIGHT = 4.5;
const DODGE_DURATION = .4, DODGE_SPEED = 10.4, DODGE_COOLDOWN = 1.6;
const DODGE_ACCEL = .07, DODGE_DECEL = .13;
const SHIELD_CHARGE_TIME = 1.1;
function faceKnight(root: T.Group, x: number, z: number, dt: number) {
  const angle = Math.atan2(-x, -z) - root.rotation.y;
  const turn = Math.atan2(Math.sin(angle), Math.cos(angle)) * (1 - Math.exp(-dt * 7));
  root.rotation.y += T.MathUtils.clamp(turn,-dt * 3.6,dt * 3.6);
}

export class MazeAdventure {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(55, 1, .5, 220);
  renderer!: T.WebGLRenderer;
  sun = new T.DirectionalLight('#fff0d5', 2.6);
  world!: R.World;
  body!: R.RigidBody;
  player = bean('#ee5798', true);
  ui!: UI;
  audio!: MazeAudio;
  models = new Map<string, T.Group>();
  walls: { mesh: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>; bounds: T.Box3 }[] = [];
  encounterObstacles: T.Box3[] = [];
  chargePillars: T.Box3[] = [];
  buildingOccluders: { object: T.Object3D; bounds: T.Box3; opaqueMeshes?:T.Mesh[]; opacity: number; materials: { material: T.Material; opacity: number; depthWrite: boolean }[] }[] = [];
  cameraOcclusion = new T.Raycaster();
  enemies: Enemy[] = [];
  practiceEnemies: Enemy[] = [];
  guardian!: GuardianCombat;
  sneezeFlowers!: SneezeFlowers;
  guardianFlameTexture!: T.Texture;
  keys = new Set<string>();
  stick = { x: 0, y: 0 };
  previous = new T.Vector3();
  cameraLook = new T.Vector3();
  cameraGoal = new T.Vector3();
  checkpoint = at('spawn');
  state = 'ready'; paused = false; time = 0; last = 0; accumulator = 0;
  heading = 0; gait = 0; grounded = true; jumpRequested = false; coyote = 0; jumpBuffer = 0; jumpCooldown = 0;
  dodgeTime = 0; dodgeCooldown = 0; dodgeProtection = 0; dodgeDirection = new T.Vector2(); dodgeTaught = false;
  dodgeStartVelocity = new T.Vector2();
  dodgeButton!: HTMLButtonElement;
  chargeLane!: T.Mesh<T.ShapeGeometry, T.MeshBasicMaterial>;
  chargePillarReady = false;
  dodgeAura = new T.Mesh(new T.RingGeometry(.55,.72,32),new T.MeshBasicMaterial({color:'#9ef8e3',side:T.DoubleSide,transparent:true,opacity:.8,depthWrite:false}));
  quest = false; tools = false; wand = false; bridgeOpen = false; bridgeOpening = false; bridgeProgress = 0;
  bridgeHintShown = false; bridgeHintTime = 0; bridgeRevealTime = 0; bridgeWaitTime = 0; bridgeHelpShown = false; bridgeCrossed = false;
  pinwheelPracticed = false; pinwheelLookTime = 0;
  key = false; treasure = false; chestOpened = false; chestProgress = 0; exitOpen = false; hearts = 3; invulnerable = 0; cooldown = 0;
  crystalPickup?: { elapsed: number; start: T.Vector3; rotation: number };
  settings = readSettings();
  reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  toolMesh = gardenTools(); wandMesh = windWand(); mill = windmill(); chest = treasureChest(); keyMesh = goldKey();
  woodWindChime = createWoodWindChime();
  bridgeDeck = new T.Group(); bridgeBody!: R.RigidBody; bridgeSurface!: R.RigidBody; shortcut!: Gate; exit!: Gate;
  bridgeDrive = createGardenBridgeDrive();
  millCue = new T.Mesh(new T.RingGeometry(.53, .6, 48), new T.MeshBasicMaterial({ color: '#fff0bc', transparent: true, opacity: .8, side: T.DoubleSide, depthWrite: false }));
  pinwheelCue = this.millCue.clone();
  encounterGate!: Gate; encounterGateProgress = 0;
  encounterCrest!: T.Object3D; encounterTrail!: T.Object3D;
  bridgeWater = createBridgeWater();
  ferryCoast=createFerryCoast();
  boat = new T.Group(); dockMooring = new T.Group(); bossMooring = new T.Group();
  boatDeck!: R.RigidBody; boardingBody!: R.RigidBody; boardingPlank!: T.Mesh;
  boatAtBossIsland = false;
  boatSpeed=0; boatYaw=Math.PI/2; boatTurn=0;
  boatWake=new T.Group();
  boatTrip?: { toBoss: boolean; elapsed: number; start: T.Vector3 };
  courtyardFloor!: T.Texture;
  leafChannelWater!: ReturnType<typeof createLeafChannelWater>;
  courtyardAmbience!: ReturnType<typeof createCourtyardAmbience>;
  meadow!: ReturnType<typeof createMazeMeadow>;
  courtyard!: ReturnType<typeof createWindGarden>['courtyard'];
  flowerChoir!: ReturnType<typeof createWindGarden>['flowerChoir'];
  guide = createGardener(); scout = createGardenScout();
  scoutPatrol = 0;
  gardenerStory!: GardenerStory;
  gardenQuest!: GardenerQuest;
  cartHintShown = false;
  cartHintTime = 0;
  ring = new T.Mesh(new T.RingGeometry(.8, 1, 32), new T.MeshBasicMaterial({ color: '#ffe58c', side: T.DoubleSide, transparent: true, depthWrite: false }));
  wind = createWindEffect(); windTime = 0; windHit = false; windTarget = new T.Vector3(); windOrigin = new T.Vector3();
  dialogue?: { lines: MazeText[]; index: number; gardenerIntro: boolean };
  message: MazeText = 'safe'; messageUntil = 0; uiMode = ''; hudState = '';
  root!: HTMLElement; dialogueBox!: HTMLElement; gardenerMutter!: HTMLElement;
  routeMarker!: HTMLElement;
  chestQuiz!: HTMLDialogElement;
  enemyBars: HTMLElement[] = [];
  get muted() { return !this.settings.music && !this.settings.effects; }

  async init() {
    await R.init();
    this.world = new R.World({ x: 0, y: -23, z: 0 }); this.world.timestep = STEP;
    this.renderer = new T.WebGLRenderer({ canvas: document.querySelector('#game')!, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setClearColor('#bce3fa'); this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1; this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFShadowMap;
    this.scene.fog = new T.Fog('#bce3fa', 90, 190);
    this.scene.add(new T.HemisphereLight('#d8efff', '#c3b597', 1.5));
    const fill = new T.DirectionalLight('#d8eaff', .4); fill.position.set(28, 20, -22); this.scene.add(fill);
    const sun = this.sun; sun.castShadow = true;
    // Follow the view so one 2048 map keeps nearby shadows detailed throughout the maze.
    sun.shadow.mapSize.setScalar(2048); Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 120 });
    sun.shadow.camera.updateProjectionMatrix(); sun.shadow.radius = 2;
    sun.shadow.normalBias = .035; sun.shadow.bias = -.00008; this.scene.add(sun, sun.target);
    this.audio = new MazeAudio();
    const [ground,,,floor,guardianFlame] = await Promise.all([createMazeGround(this.renderer), this.loadModels(), this.audio.load(),new T.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}textures/maze/courtyard-wind.webp`),loadGuardianFlameTexture()]);
    this.guardianFlameTexture=guardianFlame;
    floor.colorSpace=T.SRGBColorSpace;floor.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());this.courtyardFloor=floor;
    this.scene.add(ground, createMazeIsland());
    await runLoadingSteps(this.build());
    await this.flowerChoir.load(this.audio);
    const spawn = at('spawn');
    this.body = this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(spawn.x, .8, spawn.z).lockRotations().setLinearDamping(movement.damping).setCcdEnabled(true));
    this.world.createCollider(R.ColliderDesc.capsule(.25, .4).setMass(1).setFriction(movement.friction), this.body);
    this.previous.copy(this.body.translation()); this.player.position.copy(this.previous); this.scene.add(this.player);
    this.wandMesh.position.set(.11, 0, -.015);
    this.player.getObjectByName('arm1')!.add(this.wandMesh);
    this.ring.rotation.x = -Math.PI / 2; this.scene.add(this.ring);
    this.dodgeAura.rotation.x = -Math.PI / 2; this.scene.add(this.dodgeAura);
    this.setupUI(); this.bindInput(); this.reset(false); this.resize(); this.render(0);
    document.querySelector('#game')!.setAttribute('aria-label', mt('title'));
    requestAnimationFrame(now => this.tick(now));
  }

  async loadModels() {
    const natureMaterials = new Map<string, T.MeshStandardMaterial>();
    const draco = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}models/draco/`);
    const loader = new GLTFLoader().setDRACOLoader(draco);
    try {
      await Promise.all(['tree-oak-01', 'apple-tree', 'bush-round-01', 'garden-shed', 'water-pond-01', 'bench-01', 'crate-01', 'barrel-01', 'cattail-reed-clump', 'wheelbarrow', 'road-cobble-straight-01', 'streetlamp-01',
        'kenney-nature/pot_small', 'kenney-nature/pot_large', 'kenney-nature/plant_flatShort', 'kenney-nature/grass_leafs'].map(async name => {
        const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`);
        const bounds = new T.Box3().setFromObject(gltf.scene), size = bounds.getSize(new T.Vector3());
        const scale = 1 / size.x;
        gltf.scene.scale.setScalar(scale);
        gltf.scene.position.set(-(bounds.min.x + bounds.max.x) * scale / 2, -bounds.min.y * scale, -(bounds.min.z + bounds.max.z) * scale / 2);
        gltf.scene.traverse(node => { if (node instanceof T.Mesh) {
          if (name.startsWith('kenney-nature/')) {
            const source = node.material as T.MeshStandardMaterial;
            if (!natureMaterials.has(source.name)) {
              const copy = source.clone(); copy.metalness = 0; copy.roughness = .9;
              if (['grass', 'leafsGreen'].includes(source.name)) copy.color.set('#7f9e42');
              if (source.name === 'wood') copy.color.set('#c28250');
              if (source.name === 'woodBarkDark') copy.color.set('#a46d43');
              natureMaterials.set(source.name, copy);
            }
            node.material = natureMaterials.get(source.name)!;
          }
          node.castShadow = name !== 'water-pond-01'; node.receiveShadow = true;
        } });
        const model = new T.Group(); model.add(gltf.scene); this.models.set(name, model);
      }));
    } finally { draco.dispose(); }
  }
  model(name: string, x: number, z: number, width: number, rotation = 0) {
    const model = this.models.get(name)!.clone(true); model.position.set(x, 0, z); model.scale.setScalar(width); model.rotation.y = rotation; this.scene.add(model); return model;
  }
  trackBuildingOcclusion(building: T.Object3D) {
    const copies = new Map<T.Material, T.Material>();
    const precise=building.name.startsWith('boss-blockout-water-channel-')||building.name==='leaf-channel-inlet'||building.name==='boss-blockout-marker',opaqueMeshes:T.Mesh[]=[];
    building.traverse(node => {
      if (!(node instanceof T.Mesh)) return;
      const sources=Array.isArray(node.material)?node.material:[node.material];
      if(precise&&sources.some(material=>!(material instanceof T.ShaderMaterial)&&material.opacity>=.95))opaqueMeshes.push(node);
      const copy = (source: T.Material) => {
        if (!copies.has(source)) { const material = source.clone(); material.transparent = true; copies.set(source, material); }
        return copies.get(source)!;
      };
      node.material = Array.isArray(node.material) ? node.material.map(copy) : copy(node.material);
    });
    this.buildingOccluders.push({ object: building, bounds: new T.Box3().setFromObject(building).expandByScalar(.25), opaqueMeshes:precise?opaqueMeshes:undefined, opacity: 1,
      materials: [...copies].map(([source, material]) => ({ material, opacity: source.opacity, depthWrite: source.depthWrite })) });
  }
  box(parent: T.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
    const mesh = new T.Mesh(rounded(w, h, d, Math.min(.12, h / 3)), mat(color)); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  solid(x: number, y: number, z: number, w: number, h: number, d: number) {
    const body = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x, y, z));
    this.world.createCollider(R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setFriction(.1), body); return body;
  }
  solidGeometry(geometry:T.BufferGeometry,offsetX=0) {
    const positions=geometry.attributes.position;
    const vertices=new Float32Array(positions.array);
    if(offsetX)for(let i=0;i<vertices.length;i+=3)vertices[i]+=offsetX;
    const indices=geometry.index?new Uint32Array(geometry.index.array):Uint32Array.from({length:positions.count},(_,i)=>i);
    const body=this.world.createRigidBody(R.RigidBodyDesc.fixed());
    this.world.createCollider(R.ColliderDesc.trimesh(vertices,indices).setFriction(.1),body);
  }
  place(object: T.Object3D, name: SpotName, y = 0) { const p = at(name); object.position.set(p.x, y, p.z); this.scene.add(object); return object; }
  sign(name: SpotName, text: MazeText, dx = 0, dz = 0) { const p = at(name); const sign = signpost(mt(text)); sign.name = 'sign-' + name; sign.rotation.y = Math.PI; sign.position.set(p.x + dx, 0, p.z + dz); this.scene.add(sign); }
  makeGate(name: 'exit' | 'shortcut'): Gate {
    const p = at(name), root = createGardenGate(name, mt('exit')); root.position.set(p.x,0,p.z); this.scene.add(root);
    const mesh = root.getObjectByName('gate-grille') as T.Group;
    for (const x of [-2.25,2.25]) this.solid(p.x+x,1.6,p.z,.55,3.2,.65);
    root.updateMatrixWorld(true); this.trackBuildingOcclusion(root);
    return { mesh, body: this.solid(p.x, 2, p.z, CELL, 4, 1) };
  }
  *dressGarden() {
    const house = at('gardener'), well = at('tools');
    const details = createWellGardenDetails(this.models); details.position.set(well.x, 0, well.z); this.scene.add(details);
    for (const [i, [dx, dz, width]] of wellGardenPots.entries()) {
      const source = this.models.get('kenney-nature/' + (i === 2 ? 'pot_large' : 'pot_small'))!;
      const height = new T.Box3().setFromObject(source).getSize(new T.Vector3()).y * width;
      const body = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(well.x + dx, height / 2, well.z + dz));
      this.world.createCollider(R.ColliderDesc.cylinder(height / 2, width * .47).setFriction(.1), body);
    }
    const props: [string, number, number, number, number][] = [
      ['barrel-01', house.x - 1.9, house.z - 5.8, 1.05, .2],
      ['wheelbarrow', house.x - 8.3, house.z + 10.6, .85, Math.PI / 2],
      ['bench-01', well.x - 3.6, well.z - 2.8, 2.8, .2],
      ['barrel-01', well.x + 3.4, well.z - 2.4, .8, -.1],
    ];
    for (const [name, x, z, width, angle] of props) {
      const prop = this.model(name, x, z, width, angle); prop.name = 'garden-' + name;
      const bounds = new T.Box3().setFromObject(prop), size = bounds.getSize(new T.Vector3()), center = bounds.getCenter(new T.Vector3());
      this.solid(center.x, center.y, center.z, size.x, size.y, size.z);
    }
    yield;
    const trellis = createVineTrellis(); trellis.position.set(well.x - 4.2, 0, well.z - 6.8);
    trellis.scale.setScalar(1.4); this.scene.add(trellis);
    this.solid(trellis.position.x, 1.32, trellis.position.z, 2.62, 2.64, .32);
    yield;
    const shadeTree = createGardenShadeTree(this.models.get('tree-oak-01')!);
    shadeTree.position.set(well.x - 6.8, 0, well.z - 5.4); shadeTree.scale.setScalar(5.2); this.scene.add(shadeTree);
    const treeBody = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(shadeTree.position.x, 1.3, shadeTree.position.z));
    this.world.createCollider(R.ColliderDesc.cylinder(1.3, .45).setFriction(.1), treeBody);
    yield;
    const stump = createMossyStump(); stump.position.set(well.x - 6.6, 0, well.z - 2.2);
    stump.scale.setScalar(.55); this.scene.add(stump);
    const stumpBody = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(stump.position.x, .36, stump.position.z));
    this.world.createCollider(R.ColliderDesc.cylinder(.36, .44).setFriction(.1), stumpBody);
    const birdbath = yield* createGardenBirdbathSteps(); birdbath.position.set(well.x + 6.3, 0, well.z - 5.9);
    birdbath.scale.setScalar(1.1); this.scene.add(birdbath);
    const bathBody = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(birdbath.position.x, 0, birdbath.position.z));
    this.world.createCollider(R.ColliderDesc.cylinder(.49, .53).setTranslation(0, .49, 0).setFriction(.1), bathBody);
    this.world.createCollider(R.ColliderDesc.cylinder(.26, .98).setTranslation(0, 1.33, 0).setFriction(.1), bathBody);
    yield;
    const songbird = createGardenSongbird(); songbird.scale.setScalar(.68); songbird.rotation.y = Math.atan2(-.45, .64);
    songbird.position.copy(birdbath.localToWorld(new T.Vector3(.45, 1.455, -.64))); this.scene.add(songbird);
    shadeTree.getObjectByName('garden-chime-anchor')!.getWorldPosition(this.woodWindChime.position);
    this.woodWindChime.scale.setScalar(1.4); this.scene.add(this.woodWindChime);
    yield;
    const workbench = createPottingWorkbench(); workbench.position.set(house.x - 11.45, 0, house.z + 2);
    workbench.scale.setScalar(1.6); workbench.rotation.y = Math.PI / 2; this.scene.add(workbench);
    const benchBounds = new T.Box3().setFromObject(workbench), benchSize = benchBounds.getSize(new T.Vector3()), benchCenter = benchBounds.getCenter(new T.Vector3());
    this.solid(benchCenter.x, benchCenter.y, benchCenter.z, benchSize.x, benchSize.y, benchSize.z);
    yield;
    const flowerCart = createFlowerCart(); flowerCart.position.set(house.x + 1.2, 0, house.z - 5.8);
    flowerCart.scale.setScalar(1.1); this.scene.add(flowerCart);
    const cartBounds = new T.Box3().setFromObject(flowerCart), cartSize = cartBounds.getSize(new T.Vector3()), cartCenter = cartBounds.getCenter(new T.Vector3());
    this.solid(cartCenter.x, cartCenter.y, cartCenter.z, cartSize.x, cartSize.y, cartSize.z);
    for (const [x, z, width, angle] of [
      [well.x + .3, well.z + 1.5, 1.2, 0], [well.x + 2.3, well.z + 1.5, 1.2, 0],
      [well.x + 4.3, well.z + 1.5, 1.2, 0],
    ]) {
      const paving = this.model('road-cobble-straight-01', x, z, width, angle);
      paving.name = 'garden-stones'; paving.scale.y *= .12; paving.position.y = .019;
    }
    yield;
    const pink = gardenFlower(), yellow = gardenFlower();
    colorFlower(pink, '#efb2c3', true); colorFlower(yellow, '#f6d87b', true);
    const flower = (x: number, z: number, scale: number, template: T.Group) => {
      const bloom = template.clone(true); bloom.name = 'garden-bloom'; bloom.position.set(x, .07, z); bloom.scale.setScalar(scale); this.scene.add(bloom);
    };
    for (const [dz, color] of [[6.4, '#f1aeb9'], [9.7, '#f3ca67']] as const) {
      const bed = gardenFlowerBed(color); bed.position.set(house.x + 5, .019, house.z + dz);
      bed.scale.setScalar(.9); this.scene.add(bed);
    }
    for (const [dx, dz, scale] of [[3.5, -4.5, .4], [4.7, -3.8, .34], [5.8, -2.8, .45], [6.4, -1.6, .32], [6.2, -.2, .4], [-4.4, -4.4, .33], [-5.6, -3.8, .38], [3.4, -3.5, .35], [4, -3.1, .32], [4.8, -2.8, .33], [5.4, -1.6, .38], [5.5, -.6, .3], [5.1, .6, .36], [6.1, .4, .33]]) {
      flower(well.x + dx, well.z + dz, scale, dx > 5 ? pink : yellow);
    }
    for (const [dx, dz, width] of [[4.5, -4.2, 1.6], [6.2, -2.5, 1.3], [6.5, -.4, 1.4], [-5.7, -4, 1.4]]) {
      const bush = this.model('bush-round-01', well.x + dx, well.z + dz, width); bush.name = 'garden-well-bush';
    }
    for (const [dx, dz, width, angle] of [[-6.6, 2.5, 3.6, .4], [-6.5, 9, 4.2, 1.7], [11, -4, 4.1, 2.2], [11, 10, 3.5, -.6]]) {
      const tree = this.model('tree-oak-01', well.x + dx, well.z + dz, width, angle); tree.name = 'garden-border-tree';
      this.trackBuildingOcclusion(tree);
      const body = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(tree.position.x, 1, tree.position.z));
      this.world.createCollider(R.ColliderDesc.cylinder(1, .28).setFriction(.1), body);
    }
    for (const [dx, dz, width] of [[-6.7, 1, 1.2], [-6.6, 4.4, 1.5], [-6.8, 7.4, 1.3], [-5.8, 10.5, 1.6], [10.9, -1.8, 1.4], [11.2, .2, 1.2], [10.8, 8.2, 1.4], [10.2, 11.2, 1.6]]) {
      const bush = this.model('bush-round-01', well.x + dx, well.z + dz, width, dz); bush.name = 'garden-border-bush';
    }
  }
  *dressPlaza() {
    const oak = at('tree'), plaza = new T.Group(), planting = new T.Group();
    plaza.name = 'old-oak-plaza'; planting.name = 'plaza-groundcover'; this.scene.add(plaza); plaza.add(planting);
    const prop = (name: string, dx: number, dz: number, width: number, angle = 0) => {
      const object = this.model(name, oak.x + dx, oak.z + dz, width, angle);
      object.name = 'plaza-' + name; plaza.add(object); return object;
    };
    const tree = createPlazaOldOak(); tree.position.set(oak.x, 0, oak.z); plaza.add(tree);
    tree.updateMatrixWorld(true);
    const crown = tree.getObjectByName('plaza-oak-crown')!; this.trackBuildingOcclusion(crown);
    const chime = createWoodWindChime(); chime.name = 'plaza-wind-chime'; chime.scale.setScalar(1.7);
    tree.getObjectByName('garden-chime-anchor')!.getWorldPosition(chime.position); plaza.add(chime);
    this.solid(oak.x, 1.3, oak.z, 1.5, 2.6, 1.5);
    const bench = createTreeBench(); bench.position.set(oak.x, 0, oak.z); plaza.add(bench);
    const benchBody = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(oak.x, 0, oak.z));
    for (const part of treeBenchColliders) {
      this.world.createCollider(R.ColliderDesc.cuboid(part.width / 2, .4, part.depth / 2).setTranslation(part.x, .4, part.z)
        .setRotation({ x: 0, y: Math.sin(part.angle / 2), z: 0, w: Math.cos(part.angle / 2) }).setFriction(.1), benchBody);
    }
    yield;
    const nook = createPergolaRestNook(); nook.position.set(oak.x - 14.5, 0, oak.z - 5.6); plaza.add(nook);
    const nookBody = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(nook.position.x, 0, nook.position.z));
    for (const part of pergolaRestNookColliders) {
      this.world.createCollider(R.ColliderDesc.cuboid(part.width / 2, part.height / 2, part.depth / 2)
        .setTranslation(part.x, part.y, part.z).setFriction(.1), nookBody);
    }
    nook.updateMatrixWorld(true); this.trackBuildingOcclusion(nook);
    yield;
    const waymarker = createWindLeafWaymarker(); waymarker.position.set(oak.x + 9, 0, oak.z - 3.2); plaza.add(waymarker);
    const waymarkerBody = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(waymarker.position.x, 0, waymarker.position.z));
    for (const part of windLeafWaymarkerColliders) {
      this.world.createCollider(R.ColliderDesc.cuboid(part.width / 2, part.height / 2, part.depth / 2)
        .setTranslation(part.x, part.y, part.z).setFriction(.1), waymarkerBody);
    }
    waymarker.updateMatrixWorld(true); this.trackBuildingOcclusion(waymarker);
    const ring = new T.Mesh(new T.RingGeometry(4.1, 6.5, 64), mat('#d9c89e'));
    ring.name = 'plaza-paving-ring'; ring.rotation.x = -Math.PI / 2; ring.position.set(oak.x, .035, oak.z); ring.receiveShadow = true; plaza.add(ring);
    yield;
    const paving = this.models.get('road-cobble-straight-01')!.clone(true), stone = new T.Color('#e8d3ad'), grass = new T.Color('#8daa52');
    paving.traverse(node => {
      if (!(node instanceof T.Mesh)) return;
      node.geometry = node.geometry.clone(); node.castShadow = false;
      const colors = node.geometry.getAttribute('color'), source = new T.Color();
      for (let i = 0; i < colors.count; i++) {
        source.fromBufferAttribute(colors, i);
        const tint = source.g > source.r * 1.35 ? grass : stone;
        const shade = .5 + (source.r + source.g + source.b) / 6;
        colors.setXYZ(i, tint.r * shade, tint.g * shade, tint.b * shade);
      }
    });
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6, tile = paving.clone(true);
      tile.position.set(oak.x + Math.sin(angle) * 5.3, .042, oak.z + Math.cos(angle) * 5.3);
      tile.scale.set(2.85, .228, 2.85); tile.rotation.y = angle; planting.add(tile);
    }
    for (const [dx, dz] of [[-5.9, 2.4], [5.9, 2.4]]) {
      const pot = prop('kenney-nature/pot_large', dx, dz, .7);
      const height = new T.Box3().setFromObject(pot).max.y;
      const leaves = prop('kenney-nature/grass_leafs', dx, dz, .66); leaves.position.y = height - .035; planting.add(leaves);
      const body = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(oak.x + dx, height / 2, oak.z + dz));
      this.world.createCollider(R.ColliderDesc.cylinder(height / 2, .33).setFriction(.1), body);
    }
    for (const [dx, dz, width] of [[12.9, -5.5, 2], [-3, -8, 1.5], [3.1, -8.1, 1.7]]) {
      planting.add(prop('bush-round-01', dx, dz, width, dx));
    }
    const bloom = gardenFlower(); colorFlower(bloom, '#fff0ca', true);
    const petals = new T.SphereGeometry(1, 8, 5);
    bloom.traverse(node => { if (node instanceof T.Mesh && node.geometry.type === 'SphereGeometry') node.geometry = petals; });
    for (let i = 0; i < 32; i++) {
      const side = i % 2 ? 1 : -1, band = Math.floor(i / 2), dx = side * (1.1 + band % 4 * .18);
      const dz = -.6 + Math.floor(band / 4) * .4;
      const flower = bloom.clone(true); flower.position.set(oak.x + dx, .02, oak.z + dz); flower.scale.setScalar(.18 + i % 3 * .025); planting.add(flower);
      if (i % 3 === 0) planting.add(prop('kenney-nature/grass_leafs', dx + .22, dz - .15, .36, i));
    }
    for (const [dx, dz, color] of [[-14.7, 8.2, '#efb2c3'], [11.7, 8.2, '#f6d87b']] as const) {
      const border = createFlowerbedBorder(); border.position.set(oak.x + dx, 0, oak.z + dz); plaza.add(border);
      const body = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(border.position.x, 0, border.position.z));
      for (const part of flowerbedBorderColliders) {
        this.world.createCollider(R.ColliderDesc.cuboid(part.width / 2, .24, part.depth / 2).setTranslation(part.x, .24, part.z)
          .setRotation({ x: 0, y: Math.sin(part.angle / 2), z: 0, w: Math.cos(part.angle / 2) }).setFriction(.1), body);
      }
      const bed = new T.Group(); bed.position.copy(border.position); planting.add(bed);
      const soilShape = new T.Shape(); soilShape.moveTo(-1.9, 0);
      soilShape.quadraticCurveTo(-1.9, 1, -.9, 1); soilShape.lineTo(.9, 1); soilShape.quadraticCurveTo(1.9, 1, 1.9, 0);
      soilShape.quadraticCurveTo(1.9, -1, .9, -1); soilShape.lineTo(-.9, -1); soilShape.quadraticCurveTo(-1.9, -1, -1.9, 0); soilShape.closePath();
      const source = gardenFlowerBed(color), soil = new T.Mesh(new T.ShapeGeometry(soilShape, 12), (source.children[0] as T.Mesh).material);
      soil.rotation.x = -Math.PI / 2; soil.position.y = .025; bed.add(soil);
      for (const flower of [...source.children].filter(node => node.name === 'garden-bed-flower')) {
        flower.position.x *= .82; bed.add(flower);
      }
      for (const x of [-1.2, 0, 1.2]) {
        const flower = bloom.clone(true); flower.position.set(x, .18, 0); flower.scale.setScalar(.32); bed.add(flower);
      }
      bed.traverse(node => { if (node instanceof T.Mesh && node.geometry.type === 'SphereGeometry') node.geometry = petals; });
    }
    for (const [dx, dz] of [[1, -7.4], [9.2, -7.2], [12, -6.8]]) {
      planting.add(prop('bush-round-01', dx, dz, 1.3, dx));
      const flower = bloom.clone(true); flower.position.set(oak.x + dx + .75, .03, oak.z + dz + .8); flower.scale.setScalar(.32); planting.add(flower);
      planting.add(prop('kenney-nature/grass_leafs', dx - .65, dz + .5, .55, dz));
    }
    for (const [dx, dz, width] of [[-21, 16.7, 4.7], [16.5, 16.2, 5], [-20, -7.5, 3.8], [16.8, -8, 4.2]]) {
      const border = prop('tree-oak-01', dx, dz, width, dx); this.trackBuildingOcclusion(border);
    }
    for (const dx of [-14, 11]) {
      const lamp = prop('streetlamp-01', dx, 7.5, .75);
      this.solid(lamp.position.x, 1.1, lamp.position.z, .25, 2.2, .25);
    }
    // Batch reused paving and low plants; tall props keep separate occlusion and collision handling.
    planting.updateMatrixWorld(true);
    const batches = new Map<T.Material, T.BufferGeometry[]>();
    planting.traverse(node => {
      if (!(node instanceof T.Mesh)) return;
      const material = node.material as T.Material, geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
      geometry.applyMatrix4(node.matrixWorld);
      if (!batches.has(material)) batches.set(material, []); batches.get(material)!.push(geometry);
    });
    planting.clear();
    for (const [material, geometries] of batches) {
      yield;
      const mesh = new T.Mesh(mergeGeometries(geometries)!, material); mesh.receiveShadow = true; planting.add(mesh);
      geometries.forEach(geometry => geometry.dispose());
    }
  }
  *build() {
    this.solidGeometry((this.scene.getObjectByName('maze-lawn') as T.Mesh).geometry);
    this.scene.add(this.ferryCoast.root);this.solidGeometry(this.ferryCoast.terrain);
    for(const c of this.ferryCoast.colliders)this.solid(c.x,c.y,c.z,c.width,c.height,c.depth);
    yield;
    const ruins = yield* createFirstEncounterRuinsSteps(), encounter = at('practice');
    yield;
    const windGarden = yield* createWindGardenSteps(this.courtyardFloor);
    yield;
    this.courtyard=windGarden.courtyard; this.flowerChoir=windGarden.flowerChoir;
    const hedgeClearings = (ruins.userData.hedgeClearings as number[][])
      .map(([x0, z0, x1, z1]) => [x0 + encounter.x, z0 + encounter.z, x1 + encounter.x, z1 + encounter.z]);
    hedgeClearings.push(...windGarden.colliders.map(({x,z,width,depth}) => [x-width/2-.25,z-depth/2-.25,x+width/2+.25,z+depth/2+.25]));
    const ruinsBorder = (c: number, r: number) => (r === 15 && c >= 16 && c <= 19)
      || (c === 20 && r >= 16 && r <= 20) || (c === 15 && [16, 17, 19, 20].includes(r))
      || (r === 21 && c >= 16 && c <= 19);
    const windGardenBorder = (c: number, r: number) => c >= 13 && r >= 6 && r <= 14;
    // Only exposed wall cells need meshes; horizontal runs keep draw calls bounded.
    for (let r = 0; r < ROWS; r++) {
      yield;
      // Past the locked exit, the path opens into lawn instead of another hedge pocket.
      const exposed = (c: number) => !(r >= 9 && r <= 13 && c >= 7 && c <= 9) && !(c === 30 && r === 7) && !maze[r][c] && [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dc, dr]) => maze[r + dr]?.[c + dc]);
      for (let c = 0; c < COLS; c++) {
        if (!exposed(c)) continue;
        const start = c; while (c + 1 < COLS && exposed(c + 1) && ruinsBorder(c + 1, r) === ruinsBorder(start, r) && windGardenBorder(c + 1, r) === windGardenBorder(start, r)) c++;
        const p = position((start + c) / 2, r), width = (c - start + 1) * CELL;
        const coastRight=Math.min(p.x+width/2,...[-CELL/2,0,CELL/2].map(dz=>gardenCoastX(p.z+dz)));
        if(coastRight<=p.x-width/2)continue;
        const wallMaterial = new T.MeshStandardMaterial({ color: (start + r) % 2 ? '#52923e' : '#65a547', roughness: .96, transparent: true });
        let pieces = [[p.x - width / 2, p.z - CELL / 2, coastRight, p.z + CELL / 2]];
        for (const gap of hedgeClearings) {
          pieces = pieces.flatMap(([x0, z0, x1, z1]) => {
            const a = Math.max(x0, gap[0]), b = Math.max(z0, gap[1]), c = Math.min(x1, gap[2]), d = Math.min(z1, gap[3]);
            if (a >= c || b >= d) return [[x0, z0, x1, z1]];
            return [[x0, z0, a, z1], [c, z0, x1, z1], [a, z0, c, b], [a, d, c, z1]]
              .filter(([left, top, right, bottom]) => right - left > .04 && bottom - top > .04);
          });
        }
        const parts = pieces.map(([x0, z0, x1, z1]) => rounded(x1 - x0, HEDGE_HEIGHT, z1 - z0, Math.min(.4, (x1 - x0) / 3, (z1 - z0) / 3))
          .translate((x0 + x1) / 2 - p.x, 0, (z0 + z1) / 2 - p.z));
        if (parts.length) {
          const wall = new T.Mesh(mergeGeometries(parts)!, wallMaterial); parts.forEach(part => part.dispose());
          wall.position.set(p.x, HEDGE_HEIGHT / 2, p.z); wall.castShadow = wall.receiveShadow = true; this.scene.add(wall);
          if (ruinsBorder(start, r)) {
            wall.name = 'ruins-hedge-base';
          } else if (windGardenBorder(start, r)) {
            wall.name = 'wind-garden-hedge';
          }
          this.walls.push({ mesh: wall, bounds: new T.Box3().setFromObject(wall) });
        }
        this.solid((p.x-width/2+coastRight)/2,HEDGE_HEIGHT/2,p.z,coastRight-(p.x-width/2),HEDGE_HEIGHT,CELL);
      }
    }
    yield* this.dressPlaza();
    this.scene.add(windGarden.root);
    for (const collider of windGarden.colliders) {
      const {x,y,z,width,height,depth}=collider;
      this.solid(x,y,z,width,height,depth);
      const bounds=new T.Box3(new T.Vector3(x-width/2,y-height/2,z-depth/2),new T.Vector3(x+width/2,y+height/2,z+depth/2)).expandByScalar(.55);
      this.encounterObstacles.push(bounds);
      if(this.courtyard.pillars.includes(collider))this.chargePillars.push(bounds);
    }
    for (const name of ['wind-garden-pavilion-columns', 'wind-garden-pavilion-roof'])
      this.trackBuildingOcclusion(windGarden.root.getObjectByName(name)!);
    for(const object of this.courtyard.occluders)this.trackBuildingOcclusion(object);
    this.boat = windGarden.root.getObjectByName('wind-garden-boat') as T.Group;
    this.boatDeck=this.world.createRigidBody(R.RigidBodyDesc.fixed());
    const scale=FERRY_BOAT_SCALE;
    this.world.createCollider(R.ColliderDesc.cuboid(2.2*scale,.07*scale,1.05*scale).setTranslation(0,.55*scale,0).setFriction(.1),this.boatDeck);
    for(const side of [-1,1])this.world.createCollider(R.ColliderDesc.cuboid(2.2*scale,.7*scale,.10*scale).setTranslation(0,1.32*scale,side*1.05*scale).setFriction(0),this.boatDeck);
    for(const side of [-1,1])this.world.createCollider(R.ColliderDesc.cuboid(.10*scale,.7*scale,1.05*scale).setTranslation(side*2.1*scale,1.32*scale,0).setFriction(0),this.boatDeck);
    this.boardingBody=this.solid(0,0,0,1,.12,1.1);
    this.boardingPlank=this.box(this.scene,0,0,0,1,.12,1.1,'#cfa56c');
    this.boardingPlank.name='boat-boarding-plank';
    this.boatWake.name='boat-wake';this.scene.add(this.boatWake);
    for(let i=0;i<24;i++) {
      const a=i*Math.PI/12;
      const buoy=this.box(this.scene,135+42*Math.cos(a),-.25,-12+32*Math.sin(a),.4,.7,.4,'#efbd53');buoy.name='sailing-boundary-buoy';
    }
    this.dockMooring = windGarden.root.getObjectByName('dock-mooring-line') as T.Group;
    const bossIsland = yield* createBossIslandSteps(this.courtyardFloor); this.scene.add(bossIsland.root);
    this.leafChannelWater=createLeafChannelWater(bossIsland.root.getObjectByName('three-tier-leaf-water-channel')!);
    bossIsland.root.updateMatrixWorld(true);
    for(const object of bossIsland.occluders)this.trackBuildingOcclusion(object);
    this.courtyardAmbience=createCourtyardAmbience(bossIsland.root);
    this.bossMooring = bossIsland.root.getObjectByName('dock-mooring-line') as T.Group;
    this.solidGeometry(bossIsland.terrain,bossIsland.root.position.x);
    for (const {x,y,z,width,height,depth} of bossIsland.colliders) {
      this.solid(x,y,z,width,height,depth);
      if(y>.5)this.encounterObstacles.push(new T.Box3(new T.Vector3(x-width/2-.5,0,z-depth/2-.5),new T.Vector3(x+width/2+.5,y+height/2,z+depth/2+.5)));
    }
    yield;
    const house = at('gardener'); const cottage = createGardenCottage(); cottage.position.set(house.x - 9, 0, house.z - 4); this.scene.add(cottage);
    const birdhouse = createBirdhouse(); birdhouse.position.set(house.x - 6.021, 2.2, house.z - 2.6);
    birdhouse.rotation.y = Math.PI / 2; this.scene.add(birdhouse);
    yield* this.dressGarden();
    yield;
    const shed = this.model('garden-shed', house.x - 8, house.z + 7, 4.2, Math.PI / 2); shed.name = 'garden-shed';
    const shedBounds = new T.Box3().setFromObject(shed);
    const workbenchBounds = new T.Box3().setFromObject(this.scene.getObjectByName('garden-potting-workbench')!);
    shed.position.x += workbenchBounds.min.x - shedBounds.min.x;
    shedBounds.setFromObject(shed);
    const shedSize = shedBounds.getSize(new T.Vector3()), shedCenter = shedBounds.getCenter(new T.Vector3());
    this.solid(shedCenter.x, shedCenter.y, shedCenter.z, shedSize.x, shedSize.y, shedSize.z);
    this.trackBuildingOcclusion(cottage); this.trackBuildingOcclusion(shed);
    this.trackBuildingOcclusion(this.scene.getObjectByName('garden-shade-crown')!);
    yield;
    this.place(this.guide, 'gardener', .68); this.guide.rotation.y = Math.PI;
    this.place(gardenerYard(), 'gardener');
    this.place(this.scout, 'scout', .612); this.scout.rotation.y = Math.PI - .35; this.scout.scale.setScalar(.9);
    for (const [x,z] of [[55,23],[68,7],[82,20],[71,-8],[95.5,5],[60,-22]])
      this.model('tree-oak-01',x,z,4.2);
    yield;
    const well = at('tools');
    const stoneWell = createStoneWell(); stoneWell.position.set(well.x + 1.4, 0, well.z - 1.5); this.scene.add(stoneWell);
    const wellBody = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(stoneWell.position.x, .445, stoneWell.position.z));
    this.world.createCollider(R.ColliderDesc.cylinder(.445, .98).setFriction(.1), wellBody);
    for (const dx of [-1.03, 1.03]) this.solid(stoneWell.position.x + dx, 1.17, stoneWell.position.z, .18, 2.34, .20);
    this.place(this.toolMesh, 'tools'); this.place(this.mill, 'windmill'); this.mill.position.z -= 1.5; this.mill.rotation.y = Math.PI;
    const millBody=this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(this.mill.position.x,1.4,this.mill.position.z));
    this.world.createCollider(R.ColliderDesc.cylinder(1.4,.9).setFriction(.1),millBody);
    yield;
    this.gardenQuest = new GardenerQuest(this.scene, this.world, this.guide, this.toolMesh);
    this.pinwheelCue.name = 'pinwheel-wind-cue'; this.pinwheelCue.position.set(0, 1.65, .22); this.pinwheelCue.scale.setScalar(.32);
    this.gardenQuest.pinwheel.add(this.pinwheelCue);
    yield;
    this.place(this.chest, 'chest'); this.chest.rotation.y = Math.PI; this.chest.scale.setScalar(.65);
    this.place(ruins, 'practice');
    this.encounterGate = { mesh: ruins.getObjectByName('ruins-gate') as T.Group,
      body: this.solid(encounter.x + 5, 1.15, encounter.z - 7.25, CELL, 2.3, .35) };
    this.encounterCrest = ruins.getObjectByName('ruins-victory-crest')!;
    this.encounterTrail = ruins.getObjectByName('ruins-victory-trail')!;
    this.trackBuildingOcclusion(ruins.getObjectByName('ruins-arch')!);
    for (const name of ['ruins-columns', 'ruins-pavilion']) this.trackBuildingOcclusion(ruins.getObjectByName(name)!);
    for (const { x, y, z, width, height, depth, angle } of ruins.userData.colliders as { x: number; y: number; z: number; width: number; height: number; depth: number; angle: number }[]) {
      const center = new T.Vector3(encounter.x + x, y, encounter.z + z), rotation = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), angle);
      const body = this.solid(center.x, center.y, center.z, width, height, depth); body.setRotation(rotation, true);
      this.encounterObstacles.push(new T.Box3(new T.Vector3(-width / 2, -height / 2, -depth / 2), new T.Vector3(width / 2, height / 2, depth / 2))
        .applyMatrix4(new T.Matrix4().compose(center, rotation, new T.Vector3(1, 1, 1))).expandByScalar(.55));
    }
    yield;
    this.place(this.keyMesh, 'boss', 1.1); this.keyMesh.visible = false;
    this.exit = this.makeGate('exit'); this.shortcut = this.makeGate('shortcut');
    const bridge = at('bridge'), bridgeRoot=createGardenBridge(); bridgeRoot.position.set(bridge.x-2.5,0,bridge.z);this.scene.add(bridgeRoot);
    bridgeRoot.add(this.bridgeDrive);
    this.solid(bridge.x - 3.4, .6, bridge.z + 2.15, 2.7, 1.2, .9);
    this.millCue.name = 'windmill-wind-cue'; this.millCue.position.set(0, 2.5, -1.1); this.mill.add(this.millCue);
    this.bridgeDeck=bridgeRoot.getObjectByName('bridge-deck') as T.Group;
    this.bridgeSurface = this.solid(bridge.x, this.bridgeDeck.position.y, bridge.z, CELL, .2, 4.1);
    for(const x of [0,5])for(const z of [-2,2])this.solid(bridgeRoot.position.x+x,.4,bridge.z+z,.46,.8,.46);
    this.bridgeBody = this.solid(bridge.x, 2.5, bridge.z, CELL, 5, CELL);
    this.bridgeWater.root.position.set(bridge.x,0,bridge.z);this.scene.add(this.bridgeWater.root);
    this.sign('checkpoint', 'guardian', 3.5, 2);
    this.gardenerStory = new GardenerStory(this.guide, this.player, this.camera, this.cameraLook,
      () => this.say('gardenerSearching'), () => { this.clearInput(); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true); });
    for (const [name, hp, shielded, dx, dz] of [['practice', 1, false, 0, 0], ['shield', 2, true, 0, 0], ['boss', 3, true, 0, 0], ['practice', 1, false, 5, -3], ['practice', 1, false, 5, 4]] as const) {
      yield;
      const p = at(name), mesh = name === 'boss' ? createEmberGuardian(this.guardianFlameTexture) : createDarkKnight(); mesh.position.set(p.x + dx, 0, p.z + dz); this.scene.add(mesh);
      if(name === 'boss'){mesh.scale.setScalar(1.6);mesh.rotation.y=Math.PI;}
      const ring = new T.Mesh(new T.RingGeometry(.85, 1, 32), new T.MeshBasicMaterial({ color: '#f0a252', transparent: true, opacity: .7, side: T.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; this.scene.add(ring);
      this.enemies.push({ mesh, home: mesh.position.clone(), hp, maxHp: hp, shielded, phase: 'idle', timer: 0, aim: new T.Vector3(), ring, patrol: 1, speed: 0, alert: 0, block: 0, lastSeen: mesh.position.clone(), memory: 0, path: [], repath: 0 });
      if (name === 'practice') this.practiceEnemies.push(this.enemies[this.enemies.length - 1]);
    }
    yield;
    this.guardian=new GuardianCombat(this.enemies[2].mesh);this.scene.add(this.guardian.root);
    this.sneezeFlowers=new SneezeFlowers();this.scene.add(this.sneezeFlowers.root);
    for(const flower of this.sneezeFlowers.flowers){
      const {x,z}=flower.root.position;this.solid(x,.5,z,.9,1,.9);
      this.encounterObstacles.push(new T.Box3(new T.Vector3(x-1,0,z-1),new T.Vector3(x+1,1,z+1)));
    }
    const laneLength=6.8*SHIELD_CHARGE_TIME*.8+1.3;
    const lane = new T.Shape([new T.Vector2(-.65,.4),new T.Vector2(.65,.4),new T.Vector2(.65,laneLength-1.3),new T.Vector2(1,laneLength-1.3),new T.Vector2(0,laneLength),new T.Vector2(-1,laneLength-1.3),new T.Vector2(-.65,laneLength-1.3)]);
    this.chargeLane = new T.Mesh(new T.ShapeGeometry(lane),new T.MeshBasicMaterial({color:'#e99935',side:T.DoubleSide,transparent:true,opacity:.55,depthWrite:false}));
    this.chargeLane.name = 'knight-charge-lane'; this.chargeLane.geometry.rotateX(Math.PI / 2); this.scene.add(this.chargeLane);
    // Reuse the licensed tree kit; keep tall silhouettes outside playable lanes.
    for (let r = 2; r < ROWS - 1; r += 4) for (let c = 1; c < COLS - 1; c += 4) {
      if (maze[r][c] || (c === 13 && r === 18) || (c >= 13 && r >= 6 && r <= 14)) continue;
      const p = position(c, r); this.model((r + c) % 3 ? 'tree-oak-01' : 'apple-tree', p.x, p.z, 4 + (r % 3));
    }
    for (const [c, r] of [[17, 20], [19, 16], [12, 2], [18, 2], [1, 12]]) {
      const p = position(c, r); if (c === 19 && r === 16) p.x += 4.5;
      this.model('bush-round-01', p.x - 1.4, p.z + 1.3, 1.8);
    }
    for (const [c, r] of [[17, 12], [12, 4]]) {
      const p = position(c, r); const mushroom = new T.Group();
      this.box(mushroom, 0, .6, 0, .3, 1.2, .3, '#f4e9c8'); mushroom.add(orb('#cc7979', 0, 1.2, 0, .85, .38, .85));
      mushroom.add(orb('#fff3d9', -.3, 1.48, .12, .15, .07, .15)); mushroom.position.set(p.x + 1.5, 0, p.z + 1.5); this.scene.add(mushroom);
    }
    this.scene.add(this.wind.mesh);
    this.world.propagateModifiedBodyPositionsToColliders();
    const grassObstacles: T.Box3[] = [];
    this.world.forEachCollider(collider => {
      const shape=collider.shape,half=new T.Vector3();
      if(shape instanceof R.Cuboid)half.copy(shape.halfExtents);
      else if(shape instanceof R.Cylinder)half.set(shape.radius,shape.halfHeight,shape.radius);
      else if(shape instanceof R.Ball)half.setScalar(shape.radius);
      else if(shape instanceof R.Capsule)half.set(shape.radius,shape.halfHeight+shape.radius,shape.radius);
      else return;
      const bounds=new T.Box3(half.clone().negate(),half).applyMatrix4(new T.Matrix4().compose(
        new T.Vector3().copy(collider.translation()),new T.Quaternion().copy(collider.rotation()),new T.Vector3(1,1,1)));
      if(bounds.max.y>.15&&bounds.min.y<6)grassObstacles.push(bounds.expandByVector(new T.Vector3(.18,0,.18)));
    });
    yield;
    this.meadow = yield* createMazeMeadowSteps((x,z) => {
      return !grassObstacles.some(bounds => x>=bounds.min.x&&x<=bounds.max.x&&z>=bounds.min.z&&z<=bounds.max.z);
    },(this.scene.getObjectByName('maze-lawn') as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>).material.map!);
    this.scene.add(this.meadow.root);
  }

  setupUI() {
    this.ui = new UI({ start: () => this.reset(), pause: () => this.pause(), mute: () => {
      const enabled = this.muted; this.settings = { ...readSettings(), music: enabled, effects: enabled };
      saveSettings(this.settings); this.audio.applySettings(this.settings);
      if (!enabled) speechSynthesis?.cancel();
    }, jump: () => { if (this.active()) this.jumpRequested = true; }, dive: () => this.interact(),
    move: (x, y) => { if (this.active() || (this.boatTrip && !this.paused)) this.stick = { x, y }; }, hint: () => this.hint() });
    this.ui.configurePuzzle();
    this.root = document.querySelector('#game-ui')!; this.root.classList.add('maze-ui');
    this.flowerChoir.mount(this.root);
    this.root.querySelector('.course-title')!.innerHTML = `<small>ADVENTURE 03</small><strong>${mt('title')}</strong>`;
    this.root.querySelector('.keyboard-guide')!.textContent = mt('controls');
    this.root.querySelector('#dive')!.insertAdjacentHTML('beforebegin', `<button type="button" id="dodge" class="action-button dodge" aria-label="${mt('dodge')}" aria-keyshortcuts="Shift"><span aria-hidden="true">↪</span><b>${mt('dodge')}</b><small aria-hidden="true"></small></button>`);
    this.dodgeButton = this.root.querySelector<HTMLButtonElement>('#dodge')!;
    this.ui.wireAction('dodge', () => this.dodge());
    this.dodgeButton.addEventListener('click', event => { if (event.detail === 0) this.dodge(); });
    this.root.insertAdjacentHTML('beforeend', `<div class="maze-inventory" aria-label="${mt('title')}"><span id="maze-hearts"></span><span id="maze-item"></span></div><div class="maze-dialogue workshop-dialogue" hidden role="dialog" aria-modal="true" aria-labelledby="maze-speaker" aria-describedby="maze-line"><div class="workshop-bubble"><strong id="maze-speaker" class="dialogue-speaker"></strong><button type="button" id="maze-close" class="workshop-leave" aria-label="${t('退出对话')}" title="${t('退出对话')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 16 16M20 4 4 20"/></svg></button><p id="maze-line" class="dialogue-line" aria-live="polite"></p><div class="workshop-dialogue-footer"><button type="button" id="maze-next" class="workshop-next"><kbd aria-hidden="true">Enter</kbd><span class="workshop-next-label">${mt('continue')}</span><span class="workshop-next-arrow" aria-hidden="true"></span></button></div></div></div>`);
    this.dialogueBox = this.root.querySelector('.maze-dialogue')!;
    this.dialogueBox.insertAdjacentHTML('beforeend',
      `<div class="maze-trowel-hint" hidden aria-hidden="true"><img src="${import.meta.env.BASE_URL}images/garden-trowel-silhouette.svg" alt="" draggable="false"><div><small>${mt('missingItem')}</small><strong>${mt('tools')}</strong></div></div>`);
    this.dialogueBox.querySelector('.workshop-bubble')!.insertAdjacentHTML('afterbegin',
      `<div class="workshop-portrait" aria-hidden="true"><img src="${import.meta.env.BASE_URL}images/gardener-dialogue.png" alt="" draggable="false"></div>`);
    for (const portrait of ['player-dialogue/thinking.png', 'player-dialogue/determined.png', 'gardener-puzzled.png', 'gardener-remember.png', 'gardener-grateful.png',
      ...[...new Set(Object.values(SCOUT_PORTRAITS))].map(expression => `poppy-dialogue/${expression}.webp`)]) {
      const image = new Image();
      image.src = `${import.meta.env.BASE_URL}images/${portrait}`;
    }
    this.gardenerMutter = document.createElement('div'); this.gardenerMutter.className = 'gardener-mutter';
    this.gardenerMutter.textContent = mt('gardenerSearching'); this.gardenerMutter.hidden = true; this.root.append(this.gardenerMutter);
    this.routeMarker = document.createElement('div'); this.routeMarker.className = 'maze-route-marker'; this.routeMarker.hidden = true;
    this.routeMarker.setAttribute('role', 'status');
    this.routeMarker.innerHTML = '<svg class="route-house" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7"/></svg><svg class="route-mill" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 21 2-9h6l2 9ZM12 10V2l4 2-4 6 8-3v4l-8-1 3 8-4-1 1-7-8 3V9Z"/></svg><b></b><span class="route-arrow" aria-hidden="true">➜</span>';
    this.root.append(this.routeMarker);
    this.enemyBars = this.enemies.map((enemy,index) => {
      const boss=index===2;
      const bar = document.createElement('div'); bar.className = boss?'knight-health boss-health':'knight-health'; bar.hidden = true;
      bar.setAttribute('role','progressbar'); bar.setAttribute('aria-label',mt(boss?'bossHealth':'knightHealth'));
      bar.setAttribute('aria-valuemin','0'); bar.setAttribute('aria-valuemax',String(enemy.maxHp));
      bar.dataset.max = String(enemy.maxHp);
      bar.innerHTML = '<b class="knight-health-crest" aria-hidden="true"></b><div class="knight-health-frame" aria-hidden="true"><div class="knight-health-track"><em></em><i></i><span></span></div></div>';
      if(boss){const name=document.createElement('strong');name.textContent=mt('guardian');bar.append(name,document.createElement('small'));}
      this.root.append(bar); return bar;
    });
    let pressed = false;
    this.dialogueBox.addEventListener('pointerdown', event => { pressed = event.button === 0 && !(event.target as Element).closest('#maze-close'); });
    this.dialogueBox.addEventListener('pointercancel', () => { pressed = false; });
    // Opening on pointerdown must not let that same touch release advance the new dialogue.
    this.dialogueBox.addEventListener('click', event => {
      if ((event.target as Element).closest('#maze-close')) return;
      if (!event.detail || pressed) this.nextDialogue();
      pressed = false;
    });
    const close = this.root.querySelector<HTMLButtonElement>('#maze-close')!;
    let closePressed = false;
    close.addEventListener('pointerdown', event => { closePressed = event.button === 0; });
    close.addEventListener('pointercancel', () => { closePressed = false; });
    close.addEventListener('click', event => { if (!event.detail || closePressed) this.closeDialogue(); closePressed = false; });
    this.root.insertAdjacentHTML('beforeend', `<dialog class="chest-quiz" aria-labelledby="chest-question" aria-describedby="chest-quiz-feedback"><div class="chest-quiz-heading"><span>❀ ${mt('quizTitle')}</span><button type="button" id="chest-quiz-close" aria-label="${mt('quizClose')}">×</button></div><h2 id="chest-question">${mt('quizQuestion')}</h2><div class="chest-quiz-choices"><button type="button" data-chest-answer="wind" autofocus><span aria-hidden="true">🌬️</span><b>${mt('quizWind')}</b></button><button type="button" data-chest-answer="stone"><span aria-hidden="true">🪨</span><b>${mt('quizStone')}</b></button><button type="button" data-chest-answer="soil"><span aria-hidden="true">🌱</span><b>${mt('quizSoil')}</b></button></div><p id="chest-quiz-feedback" role="status" aria-live="polite">${mt('quizChoose')}</p></dialog>`);
    this.chestQuiz = this.root.querySelector<HTMLDialogElement>('.chest-quiz')!;
    this.chestQuiz.querySelector('#chest-quiz-close')!.addEventListener('click', () => this.chestQuiz.close());
    this.chestQuiz.querySelectorAll<HTMLButtonElement>('[data-chest-answer]').forEach(button => {
      button.addEventListener('click', () => this.answerChestQuiz(button.dataset.chestAnswer!));
    });
    this.chestQuiz.addEventListener('close', () => this.clearInput());
  }
  bindInput() {
    this.renderer.domElement.addEventListener('click', event => {
      if (!this.active() || this.treasure || this.crystalPickup || this.chestProgress < 1 || !this.near('chest', 2.7)) return;
      const bounds = this.renderer.domElement.getBoundingClientRect(), ray = new T.Raycaster();
      ray.setFromCamera(new T.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1,
        1 - (event.clientY - bounds.top) / bounds.height * 2), this.camera);
      if (ray.intersectObject(this.chest.getObjectByName('chest-crystal')!, true).length) this.collectCrystal();
    });
    addEventListener('keydown', event => {
      if (this.chestQuiz.open) return;
      if ((event.target as HTMLElement)?.closest('button,a,input,select') && ['Space', 'Enter'].includes(event.code)) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      if (event.repeat) return;
      if (this.dialogue) { if (['KeyE', 'Enter', 'Space', 'Escape'].includes(event.code)) { event.preventDefault(); if (event.code === 'Escape') this.closeDialogue(); else this.nextDialogue(); } return; }
      if (event.code === 'Escape') { this.pause(); return; }
      if (this.boatTrip && !this.paused && this.state === 'racing') {
        this.keys.add(event.code);
        if(event.code==='KeyE'||event.code==='KeyF')this.interact();
        return;
      }
      if (!this.active()) return;
      this.keys.add(event.code);
      if (event.code === 'KeyE' || event.code === 'KeyF') this.interact();
      if (event.code === 'KeyH') this.hint();
      if (event.code === 'Space') this.jumpRequested = true;
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') { event.preventDefault(); this.dodge(); }
    });
    addEventListener('keyup', event => this.keys.delete(event.code));
    const suspend = () => { this.clearInput(); if (this.state === 'racing' && !this.paused) this.pause(); };
    addEventListener('blur', suspend);
    document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
    addEventListener('resize', () => { this.clearInput(); this.resize(); });
    addEventListener('pagehide', () => { this.flowerChoir.reset(); this.audio.stop(); speechSynthesis?.cancel(); });
  }
  active() { return this.state === 'racing' && !this.paused && !this.dialogue && !this.chestQuiz?.open && !this.gardenerStory.active && !this.gardenQuest.busy && !this.boatTrip; }
  clearInput() { this.keys.clear(); this.stick = { x: 0, y: 0 }; this.jumpRequested = false; this.jumpBuffer = 0; }
  reset(play = true) {
    this.chestQuiz.close();
    this.flowerChoir.reset();
    this.clearInput(); this.state = play ? 'racing' : 'ready'; this.paused = false;
    this.quest = this.tools = this.wand = this.bridgeOpen = this.bridgeOpening = this.key = this.treasure = this.chestOpened = this.exitOpen = false;
    this.chestProgress = 0;
    this.crystalPickup = undefined;
    this.bridgeProgress = 0; this.hearts = 3; this.invulnerable = this.cooldown = this.time = this.accumulator = this.gait = 0;
    this.encounterGateProgress = 0; this.encounterGate.body.setEnabled(true);
    this.coyote = this.jumpBuffer = this.jumpCooldown = 0; this.heading = 0; this.checkpoint = at('spawn');
    this.dodgeTime = this.dodgeCooldown = this.dodgeProtection = 0; this.dodgeDirection.set(0,0); this.dodgeStartVelocity.set(0,0); this.dodgeTaught = false;
    this.dialogue = undefined; this.dialogueBox.hidden = true; this.message = 'safe'; this.messageUntil = 6;
    this.gardenerStory.reset();
    resetGardenScout(this.scout);
    this.scoutPatrol = 0; this.scout.position.set(at('scout').x, .612, at('scout').z);
    this.scout.rotation.y = Math.PI - .35;
    this.gardenQuest.reset();
    this.cartHintShown = false; this.cartHintTime = 0;
    this.bridgeHintShown = this.bridgeHelpShown = this.bridgeCrossed = false; this.bridgeHintTime = this.bridgeRevealTime = this.bridgeWaitTime = 0;
    this.pinwheelPracticed = false; this.pinwheelLookTime = 0; this.pinwheelCue.visible = false;
    this.millCue.visible = false; this.mill.getObjectByName('rotor')!.rotation.z = 0;
    this.ferryCoast.clearWake();this.boatSpeed=this.boatTurn=0;this.boatYaw=Math.PI/2;this.boat.rotation.set(0,Math.PI/2,0);this.boatWake.visible=false;this.boatTrip = undefined; this.boatAtBossIsland = false; this.boat.position.copy(this.boatMooring(false));
    this.body.setEnabled(true);this.ferryCoast.time.value=0;this.dockMooring.visible=true;this.bossMooring.visible=false;
    this.body.setTranslation({ ...at('spawn'), y: .8 }, true); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.previous.copy(this.body.translation()); this.player.position.copy(this.previous); this.player.visible = true;
    this.bridgeBody.setEnabled(true); this.bridgeSurface.setEnabled(false); this.shortcut.body.setEnabled(true); this.exit.body.setEnabled(true);
    this.chest.getObjectByName('lid')!.rotation.x = 0; this.toolMesh.visible = true; this.keyMesh.visible = false;
    this.keyMesh.position.set(at('boss').x,1.1,at('boss').z);
    for (const enemy of this.enemies) { enemy.hp = enemy.maxHp; enemy.phase = 'idle'; enemy.timer = 0; enemy.mesh.position.copy(enemy.home); enemy.mesh.visible = true; enemy.ring.visible = false;
      enemy.patrol = 1; enemy.speed = enemy.alert = enemy.block = enemy.memory = enemy.repath = 0; enemy.path = []; enemy.lastSeen.copy(enemy.home);
      if (enemy !== this.enemies[2]) animateDarkKnight(enemy.mesh, 'idle', enemy.shielded, 0, 0, this.reducedMotion, enemy); }
    this.guardian.reset(this.enemies[2].mesh,this.reducedMotion);
    this.sneezeFlowers.reset();
    this.uiMode = ''; this.hudState = ''; this.windTime = 0; this.last = performance.now(); this.audio.stop(); speechSynthesis?.cancel();
    if (play) { this.audio.resume(); (document.activeElement as HTMLElement)?.blur(); }
    this.render(0);
  }
  pause() {
    if (this.state !== 'racing') return;
    this.chestQuiz.close();
    this.paused = !this.paused; this.clearInput(); this.last = performance.now(); this.accumulator = 0;
    if (this.paused) { this.flowerChoir.pause(); this.audio.pause(); speechSynthesis?.cancel(); } else this.audio.resume();
  }
  say(key: MazeText, sound?: PuzzleSound) {
    this.message = key; this.messageUntil = this.time + 6;
    if (sound) this.audio.play(sound);
    if (key !== 'sailing' && this.settings.effects && 'speechSynthesis' in window && !(this.flowerChoir.performing && this.near('choir', 14) && !this.dialogue)) {
      speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(mt(key));
      utterance.lang = language === 'zh' ? 'zh-CN' : language === 'ms' ? 'ms-MY' : 'en-US'; utterance.rate = .9; utterance.volume = .75; speechSynthesis.speak(utterance);
    }
  }
  talk(speaker: MazeText, lines: MazeText[], gardenerIntro = false) {
    this.dialogueBox.dataset.portrait = speaker === 'gardenerName' || speaker === 'scoutName' ? 'true' : 'false';
    this.dialogueBox.dataset.npc = speaker === 'scoutName' ? 'scout' : 'gardener';
    this.clearInput(); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.dialogue = { lines, index: 0, gardenerIntro }; this.dialogueBox.hidden = false;
    this.root.querySelector('#maze-speaker')!.textContent = mt(speaker);
    this.showLine(); (this.root.querySelector('#maze-next') as HTMLButtonElement).focus({ preventScroll: true });
  }
  showLine() {
    const dialogue = this.dialogue!;
    const line = dialogue.lines[dialogue.index];
    const playerSpeaking = line === 'playerTrail' || line === 'playerWillLook';
    if (dialogue.gardenerIntro) {
      if (dialogue.index < 4) this.gardenerStory.setStage(dialogue.index);
      this.root.querySelector('#maze-speaker')!.textContent = mt(playerSpeaking ? 'playerName' : 'gardenerName');
    }
    this.dialogueBox.dataset.speaker = playerSpeaking ? 'player' : 'guide';
    const gardenerPortrait = line === 'gardenerHello' ? 'gardener-puzzled'
      : line === 'gardenerRemember' ? 'gardener-remember'
      : line === 'gardenerThanks' || line === 'gardenerPlant' ? 'gardener-grateful' : 'gardener-dialogue';
    const portraitPath = this.dialogueBox.dataset.npc === 'scout' ? `poppy-dialogue/${SCOUT_PORTRAITS[line] ?? 'greeting'}.webp`
      : `${playerSpeaking ? line === 'playerWillLook' ? 'player-dialogue/determined' : 'player-dialogue/thinking' : gardenerPortrait}.png`;
    this.dialogueBox.querySelector<HTMLImageElement>('.workshop-portrait img')!.src = `${import.meta.env.BASE_URL}images/${portraitPath}`;
    this.root.querySelector('#maze-line')!.textContent = mt(dialogue.lines[dialogue.index]);
    this.dialogueBox.querySelector<HTMLElement>('.maze-trowel-hint')!.hidden = line !== 'gardenerHello' || this.tools || this.gardenQuest.returned;
    this.root.querySelector('#maze-next .workshop-next-label')!.textContent = mt(dialogue.index === dialogue.lines.length - 1 ? line === 'gardenerFollow' ? 'followGardener' : 'close' : 'continue');
    this.say(dialogue.lines[dialogue.index]);
  }
  nextDialogue() {
    if (!this.dialogue || this.paused) return;
    if (this.dialogue.gardenerIntro && !this.gardenerStory.canAdvance) return;
    this.dialogue.index++;
    if (this.dialogue.index < this.dialogue.lines.length) this.showLine();
    else this.closeDialogue(true);
  }
  updateDialogueReaction(dt: number) {
    if (!this.dialogue) return;
    const line = this.dialogue.lines[this.dialogue.index];
    const reaction = DIALOGUE_REACTIONS[line] ?? { player: 'neutral', npc: 'happy' };
    const npc = this.dialogueBox.dataset.npc === 'scout' ? this.scout : this.guide;
    setCharacterExpression(this.player, reaction.player);
    if (npc === this.guide) setGardenerExpression(npc, reaction.npc);
    else setGardenScoutExpression(npc, reaction.npc);
    if (!this.paused && this.player.position.distanceToSquared(npc.position) > .01) {
      for (const [actor, other] of [[this.player, npc], [npc, this.player]]) {
        const yaw = Math.atan2(actor.position.x - other.position.x, actor.position.z - other.position.z);
        const turn = Math.atan2(Math.sin(yaw - actor.rotation.y), Math.cos(yaw - actor.rotation.y));
        actor.rotation.y += turn * (this.reducedMotion ? 1 : 1 - Math.exp(-7 * dt));
      }
      this.heading = this.player.rotation.y;
    }
  }
  closeDialogue(completed = false) {
    const intro = this.dialogue?.gardenerIntro;
    const followGardener = this.dialogue?.lines.includes('gardenerFollow') && this.gardenQuest.stage === 'walking';
    const receivedWand = this.wand && this.dialogue?.lines.includes('gardenerThanks');
    if (intro) {
      this.gardenerStory.finish(completed);
    }
    this.dialogue = undefined; this.dialogueBox.hidden = true; this.clearInput(); (document.activeElement as HTMLElement)?.blur(); speechSynthesis?.cancel();
    if (intro && completed) this.say('findTools');
    if (followGardener) this.say('gardenerFollow');
    if (receivedWand && !this.pinwheelPracticed && !this.bridgeOpen) { this.pinwheelLookTime = 3.4; this.say('tryPinwheel'); }
  }
  near(name: SpotName, reach = 3) { const p = this.body.translation(), q = name === 'scout' ? this.scout.position : at(name); return Math.hypot(p.x - q.x, p.z - q.z) < reach; }
  encounterGateBlocks(x: number, z: number, margin: number) {
    const p = this.encounterGate.body.translation();
    return this.encounterGate.body.isEnabled() && Math.abs(x - p.x) <= CELL / 2 + margin && Math.abs(z - p.z) <= .175 + margin;
  }
  clearSight(to: { x: number; z: number }) {
    const p = this.body.translation(), length = Math.hypot(p.x - to.x, p.z - to.z);
    for (let d = .4; d < length - .6; d += .4) {
      const x = p.x + (to.x - p.x) * d / length, z = p.z + (to.z - p.z) * d / length;
      if (this.encounterGateBlocks(x, z, .2) || !walkable(x, z, this.bridgeOpen, this.key, this.exitOpen)) return false;
    }
    return true;
  }
  objective(): MazeText {
    if (this.boatTrip) return 'sailing';
    if (this.wand && this.flowerChoir.status === 'sleeping' && this.near('choir', 8)) return 'choirSleeping';
    if (this.exitOpen) return 'throughExit'; if (this.key) return this.boatAtBossIsland ? 'returnExit' : 'gardenExit';
    if (this.enemies[2].hp === 0) return 'collectKey';
    if (this.bridgeOpen) {
      if (!this.bridgeCrossed) return 'bridgeLowered';
      if(this.encounterGateProgress<1)return 'practiceGate';
      if(this.enemies[1].hp>0&&this.near('shield',12))return 'pillarHint';
      return this.boatAtBossIsland ? 'findGuardian' : this.treasure ? 'findBoat' : this.chestOpened ? 'pickCrystalHint' : 'findCrystal';
    }
    if (this.bridgeOpening) return 'bridgeTurning';
    if (this.bridgeHintShown && this.near('windmill', 9) && (this.wand || !this.quest && !this.tools && !this.gardenQuest.returned)) return this.wand ? this.bridgeHelpShown ? 'bridgeWindHint' : 'bridgeNotice' : 'windNeeded';
    if (this.wand) return this.pinwheelPracticed ? 'findBridge' : 'tryPinwheel';
    if (this.gardenQuest.stage === 'handoff') return 'gardenerPlant';
    if (this.gardenQuest.stage === 'walking') return 'gardenerFollow';
    if (this.gardenQuest.stage === 'digging') return 'gardenerDig';
    if (this.gardenQuest.stage === 'planting') return 'plantingFlowers';
    if (this.gardenQuest.returned) return 'plantHint';
    if (this.tools) return 'returnTools'; if (this.gardenQuest.stage === 'tool') return 'cartOpened';
    if (this.quest) return 'findTools'; return this.bridgeHintShown ? 'windNeeded' : 'safe';
  }
  routeTarget(): 'gardener' | 'pinwheel' | 'windmill' | undefined {
    if (this.bridgeOpen || this.bridgeOpening) return;
    if (this.wand) return this.pinwheelPracticed || this.near('windmill', 9) ? 'windmill' : 'pinwheel';
    if (this.tools || this.bridgeHintShown && !this.quest && !this.gardenQuest.returned) return 'gardener';
  }
  updateRouteMarker() {
    const goal = this.routeTarget();
    this.routeMarker.hidden = !this.active() || !goal;
    if (!goal || !this.active()) return;
    const target = goal === 'gardener' ? this.guide.position : goal === 'pinwheel' ? this.gardenQuest.pinwheel.position : this.mill.position;
    const distance = Math.hypot(this.player.position.x - target.x, this.player.position.z - target.z);
    this.routeMarker.hidden = distance < (goal === 'gardener' ? 5 : goal === 'windmill' ? 6.6 : 3);
    if (this.routeMarker.hidden) return;
    this.routeMarker.dataset.target = goal;
    const label = mt(goal === 'gardener' ? 'cottage' : goal === 'pinwheel' ? 'littlePinwheel' : 'bigWindmill');
    const caption = this.routeMarker.querySelector('b')!;
    if (caption.textContent !== label) caption.textContent = label;
    const point = target.clone().add(new T.Vector3(0, 2, 0)).project(this.camera);
    if (point.z > 1) { point.x *= -1; point.y *= -1; }
    const width = this.routeMarker.offsetWidth, height = this.routeMarker.offsetHeight;
    const minY = (this.root.querySelector('.guidance')!.getBoundingClientRect().bottom || 90) + height / 2 + 12;
    const left = T.MathUtils.clamp((point.x + 1) * innerWidth / 2, width / 2 + 16, innerWidth - width / 2 - 16);
    let top = T.MathUtils.clamp((1 - point.y) * innerHeight / 2 - 28, minY, Math.max(minY, innerHeight * .66));
    for (const selector of ['.action-controls', '#stick']) {
      const controls = this.root.querySelector(selector)!.getBoundingClientRect();
      if (controls.width && left + width / 2 > controls.left - 12 && left - width / 2 < controls.right + 12) top = Math.min(top, controls.top - height / 2 - 12);
    }
    top = Math.max(minY, top);
    this.routeMarker.style.left = `${left}px`; this.routeMarker.style.top = `${top}px`;
    const angle = Math.atan2((1 - point.y) * innerHeight / 2 - top, (point.x + 1) * innerWidth / 2 - left);
    (this.routeMarker.querySelector('.route-arrow') as HTMLElement).style.transform = `rotate(${angle}rad)`;
  }
  scoutCue(): MazeText {
    if (this.exitOpen) return 'scoutExit';
    if (this.key) return 'scoutKey';
    if (this.enemies[2].hp === 0) return 'scoutKeyWaiting';
    if (this.treasure) return 'scoutBoat';
    if (this.crystalPickup) return 'crystalFlying';
    return this.chestOpened ? 'scoutCollect' : 'scoutChest';
  }
  hint() {
    if (!this.active()) return;
    if (this.near('scout', 7)) { this.say(this.scoutCue(), 'hint'); return; }
    const enemy = this.enemies.find(e => e.hp > 0 && e.shielded && e.mesh.position.distanceTo(this.player.position) < 10);
    if (!enemy && !this.bridgeOpen && !this.bridgeOpening && this.near('windmill', 9)) {
      this.bridgeHelpShown = this.wand; this.say(this.wand ? 'bridgeWindHint' : 'windNeeded', 'hint'); return;
    }
    this.say(enemy === this.enemies[2] ? 'bossSwordHint' : enemy === this.enemies[1] ? 'pillarHint' : enemy ? 'scoutHint' : !this.wand && this.quest ? this.gardenQuest.hint() : this.objective(), 'hint');
  }
  target(): { spot: SpotName | 'seedling' | 'sneezeFlower'; action: MazeText } | undefined {
    const p = this.body.translation();
    const seedling = this.gardenQuest.seedling.position;
    if (this.gardenQuest.stage === 'plant' && Math.hypot(p.x - seedling.x, p.z - seedling.z) < 1.8) return { spot: 'seedling', action: 'plantSeedling' };
    if (Math.hypot(p.x - this.guide.position.x, p.z - this.guide.position.z) < 3) return { spot: 'gardener', action: this.tools && !this.wand ? 'giveTools' : 'talk' };
    const cartAction = this.gardenQuest.cartAction(p.x, p.z);
    if (cartAction) return { spot: 'cart', action: cartAction };
    if (this.gardenQuest.stage === 'tool' && Math.hypot(p.x - this.toolMesh.position.x, p.z - this.toolMesh.position.z) < 2.7) return { spot: 'tools', action: 'takeTools' };
    if (this.wand && this.near('pinwheel', 3)) return { spot: 'pinwheel', action: 'blow' };
    if (this.wand && this.near('choir', 7) && this.clearSight(at('choir'))) return { spot: 'choir', action: 'blow' };
    if (this.near('scout', 2.7)) return { spot: 'scout', action: 'talk' };
    if (!this.treasure && this.near('chest', 2.7)) return { spot: 'chest', action: this.crystalPickup ? 'takingCrystal' : !this.chestOpened ? 'openChest' : this.chestProgress < 1 ? 'chestOpening' : 'takeCrystal' };
    if (!this.boatAtBossIsland && (this.near('dock', 3)||this.onBoat())) return { spot: 'dock', action: this.treasure ? 'sailToBoss' : 'inspect' };
    if (this.boatAtBossIsland && (this.near('bossDock', 3)||this.onBoat())) return { spot: 'bossDock', action: 'sailBack' };
    if (!this.key && this.enemies[2].hp === 0 && Math.hypot(p.x-this.keyMesh.position.x,p.z-this.keyMesh.position.z)<3) return { spot: 'boss', action: 'takeKey' };
    if(this.wand&&this.enemies[2].hp>0&&this.enemies[2].phase!=='dazed'){
      const flower=this.sneezeFlowers.nearby(p);
      if(flower&&this.clearSight(flower.root.position)){
        const boss=this.enemies[2];
        const inRange=this.sneezeFlowers.contains(flower,boss.mesh.position);
        return {spot:'sneezeFlower',action:this.sneezeFlowers.active?'flowerSneezing':flower.used?'flowerSpent':flower.cooldown>0?'flowerResting':inRange?'blowFlower':'lureGuardian'};
      }
    }
    if (!this.exitOpen && this.near('exit', 3.2)) return { spot: 'exit', action: this.key ? 'openGate' : 'inspect' };
    if (!this.bridgeOpen && this.near('windmill', 6.6) && this.body.translation().x < at('bridge').x) return { spot: 'windmill', action: this.bridgeOpening ? 'bridgeLowering' : this.wand ? 'blowWindmill' : 'inspect' };
    return undefined;
  }
  interact() {
    if(this.boatTrip) { if(!this.paused)this.dockBoat(); return; }
    if (!this.active() || this.dodgeTime > 0) return;
    this.audio.resume(); const target = this.target();
    if (target?.spot === 'gardener') {
      this.quest = true;
      if (this.tools && !this.wand) {
        this.tools = false; this.clearInput(); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        this.gardenQuest.give(this.body, this.player); this.say('gardenerPlant', 'pickup');
      }
      else if (this.gardenQuest.returned && !this.wand) this.talk('gardenerName', [this.gardenQuest.hint()]);
      else if (!this.wand && !this.gardenerStory.introduced) this.talk('gardenerName', ['gardenerHello', 'playerTrail', 'gardenerRemember', 'gardenerTogether', 'playerWillLook'], true);
      else this.talk('gardenerName', this.wand ? [this.bridgeOpen ? 'scoutHint' : this.pinwheelPracticed ? 'findBridge' : 'gardenerAgain'] : ['gardenerHint']);
    } else if (target?.spot === 'cart') {
      if (target.action === 'inspect') { this.quest = true; this.say('cartPushHint', 'hint'); return; }
      this.quest = true; this.clearInput(); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.heading = -Math.PI / 2; this.gardenQuest.push(this.body, this.player); this.say('cartMoving', 'drop');
    } else if (target?.spot === 'tools') {
      this.tools = true; this.quest = true; this.gardenQuest.take(this.player); this.toolMesh.visible = false; this.say('returnTools', 'pickup');
    } else if (target?.spot === 'seedling') {
      this.clearInput(); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true); this.gardenQuest.plant(this.body, this.player); this.say('plantingFlowers', 'pickup');
    } else if (target?.spot === 'choir') {
      if (this.cooldown > 0) return;
      const p = this.body.translation(), choir = at('choir');
      const index = this.flowerChoir.flowers.reduce((best, f, i, flowers) => Math.abs(choir.x + f.root.position.x - p.x) < Math.abs(choir.x + flowers[best].root.position.x - p.x) ? i : best, 0);
      const flower = this.flowerChoir.flowers[index].root.position;
      this.cast({ x: choir.x + flower.x, z: choir.z + flower.z });
      if (!this.flowerChoir.performing) {
        if (this.flowerChoir.start(index)) speechSynthesis?.cancel();
        else this.say('choirUnavailable');
      }
    } else if (target?.spot === 'sneezeFlower') {
      if(this.cooldown>0)return;
      const p=this.body.translation(),flower=this.sneezeFlowers.nearby(p);
      if(flower&&!flower.used&&!this.sneezeFlowers.active&&flower.cooldown===0){
        this.cast(flower.root.position);this.windTarget.y=1.7;
        if(this.sneezeFlowers.trigger(flower,this.enemies[2].mesh.position)){
          this.guardian.prepareForPollen(this.enemies[2]);this.say('flowerWindup','switch');
        }else this.say('flowerLureHint','hint');
      }
    } else if (target?.spot === 'pinwheel') {
      this.cast(at('pinwheel')); this.windTarget.y = 1.65; this.pinwheelPracticed = true; this.pinwheelLookTime = 0;
      this.gardenQuest.pinwheelTime = 4; this.say('pinwheelHint', 'bloom');
    }
    else if (target?.spot === 'scout') { this.hearts = 3; this.talk('scoutName', ['scoutHello', this.scoutCue()]); }
    else if (target?.spot === 'chest') {
      if (!this.chestOpened) {
        this.clearInput(); this.body.setLinvel({x:0,y:0,z:0},true);
        this.chestQuiz.querySelector('#chest-quiz-feedback')!.textContent = mt('quizChoose');
        this.chestQuiz.showModal();
      } else this.collectCrystal();
    }
    else if (target?.spot === 'dock' || target?.spot === 'bossDock') this.startBoatTrip(target.spot === 'dock');
    else if (target?.spot === 'boss') { this.key = true; this.keyMesh.visible = false; this.shortcut.body.setEnabled(false); this.say('returnExit', 'key'); }
    else if (target?.spot === 'exit') {
      if (this.key) { this.exitOpen = true; this.exit.body.setEnabled(false); this.say('throughExit', 'gate'); }
      else this.say('locked', 'hint');
    } else if (target?.spot === 'windmill') {
      if (this.wand && !this.bridgeOpening) {
        this.cast(this.mill.position); this.windTarget.set(this.mill.position.x, 2.5, this.mill.position.z + .86);
        this.bridgeOpening = true; this.bridgeHintTime = 0; this.bridgeRevealTime = 3.4; this.say('bridgeTurning', 'switch');
      }
      else if (!this.wand) this.say('windNeeded', 'hint');
    } else if (this.wand) this.blow();
  }
  onBoat() {
    const p=this.body.translation();
    const hit=this.world.castRay(new R.Ray({x:p.x,y:p.y-.57,z:p.z},{x:0,y:-1,z:0}),.24,true,undefined,undefined,undefined,this.body);
    return hit?.collider.handle===this.boatDeck.collider(0).handle;
  }
  syncBoatDeck() {
    const p=this.body.translation();
    // Carry a standing passenger with the swell, without dragging a jumping player.
    if(!this.boatTrip&&this.body.isEnabled()&&this.body.linvel().y<1&&this.onBoat()) {
      const y=this.boat.position.y+.62*FERRY_BOAT_SCALE+.65;
      this.body.setTranslation({x:p.x,y,z:p.z},true);this.previous.y+=y-p.y;
      const velocity=this.body.linvel();this.body.setLinvel({x:velocity.x,y:0,z:velocity.z},true);
    }
    this.boatDeck.setTranslation(this.boat.position,true);
    // Only the end facing the dock stays open for boarding and walking ashore.
    this.boatDeck.collider(3).setEnabled(this.boatAtBossIsland||!!this.boatTrip);
    this.boatDeck.collider(4).setEnabled(!this.boatAtBossIsland||!!this.boatTrip);
    this.boardingPlank.visible=!this.boatTrip;this.boardingBody.setEnabled(!this.boatTrip);
    if(this.boatTrip)return;
    const dock=at(this.boatAtBossIsland?'bossDock':'dock'),side=this.boatAtBossIsland?-1:1;
    const a=new T.Vector3(dock.x+side*(this.boatAtBossIsland?1.9:1.55),.035,dock.z);
    const b=new T.Vector3(this.boat.position.x-side*.65*FERRY_BOAT_SCALE,this.boat.position.y+.62*FERRY_BOAT_SCALE-.06,dock.z);
    const delta=b.clone().sub(a),length=delta.length();
    this.boardingPlank.position.copy(a).add(b).multiplyScalar(.5);
    this.boardingPlank.quaternion.setFromUnitVectors(new T.Vector3(1,0,0),delta.normalize());
    this.boardingPlank.scale.x=length;
    this.boardingBody.collider(0).setHalfExtents({x:length/2,y:.06,z:.55});
    this.boardingBody.setTranslation(this.boardingPlank.position,true);
    this.boardingBody.setRotation(this.boardingPlank.quaternion,true);
  }
  boatMooring(onBossIsland: boolean) {
    const p = at(onBossIsland ? 'bossDock' : 'dock');
    return new T.Vector3(p.x + (onBossIsland ? -1 : 1)*FERRY_MOORING_DISTANCE, FERRY_BOAT_Y, p.z);
  }
  answerChestQuiz(answer: string) {
    if (!this.chestQuiz.open || this.paused || this.state !== 'racing' || this.chestOpened || !this.near('chest', 2.7)) return;
    if (answer !== 'wind') {
      this.chestQuiz.querySelector('#chest-quiz-feedback')!.textContent = mt('quizTryAgain');
      this.audio.play('hint'); return;
    }
    this.chestQuiz.close(); this.clearInput();
    this.chestOpened = true; if (this.reducedMotion) this.chestProgress = 1;
    this.say('quizCorrect', 'gate');
  }
  collectCrystal() {
    if (!this.active() || this.dodgeTime > 0 || !this.chestOpened || this.chestProgress < 1 || this.treasure || this.crystalPickup || !this.near('chest', 2.7)) return;
    const crystal = this.chest.getObjectByName('chest-crystal')!;
    this.crystalPickup = {elapsed: 0, start: crystal.position.clone(), rotation: crystal.rotation.y};
    if (this.reducedMotion) this.finishCrystalPickup();
    else { this.say('crystalFlying', 'pickup'); this.updateCrystalPickup(0); }
  }
  finishCrystalPickup() {
    this.crystalPickup = undefined;
    this.treasure = true; this.hearts = 3;
    animateTreasureChest(this.chest, this.chestProgress, true, this.time, this.reducedMotion);
    this.say('treasure', 'key');
  }
  updateCrystalPickup(dt: number) {
    const pickup = this.crystalPickup;
    if (!pickup || this.paused) return;
    if (this.active()) pickup.elapsed = this.reducedMotion ? .7 : Math.min(.7, pickup.elapsed + dt);
    const progress = pickup.elapsed / .7;
    if (progress === 1) { this.finishCrystalPickup(); return; }
    const crystal = this.chest.getObjectByName('chest-crystal')!;
    const destination = this.chest.worldToLocal(this.player.position.clone().add(new T.Vector3(0, .3, 0)));
    crystal.position.lerpVectors(pickup.start, destination, T.MathUtils.smoothstep(progress, 0, 1));
    crystal.position.y += Math.sin(progress * Math.PI) * .5 / this.chest.scale.y;
    crystal.rotation.y = pickup.rotation + progress * Math.PI * 1.25;
    crystal.scale.setScalar(.62 * (1 - T.MathUtils.smoothstep(progress, .3, 1)));
    crystal.visible = true; this.chest.getObjectByName('chest-reward-glow')!.visible = false;
  }
  startBoatTrip(toBoss: boolean) {
    if (toBoss && !this.treasure) { this.say('boatNeedsCrystal', 'hint'); return; }
    this.clearInput(); this.body.setLinvel({x:0,y:0,z:0},true); this.body.setEnabled(false);
    const p = this.body.translation(); this.boatTrip = {toBoss,elapsed:0,start:new T.Vector3(p.x,p.y,p.z)};
    this.boatSpeed=this.boatTurn=0;this.boatYaw=toBoss?Math.PI/2:-Math.PI/2;
    this.boat.rotation.set(0,this.boatYaw,0);
    this.heading=this.boatYaw+Math.PI;
    this.say('sailing', 'flow');
    this.render(0);
  }
  updateBoat(dt: number) {
    const trip = this.boatTrip;
    if (!trip || this.paused || this.state !== 'racing') return false;
    trip.elapsed+=dt;
    const steer=T.MathUtils.clamp(Number(this.keys.has('KeyD')||this.keys.has('ArrowRight'))-Number(this.keys.has('KeyA')||this.keys.has('ArrowLeft'))+this.stick.x,-1,1);
    const throttle=T.MathUtils.clamp(Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'))-Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'))-this.stick.y,-1,1);
    const acceleration=throttle<0&&this.boatSpeed>0?7:3;
    this.boatSpeed=T.MathUtils.clamp(this.boatSpeed+throttle*acceleration*dt,-2.5,9)*Math.exp(-(throttle? .08:.45)*dt);
    this.boatTurn=T.MathUtils.lerp(this.boatTurn,steer*(.3+Math.min(1,Math.abs(this.boatSpeed)/5))*(this.boatSpeed<-.1?-1:1),1-Math.exp(-4*dt));
    this.boatYaw-=this.boatTurn*dt;
    const b=this.boat.position,forward=new T.Vector3(Math.sin(this.boatYaw),0,Math.cos(this.boatYaw));
    const next=b.clone().addScaledVector(forward,this.boatSpeed*dt);
    const water=(x:number,z:number)=>!(z>-32&&z<8&&x<gardenCoastX(z)+2.5)&&!(z>BOSS_ARENA.top-5&&z<BOSS_ARENA.bottom+5&&x>bossCoastX(z)-2.5);
    // Sample both ends of the hull so shore contact follows the visible island.
    if([-2.5,0,2.5].every(d=>water(next.x+forward.x*d,next.z+forward.z*d)))b.copy(next);
    else {this.boatSpeed*=Math.exp(-12*dt);if(this.message!=='boatShore')this.say('boatShore','hint');}
    const edge=Math.hypot((b.x-135)/42,(b.z+12)/32);
    if(edge>1){this.boatSpeed*=Math.exp(-3*dt);this.boatYaw=T.MathUtils.lerp(this.boatYaw,Math.atan2(135-b.x,-12-b.z)+Math.round((this.boatYaw-Math.atan2(135-b.x,-12-b.z))/(Math.PI*2))*Math.PI*2,1-Math.exp(-dt));}
    b.y=FERRY_BOAT_Y+this.ferryCoast.heightAt(b.x,b.z);
    const phase=this.ferryCoast.time.value;
    this.boat.rotation.set(this.reducedMotion?0:Math.sin(phase*1.8)*.025+this.boatSpeed*.004,this.boatYaw,this.reducedMotion?0:this.boatTurn*Math.min(.13,Math.abs(this.boatSpeed)*.018)+Math.sin(phase*1.3)*.025,'YXZ');
    this.heading=this.boatYaw+Math.PI;
    this.boat.getObjectByName('boat-sail')!.rotation.z=this.reducedMotion?0:Math.sin(phase*3)*.018*Math.min(1,Math.abs(this.boatSpeed)/4);
    this.boat.updateMatrixWorld(true);
    const ride=this.boat.localToWorld(new T.Vector3(0,.62+.65/FERRY_BOAT_SCALE,-.7));
    this.boatWake.visible=Math.abs(this.boatSpeed)>.3;
    this.ferryCoast.updateWake(b.x,b.z,this.boatSpeed,forward.x,forward.z,dt);
    const point=trip.start.clone().lerp(ride,this.reducedMotion?1:T.MathUtils.smoothstep(trip.elapsed,0,.35));
    this.body.setTranslation(point,true);this.previous.copy(point);this.accumulator=0;
    return false;
  }
  dockBoat() {
    const trip=this.boatTrip;if(!trip)return;
    const destination=[false,true].find(boss=>{const p=this.boatMooring(boss);return Math.hypot(p.x-this.boat.position.x,p.z-this.boat.position.z)<2.4;});
    if(destination===undefined){this.say('sailing');return;}
    trip.toBoss=destination;this.boatSpeed=this.boatTurn=0;this.boatYaw=Math.PI/2;this.boat.rotation.set(0,Math.PI/2,0);this.boatWake.visible=false;
    this.boat.position.copy(this.boatMooring(destination));
    const landing=at(destination?'bossDock':'dock');
    this.body.setTranslation({x:landing.x,y:.8,z:landing.z},true);this.previous.copy(this.body.translation());
    this.boatAtBossIsland=trip.toBoss; this.boatTrip=undefined;
    this.body.setEnabled(true); this.body.setLinvel({x:0,y:0,z:0},true); this.clearInput();
    this.checkpoint=landing; this.invulnerable=Math.max(2,this.invulnerable);
    this.dockMooring.visible=!trip.toBoss;this.bossMooring.visible=trip.toBoss;
    this.say(trip.toBoss ? 'arrivedBoss' : this.key ? 'gardenExit' : 'arrivedGarden', 'gate');
    return true;
  }
  cast(target: { x: number; z: number }, hit = true) {
    this.wandMesh.getObjectByName('wind-core')!.getWorldPosition(this.windOrigin);
    this.windTarget.set(target.x, 1.2, target.z); this.windTime = .5; this.cooldown = .65;
    this.windHit = hit;
    this.heading = Math.atan2(this.player.position.x - target.x, this.player.position.z - target.z); this.audio.play('flow', 1.5);
  }
  blow() {
    if (this.cooldown > 0) return;
    const p = this.body.translation();
    const enemy = this.enemies.filter(e => e.hp > 0 && Math.hypot(p.x - e.mesh.position.x, p.z - e.mesh.position.z) <= (e===this.enemies[2]&&e.phase==='dazed'?10:7.5) && this.clearSight(e.mesh.position))
      .sort((a, b) => a.mesh.position.distanceToSquared(this.player.position) - b.mesh.position.distanceToSquared(this.player.position))[0];
    if(enemy===this.enemies[2]&&enemy.phase==='dazed'&&!this.guardian.coreExposed)return;
    this.cast(enemy?.mesh.position ?? { x: p.x - Math.sin(this.heading) * 6, z: p.z - Math.cos(this.heading) * 6 }, !!enemy && enemy.phase !== 'stun');
    if (!enemy || enemy.phase === 'stun') return;
    if (enemy.shielded && enemy.phase !== 'rest' && enemy.phase !== 'dazed') { enemy.block = .24; this.say(enemy===this.enemies[2]?'bossSwordGuard':'shielded', 'drop'); return; }
    if(enemy.phase==='dazed'&&(this.message==='pillarDazed'||this.message==='flowerOpening'))this.messageUntil=this.time;
    if(enemy===this.enemies[2])this.guardian.reactToHit(enemy.mesh,p);
    enemy.hp--; enemy.phase = 'stun'; enemy.timer = .8; this.audio.play('bloom');
    if (enemy.hp === 0) {
      if (enemy !== this.enemies[2]) enemy.timer = KNIGHT_DEATH_TIME;
      enemy.ring.visible = false;
      if (enemy === this.enemies[2]) { this.sneezeFlowers.reset();this.keyMesh.position.copy(enemy.mesh.position).setY(1.1);this.keyMesh.visible = true;this.guardian.root.visible=false;enemy.timer=KNIGHT_DEATH_TIME;this.say('collectKey', 'key'); }
      if (enemy === this.enemies[1]) this.say('findCrystal');
    }
  }
  dodge() {
    if (!this.active() || this.dodgeCooldown > 0) return;
    const p = this.body.translation();
    const x = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) + this.stick.x;
    const z = Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) + this.stick.y;
    this.dodgeDirection.set(x,z);
    if (this.dodgeDirection.length() < .1) {
      const enemy = this.enemies.filter(e => e.hp > 0 && Math.hypot(e.mesh.position.x-p.x,e.mesh.position.z-p.z) < 11 && this.clearSight(e.mesh.position))
        .sort((a,b) => Number(b.phase === 'warn' || b.phase === 'lunge') - Number(a.phase === 'warn' || a.phase === 'lunge') || a.mesh.position.distanceToSquared(this.player.position) - b.mesh.position.distanceToSquared(this.player.position))[0];
      if (enemy) {
        const attacking = enemy.phase === 'warn' || enemy.phase === 'lunge';
        this.dodgeDirection.set(attacking ? enemy.aim.z : p.z-enemy.mesh.position.z,attacking ? -enemy.aim.x : enemy.mesh.position.x-p.x);
      } else this.dodgeDirection.set(-Math.sin(this.heading),-Math.cos(this.heading));
      if (this.dodgeDirection.lengthSq() < .01) this.dodgeDirection.set(1,0);
      this.dodgeDirection.normalize();
      const destination = {x:p.x+this.dodgeDirection.x*3.2,z:p.z+this.dodgeDirection.y*3.2};
      if (!this.knightClear(p,destination)) this.dodgeDirection.negate();
    }
    this.dodgeDirection.normalize(); this.dodgeTime = DODGE_DURATION; this.dodgeCooldown = DODGE_COOLDOWN;
    const velocity = this.body.linvel(); this.dodgeStartVelocity.set(velocity.x,velocity.z);
    this.dodgeProtection = DODGE_DURATION + .08; this.jumpRequested = false; this.jumpBuffer = 0;
    this.audio.play('flow'); this.updateUI();
  }
  hurt() {
    if (this.invulnerable > 0 || this.dodgeProtection > 0) return;
    this.hearts--; this.invulnerable = 2.5; this.say('hurt', 'drop');
    if (this.hearts === 0) {
      this.hearts = 3; this.body.setTranslation({ ...this.checkpoint, y: .8 }, true); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.previous.copy(this.body.translation()); this.player.position.copy(this.previous); this.clearInput(); this.say('recover', 'bloom');
      this.dodgeTime = this.dodgeCooldown = this.dodgeProtection = 0;
      for (const enemy of this.enemies) {
        enemy.mesh.position.copy(enemy.home); enemy.phase = 'idle'; enemy.timer = 0;
        enemy.speed = enemy.alert = enemy.block = enemy.memory = enemy.repath = 0; enemy.path = []; enemy.lastSeen.copy(enemy.home);
        if (enemy !== this.enemies[2]) animateDarkKnight(enemy.mesh, 'idle', enemy.shielded, this.time, 0, this.reducedMotion, enemy);
      }
      this.guardian.reset(this.enemies[2].mesh,this.reducedMotion);
      this.sneezeFlowers.reset();
      this.render(0);
    }
  }
  knightClear(from: { x: number; z: number }, to: { x: number; z: number }) {
    const steps = Math.max(1,Math.ceil(Math.hypot(to.x - from.x,to.z - from.z) / .25));
    for (let i = 0; i <= steps; i++) {
      const x = T.MathUtils.lerp(from.x,to.x,i / steps), z = T.MathUtils.lerp(from.z,to.z,i / steps);
      if (this.encounterGateBlocks(x, z, .55)) return false;
      if (this.encounterObstacles.some(bounds => x >= bounds.min.x && x <= bounds.max.x && z >= bounds.min.z && z <= bounds.max.z)) return false;
      if (![-.55,.55].every(dx => [-.55,.55].every(dz => walkable(x + dx,z + dz,this.bridgeOpen,this.key,this.exitOpen)))) return false;
    }
    return true;
  }
  chargePillarContact(from:T.Vector3,aim:T.Vector3,reach:number) {
    const ray=new T.Ray(from,aim);
    let contact:T.Vector3|undefined;
    for(const pillar of this.chargePillars){
      const point=ray.intersectBox(pillar,new T.Vector3());
      // A small contact skin keeps adjoining masonry seams from masking a pillar impact.
      if(point&&point.distanceTo(from)<=reach+.04&&(!contact||point.distanceToSquared(from)<contact.distanceToSquared(from)))contact=point;
    }
    if(!contact)return;
    const stop=contact.addScaledVector(aim,-.04);
    return this.knightClear(from,stop)?stop:undefined;
  }
  moveKnight(enemy: Enemy, target: { x: number; z: number }, pace: number, dt: number) {
    const from = enemy.mesh.position;
    if (this.knightClear(from,target)) enemy.path = [];
    else {
      if (enemy.repath <= 0) {
        enemy.repath = .4; enemy.path = [];
        const cell = (p: { x: number; z: number }) => Math.round(p.z / CELL + 10) * COLS + Math.round(p.x / CELL + 10);
        const point = (id: number) => { const p = position(id % COLS,Math.floor(id / COLS)); return new T.Vector3(p.x,0,p.z); };
        const start = cell(from), goal = cell(target), queue = [start], parents = new Map<number,number>([[start,-1]]);
        // Two local enemies on a small uniform grid need only a throttled breadth-first search.
        for (let i = 0; i < queue.length && !parents.has(goal); i++) {
          const id = queue[i], c = id % COLS, r = Math.floor(id / COLS);
          for (const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nc = c + dc, nr = r + dr, next = nr * COLS + nc;
            if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || parents.has(next)) continue;
            const p = point(next);
            if (p.distanceTo(enemy.home) > 14 || !this.knightClear(point(id),p)) continue;
            parents.set(next,id); queue.push(next);
          }
        }
        if (parents.has(goal)) {
          for (let id = goal; id !== -1; id = parents.get(id)!) enemy.path.unshift(point(id));
          if (enemy.path.length > 1 && this.knightClear(from,enemy.path[1])) enemy.path.shift();
        }
      }
      while (enemy.path.length && from.distanceTo(enemy.path[0]) < .15) enemy.path.shift();
      if (!enemy.path.length) return;
      target = enemy.path[0];
    }
    const dx = target.x - from.x, dz = target.z - from.z, length = Math.hypot(dx,dz);
    if (length < .01) return;
    faceKnight(enemy.mesh,dx,dz,dt);
    const alignment = Math.max(0,Math.cos(Math.atan2(-dx,-dz) - enemy.mesh.rotation.y));
    const step = Math.min(length,dt * T.MathUtils.lerp(enemy.speed,pace,1 - Math.exp(-dt * 5)) * alignment);
    const next = { x: from.x + dx / length * step, z: from.z + dz / length * step };
    if (Math.hypot(next.x - enemy.home.x,next.z - enemy.home.z) <= 14 && this.knightClear(from,next)) from.set(next.x,0,next.z);
    else enemy.repath = 0;
  }
  updateKnight(enemy: Enemy, dt: number) {
    const p = this.body.translation(), from = enemy.mesh.position, beforeX = from.x, beforeZ = from.z;
    const distance = Math.hypot(p.x - from.x,p.z - from.z), homeDistance = Math.hypot(p.x - enemy.home.x,p.z - enemy.home.z);
    const visible = distance < 11 && homeDistance <= 12 && this.clearSight(from);
    enemy.timer -= dt; enemy.repath -= dt;
    if (visible && enemy.phase !== 'return') { enemy.lastSeen.set(p.x,0,p.z); enemy.memory = 1.8; }
    else enemy.memory = Math.max(0,enemy.memory - dt);
    switch (enemy.phase) {
      case 'idle': {
        if (visible) { enemy.phase = 'chase'; enemy.timer = .35; enemy.path = []; enemy.repath = 0; break; }
        const target = enemy.home.clone(); target.z += enemy.patrol * 1.1;
        if (from.distanceTo(target) < .1) { enemy.patrol *= -1; enemy.timer = .65; }
        else if (enemy.timer <= 0) this.moveKnight(enemy,target,.8,dt);
        break;
      }
      case 'chase': {
        if (enemy.memory <= 0 || homeDistance > 12 || from.distanceTo(enemy.home) > 12) {
          enemy.phase = 'return'; enemy.path = []; enemy.repath = 0; break;
        }
        if (enemy.timer > 0) { faceKnight(enemy.mesh,enemy.lastSeen.x - from.x,enemy.lastSeen.z - from.z,dt); break; }
        const alignment = Math.cos(Math.atan2(from.x - p.x,from.z - p.z) - enemy.mesh.rotation.y);
        if (visible && distance <= (enemy.shielded ? 4 : 2.5) && alignment > .94 && this.knightClear(from,p)) {
          enemy.phase = 'warn'; enemy.timer = enemy.shielded ? (this.dodgeTaught ? 1.4 : 2) : 1.1; enemy.aim.set(p.x - from.x,0,p.z - from.z).normalize();
          if (enemy.shielded) { this.dodgeTaught = true; this.say('dodgeHint'); }
        } else this.moveKnight(enemy,enemy.lastSeen,1.8,dt);
        break;
      }
      case 'return':
        if (from.distanceTo(enemy.home) < .15) { enemy.phase = 'idle'; enemy.timer = .65; enemy.memory = 0; enemy.path = []; }
        else this.moveKnight(enemy,enemy.home,1.3,dt);
        break;
      case 'warn':
        // Track early in the tell, then commit so a sidestep can genuinely dodge the attack.
        if (!enemy.shielded && visible && enemy.timer > .45) enemy.aim.set(p.x - from.x,0,p.z - from.z).normalize();
        faceKnight(enemy.mesh,enemy.aim.x,enemy.aim.z,dt);
        if (enemy.timer <= 0) {
          if (!enemy.shielded && (!visible || distance > 3 || !this.knightClear(from,p))) { enemy.phase = 'chase'; enemy.timer = .15; }
          else { enemy.phase = 'lunge'; enemy.timer = enemy.shielded ? SHIELD_CHARGE_TIME : .45; }
        }
        break;
      case 'lunge': {
        const progress = 1 - enemy.timer / (enemy.shielded ? SHIELD_CHARGE_TIME : .45);
        const pace = T.MathUtils.smoothstep(progress,0,.18) * (1 - T.MathUtils.smoothstep(progress,.78,1));
        const next = from.clone().addScaledVector(enemy.aim,enemy.shielded ? dt * 6.8 * pace : Math.min(Math.max(0,distance - .85),dt * 5 * pace));
        if(enemy===this.enemies[1]&&next.distanceToSquared(from)>.000001){
          const contact=this.chargePillarContact(from,enemy.aim,from.distanceTo(next));
          if(contact){
            from.copy(contact);enemy.phase='dazed';enemy.timer=KNIGHT_PILLAR_STUN_TIME;enemy.path=[];
            this.say('pillarDazed','drop');break;
          }
        }
        if (next.distanceTo(enemy.home) <= 14 && this.knightClear(from,next)) from.copy(next);
        const dx = p.x - from.x, dz = p.z - from.z, reach = Math.hypot(dx,dz);
        if (reach < 1.3 && dx * enemy.aim.x + dz * enemy.aim.z > reach * .3 && p.y < 1.6 && this.clearSight(from)) {
          this.hurt(); if (enemy.phase !== 'lunge') return;
        }
        if (enemy.timer <= 0) { enemy.phase = 'rest'; enemy.timer = enemy.shielded ? 3 : 2.6; if (enemy.shielded && distance < 10) this.say('counterHint'); }
        break;
      }
      case 'rest': case 'stun': case 'dazed':
        if (enemy.timer <= 0) {
          if(enemy.phase==='dazed'&&this.message==='pillarDazed')this.messageUntil=this.time;
          enemy.phase = 'chase'; enemy.timer = .15; enemy.path = []; enemy.repath = 0;
        }
        break;
    }
    enemy.speed = dt ? Math.hypot(from.x - beforeX,from.z - beforeZ) / dt : 0;
    enemy.alert = T.MathUtils.lerp(enemy.alert,enemy.phase !== 'return' && (visible || enemy.phase !== 'idle') ? 1 : 0,1 - Math.exp(-dt * 7));
    enemy.block = Math.max(0,enemy.block - dt);
    animateDarkKnight(enemy.mesh,enemy.phase,enemy.shielded,this.time,dt,this.reducedMotion,enemy);
  }
  updateEnemies(dt: number) {
    const p = this.body.translation();
    const boss=this.enemies[2],pollen=this.sneezeFlowers.update(dt,this.time,this.reducedMotion,boss.mesh,boss.hp>0);
    if(pollen==='puff')this.audio.play('flow',1.2);
    if(pollen==='hit'){this.guardian.reactToPollen(boss,p);this.say('coreOpeningHint');}
    for (const enemy of this.enemies) {
      const knight = enemy !== this.enemies[2];
      if (enemy.hp <= 0) {
        if (knight && enemy.timer > 0) {
          enemy.timer = Math.max(0, enemy.timer - dt); enemy.speed = 0;
          animateDarkKnight(enemy.mesh, 'stun', enemy.shielded, this.time, dt, this.reducedMotion, enemy);
          enemy.mesh.visible = enemy.timer > 0;
        } else if(!knight) {this.guardian.update(enemy,p,dt,this.time,this.reducedMotion,(from,to)=>this.knightClear(from,to));}
        else enemy.mesh.visible = false;
        enemy.ring.visible = false; continue;
      }
      if (knight) this.updateKnight(enemy,dt);
      else {
        const before=enemy.phase,coreWasExposed=this.guardian.coreExposed;
        if(this.guardian.update(enemy,p,dt,this.time,this.reducedMotion,(from,to)=>this.knightClear(from,to)))this.hurt();
        if(!coreWasExposed&&this.guardian.coreExposed)this.say('flowerOpening','bloom');
        if(before==='warn'&&enemy.phase==='lunge')this.audio.play('drop');
        if(before==='lunge'&&enemy.phase==='rest')this.say('bossSwordOpening');
      }
      enemy.ring.visible = knight ? enemy.phase === 'warn' || enemy.phase === 'rest' || enemy.phase === 'dazed' : enemy.phase === 'rest'||enemy.phase==='dazed';
      enemy.ring.material.color.set(enemy.phase === 'dazed' ? '#ffe08a' : enemy.phase === 'rest' ? '#9bead5' : '#e99a48');
      enemy.ring.position.copy(enemy.mesh.position); enemy.ring.position.y = .11; enemy.ring.scale.setScalar(enemy.maxHp === 3 ? 1.8 : 1.7);
    }
  }
  step() {
    this.time += STEP; this.cooldown = Math.max(0, this.cooldown - STEP); this.invulnerable = Math.max(0, this.invulnerable - STEP);
    if (this.chestOpened) this.chestProgress = this.reducedMotion ? 1 : Math.min(1, this.chestProgress + STEP / 1.2);
    this.windTime = Math.max(0, this.windTime - STEP);
    this.dodgeCooldown = Math.max(0,this.dodgeCooldown - STEP); this.dodgeProtection = Math.max(0,this.dodgeProtection - STEP);
    const dodging = this.dodgeTime > 0; this.dodgeTime = Math.max(0,this.dodgeTime - STEP);
    let x = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) + this.stick.x;
    let z = Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) + this.stick.y;
    const length = Math.hypot(x, z); if (length > 1) { x /= length; z /= length; }
    const velocity = this.body.linvel(), p = this.body.translation(); this.previous.copy(p);
    const ray = new R.Ray({ x: p.x, y: p.y - .57, z: p.z }, { x: 0, y: -1, z: 0 });
    this.grounded = !!this.world.castRay(ray, .24, true, undefined, undefined, undefined, this.body) && velocity.y < 1;
    this.coyote = this.grounded ? .11 : Math.max(0, this.coyote - STEP);
    this.jumpBuffer = this.jumpRequested ? .13 : Math.max(0, this.jumpBuffer - STEP); this.jumpRequested = false;
    this.jumpCooldown = Math.max(0, this.jumpCooldown - STEP);
    let vy = velocity.y;
    if (!dodging && this.jumpBuffer > 0 && this.coyote > 0 && this.jumpCooldown === 0) { vy = 8; this.coyote = this.jumpBuffer = 0; this.jumpCooldown = .34; this.audio.play('jump'); }
    const blend = acceleration(this.grounded, STEP);
    let vx = T.MathUtils.lerp(velocity.x, x * movement.speed, blend);
    let vz = T.MathUtils.lerp(velocity.z, z * movement.speed, blend);
    if (dodging) {
      const elapsed = DODGE_DURATION - this.dodgeTime;
      const enter = T.MathUtils.smoothstep(elapsed,0,DODGE_ACCEL), exit = T.MathUtils.smoothstep(elapsed,DODGE_DURATION-DODGE_DECEL,DODGE_DURATION);
      vx = T.MathUtils.lerp(T.MathUtils.lerp(this.dodgeStartVelocity.x,this.dodgeDirection.x*DODGE_SPEED,enter),x*movement.speed,exit);
      vz = T.MathUtils.lerp(T.MathUtils.lerp(this.dodgeStartVelocity.y,this.dodgeDirection.y*DODGE_SPEED,enter),z*movement.speed,exit);
      const next = {x:p.x+vx*STEP,z:p.z+vz*STEP};
      if (this.encounterGateBlocks(next.x,next.z,.4) || ![-.4,.4].every(dx => [-.4,.4].every(dz => walkable(next.x+dx,next.z+dz,this.bridgeOpen,this.key,this.exitOpen)))) vx = vz = 0;
    }
    this.body.setLinvel({ x: vx, y: vy, z: vz }, true);
    if (length > .1) this.heading = Math.atan2(-x, -z);
    this.world.step();
    const footfall = Math.floor(this.gait / Math.PI); this.gait += Math.hypot(velocity.x, velocity.z) * STEP * movement.gait;
    if (this.grounded && Math.floor(this.gait / Math.PI) !== footfall && length > .1) this.audio.footstep(false);
    if (this.bridgeOpening && !this.bridgeOpen) {
      this.bridgeProgress = Math.min(1, this.bridgeProgress + STEP / 1.4);
      if (this.bridgeProgress === 1) { this.bridgeOpen = true; this.bridgeBody.setEnabled(false); this.bridgeSurface.setEnabled(true); this.checkpoint = at('practice'); this.checkpoint.z += 5; this.say('bridgeLowered', 'gate'); }
    }
    this.bridgeHintTime = Math.max(0, this.bridgeHintTime - STEP);
    this.bridgeRevealTime = Math.max(0, this.bridgeRevealTime - STEP);
    if (!this.near('bridge', 14)) this.bridgeRevealTime = 0;
    const bridge = at('bridge'), pBridge = this.body.translation();
    const approachingMill = !this.bridgeOpen && !this.bridgeOpening && this.near('windmill', 9)
      && pBridge.x < bridge.x - 2.5 && Math.abs(pBridge.z - bridge.z) < 5;
    if (approachingMill) {
      if (!this.bridgeHintShown) { this.bridgeHintShown = true; this.bridgeHintTime = 3.4; this.say(this.wand ? 'bridgeNotice' : 'windNeeded', 'hint'); }
      this.bridgeWaitTime += STEP;
      if (this.bridgeWaitTime >= 8 && this.wand && !this.bridgeHelpShown) { this.bridgeHelpShown = true; this.say('bridgeWindHint', 'hint'); }
    } else { this.bridgeWaitTime = 0; this.bridgeHintTime = 0; }
    if (this.bridgeOpen && !this.bridgeCrossed && pBridge.x > bridge.x + 3.2 && this.near('bridge', 12)) {
      this.bridgeCrossed = true; if (this.practiceEnemies.some(enemy => enemy.hp > 0)) this.say('practiceGate', 'hint');
    }
    if (this.bridgeOpen && this.near('checkpoint', 3)) this.checkpoint = at('checkpoint');
    this.updateEnemies(STEP);
    if (this.practiceEnemies.every(enemy => enemy.hp === 0 && enemy.timer === 0) && this.encounterGateProgress < 1) {
      if (this.encounterGateProgress === 0) this.say('practiceCleared', 'gate');
      this.encounterGateProgress = Math.min(1, this.encounterGateProgress + STEP / (this.reducedMotion ? .4 : 1.3));
      if (this.encounterGateProgress === 1) this.encounterGate.body.setEnabled(false);
    }
    if (this.exitOpen && this.near('finish', 2.1)) { this.state = 'qualified'; this.clearInput(); this.audio.music.pause(); this.say('won', 'win'); }
    if (this.body.translation().y < -4) { this.hearts = 1; this.invulnerable = this.dodgeProtection = 0; this.hurt(); }
  }
  updateUI() {
    const target = this.target();
    const bossOpening=this.enemies[2].hp>0&&this.enemies[2].phase==='dazed'&&!this.guardian.coreExposed;
    const bossExposed=this.enemies[2].hp>0&&this.enemies[2].phase==='dazed'&&this.guardian.coreExposed&&Math.hypot(this.player.position.x-this.enemies[2].mesh.position.x,this.player.position.z-this.enemies[2].mesh.position.z)<=10&&this.clearSight(this.enemies[2].mesh.position);
    const flowerTarget=target?.spot==='sneezeFlower';
    const flowerBusy=target?.action==='flowerSneezing'||target?.action==='flowerResting'||target?.action==='flowerSpent';
    const threat = this.active() && this.enemies.find(e => e.hp > 0 && e.shielded && this.player.position.distanceTo(e.mesh.position) < 11 && this.clearSight(e.mesh.position) && ['warn','lunge','rest','dazed'].includes(e.phase));
    const warning = threat && (threat.phase === 'warn' || threat.phase === 'lunge');
    const cue = this.boatTrip ? 'sailing' : bossOpening ? 'coreOpeningHint' : bossExposed ? 'flowerOpening' : flowerTarget ? target.action==='blowFlower'?'flowerHint':target.action==='lureGuardian'?'flowerLureHint':target.action==='flowerSneezing'?'flowerWindup':target.action==='flowerSpent'?'flowerSpentHint':'flowerRestingHint' : threat===this.enemies[2] ? warning ? 'bossSwordWarning' : 'bossSwordOpening' : threat ? warning ? this.dodgeCooldown <= 0 ? this.chargePillarReady ? 'pillarReady' : 'dodgeHint' : 'dodgeMove' : threat.phase === 'dazed' ? 'pillarDazed' : 'counterHint' : this.time < this.messageUntil ? this.message : this.objective();
    this.dodgeButton.disabled = !this.active() || this.dodgeCooldown > 0;
    this.dodgeButton.classList.toggle('action-required',!!warning && this.dodgeCooldown <= 0);
    this.root.querySelector('#dive')!.classList.toggle('action-required',!bossOpening&&!flowerBusy&&(bossExposed||target?.action==='blowFlower'||!!threat && !warning || target?.action === 'blowWindmill' && this.bridgeHelpShown || target?.spot === 'pinwheel' && !this.pinwheelPracticed));
    this.dodgeButton.style.setProperty('--dodge-ready',`${(1-this.dodgeCooldown/DODGE_COOLDOWN)*100}%`);
    const cooldownLabel = this.dodgeCooldown > 0 ? `${this.dodgeCooldown.toFixed(1)}s` : '';
    this.dodgeButton.querySelector('small')!.textContent = cooldownLabel;
    this.dodgeButton.setAttribute('aria-label',`${mt('dodge')}${cooldownLabel ? ' '+cooldownLabel : ''}`);
    this.enemyBars.forEach((bar,index) => {
      const enemy = this.enemies[index],boss=index===2,point = enemy.mesh.position.clone().add(new T.Vector3(0,1.58,0)).project(this.camera);
      bar.hidden = !this.active() || enemy.hp <= 0 || this.player.position.distanceTo(enemy.mesh.position) > 14 || !this.clearSight(enemy.mesh.position)
        || (!boss&&(Math.abs(point.x) > .94 || Math.abs(point.y) > .9 || Math.abs(point.z) > 1));
      if(!bar.hidden&&boss)bar.style.top=`${Math.max(92,(this.root.querySelector('.guidance')?.getBoundingClientRect().bottom??80)+10)}px`;
      if (!bar.hidden&&!boss) { bar.style.left = `${(point.x + 1) * innerWidth / 2}px`; bar.style.top = `${(1 - point.y) * innerHeight / 2}px`; }
      if (bar.dataset.hp !== String(enemy.hp)) {
        const damaged = enemy.hp < Number(bar.dataset.hp ?? enemy.hp);
        bar.classList.toggle('health-hit',damaged); bar.classList.toggle('health-reset',!damaged);
        bar.dataset.hp = String(enemy.hp); bar.setAttribute('aria-valuenow',String(enemy.hp));
        bar.setAttribute('aria-valuetext',`${enemy.hp}/${enemy.maxHp}`);
        bar.querySelector<HTMLElement>('i')!.style.width = `${enemy.hp / enemy.maxHp * 100}%`;
        bar.querySelector<HTMLElement>('em')!.style.width = `${enemy.hp / enemy.maxHp * 100}%`;
        if(boss)bar.querySelector('small')!.textContent=`${enemy.hp} / ${enemy.maxHp}`;
      }
    });
    this.ui.updatePuzzle(this.state, this.paused, this.muted, mt(cue), Number(this.key), mt(this.boatTrip ? 'dockBoat' : this.gardenQuest.stage === 'handoff' ? 'giveTools' : this.gardenQuest.stage === 'planting' ? 'plantSeedling' : bossOpening ? 'coreOpening' : target?.action ?? (this.gardenQuest.stage === 'moving' ? 'pushCart' : this.wand ? bossExposed?'blowCore':'blow' : 'inspect')), !!this.dialogue || this.chestQuiz.open || this.gardenerStory.active || this.gardenQuest.busy);
    if(this.boatTrip) { this.root.querySelector<HTMLButtonElement>('#jump')!.disabled=true;this.root.querySelector<HTMLButtonElement>('#hint')!.disabled=true; }
    this.root.classList.toggle('gardener-cinematic', this.gardenerStory.active && !this.paused);
    if (target?.action === 'chestOpening' || target?.action === 'takingCrystal' || target?.action === 'bridgeLowering') this.root.querySelector<HTMLButtonElement>('#dive')!.disabled = true;
    if(flowerBusy||bossOpening)this.root.querySelector<HTMLButtonElement>('#dive')!.disabled=true;
    this.root.querySelector<HTMLButtonElement>('#maze-next')!.disabled = !!this.dialogue?.gardenerIntro && !this.gardenerStory.canAdvance;
    this.root.querySelector<HTMLAnchorElement>('.level-link')!.hidden = true;
    const mode = this.paused ? 'paused' : this.state;
    if (mode !== this.uiMode) {
      this.uiMode = mode;
      if (mode !== 'racing') {
        this.root.querySelector('#menu-title')!.textContent = mt(mode === 'ready' ? 'ready' : mode === 'qualified' ? 'won' : 'rest');
        this.root.querySelector('#menu-description')!.textContent = mt(mode === 'ready' ? 'intro' : mode === 'qualified' ? 'wonDescription' : 'rest');
        this.root.querySelector('#menu-tips')!.innerHTML = `<span>❀<small>${mt('explore')}</small></span><span>✧<small>${mt('magic')}</small></span><span>⚿<small>${mt('key')}</small></span>`;
      }
    }
    const status = `${this.hearts}:${this.wand}:${this.tools}:${this.key}:${this.treasure}:${this.gardenQuest.returned}`;
    if (status !== this.hudState) {
      this.hudState = status;
      const hearts = this.root.querySelector('#maze-hearts')!; hearts.textContent = '♥'.repeat(this.hearts) + '♡'.repeat(3 - this.hearts); hearts.setAttribute('aria-label', `${mt('health')} ${this.hearts}/3`);
      this.root.querySelector('#maze-item')!.textContent = this.key ? `⚿ ${mt('key')}` : this.treasure ? `◆ ${mt('badge')}` : this.wand ? `✧ ${mt('magic')}` : this.tools ? `❀ ${mt('tools')}` : this.gardenQuest.returned ? mt('plantSeedling') : mt('explore');
    }
    this.root.querySelector('#finished')!.textContent = `${Number(this.key)} / 1`;
    this.dialogueBox.hidden = !this.dialogue || this.paused;
    this.root.querySelector<HTMLElement>('.maze-inventory')!.hidden = this.state !== 'racing' || this.paused;
    this.updateRouteMarker();
    this.ring.visible = this.active() && !!target;
    if (target) { const p = target.spot === 'sneezeFlower' ? this.sneezeFlowers.nearby(this.body.translation())!.root.position : target.spot === 'boss' ? this.keyMesh.position : target.spot === 'scout' ? this.scout.position : target.spot === 'gardener' ? this.guide.position : target.spot === 'cart' ? this.gardenQuest.pushPoint : target.spot === 'tools' ? this.toolMesh.position : target.spot === 'seedling' ? this.gardenQuest.seedling.position : at(target.spot); this.ring.position.set(p.x, .07, p.z); }
    const bubble = this.guide.position.clone().add(new T.Vector3(0, 1.4, 0)).project(this.camera);
    this.gardenerMutter.hidden = this.state !== 'racing' || this.paused || !!this.dialogue || this.gardenerStory.mutter <= 0 || Math.abs(bubble.x) > .9 || Math.abs(bubble.y) > .9 || bubble.z > 1;
    this.gardenerMutter.style.left = `${(bubble.x + 1) * 50}%`; this.gardenerMutter.style.top = `${(1 - bubble.y) * 50}%`;
  }
  render(dt = 0) {
    if(this.reducedMotion)this.ferryCoast.time.value=0;
    else if(!this.paused&&this.state==='racing'&&!this.dialogue&&!this.chestQuiz.open&&!this.gardenerStory.active&&!this.gardenQuest.busy)this.ferryCoast.time.value+=dt;
    if (this.updateBoat(dt)) dt=0;
    if(!this.boatTrip)this.boat.position.y=FERRY_BOAT_Y+this.ferryCoast.heightAt(this.boat.position.x,this.boat.position.z);
    this.syncBoatDeck();
    this.courtyard.setCleared(this.enemies[1].hp===0);
    this.boat.getObjectByName('wind-sail-crystal')!.visible=this.treasure;
    this.dockMooring.visible=!this.boatTrip&&!this.boatAtBossIsland;this.bossMooring.visible=!this.boatTrip&&this.boatAtBossIsland;
    const p = this.body.translation(); this.player.position.lerpVectors(this.previous, new T.Vector3(p.x, p.y, p.z), Math.min(1, this.accumulator / STEP));
    if (!dt) this.player.position.set(p.x, p.y, p.z);
    const velocity = this.body.linvel();
    if (!this.paused) {
      const near = this.near('scout', 3.5);
      let speed = 0;
      if (this.active() && !this.reducedMotion && !near && dt > 0) {
        this.scoutPatrol += Math.min(dt, .1) * .35;
        const a = this.scoutPatrol, home = at('scout');
        this.scout.position.set(home.x + Math.sin(a), .612, home.z + .6 * (1 - Math.cos(a)));
        const yaw = Math.atan2(-Math.cos(a), -.6 * Math.sin(a));
        this.scout.rotation.y += Math.atan2(Math.sin(yaw - this.scout.rotation.y), Math.cos(yaw - this.scout.rotation.y)) * (1 - Math.exp(-5 * dt));
        speed = .35 * Math.hypot(Math.cos(a), .6 * Math.sin(a));
      }
      animateGardenScout(this.scout, this.time, near, this.reducedMotion, !!this.dialogue && this.dialogueBox.dataset.npc === 'scout', speed);
    }
    if (!['moving', 'handoff', 'planting'].includes(this.gardenQuest.stage)) animateWalk(this.player, this.dialogue ? this.player.rotation.y : this.heading, this.gait, this.active() ? Math.hypot(velocity.x, velocity.z) : 0, this.grounded, this.reducedMotion, dt, this.wand || this.tools);
    if(this.boatTrip)this.player.quaternion.copy(this.boat.quaternion).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI));
    else {this.player.rotation.x=0;this.player.rotation.z=0;}
    if (this.dodgeTime > 0 && !this.reducedMotion) {
      const pose = Math.sin(Math.PI * (1-this.dodgeTime/DODGE_DURATION)), avatar = this.player.getObjectByName('avatar')!;
      const side = this.dodgeDirection.x*Math.cos(this.player.rotation.y)-this.dodgeDirection.y*Math.sin(this.player.rotation.y);
      avatar.rotation.z = T.MathUtils.lerp(avatar.rotation.z,-side*.2,pose);
    }
    this.dodgeAura.visible = this.active() && this.dodgeProtection > 0;
    this.dodgeAura.position.set(p.x,.13,p.z);
    const charging = this.enemies[1];
    this.chargeLane.visible = this.active() && charging.hp > 0 && charging.phase === 'warn';
    this.chargePillarReady=this.chargeLane.visible&&!!this.chargePillarContact(charging.mesh.position,charging.aim,6.8*SHIELD_CHARGE_TIME*.8);
    this.chargeLane.material.color.set(this.chargePillarReady?'#edbf38':'#e99935');
    this.chargeLane.position.set(charging.mesh.position.x,.12,charging.mesh.position.z);
    this.chargeLane.rotation.y = Math.atan2(charging.aim.x,charging.aim.z);
    if (!this.dialogue) setCharacterExpression(this.player, this.state === 'qualified' ? 'happy' : this.gardenQuest.stage === 'moving' ? 'determined' : this.invulnerable > 0 ? 'surprised' : 'neutral');
    this.wandMesh.visible = this.wand;
    // Follow the hand's position while keeping the long staff upright during the carrying pose.
    this.wandMesh.quaternion.copy(this.wandMesh.parent!.quaternion).invert(); this.wandMesh.rotateZ(-.2);
    animateWindWand(this.wandMesh, this.active() && this.wand ? dt : 0, this.windTime, this.reducedMotion);
    this.player.visible = !!this.boatTrip || this.reducedMotion || this.invulnerable <= 0 || Math.floor(this.time * 8) % 2 === 0;
    if (this.state === 'racing' && !this.paused && !this.dialogue && !this.gardenerStory.active) {
      const cue = this.gardenQuest.update(dt, this.reducedMotion, this.player);
      if (cue === 'gardenerThanks') {
        this.wand = true; this.audio.play('key'); this.talk('gardenerName', ['gardenerThanks', 'gardenerAgain']);
      } else if (cue) {
        if (cue === 'wateringFlowers') this.heading = this.player.rotation.y;
        if (cue === 'gardenerFollow') {
          this.heading = this.player.rotation.y;
          this.talk('gardenerName', ['gardenerPlant', 'gardenerFollow']);
        } else this.say(cue, cue === 'wateringFlowers' ? 'water' : 'bloom');
      }
    }
    if (this.active()) {
      this.pinwheelLookTime = Math.max(0, this.pinwheelLookTime - dt);
      if (this.pinwheelPracticed || this.bridgeOpen || !this.near('pinwheel', 14)) this.pinwheelLookTime = 0;
    }
    const portrait = innerWidth < innerHeight, follow = dt === 0 ? 1 : 1 - Math.exp(-5 * dt);
    const focusPlayer = this.player.position;
    this.cameraGoal.set(focusPlayer.x, Math.max(0, focusPlayer.y) * .42 + (portrait ? 11 : 9.4), focusPlayer.z + (portrait ? 18 : 16));
    const lookGoal = new T.Vector3(focusPlayer.x, Math.max(0, focusPlayer.y) * .32 + 1.8, focusPlayer.z - 8);
    if(this.boatTrip) {
      const forward=new T.Vector3(Math.sin(this.boatYaw),0,Math.cos(this.boatYaw));
      this.cameraGoal.copy(focusPlayer).addScaledVector(forward,-(portrait?17:14));this.cameraGoal.y+=portrait?10:8;
      lookGoal.copy(focusPlayer).addScaledVector(forward,7);lookGoal.y+=1;
    }
    if (portrait && this.flowerChoir.performing && this.near('choir', 10)) lookGoal.z += 4;
    const encounter = at('practice');
    if (portrait && this.bridgeOpen && focusPlayer.x > encounter.x - 7.5 && focusPlayer.x < encounter.x + 12.5
      && focusPlayer.z > encounter.z - 7.5 && focusPlayer.z < encounter.z + 17.5) {
      const pan = T.MathUtils.clamp((encounter.x + 5 - focusPlayer.x) * .5, 0, 2.5)
        * T.MathUtils.smoothstep(focusPlayer.x, encounter.x - 6, encounter.x - 2.5);
      this.cameraGoal.x += pan; lookGoal.x += pan;
    }
    if (this.gardenQuest.stage === 'moving') { this.cameraGoal.x += 1.3; lookGoal.x += 1.3; }
    if (this.gardenQuest.stage === 'handoff' || this.dialogue && !this.gardenerStory.active) {
      const npc = this.dialogueBox.dataset.npc === 'scout' && this.dialogue ? this.scout : this.guide;
      lookGoal.copy(npc.position).add(this.player.position).multiplyScalar(.5);
      const side = new T.Vector3(this.player.position.z - npc.position.z, 0, npc.position.x - this.player.position.x);
      if (side.lengthSq() < .01) side.copy(this.camera.position).sub(lookGoal).setY(0);
      if (side.lengthSq() < .01) side.set(1, 0, 0);
      side.normalize(); if (side.dot(this.camera.position.clone().sub(lookGoal)) < 0) side.negate();
      const span = this.player.position.distanceTo(npc.position) + 2;
      const distance = Math.max(portrait ? 8.5 : 5.7, span / (2 * Math.tan(T.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect) * 1.2);
      this.cameraGoal.copy(lookGoal).addScaledVector(side, distance); this.cameraGoal.y += 2.8;
    } else if (['planting', 'watering'].includes(this.gardenQuest.stage)) {
      lookGoal.copy(this.gardenQuest.bed.position).add(new T.Vector3(-1.8, .6, .8));
      this.cameraGoal.copy(lookGoal).add(new T.Vector3(portrait ? 7.5 : 5.5, 3.5, portrait ? 4.5 : 3.2));
    }
    if (dt > 0 && this.active() && this.grounded && this.dodgeTime <= 0 && !this.cartHintShown
      && this.gardenQuest.stage === 'search' && !this.tools && !this.wand
      && p.z <= at('cart').z + 4 && this.near('cart', 12)) {
      this.cartHintShown = true; this.cartHintTime = 6; this.say('cartNotice', 'hint');
    }
    if (this.cartHintTime > 0) {
      if (!this.paused && (!this.active() || !this.near('cart', 16))) this.cartHintTime = 0;
      else if (this.active()) this.cartHintTime = Math.max(0, this.cartHintTime - dt);
      if (!this.reducedMotion && this.cartHintTime > 0) {
        const elapsed = 6 - this.cartHintTime;
        const weight = T.MathUtils.smoothstep(elapsed, .35, 1.1) * (1 - T.MathUtils.smoothstep(elapsed, 4.25, 6));
        const push = T.MathUtils.smoothstep(elapsed, 1.5, 2.7);
        const cartLook = this.gardenQuest.cart.position.clone().add(new T.Vector3(-.3, .65, .7));
        const axis = this.cameraGoal.clone().sub(lookGoal).normalize();
        const overviewLook = lookGoal.clone().lerp(cartLook, .45);
        const overviewCamera = this.cameraGoal.clone().add(overviewLook.clone().sub(lookGoal));
        overviewCamera.addScaledVector(overviewCamera.clone().sub(overviewLook), portrait ? .45 : .15);
        overviewLook.lerp(cartLook, push);
        overviewCamera.lerp(cartLook.clone().addScaledVector(axis, portrait ? 16 : 9), push);
        this.cameraGoal.lerp(overviewCamera, weight); lookGoal.lerp(overviewLook, weight);
      }
    }
    const practiceShot = this.pinwheelLookTime > 0;
    const flowerFocus=this.sneezeFlowers.active?.flower??this.sneezeFlowers.nearby(p),boss=this.enemies[2];
    const flowerShot=portrait&&this.wand&&!this.boatTrip&&boss.hp>0&&focusPlayer.distanceTo(boss.mesh.position)<32&&(!!flowerFocus||boss.phase==='dazed');
    if (flowerShot || !this.reducedMotion && (practiceShot || this.bridgeHintTime > 0 || this.bridgeRevealTime > 0)) {
      const remaining = practiceShot ? this.pinwheelLookTime : Math.max(this.bridgeHintTime, this.bridgeRevealTime), elapsed = 3.4 - remaining;
      const weight = flowerShot?1:T.MathUtils.smoothstep(elapsed, 0, .7) * T.MathUtils.smoothstep(remaining, 0, .9);
      const bounds = flowerShot?new T.Box3().setFromObject(this.player).expandByObject(boss.mesh):practiceShot ? new T.Box3().setFromObject(this.gardenQuest.pinwheel) : new T.Box3().setFromObject(this.bridgeDeck).expandByObject(this.mill);
      if(flowerShot&&flowerFocus)bounds.expandByObject(flowerFocus.root);
      bounds.expandByPoint(focusPlayer.clone().add(new T.Vector3(-.7, -.65, -.7)));
      bounds.expandByPoint(focusPlayer.clone().add(new T.Vector3(.7, 1, .7)));
      const shotLook = bounds.getCenter(new T.Vector3());
      if (!flowerShot && !practiceShot && this.bridgeRevealTime > 0) shotLook.x += (this.bridgeProgress - .5) * 1.4;
      const axis = new T.Vector3(0, .55, 1).normalize(), right = new T.Vector3(1, 0, 0), up = new T.Vector3().crossVectors(axis, right);
      const tanY = Math.tan(T.MathUtils.degToRad(this.camera.fov / 2)), tanX = tanY * this.camera.aspect;
      let distance = 0;
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const point = new T.Vector3(x, y, z).sub(shotLook), depth = point.dot(axis);
        distance = Math.max(distance, depth + Math.abs(point.dot(right)) / (tanX * .8), depth + Math.abs(point.dot(up)) / (tanY * .7));
      }
      this.cameraGoal.lerp(shotLook.clone().addScaledVector(axis, Math.max(13, distance + 1)), weight);
      lookGoal.lerp(shotLook, weight);
    }
    if (!this.gardenerStory.active && !this.paused) { this.camera.position.lerp(this.cameraGoal, follow); this.cameraLook.lerp(lookGoal, follow); }
    if (!this.gardenQuest.returned) this.gardenerStory.update(dt, this.paused, this.reducedMotion, this.active(), this.cameraGoal, lookGoal);
    this.camera.lookAt(this.cameraLook); this.camera.updateMatrixWorld();
    const toPlayer = (this.gardenerStory.active ? this.cameraLook.clone() : focusPlayer.clone().add(new T.Vector3(0, .4, 0))).sub(this.camera.position), ray = new T.Ray(this.camera.position, toPlayer.clone().normalize()), hit = new T.Vector3();
    const focus = !this.reducedMotion && practiceShot ? this.gardenQuest.pinwheel.position.clone().add(new T.Vector3(0, 1.65, .1))
      : !this.reducedMotion && (this.bridgeHintTime > 0 || this.bridgeRevealTime > 0) ? this.mill.position.clone().add(new T.Vector3(0, 2.5, .86))
      : this.gardenQuest.stage === 'moving' || (this.cartHintTime > 0 && !this.reducedMotion) ? this.gardenQuest.cart.position.clone().add(new T.Vector3(1, 1, 0))
      : this.gardenQuest.stage === 'plant' && this.target()?.spot === 'seedling' ? this.gardenQuest.seedling.position.clone().setY(.07) : undefined;
    const toFocus = focus?.sub(this.camera.position), focusRay = toFocus ? new T.Ray(this.camera.position, toFocus.clone().normalize()) : undefined;
    for (const wall of this.walls) {
      const blocked = (ray.intersectBox(wall.bounds, hit) && this.camera.position.distanceTo(hit) < toPlayer.length())
        || (focusRay?.intersectBox(wall.bounds, hit) && this.camera.position.distanceTo(hit) < toFocus!.length());
      wall.mesh.material.opacity = T.MathUtils.lerp(wall.mesh.material.opacity, blocked ? .16 : 1, dt ? 1 - Math.exp(-dt * 12) : 1);
      wall.mesh.material.depthWrite = wall.mesh.material.opacity > .9;
    }
    const actor = this.player.position.clone().add(new T.Vector3(0, .4, 0)).sub(this.camera.position);
    ray.set(this.camera.position, actor.clone().normalize());
    for (const building of this.buildingOccluders) {
      let blocked = !!ray.intersectBox(building.bounds, hit) && this.camera.position.distanceTo(hit) < actor.length();
      // Open arches and rotundas should fade only when stone actually covers the player.
      if (blocked && building.object.name.startsWith('wind-garden-')) {
        this.cameraOcclusion.set(ray.origin,ray.direction); this.cameraOcclusion.far = actor.length();
        blocked = this.cameraOcclusion.intersectObject(building.object,true).length > 0;
      }
      if(blocked&&building.opaqueMeshes) {
        this.cameraOcclusion.set(ray.origin,ray.direction);this.cameraOcclusion.far=actor.length();
        blocked=this.cameraOcclusion.intersectObjects(building.opaqueMeshes,false).length>0;
      }
      building.opacity = T.MathUtils.lerp(building.opacity, blocked ? .16 : 1, dt ? 1 - Math.exp(-dt * 12) : 1);
      for (const layer of building.materials) {
        layer.material.opacity = layer.opacity * building.opacity;
        layer.material.depthWrite = layer.depthWrite && building.opacity > .9;
      }
    }
    this.bridgeDeck.rotation.z = (1 - T.MathUtils.smoothstep(this.bridgeProgress, 0, 1)) * 1.15;
    this.bridgeDrive.getObjectByName('bridge-drive-wheel')!.rotation.z = -this.bridgeProgress * Math.PI * 4;
    this.millCue.visible = this.active() && this.bridgeHintShown && !this.bridgeOpening && !this.bridgeOpen && this.near('windmill', 9);
    this.millCue.scale.setScalar(this.reducedMotion ? 1 : 1 + Math.sin(this.time * 2) * .06);
    this.pinwheelCue.visible = this.active() && this.wand && !this.pinwheelPracticed && !this.bridgeOpen && this.near('pinwheel', 12);
    const gateProgress = this.encounterGateProgress, gateSwing = T.MathUtils.smoothstep(gateProgress, 0, 1) * Math.PI / 2;
    this.encounterGate.mesh.getObjectByName('ruins-gate-left')!.rotation.y = gateSwing;
    this.encounterGate.mesh.getObjectByName('ruins-gate-right')!.rotation.y = -gateSwing;
    this.encounterGate.mesh.getObjectByName('ruins-gate-seal')!.scale.setScalar(1 - T.MathUtils.smoothstep(gateProgress, 0, .28));
    this.encounterCrest.visible = this.encounterTrail.visible = gateProgress > 0;
    this.encounterTrail.position.set(0, this.reducedMotion ? 0 : Math.sin(gateProgress * Math.PI) * .65, -gateProgress * 2);
    this.bridgeWater.time.value = this.reducedMotion ? 0 : this.time;
    if (this.active()) this.mill.getObjectByName('rotor')!.rotation.z += dt * (this.bridgeOpening ? 3 : .18);
    this.shortcut.mesh.position.y = T.MathUtils.lerp(this.shortcut.mesh.position.y, this.key ? -4 : 0, dt ? 1 - Math.exp(-dt * 4) : 1);
    this.exit.mesh.position.y = T.MathUtils.lerp(this.exit.mesh.position.y, this.exitOpen ? -4 : 0, dt ? 1 - Math.exp(-dt * 4) : 1);
    if (!this.paused) animateTreasureChest(this.chest, this.chestProgress, this.treasure, this.time, this.reducedMotion);
    this.updateCrystalPickup(dt);
    this.keyMesh.rotation.y = this.time; this.keyMesh.position.y = 1.1 + (this.reducedMotion ? 0 : Math.sin(this.time * 2) * .12);
    animateWoodWindChime(this.woodWindChime, this.time, this.reducedMotion);
    this.wind.update(this.windTime, this.windOrigin, this.windTarget, this.reducedMotion, this.windHit);
    this.sun.target.position.set(this.cameraLook.x, 0, this.cameraLook.z);
    this.sun.position.set(this.cameraLook.x - 28, 42, this.cameraLook.z + 22);
    this.audio.setCombat(this.state === 'racing' && !this.boatTrip && this.enemies.some(enemy => enemy.hp > 0 && enemy.phase !== 'idle' && enemy.phase !== 'return'));
    this.flowerChoir.update(dt, this.active(), Math.hypot(p.x - at('choir').x, p.z - at('choir').z), this.settings, this.reducedMotion);
    this.audio.music.volume = this.flowerChoir.ducking ? .035 : window.speechSynthesis?.speaking ? .07 : .22;
    this.leafChannelWater.update(this.ferryCoast.time.value,this.reducedMotion);
    this.courtyardAmbience.update(this.ferryCoast.time.value,this.reducedMotion);
    this.meadow.update(this.ferryCoast.time.value,this.reducedMotion,this.camera.position);
    this.updateUI(); this.updateDialogueReaction(dt); this.renderer.render(this.scene, this.camera);
  }
  resize() { this.renderer.setSize(innerWidth, innerHeight); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
  tick(now: number) {
    const dt = Math.min((now - (this.last || now)) / 1000, .05); this.last = now;
    if (this.active()) { this.accumulator += dt; while (this.accumulator >= STEP) { this.step(); this.accumulator -= STEP; } }
    else { this.accumulator = 0; this.previous.copy(this.body.translation()); }
    this.render(dt); requestAnimationFrame(time => this.tick(time));
  }
}




