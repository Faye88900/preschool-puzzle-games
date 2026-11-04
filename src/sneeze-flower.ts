import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

let template: T.Group | undefined;

export const SNEEZE_FLOWER_CLIPS = { idle: 2.8, windup: .95, sneeze: .65, recover: 1.05 } as const;

function petalGeometry() {
  const geometry = new T.SphereGeometry(1, 24, 16), positions = geometry.attributes.position;
  const colors: number[] = [], inner = new T.Color('#e78591'), outer = new T.Color('#f6a4aa');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i), t = (y + 1) / 2;
    positions.setXYZ(i, x * .34 * (.75 + t * .25), y * .445, z * .145 - .022 * x * x);
    colors.push(...inner.clone().lerp(outer, t * .8 + Math.max(0, z) * .12).toArray());
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
  return geometry;
}

function leafGeometry(length: number, width: number) {
  const vertices: number[] = [], indices: number[] = [], colors: number[] = [];
  const rows = 18, columns = 10, stride = (rows + 1) * (columns + 1);
  const dark = new T.Color('#70954a'), light = new T.Color('#a3bd67');
  for (let side = 0; side < 2; side++) for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
    const u = row / rows, v = col / columns * 2 - 1, spread = Math.pow(Math.sin(Math.PI * u), .8);
    vertices.push(v * width * spread, .18 * Math.sin(u * Math.PI * .8) + (side ? -.025 : .09) * (1 - v * v) * spread, u * length);
    colors.push(...dark.clone().lerp(light, side ? .12 : .35 + (1 - Math.abs(v)) * .4).toArray());
  }
  for (let side = 0; side < 2; side++) for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const a = side * stride + row * (columns + 1) + col, b = a + columns + 1;
    indices.push(...(side ? [a, a + 1, b, a + 1, b + 1, b] : [a, b, a + 1, a + 1, b, b + 1]));
  }
  const geometry = new T.BufferGeometry(); geometry.setIndex(indices);
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
  return geometry;
}

function eyelidGeometry(upper: boolean) {
  const geometry = new T.SphereGeometry(1, 24, 10, 0, Math.PI, upper ? 0 : Math.PI / 2, Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const phi = Math.atan2(positions.getZ(i), -positions.getX(i));
    const theta = Math.acos(T.MathUtils.clamp(positions.getY(i), -1, 1)), edge = Math.acos(-.20 + .40 * Math.sin(phi));
    const t = upper ? theta / (Math.PI / 2) : (theta - Math.PI / 2) / (Math.PI / 2);
    const angle = upper ? t * edge : T.MathUtils.lerp(edge, Math.PI, t);
    positions.setXYZ(i, -Math.cos(phi) * Math.sin(angle), Math.cos(angle), Math.sin(phi) * Math.sin(angle));
  }
  geometry.computeVertexNormals(); return geometry;
}

