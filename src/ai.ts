/** AI emits exactly the same movement intents as a human; physics owns movement. */
export type AIRunner = {
  id: number; x: number; y: number; z: number; vx: number; vz: number;
  speed: number; lane: number; jumpCD: number; diveCD: number; stuck: number;
};
export type AIHazard = { kind: string; x: number; z: number; phase: number; rate?: number };
export type AIStyle = 'brave' | 'careful' | 'playful';
export type AIState = { targetX: number; think: number; mode: string; decisions: number; style: AIStyle; phase: number; risk: number; startDelay: number; jumps: number; dives: number };
export const createBrain = (id: number): AIState => ({
  targetX: (id % 4 - 1.5) * 1.4, think: id * .013, mode: 'run', decisions: 0,
  style: (['brave', 'careful', 'playful'] as const)[id % 3], phase: id * 2.399,
  risk: .35 + (id * 37 % 50) / 100, startDelay: .08 + id % 4 * .09, jumps: 0, dives: 0,
});
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function steerAI(c: AIRunner, others: AIRunner[], hazards: AIHazard[], brain: AIState, time: number, dt: number) {
  const progress = -c.z;
  const side = c.id % 2 ? 1 : -1;
  const sway = brain.style === 'playful' ? 1.25 : brain.style === 'brave' ? .75 : .45;
  const preferred = clamp(c.lane + Math.sin(progress * .055 + brain.phase) * sway, -7.4, 7.4);
  brain.think -= dt;
  // Perception is deliberately slower than physics, with a persistent route to avoid jitter.
  if (brain.think <= 0) {
    brain.think = .1 + c.id % 5 * .025 + (brain.style === 'careful' ? .045 : 0);
    brain.decisions++;
    brain.mode = 'run';
    let target = preferred;
    const spinner = hazards.find(h => h.kind === 'spinner' && c.z - h.z > -6 && c.z - h.z < 13);
    const bumper = hazards.find(h => h.kind === 'bumper' && c.z - h.z > -1.6 && c.z - h.z < 13);
    const pendulum = hazards.find(h => h.kind === 'pendulum' && c.z - h.z > -2 && c.z - h.z < 13);
    if ((progress > 76 && progress < 86) || (progress > 94 && progress < 105)) {
      target = clamp(c.lane * .72, -6.4, 6.4);
      brain.mode = 'gap';
    } else if (bumper || spinner || pendulum) {
      const hazard = bumper || spinner || pendulum!;
      const eta = Math.max(0, c.z - hazard.z) / Math.max(2.5, -c.vz);
      let best = Infinity;
      for (const lane of [-7.4, -3.6, 0, 3.6, 7.4]) {
        let score = Math.abs(lane - c.x) * .35 + Math.abs(lane - preferred) * .23 + Math.abs(lane - brain.targetX) * .2;
        for (const h of hazards) {
          if (Math.abs(h.z - hazard.z) > .5) continue;
          if (h.kind === 'bumper') score += Math.max(0, 1.7 - Math.abs(lane - h.x)) * 12;
          if (h.kind === 'pendulum') {
            const hx = Math.sin((time + eta) * .9 + h.phase) * 4.5;
            score += Math.max(0, 2.1 - Math.abs(lane - hx)) * 6;
          }
          if (h.kind === 'spinner') {
            const theta = (time + eta) * (h.rate ?? .8) + h.phase;
            const reach = Math.abs(Math.cos(theta)) * 6.9;
            score += Math.max(0, 1.8 - Math.abs(lane - h.x)) * 10;
            // Brave runners jump across; cautious ones pay a small detour for a clear tip.
            const caution = brain.style === 'careful' ? 1.05 : brain.style === 'brave' ? .2 : .45;
            score += Math.max(0, reach + .9 - Math.abs(lane)) * caution;
          }
        }
        for (const other of others) {
          if (other.id !== c.id && Math.abs(other.z - c.z) < 5) score += Math.max(0, 1.5 - Math.abs(lane - other.x)) * .8;
        }
        if (score < best) { best = score; target = lane; }
      }
      brain.mode = bumper ? 'slalom' : spinner ? 'time-jump' : 'dodge';
    }
    if (c.stuck > .65) {
      target = clamp(c.x + side * 2.1, -7.3, 7.3);
      brain.mode = 'recover';
    }
    brain.targetX = clamp(target, -7.4, 7.4);
  }

  let x = clamp((brain.targetX - c.x) * 1.1 - c.vx * .13, -1, 1);
  let z = -1;
  let blocked = false, jump = false;
  for (const other of others) {
    if (other.id === c.id || Math.abs(other.y - c.y) > 1.3) continue;
    const dx = c.x - other.x, ahead = c.z - other.z;
    if (ahead > -.5 && ahead < 2.5 && Math.abs(dx) < 1.25) {
      x += (Math.abs(dx) > .1 ? Math.sign(dx) : side) * (1 - Math.abs(dx) / 1.25) * .65;
      if (ahead > 0 && ahead < 1.2) { z = -.7; blocked = true; }
    }
  }
  for (const h of hazards) {
    if (h.kind !== 'spinner' || Math.abs(c.z - h.z) > 7) continue;
    if (-h.z > 70 && progress > 76) continue;
    if ([82, 100].some(edge => progress > edge - 3.5 && progress < edge + .35)) continue;
    const lead = .28 + c.id % 3 * .025;
    const theta = (time + lead) * (h.rate ?? .8) + h.phase;
    const dx = c.x + c.vx * lead - h.x, dz = c.z + c.vz * lead - h.z;
    const along = dx * Math.cos(theta) - dz * Math.sin(theta);
    const across = dx * Math.sin(theta) + dz * Math.cos(theta);
    if (Math.abs(along) < 7.4 && Math.abs(across) < 1.05 + brain.risk * .55) jump = true;
  }
  // Jump close to the lip: leaving too early lands slower runners inside the gap.
  if ([82, 100].some(edge => progress > edge - .45 && progress < edge + .35)) jump = true;
  if (jump && c.jumpCD > 0 && brain.style === 'careful' && brain.mode === 'time-jump') { z = -.42; blocked = true; brain.mode = 'wait'; }
  if (blocked && brain.mode === 'run') brain.mode = 'overtake';
  if (c.stuck > .8) jump = true;
  // Last-metre correction protects the narrow gap platforms without teleporting a runner.
  const edge = progress > 82 && progress < 119 ? 7.2 : 8.8;
  if (Math.abs(c.x) > edge) x = -Math.sign(c.x);
  x = clamp(x, -1, 1);
  const length = Math.hypot(x, z);
  if (length > 1) { x /= length; z /= length; }
  const openStraight = (progress > 4 && progress < 22) || (progress > 50 && progress < 57) || (progress > 87 && progress < 95) || (progress > 119 && progress < 125) || progress > 142;
  const dive = openStraight && !blocked && Math.abs(x) < .3 && c.diveCD <= 0 && brain.style !== 'careful';
  return { x, z, jump: jump && c.jumpCD <= 0, dive };
}
