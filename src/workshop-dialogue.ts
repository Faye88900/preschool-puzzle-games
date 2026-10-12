import * as T from 'three';
import { animateWorkshopGuide, animateGuideWalk, createWorkshopGuide } from './workshop-guide';

const patrol = [new T.Vector3(-26, .68, -10), new T.Vector3(-26, .68, -13),
  new T.Vector3(-22, .68, -13), new T.Vector3(-22, .68, -10)];

const lines = [
  ['玩家', '我想找钥匙，你有看到吗？'],
  ['工坊向导', '你看，铁门后面是不是有东西在发光？'],
  ['玩家', '看到了！可是门关着……'],
  ['工坊向导', '看看门前的机关，它的形状和哪块积木一样呢？'],
  ['观察一下', '看看机关，再看看附近的积木。'],
  ['玩家', '我去试试看！'],
];

export class WorkshopDialogue {
  guide = createWorkshopGuide();
  stage = -1;
  elapsed = 0;
  returning = false;
  private solved = false;
  private collected = false;
  private waypoint = 0;
  private gait = 0;
  private walkSpeed = 0;
  private panel = document.createElement('dialog');
  private from = new T.Vector3();
  private fromLook = new T.Vector3();
  private capture = true;
  private next: HTMLButtonElement;
  get active() { return this.stage >= 0 || this.returning; }

