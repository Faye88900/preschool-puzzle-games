import * as T from 'three';
import { CELL, COLS, ROWS, MAP_CENTER } from './maze-map';

export function createMazeIsland() {
  const root = new T.Group(); root.name = 'maze-island';
  const rock = new T.MeshStandardMaterial({ color: '#c6b5bd', roughness: 1, flatShading: true });
  const vertices: number[] = [], indices: number[] = [], count = 64;
  const rings = [[-.95, 1], [-4, 1.015], [-12, .94], [-23, .69], [-32, .32], [-37, 0]];
  // Match the existing lawn perimeter exactly; all new land lies below the playable floor.
  rings.forEach(([y, scale], ring) => {
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2, x = Math.cos(angle), z = Math.sin(angle), edge = Math.max(Math.abs(x), Math.abs(z));
      const ripple = ring === 0 ? 1 : 1 + .025 * Math.sin(i * 2.1 + ring);
      vertices.push(MAP_CENTER.x + x / edge * COLS * CELL / 2 * scale * ripple, y + (ring === 0 ? 0 : Math.sin(i * 1.7) * scale), MAP_CENTER.z + z / edge * ROWS * CELL / 2 * scale * ripple);
      if (ring < rings.length - 1) {
        const a = ring * count + i, b = ring * count + (i + 1) % count;
        indices.push(a, b, a + count, b, b + count, a + count);
      }
    }
  });
  const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  const shell = new T.Mesh(geometry, rock); shell.name = 'maze-island-rock'; root.add(shell);
  const sphere = new T.SphereGeometry(1, 12, 8), dummy = new T.Object3D();
  const clouds = new T.InstancedMesh(sphere, new T.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#dceaff', emissiveIntensity: .25 }), 120);
  clouds.name = 'maze-island-clouds';
  for (let i = 0; i < 24; i++) {
    const angle = i / 24 * Math.PI * 2, radius = Math.max(82,COLS*CELL/2+28) + (i % 3) * 10;
    for (let j = 0; j < 5; j++) {
      dummy.position.set(MAP_CENTER.x + Math.cos(angle) * radius + Math.sin(j * 2.4) * 6, -7 + (i % 4) * 5 + Math.sin(j) * 1.5, MAP_CENTER.z + Math.sin(angle) * radius + Math.cos(j * 2.4) * 4);
      dummy.scale.set(5 + j % 3, 3.2 + j % 3, 4.5); dummy.updateMatrix(); clouds.setMatrixAt(i * 5 + j, dummy.matrix);
    }
  }
  clouds.computeBoundingSphere(); root.add(clouds);
  const islands = [[-82, 8, -28, 7], [-75, -3, 45, 5], [78, 10, -48, 8], [90, 2, 32, 6], [-28, 5, -82, 6], [37, -6, 91, 7]];
  const cliffs = new T.InstancedMesh(new T.CylinderGeometry(1, .12, 1.5, 9, 2).translate(0, -.75, 0), rock, islands.length);
  const caps = new T.InstancedMesh(sphere, new T.MeshStandardMaterial({ color: '#86b85a', roughness: 1 }), islands.length);
  cliffs.name = 'maze-distant-islands'; caps.name = 'maze-distant-lawns';
  islands.forEach(([x, y, z, size], i) => {
    dummy.position.set(x > 0 ? x + MAP_CENTER.x * 2 : x, y, z); dummy.scale.set(size, size * .85, size * .8); dummy.updateMatrix(); cliffs.setMatrixAt(i, dummy.matrix);
    dummy.scale.set(size, .85, size * .8); dummy.updateMatrix(); caps.setMatrixAt(i, dummy.matrix);
  });
  cliffs.computeBoundingSphere(); caps.computeBoundingSphere(); root.add(cliffs, caps);
  return root;
}
