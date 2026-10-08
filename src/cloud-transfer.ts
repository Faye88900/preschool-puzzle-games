import * as T from 'three';
import { setCharacterExpression } from './character';

/** Takes over an existing scene for boarding or landing; caller suspends its normal tick. */
export function cloudTransfer(scene: T.Scene, camera: T.PerspectiveCamera, player: T.Group, arriving: boolean, done: () => void) {
  setCharacterExpression(player, 'neutral');
  const origin = player.position.clone(), cameraOrigin = camera.position.clone();
  const rotation = player.rotation.clone(), cameraRotation = camera.quaternion.clone();
  const marker = player.getObjectByName('player-marker');
  const markerVisible = marker?.visible ?? false;
  if (marker) marker.visible = false;
  const avatar = player.getObjectByName('avatar')!;
  const geometry = new T.SphereGeometry(1, 32, 20);
  const material = new T.MeshStandardMaterial({ color: '#fff5e4', roughness: 1 });
  const cloud = new T.Group(); scene.add(cloud);
  for (let i = 0; i < 7; i++) {
    const puff = new T.Mesh(geometry, material);
    puff.position.set(Math.sin(i * 2.4) * .85, Math.cos(i * 1.7) * .12, Math.cos(i * 2.4) * .5);
    puff.scale.set(.75, .4, .6); cloud.add(puff);
  }
  const trailGeometry = new T.BufferGeometry();
  const points: number[] = [];
  for (let i = 0; i < 9; i++) {
    const x = Math.sin(i * 2.4) * 1.4, y = -.15 + Math.cos(i * 1.7) * .28;
    points.push(x,y,.55 + i % 3 * .3,x * 1.25,y - .3,2.4 + i % 3 * .5);
  }
  trailGeometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
  const trailMaterial = new T.LineBasicMaterial({ color: '#fff8df', transparent: true, opacity: 0, depthWrite: false });
  const trails = new T.LineSegments(trailGeometry, trailMaterial); scene.add(trails);

  const softness = document.createElement('canvas'); softness.width = softness.height = 64;
  const context = softness.getContext('2d')!;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, '#ffffffff'); gradient.addColorStop(.4, '#ffffffaa'); gradient.addColorStop(1, '#ffffff00');
  context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
  const texture = new T.CanvasTexture(softness);
  const vapor = new T.SpriteMaterial({ map: texture, color: '#fff8eb', transparent: true, opacity: .5, depthWrite: false });
  const puffs = Array.from({ length: 10 }, (_, i) => {
    const puff = new T.Sprite(vapor), angle = i / 10 * Math.PI * 2;
    puff.position.set(Math.cos(angle) * 1.2, .05, Math.sin(angle) * .55); puff.scale.set(.6, .42, 1);
    cloud.add(puff); return puff;
  });
  const contactMaterial = new T.MeshBasicMaterial({ map: texture, color: '#8c7897', transparent: true, opacity: 0, depthWrite: false });
  const contact = new T.Mesh(new T.PlaneGeometry(1.1, .8), contactMaterial);
  contact.rotation.x = -Math.PI / 2; contact.position.y = .49; cloud.add(contact);
  const limbs = [-1, 1].map(side => ({ side, arm: player.getObjectByName('arm' + side)!, foot: player.getObjectByName('foot' + side)!, ear: player.getObjectByName('ear' + side)! }));
  const cover = document.createElement('div');
  cover.style.cssText = 'position:fixed;inset:0;z-index:100;pointer-events:auto;opacity:0;background:radial-gradient(ellipse at 25% 65%,#fffdf7,transparent 70%),linear-gradient(#dceaf5,#fffaf1 60%,#d7e4f2)';
  cover.setAttribute('aria-label', arriving ? '乘云降落' : '登云前往解谜花园');
  if (!arriving) document.body.append(cover);
  const mist = document.createElement('div');
  mist.style.cssText = 'position:absolute;inset:-50%;background:radial-gradient(ellipse at 15% 60%,#fff 8%,#f3f6facc 20%,transparent 38%),radial-gradient(ellipse at 80% 30%,#fff7ea 8%,#f1f5faaa 22%,transparent 40%);opacity:0';
  cover.append(mist);
  document.body.classList.add('journey-active');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let elapsed = 0, last = performance.now(), complete = false;
  const target = new T.Vector3(), smooth = T.MathUtils.smootherstep;
  const flight = new T.CatmullRomCurve3([
    new T.Vector3(1.3, -.5, -.65), new T.Vector3(2.6, .8, .6),
    new T.Vector3(4, 3, -5), new T.Vector3(1, 9, -24)
  ]);
  const tangent = new T.Vector3();
  const diagnostics = new URLSearchParams(location.search).has('test');
  let touchdown = 0, jumpHeight = 0, wobble = 0;
  return (now: number) => {
    const dt = Math.min((now - last) / 1000, .05); last = now;
    if (!document.hidden) elapsed += dt;
    const t = reduced ? 10 : elapsed;
    if (arriving) {
      const descent = smooth(t, 0, 1.1), hop = smooth(t, 1.05, 1.7);
      cloud.position.copy(origin).add(new T.Vector3(0, 3 * (1 - descent) - .72, -2 * (1 - descent)));
      player.position.copy(origin).add(new T.Vector3(0, 3 * (1 - descent) + Math.sin(hop * Math.PI) * .55, -2 * (1 - descent)));
      cloud.scale.setScalar(1 - smooth(t, 1.45, 1.9));
      camera.position.copy(cameraOrigin).add(new T.Vector3(0, 2 * (1 - descent), 3 * (1 - descent)));
      target.copy(origin); target.y += .6; camera.lookAt(target);
      avatar.scale.y = 1 - Math.sin(Math.PI * smooth(t, 1.65, 1.95)) * .15;
    } else {
      const dock = smooth(t, 0, 1.2), board = smooth(t, 2.7, 3.6), fly = smooth(t, 4.25, 7.2);
      const hop = T.MathUtils.clamp((t - 2.7) / .9, 0, 1);
      const crouch = Math.sin(Math.PI * smooth(t, 2.35, 2.7));
      touchdown = Math.sin(Math.PI * smooth(t, 3.6, 4.02));
      const rebound = Math.sin(Math.PI * smooth(t, 4.02, 4.45));
      wobble = Math.sin(smooth(t, 3.6, 4.25) * Math.PI * 2) * .16 * (1 - smooth(t, 3.9, 4.25));
      const idle = Math.sin(t * 2.5) * .04 * (1 - board);
      flight.getPoint(fly, cloud.position).add(origin);
      cloud.position.x += 3.8 * (1 - dock);
      cloud.position.z -= 1.8 * (1 - dock);
      cloud.position.y += idle - touchdown * .16 + rebound * .09;
      flight.getTangent(fly, tangent);
      const appear = smooth(t, 0, .5);
      cloud.scale.set(appear * (1 + touchdown * .1), appear * (1 - touchdown * .27 + rebound * .1), appear * (1 + touchdown * .07));
      cloud.rotation.z = .06 * (1 - dock) + wobble * .5 - tangent.x * .12 * smooth(t, 4.25, 4.7);
      player.position.copy(origin).lerp(target.copy(cloud.position).add(new T.Vector3(0, .96 - touchdown * .08, 0)), board);
      jumpHeight = 4 * hop * (1 - hop) * 1.25;
      player.position.y += jumpHeight - crouch * .1;
      const turnBack = smooth(t, 0.95, 1.4);
      const wave = smooth(t, 1.3, 1.55) * (1 - smooth(t, 2.1, 2.35));
      const faceCloud = smooth(t, 2.2, 3.2);
      const farewell = rotation.y + Math.atan2(Math.sin(Math.PI + 1 - rotation.y), Math.cos(Math.PI + 1 - rotation.y)) * turnBack;
      player.rotation.y = farewell + Math.atan2(Math.sin(-farewell), Math.cos(-farewell)) * faceCloud;
      const flightHeading = Math.atan2(-tangent.x, -tangent.z);
      player.rotation.y += Math.atan2(Math.sin(flightHeading - player.rotation.y), Math.cos(flightHeading - player.rotation.y)) * smooth(t, 4.25, 4.9);
      avatar.rotation.set(-.12 * board - .12 * fly + crouch * .08, 0, -.06 * Math.sin(board * Math.PI) + wobble);
      const squash = crouch * .14 + touchdown * .16 - Math.sin(hop * Math.PI) * .06;
      avatar.scale.set(1 + squash * .4, 1 - squash, 1 + squash * .3);
      avatar.position.y = -squash * .35;
      for (const { side, arm, foot, ear } of limbs) {
        const waving = side === -1 ? wave : 0;
        arm.position.set(side * (.49 - waving * .08), -.13 + waving * .43, -.04);
        arm.rotation.set(-fly * .3, 0, side * (.2 + Math.sin(hop * Math.PI) * .55 + fly * .25 + Math.abs(wobble) * 2) - waving * (.85 + Math.sin(t * 12) * .35));
        foot.position.set(side * .3, -.535 + Math.sin(hop * Math.PI) * .12 + (side === -1 ? Math.max(0, wobble) * .55 : 0), -.13);
        foot.rotation.set(-Math.sin(hop * Math.PI) * .25 + touchdown * .12, side * fly * .12, 0);
        ear.rotation.x = -.12 * Math.sin(hop * Math.PI) + touchdown * .16 - rebound * .12 + fly * .1;
      }
      contactMaterial.opacity = .26 * smooth(t, 3.35, 3.6);
      const scatter = smooth(t, 3.6, 4.35);
      puffs.forEach((puff, i) => {
        const angle = i / puffs.length * Math.PI * 2;
        puff.position.set(Math.cos(angle) * (1.2 + scatter * .7), .05 + Math.sin(i * 2) * .1, Math.sin(angle) * (.55 + scatter * .4));
        puff.scale.setScalar(.6 * (1 - scatter) + .13); puff.scale.y *= .7;
      });
      trails.position.copy(cloud.position); trails.position.z += (t * 2 % 1) * .25;
      trails.rotation.y = Math.atan2(-tangent.x, -tangent.z);
      trails.scale.z = 1 + fly; trailMaterial.opacity = smooth(t, 4.25, 4.8) * .7;
      target.copy(origin).add(new T.Vector3(6.2, 2.8 + fly * 1.2, 4.4 - fly * 1.5));
      camera.position.copy(cameraOrigin).lerp(target, smooth(t, 0, 1.2));
      target.copy(origin).lerp(player.position, .75); target.y += .2;
      camera.lookAt(target); camera.quaternion.slerp(cameraRotation, 1 - smooth(t, 0, 1.2));
      cover.style.opacity = String(smooth(t, 6.2, 7.2));
      mist.style.opacity = String(smooth(t, 5.1, 6.4)); mist.style.transform = 'scale(' + (1 + fly) + ')';
    }
    const stage = arriving ? 'landing' : t < 1.3 ? 'turning' : t < 2.35 ? 'waving' : t < 4.25 ? 'boarding' : t < 6.2 ? 'following' : 'covered';
    Object.assign(window, { __TRANSFER_STAGE__: stage });
    if (diagnostics) Object.assign(window, { __TRANSFER_DIAGNOSTICS__: { elapsed: t, wobble, cameraDistance: camera.position.distanceTo(player.position), touchdown, jumpHeight, cloud: cloud.position.toArray(), cloudHeight: cloud.scale.y, markerVisible: marker?.visible, contact: contactMaterial.opacity } });
    if (!complete && t >= (arriving ? 2 : 7.3)) {
      complete = true; scene.remove(cloud, trails); geometry.dispose(); material.dispose(); trailGeometry.dispose(); trailMaterial.dispose();
      contact.geometry.dispose(); contactMaterial.dispose(); vapor.dispose(); texture.dispose();
      if (marker) marker.visible = markerVisible;
      if (arriving) player.position.copy(origin); avatar.scale.setScalar(1); avatar.rotation.x = 0; avatar.position.y = 0;
      if (arriving) { player.rotation.copy(rotation); document.body.classList.remove('journey-active'); }
      done();
    }
    return complete;
  };
}
