import type * as THREE from 'three';
export function createWeaponSmearEffect(three: typeof THREE, spec: { id: 'weapon-smear'; color: string }, options?: { color?: string; size?: number; speed?: number; detail?: number; density?: number }): {
  group: THREE.Group;
  attachWeapon(object: THREE.Object3D, points: { base: number[]; tip: number[] }): void;
  update(dt: number): void;
  reset(): void;
  stop(): void;
  dispose(): void;
  readonly finished: boolean;
};
