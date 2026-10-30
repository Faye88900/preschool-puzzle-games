import './maze.css';
import * as T from 'three';
import R from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bean, mat, orb } from './models';
import { rounded, gardenFlower, gardenFlowerBed, colorFlower } from './puzzle-art';
import { movement, acceleration, animateWalk } from './movement';
import { setCharacterExpression } from './character';
import { createGardener } from './gardener';
import { createPottingWorkbench } from './potting-workbench';
import { createFlowerCart } from './flower-cart';
import { createBirdhouse } from './birdhouse';
import { createStoneWell } from './stone-well';
import { createVineTrellis } from './vine-trellis';
import { createWoodWindChime, animateWoodWindChime } from './wood-wind-chime';
import { createGardenShadeTree } from './garden-shade-tree';
import { createMossyStump } from './mossy-stump';
import { createGardenBirdbath } from './garden-birdbath';
import { createGardenSongbird } from './garden-songbird';
import { createTreeBench, treeBenchColliders } from './tree-bench';
import { createPergolaRestNook, pergolaRestNookColliders } from './pergola-rest-nook';
import { createWindLeafWaymarker, windLeafWaymarkerColliders } from './wind-leaf-waymarker';
import { createFlowerbedBorder, flowerbedBorderColliders } from './flowerbed-edging';
import { createGardenGate, createGardenBridge } from './plaza-mechanisms';
import { createBridgeWater } from './bridge-water';
import { animateWindWand } from './wind-wand';
import { createWindEffect } from './wind-effect';
import { createDarkKnight, animateDarkKnight, KNIGHT_DEATH_TIME, type KnightPhase } from './dark-knight';
import { createWellGardenDetails, wellGardenPots } from './well-garden-details';
import { GardenerStory } from './gardener-story';
import { GardenerQuest } from './gardener-quest';
import { UI } from './ui';
import { PuzzleAudio, type PuzzleSound } from './puzzle-audio';
import { readSettings, saveSettings } from './settings';
import { language, t } from './i18n';
import { at, maze, position, CELL, COLS, ROWS, walkable, type SpotName } from './maze-map';
import { mt, type MazeText } from './maze-text';
import { createMazeGround } from './maze-ground';
import { createMazeIsland } from './maze-island';
import { createFirstEncounterRuins } from './first-encounter-ruins';
import { windmill, windWand, leafMonster, treasureChest, gardenTools, goldKey, gardener, gardenerYard, signpost } from './maze-art';

