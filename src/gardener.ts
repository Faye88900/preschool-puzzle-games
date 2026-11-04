import * as T from 'three';
import { createWorkshopGuide, setGuideExpression } from './workshop-guide';
import type { Expression } from './character';

const straw = new T.MeshStandardMaterial({ color: '#f5d78e', roughness: .85 });
const band = new T.MeshStandardMaterial({ color: '#87aa6c', roughness: .8 });
const linen = new T.MeshStandardMaterial({ color: '#4e72a8', roughness: .95, side: T.DoubleSide });
const trim = new T.MeshStandardMaterial({ color: '#dfad52', roughness: .75 });
const faces = new Map<Expression, T.MeshStandardMaterial>();

export function setGardenerExpression(root: T.Group, expression: Expression) {
  if (root.userData.gardenerExpression === expression) return;
  const face = root.getObjectByName('face') as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
  if (!faces.has(expression)) {
    setGuideExpression(root, expression);
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 768;
    canvas.getContext('2d')!.drawImage(face.material.map!.image as HTMLCanvasElement, 77, -60, 870, 653);
    const material = face.material.clone(); material.map = new T.CanvasTexture(canvas);
    material.map.colorSpace = T.SRGBColorSpace; faces.set(expression, material);
  }
  face.material = faces.get(expression)!; root.userData.gardenerExpression = root.userData.expression = expression;
}

export function createGardener() {
  const root = createWorkshopGuide(); root.name = 'gardener';
  const torso = root.getObjectByName('guide-torso')!;
  const helmet = root.getObjectByName('hard-hat')!;
  torso.remove(helmet);
  helmet.traverse(node => { if (node instanceof T.Mesh) node.geometry.dispose(); });
  // Keep the face above the bib without changing the shared workshop guide's texture.
  setGardenerExpression(root, 'neutral');
  const costume = new T.Group(); costume.name = 'gardener-costume'; torso.add(costume);
  const part = (name: string, geometry: T.BufferGeometry, material: T.Material, position: number[], scale = [1, 1, 1]) => {
    const mesh = new T.Mesh(geometry, material); mesh.name = name; mesh.position.fromArray(position); mesh.scale.fromArray(scale);
    mesh.castShadow = true; costume.add(mesh); return mesh;
  };
  const ball = new T.SphereGeometry(1, 32, 20);
  part('gardener-hat-brim', ball, straw, [0, .37, -.025], [.77, .065, .72]);
  part('gardener-hat-crown', new T.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), straw, [0, .40, 0], [.59, .37, .56]);
  part('gardener-hat-band', new T.SphereGeometry(1, 40, 6, 0, Math.PI * 2, 1.23, .34), band, [0, .40, 0], [.596, .375, .566]);

  const depth = .53 / .56;
  const cloth = (sample: (u: number, v: number) => T.Vector3) => {
    const positions: number[] = [], indices: number[] = [];
    for (let row = 0; row <= 16; row++) {
      for (let col = 0; col <= 24; col++) positions.push(...sample(col / 24, row / 16).toArray());
    }
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 24; col++) {
        const a = row * 25 + col;
        indices.push(a, a + 1, a + 25, a + 1, a + 26, a + 25);
      }
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
  };
  const apronPoint = (u: number, v: number) => {
    const theta = 1.66 + .95 * v;
    const angle = (u * 2 - 1) * (.32 + .76 * T.MathUtils.smoothstep(theta, 1.66, 2.10));
    return new T.Vector3(.584 * Math.sin(theta) * Math.sin(angle), .584 * Math.cos(theta), -.584 * Math.sin(theta) * Math.cos(angle) * depth);
  };
  const seam = (name: string, points: T.Vector3[]) => part(name,
    new T.TubeGeometry(new T.CatmullRomCurve3(points), 32, .006, 5, false), trim, [0, 0, 0]);
  part('gardener-apron', cloth(apronPoint), linen, [0, 0, 0]);
  for (const side of [0, 1]) seam('gardener-apron-edge' + side, Array.from({ length: 25 }, (_, i) => apronPoint(side, i / 24)));
  for (const v of [0, 1]) seam('gardener-apron-hem' + v, Array.from({ length: 25 }, (_, i) => apronPoint(i / 24, v)));
  const neck = new T.CatmullRomCurve3([
    [-.19, -.05, -.53], [-.35, .10, -.43], [-.44, .28, -.25], [-.33, .40, .15],
    [0, .40, .42], [.33, .40, .15], [.44, .28, -.25], [.35, .10, -.43], [.19, -.05, -.53],
  ].map(p => new T.Vector3().fromArray(p)));
  part('gardener-neck-strap', cloth((u, v) => {
    const p = neck.getPoint(v), normal = p.clone(); normal.z /= depth; normal.normalize();
    const across = neck.getTangent(v).cross(normal).normalize();
    p.addScaledVector(across, (u - .5) * .045); p.z /= depth; p.normalize().multiplyScalar(.592); p.z *= depth;
    return p;
  }), linen, [0, 0, 0]);
  part('gardener-waist-strap', new T.SphereGeometry(.588, 40, 4, -Math.PI * .18, Math.PI * 1.36, 1.97, .10), linen, [0, 0, 0], [1, 1, depth]);
  for (const [name, width, top, height] of [['chest', .13, -.10, .12], ['lower', .36, -.30, .13]] as const) {
    const pocketPoint = (u: number, v: number) => {
      const x = (u - .5) * width, y = top - v * height;
      return new T.Vector3(x, y, -Math.sqrt(.599 ** 2 - x * x - y * y) * depth);
    };
    part('gardener-pocket-' + name, cloth(pocketPoint), linen, [0, 0, 0]);
    for (const side of [0, 1]) seam('gardener-pocket-side-' + name + side, Array.from({ length: 9 }, (_, i) => pocketPoint(side, i / 8)));
    seam('gardener-pocket-bottom-' + name, Array.from({ length: 9 }, (_, i) => pocketPoint(i / 8, 1)));
    seam('gardener-pocket-opening-' + name, Array.from({ length: 9 }, (_, i) => pocketPoint(i / 8, 0)));
    if (name === 'lower') seam('gardener-pocket-divider', Array.from({ length: 9 }, (_, i) => pocketPoint(.5, i / 8)));
  }
  for (const side of [-1, 1]) {
    part('gardener-apron-button' + side, ball, trim, [side * .18, -.052, -.545], [.022, .022, .012]);
    const tie = part('gardener-back-tie' + side, ball, linen, [side * .075, -.25, .50], [.10, .04, .025]);
    tie.rotation.z = side * .3;
    const tail = part('gardener-tie-tail' + side, ball, linen, [side * .04, -.32, .47], [.028, .08, .02]);
    tail.rotation.z = side * .28;
  }
  part('gardener-tie-knot', ball, straw, [0, -.25, .52], [.04, .045, .025]);
  return root;
}