  constructor(private speak: (text: string) => void, private clearInput: () => void,
    private canWalk: (x: number, z: number) => boolean) {
    this.guide.position.set(-26, .68, -9);
    this.guide.rotation.y = -Math.PI / 2;
    this.panel.className = 'workshop-dialogue';
    this.panel.setAttribute('aria-labelledby', 'workshop-speaker');
    this.panel.setAttribute('aria-describedby', 'workshop-line');
    this.panel.innerHTML = `<div class="workshop-bubble"><strong id="workshop-speaker"></strong><button type="button" class="workshop-leave" aria-label="退出对话" title="退出对话（Esc）"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg></button><p id="workshop-line" aria-live="polite"></p><div class="workshop-dialogue-footer"><button type="button" class="workshop-next"><kbd aria-hidden="true">Enter</kbd><span class="workshop-next-label">继续</span><span class="workshop-next-arrow" aria-hidden="true"></span></button></div></div>`;
    document.body.append(this.panel);
    this.next = this.panel.querySelector('.workshop-next')!;
    // The touch interaction opens on pointerdown; its release must not advance this new panel.
    const bubble = this.panel.querySelector<HTMLElement>('.workshop-bubble')!;
    let pressed = false;
    bubble.onpointerdown = event => { pressed = event.button === 0 && !(event.target as Element).closest('.workshop-leave'); };
    bubble.onpointercancel = () => { pressed = false; };
    bubble.onclick = event => {
      if (!(event.target as Element).closest('.workshop-leave') && (!event.detail || pressed)) this.advance();
      pressed = false;
    };
    this.panel.querySelector<HTMLButtonElement>('.workshop-leave')!.onclick = () => this.close();
    this.panel.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    this.panel.addEventListener('keydown', event => {
      if (event.code === 'Enter' && !(event.target as HTMLElement).closest('.workshop-leave')) {
        event.preventDefault();
        if (!event.repeat) this.advance();
      } else if (event.repeat && event.code === 'Space') event.preventDefault();
    });
  }
  reset() {
    this.close(true); this.waypoint = 0; this.gait = 0; this.walkSpeed = 0;
    this.guide.position.set(-26, .68, -9); this.guide.rotation.y = 0;
  }
  start(solved: boolean, collected: boolean) {
    if (this.active) return;
    this.solved = solved; this.collected = collected;
    this.stage = 0; this.elapsed = 0; this.capture = true;
    this.clearInput();
    document.body.classList.add('workshop-talking');
    this.panel.showModal(); this.showLine();
  }
  private showLine() {
    const [speaker, text] = this.collected ? ['工坊向导', '你找到工坊的钥匙啦！去其他地方看看吧。']
      : this.solved ? ['工坊向导', '铁门打开了！快去拿里面的钥匙吧。'] : lines[this.stage];
    this.panel.querySelector('#workshop-speaker')!.textContent = speaker;
    this.panel.querySelector('#workshop-line')!.textContent = text;
    this.panel.dataset.speaker = speaker === '玩家' ? 'player' : speaker === '工坊向导' ? 'guide' : 'observe';
    this.next.querySelector('.workshop-next-label')!.textContent = this.stage === 5 || this.solved || this.collected ? '出发吧' : '继续';
    this.next.focus({ preventScroll: true });
    this.speak(text);
  }
  advance() {
    if (this.stage < 0) return;
    if (this.stage === 5 || this.solved || this.collected) { this.close(); return; }
    this.stage++; this.elapsed = 0; this.capture = true; this.showLine();
  }
  close(immediate = false) {
    if (!this.active) return;
    this.panel.close(); this.stage = -1; this.returning = !immediate;
    this.elapsed = 0; this.capture = true;
    document.body.classList.remove('workshop-talking');
    window.speechSynthesis?.cancel(); this.clearInput();
  }
  update(dt: number, paused: boolean, reduced: boolean, camera: T.Camera, look: T.Vector3,
    player: T.Group, followPosition: T.Vector3, followLook: T.Vector3) {
    if (paused) return this.active;
    this.elapsed += dt;
    const pointing = !this.solved && !this.collected && this.stage >= 1 && this.stage <= 4;
    const target = pointing ? new T.Vector3(-24, 1, this.stage <= 2 ? -31 : -17)
      : this.active ? player.position : patrol[this.waypoint];
    const dx = target.x - this.guide.position.x, dz = target.z - this.guide.position.z;
    const yaw = pointing ? Math.atan2(-dz, dx) - .4 : Math.atan2(-dx, -dz);
    const turn = Math.atan2(Math.sin(yaw - this.guide.rotation.y), Math.cos(yaw - this.guide.rotation.y));
    let speed = 0;
    if (!this.active) {
      const distance = Math.hypot(dx, dz);
      this.walkSpeed = T.MathUtils.lerp(this.walkSpeed, .8 * Math.max(0, Math.cos(turn)), 1 - Math.exp(-5 * dt));
      const travel = Math.min(distance, dt * this.walkSpeed);
      const x = this.guide.position.x + dx / Math.max(distance, .001) * travel;
      const z = this.guide.position.z + dz / Math.max(distance, .001) * travel;
      if (Math.hypot(x - player.position.x, z - player.position.z) > 1.3 && this.canWalk(x, z)) {
        this.guide.position.set(x, .68, z); speed = dt > 0 ? travel / dt : 0;
        this.gait += travel * 7;
        if (distance <= .05) this.waypoint = (this.waypoint + 1) % patrol.length;
      } else this.walkSpeed = 0;
    }
    else this.walkSpeed = 0;
    this.guide.rotation.y += turn * (reduced ? 1 : 1 - Math.exp(-6 * dt));
    animateWorkshopGuide(this.guide, pointing ? 'point' : this.stage === 5 ? 'nod' : 'idle',
      pointing ? Math.min(this.elapsed, 1) : this.elapsed, dt, reduced);
    animateGuideWalk(this.guide, this.gait, speed, dt, reduced);
    if (!this.active) return false;
    if (this.capture) { this.from.copy(camera.position); this.fromLook.copy(look); this.capture = false; }
    const position = followPosition.clone(), aim = followLook.clone();
    const portrait = innerWidth < innerHeight;
    if (this.stage >= 0 && this.stage !== 5) {
      const middle = player.position.clone().add(this.guide.position).multiplyScalar(.5);
      const side = new T.Vector3(-(player.position.z - this.guide.position.z), 0, player.position.x - this.guide.position.x);
      if (side.lengthSq() < .01) side.set(0, 0, 1);
      side.normalize(); if (side.z < 0) side.negate();
      position.copy(middle).addScaledVector(side, portrait ? 8.5 : 5.5); position.y = 3.5;
      aim.set(middle.x, .25, middle.z);
      if (!this.solved && !this.collected) {
        if (this.stage === 1) {
          position.set(middle.x + (portrait ? 4 : 2.6), 3.5, middle.z + (portrait ? 7 : 4.55));
          const pan = reduced ? 1 : T.MathUtils.smoothstep(this.elapsed, 1.5, 3.5);
          position.lerp(new T.Vector3(-24, 4.5, -15), pan);
          aim.lerp(new T.Vector3(-24, 1.3, -28), pan);
        } else if (this.stage === 2) {
          position.set(-23.35, 2.4, -22.3); aim.set(-24, 1.75, -31);
        } else if (this.stage === 3) {
          position.set(-24, 5.5, -12); aim.set(-24, 0, -17);
        } else if (this.stage === 4) {
          position.set(-24, portrait ? 17 : 11, portrait ? 7 : -1); aim.set(-24, 0, -17);
        }
      }
      player.rotation.y = this.stage === 0 ? Math.atan2(player.position.x - this.guide.position.x, player.position.z - this.guide.position.z) : 0;
    }
    const t = reduced ? 1 : T.MathUtils.smoothstep(this.elapsed, 0, this.returning ? .8 : 1.1);
    camera.position.lerpVectors(this.from, position, t); look.lerpVectors(this.fromLook, aim, t);
    if (this.returning && t === 1) { this.returning = false; this.clearInput(); }
    return true;
  }
}