type Pose = { lean: number; puff: number; eyes: number; mouth: number; leaves: number; petals: number };
function flowerClips() {
  const ready: Pose = { lean: -.025, puff: 1, eyes: 1, mouth: .7, leaves: 0, petals: 1 };
  const inhale: Pose = { lean: -.23, puff: 1.18, eyes: 0, mouth: .6, leaves: .42, petals: .96 };
  const sneeze: Pose = { lean: .30, puff: .69, eyes: 0, mouth: 1.55, leaves: -.16, petals: 1.035 };
  const quaternion = (x: number, y = 0, z = 0) => new T.Quaternion().setFromEuler(new T.Euler(x, y, z)).toArray();
  const clip = (name: string, frames: [number, Pose][]) => {
    const times = frames.map(([time]) => time), poses = frames.map(([, pose]) => pose);
    const vector = (node: string, value: (pose: Pose) => number[]) =>
      new T.VectorKeyframeTrack(node + '.scale', times, poses.flatMap(value));
    return new T.AnimationClip(name, -1, [
      new T.QuaternionKeyframeTrack('flower-neck.quaternion', times, poses.flatMap(p => quaternion(p.lean))),
      new T.QuaternionKeyframeTrack('flower-leaf-left.quaternion', times, poses.flatMap(p => quaternion(-.22 - p.leaves, -Math.PI / 2, -.08))),
      new T.QuaternionKeyframeTrack('flower-leaf-right.quaternion', times, poses.flatMap(p => quaternion(-.22 - p.leaves, Math.PI / 2, .08))),
      vector('flower-cheek-left', p => [p.puff, p.puff, p.puff]),
      vector('flower-cheek-right', p => [p.puff, p.puff, p.puff]),
      ...['left', 'right'].flatMap(side => [
        new T.QuaternionKeyframeTrack(`flower-upper-lid-${side}.quaternion`, times, poses.flatMap(p => quaternion(-p.eyes * Math.PI / 2))),
        new T.QuaternionKeyframeTrack(`flower-lower-lid-${side}.quaternion`, times, poses.flatMap(p => quaternion(Math.min(1, p.eyes * 4) * Math.PI / 2))),
      ]),
      vector('flower-mouth', p => [.9 + p.mouth * .1, p.mouth, 1]),
      vector('flower-petals', p => [p.petals, p.petals, 1]),
    ]);
  };
  return [
    clip('idle', [[0, ready], [1.15, { ...ready, puff: 1.035, lean: .01 }], [1.8, ready],
      [1.87, { ...ready, eyes: .2 }], [1.91, { ...ready, eyes: 0 }], [1.95, { ...ready, eyes: .2 }],
      [2.03, ready], [SNEEZE_FLOWER_CLIPS.idle, ready]]),
    clip('windup', [[0, ready], [.45, { ...inhale, lean: -.14, puff: 1.09, eyes: 1, leaves: .25 }],
      [.59, { ...inhale, puff: 1.12, eyes: .2 }], [.67, inhale], [.78, inhale],
      [SNEEZE_FLOWER_CLIPS.windup, { ...inhale, lean: -.255 }]]),
    clip('sneeze', [[0, { ...inhale, lean: -.255 }], [.14, sneeze], [.28, { ...sneeze, lean: .26 }],
      [.45, { ...sneeze, lean: .18, mouth: 1.15 }], [SNEEZE_FLOWER_CLIPS.sneeze, { ...ready, lean: .12, puff: .82, eyes: .35 }]]),
    clip('recover', [[0, { ...ready, lean: .12, puff: .82, eyes: .35 }], [.38, { ...ready, lean: -.055, puff: .92, eyes: .7 }],
      [.7, { ...ready, lean: .025 }], [SNEEZE_FLOWER_CLIPS.recover, ready]]),
  ];
}

