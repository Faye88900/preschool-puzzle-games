import * as T from 'three';
import { animateCharacterDetails } from './character';

// The original first-level locomotion, shared by both levels.
export const movement = { speed: 7.2, step: 1 / 120, damping: .2, friction: .05, gait: 1.9 };
export const acceleration = (grounded: boolean, dt: number) => 1 - Math.exp(-(grounded ? 15 : 5.5) * dt);

export function animateWalk(mesh: T.Group, heading: number, gait: number, speed: number, grounded: boolean, reducedMotion: boolean, dt: number, carrying = false) {
  const blend = dt === 0 ? 1 : 1 - Math.exp(-16 * dt);
  const angle = Math.atan2(Math.sin(heading - mesh.rotation.y), Math.cos(heading - mesh.rotation.y));
  mesh.rotation.y += angle * blend;
  const avatar = mesh.getObjectByName('avatar')!;
  avatar.rotation.x = T.MathUtils.lerp(avatar.rotation.x, speed > .2 ? -.1 : 0, blend);
  avatar.rotation.z = T.MathUtils.lerp(avatar.rotation.z, reducedMotion || !grounded ? 0 : Math.sin(gait) * .055, blend);
  avatar.position.y = reducedMotion || !grounded ? 0 : Math.abs(Math.sin(gait)) * .1 * Math.min(speed, 1);
  for (const side of [-1, 1]) {
    const swing = Math.sin(gait + (side === 1 ? Math.PI : 0)) * Math.min(.42, speed * .08);
    mesh.getObjectByName('foot' + side)!.rotation.x = grounded ? swing : -.18;
    const arm = mesh.getObjectByName('arm' + side)!;
    arm.rotation.x = carrying ? T.MathUtils.lerp(arm.rotation.x, 1.1, blend) : -swing * 1.45;
    arm.rotation.z = T.MathUtils.lerp(arm.rotation.z, side * .35, blend);
  }
  if (mesh.name === 'character-a') animateCharacterDetails(mesh, gait, speed, grounded, reducedMotion, blend);
  return blend;
}
