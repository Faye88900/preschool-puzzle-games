// Keep the existing course widths; the two gaps still require the player's jump.
export function assistedVelocity(x: number, z: number, y: number, vx: number): number {
  if (y < .2 || z > 6 || z < -158) return vx;
  const halfWidth = z <= -82 && z > -119 ? 8.5 : 10;
  const margin = halfWidth - Math.abs(x);
  if (margin >= 2.5) return vx;
  const inward = -Math.sign(x);
  const strength = Math.min(1, Math.max(0, (2.5 - margin) / 1.5));
  // Only soften outward motion: the child can always steer back towards safety.
  return inward * Math.max(vx * inward, strength * 3 - (1 - strength) * 7);
}
