import * as T from 'three';
import { createPlayerCharacter } from './character';
const materials = new Map<string, T.MeshStandardMaterial>();
export function mat(color: string) { if (!materials.has(color))
    materials.set(color, new T.MeshStandardMaterial({ color, roughness: .56, metalness: 0 })); return materials.get(color)!; }
const sphere = new T.SphereGeometry(1, 16, 12);
export function orb(color: string, x: number, y: number, z: number, sx: number, sy = sx, sz = sx) { const m = new T.Mesh(sphere, mat(color)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); return m; }
export function bean(color: string, player = false) {
    if (player) return createPlayerCharacter();
    const root = new T.Group();
    const g = new T.Group();
    g.name = 'avatar';
    root.add(g);
    const body = new T.Mesh(new T.CapsuleGeometry(.43, .47, 6, 16), mat(color));
    body.position.y = .05;
    g.add(body);
    g.add(orb('#fff8ee', 0, .19, -.37, .32, .285, .115));
    for (const x of [-.12, .12]) {
        g.add(orb('#263947', x, .24, -.475, .044, .077, .025));
        g.add(orb('#ffffff', x + .014, .267, -.498, .013));
    }
    for (const x of [-1, 1]) {
        const arm = new T.Group();
        arm.position.set(x * .4, .11, 0);
        arm.add(orb(color, x * .1, -.16, 0, .15, .27, .155));
        arm.name = 'arm' + x;
        arm.rotation.z = x * .35;
        g.add(arm);
        const foot = orb(color, x * .22, -.61, -.1, .185, .15, .26);
        foot.name = 'foot' + x;
        g.add(foot);
    }
    g.traverse(o => { if (o instanceof T.Mesh) o.castShadow = true; });
    return root;
}
export function label(text: string, color = '#315b66', bg = '#fffbea') {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = color;
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    const m = new T.Mesh(new T.PlaneGeometry(7, 1.75), new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }));
    return m;
}
