export const CELL = 5;
export const COLS = 21;
export const ROWS = 23;
export const spots = {
  spawn: [8, 20], tree: [9.5, 18.2], gardener: [3, 18], tools: [2, 11],
  cart: [2.17, 13.2], flowerbed: [2.8, 19.28], pinwheel: [3.95, 17.2],
  bridge: [14, 18], windmill: [13, 18], practice: [17, 17],
  scout: [19, 10], chest: [19, 7], shield: [15, 11], boss: [14, 3],
  shortcut: [11, 15], exit: [8, 15], finish: [8, 11], checkpoint: [15, 7],
} as const;
export type SpotName = keyof typeof spots;
export function position(col: number, row: number) { return { x: (col - 10) * CELL, z: (row - 10) * CELL }; }
export function at(name: SpotName) { return position(spots[name][0], spots[name][1]); }

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
room(18, 7, 18, 15); room(15, 13, 18, 13); room(15, 6, 15, 13);
room(15, 7, 19, 7); room(18, 9, 19, 11);
room(16, 9, 18, 9); room(16, 9, 16, 11); room(15, 11, 16, 11);
room(12, 1, 18, 5); room(11, 3, 11, 16);

export function walkable(x: number, z: number, bridge: boolean, shortcut: boolean, exit: boolean) {
  const c = Math.round(x / CELL + 10), r = Math.round(z / CELL + 10);
  if (!maze[r]?.[c]) return false;
  for (const [name, open] of [['bridge', bridge], ['shortcut', shortcut], ['exit', exit]] as const) {
    if (!open && c === spots[name][0] && r === spots[name][1]) return false;
  }
  return true;
}