type Enemy = { mesh: T.Group; home: T.Vector3; hp: number; maxHp: number; shielded: boolean; phase: KnightPhase; timer: number; aim: T.Vector3; ring: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>; patrol: number; speed: number; alert: number; block: number; lastSeen: T.Vector3; memory: number; path: T.Vector3[]; repath: number };
type Gate = { mesh: T.Group; body: R.RigidBody };
const STEP = movement.step;
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
  audio!: PuzzleAudio;
  models = new Map<string, T.Group>();
  walls: { mesh: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>; bounds: T.Box3 }[] = [];
  encounterObstacles: T.Box3[] = [];
  buildingOccluders: { bounds: T.Box3; opacity: number; materials: { material: T.Material; opacity: number; depthWrite: boolean }[] }[] = [];
  enemies: Enemy[] = [];
  keys = new Set<string>();
  stick = { x: 0, y: 0 };
  previous = new T.Vector3();
  cameraLook = new T.Vector3();
  cameraGoal = new T.Vector3();
  checkpoint = at('spawn');
  state = 'ready'; paused = false; time = 0; last = 0; accumulator = 0;
  heading = 0; gait = 0; grounded = true; jumpRequested = false; coyote = 0; jumpBuffer = 0; jumpCooldown = 0;
  quest = false; tools = false; wand = false; bridgeOpen = false; bridgeOpening = false; bridgeProgress = 0;
  key = false; treasure = false; exitOpen = false; hearts = 3; invulnerable = 0; cooldown = 0;
  settings = readSettings();
  reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  toolMesh = gardenTools(); wandMesh = windWand(); mill = windmill(); chest = treasureChest(); keyMesh = goldKey();
  woodWindChime = createWoodWindChime();
  bridgeDeck = new T.Group(); bridgeBody!: R.RigidBody; shortcut!: Gate; exit!: Gate;
  bridgeWater = createBridgeWater();
  guide = createGardener(); scout = gardener();
  gardenerStory!: GardenerStory;
  gardenQuest!: GardenerQuest;
  ring = new T.Mesh(new T.RingGeometry(.8, 1, 32), new T.MeshBasicMaterial({ color: '#ffe58c', side: T.DoubleSide, transparent: true, depthWrite: false }));
  wind = createWindEffect(); windTime = 0; windHit = false; windTarget = new T.Vector3(); windOrigin = new T.Vector3();
  dialogue?: { lines: MazeText[]; index: number; gardenerIntro: boolean };
  message: MazeText = 'safe'; messageUntil = 0; uiMode = ''; hudState = '';
  root!: HTMLElement; dialogueBox!: HTMLElement; gardenerMutter!: HTMLElement;
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
    this.audio = new PuzzleAudio();
    const [ground] = await Promise.all([createMazeGround(this.renderer), this.loadModels(), this.audio.load()]);
    this.scene.add(ground, createMazeIsland());
    this.build();
    const spawn = at('spawn');
    this.body = this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(spawn.x, .8, spawn.z).lockRotations().setLinearDamping(movement.damping).setCcdEnabled(true));
    this.world.createCollider(R.ColliderDesc.capsule(.25, .4).setMass(1).setFriction(movement.friction), this.body);
    this.previous.copy(this.body.translation()); this.player.position.copy(this.previous); this.scene.add(this.player);
    this.wandMesh.position.set(.11, 0, -.015);
    this.player.getObjectByName('arm1')!.add(this.wandMesh);
    this.ring.rotation.x = -Math.PI / 2; this.scene.add(this.ring);
    this.setupUI(); this.bindInput(); this.reset(false); this.resize(); this.render(0);
    document.querySelector('#game')!.setAttribute('aria-label', mt('title'));
    requestAnimationFrame(now => this.tick(now));
  }

  async loadModels() {
    const natureMaterials = new Map<string, T.MeshStandardMaterial>();
    const draco = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}models/draco/`);
    const loader = new GLTFLoader().setDRACOLoader(draco);
    try {
      await Promise.all(['tree-oak-01', 'apple-tree', 'bush-round-01', 'home-cottage-01', 'garden-shed', 'water-pond-01', 'bench-01', 'crate-01', 'barrel-01', 'cattail-reed-clump', 'wheelbarrow', 'terrain-grass-01', 'road-cobble-straight-01', 'streetlamp-01',
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
    building.traverse(node => {
      if (!(node instanceof T.Mesh)) return;
      const copy = (source: T.Material) => {
        if (!copies.has(source)) { const material = source.clone(); material.transparent = true; copies.set(source, material); }
        return copies.get(source)!;
      };
      node.material = Array.isArray(node.material) ? node.material.map(copy) : copy(node.material);
    });
    this.buildingOccluders.push({ bounds: new T.Box3().setFromObject(building).expandByScalar(.25), opacity: 1,
      materials: [...copies].map(([source, material]) => ({ material, opacity: source.opacity, depthWrite: source.depthWrite })) });
  }
  box(parent: T.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
    const mesh = new T.Mesh(rounded(w, h, d, Math.min(.12, h / 3)), mat(color)); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  solid(x: number, y: number, z: number, w: number, h: number, d: number) {
    const body = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x, y, z));
    this.world.createCollider(R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setFriction(.1), body); return body;
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
  dressGarden() {
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
    const trellis = createVineTrellis(); trellis.position.set(well.x - 4.2, 0, well.z - 6.8);
    trellis.scale.setScalar(1.4); this.scene.add(trellis);
    this.solid(trellis.position.x, 1.32, trellis.position.z, 2.62, 2.64, .32);
    const shadeTree = createGardenShadeTree(this.models.get('tree-oak-01')!);
    shadeTree.position.set(well.x - 6.8, 0, well.z - 5.4); shadeTree.scale.setScalar(5.2); this.scene.add(shadeTree);
    const treeBody = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(shadeTree.position.x, 1.3, shadeTree.position.z));
    this.world.createCollider(R.ColliderDesc.cylinder(1.3, .45).setFriction(.1), treeBody);
    const stump = createMossyStump(); stump.position.set(well.x - 6.6, 0, well.z - 2.2);
    stump.scale.setScalar(.55); this.scene.add(stump);
    const stumpBody = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(stump.position.x, .36, stump.position.z));
    this.world.createCollider(R.ColliderDesc.cylinder(.36, .44).setFriction(.1), stumpBody);
    const birdbath = createGardenBirdbath(); birdbath.position.set(well.x + 6.3, 0, well.z - 5.9);
    birdbath.scale.setScalar(1.1); this.scene.add(birdbath);
    const bathBody = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(birdbath.position.x, 0, birdbath.position.z));
    this.world.createCollider(R.ColliderDesc.cylinder(.49, .53).setTranslation(0, .49, 0).setFriction(.1), bathBody);
    this.world.createCollider(R.ColliderDesc.cylinder(.26, .98).setTranslation(0, 1.33, 0).setFriction(.1), bathBody);
    const songbird = createGardenSongbird(); songbird.scale.setScalar(.68); songbird.rotation.y = Math.atan2(-.45, .64);
    songbird.position.copy(birdbath.localToWorld(new T.Vector3(.45, 1.455, -.64))); this.scene.add(songbird);
    shadeTree.getObjectByName('garden-chime-anchor')!.getWorldPosition(this.woodWindChime.position);
    this.woodWindChime.scale.setScalar(1.4); this.scene.add(this.woodWindChime);
    const workbench = createPottingWorkbench(); workbench.position.set(house.x - 11.45, 0, house.z + 2);
    workbench.scale.setScalar(1.6); workbench.rotation.y = Math.PI / 2; this.scene.add(workbench);
    const benchBounds = new T.Box3().setFromObject(workbench), benchSize = benchBounds.getSize(new T.Vector3()), benchCenter = benchBounds.getCenter(new T.Vector3());
    this.solid(benchCenter.x, benchCenter.y, benchCenter.z, benchSize.x, benchSize.y, benchSize.z);
    const flowerCart = createFlowerCart(); flowerCart.position.set(house.x + 1.2, 0, house.z - 5.8);
    flowerCart.scale.setScalar(1.1); this.scene.add(flowerCart);
    const cartBounds = new T.Box3().setFromObject(flowerCart), cartSize = cartBounds.getSize(new T.Vector3()), cartCenter = cartBounds.getCenter(new T.Vector3());
    this.solid(cartCenter.x, cartCenter.y, cartCenter.z, cartSize.x, cartSize.y, cartSize.z);
    for (const [x, z, width] of [
      [well.x - 4.1, well.z - 2.8, 4.8], [well.x + 5.8, well.z - 1.8, 3.5],
    ]) {
      const turf = this.model('terrain-grass-01', x, z, width); turf.name = 'garden-turf';
      turf.scale.y *= .15; turf.position.y = -.06;
    }
    for (const [x, z, width, angle] of [
      [well.x + .3, well.z + 1.5, 1.2, 0], [well.x + 2.3, well.z + 1.5, 1.2, 0],
      [well.x + 4.3, well.z + 1.5, 1.2, 0],
    ]) {
      const paving = this.model('road-cobble-straight-01', x, z, width, angle);
      paving.name = 'garden-stones'; paving.scale.y *= .12; paving.position.y = .019;
    }
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
  dressPlaza() {
    const oak = at('tree'), plaza = new T.Group(), planting = new T.Group();
    plaza.name = 'old-oak-plaza'; planting.name = 'plaza-groundcover'; this.scene.add(plaza); plaza.add(planting);
    const prop = (name: string, dx: number, dz: number, width: number, angle = 0) => {
      const object = this.model(name, oak.x + dx, oak.z + dz, width, angle);
      object.name = 'plaza-' + name; plaza.add(object); return object;
    };
    const tree = createGardenShadeTree(this.models.get('tree-oak-01')!);
    tree.name = 'plaza-old-oak'; tree.position.set(oak.x, 0, oak.z); tree.scale.setScalar(8.2); plaza.add(tree);
    tree.updateMatrixWorld(true);
    const crown = tree.getObjectByName('garden-shade-crown')!; crown.name = 'plaza-oak-crown'; this.trackBuildingOcclusion(crown);
    const chime = createWoodWindChime(); chime.name = 'plaza-wind-chime'; chime.scale.setScalar(1.7);
    tree.getObjectByName('garden-chime-anchor')!.getWorldPosition(chime.position); plaza.add(chime);
    this.solid(oak.x, 1.3, oak.z, 1.5, 2.6, 1.5);
    const bench = createTreeBench(); bench.position.set(oak.x, 0, oak.z); plaza.add(bench);
    const benchBody = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(oak.x, 0, oak.z));
    for (const part of treeBenchColliders) {
      this.world.createCollider(R.ColliderDesc.cuboid(part.width / 2, .4, part.depth / 2).setTranslation(part.x, .4, part.z)
        .setRotation({ x: 0, y: Math.sin(part.angle / 2), z: 0, w: Math.cos(part.angle / 2) }).setFriction(.1), benchBody);
    }
    const nook = createPergolaRestNook(); nook.position.set(oak.x - 14.5, 0, oak.z - 5.6); plaza.add(nook);
    const nookBody = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(nook.position.x, 0, nook.position.z));
    for (const part of pergolaRestNookColliders) {
      this.world.createCollider(R.ColliderDesc.cuboid(part.width / 2, part.height / 2, part.depth / 2)
        .setTranslation(part.x, part.y, part.z).setFriction(.1), nookBody);
    }
    nook.updateMatrixWorld(true); this.trackBuildingOcclusion(nook);
    const waymarker = createWindLeafWaymarker(); waymarker.position.set(oak.x + 9, 0, oak.z - 3.2); plaza.add(waymarker);
    const waymarkerBody = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(waymarker.position.x, 0, waymarker.position.z));
    for (const part of windLeafWaymarkerColliders) {
      this.world.createCollider(R.ColliderDesc.cuboid(part.width / 2, part.height / 2, part.depth / 2)
        .setTranslation(part.x, part.y, part.z).setFriction(.1), waymarkerBody);
    }
    waymarker.updateMatrixWorld(true); this.trackBuildingOcclusion(waymarker);
    const ring = new T.Mesh(new T.RingGeometry(4.1, 6.5, 64), mat('#d9c89e'));
    ring.name = 'plaza-paving-ring'; ring.rotation.x = -Math.PI / 2; ring.position.set(oak.x, .035, oak.z); ring.receiveShadow = true; plaza.add(ring);
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
    for (const [dx, dz, width] of [[-4.4, 1, 4.2], [4.4, 1, 4.2], [-14.2, 8.5, 3.7], [12, 8.5, 3.7]]) {
      const turf = prop('terrain-grass-01', dx, dz, width); turf.scale.y *= .1; turf.position.y = -.055; planting.add(turf);
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
      const mesh = new T.Mesh(mergeGeometries(geometries)!, material); mesh.receiveShadow = true; planting.add(mesh);
      geometries.forEach(geometry => geometry.dispose());
    }
  }
  build() {
    this.solid(0, -.5, 5, COLS * CELL, 1, ROWS * CELL);
    const ruins = createFirstEncounterRuins(), encounter = at('practice');
    const hedgeClearings = (ruins.userData.hedgeClearings as number[][])
      .map(([x0, z0, x1, z1]) => [x0 + encounter.x, z0 + encounter.z, x1 + encounter.x, z1 + encounter.z]);
    const ruinsBorder = (c: number, r: number) => (r === 15 && c >= 16 && c <= 19)
      || (c === 20 && r >= 16 && r <= 20) || (c === 15 && [16, 17, 19, 20].includes(r))
      || (r === 21 && c >= 16 && c <= 19);
    // Only exposed wall cells need meshes; horizontal runs keep draw calls bounded.
    for (let r = 0; r < ROWS; r++) {
      // Past the locked exit, the path opens into lawn instead of another hedge pocket.
      const exposed = (c: number) => !(r >= 9 && r <= 13 && c >= 7 && c <= 9) && !maze[r][c] && [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dc, dr]) => maze[r + dr]?.[c + dc]);
      for (let c = 0; c < COLS; c++) {
        if (!exposed(c)) continue;
        const start = c; while (c + 1 < COLS && exposed(c + 1) && ruinsBorder(c + 1, r) === ruinsBorder(start, r)) c++;
        const p = position((start + c) / 2, r), width = (c - start + 1) * CELL;
        const wallMaterial = new T.MeshStandardMaterial({ color: (start + r) % 2 ? '#52923e' : '#65a547', roughness: .96, transparent: true });
        let pieces = [[p.x - width / 2, p.z - CELL / 2, p.x + width / 2, p.z + CELL / 2]];
        for (const gap of hedgeClearings) {
          pieces = pieces.flatMap(([x0, z0, x1, z1]) => {
            const a = Math.max(x0, gap[0]), b = Math.max(z0, gap[1]), c = Math.min(x1, gap[2]), d = Math.min(z1, gap[3]);
            if (a >= c || b >= d) return [[x0, z0, x1, z1]];
            return [[x0, z0, a, z1], [c, z0, x1, z1], [a, z0, c, b], [a, d, c, z1]]
              .filter(([left, top, right, bottom]) => right - left > .04 && bottom - top > .04);
          });
        }
        const parts = pieces.map(([x0, z0, x1, z1]) => rounded(x1 - x0, 3.25, z1 - z0, Math.min(.4, (x1 - x0) / 3, (z1 - z0) / 3))
          .translate((x0 + x1) / 2 - p.x, 0, (z0 + z1) / 2 - p.z));
        if (parts.length) {
          const wall = new T.Mesh(mergeGeometries(parts)!, wallMaterial); parts.forEach(part => part.dispose());
          wall.position.set(p.x, 1.625, p.z); wall.castShadow = wall.receiveShadow = true; this.scene.add(wall);
          if (ruinsBorder(start, r)) {
            // Cut the backing around whole props; lowering it alone leaves urns and masonry buried.
            wall.name = 'ruins-hedge-base'; wall.scale.y = 1.35 / 3.25; wall.position.y = 1.35 / 2;
          }
          this.walls.push({ mesh: wall, bounds: new T.Box3().setFromObject(wall) });
        }
        this.solid(p.x, 1.7, p.z, width, 3.4, CELL);
      }
    }
    this.dressPlaza();
    const house = at('gardener'); const cottage = this.model('home-cottage-01', house.x - 9, house.z - 4, 6); cottage.name = 'garden-cottage';
    const birdhouse = createBirdhouse(); birdhouse.position.set(house.x - 6.021, 2.2, house.z - 2.6);
    birdhouse.rotation.y = Math.PI / 2; this.scene.add(birdhouse);
    this.dressGarden();
    const shed = this.model('garden-shed', house.x - 8, house.z + 7, 4.2, Math.PI / 2); shed.name = 'garden-shed';
    const shedBounds = new T.Box3().setFromObject(shed);
    const workbenchBounds = new T.Box3().setFromObject(this.scene.getObjectByName('garden-potting-workbench')!);
    shed.position.x += workbenchBounds.min.x - shedBounds.min.x;
    shedBounds.setFromObject(shed);
    const shedSize = shedBounds.getSize(new T.Vector3()), shedCenter = shedBounds.getCenter(new T.Vector3());
    this.solid(shedCenter.x, shedCenter.y, shedCenter.z, shedSize.x, shedSize.y, shedSize.z);
    this.trackBuildingOcclusion(cottage); this.trackBuildingOcclusion(shed);
    this.trackBuildingOcclusion(this.scene.getObjectByName('garden-shade-crown')!);
    this.place(this.guide, 'gardener', .68); this.guide.rotation.y = Math.PI;
    this.place(gardenerYard(), 'gardener');
    this.place(this.scout, 'scout', .8); this.scout.rotation.y = Math.PI; this.scout.scale.setScalar(.85);
    this.model('water-pond-01', at('scout').x + .4, at('scout').z - 2, 3.2);
    this.model('cattail-reed-clump', at('scout').x + 1.1, at('scout').z - 1.3, 1);
    const well = at('tools');
    const stoneWell = createStoneWell(); stoneWell.position.set(well.x + 1.4, 0, well.z - 1.5); this.scene.add(stoneWell);
    const wellBody = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(stoneWell.position.x, .445, stoneWell.position.z));
    this.world.createCollider(R.ColliderDesc.cylinder(.445, .98).setFriction(.1), wellBody);
    for (const dx of [-1.03, 1.03]) this.solid(stoneWell.position.x + dx, 1.17, stoneWell.position.z, .18, 2.34, .20);
    this.place(this.toolMesh, 'tools'); this.place(this.mill, 'windmill'); this.mill.position.z -= 1.5; this.mill.rotation.y = Math.PI;
    const millBody=this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(this.mill.position.x,1.4,this.mill.position.z));
    this.world.createCollider(R.ColliderDesc.cylinder(1.4,.9).setFriction(.1),millBody);
    this.gardenQuest = new GardenerQuest(this.scene, this.world, this.guide, this.toolMesh);
    this.place(this.chest, 'chest'); this.chest.rotation.y = Math.PI;
    this.place(ruins, 'practice');
    this.trackBuildingOcclusion(ruins.getObjectByName('ruins-arch')!);
    for (const name of ['ruins-columns', 'ruins-pavilion']) this.trackBuildingOcclusion(ruins.getObjectByName(name)!);
    for (const { x, y, z, width, height, depth, angle } of ruins.userData.colliders as { x: number; y: number; z: number; width: number; height: number; depth: number; angle: number }[]) {
      const center = new T.Vector3(encounter.x + x, y, encounter.z + z), rotation = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), angle);
      const body = this.solid(center.x, center.y, center.z, width, height, depth); body.setRotation(rotation, true);
      this.encounterObstacles.push(new T.Box3(new T.Vector3(-width / 2, -height / 2, -depth / 2), new T.Vector3(width / 2, height / 2, depth / 2))
        .applyMatrix4(new T.Matrix4().compose(center, rotation, new T.Vector3(1, 1, 1))).expandByScalar(.55));
    }
    this.place(this.keyMesh, 'boss', 1.1); this.keyMesh.visible = false;
    this.exit = this.makeGate('exit'); this.shortcut = this.makeGate('shortcut');
    const bridge = at('bridge'), bridgeRoot=createGardenBridge(); bridgeRoot.position.set(bridge.x-2.5,0,bridge.z);this.scene.add(bridgeRoot);
    this.bridgeDeck=bridgeRoot.getObjectByName('bridge-deck') as T.Group;
    for(const x of [0,5])for(const z of [-2,2])this.solid(bridgeRoot.position.x+x,.4,bridge.z+z,.46,.8,.46);
    this.bridgeBody = this.solid(bridge.x, 2.5, bridge.z, CELL, 5, CELL);
    this.bridgeWater.root.position.set(bridge.x,0,bridge.z);this.scene.add(this.bridgeWater.root);
    this.sign('checkpoint', 'guardian', 1.5, 1.8);
    this.gardenerStory = new GardenerStory(this.guide, this.player, this.camera, this.cameraLook,
      () => this.say('gardenerSearching'), () => { this.clearInput(); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true); });
    for (const [name, hp, shielded] of [['practice', 1, false], ['shield', 2, true], ['boss', 3, true]] as const) {
      const p = at(name), mesh = name === 'boss' ? leafMonster(true) : createDarkKnight(); mesh.position.set(p.x, 0, p.z); this.scene.add(mesh);
      const ring = new T.Mesh(new T.RingGeometry(.85, 1, 32), new T.MeshBasicMaterial({ color: '#f0a252', transparent: true, opacity: .7, side: T.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; this.scene.add(ring);
      this.enemies.push({ mesh, home: mesh.position.clone(), hp, maxHp: hp, shielded, phase: 'idle', timer: 0, aim: new T.Vector3(), ring, patrol: 1, speed: 0, alert: 0, block: 0, lastSeen: mesh.position.clone(), memory: 0, path: [], repath: 0 });
    }
    // Reuse the licensed tree kit; keep tall silhouettes outside playable lanes.
    for (let r = 2; r < ROWS - 1; r += 4) for (let c = 1; c < COLS - 1; c += 4) {
      if (maze[r][c] || (c === 13 && r === 18)) continue;
      const p = position(c, r); this.model((r + c) % 3 ? 'tree-oak-01' : 'apple-tree', p.x, p.z, 4 + (r % 3));
    }
    for (const [c, r] of [[17, 20], [19, 16], [12, 2], [18, 2], [1, 12]]) {
      const p = position(c, r); if (c === 19 && r === 16) p.x += 4.5;
      this.model('bush-round-01', p.x - 1.4, p.z + 1.3, 1.8);
    }
    for (const [c, r] of [[17, 7], [18, 12], [15, 9], [12, 4]]) {
      const p = position(c, r); const mushroom = new T.Group();
      this.box(mushroom, 0, .6, 0, .3, 1.2, .3, '#f4e9c8'); mushroom.add(orb('#cc7979', 0, 1.2, 0, .85, .38, .85));
      mushroom.add(orb('#fff3d9', -.3, 1.48, .12, .15, .07, .15)); mushroom.position.set(p.x + 1.5, 0, p.z + 1.5); this.scene.add(mushroom);
    }
    this.scene.add(this.wind.mesh);
  }

  setupUI() {
    this.ui = new UI({ start: () => this.reset(), pause: () => this.pause(), mute: () => {
      const enabled = this.muted; this.settings = { ...readSettings(), music: enabled, effects: enabled };
      saveSettings(this.settings); this.audio.applySettings(this.settings);
      if (!enabled) speechSynthesis?.cancel();
    }, jump: () => { if (this.active()) this.jumpRequested = true; }, dive: () => this.interact(),
    move: (x, y) => { if (this.active()) this.stick = { x, y }; }, hint: () => this.hint() });
    this.ui.configurePuzzle();
    this.root = document.querySelector('#game-ui')!; this.root.classList.add('maze-ui');
    this.root.querySelector('.course-title')!.innerHTML = `<small>ADVENTURE 03</small><strong>${mt('title')}</strong>`;
    this.root.querySelector('.keyboard-guide')!.textContent = mt('controls');
    this.root.insertAdjacentHTML('beforeend', `<div class="maze-inventory" aria-label="${mt('title')}"><span id="maze-hearts"></span><span id="maze-item"></span></div><div class="maze-dialogue workshop-dialogue" hidden role="dialog" aria-modal="true" aria-labelledby="maze-speaker" aria-describedby="maze-line"><div class="workshop-bubble"><strong id="maze-speaker" class="dialogue-speaker"></strong><button type="button" id="maze-close" class="workshop-leave" aria-label="${t('退出对话')}" title="${t('退出对话')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 16 16M20 4 4 20"/></svg></button><p id="maze-line" class="dialogue-line" aria-live="polite"></p><div class="workshop-dialogue-footer"><button type="button" id="maze-next" class="workshop-next"><kbd aria-hidden="true">Enter</kbd><span class="workshop-next-label">${mt('continue')}</span><span class="workshop-next-arrow" aria-hidden="true"></span></button></div></div></div>`);
    this.dialogueBox = this.root.querySelector('.maze-dialogue')!;
    this.dialogueBox.querySelector('.workshop-bubble')!.insertAdjacentHTML('afterbegin',
      `<div class="workshop-portrait" aria-hidden="true"><img src="${import.meta.env.BASE_URL}images/gardener-dialogue.png" alt="" draggable="false"></div>`);
    for (const portrait of ['player-dialogue/thinking', 'gardener-puzzled', 'gardener-remember', 'gardener-grateful']) {
      const image = new Image();
      image.src = `${import.meta.env.BASE_URL}images/${portrait}.png`;
    }
    this.gardenerMutter = document.createElement('div'); this.gardenerMutter.className = 'gardener-mutter';
    this.gardenerMutter.textContent = mt('gardenerSearching'); this.gardenerMutter.hidden = true; this.root.append(this.gardenerMutter);
    this.enemyBars = this.enemies.slice(0,2).map(enemy => {
      const bar = document.createElement('div'); bar.className = 'knight-health'; bar.hidden = true;
      bar.setAttribute('role','progressbar'); bar.setAttribute('aria-label',mt('knightHealth'));
      bar.setAttribute('aria-valuemin','0'); bar.setAttribute('aria-valuemax',String(enemy.maxHp));
      bar.dataset.max = String(enemy.maxHp);
      bar.innerHTML = '<b class="knight-health-crest" aria-hidden="true"></b><div class="knight-health-frame" aria-hidden="true"><div class="knight-health-track"><em></em><i></i><span></span></div></div>';
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
  }
  bindInput() {
    addEventListener('keydown', event => {
      if ((event.target as HTMLElement)?.closest('button,a,input,select') && ['Space', 'Enter'].includes(event.code)) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      if (event.repeat) return;
      if (this.dialogue) { if (['KeyE', 'Enter', 'Space', 'Escape'].includes(event.code)) { event.preventDefault(); if (event.code === 'Escape') this.closeDialogue(); else this.nextDialogue(); } return; }
      if (event.code === 'Escape') { this.pause(); return; }
      if (!this.active()) return;
      this.keys.add(event.code);
      if (event.code === 'KeyE' || event.code === 'KeyF') this.interact();
      if (event.code === 'KeyH') this.hint();
      if (event.code === 'Space') this.jumpRequested = true;
    });
    addEventListener('keyup', event => this.keys.delete(event.code));
    const suspend = () => { this.clearInput(); if (this.state === 'racing' && !this.paused) this.pause(); };
    addEventListener('blur', suspend);
    document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
    addEventListener('resize', () => { this.clearInput(); this.resize(); });
    addEventListener('pagehide', () => { this.audio.stop(); speechSynthesis?.cancel(); });
  }
  active() { return this.state === 'racing' && !this.paused && !this.dialogue && !this.gardenerStory.active && !this.gardenQuest.busy; }
  clearInput() { this.keys.clear(); this.stick = { x: 0, y: 0 }; this.jumpRequested = false; this.jumpBuffer = 0; }
  reset(play = true) {
    this.clearInput(); this.state = play ? 'racing' : 'ready'; this.paused = false;
    this.quest = this.tools = this.wand = this.bridgeOpen = this.bridgeOpening = this.key = this.treasure = this.exitOpen = false;
    this.bridgeProgress = 0; this.hearts = 3; this.invulnerable = this.cooldown = this.time = this.accumulator = this.gait = 0;
    this.coyote = this.jumpBuffer = this.jumpCooldown = 0; this.heading = 0; this.checkpoint = at('spawn');
    this.dialogue = undefined; this.dialogueBox.hidden = true; this.message = 'safe'; this.messageUntil = 6;
    this.gardenerStory.reset();
    this.gardenQuest.reset();
    this.body.setTranslation({ ...at('spawn'), y: .8 }, true); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.previous.copy(this.body.translation()); this.player.position.copy(this.previous); this.player.visible = true;
    this.bridgeBody.setEnabled(true); this.shortcut.body.setEnabled(true); this.exit.body.setEnabled(true);
    this.chest.getObjectByName('lid')!.rotation.x = 0; this.toolMesh.visible = true; this.keyMesh.visible = false;
    for (const enemy of this.enemies) { enemy.hp = enemy.maxHp; enemy.phase = 'idle'; enemy.timer = 0; enemy.mesh.position.copy(enemy.home); enemy.mesh.visible = true; enemy.ring.visible = false;
      enemy.patrol = 1; enemy.speed = enemy.alert = enemy.block = enemy.memory = enemy.repath = 0; enemy.path = []; enemy.lastSeen.copy(enemy.home);
      if (enemy !== this.enemies[2]) animateDarkKnight(enemy.mesh, 'idle', enemy.shielded, 0, 0, this.reducedMotion, enemy); }
    this.uiMode = ''; this.hudState = ''; this.windTime = 0; this.last = performance.now(); this.audio.stop(); speechSynthesis?.cancel();
    if (play) { this.audio.resume(); (document.activeElement as HTMLElement)?.blur(); }
    this.render(0);
  }
  pause() {
    if (this.state !== 'racing') return;
    this.paused = !this.paused; this.clearInput(); this.last = performance.now(); this.accumulator = 0;
    if (this.paused) { this.audio.pause(); speechSynthesis?.cancel(); } else this.audio.resume();
  }
  say(key: MazeText, sound?: PuzzleSound) {
    this.message = key; this.messageUntil = this.time + 6;
    if (sound) this.audio.play(sound);
    if (this.settings.effects && 'speechSynthesis' in window) {
      speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(mt(key));
      utterance.lang = language === 'zh' ? 'zh-CN' : language === 'ms' ? 'ms-MY' : 'en-US'; utterance.rate = .9; utterance.volume = .75; speechSynthesis.speak(utterance);
    }
  }
  talk(speaker: MazeText, lines: MazeText[], gardenerIntro = false) {
    this.dialogueBox.dataset.portrait = speaker === 'gardenerName' ? 'true' : 'false';
    this.clearInput(); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.dialogue = { lines, index: 0, gardenerIntro }; this.dialogueBox.hidden = false;
    this.root.querySelector('#maze-speaker')!.textContent = mt(speaker);
    this.showLine(); (this.root.querySelector('#maze-next') as HTMLButtonElement).focus({ preventScroll: true });
  }
  showLine() {
    const dialogue = this.dialogue!;
    if (dialogue.gardenerIntro) {
      this.gardenerStory.setStage(dialogue.index);
      this.root.querySelector('#maze-speaker')!.textContent = mt(dialogue.index === 1 ? 'playerName' : 'gardenerName');
    }
    this.dialogueBox.dataset.speaker = dialogue.gardenerIntro && dialogue.index === 1 ? 'player' : 'guide';
    const line = dialogue.lines[dialogue.index];
    const gardenerPortrait = line === 'gardenerHello' ? 'gardener-puzzled'
      : line === 'gardenerRemember' ? 'gardener-remember'
      : line === 'gardenerThanks' || line === 'gardenerPlant' ? 'gardener-grateful' : 'gardener-dialogue';
    this.dialogueBox.querySelector<HTMLImageElement>('.workshop-portrait img')!.src =
      `${import.meta.env.BASE_URL}images/${this.dialogueBox.dataset.speaker === 'player' ? 'player-dialogue/thinking' : gardenerPortrait}.png`;
    this.root.querySelector('#maze-line')!.textContent = mt(dialogue.lines[dialogue.index]);
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
  closeDialogue(completed = false) {
    const intro = this.dialogue?.gardenerIntro;
    const followGardener = this.dialogue?.lines.includes('gardenerFollow') && this.gardenQuest.stage === 'walking';
    if (intro) {
      this.gardenerStory.finish(completed);
    }
    this.dialogue = undefined; this.dialogueBox.hidden = true; this.clearInput(); (document.activeElement as HTMLElement)?.blur(); speechSynthesis?.cancel();
    if (intro && completed) this.say('findTools');
    if (followGardener) this.say('gardenerFollow');
  }
  near(name: SpotName, reach = 3) { const p = this.body.translation(), q = at(name); return Math.hypot(p.x - q.x, p.z - q.z) < reach; }
  clearSight(to: { x: number; z: number }) {
    const p = this.body.translation(), length = Math.hypot(p.x - to.x, p.z - to.z);
    for (let d = .4; d < length - .6; d += .4) if (!walkable(p.x + (to.x - p.x) * d / length, p.z + (to.z - p.z) * d / length, this.bridgeOpen, this.key, this.exitOpen)) return false;
    return true;
  }
  objective(): MazeText {
    if (this.exitOpen) return 'throughExit'; if (this.key) return 'returnExit';
    if (this.enemies[2].hp === 0) return 'collectKey'; if (this.bridgeOpen) return 'findGuardian';
    if (this.wand) return 'findBridge';
    if (this.gardenQuest.stage === 'handoff') return 'gardenerPlant';
    if (this.gardenQuest.stage === 'walking') return 'gardenerFollow';
    if (this.gardenQuest.stage === 'digging') return 'gardenerDig';
    if (this.gardenQuest.stage === 'planting') return 'plantingFlowers';
    if (this.gardenQuest.returned) return 'plantHint';
    if (this.tools) return 'returnTools'; if (this.gardenQuest.stage === 'tool') return 'cartOpened';
    if (this.quest) return 'findTools'; return 'safe';
  }
  hint() {
    if (!this.active()) return;
    const enemy = this.enemies.find(e => e.hp > 0 && e.shielded && e.mesh.position.distanceTo(this.player.position) < 10);
    this.say(enemy ? 'scoutHint' : !this.wand && this.quest ? this.gardenQuest.hint() : this.objective(), 'hint');
  }
  target(): { spot: SpotName | 'seedling'; action: MazeText } | undefined {
    const p = this.body.translation();
    const seedling = this.gardenQuest.seedling.position;
    if (this.gardenQuest.stage === 'plant' && Math.hypot(p.x - seedling.x, p.z - seedling.z) < 1.8) return { spot: 'seedling', action: 'plantSeedling' };
    if (Math.hypot(p.x - this.guide.position.x, p.z - this.guide.position.z) < 3) return { spot: 'gardener', action: this.tools && !this.wand ? 'giveTools' : 'talk' };
    const cartAction = this.gardenQuest.cartAction(p.x, p.z);
    if (cartAction) return { spot: 'cart', action: cartAction };
    if (this.gardenQuest.stage === 'tool' && Math.hypot(p.x - this.toolMesh.position.x, p.z - this.toolMesh.position.z) < 2.7) return { spot: 'tools', action: 'takeTools' };
    if (this.wand && this.near('pinwheel', 3)) return { spot: 'pinwheel', action: 'blow' };
    if (this.near('scout', 2.7)) return { spot: 'scout', action: 'talk' };
    if (!this.treasure && this.near('chest', 2.7)) return { spot: 'chest', action: 'openChest' };
    if (!this.key && this.enemies[2].hp === 0 && this.near('boss', 3)) return { spot: 'boss', action: 'takeKey' };
    if (!this.exitOpen && this.near('exit', 3.2)) return { spot: 'exit', action: this.key ? 'openGate' : 'inspect' };
    if (!this.bridgeOpen && this.near('windmill', 6.6) && this.body.translation().x < at('bridge').x) return { spot: 'windmill', action: this.wand ? 'blow' : 'inspect' };
    return undefined;
  }
  interact() {
    if (!this.active()) return;
    this.audio.resume(); const target = this.target();
    if (target?.spot === 'gardener') {
      this.quest = true;
      if (this.tools && !this.wand) {
        this.tools = false; this.clearInput(); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        this.gardenQuest.give(this.body, this.player); this.say('gardenerPlant', 'pickup');
      }
      else if (this.gardenQuest.returned && !this.wand) this.talk('gardenerName', [this.gardenQuest.hint()]);
      else if (!this.wand && !this.gardenerStory.introduced) this.talk('gardenerName', ['gardenerHello', 'playerTrail', 'gardenerRemember', 'gardenerTogether'], true);
      else this.talk('gardenerName', this.wand ? ['gardenerAgain'] : ['gardenerHint']);
    } else if (target?.spot === 'cart') {
      if (target.action === 'inspect') { this.quest = true; this.say('cartPushHint', 'hint'); return; }
      this.quest = true; this.clearInput(); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.heading = -Math.PI / 2; this.gardenQuest.push(this.body, this.player); this.say('cartMoving', 'drop');
    } else if (target?.spot === 'tools') {
      this.tools = true; this.quest = true; this.gardenQuest.take(this.player); this.toolMesh.visible = false; this.say('returnTools', 'pickup');
    } else if (target?.spot === 'seedling') {
      this.clearInput(); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true); this.gardenQuest.plant(this.body, this.player); this.say('plantingFlowers', 'pickup');
    } else if (target?.spot === 'pinwheel') {
      this.cast(at('pinwheel')); this.gardenQuest.pinwheelTime = 4; this.say('pinwheelHint', 'bloom');
    }
    else if (target?.spot === 'scout') { this.hearts = 3; this.talk('scoutName', ['scoutHint', 'scoutRest']); }
    else if (target?.spot === 'chest') { this.treasure = true; this.hearts = 3; this.say('treasure', 'key'); }
    else if (target?.spot === 'boss') { this.key = true; this.keyMesh.visible = false; this.shortcut.body.setEnabled(false); this.say('returnExit', 'key'); }
    else if (target?.spot === 'exit') {
      if (this.key) { this.exitOpen = true; this.exit.body.setEnabled(false); this.say('throughExit', 'gate'); }
      else this.say('locked', 'hint');
    } else if (target?.spot === 'windmill') {
      if (this.wand && !this.bridgeOpening) { this.cast(at('windmill')); this.bridgeOpening = true; this.say('findGuardian', 'gate'); }
      else if (!this.wand) this.say('windNeeded', 'hint');
    } else if (this.wand) this.blow();
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
    const enemy = this.enemies.filter(e => e.hp > 0 && Math.hypot(p.x - e.mesh.position.x, p.z - e.mesh.position.z) <= 7.5 && this.clearSight(e.mesh.position))
      .sort((a, b) => a.mesh.position.distanceToSquared(this.player.position) - b.mesh.position.distanceToSquared(this.player.position))[0];
    this.cast(enemy?.mesh.position ?? { x: p.x - Math.sin(this.heading) * 6, z: p.z - Math.cos(this.heading) * 6 }, !!enemy && enemy.phase !== 'stun');
    if (!enemy || enemy.phase === 'stun') return;
    if (enemy.shielded && enemy.phase !== 'rest') { enemy.block = .24; this.say('shielded', 'drop'); return; }
    enemy.hp--; enemy.phase = 'stun'; enemy.timer = .8; this.audio.play('bloom');
    if (enemy.hp === 0) {
      if (enemy !== this.enemies[2]) enemy.timer = KNIGHT_DEATH_TIME;
      enemy.ring.visible = false;
      if (enemy === this.enemies[2]) { this.keyMesh.visible = true; this.say('collectKey', 'key'); }
    }
  }
  hurt() {
    if (this.invulnerable > 0) return;
    this.hearts--; this.invulnerable = 2.5; this.say('hurt', 'drop');
    if (this.hearts === 0) {
      this.hearts = 3; this.body.setTranslation({ ...this.checkpoint, y: .8 }, true); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.previous.copy(this.body.translation()); this.player.position.copy(this.previous); this.clearInput(); this.say('recover', 'bloom');
      for (const enemy of this.enemies) {
        enemy.mesh.position.copy(enemy.home); enemy.phase = 'idle'; enemy.timer = 0;
        enemy.speed = enemy.alert = enemy.block = enemy.memory = enemy.repath = 0; enemy.path = []; enemy.lastSeen.copy(enemy.home);
        if (enemy !== this.enemies[2]) animateDarkKnight(enemy.mesh, 'idle', enemy.shielded, this.time, 0, this.reducedMotion, enemy);
      }
      this.render(0);
    }
  }
  knightClear(from: { x: number; z: number }, to: { x: number; z: number }) {
    const steps = Math.max(1,Math.ceil(Math.hypot(to.x - from.x,to.z - from.z) / .25));
    for (let i = 0; i <= steps; i++) {
      const x = T.MathUtils.lerp(from.x,to.x,i / steps), z = T.MathUtils.lerp(from.z,to.z,i / steps);
      if (this.encounterObstacles.some(bounds => x >= bounds.min.x && x <= bounds.max.x && z >= bounds.min.z && z <= bounds.max.z)) return false;
      if (![-.55,.55].every(dx => [-.55,.55].every(dz => walkable(x + dx,z + dz,this.bridgeOpen,this.key,this.exitOpen)))) return false;
    }
    return true;
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
        if (visible && distance <= 2.5 && alignment > .94 && this.knightClear(from,p)) {
          enemy.phase = 'warn'; enemy.timer = 1.1; enemy.aim.set(p.x - from.x,0,p.z - from.z).normalize();
        } else this.moveKnight(enemy,enemy.lastSeen,1.8,dt);
        break;
      }
      case 'return':
        if (from.distanceTo(enemy.home) < .15) { enemy.phase = 'idle'; enemy.timer = .65; enemy.memory = 0; enemy.path = []; }
        else this.moveKnight(enemy,enemy.home,1.3,dt);
        break;
      case 'warn':
        // Track early in the tell, then commit so a sidestep can genuinely dodge the attack.
        if (visible && enemy.timer > .45) enemy.aim.set(p.x - from.x,0,p.z - from.z).normalize();
        faceKnight(enemy.mesh,enemy.aim.x,enemy.aim.z,dt);
        if (enemy.timer <= 0) {
          if (!visible || distance > 3 || !this.knightClear(from,p)) { enemy.phase = 'chase'; enemy.timer = .15; }
          else { enemy.phase = 'lunge'; enemy.timer = .45; }
        }
        break;
      case 'lunge': {
        const progress = 1 - enemy.timer / .45;
        const pace = T.MathUtils.smoothstep(progress,0,.18) * (1 - T.MathUtils.smoothstep(progress,.78,1));
        const next = from.clone().addScaledVector(enemy.aim,Math.min(Math.max(0,distance - .85),dt * 5 * pace));
        if (next.distanceTo(enemy.home) <= 14 && this.knightClear(from,next)) from.copy(next);
        const dx = p.x - from.x, dz = p.z - from.z, reach = Math.hypot(dx,dz);
        if (reach < 1.3 && dx * enemy.aim.x + dz * enemy.aim.z > reach * .3 && p.y < 1.6 && this.clearSight(from)) {
          this.hurt(); if (enemy.phase !== 'lunge') return;
        }
        if (enemy.timer <= 0) { enemy.phase = 'rest'; enemy.timer = 2.6; if (enemy.shielded && distance < 10) this.say('exposed'); }
        break;
      }
      case 'rest': case 'stun':
        if (enemy.timer <= 0) { enemy.phase = 'chase'; enemy.timer = .15; enemy.path = []; enemy.repath = 0; }
        break;
    }
    enemy.speed = dt ? Math.hypot(from.x - beforeX,from.z - beforeZ) / dt : 0;
    enemy.alert = T.MathUtils.lerp(enemy.alert,enemy.phase !== 'return' && (visible || enemy.phase !== 'idle') ? 1 : 0,1 - Math.exp(-dt * 7));
    enemy.block = Math.max(0,enemy.block - dt);
    animateDarkKnight(enemy.mesh,enemy.phase,enemy.shielded,this.time,dt,this.reducedMotion,enemy);
  }
  updateEnemies(dt: number) {
    const p = this.body.translation();
    for (const enemy of this.enemies) {
      const knight = enemy !== this.enemies[2];
      if (enemy.hp <= 0) {
        if (knight && enemy.timer > 0) {
          enemy.timer = Math.max(0, enemy.timer - dt); enemy.speed = 0;
          animateDarkKnight(enemy.mesh, 'stun', enemy.shielded, this.time, dt, this.reducedMotion, enemy);
          enemy.mesh.visible = enemy.timer > 0;
        } else enemy.mesh.visible = false;
        enemy.ring.visible = false; continue;
      }
      if (knight) this.updateKnight(enemy,dt);
      else {
        enemy.timer -= dt;
        const distance = Math.hypot(p.x - enemy.mesh.position.x,p.z - enemy.mesh.position.z);
        if (enemy.phase === 'idle') {
          enemy.mesh.position.lerp(enemy.home,1 - Math.exp(-dt * 3));
          if (distance < 8 && this.clearSight(enemy.mesh.position)) {
            enemy.phase = 'warn'; enemy.timer = 1.3;
            enemy.aim.set(p.x - enemy.mesh.position.x,0,p.z - enemy.mesh.position.z).normalize();
            enemy.mesh.rotation.y = Math.atan2(-enemy.aim.x,-enemy.aim.z);
          }
        } else if (enemy.phase === 'warn' && enemy.timer <= 0) { enemy.phase = 'lunge'; enemy.timer = .45; }
        else if (enemy.phase === 'lunge') {
          const next = enemy.mesh.position.clone().addScaledVector(enemy.aim,dt * 5);
          if (next.distanceTo(enemy.home) < 2.4 && walkable(next.x,next.z,this.bridgeOpen,this.key,this.exitOpen)) enemy.mesh.position.copy(next);
          if (distance < 2 && p.y < 1.6) this.hurt();
          if (enemy.timer <= 0) { enemy.phase = 'rest'; enemy.timer = 2.6; if (distance < 10) this.say('exposed'); }
        } else if ((enemy.phase === 'rest' || enemy.phase === 'stun') && enemy.timer <= 0) { enemy.phase = 'idle'; enemy.timer = 0; }
        const shield = enemy.mesh.getObjectByName('shield')!;
        shield.visible = enemy.shielded;
        shield.rotation.x = T.MathUtils.lerp(shield.rotation.x, enemy.phase === 'rest' || enemy.phase === 'stun' ? 1.3 : 0, 1 - Math.exp(-dt * 10));
        const body = enemy.mesh.getObjectByName('body')!;
        body.rotation.z = this.reducedMotion ? 0 : Math.sin(this.time * (enemy.phase === 'warn' ? 25 : 3)) * (enemy.phase === 'warn' ? .08 : .025);
      }
      enemy.ring.visible = enemy.phase === 'warn' || enemy.phase === 'rest';
      enemy.ring.material.color.set(enemy.phase === 'rest' ? '#9bead5' : '#e99a48');
      enemy.ring.position.copy(enemy.mesh.position); enemy.ring.position.y = .06; enemy.ring.scale.setScalar(enemy.maxHp === 3 ? 2.6 : 1.7);
    }
  }
  step() {
    this.time += STEP; this.cooldown = Math.max(0, this.cooldown - STEP); this.invulnerable = Math.max(0, this.invulnerable - STEP);
    this.windTime = Math.max(0, this.windTime - STEP);
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
    if (this.jumpBuffer > 0 && this.coyote > 0 && this.jumpCooldown === 0) { vy = 8; this.coyote = this.jumpBuffer = 0; this.jumpCooldown = .34; this.audio.play('jump'); }
    const blend = acceleration(this.grounded, STEP);
    this.body.setLinvel({ x: T.MathUtils.lerp(velocity.x, x * movement.speed, blend), y: vy, z: T.MathUtils.lerp(velocity.z, z * movement.speed, blend) }, true);
    if (length > .1) this.heading = Math.atan2(-x, -z);
    this.world.step();
    const footfall = Math.floor(this.gait / Math.PI); this.gait += Math.hypot(velocity.x, velocity.z) * STEP * movement.gait;
    if (this.grounded && Math.floor(this.gait / Math.PI) !== footfall && length > .1) this.audio.footstep(false);
    if (this.bridgeOpening && !this.bridgeOpen) {
      this.bridgeProgress = Math.min(1, this.bridgeProgress + STEP / 1.4);
      if (this.bridgeProgress === 1) { this.bridgeOpen = true; this.bridgeBody.setEnabled(false); this.checkpoint = at('practice'); this.checkpoint.z += 5; }
    }
    if (this.bridgeOpen && this.near('checkpoint', 3)) this.checkpoint = at('checkpoint');
    this.updateEnemies(STEP);
    if (this.exitOpen && this.near('finish', 2.1)) { this.state = 'qualified'; this.clearInput(); this.audio.music.pause(); this.say('won', 'win'); }
    if (this.body.translation().y < -4) { this.hearts = 1; this.invulnerable = 0; this.hurt(); }
  }
  updateUI() {
    const target = this.target(), cue = this.time < this.messageUntil ? this.message : this.objective();
    this.enemyBars.forEach((bar,index) => {
      const enemy = this.enemies[index], point = enemy.mesh.position.clone().add(new T.Vector3(0,1.58,0)).project(this.camera);
      bar.hidden = !this.active() || enemy.hp <= 0 || this.player.position.distanceTo(enemy.mesh.position) > 14 || !this.clearSight(enemy.mesh.position)
        || Math.abs(point.x) > .94 || Math.abs(point.y) > .9 || Math.abs(point.z) > 1;
      if (!bar.hidden) { bar.style.left = `${(point.x + 1) * innerWidth / 2}px`; bar.style.top = `${(1 - point.y) * innerHeight / 2}px`; }
      if (bar.dataset.hp !== String(enemy.hp)) {
        const damaged = enemy.hp < Number(bar.dataset.hp ?? enemy.hp);
        bar.classList.toggle('health-hit',damaged); bar.classList.toggle('health-reset',!damaged);
        bar.dataset.hp = String(enemy.hp); bar.setAttribute('aria-valuenow',String(enemy.hp));
        bar.setAttribute('aria-valuetext',`${enemy.hp}/${enemy.maxHp}`);
        bar.querySelector<HTMLElement>('i')!.style.width = `${enemy.hp / enemy.maxHp * 100}%`;
        bar.querySelector<HTMLElement>('em')!.style.width = `${enemy.hp / enemy.maxHp * 100}%`;
      }
    });
    this.ui.updatePuzzle(this.state, this.paused, this.muted, mt(cue), Number(this.key), mt(this.gardenQuest.stage === 'handoff' ? 'giveTools' : this.gardenQuest.stage === 'planting' ? 'plantSeedling' : target?.action ?? (this.gardenQuest.stage === 'moving' ? 'pushCart' : this.wand ? 'blow' : 'inspect')), !!this.dialogue || this.gardenerStory.active || this.gardenQuest.busy);
    this.root.classList.toggle('gardener-cinematic', this.gardenerStory.active && !this.paused);
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
      this.root.querySelector('#maze-item')!.textContent = this.key ? `⚿ ${mt('key')}` : this.wand ? `✧ ${mt('magic')}` : this.tools ? `❀ ${mt('tools')}` : this.gardenQuest.returned ? mt('plantSeedling') : mt('explore');
    }
    this.root.querySelector('#finished')!.textContent = `${Number(this.key)} / 1`;
    this.dialogueBox.hidden = !this.dialogue || this.paused;
    this.root.querySelector<HTMLElement>('.maze-inventory')!.hidden = this.state !== 'racing' || this.paused;
    this.ring.visible = this.active() && !!target;
    if (target) { const p = target.spot === 'gardener' ? this.guide.position : target.spot === 'cart' ? this.gardenQuest.pushPoint : target.spot === 'tools' ? this.toolMesh.position : target.spot === 'seedling' ? this.gardenQuest.seedling.position : at(target.spot); this.ring.position.set(p.x, .07, p.z); }
    const bubble = this.guide.position.clone().add(new T.Vector3(0, 1.4, 0)).project(this.camera);
    this.gardenerMutter.hidden = this.state !== 'racing' || this.paused || !!this.dialogue || this.gardenerStory.mutter <= 0 || Math.abs(bubble.x) > .9 || Math.abs(bubble.y) > .9 || bubble.z > 1;
    this.gardenerMutter.style.left = `${(bubble.x + 1) * 50}%`; this.gardenerMutter.style.top = `${(1 - bubble.y) * 50}%`;
  }
  render(dt = 0) {
    const p = this.body.translation(); this.player.position.lerpVectors(this.previous, new T.Vector3(p.x, p.y, p.z), Math.min(1, this.accumulator / STEP));
    if (!dt) this.player.position.set(p.x, p.y, p.z);
    const velocity = this.body.linvel();
    if (!['moving', 'handoff', 'planting'].includes(this.gardenQuest.stage)) animateWalk(this.player, this.heading, this.gait, this.active() ? Math.hypot(velocity.x, velocity.z) : 0, this.grounded, this.reducedMotion, dt, this.wand || this.tools);
    setCharacterExpression(this.player, this.state === 'qualified' ? 'happy' : this.gardenQuest.stage === 'moving' ? 'determined' : this.invulnerable > 0 ? 'surprised' : 'neutral');
    this.wandMesh.visible = this.wand;
    // Follow the hand's position while keeping the long staff upright during the carrying pose.
    this.wandMesh.quaternion.copy(this.wandMesh.parent!.quaternion).invert(); this.wandMesh.rotateZ(-.2);
    animateWindWand(this.wandMesh, this.active() && this.wand ? dt : 0, this.windTime, this.reducedMotion);
    this.player.visible = this.reducedMotion || this.invulnerable <= 0 || Math.floor(this.time * 8) % 2 === 0;
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
    const portrait = innerWidth < innerHeight, follow = dt === 0 ? 1 : 1 - Math.exp(-5 * dt);
    const focusPlayer = this.player.position;
    this.cameraGoal.set(focusPlayer.x, Math.max(0, focusPlayer.y) * .42 + (portrait ? 11 : 9.4), focusPlayer.z + (portrait ? 18 : 16));
    const lookGoal = new T.Vector3(focusPlayer.x, Math.max(0, focusPlayer.y) * .32 + 1.8, focusPlayer.z - 8);
    const encounter = at('practice');
    if (portrait && this.bridgeOpen && focusPlayer.x > encounter.x - 7.5 && focusPlayer.x < encounter.x + 12.5
      && focusPlayer.z > encounter.z - 7.5 && focusPlayer.z < encounter.z + 17.5) {
      const pan = T.MathUtils.clamp((encounter.x + 5 - focusPlayer.x) * .5, 0, 2.5)
        * T.MathUtils.smoothstep(focusPlayer.x, encounter.x - 6, encounter.x - 2.5);
      this.cameraGoal.x += pan; lookGoal.x += pan;
    }
    if (this.gardenQuest.stage === 'moving') { this.cameraGoal.x += 1.3; lookGoal.x += 1.3; }
    if (this.gardenQuest.stage === 'handoff' || this.dialogue?.lines.includes('gardenerFollow') && this.gardenQuest.stage === 'walking') {
      lookGoal.copy(this.guide.position).add(this.player.position).multiplyScalar(.5);
      const side = new T.Vector3(this.player.position.z - this.guide.position.z, 0, this.guide.position.x - this.player.position.x).normalize();
      if (side.x < 0) side.negate();
      this.cameraGoal.copy(lookGoal).addScaledVector(side, portrait ? 8.5 : 5.7); this.cameraGoal.y += 2.8;
    } else if (['planting', 'watering'].includes(this.gardenQuest.stage)) {
      lookGoal.copy(this.gardenQuest.bed.position).add(new T.Vector3(-1.8, .6, .8));
      this.cameraGoal.copy(lookGoal).add(new T.Vector3(portrait ? 7.5 : 5.5, 3.5, portrait ? 4.5 : 3.2));
    }
    if (!this.gardenerStory.active) { this.camera.position.lerp(this.cameraGoal, follow); this.cameraLook.lerp(lookGoal, follow); }
    if (!this.gardenQuest.returned) this.gardenerStory.update(dt, this.paused, this.reducedMotion, this.active(), this.cameraGoal, lookGoal);
    this.camera.lookAt(this.cameraLook); this.camera.updateMatrixWorld();
    const toPlayer = (this.gardenerStory.active ? this.cameraLook.clone() : focusPlayer.clone().add(new T.Vector3(0, .4, 0))).sub(this.camera.position), ray = new T.Ray(this.camera.position, toPlayer.clone().normalize()), hit = new T.Vector3();
    const focus = this.gardenQuest.stage === 'moving' ? this.gardenQuest.cart.position.clone().add(new T.Vector3(1, 1, 0))
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
      const blocked = ray.intersectBox(building.bounds, hit) && this.camera.position.distanceTo(hit) < actor.length();
      building.opacity = T.MathUtils.lerp(building.opacity, blocked ? .16 : 1, dt ? 1 - Math.exp(-dt * 12) : 1);
      for (const layer of building.materials) {
        layer.material.opacity = layer.opacity * building.opacity;
        layer.material.depthWrite = layer.depthWrite && building.opacity > .9;
      }
    }
    this.bridgeDeck.rotation.z = (1 - T.MathUtils.smoothstep(this.bridgeProgress, 0, 1)) * 1.15;
    this.bridgeWater.time.value = this.reducedMotion ? 0 : this.time;
    if (this.active()) this.mill.getObjectByName('rotor')!.rotation.z += dt * (this.bridgeOpening ? 3 : .18);
    this.shortcut.mesh.position.y = T.MathUtils.lerp(this.shortcut.mesh.position.y, this.key ? -4 : 0, dt ? 1 - Math.exp(-dt * 4) : 1);
    this.exit.mesh.position.y = T.MathUtils.lerp(this.exit.mesh.position.y, this.exitOpen ? -4 : 0, dt ? 1 - Math.exp(-dt * 4) : 1);
    this.chest.getObjectByName('lid')!.rotation.x = T.MathUtils.lerp(this.chest.getObjectByName('lid')!.rotation.x, this.treasure ? 1.2 : 0, dt ? 1 - Math.exp(-dt * 6) : 1);
    this.keyMesh.rotation.y = this.time; this.keyMesh.position.y = 1.1 + (this.reducedMotion ? 0 : Math.sin(this.time * 2) * .12);
    animateWoodWindChime(this.woodWindChime, this.time, this.reducedMotion);
    this.wind.update(this.windTime, this.windOrigin, this.windTarget, this.reducedMotion, this.windHit);
    this.sun.target.position.set(this.cameraLook.x, 0, this.cameraLook.z);
    this.sun.position.set(this.cameraLook.x - 28, 42, this.cameraLook.z + 22);
    this.updateUI(); this.renderer.render(this.scene, this.camera);
  }
  resize() { this.renderer.setSize(innerWidth, innerHeight); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
  tick(now: number) {
    const dt = Math.min((now - (this.last || now)) / 1000, .05); this.last = now;
    if (this.active()) { this.accumulator += dt; while (this.accumulator >= STEP) { this.step(); this.accumulator -= STEP; } }
    else { this.accumulator = 0; this.previous.copy(this.body.translation()); }
    this.render(dt); requestAnimationFrame(time => this.tick(time));
  }
}
