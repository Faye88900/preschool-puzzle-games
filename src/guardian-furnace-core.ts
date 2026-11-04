import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const FURNACE_CORE_CLIPS = { closed: 2.4, open: .75, exposed: 2.4, hit: .55, close: .65 } as const;
const DOOR_TRAVEL = .57;
let template: T.Group | undefined;

function extrude(shape: T.Shape, depth: number, bevel = .025) {
  return new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, steps: 1, curveSegments: 40 });
}

function ringShape(outer: number, inner: number) {
  const shape = new T.Shape(); shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const hole = new T.Path(); hole.absarc(0, 0, inner, 0, Math.PI * 2, true); shape.holes.push(hole); return shape;
}

function swirlRibbon() {
  const vertices: number[] = [], indices: number[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, angle = t * Math.PI * 1.35, r = .035 + t * .30;
    const width = .012 + Math.sin(t * Math.PI) * .049;
    for (const side of [-1, 1]) {
      const radius = r + side * width, x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
      vertices.push(x, y, Math.sqrt(Math.max(0, .49 ** 2 - x * x - y * y)) * .82 + .014);
    }
    if (i < 40) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function clips() {
  const clip = (name: keyof typeof FURNACE_CORE_CLIPS, frames: [number, number, number, number][]) => {
    const times = frames.map(f => f[0]);
    return new T.AnimationClip(name, FURNACE_CORE_CLIPS[name], [
      ...[-1, 1].map(side => new T.VectorKeyframeTrack(`furnace-door-${side < 0 ? 'left' : 'right'}.position`, times, frames.flatMap(f => [side * DOOR_TRAVEL * f[1], 0, 0]))),
      new T.VectorKeyframeTrack('furnace-energy.scale', times, frames.flatMap(f => [f[2], f[2], f[2]])),
      new T.VectorKeyframeTrack('furnace-hit.scale', times, frames.flatMap(f => [f[3], f[3], f[3]])),
    ]);
  };
  return [
    clip('closed', [[0, 0, 1, 0], [1.2, 0, 1.01, 0], [2.4, 0, 1, 0]]),
    clip('open', [[0, 0, 1, 0], [.12, .03, 1, 0], [.35, .46, 1.025, 0], [.60, .96, 1.015, 0], [.75, 1, 1, 0]]),
    clip('exposed', [[0, 1, 1, 0], [1.2, 1, 1.035, 0], [2.4, 1, 1, 0]]),
    clip('hit', [[0, 1, 1, 0], [.07, 1, .92, .55], [.17, 1, 1.09, 1], [.33, 1, 1.02, 1.45], [.55, 1, 1, 0]]),
    clip('close', [[0, 1, 1, 0], [.12, .95, 1, 0], [.36, .42, 1, 0], [.55, .02, 1, 0], [.65, 0, 1, 0]]),
  ];
}

/** Front is local +Z. Centered mount origin; animation clips are independent of the guardian rig. */
export function createGuardianFurnaceCore(): T.Group {
  if (template) return template.clone(true);
  const root = new T.Group(); root.name = 'guardian-furnace-core';
  const surface = (name: string, color: string, metalness: number, roughness: number) => {
    const material = new T.MeshStandardMaterial({ color, metalness, roughness }); material.name = name; return material;
  };
  const armor = surface('furnace-charcoal', '#30343c', .48, .48);
  const iron = surface('furnace-recess', '#151a21', .25, .69);
  const bronze = surface('furnace-bronze', '#99713e', .65, .39);
  const brass = surface('furnace-brass', '#d8ac59', .68, .32);
  const amber = new T.MeshPhysicalMaterial({ color: '#ee8d12', emissive: '#ff920d', emissiveIntensity: .22, metalness: .08, roughness: .22, clearcoat: 1, clearcoatRoughness: .14 }); amber.name = 'furnace-amber';
  const light = new T.MeshStandardMaterial({ color: '#fff0a4', emissive: '#ffda60', emissiveIntensity: 1.5, roughness: .35 }); light.name = 'furnace-warm-light';
  const box = new RoundedBoxGeometry(1, 1, 1, 2, .09);
  const part = (parent: T.Object3D, name: string, geometry: T.BufferGeometry, material: T.Material, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) => {
    const mesh = new T.Mesh(geometry, material); mesh.name = name; mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const housing = new T.Group(); housing.name = 'furnace-housing'; root.add(housing);
  const outline = new T.Shape([[-1.12, -.52], [-.80, -.96], [.80, -.96], [1.12, -.52], [1.16, .59], [.84, .99], [-.84, .99], [-1.16, .59]].map(p => new T.Vector2(...p as [number, number])));
  const bore = new T.Path(); bore.absarc(0, 0, .74, 0, Math.PI * 2, true); outline.holes.push(bore);
  part(housing, 'furnace-mount', extrude(outline, .22, .045), armor, 0, 0, -.10);
  const back = part(housing, 'furnace-back', new T.CylinderGeometry(.79, .79, .055, 56), iron, 0, 0, -.095); back.rotation.x = Math.PI / 2;
  part(housing, 'furnace-inner-wall', extrude(ringShape(.81, .66), .44, .015), iron, 0, 0, -.08);
  part(housing, 'furnace-bronze-collar', extrude(ringShape(.91, .77), .13, .022), bronze, 0, 0, .27);
  part(housing, 'furnace-rolled-rim', new T.TorusGeometry(.795, .037, 8, 64), brass, 0, 0, .43);
  for (const side of [-1, 1]) {
    for (const y of [-.43, .43]) {
      part(housing, 'furnace-slide-rail', box, iron, side * .88, y, .52, .59, .10, .13);
      part(housing, 'furnace-rail-inlay', box, bronze, side * .94, y, .60, .45, .026, .028);
    }
    part(housing, 'furnace-anchor', box, brass, 0, side * .89, .49, .21, .28, .25);
    part(housing, 'furnace-anchor-inset', box, bronze, 0, side * .90, .623, .11, .11, .012);
    for (const y of [-.69, .69]) {
      const screw = part(housing, 'furnace-bolt', new T.CylinderGeometry(.055, .055, .04, 8), bronze, side * .87, y, .18); screw.rotation.x = Math.PI / 2;
    }
  }
  const energy = new T.Group(); energy.name = 'furnace-energy'; energy.position.z = .16; root.add(energy);
  part(energy, 'furnace-orb', new T.SphereGeometry(.49, 40, 28), amber, 0, 0, 0, 1, 1, .82);
  const swirl = new T.Group(); swirl.name = 'furnace-swirl'; energy.add(swirl);
  const ribbon = swirlRibbon();
  for (let i = 0; i < 3; i++) part(swirl, 'furnace-swirl-arm-' + i, ribbon, light).rotation.z = i * Math.PI * 2 / 3;
  for (const side of [-1, 1]) {
    const door = new T.Group(); door.name = 'furnace-door-' + (side < 0 ? 'left' : 'right'); root.add(door);
    const shape = new T.Shape();
    for (let i = 0; i <= 40; i++) {
      const angle = -Math.PI / 2 + i / 40 * Math.PI, x = side * (.012 + Math.cos(angle) * .69), y = Math.sin(angle) * .69;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath(); part(door, 'furnace-door-plate', extrude(shape, .07, .018), armor, 0, 0, .62);
    const arc = new T.CatmullRomCurve3(Array.from({ length: 41 }, (_, i) => {
      const angle = -Math.PI / 2 + i / 40 * Math.PI;
      return new T.Vector3(side * (.012 + Math.cos(angle) * .68), Math.sin(angle) * .68, .715);
    }));
    part(door, 'furnace-door-arc', new T.TubeGeometry(arc, 48, .035, 7, false), brass);
    part(door, 'furnace-door-lip', box, bronze, side * .025, 0, .708, .045, 1.32, .045);
    for (const x of [.20, .41, .57]) {
      const height = Math.sqrt(.66 ** 2 - x ** 2) * 2 - .10;
      part(door, 'furnace-door-rib', box, iron, side * x, 0, .708, .024, height, .022);
    }
    for (const y of [-.43, .43]) part(door, 'furnace-slider', box, bronze, side * .54, y, .60, .17, .13, .18);
  }
  const hit = new T.Group(); hit.name = 'furnace-hit'; hit.position.z = .80; hit.scale.setScalar(0); root.add(hit);
  const flashMaterial = new T.MeshBasicMaterial({ color: '#fff0a4', toneMapped: false }); flashMaterial.name = 'furnace-hit-light';
  part(hit, 'furnace-hit-ring', new T.TorusGeometry(.65, .013, 5, 56), flashMaterial);
  const star = new T.Shape();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? .018 : .064; if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r); else star.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  star.closePath(); const starGeometry = new T.ShapeGeometry(star);
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; part(hit, 'furnace-hit-spark', starGeometry, flashMaterial, Math.cos(a) * .75, Math.sin(a) * .75, .02).rotation.z = a; }
  // Batch rigid details while retaining the two door pivots and animated energy assembly.
  for (const group of [housing, swirl, hit, root.getObjectByName('furnace-door-left')!, root.getObjectByName('furnace-door-right')!]) {
    const batches = new Map<T.Material, T.BufferGeometry[]>();
    for (const mesh of [...group.children]) {
      if (!(mesh instanceof T.Mesh)) continue; mesh.updateMatrix();
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone(); geometry.applyMatrix4(mesh.matrix);
      const material = mesh.material as T.Material; if (!batches.has(material)) batches.set(material, []); batches.get(material)!.push(geometry); group.remove(mesh);
    }
    for (const [material, geometries] of batches) {
      const merged = mergeGeometries(geometries)!; part(group, group.name + '-' + material.name, mergeVertices(merged), material); merged.dispose(); geometries.forEach(g => g.dispose());
    }
  }
  hit.traverse(node => { if (node instanceof T.Mesh) node.castShadow = node.receiveShadow = false; });
  swirl.traverse(node => { if (node instanceof T.Mesh) node.castShadow = node.receiveShadow = false; });
  root.animations = clips(); root.userData.concept = 'guardian-furnace-core-selected-v3';
  root.userData.front = '+Z'; root.userData.doorTravel = DOOR_TRAVEL;
  template = root; return root.clone(true);
}
