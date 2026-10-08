import { cloudTransfer } from './cloud-transfer';
import * as T from 'three';
import R from '@dimforge/rapier3d-compat';
import { UI } from './ui';
import { readSettings, saveSettings } from './settings';
import { movement, acceleration, animateWalk } from './movement';
import { setCharacterExpression } from './character';
import { bean, mat, orb, label } from './models';
import { decorateCourse, decorateHazard } from './scenery';
import { createBrain, steerAI, type AIState, type AIRunner } from './ai';
export type GameState = 'ready' | 'countdown' | 'racing' | 'qualified' | 'eliminated' | 'timeout';
export interface Contestant {
    id: number;
    body: R.RigidBody;
    mesh: T.Group;
    checkpoint: number;
    finish: number;
    speed: number;
    lane: number;
    jumpCD: number;
    diveCD: number;
    dive: number;
    stun: number;
    stuck: number;
    lastZ: number;
    fall: number;
    previous: T.Vector3;
    heading: number;
    grounded: boolean;
    coyote: number;
    jumpBuffer: number;
    gait: number;
    squash: number;
    brain: AIState;
    resets: number;
}
export interface RaceSnapshot {
    state: GameState;
    time: number;
    rank: number;
    finished: number;
    paused: boolean;
    muted: boolean;
    cue: string;
    countdown: number;
    racers: {id:number;progress:number}[];
    diveReady: boolean;
}
export interface GuidanceCue {
    text: string;
    icon: string;
    at: number;
}
const cues: GuidanceCue[] = [{ at: 0, text: '跟着箭头走！', icon: '↑' }, { at: 25, text: '从柱子中间穿过去！', icon: '↔' }, { at: 56, text: '按跳跃！', icon: '↟' }, { at: 79, text: '跳过小缺口！', icon: '↟' }, { at: 122, text: '快到终点啦！', icon: '★' }];
const bumpers = [30, 39, 47].flatMap((progress, row) => [-5.9, 0, 5.9].map((x, col) => ({ x, z: -progress, phase: row * 1.9 + col * 1.2 })));
const FIXED_DT=movement.step,CHARACTER_GROUPS=0x00010002,QUALIFY_COUNT=8;
const STARTS=[[.85,0],[-.85,0],[-2.55,0],[2.55,0],[-2.55,1.8],[-.85,1.8],[.85,1.8],[2.55,1.8],[-2.55,3.6],[-.85,3.6],[.85,3.6],[2.55,3.6]];
const startPosition=(id:number)=>({x:STARTS[id][0],y:1,z:STARTS[id][1]});
export class Race {
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(55, 1, .1, 340);
    renderer!: T.WebGLRenderer;
    world!: R.World;
    ui!: UI;
    people: Contestant[] = [];
    moving: {
        body: R.RigidBody;
        mesh: T.Object3D;
        kind: string;
        z: number;
        phase: number;
        baseX?: number;
        rate?: number;
    }[] = [];
    balloons: T.Group[] = [];
    state: GameState = 'ready';
    time = 0;
    visualTime = 0;
    countdown = 3;
    paused = false;
    settings = readSettings();
    get muted() { return !this.settings.music && !this.settings.effects; }
    cue = '跟着箭头走！';
    finished = 0;
    keys = new Set<string>();
    stick = { x: 0, y: 0 };
    jump = false;
    dive = false;
    acc = 0;
    last = 0;
    seed = 1;
    frame = 0;
    fps = 60;
    testMode = false;
    autoPlayer = false;
    freeze = false;
    cueIndex = -1;
    audio?: AudioContext;
    countdownSound = this.media('audio/countdown-race.wav', .75);
    raceMusic = this.media('audio/race-sports-loop.mp3', .16, true);
    finishHorn = this.media('audio/finish-firework.wav', .68);
    mediaPlays = { countdown: 0, music: 0, finish: 0 };
    confetti?: T.Points;
    sun = new T.DirectionalLight('#fff5e7', 2.4);
    cameraLook = new T.Vector3(0, 1, -8);
    cameraGoal = new T.Vector3();
    reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    random() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
    async init() {
        await R.init();
        this.world = new R.World({ x: 0, y: -23, z: 0 });
        this.world.timestep = FIXED_DT;
        this.renderer = new T.WebGLRenderer({ canvas: document.querySelector('#game')!, antialias: true });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        this.renderer.outputColorSpace = T.SRGBColorSpace;
        this.renderer.setClearColor('#b8e4ed');
        this.renderer.toneMapping = T.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.12;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = T.PCFSoftShadowMap;
        this.scene.fog = new T.Fog('#b8e4ed', 105, 300);
        this.scene.add(new T.HemisphereLight('#eefaff', '#8ab5b9', 1.45));
        this.sun.position.set(-18, 30, 10);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.setScalar(innerWidth < 700 ? 1024 : 2048);
        Object.assign(this.sun.shadow.camera, {left:-22,right:22,top:32,bottom:-32,near:1,far:100});
        this.sun.shadow.bias = -.0003;
        this.sun.shadow.normalBias = .025;
        this.scene.add(this.sun, this.sun.target);
        this.buildLevel();
        this.createPeople();
        this.applyAudioSettings();
        this.ui = new UI({ start: () => this.start(), pause: () => this.pause(), mute: () => {
            this.settings = { music: this.muted, effects: this.muted }; saveSettings(this.settings); this.applyAudioSettings();
            if (!this.settings.effects) speechSynthesis?.cancel(); else this.syncMusic();
        }, jump: () => this.jump = true, dive: () => this.dive = true, move: (x, y) => this.stick = { x, y } });
        const nextLevel = document.querySelector<HTMLAnchorElement>('#game-ui .level-link')!;
        nextLevel.dataset.cloudTransfer = 'true';
        nextLevel.onclick = event => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            if (this.state !== 'qualified' || this.transfer) return;
            this.keys.clear(); this.stick = { x: 0, y: 0 };
            this.transfer = cloudTransfer(this.scene, this.camera, this.people[0].mesh, false, () => {
                location.assign('?level=2&cloudArrival=1' + (new URLSearchParams(location.search).has('test') ? '&test=1' : ''));
            });
        };
        addEventListener('keydown', e => { if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
            e.preventDefault(); this.keys.add(e.code); if (!e.repeat) {
            if (e.code === 'Space')
                this.jump = true;
            if (e.code.startsWith('Shift'))
                this.dive = true;
            if (e.code === 'Escape')
                this.pause();
            if (e.code === 'KeyR' && this.state === 'racing' && !this.paused)
                this.respawn(this.people[0]);
        } });
        addEventListener('keyup', e => this.keys.delete(e.code));
        addEventListener('blur', () => this.suspend());
        document.addEventListener('visibilitychange', () => document.hidden ? this.suspend() : this.syncMusic());
        addEventListener('pointerdown', () => this.syncMusic());
        addEventListener('keydown', () => this.syncMusic());
        this.syncMusic();
        addEventListener('resize', () => this.resize());
        this.resize();
        this.sync(0);
        this.camera.position.set(25, 29, 26);
        this.camera.lookAt(-8, 0, -36);
        this.installHooks();
        requestAnimationFrame(t => this.tick(t));
    }
    box(x: number, y: number, z: number, w: number, h: number, d: number, color: string, kind = 'fixed') {
        const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), mat(color));
        mesh.position.set(x, y, z);
        mesh.receiveShadow = true;
        mesh.castShadow = h > .4 && w < 16;
        this.scene.add(mesh);
        const desc = kind === 'fixed' ? R.RigidBodyDesc.fixed() : R.RigidBodyDesc.kinematicPositionBased();
        const body = this.world.createRigidBody(desc.setTranslation(x, y, z));
        this.world.createCollider(R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setFriction(.7), body);
        return { mesh, body };
    }
    buildLevel() {
        for (const [from, to, width, col] of [[-6, 24, 20, '#79ccbd'], [24, 52, 20, '#79ccbd'], [52, 82, 20, '#b697db'], [84.2, 100, 17, '#f6d576'], [103, 119, 17, '#f6d576'], [119, 158, 20, '#79ccbd']] as [
            number,
            number,
            number,
            string
        ][]) {
            this.box(0, -.7, -(from + to) / 2, width, 1.4, to - from, col);
            for (const x of [-width / 2, width / 2]) {
                this.box(x, .18, -(from + to) / 2, .32, .36, to - from, '#fff9e5');
            }
        }
        for (const b of bumpers) {
            const mesh = new T.Mesh(new T.CylinderGeometry(1.02, 1.02, 2.28, 20), mat('#f5d367'));
            mesh.position.set(b.x, 1.14, b.z); mesh.castShadow = mesh.receiveShadow = true;
            for (const y of [-.61, .14, .72]) { const band = new T.Mesh(new T.TorusGeometry(1.025, .07, 6, 24), mat('#fff9df')); band.rotation.x = Math.PI / 2; band.position.y = y; mesh.add(band); }
            this.scene.add(mesh);
            const body = this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(b.x, 1.14, b.z));
            this.world.createCollider(R.ColliderDesc.cylinder(1.14, 1.02).setRestitution(.65), body);
            this.moving.push({ mesh, body, kind: 'bumper', z: b.z, phase: b.phase, baseX: b.x });
        }
        for (const [i, z] of [62, 75].entries()) {
            const p = this.box(i ? 1.3 : -1.3, .75, -z, 13.8, .58, .66, '#e788b3', 'moving');
            this.moving.push({ ...p, kind: 'spinner', z: -z, phase: i * 1.7, rate: i ? -.92 : .8 });
            decorateHazard(p.mesh, 'spinner');
            this.scene.add(orb('#fff7d6', i ? 1.3 : -1.3, .76, -z, .6));
        }
        for(const [i,z] of [129,139].entries()) {
            const frame = new T.Group(); frame.name = `pendulum-frame-${z}`; frame.position.z = -z; this.scene.add(frame);
            for(const x of [-9.5,9.5]) {
                const post = new T.Mesh(new T.CylinderGeometry(.23,.23,9.3,16),mat('#977bd5'));
                post.position.set(x,4.5,0); post.castShadow = true; frame.add(post);
            }
            const beam = new T.Mesh(new T.BoxGeometry(19.5,.5,.5),mat('#af92e7'));
            beam.position.y=9; beam.castShadow=true; frame.add(beam);
            const pivot = new T.Group(); pivot.name=`pendulum-pivot-${z}`; pivot.position.y=9; frame.add(pivot);
            const cord=new T.Mesh(new T.CylinderGeometry(.14,.14,8,12),mat('#fffaf0')); cord.position.y=-4; cord.castShadow=true; pivot.add(cord);
            const ball = new T.Mesh(new T.SphereGeometry(1.45,20,16),mat('#fa7aab')); ball.position.y=-8; ball.castShadow=true; pivot.add(ball);
            const band=new T.Mesh(new T.TorusGeometry(1.45,.1,8,32),mat('#ffdc65')); band.position.y=-8; band.rotation.y=Math.PI/2; pivot.add(band);
            const body=this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0,1,-z));
            this.world.createCollider(R.ColliderDesc.ball(1.45).setRestitution(.4),body);
            this.moving.push({mesh:pivot,body,kind:'pendulum',z:-z,phase:i*1.7});
        }
        for (const z of [0, 53, 88, 121]) {
            this.box(0, .025, -z, z === 88 ? 16.5 : 19.5, .05, .4, '#ffffff');
            for (const x of z === 88 ? [-8, 8] : [-9.2, 9.2]) {
                const pole = orb('#fff7df', x, 1, -z, .13, 1, .13);
                this.scene.add(pole);
                this.scene.add(orb('#74ba9a', x, 2, -z, .4));
            }
        }
        for (let z = 16; z < 146; z += 8) {
            if ((z > 80 && z < 86) || (z > 98 && z < 105))
                continue;
            const sh = new T.Shape();
            sh.moveTo(-.55, 0);
            sh.lineTo(0, 1);
            sh.lineTo(.55, 0);
            sh.lineTo(.23, 0);
            sh.lineTo(.23, -.6);
            sh.lineTo(-.23, -.6);
            sh.lineTo(-.23, 0);
            const a = new T.Mesh(new T.ShapeGeometry(sh), new T.MeshBasicMaterial({ color: '#ffffff', side: T.DoubleSide }));
            a.rotation.x = -Math.PI / 2;
            a.position.set(0, .035, -z);
            this.scene.add(a);
        }
        const arch = new T.Group(); arch.name='finish-arch'; arch.position.z=-150.5; this.scene.add(arch);
        for (const x of [-8.5,8.5]) {
            const post=new T.Mesh(new T.CylinderGeometry(.38,.38,5.8,20),mat('#f875a7')); post.position.set(x,2.9,0); post.castShadow=true; arch.add(post);
            const base=new T.Mesh(new T.CylinderGeometry(.7,.7,.45,20),mat('#fff6df')); base.position.set(x,.22,0); arch.add(base);
            arch.add(orb('#ffdd67',x,5.8,0,.5));
        }
        const top=new T.Mesh(new T.BoxGeometry(17.3,1.6,.7),mat('#f875a7')); top.position.y=5.8; top.castShadow=true; arch.add(top);
        const sign = label('FINISH','#ffffff','#f875a7'); sign.position.set(0,5.8,.361); arch.add(sign);
        for(let i=-4;i<=4;i++) { const pennant=new T.Mesh(new T.ConeGeometry(.3,.52,3),mat(i%2?'#ffd46b':'#fbf8e4')); pennant.rotation.z=Math.PI; pennant.position.set(i*1.3,4.71,0); arch.add(pennant); }
        const crown=new T.Group(); crown.position.set(0,8.1,-151); crown.name='finish-crown'; this.scene.add(crown);
        const crownBand=new T.Mesh(new T.BoxGeometry(2.1,.48,.4),mat('#ffd54e')); crownBand.position.y=-.5; crown.add(crownBand);
        for(let i=-1;i<=1;i++) { const spike=new T.Mesh(new T.ConeGeometry(.52,i===0?1.35:1,3),mat('#ffd54e')); spike.position.set(i*.72,i===0?.12:-.05,0); crown.add(spike); crown.add(orb('#fff1a0',i*.72,i===0?.85:.51,0,.13)); }
        for (let x = -9; x < 10; x++)
            for (let z = 147; z < 150; z++)
                this.box(x, .035, -z, 1, .06, 1, (x + z) % 2 ? '#fffbed' : '#4b8b8d');
        this.balloons = decorateCourse(this.scene);
    }
    createPeople() { const colors = ['#ee5798', '#9c8ed6', '#de85a9', '#70b6ce', '#82bb9c', '#e99d70', '#b2a2df', '#82c5bd', '#e2a2c5', '#92b7df', '#c2c978', '#d5a986']; for (let id = 0; id < 12; id++) {
        const start=startPosition(id);
        const body = this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(start.x,start.y,start.z).lockRotations().setLinearDamping(movement.damping).setCcdEnabled(true));
        this.world.createCollider(R.ColliderDesc.capsule(.25, .4).setMass(1).setFriction(movement.friction).setRestitution(0).setCollisionGroups(CHARACTER_GROUPS), body);
        const mesh = bean(colors[id], id === 0);
        this.scene.add(mesh);
        this.people.push({ id, body, mesh, checkpoint: 0, finish: 0, speed: id === 0 ? movement.speed : 5.6 + (id % 5) * .28, lane: (id % 4 - 1.5) * 1.4, jumpCD: 0, diveCD: 0, dive: 0, stun: 0, stuck: 0, lastZ: 0, fall: 0, previous:new T.Vector3().copy(body.translation()),heading:0,grounded:false,coyote:0,jumpBuffer:0,gait:0,squash:1,brain:createBrain(id),resets:0 });
    } }
    media(path:string,volume:number,loop=false){const clip=new Audio(`${import.meta.env.BASE_URL}${path}`);clip.preload='auto';clip.volume=volume;clip.loop=loop;return clip;}
    applyAudioSettings(){this.raceMusic.muted=!this.settings.music;this.countdownSound.muted=this.finishHorn.muted=!this.settings.effects;}
    playMedia(kind:keyof typeof this.mediaPlays,clip:HTMLAudioElement){clip.currentTime=0;clip.muted=!(kind==='music'?this.settings.music:this.settings.effects);this.mediaPlays[kind]++;void clip.play().catch(()=>{});}
    stopMedia(clip:HTMLAudioElement){clip.pause();clip.currentTime=0;}
    syncMusic(){const on=!this.paused&&!document.hidden&&['ready','countdown','racing','qualified'].includes(this.state);if(!on)this.raceMusic.pause();else if(this.raceMusic.paused)void this.raceMusic.play().catch(()=>{});}
    start() { this.state = 'countdown'; this.countdown = 3; this.time = 0; this.finished = 0; this.paused = false; this.acc = 0; this.cueIndex = -1; this.cue = '准备——出发！'; this.keys.clear(); this.jump = this.dive = false; this.stick = { x: 0, y: 0 }; this.autoPlayer = false; this.testMode = false; speechSynthesis?.cancel(); this.stopMedia(this.finishHorn);this.stopMedia(this.countdownSound);if(this.raceMusic.paused)this.playMedia('music',this.raceMusic); if (this.confetti) {
        this.scene.remove(this.confetti);
        this.confetti.geometry.dispose();
        (this.confetti.material as T.Material).dispose();
        this.confetti = undefined;
    } for (const c of this.people) {
        c.body.setTranslation(startPosition(c.id), true);
        c.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        c.checkpoint = c.finish = c.stuck = c.fall = c.dive = c.stun = c.diveCD = c.jumpCD = 0;
        c.lastZ = 0;
        c.mesh.visible = true;
        c.previous.copy(c.body.translation());
        c.heading=c.gait=c.coyote=c.jumpBuffer=c.resets=0;c.squash=1;c.grounded=false;c.brain=createBrain(c.id);
        c.mesh.rotation.set(0,0,0);
        c.mesh.position.copy(c.previous);
    } this.audio ??= new AudioContext(); void this.audio.resume(); this.countdownBeat(); }
    pause() { if (this.state === 'racing' || this.state === 'countdown') {
        this.paused = !this.paused;
        this.keys.clear();
        this.stick = { x: 0, y: 0 };
        this.jump = this.dive = false;
        speechSynthesis?.cancel();
        this.syncMusic();
    } }
    suspend() { this.keys.clear(); this.stick = { x: 0, y: 0 }; this.jump = this.dive = false; if (this.state === 'racing' || this.state === 'countdown')
        this.paused = true; speechSynthesis?.cancel(); this.syncMusic(); }
    say(text: string) { this.cue = text; if (!this.settings.effects)
        return; this.tone(620, .08); if ('speechSynthesis' in window) {
        const voice = speechSynthesis.getVoices().find(v => v.lang.startsWith('zh'));
        if (voice) {
            speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'zh-CN';
            u.voice = voice;
            u.rate = .85;
            speechSynthesis.speak(u);
        }
    } }
    tone(freq: number, duration = .12) { if (!this.settings.effects || !this.audio)
        return; const o = this.audio.createOscillator(), g = this.audio.createGain(); o.type = 'sine'; o.frequency.value = freq; g.gain.setValueAtTime(.08, this.audio.currentTime); g.gain.exponentialRampToValueAtTime(.001, this.audio.currentTime + duration); o.connect(g); g.connect(this.audio.destination); o.start(); o.stop(this.audio.currentTime + duration); }
    countdownBeat() { this.playMedia('countdown',this.countdownSound); }
    respawn(c: Contestant) { c.body.setTranslation({ x: c.id === 0 ? 0 : c.lane, y: 1.2, z: -c.checkpoint + 2 }, true); c.body.setLinvel({ x: 0, y: 0, z: 0 }, true); c.stuck = c.fall = c.stun = 0; c.lastZ = -c.checkpoint + 2; c.previous.copy(c.body.translation());c.mesh.position.copy(c.previous);c.coyote=c.jumpBuffer=0;c.resets++;c.brain=createBrain(c.id); if (c.id === 0)
        this.say('没关系，继续向前！'); }
    step(dt: number) {
        if (this.state === 'countdown') {
            const prev = Math.ceil(this.countdown);
            this.countdown -= dt;
            if (Math.ceil(this.countdown) !== prev && this.countdown > 0)
                this.countdownBeat();
            if (this.countdown <= 0) {
                this.state = 'racing';
                this.say('跟着箭头走！');
            }
            return;
        }
        if (this.state !== 'racing')
            return;
        this.time += dt;
        for(const c of this.people)c.previous.copy(c.body.translation());
        for (const m of this.moving) {
            if (m.kind === 'spinner') {
                const q = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), this.time * (m.rate ?? .8) + m.phase);
                m.body.setNextKinematicRotation(q);
            }
            else if(m.kind==='pendulum') {
                const angle=Math.sin(this.time*1.55+m.phase)*.84;
                m.body.setNextKinematicTranslation({x:Math.sin(angle)*8,y:9-Math.cos(angle)*8,z:m.z});
                m.body.setNextKinematicRotation(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),angle));
            } else if(m.kind==='bumper') {
                const x = (m.baseX ?? 0) + Math.sin(this.time * .85 + m.phase) * 1.05;
                m.body.setNextKinematicTranslation({ x, y: 1.14, z: m.z });
            }
        }
        const runners:AIRunner[]=this.people.map(c=>{const p=c.body.translation(),v=c.body.linvel();return {id:c.id,x:p.x,y:p.y,z:p.z,vx:v.x,vz:v.z,speed:c.speed,lane:c.lane,jumpCD:c.jumpCD,diveCD:c.diveCD,stuck:c.stuck};});
        const hazards=this.moving.map(m=>({kind:m.kind,x:m.body.translation().x,z:m.z,phase:m.phase,rate:m.rate}));
        for (const c of this.people) {
            if (c.finish)
                continue;
            const p = c.body.translation(), v = c.body.linvel();
            c.jumpCD = Math.max(0, c.jumpCD - dt);
            c.diveCD = Math.max(0, c.diveCD - dt);
            c.dive = Math.max(0, c.dive - dt);
            c.stun = Math.max(0, c.stun - dt);
            if (p.y < -2) {
                c.fall += dt;
                if (c.fall >= 1)
                    this.respawn(c);
                continue;
            }
            let x = 0, z = 0, jump = false, dive = false;
            const ai = c.id > 0 || this.autoPlayer;
            if (ai) {
                // Each computer racer reacts to the starting signal at its own pace.
                if (this.time < c.brain.startDelay) continue;
                const intent=steerAI(runners[c.id],runners,hazards,c.brain,this.time,dt);
                x=intent.x;z=intent.z;jump=intent.jump;dive=intent.dive;
                if (Math.abs(p.z - c.lastZ) < .015)
                    c.stuck += dt;
                else
                    c.stuck = 0;
                c.lastZ = p.z;
                if (c.stuck > 1)
                    jump = true;
                if (c.stuck > 3)
                    this.respawn(c);
            }
            else {
                x = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) + this.stick.x;
                z = Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) + this.stick.y;
                jump = this.jump;
                dive = this.dive;
            }
            const len = Math.hypot(x, z);
            if (len > 1) {
                x /= len;
                z /= len;
            }
            const ray = new R.Ray({ x: p.x, y: p.y - .57, z: p.z }, { x: 0, y: -1, z: 0 });
            const hit = this.world.castRay(ray, .24, true, undefined, CHARACTER_GROUPS, undefined, c.body);
            const ground = !!hit && v.y < 1 && p.y>.2;
            if(ground&&!c.grounded){c.squash=.87;if(c.id===0&&v.y< -3)this.tone(260,.06);}
            c.grounded=ground;
            c.coyote=ground?.11:Math.max(0,c.coyote-dt);
            c.jumpBuffer=jump?.13:Math.max(0,c.jumpBuffer-dt);
            let vy = v.y;
            if (c.jumpBuffer>0 && c.coyote>0 && c.jumpCD === 0 && c.stun === 0) {
                vy = 8;
                c.jumpCD = .34;c.coyote=0;c.jumpBuffer=0;c.squash=1.12;c.grounded=false;
                if(ai)c.brain.jumps++;
                if (c.id === 0)
                    this.tone(820);
            }
            if (dive && c.diveCD === 0 && len > .1 && c.stun === 0) {
                c.dive = .38;
                c.diveCD = 1.1;
                if(ai)c.brain.dives++;
                vy = Math.max(vy, 2);
                if (c.id === 0)
                    this.tone(400);
            }
            const speed = c.speed * (c.dive > 0 ? 1.85 : 1);
            const blend = c.stun > 0 ? Math.exp(-1.3*dt) : acceleration(ground,dt);
            let vx=c.stun > 0?v.x*blend:T.MathUtils.lerp(v.x,x*speed,blend),vz=c.stun > 0?v.z*blend:T.MathUtils.lerp(v.z,z*speed,blend);
            for(const bumper of this.moving){
                if(bumper.kind!=='bumper')continue;
                const {x:bx,z:bz}=bumper.body.translation();
                const dx=p.x-bx,dz=p.z-bz,d=Math.hypot(dx,dz);
                if(d<1.47&&p.y<2.3){
                    const nx=d>.001?dx/d:0,nz=d>.001?dz/d:1;
                    if(c.stun===0&&vx*nx+vz*nz<1){
                        const player=c.id===0,bounce=Math.max(player?11:7.2,Math.hypot(vx,vz)*1.15);
                        vx=nx*bounce;vz=nz*bounce;vy=Math.max(vy,player?5.2:2.4);c.stun=player?.42:0;c.squash=.82;
                        if(c.id===0)this.tone(520,.08);
                    }
                    break;
                }
            }
            c.body.setLinvel({ x:vx, y:vy, z:vz }, true);
            if (len > .1)c.heading=Math.atan2(-x,-z);
            c.gait+=Math.hypot(v.x,v.z)*dt*movement.gait;
            c.squash=T.MathUtils.lerp(c.squash,1,1-Math.exp(-12*dt));
            for (const cp of [53, 88, 121])
                if (-p.z > cp && p.y > .3 && Math.abs(p.x) < 9.5 && c.checkpoint < cp) {
                    c.checkpoint = cp;
                    if (c.id === 0)
                        this.tone(950);
                }
            if (-p.z >= 148 && Math.abs(p.x) < 9.5 && p.y > 0) {
                c.finish = ++this.finished;
                c.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
                if (c.id === 0 && !this.testMode)
                    this.end(c.finish <= QUALIFY_COUNT ? 'qualified' : 'eliminated');
            }
        }
        this.jump = this.dive = false;
        this.world.step();
        // Match the reference's soft arcade separation instead of letting rigid bodies jitter in a crowd.
        for(let i=0;i<this.people.length;i++)for(let j=i+1;j<this.people.length;j++){
            const a=this.people[i],b=this.people[j];if(a.finish||b.finish)continue;
            const pa=a.body.translation(),pb=b.body.translation();if(Math.abs(pa.y-pb.y)>1.4)continue;
            const dx=pa.x-pb.x,dz=pa.z-pb.z,d=Math.hypot(dx,dz);
            if(d>.001&&d<.88){const push=(.88-d)*.36/d;
                a.body.setTranslation({x:pa.x+dx*push,y:pa.y,z:pa.z+dz*push},true);
                b.body.setTranslation({x:pb.x-dx*push,y:pb.y,z:pb.z-dz*push},true);
            }
        }
        const progress = -this.people[0].body.translation().z;
        const ci = cues.reduce((last, c, i) => progress >= c.at ? i : last, -1);
        if (ci > this.cueIndex) {
            this.cueIndex = ci;
            this.say(cues[ci].text);
        }
        if (!this.testMode && this.state === 'racing') {
            if (this.finished >= QUALIFY_COUNT && !this.people[0].finish)
                this.end('eliminated');
            else if (this.time >= 90)
                this.end('timeout');
        }
    }
    end(state: GameState) { this.state = state; if (state !== 'qualified') this.stopMedia(this.raceMusic); this.say(state === 'qualified' ? '晋级啦！' : '没关系，再试一次！'); if (state === 'qualified') {
        this.playMedia('finish',this.finishHorn);
        const a = new Float32Array(180 * 3);
        for (let i = 0; i < 180; i++) {
            a[i * 3] = (this.random() - .5) * 15;
            a[i * 3 + 1] = 3 + this.random() * 9;
            a[i * 3 + 2] = -145 + this.random() * 12;
        }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(a, 3));
        this.confetti = new T.Points(g, new T.PointsMaterial({ color: '#ffbb54', size: .2 }));
        this.scene.add(this.confetti);
    } }
    snapshot(): RaceSnapshot { const p = this.people[0]; return { state: this.state, time: Math.max(0, 90 - this.time), rank: p.finish || 1 + this.people.filter(c => c.id !== 0 && (c.finish || c.body.translation().z < p.body.translation().z)).length, finished: Math.min(QUALIFY_COUNT, this.finished), paused: this.paused, muted: this.muted, cue: this.cue, countdown: Math.ceil(this.countdown),racers:this.people.map(c=>({id:c.id,progress:T.MathUtils.clamp(-c.body.translation().z/148,0,1)})),diveReady:p.diveCD===0 }; }
    sync(dt: number) {
        if(!this.freeze&&!this.paused)this.visualTime+=dt;
        this.balloons.forEach((balloon, i) => {
            balloon.position.y = balloon.userData.baseY + (this.reducedMotion ? 0 : Math.sin(this.visualTime * .55 + i) * .55);
            balloon.rotation.z = this.reducedMotion ? 0 : Math.sin(this.visualTime * .35 + i) * .04;
        });
        if (this.confetti && !this.freeze && !this.paused) {
            this.confetti.rotation.y += dt * .1;
            this.confetti.position.y = Math.max(-2, this.confetti.position.y - dt * .35);
        }
        for (const c of this.people) {
            const p = c.body.translation();
            // Render between physics poses, avoiding 60 Hz stair-steps on fast displays.
            c.mesh.position.copy(c.previous).lerp(p,dt===0||this.freeze?1:this.acc/FIXED_DT);
            if(c.finish&&!this.reducedMotion)c.mesh.position.y+=Math.pow(Math.max(0,Math.sin(this.visualTime*5+c.finish*.7)),2)*.9;
            const avatar=c.mesh.getObjectByName('avatar')!;
            const v=c.body.linvel(),speed=Math.hypot(v.x,v.z);
            const oldLean=avatar.rotation.x;
            const blend=animateWalk(c.mesh,c.heading,c.gait,speed,c.grounded,this.reducedMotion,dt);
            if(c.id===0&&!this.paused) setCharacterExpression(c.mesh, this.state==='qualified' ? 'happy'
                : this.state!=='racing' ? 'neutral' : c.stun>0 ? 'surprised' : c.dive>0 ? 'determined'
                : !c.grounded ? 'surprised' : speed>2 ? 'determined' : 'neutral');
            if(c.dive>0)avatar.rotation.x=T.MathUtils.lerp(oldLean,-1.15,blend);
            avatar.scale.set(1/Math.sqrt(c.squash),c.squash,1/Math.sqrt(c.squash));
            for (const side of [-1,1]) {
                const arm=c.mesh.getObjectByName('arm'+side)!;
                if(c.finish) {
                    arm.rotation.x=Math.sin(this.visualTime*8+c.id)*.18;
                    arm.rotation.z+=side*2*blend;
                } else if(c.dive>0)arm.rotation.x=-1.55;
            }
        }
        for (const m of this.moving) {
            if(this.state==='ready'&&!this.reducedMotion) {
                if(m.kind==='spinner')m.mesh.rotation.y=this.visualTime*(m.rate??.8)+m.phase;
                else if(m.kind==='pendulum')m.mesh.rotation.z=Math.sin(this.visualTime*1.55+m.phase)*.84;
                else m.mesh.position.set((m.baseX??0)+Math.sin(this.visualTime*.85+m.phase)*1.05,1.14,m.z);
            } else if(m.kind==='pendulum')m.mesh.quaternion.copy(m.body.rotation());
            else { m.mesh.position.copy(m.body.translation()); m.mesh.quaternion.copy(m.body.rotation()); }
        }
        if (this.state !== 'ready') {
            const p = this.people[0].mesh.position;
            const portrait = innerWidth < innerHeight;
            this.cameraGoal.set(p.x*.72,Math.max(0,p.y)*.42+(portrait?11:9.4),p.z+(portrait?18:16));
            const follow=dt===0?1:1-Math.exp(-5*dt);
            this.camera.position.lerp(this.cameraGoal,follow);
            this.cameraLook.lerp(this.cameraGoal.set(p.x*.86,Math.max(0,p.y)*.32+1.8,p.z-8),follow);
            this.camera.lookAt(this.cameraLook);
            this.sun.position.set(p.x-18,30,p.z+10);this.sun.target.position.set(p.x,0,p.z-10);
        }
    }
    resize() { this.renderer.setSize(innerWidth, innerHeight); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
    transfer?: (now: number) => boolean;
    tick(t: number) {
        if (this.transfer) {
            this.transfer(t); this.renderer.render(this.scene, this.camera);
            requestAnimationFrame(v => this.tick(v)); return;
        } const dt = Math.min((t - this.last) / 1000 || 0, .1); this.last = t; this.fps = this.fps * .95 + (1 / Math.max(dt, .001)) * .05; if (!this.paused && !this.freeze) {
        this.acc += dt;
        while (this.acc >= FIXED_DT) {
            this.step(FIXED_DT);
            this.acc -= FIXED_DT;
        }
    }
        this.sync(dt);this.ui.update(this.snapshot());this.renderer.render(this.scene,this.camera);this.frame++;
        const info=this.renderer.info;
        Object.assign(window,{__THREE_GAME_DIAGNOSTICS__:{...this.snapshot(),frame:this.frame,fps:this.fps,
            physics:{bodies:this.world.bodies.len(),colliders:this.world.colliders.len(),step:FIXED_DT},
            models:{pendulumFrames:[129,139].filter(z=>this.scene.getObjectByName(`pendulum-frame-${z}`)).length,finishArch:!!this.scene.getObjectByName('finish-arch')},
            media:{plays:{...this.mediaPlays},countdown:{readyState:this.countdownSound.readyState,paused:this.countdownSound.paused,muted:this.countdownSound.muted},music:{readyState:this.raceMusic.readyState,paused:this.raceMusic.paused,muted:this.raceMusic.muted,loop:this.raceMusic.loop,time:this.raceMusic.currentTime,src:this.raceMusic.src},finish:{readyState:this.finishHorn.readyState,paused:this.finishHorn.paused,muted:this.finishHorn.muted}},
            hazards:this.moving.map(m=>({kind:m.kind,position:m.body.translation(),renderPosition:{x:m.mesh.position.x,y:m.mesh.position.y,z:m.mesh.position.z},renderRotation:{x:m.mesh.rotation.x,y:m.mesh.rotation.y,z:m.mesh.rotation.z}})),
            people:this.people.map(c=>({id:c.id,expression:c.mesh.userData.expression,finish:c.finish,checkpoint:c.checkpoint,speed:c.speed,position:c.body.translation(),velocity:c.body.linvel(),renderPosition:{x:c.mesh.position.x,y:c.mesh.position.y,z:c.mesh.position.z},heading:c.heading,rotation:c.mesh.rotation.y,brain:{...c.brain},resets:c.resets})),
            renderer:{calls:info.render.calls,triangles:info.render.triangles,geometries:info.memory.geometries,textures:info.memory.textures},
            speech:{available:'speechSynthesis' in window,chinese:typeof speechSynthesis!=='undefined'&&speechSynthesis.getVoices().some(v=>v.lang.startsWith('zh'))}}});
        requestAnimationFrame(v=>this.tick(v));
    }
    installHooks() { if (!import.meta.env.DEV && !new URLSearchParams(location.search).has('test'))
        return; Object.assign(window, { __THREE_GAME_TEST_HOOKS__: { seed: (n: number) => this.seed = n, balloons: () => this.balloons.map(b => ({ y: b.position.y, roll: b.rotation.z })), setState: (s: string) => { this.start(); this.state = 'racing'; if (['qualified', 'eliminated', 'timeout'].includes(s))
                this.end(s as GameState); }, setPausedForScreenshot: (v: boolean) => this.freeze = v, setReducedMotion: (v:boolean) => {this.reducedMotion=v;}, snapshot: () => this.snapshot(), advance: (seconds: number) => { for (let i = 0; i < seconds / FIXED_DT; i++)
                this.step(FIXED_DT); this.sync(0); }, auto: () => { this.state = 'racing'; this.testMode = true; this.autoPlayer = true; }, teleport: (x: number, y: number, z: number) => { this.people[0].body.setTranslation({ x, y, z }, true); this.people[0].body.setLinvel({ x: 0, y: 0, z: 0 }, true); }, finishAI: (n: number) => { for (let i = 1; i <= n; i++)
                this.people[i].body.setTranslation({ x: 0, y: 1, z: -149 }, true); }, setTime: (t: number) => this.time = t } }); }
}
