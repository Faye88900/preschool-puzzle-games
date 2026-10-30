import { BOSS_ARENA, BOSS_ISLAND_OFFSET_X } from './ferry-shore-layout';

export const CELL = 5;
export const COLS = 31;
export const ROWS = 23;
export const spots = {
  spawn: [8, 20], tree: [9.5, 18.2], gardener: [3, 18], tools: [2, 11],
  cart: [2.17, 13.2], flowerbed: [2.8, 19.28], pinwheel: [3.95, 17.2],
  bridge: [14, 18], windmill: [13, 18], practice: [17, 17],
  choir: [25, 9.12], pavilion: [27, 9], dock: [30, 8],
  scout: [27.6, 10.7], chest: [27, 9.7], shield: [15, 10], boss: [40.5+BOSS_ISLAND_OFFSET_X/CELL, 3.2], bossDock: [36+BOSS_ISLAND_OFFSET_X/CELL, 7],
  shortcut: [11, 15], exit: [8, 15], finish: [8, 11], checkpoint: [36+BOSS_ISLAND_OFFSET_X/CELL, 7],
} as const;
export type SpotName = keyof typeof spots;
export function position(col: number, row: number) { return { x: (col - 10) * CELL, z: (row - 10) * CELL }; }
export function at(name: SpotName) { return position(spots[name][0], spots[name][1]); }
export const MAP_CENTER = position((COLS - 1) / 2, (ROWS - 1) / 2);

// Authored rooms and loops: the wand bridge is the only route into the eastern maze.
export const maze = Array.from({ length: ROWS }, () => Array<boolean>(COLS).fill(false));
function room(left: number, top: number, right: number, bottom: number) {
  for (let r = top; r <= bottom; r++) for (let c = left; c <= right; c++) maze[r][c] = true;
}
room(6, 17, 12, 20); room(8, 21, 10, 21);
room(7, 14, 9, 14); room(8, 15, 8, 16);
room(8, 10, 8, 13);
room(1, 17, 4, 20); room(5, 18, 5, 18);
room(1, 10, 4, 13); room(2, 14, 2, 16); room(4, 14, 4, 16); room(5, 12, 5, 12);
room(13, 18, 16, 18); room(16, 16, 19, 20);
// The courtyard and long garden bend lead to the flowers beside the pond-side rotunda.
room(18, 14, 18, 15); room(16, 14, 18, 14); room(14, 12, 16, 14);
room(15, 11, 15, 12); room(14, 9, 16, 11);
room(17, 10, 21, 10); room(21, 11, 21, 13); room(22, 13, 25, 13);
room(25, 9, 25, 12); room(26, 8, 28, 11); room(29, 8, 30, 8);
// The boss lives across the water. Only the ferry connects the two islands.
room(11, 10, 13, 10); room(11, 11, 11, 16);

export function walkable(x: number, z: number, bridge: boolean, shortcut: boolean, exit: boolean) {
  const bossX=x-BOSS_ISLAND_OFFSET_X;
  if (bossX >= BOSS_ARENA.left && bossX <= BOSS_ARENA.right && z >= BOSS_ARENA.top && z <= BOSS_ARENA.bottom) return true;
  if (bossX >= 127.5 && bossX <= 132.5 && z >= -17.5 && z <= -12.5) return true;
  const c = Math.round(x / CELL + 10), r = Math.round(z / CELL + 10);
  if (!maze[r]?.[c]) return false;
  for (const [name, open] of [['bridge', bridge], ['shortcut', shortcut], ['exit', exit]] as const) {
    if (!open && c === spots[name][0] && r === spots[name][1]) return false;
  }
  return true;
}

