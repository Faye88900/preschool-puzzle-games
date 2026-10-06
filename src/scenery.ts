import * as T from 'three';
import { mat, orb, label } from './models';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Shared instanced support art keeps the entire floating course inexpensive.
export function decorateCourse(scene: T.Scene) {
    const box = new T.BoxGeometry(1, 1, 1), sphere = new T.SphereGeometry(1, 12, 8);
    const batches = new Map<string, { geometry: T.BufferGeometry; color: string; matrices: T.Matrix4[] }>();
    const props = new T.Group();
    const balloons: T.Group[] = [];
    const flagMaterials = ['#f28fc3', '#a880e0'].map(color => new T.MeshStandardMaterial({ color, side: T.DoubleSide }));
    const pose = new T.Object3D();
    function add(shape: 'box' | 'orb', color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, rz = 0) {
        const key = shape + color;
        if (!batches.has(key)) batches.set(key, { geometry: shape === 'box' ? box : sphere, color, matrices: [] });
        pose.position.set(x, y, z); pose.scale.set(sx, sy, sz); pose.rotation.set(0, 0, rz); pose.updateMatrix();
        batches.get(key)!.matrices.push(pose.matrix.clone());
    }
    const white = '#fff9f0', pink = '#f27fb1';
    for (const [near, far, edge] of [[6, -24, 10], [-24, -52, 10], [-52, -82, 10], [-84.2, -100, 8.5], [-103, -119, 8.5], [-119, -158, 10]]) {
        for (const side of [-1, 1]) {
            add('box', pink, side * edge, -.48, (near + far) / 2, .25, 1.03, near - far);
            for (let z = near - .65; z > far; z -= 2.2)
                add('box', white, side * (edge + .15), -.47, z, .045, .92, .7);
            add('box', white, side * (edge - .45), .015, (near + far) / 2, .10, .018, near - far);
        }
        for (let z = near - 6; z > far; z -= 8)
            add('box', '#daf9ed', 0, .012, z, 14.9, .018, .07);
    }
    // A clear starting arch and pennants frame the first view without masking hazards.
    for (const x of [-6.7, 6.7]) {
        add('box', '#9867d4', x, 2.6, -6, .65, 5.2, .7);
        add('box', '#f9d54d', x, .25, -6, 1.1, .5, 1.1);
        add('orb', '#b887e8', x, 5.2, -6, .48, .48, .48);
    }
    add('box', '#9867d4', 0, 5.2, -6, 13.4, .7, .7);
    const start = label('软 糖 冲 刺', '#ffffff', '#9867d4');
    start.position.set(0, 5.18, -5.59); start.scale.set(.75, .60, 1); scene.add(start);
    for (let i = 0; i < 18; i++) {
        const z = 1 - i * 9;
        for (const side of [-1, 1]) {
            const x = side * 13;
            add('orb', '#a6e6bd', x, -1.5, z, 2.15, 1.05, 2.1);
            add('orb', '#83cdb1', x, -2.05, z, 1.7, 1.0, 1.65);
            add('box', white, x, .7, z, .11, 3.4, .11);
            add('orb', '#ffdc6e', x, 2.45, z, .16, .16, .16);
            const flag = new T.Shape();
            flag.moveTo(0, 0); flag.lineTo(side * 1.4, -.32); flag.lineTo(0, -.75); flag.closePath();
            const m = new T.Mesh(new T.ShapeGeometry(flag), flagMaterials[i % 2]);
            m.position.set(x, 2.3, z); props.add(m);
        }
    }
    // Distant, softly layered white clouds leave the course clear.
    let cloudSeed = 128;
    const random = () => ((cloudSeed = (cloudSeed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 33; i++) {
        const x = (i % 2 ? 1 : -1) * (42 + random() * 65);
        const y = -7 + random() * 27;
        const z = -20 - random() * 250;
        const scale = .65 + random() * 1.5;
        for (let j = 0; j < 5; j++)
            add('orb', '#ffffff', x + (j - 2) * 1.7 * scale, y + Math.sin(j * 1.7) * .9 * scale,
                z + random() * 1.6 * scale, 2.8 * scale, (1.4 + random() * 1.8) * scale, 1.9 * scale);
    }
    for (const [x, y, z, color] of [
        [-28, 15, -24, '#ff9abc'], [29, 19, -67, '#ffda76'],
        [-30, 22, -126, '#b7a0ec'], [34, 5, 8, '#a2a2ed']
    ] as const) {
        const balloon = new T.Group();
        const envelope = new T.Mesh(new T.SphereGeometry(1, 16, 12), mat(color));
        envelope.scale.set(3.3, 4.1, 3.3); balloon.add(envelope);
        for (const angle of [-.45, .45]) {
            const band = new T.Mesh(new T.TorusGeometry(3.17, .16, 8, 32), mat('#fff3d8'));
            band.rotation.y = angle; band.scale.y = 1.24; balloon.add(band);
        }
        const basket = new T.Mesh(new T.BoxGeometry(1.6, 1, 1.6), mat('#f8dca2'));
        basket.position.y = -5.7; balloon.add(basket);
        for (const ropeX of [-.6, .6]) {
            const rope = new T.Mesh(new T.CylinderGeometry(.04, .04, 2.5, 6), mat('#fff7e7'));
            rope.position.set(ropeX, -4.3, 0); balloon.add(rope);
        }
        balloon.position.set(x, y, z);
        balloon.userData.baseY = y;
        scene.add(balloon);
        balloons.push(balloon);
    }
    // Merge static pennants by material; balloons stay separate so they can float.
    props.updateMatrixWorld(true);
    const merged = new Map<T.Material, T.BufferGeometry[]>();
    props.traverse(o => {
        if (!(o instanceof T.Mesh)) return;
        const material = o.material as T.Material;
        const geometry = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        geometry.applyMatrix4(o.matrixWorld);
        if (!merged.has(material)) merged.set(material, []);
        merged.get(material)!.push(geometry);
        o.geometry.dispose();
    });
    for (const [material, geometries] of merged) {
        scene.add(new T.Mesh(mergeGeometries(geometries)!, material));
        geometries.forEach(g => g.dispose());
    }
    for (const { geometry, color, matrices } of batches.values()) {
        const mesh = new T.InstancedMesh(geometry, mat(color), matrices.length);
        matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
        mesh.computeBoundingSphere(); mesh.receiveShadow = true;
        scene.add(mesh);
    }
    return balloons;
}

export function decorateHazard(mesh: T.Mesh, kind: string) {
    mesh.castShadow = mesh.receiveShadow = true;
    if (kind === 'spinner') {
        for (const x of [-5.5, 5.5]) mesh.add(orb('#ffcb54', x, 0, 0, .34, .3, .42));
        for (const x of [-4, -2, 2, 4]) {
            const stripe = new T.Mesh(new T.BoxGeometry(.42, .512, .815), mat('#fff4d6'));
            stripe.position.x = x; mesh.add(stripe);
        }
        const hub = new T.Mesh(new T.CylinderGeometry(.67, .72, .72, 18), mat('#ffc94d'));
        hub.position.y = .05; mesh.add(hub);
        mesh.add(orb('#fff4da', 0, .45, 0, .43, .19, .43));
    }
}
