import './home.css';
import { createHomeScene } from './home-scene';
import { readSettings, saveSettings } from './settings';

export function showHome() {
  const root = document.createElement('main');
  root.id = 'home';
  root.innerHTML = `
    <div class="home-menu">
      <h1 class="home-logo" aria-label="Bean Rush"><span>BEAN</span><span>RUSH</span></h1>
      <nav aria-label="游戏首页">
        <a class="home-start" href="?level=1"><span aria-hidden="true">▶</span>开始游戏</a>
        <button class="home-levels" id="choose-level">选择关卡</button>
      </nav>
    </div>
    <button id="home-settings" class="home-gear" aria-label="设置" title="设置"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3-1 3-3 1-2 4 2 2v3l4 3 3-1 3 1 4-3v-3l2-2-2-4-3-1-1-3Z"/><circle cx="12" cy="11" r="3.5"/></svg></button>
    <dialog id="level-dialog" aria-labelledby="level-heading">
      <button class="home-close" aria-label="关闭">×</button><h2 id="level-heading">选择关卡</h2>
      <div class="home-level-grid">
        <a href="?level=1"><img class="level-art" src="${import.meta.env.BASE_URL}images/sky-race-cover.png" alt="" width="1774" height="887" /><small>第一关</small><strong>天空赛道</strong><span>跑一跑，跳向终点</span></a>
        <a href="?level=2"><img class="level-art" src="${import.meta.env.BASE_URL}images/puzzle-garden-cover.png" alt="" width="1774" height="887" /><small>第二关</small><strong>解谜花园</strong><span>找齐钥匙，打开花园</span></a>
      </div>
    </dialog>
    <dialog id="settings-dialog" aria-labelledby="settings-heading">
      <button class="home-close" aria-label="关闭">×</button><h2 id="settings-heading">设置</h2>
      <label class="home-setting">背景音乐<input type="checkbox" id="music-setting" role="switch" /></label>
      <label class="home-setting">音效与语音<input type="checkbox" id="effects-setting" role="switch" /></label>
      <button class="home-done">完成</button>
    </dialog>`;
  document.body.append(root);
  const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
  canvas.setAttribute('aria-label', '云端空岛与紫耳小精灵');
  const cleanup = createHomeScene(canvas);
  addEventListener('pagehide', event => { if (!event.persisted) cleanup(); });
  const settings = readSettings();
  const music = new Audio(`${import.meta.env.BASE_URL}audio/startime.mp3`);
  music.loop = true; music.volume = .22; music.preload = 'auto';
  music.hidden = true; root.append(music);
  const syncMusic = () => {
    if (!settings.music || document.hidden) music.pause();
    else if (music.paused) void music.play().catch(() => { /* Retry after user interaction if autoplay is blocked. */ });
  };
  addEventListener('pointerdown', syncMusic);
  addEventListener('keydown', syncMusic);
  document.addEventListener('visibilitychange', syncMusic);
  addEventListener('pagehide', () => music.pause());
  addEventListener('pageshow', syncMusic);
  syncMusic();
  for (const key of ['music', 'effects'] as const) {
    const input = root.querySelector<HTMLInputElement>(`#${key}-setting`)!;
    input.checked = settings[key];
    input.onchange = () => { settings[key] = input.checked; saveSettings(settings); syncMusic(); };
  }
  for (const [button, id] of [['choose-level', 'level-dialog'], ['home-settings', 'settings-dialog']]) {
    const dialog = root.querySelector<HTMLDialogElement>(`#${id}`)!;
    root.querySelector<HTMLButtonElement>(`#${button}`)!.onclick = () => dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('.home-close')!.onclick = () => dialog.close();
    dialog.querySelector<HTMLButtonElement>('.home-done')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) {
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    } });
  }
}