/** Faces +Z; the pollen-emitter socket follows the mouth in every animation. */
export function createSneezeFlower(): T.Group {
  if (template) return template.clone(true);
  const root = new T.Group(); root.name = 'sneeze-flower';
  const surface = (name: string, color: string, roughness = .78) => {
    const material = new T.MeshStandardMaterial({ color, roughness }); material.name = name; return material;
  };
  const cream = surface('flower-cream', '#ffe7ac'), green = surface('flower-stem', '#6b914d');
  const backGreen = surface('flower-calyx', '#83a35c'), rose = surface('flower-cheeks', '#f39a9f');
  const brown = surface('flower-eyes', '#483c34', .38), white = surface('flower-eye-glints', '#fff9e8', .3);
  const lips = surface('flower-lips', '#efa873'), inside = surface('flower-mouth-interior', '#783b32');
  const soil = surface('flower-soil', '#a98a66'), vein = surface('flower-leaf-veins', '#b1c67a');
  const petals = surface('flower-petals', '#ffffff'); petals.vertexColors = true;
  const foliage = surface('flower-leaves', '#ffffff'); foliage.vertexColors = true;
  const sphere = new T.SphereGeometry(1, 24, 16);
  const ellipsoid = (parent: T.Object3D, name: string, material: T.Material, position: number[], scale: number[]) => {
    const mesh = new T.Mesh(sphere, material); mesh.name = name; mesh.position.fromArray(position); mesh.scale.fromArray(scale); parent.add(mesh); return mesh;
  };
  const group = (parent: T.Object3D, name: string, x = 0, y = 0, z = 0) => {
    const node = new T.Group(); node.name = name; node.position.set(x, y, z); parent.add(node); return node;
  };
  const tube = (parent: T.Object3D, name: string, material: T.Material, points: number[][], radius: number, segments = 16) => {
    const path = new T.CatmullRomCurve3(points.map(p => new T.Vector3().fromArray(p)));
    const mesh = new T.Mesh(new T.TubeGeometry(path, segments, radius, 7, false), material); mesh.name = name; parent.add(mesh); return mesh;
  };
  const leaf = (parent: T.Object3D, name: string, geometry: T.BufferGeometry) => {
    const mesh = new T.Mesh(geometry, foliage); mesh.name = name; parent.add(mesh);
    const length = name.startsWith('base-') ? .73 : .86;
    tube(parent, name + '-vein', vein, [[0, .008, 0], [0, .10, length * .26], [0, .17, length * .56], [0, .15, length * .89]], .008, 12);
  };
  const base = group(root, 'flower-base');
  ellipsoid(base, 'soil-mound', soil, [0, .07, 0], [.42, .07, .34]);
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5 + .32;
    ellipsoid(base, 'soil-pebble-' + i, soil, [Math.sin(angle) * .29, .038, Math.cos(angle) * .24], [.075, .038, .052]);
  }
  const baseLeaf = leafGeometry(.73, .225), handLeaf = leafGeometry(.86, .27);
  for (let i = 0; i < 5; i++) {
    const pivot = group(base, 'base-leaf-' + i, 0, .075, 0); pivot.rotation.y = i * Math.PI * 2 / 5 + .35;
    pivot.rotation.x = .10; leaf(pivot, 'base-leaf-mesh-' + i, baseLeaf);
  }
  tube(base, 'lower-stem', green, [[0, .10, 0], [-.035, .29, -.01], [0, .48, 0]], .085);
  const neck = group(root, 'flower-neck', 0, .48, 0);
  ellipsoid(neck, 'stem-joint', green, [0, .015, 0], [.083, .11, .083]);
  tube(neck, 'upper-stem', green, [[0, 0, 0], [.045, .34, -.025], [-.025, .72, 0], [0, 1.16, 0]], .074, 24);
  for (const side of [-1, 1]) {
    const pivot = group(neck, side < 0 ? 'flower-leaf-left' : 'flower-leaf-right', side * .015, side < 0 ? .17 : .24, .015);
    pivot.rotation.set(-.22, side * Math.PI / 2, side * .08); leaf(pivot, 'hand-leaf-' + side, handLeaf);
  }
  const head = group(neck, 'flower-head', 0, 1.16, 0), halo = group(head, 'flower-petals');
  const calyx = group(head, 'flower-calyx');
  ellipsoid(calyx, 'flower-back', backGreen, [0, 0, -.08], [.52, .50, .19]);
  const petal = petalGeometry();
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4, mesh = new T.Mesh(petal, petals); mesh.name = 'petal-' + i;
    mesh.position.set(Math.sin(angle) * .63, Math.cos(angle) * .63, -.025); mesh.rotation.z = -angle;
    mesh.rotation.x = -.045; halo.add(mesh);
    const sepal = ellipsoid(calyx, 'sepal-' + i, backGreen, [Math.sin(angle) * .37, Math.cos(angle) * .37, -.16], [.11, .27, .055]);
    sepal.rotation.z = -angle;
  }
  ellipsoid(head, 'flower-face', cream, [0, -.005, .105], [.605, .575, .285]);
  const openEyes = group(head, 'flower-open-eyes', 0, .18, .353);
  const upperLid = eyelidGeometry(true), lowerLid = eyelidGeometry(false);
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'left' : 'right';
    ellipsoid(openEyes, 'eye-' + label, brown, [side * .20, 0, 0], [.066, .092, .033]);
    ellipsoid(openEyes, 'eye-glint-' + label, white, [side * .20 - .018, .031, .030], [.018, .022, .009]);
    // Eyelids rotate over fixed eyeballs, so closing never makes the eyes recede into the face.
    const lids = group(head, 'flower-lids-' + label, side * .20, .18, .353); lids.scale.set(.075, .100, .046);
    const upper = group(lids, 'flower-upper-lid-' + label), lower = group(lids, 'flower-lower-lid-' + label);
    upper.rotation.x = -Math.PI / 2; lower.rotation.x = Math.PI / 2;
    const top = new T.Mesh(upperLid, cream), bottom = new T.Mesh(lowerLid, cream);
    top.name = 'upper-eyelid-' + label; bottom.name = 'lower-eyelid-' + label; upper.add(top); lower.add(bottom);
    const edge = Array.from({ length: 13 }, (_, i) => {
      const phi = i * Math.PI / 12, y = -.20 + .40 * Math.sin(phi), radius = Math.sqrt(1 - y * y);
      return [-Math.cos(phi) * radius, y, Math.sin(phi) * radius + .015];
    });
    tube(upper, 'eyelid-line-' + label, brown, edge, .065, 24);
    tube(head, 'brow-' + label, brown, [[side * .20 - .075, .333, .31], [side * .20, .355, .326], [side * .20 + .075, .34, .31]], .013, 12);
    const cheek = group(head, 'flower-cheek-' + label, side * .335, -.09, .325);
    ellipsoid(cheek, 'cheek-volume-' + label, rose, [0, 0, 0], [.213, .207, .156]);
  }
  const mouth = group(head, 'flower-mouth', 0, -.145, .38);
  ellipsoid(mouth, 'mouth-opening', inside, [0, 0, .013], [.062, .080, .007]);
  const rim = new T.Mesh(new T.TorusGeometry(.069, .014, 8, 32), lips); rim.name = 'mouth-lip'; rim.scale.set(1, 1.22, 1); rim.position.z = .017; mouth.add(rim);
  group(head, 'pollen-emitter', 0, -.145, .46);
  // Batch only rigid pieces; cheeks, leaves and facial expression keep their animation pivots.
  for (const rigid of [base, calyx, halo]) {
    rigid.updateWorldMatrix(true, true);
    const inverse = rigid.matrixWorld.clone().invert(), batches = new Map<T.Material, T.BufferGeometry[]>();
    rigid.traverse(node => {
      if (!(node instanceof T.Mesh)) return;
      const part = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
      part.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse, node.matrixWorld));
      const material = node.material as T.Material;
      if (!batches.has(material)) batches.set(material, []);
      batches.get(material)!.push(part);
    });
    rigid.clear();
    for (const [material, parts] of batches) {
      const merged = mergeGeometries(parts)!;
      const mesh = new T.Mesh(mergeVertices(merged), material); mesh.name = rigid.name + '-' + material.name; merged.dispose();
      rigid.add(mesh); parts.forEach(part => part.dispose());
    }
  }
  root.traverse(node => { if (node instanceof T.Mesh) node.castShadow = node.receiveShadow = true; });
  root.animations = flowerClips();
  root.userData.concept = 'sneeze-flower-2026-11-03';
  const mixer = new T.AnimationMixer(root); mixer.clipAction(root.animations[0]).play(); mixer.update(0); mixer.stopAllAction();
  template = root;
  return root.clone(true);
}
