type Callbacks = { start: () => void; pause: () => void; mute: () => void; jump: () => void; dive: () => void; move: (x: number, y: number) => void; hint?: () => void };
type Snapshot = { state: string; time: number; rank: number; finished: number; paused: boolean; muted: boolean; cue: string; countdown: number; diveReady?: boolean };

const icon = (name: string, paths: string) => `<svg class="control-icon" data-icon="${name}" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
const icons = {
  fullscreen: icon('maximize', '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'),
  minimize: icon('minimize', '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>'),
  sound: icon('volume-2', '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>'),
  muted: icon('volume-x', '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>'),
  home: icon('house', '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  pause: icon('pause', '<rect width="4" height="16" x="6" y="4" rx="1"/><rect width="4" height="16" x="14" y="4" rx="1"/>'),
  play: icon('play', '<path d="m6 4 14 8-14 8z"/>'),
  block: icon('block', '<path d="m12 3 9 5v9l-9 5-9-5V8z"/><path d="m3 8 9 5 9-5M12 13v9"/>'),
  water: icon('water', '<path d="M3 8c3-6 6 6 9 0s6 6 9 0M3 16c3-6 6 6 9 0s6 6 9 0"/>'),
  star: icon('star', '<path class="icon-fill" d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>'),
  retry: icon('retry', '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
  key: icon('key', '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>'),
  chick: icon('chick', '<path d="M18 10V7a4 4 0 0 0-8 0v3a6 6 0 0 0-6 6c0 3 3 4 7 4a7 7 0 0 0 7-7Z"/><path d="m18 7 3 2-3 1M7 14c1 2 3 3 5 1M9 20v2m5-2v2M14.5 6.5h.01"/>'),
};

export class UI {
  private root = document.createElement('div');
  private lastMode = '';
  private stickPointer: number | null = null;
  private actions: Callbacks;
  private puzzle = false;

  constructor(callbacks: Callbacks) {
    this.actions = callbacks;
    this.root.id = 'game-ui';
    this.root.innerHTML = `
      <header class="race-hud">
        <div class="wordmark"><span class="logo-bean" aria-hidden="true">••</span><div>GUMMY<span>RUSH</span></div></div>
        <div class="course-title"><small>RACE 01</small><strong>棉花糖天空赛道</strong></div>
        <div class="hud-tools"><a id="go-home" class="icon-button" href="./?homeArrival=1" aria-label="返回首页" title="返回首页">${icons.home}</a><button id="fullscreen" class="icon-button fullscreen" aria-label="全屏游戏" title="全屏">${icons.fullscreen}</button><button id="sound" class="icon-button" aria-label="关闭声音" title="关闭声音">${icons.sound}</button><button id="pause" class="icon-button" aria-label="暂停游戏" title="暂停">${icons.pause}</button></div>
      </header>
      <div class="race-stats"><span class="finish-badge">★ <b id="finished">0 / 8</b><small>已晋级</small></span><span class="race-clock" id="clock">1:30</span></div>
      <div class="player-badge" aria-label="你的名次"><span class="player-face" aria-hidden="true"><svg viewBox="0 0 64 64"><g fill="#bfe5d9" stroke="#b5a1d5" stroke-width="3"><path d="M18 34C0 31 0 20 7 21C0 3 12 0 18 13L24 33Z"/><path d="M46 34C64 31 64 20 57 21C64 3 52 0 46 13L40 33Z"/></g><ellipse cx="32" cy="39" rx="23" ry="22" fill="#f2eaf7"/><g fill="#352565"><ellipse cx="24" cy="37" rx="4" ry="7"/><ellipse cx="40" cy="37" rx="4" ry="7"/><path d="M28 49Q32 55 36 49Z"/></g><g fill="white"><circle cx="23" cy="34" r="1.6"/><circle cx="39" cy="34" r="1.6"/></g></svg></span><strong>第 <b id="rank">1</b> 名 <em>/ 12</em></strong></div>
      <div id="guidance" class="guidance" role="status"><span>↑</span><b id="cue">跟着箭头走！</b></div>
      <div id="countdown" class="countdown" aria-live="polite"></div>
      <div id="touch-controls" class="touch-controls">
        <div id="stick" class="stick" role="group" aria-label="移动摇杆"><span class="stick-arrows">✥</span><span id="stick-knob"></span></div>
        <div class="action-controls"><button id="dive" class="action-button dive"><span>➜</span><b>冲扑</b></button><button id="jump" class="action-button jump"><span>↑</span><b>跳跃</b></button></div>
      </div>
      <div class="keyboard-guide"><kbd>W A S D</kbd> / <kbd>↑ ↓ ← →</kbd> 移动 <i></i><kbd>空格</kbd> 跳跃 <i></i><kbd>Shift</kbd> 冲扑</div>
      <div id="menu" class="menu-scrim"><section class="menu-card" aria-labelledby="menu-title"><div id="menu-badge" class="menu-badge" aria-hidden="true"></div><h1 id="menu-title">冲到终点<br><span>就能晋级！</span></h1><p id="menu-description">跳过障碍、躲开摆锤，<br>和 11 个小伙伴一起冲！</p><div id="menu-tips" class="menu-tips"><span>↔<small>跑一跑</small></span><span>↑<small>跳一跳</small></span><span>⚑<small>前 8 名晋级</small></span></div><button id="primary" class="primary-button">开始玩 <span>➜</span></button><button id="restart" class="secondary-button" hidden>重新开始</button></section></div>`;
    document.body.append(this.root);
    const levelLink = document.createElement('a');
    levelLink.className = 'level-link';
    levelLink.href = '?level=2';
    levelLink.textContent = '下一关 · 解谜花园 →';
    this.get('menu').querySelector('.menu-card')!.append(levelLink);
    this.get<HTMLButtonElement>('pause').onclick = callbacks.pause;
    this.get<HTMLButtonElement>('sound').onclick = callbacks.mute;
    this.get<HTMLButtonElement>('restart').onclick = callbacks.start;
    this.get<HTMLButtonElement>('fullscreen').onclick = () => {
      const action = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
      action?.catch(() => {});
    };
    document.addEventListener('fullscreenchange', () => {
      const button = this.get<HTMLButtonElement>('fullscreen');
      const active = Boolean(document.fullscreenElement);
      button.innerHTML = active ? icons.minimize : icons.fullscreen;
      button.title = active ? '退出全屏' : '全屏';
      button.setAttribute('aria-label', active ? '退出全屏' : '全屏游戏');
    });
    for (const action of ['jump', 'dive'] as const) this.wireAction(action, callbacks[action]);
    const stick = this.get('stick');
    const move = (event: PointerEvent) => {
      if (this.stickPointer !== event.pointerId) return;
      const rect = stick.getBoundingClientRect();
      const radius = rect.width * .32;
      let x = (event.clientX - rect.left - rect.width / 2) / radius;
      let y = (event.clientY - rect.top - rect.height / 2) / radius;
      const length = Math.hypot(x, y);
      if (length > 1) { x /= length; y /= length; }
      this.get('stick-knob').style.transform = `translate(${x * radius}px, ${y * radius}px)`;
      callbacks.move(x, y);
    };
    stick.addEventListener('pointerdown', event => { if (this.stickPointer !== null) return; event.preventDefault(); this.stickPointer = event.pointerId; stick.setPointerCapture(event.pointerId); move(event); });
    stick.addEventListener('pointermove', move);
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(name, () => this.resetInput());
    window.addEventListener('blur', () => this.resetInput());
    window.addEventListener('resize', () => this.resetInput());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.resetInput(); });
  }

  private get<T extends HTMLElement = HTMLElement>(id: string) { return this.root.querySelector<T>(`#${id}`)!; }
  private wireAction(id: string, action: () => void) {
    const button = this.get<HTMLButtonElement>(id);
    button.addEventListener('pointerdown', event => { event.preventDefault(); action(); button.setPointerCapture(event.pointerId); button.classList.add('pressed'); });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, () => button.classList.remove('pressed'));
    button.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); } });
  }
  private text(id: string, value: string) {
    const element = this.get(id);
    if (element.textContent !== value) element.textContent = value;
  }
  configurePuzzle() {
    this.puzzle = true;
    this.root.classList.add('puzzle-ui');
    this.root.querySelector('.course-title')!.innerHTML = '<small>ADVENTURE 02</small><strong>三把钥匙的花园</strong>';
    this.get('guidance').querySelector('span')!.textContent = '✦'; // The garden banner never points a way.
    this.root.querySelector('.finish-badge')!.innerHTML = '<span aria-hidden="true">⚿</span><b id="finished">0 / 3</b><small>把钥匙</small>';
    this.get('clock').hidden = true;
    this.root.querySelector('.player-badge')!.setAttribute('hidden', '');
    this.get('dive').innerHTML = '<span>✋</span><b>拿起 / 放下</b>';
    this.get('dive').insertAdjacentHTML('beforebegin', '<button id="hint" class="action-button hint"><span>?</span><b>提示</b></button>');
    this.wireAction('hint', () => this.actions.hint?.());
    this.root.querySelector('.keyboard-guide')!.innerHTML = '<kbd>W A S D</kbd> / 方向键 移动　<kbd>空格</kbd> 跳跃　<kbd>E</kbd> 互动　<kbd>H</kbd> 提示';
    this.root.querySelector<HTMLAnchorElement>('.level-link')!.hidden = true;
  }
  updatePuzzle(state: string, paused: boolean, muted: boolean, cue: string, count: number, action: string) {
    this.update({ state, paused, muted, cue, finished: count, rank: 1, time: 0, countdown: 0 });
    const buttonLabel = this.get('dive').querySelector('b')!;
    if (buttonLabel.textContent !== action) buttonLabel.textContent = action;
  }
  private resetInput() {
    this.stickPointer = null;
    this.get('stick-knob').style.transform = 'translate(0, 0)';
    this.root.querySelectorAll('.pressed').forEach(button => button.classList.remove('pressed'));
    this.actions.move(0, 0);
  }

  update(snapshot: Snapshot) {
    this.text('rank', String(snapshot.rank));
    this.text('finished', `${snapshot.finished} / ${this.puzzle ? 3 : 8}`);
    this.get('dive').classList.toggle('recharging', snapshot.diveReady === false);
    const seconds = Math.max(0, Math.ceil(snapshot.time));
    this.text('clock', `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
    this.text('cue', snapshot.cue || '跟着箭头走！');
    const sound = this.get<HTMLButtonElement>('sound');
    const soundIcon = snapshot.muted ? icons.muted : icons.sound;
    if (sound.querySelector('svg')?.dataset.icon !== (snapshot.muted ? 'volume-x' : 'volume-2')) sound.innerHTML = soundIcon;
    sound.title = snapshot.muted ? '打开声音' : '关闭声音';
    sound.setAttribute('aria-label', sound.title);
    const pause = this.get<HTMLButtonElement>('pause');
    const pauseIcon = snapshot.paused ? icons.play : icons.pause;
    if (pause.querySelector('svg')?.dataset.icon !== (snapshot.paused ? 'play' : 'pause')) pause.innerHTML = pauseIcon;
    pause.title = snapshot.paused ? '继续' : '暂停';
    pause.setAttribute('aria-label', snapshot.paused ? '继续游戏' : '暂停游戏');
    this.text('countdown', snapshot.state === 'countdown' ? String(Math.max(1, Math.ceil(snapshot.countdown))) : '');
    const mode = snapshot.paused ? 'paused' : snapshot.state;
    if (mode === this.lastMode) return;
    this.lastMode = mode;
    this.root.dataset.state = mode;
    const playing = mode === 'racing' || mode === 'countdown';
    this.get('menu').hidden = playing;
    this.get('go-home').hidden = playing;
    this.get('touch-controls').hidden = mode !== 'racing';
    this.get('guidance').hidden = !playing;
    this.get<HTMLButtonElement>('pause').disabled = !playing && mode !== 'paused';
    if (playing) return;
    this.resetInput();
    const won = mode === 'qualified';
    const ready = mode === 'ready';
    const paused = mode === 'paused';
    this.root.classList.toggle('card-mode', this.puzzle || !ready);
    this.get('menu-badge').innerHTML = paused ? icons.pause : won ? icons.star : ready ? icons.key : icons.retry;
    this.get('menu-title').innerHTML = this.puzzle ? (ready ? '找齐钥匙' : paused ? '休息一下' : '大门打开啦！') : ready ? '冲到终点<br><span>就能晋级！</span>' : paused ? '休息一下' : won ? '晋级啦！' : '再来挑战吧！';
    this.get('menu-description').innerHTML = ready ? '跳过障碍、躲开摆锤，<br>和 11 个小伙伴一起冲！' : paused ? '准备好了就继续冲！' : won ? `你是第 ${snapshot.rank} 名到达终点！` : '没关系，每次都会更厉害一点！';
    const nextLevel = this.root.querySelector<HTMLAnchorElement>('.level-link')!;
    const restart = this.get<HTMLButtonElement>('restart');
    this.get('menu-tips').hidden = !ready;
    restart.hidden = !paused;
    restart.textContent = '重新开始';
    if (!this.puzzle) {
      nextLevel.hidden = !won;
      restart.hidden = !paused && !won;
      if (won) restart.textContent = '再玩一次';
      this.get('primary').hidden = won;
    }
    if (this.puzzle) {
      this.get('menu-description').textContent = ready ? '解开三个谜题，打开花园。' : paused ? '准备好，就继续找钥匙。' : '太棒了，三把钥匙找齐了！';
      this.get('menu-tips').innerHTML = `<span>${icons.block}<small>积木</small></span><span>${icons.water}<small>水管</small></span><span>${icons.chick}<small>小鸡</small></span>`;
    }
    const primary = this.get<HTMLButtonElement>('primary');
    primary.innerHTML = paused ? '继续玩 <span>▶</span>' : ready ? '开始玩 <span>▶</span>' : '再玩一次 <span>↻</span>';
    primary.onclick = paused ? this.actions.pause : this.actions.start;
    if (!ready) (primary.hidden ? nextLevel : primary).focus({ preventScroll: true });
  }
}
