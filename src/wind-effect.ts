import * as T from 'three';

function spiralGeometry() {
  const positions: number[] = [], indices: number[] = [], edge: T.Vector3[] = [];
  for (let i = 0; i <= 64; i++) {
    const t = i / 64, angle = t * Math.PI * 2.7, radius = .16 + .49 * Math.sin(t * Math.PI / 2);
    const y = -.52 + t * 1.12, width = (.10 + t * .09) * Math.sqrt(Math.sin(t * Math.PI));
    for (const side of [-1, 1]) positions.push(Math.cos(angle) * radius, y + side * width, Math.sin(angle) * radius);
    edge.push(new T.Vector3(Math.cos(angle) * radius, y + width, Math.sin(angle) * radius));
    if (i < 64) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const band = new T.BufferGeometry(); band.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  band.setIndex(indices); band.computeVertexNormals();
  return { band, edge: new T.TubeGeometry(new T.CatmullRomCurve3(edge), 64, .028, 5, false) };
}
const spiral = spiralGeometry();
const bodyGeometry = new T.LatheGeometry([
  new T.Vector2(0, -.55), new T.Vector2(.13, -.50), new T.Vector2(.35, -.14),
  new T.Vector2(.55, .27), new T.Vector2(.60, .48), new T.Vector2(.45, .61), new T.Vector2(0, .64),
], 24);
const ringGeometry = new T.TorusGeometry(1, .07, 6, 40);
const leafGeometry = new T.SphereGeometry(1, 10, 6);

export function createWindEffect() {
  const mesh = new T.Group(); mesh.name = 'wind-effect'; mesh.visible = false;
  const gust = new T.Group(); gust.name = 'wind-gust'; mesh.add(gust);
  const material = (color: string, opacity = 1) => new T.MeshBasicMaterial({
    color, transparent: true, opacity, depthWrite: false, side: T.DoubleSide,
  });
  const body = new T.Mesh(bodyGeometry, material('#32c9b2', .54)); body.name = 'wind-volume'; gust.add(body);
  const bands: T.Mesh[] = [], edges: T.Mesh[] = [], leaves: T.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const band = new T.Mesh(spiral.band, material(i % 2 ? '#83ead0' : '#e5fff0'));
    band.rotation.y = i * Math.PI * 2 / 3; band.name = `wind-band-${i}`; gust.add(band); bands.push(band);
    const edge = new T.Mesh(spiral.edge, material('#fffbe2')); edge.rotation.y = band.rotation.y;
    gust.add(edge); edges.push(edge);
    const leaf = new T.Mesh(leafGeometry, material('#4da96c'));
    leaf.name = `wind-leaf-${i}`; leaf.scale.set(.13, .035, .065); gust.add(leaf); leaves.push(leaf);
  }
  const muzzle = new T.Mesh(ringGeometry, material('#ddffdc'));
  muzzle.name = 'wind-muzzle'; mesh.add(muzzle);
  const impact = new T.Group(); impact.name = 'wind-impact'; mesh.add(impact);
  const rings = [new T.Mesh(ringGeometry, material('#efffe8')), new T.Mesh(ringGeometry, material('#72dfb8'))];
  rings[1].rotation.x = Math.PI / 2; impact.add(...rings);

  return { mesh, update(remaining: number, origin: T.Vector3, target: T.Vector3, reducedMotion: boolean, hit: boolean) {
    mesh.visible = remaining > 0;
    if (!mesh.visible) return;
    const elapsed = .5 - remaining, flight = T.MathUtils.clamp(elapsed / .30, 0, 1);
    const fade = 1 - T.MathUtils.smoothstep(elapsed, hit ? .25 : .30, hit ? .34 : .5);
    gust.visible = fade > 0;
    gust.position.lerpVectors(origin, target, flight);
    gust.scale.setScalar((.48 + .52 * T.MathUtils.smoothstep(elapsed, 0, .06)) * (hit ? 1 : 1 + flight * .18));
    gust.rotation.y = reducedMotion ? 0 : elapsed * 11;
    body.material.opacity = .54 * fade;
    bands.forEach((band, i) => {
      (band.material as T.MeshBasicMaterial).opacity = .93 * fade;
      (edges[i].material as T.MeshBasicMaterial).opacity = fade;
      const angle = i * Math.PI * 2 / 3 + (reducedMotion ? 0 : elapsed * 13);
      leaves[i].position.set(Math.cos(angle) * .74, -.25 + i * .27, Math.sin(angle) * .74);
      leaves[i].rotation.set(.35, -angle, -.45);
      (leaves[i].material as T.MeshBasicMaterial).opacity = fade;
    });
    muzzle.visible = elapsed < .12; muzzle.position.copy(origin); muzzle.lookAt(target);
    muzzle.scale.setScalar(.16 + elapsed * 2.5); muzzle.material.opacity = Math.max(0, 1 - elapsed / .12);
    const burst = T.MathUtils.clamp((elapsed - .30) / .20, 0, 1);
    impact.visible = hit && elapsed >= .30; impact.position.copy(target); impact.lookAt(origin);
    rings.forEach((ring, i) => {
      ring.scale.setScalar(.4 + Math.sin(burst * Math.PI / 2) * (i ? .85 : 1.15));
      ring.material.opacity = (1 - burst) * .9;
    });
  } };
}
