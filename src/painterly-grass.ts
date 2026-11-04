/*!
 * Windswept Meadow, Copyright (c) 2026 00GameDevs (@00vchannel), MIT.
 * Adapted from the site's exported asset; full notice in public/licenses/00GameDevs-painterly-grass.txt.
 */
import * as THREE from 'three';
import { MEADOW_BOUNDS, meadowCoverageAt } from './meadow-layout';

type GrassPatch = { x: number; z: number; width: number; depth: number };

function painterlyWindGLSL() { return `
 float grassHash(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
 vec2 windAt(vec2 root, float phase) {
   float wave = sin(dot(root, vec2(1.1, .7)) - uTime * 1.45);
   float gust = .5 + .5 * sin(dot(root, vec2(.48, -.31)) - uTime * .63);
   float flutter = sin(uTime * 2.6 + phase + root.x * 3.0) * .025;
   return vec2(.12 + wave * .11 + gust * .13, .035 + wave * .045 + flutter);
 }
`; }
function painterlyBrushGLSL() { return `
 float brushStreak(float h, float seed) {
   return sin(h * 23.0 + sin(h * 9.0 + seed * 11.0) * 2.2 + seed * 31.0);
 }
`; }

export function createPainterlyGrass(patches: GrassPatch[], isClear: (x: number, z: number) => boolean) {
  const root = new THREE.Group(); root.name = 'painterly-meadow';
  const uniforms = { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uTime: { value: 0 }, uLifeStart: { value: 1 }, uLifeEnd: { value: 0 },
    uSize: { value: .55 }, uDetail: { value: .8 }, uColor: { value: new THREE.Color('#6e963d') } };
  const output = '#include <tonemapping_fragment>\n#include <colorspace_fragment>';
  let seed = (607319 + Math.imul(Math.round(patches[0].x*2),73428767) + Math.imul(Math.round(patches[0].z*2),912931)) >>> 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  function geometry(flowers: boolean) {
    const positions = [], uvs = [], indices = [];
    const pieces = flowers ? 6 : 3;
    for (let piece = 0; piece < pieces; piece++) {
      const segments = flowers ? 1 : 2, start = positions.length / 3;
      for (let j = 0; j <= segments; j++) for (let side = 0; side < 2; side++) {
        positions.push(side * 2 - 1, j / segments, piece);
        uvs.push(side, j / segments);
      }
      for (let j = 0; j < segments; j++) {
        const i = start + j * 2;
        indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    return g;
  }

  const vertex = `
    #include <fog_pars_vertex>
    attribute vec4 seed; attribute vec2 aRoot;
    uniform float uTime, uLifeStart, uLifeEnd, uSize;
    varying vec2 vUv;
    varying float vShade, vSeed, vPetal, vGrowth;
    ${painterlyWindGLSL()}
    void main() {
      vUv = uv; vSeed = seed.w; vPetal = 0.0;
      vGrowth = smoothstep(0.0, 1.0, uLifeStart) * (1.0 - smoothstep(0.0, 1.0, uLifeEnd));
      vec2 root = aRoot;
      float id = position.z, h = position.y;
      float angle = seed.w * 6.283185 + id * 2.39996;
      vec2 along = vec2(cos(angle), sin(angle));
      vec2 across = vec2(-along.y, along.x);
      vec3 p;
      float patchTone = .5 + .5 * sin(root.x * 2.3 + sin(root.y * 1.8) * 1.4);
      #if FLOWERS == 1
        float height = .48 + seed.z * .45;
        vec2 wind = windAt(root, seed.w * 6.283185);
        if (id < .5) {
          p = vec3(across.x * position.x * .009, h * height, across.y * position.x * .009);
          p.xz += wind * h * h;
        } else {
          vPetal = 1.0;
          float a = (id - 1.0) * 1.256637 + seed.w * 6.283185;
          vec2 radial = vec2(cos(a), sin(a)), tangent = vec2(-radial.y, radial.x);
          float lengthPetal = .12 + grassHash(id + seed.z * 91.0) * .085;
          vec2 petal = radial * (.012 + h * lengthPetal) + tangent * position.x * (.045 + seed.z * .025);
          p = vec3(petal.x, height + .018 + h * .035 + dot(petal, across) * .65, petal.y);
          p.xz += wind;
        }
        vShade = .4 + seed.z * .3;
      #else
        float shape = grassHash(seed.z * 103.0 + id * 7.0);
        float height = (.30 + pow(seed.z, .7) * .82) * (.72 + shape * .38);
        float width = (.065 + grassHash(seed.w * 53.0 + id) * .10) * mix(1.25, .72, seed.z);
        float taper = .22 + .78 * pow(max(0.0, sin(h * 2.85 + .23)), .72);
        float lean = (.12 + shape * .27) * h * h;
        vec2 leaf = across * position.x * width * taper + along * lean;
        leaf += windAt(root, seed.w * 6.283185 + id * .23) * h * h;
        p = vec3(leaf.x, h * height - lean * .16, leaf.y);
        vShade = .12 + patchTone * .35 + shape * .28 + seed.z * .05;
      #endif
      float distanceFade = 1.0 - smoothstep(32.0, 48.0, length(cameraPosition.xz - root));
      p *= uSize * vGrowth * distanceFade;
      p.xz += root;
      vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `;
  const fragment = `
    #include <fog_pars_fragment>
    ${painterlyBrushGLSL()}
    uniform vec3 uColor; uniform float uDetail;
    varying vec2 vUv;
    varying float vShade, vSeed, vPetal, vGrowth;
    void main() {
      if (vGrowth < .002) discard;
      float x = vUv.x * 2.0 - 1.0, h = vUv.y;
      vec3 color;
      if (vPetal > .5) {
        float edge = .74 + .09 * sin(h * 19.0 + vSeed * 17.0);
        float cap = pow(abs((h - .46) / .57), 4.0);
        if (x*x + cap > edge) discard;
        color = mix(vec3(.69,.74,.70), vec3(.86,.89,.82), step(.43, vShade + x * .09));
      } else {
        #if FLOWERS == 0
          float streak = brushStreak(h, vSeed);
          float rim = .89 + streak * .028 * uDetail;
          float tip = 1.0 - smoothstep(.70, 1.03, h);
          if (abs(x + .12 * sin(h * 5.0 + vSeed * 9.0)) > rim * tip) discard;
          float notch = step(.94, sin(h * 21.0 + vSeed * 47.0)) * .065 * uDetail;
          if (abs(x) > rim * tip - notch && h > .2) discard;
        #endif
        float light = vShade + h * .16;
        color = mix(uColor * .37, uColor * .77, step(.36, light));
        color = mix(color, uColor * 1.13, step(.57, light));
        color = mix(color, mix(uColor, vec3(.70,.70,.22), .55), step(.76, light));
        float stroke = step(.64, sin(h * 10.0 + vSeed * 37.0 + x * 2.3));
        color *= 1.0 + (stroke - .5) * .10 * uDetail;
      }
      gl_FragColor = vec4(color, 1.0);
      ${output}
      #include <fog_fragment>
    }
  `;
  for (const flowers of [false, true]) {
    const material = new THREE.ShaderMaterial({
      name: flowers ? 'meadow-flowers' : 'meadow-brush-grass',
      uniforms, vertexShader: vertex, fragmentShader: fragment, defines: { FLOWERS: flowers ? 1 : 0 },
      side: THREE.DoubleSide, fog: true,
    });
    material.transparent = false;
    material.depthWrite = true;
    const base = geometry(flowers), g = new THREE.InstancedBufferGeometry();
    g.setIndex(base.index!.clone());
    for (const [name, attribute] of Object.entries(base.attributes)) g.setAttribute(name, attribute.clone());
    base.dispose();
    const seeds: number[] = [], roots: number[] = [];
    for (const patch of patches) {
      const count = Math.max(1, Math.round(patch.width * patch.depth * (flowers ? .3 : 10)));
      for (let i = 0; i < count; i++) {
        const x = patch.x + (random()-.5)*patch.width, z = patch.z + (random()-.5)*patch.depth;
        if (random()>meadowCoverageAt(x,z) || !isClear(x,z)) continue;
        roots.push(x, z); seeds.push(random(), random(), random(), random());
      }
    }
    g.setAttribute('seed', new THREE.InstancedBufferAttribute(new Float32Array(seeds), 4));
    g.setAttribute('aRoot', new THREE.InstancedBufferAttribute(new Float32Array(roots), 2));
    g.instanceCount = seeds.length / 4;
    const bounds = new THREE.Box3();
    for (const patch of patches) {
      bounds.expandByPoint(new THREE.Vector3(patch.x-patch.width/2-.45, 0, patch.z-patch.depth/2-.45));
      bounds.expandByPoint(new THREE.Vector3(patch.x+patch.width/2+.45, .85, patch.z+patch.depth/2+.45));
    }
    g.boundingBox = bounds; g.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());
    const object = new THREE.Mesh(g, material); object.position.y = .04; root.add(object);
    object.name = flowers ? 'grass-white-flowers' : 'grass-brush-clumps';
  }
  return { root, update(time: number, reducedMotion: boolean) { uniforms.uTime.value = reducedMotion ? 0 : time; } };
}

export function createMazeMeadow(isClear: (x: number, z: number) => boolean, grassTexture: THREE.Texture) {
  const steps = createMazeMeadowSteps(isClear, grassTexture);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

export function* createMazeMeadowSteps(isClear: (x: number, z: number) => boolean, grassTexture: THREE.Texture) {
  const root = new THREE.Group(); root.name = 'maze-meadow';
  const regions: { grass: ReturnType<typeof createPainterlyGrass>; x: number; z: number }[] = [];
  for (let z=MEADOW_BOUNDS.top;z<MEADOW_BOUNDS.bottom;z+=10) for (let x=MEADOW_BOUNDS.left;x<MEADOW_BOUNDS.right;x+=10) {
    yield;
    let planted=false;
    for (let dz=1;dz<10&&!planted;dz+=2) for (let dx=1;dx<10;dx+=2) if (meadowCoverageAt(x+dx,z+dz)>.1) {planted=true;break;}
    if (!planted) continue;
    const grass=createPainterlyGrass([{x:x+5,z:z+5,width:10,depth:10}],isClear);
    grass.root.name=`meadow-tile-${x}-${z}`; root.add(grass.root); regions.push({grass,x:x+5,z:z+5});
  }
  const width=MEADOW_BOUNDS.right-MEADOW_BOUNDS.left,depth=MEADOW_BOUNDS.bottom-MEADOW_BOUNDS.top;
  const maskWidth=1024,maskHeight=512,data=new Uint8Array(maskWidth*maskHeight*4);
  for(let z=0;z<maskHeight;z++){
    if(z%8===0)yield;
    for(let x=0;x<maskWidth;x++){
      const value=Math.round(255*meadowCoverageAt(MEADOW_BOUNDS.left+(x+.5)/maskWidth*width,MEADOW_BOUNDS.top+(z+.5)/maskHeight*depth));
      const i=(z*maskWidth+x)*4;data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
    }
  }
  const mask=new THREE.DataTexture(data,maskWidth,maskHeight);mask.magFilter=mask.minFilter=THREE.LinearFilter;mask.needsUpdate=true;
  const turf=grassTexture.clone();turf.repeat.set(width/5,depth/5);turf.needsUpdate=true;
  const ground=new THREE.PlaneGeometry(width,depth).rotateX(-Math.PI/2),uv=ground.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setY(i,1-uv.getY(i));
  const underlay=new THREE.Mesh(ground,new THREE.MeshStandardMaterial({map:turf,alphaMap:mask,color:'#9bb776',roughness:1,transparent:true,depthWrite:false}));
  underlay.name='meadow-ground-cover';underlay.position.set((MEADOW_BOUNDS.left+MEADOW_BOUNDS.right)/2,.03,(MEADOW_BOUNDS.top+MEADOW_BOUNDS.bottom)/2);underlay.receiveShadow=true;root.add(underlay);
  return { root, update(time: number, reducedMotion: boolean, camera: THREE.Vector3) {
    for (const region of regions) {
      // The extra tile radius lets all blades fade out before their batch is culled.
      region.grass.root.visible=(region.x-camera.x)**2+(region.z-camera.z)**2<56**2;
      if(region.grass.root.visible)region.grass.update(time,reducedMotion);
    }
  } };
}
