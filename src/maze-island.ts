import * as T from 'three';
import { CELL, COLS, ROWS, MAP_CENTER } from './maze-map';
import { gardenCoastX } from './ferry-shore-layout';
import { createDistantIsland } from './floating-islands';

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
      const worldZ=MAP_CENTER.z+z/edge*ROWS*CELL/2*scale*ripple;
      vertices.push(Math.min(MAP_CENTER.x+x/edge*COLS*CELL/2*scale*ripple,gardenCoastX(worldZ)),y+(ring===0?0:Math.sin(i*1.7)*scale),worldZ);
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
      if(dummy.position.x>75)dummy.position.y+=42;
      dummy.scale.set(5 + j % 3, 3.2 + j % 3, 4.5); dummy.updateMatrix(); clouds.setMatrixAt(i * 5 + j, dummy.matrix);
    }
  }
  clouds.computeBoundingSphere(); root.add(clouds);
  // Keep scenic islands beyond the bay and the turning boat camera's foreground.
  const islands = [[-82, 8, -28, 7], [-75, -3, 45, 5], [78, 10, -110, 8], [90, 2, 95, 6], [-28, 5, -82, 6], [37, -6, 91, 7]];
  const distant=new T.Group();distant.name='maze-distant-islands';
  islands.forEach(([x, y, z, size], i) => {
    const island=createDistantIsland((['grass','grove','ridge'] as const)[i%3]);island.name=`maze-distant-island-${i}`;
    island.position.set(x > 0 ? x + MAP_CENTER.x * 2 : x,y,z);island.scale.set(size,size*.85,size*.8);island.rotation.y=i*.7;distant.add(island);
  });
  root.add(distant);
  return root;
}
