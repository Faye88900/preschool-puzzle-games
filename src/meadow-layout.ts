import { at, CELL, maze, spots } from './maze-map';
import { BOSS_ARENA, BOSS_ISLAND_OFFSET_X, gardenCoastX } from './ferry-shore-layout';

export const MEADOW_BOUNDS = { left: -52.5, right: 212.5, top: -52.5, bottom: 62.5 };
const paths = [
  [[-10,50],[-10,40],[-35,40],[-40,40],[-40,5]],
  [[-30,40],[-30,10],[-25,10]],
  [[-35,40],[-36,46.4],[-38.9,48]],
  [[-32,37],[-30,33],[-30,29],[-30,25],[-30,21],[-30,17],[-32,13],[-35,11]],
  [[-10,40],[15,40],[35,40],[35,35],[40,35],[40,20],[25,20],[25,0],
    [55,0],[55,15],[75,15],[75,0],[85,0],[85,-10],[100,-10]],
  [[-10,40],[-10,0],[-19,-24]],
  [[25,0],[5,0],[5,35],[-10,35]],
];
const segments = paths.flatMap(path => path.slice(1).map((b,i) => {
  const a = path[i], dx = b[0]-a[0], dz = b[1]-a[1];
  return { x:a[0], z:a[1], dx, dz, length:dx*dx+dz*dz };
}));
const clearings = [
  [-2.5,41,6.9], [25,0,7.6], [35,35,5.8], [85,-5,4.8],
  [(BOSS_ARENA.left+BOSS_ARENA.right)/2+BOSS_ISLAND_OFFSET_X,(BOSS_ARENA.top+BOSS_ARENA.bottom)/2,15.9],
  [at('cart').x,at('cart').z,2.6], [at('flowerbed').x,at('flowerbed').z,3.2], [-38.9,47.95,1.5],
  ...(['gardener','tools','scout','chest','dock','bossDock'] as const).map(name => {const p=at(name);return [p.x,p.z,1.8];}),
];

// Continuous cover is the default; paths and authored hard surfaces carve it away.
export function meadowCoverageAt(x: number, z: number): number {
  if (x>=27.3&&x<=47.7&&z>=27.3&&z<=52.7) return 0;
  const bossX = x-BOSS_ISLAND_OFFSET_X;
  const boss = bossX>BOSS_ARENA.left+.35 && bossX<BOSS_ARENA.right-.35 && z>BOSS_ARENA.top+.35 && z<BOSS_ARENA.bottom-.35;
  if (!boss) {
    const c=Math.floor((x+CELL/2)/CELL+10), r=Math.floor((z+CELL/2)/CELL+10);
    if (!maze[r]?.[c] || x>gardenCoastX(z)-.4 || c===spots.bridge[0]&&r===spots.bridge[1]) return 0;
  }
  let clearance=Infinity;
  for (const [cx,cz,radius] of clearings) clearance=Math.min(clearance,Math.hypot(x-cx,z-cz)-radius);
  if (clearance<=0) return 0;
  let distance=Infinity;
  if (!boss) for (const s of segments) {
    const t=Math.max(0,Math.min(1,((x-s.x)*s.dx+(z-s.z)*s.dz)/s.length));
    distance=Math.min(distance,Math.hypot(x-s.x-t*s.dx,z-s.z-t*s.dz));
  }
  const edge=.84+.08*Math.sin(x*1.7+Math.sin(z*.8));
  const t=Math.max(0,Math.min(1,Math.min(distance-edge,clearance)/.42));
  return t*t*(3-2*t);
}
