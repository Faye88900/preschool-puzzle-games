import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CELL, COLS, ROWS, maze, position } from './maze-map';

export async function createMazeGround(renderer: T.WebGLRenderer) {
  const loader = new T.TextureLoader();
  const [dirt, grass] = await Promise.all(['dirt', 'grass'].map(name => loader.loadAsync(`${import.meta.env.BASE_URL}textures/maze/${name}.webp`)));
  for (const texture of [dirt, grass]) {
    texture.colorSpace = T.SRGBColorSpace;
    texture.wrapS = texture.wrapT = T.MirroredRepeatWrapping;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  }
  const dirtMaterial = new T.MeshStandardMaterial({ map: dirt, roughness: 1 });
  const grassMaterial = new T.MeshStandardMaterial({ map: grass, roughness: 1 });
  const group = new T.Group(); group.name = 'maze-ground';
  // World-aligned UVs keep texture scale and joins continuous across cell boundaries.
  const addSurface = (geometry: T.BufferGeometry, material: T.Material, name: string) => {
    const points = geometry.getAttribute('position');
    const uv = new Float32Array(points.count * 2);
    for (let i = 0; i < points.count; i++) { uv[i * 2] = points.getX(i) / CELL; uv[i * 2 + 1] = -points.getZ(i) / CELL; }
    geometry.setAttribute('uv', new T.BufferAttribute(uv, 2));
    const mesh = new T.Mesh(geometry, material); mesh.name = name; mesh.receiveShadow = true; group.add(mesh);
  };
  addSurface(new T.BoxGeometry(COLS * CELL, 1, ROWS * CELL).translate(0, -.5, 5), grassMaterial, 'maze-lawn');
  const paths: T.BufferGeometry[] = [], edges: number[] = [];
  const tile = new T.PlaneGeometry(CELL, CELL).rotateX(-Math.PI / 2);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (maze[r][c]) {
    const p = position(c, r);
    paths.push(tile.clone().translate(p.x, .018, p.z));
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (maze[r + dz]?.[c + dx]) continue;
      const edgePoint = (i: number, inner: boolean) => {
        const along = (i / 6 - .5) * CELL;
        const width = inner ? .2 + .1 * (1 + Math.sin(c * 7 + r * 13 + i * 2.1)) : 0;
        return [p.x + dx * (CELL / 2 - width) - dz * along, .026, p.z + dz * (CELL / 2 - width) + dx * along];
      };
      for (let i = 0; i < 6; i++) {
        const a = edgePoint(i, false), b = edgePoint(i, true), c = edgePoint(i + 1, true), d = edgePoint(i + 1, false);
        edges.push(...a, ...b, ...c, ...a, ...c, ...d);
      }
    }
  }
  addSurface(mergeGeometries(paths)!, dirtMaterial, 'maze-dirt-paths');
  for (const geometry of paths) geometry.dispose(); tile.dispose();
  const verge = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(edges, 3));
  verge.computeVertexNormals(); addSurface(verge, grassMaterial, 'maze-grass-verge');
  return group;
}
