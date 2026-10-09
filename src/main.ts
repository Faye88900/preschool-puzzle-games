import './style.css';
import { readSettings } from './settings';

const buttonSound = new Audio(`${import.meta.env.BASE_URL}audio/ui/button-click.wav`);
buttonSound.id = 'button-sound'; buttonSound.hidden = true;
buttonSound.volume = .65; buttonSound.preload = 'auto';
document.body.append(buttonSound);
let buttonSoundPlay = 0;
let buttonSoundHeard = 0;
function playButtonSound(event: Event) {
  const button = (event.target as Element).closest('button, a[href], input[role="switch"]');
  if (!button || button.matches(':disabled, [aria-disabled="true"]') || !readSettings().effects) return;
  if (event instanceof PointerEvent && event.button !== 0) return;
  if (event.type === 'click' && (event as MouseEvent).detail !== 0) return;
  // Action buttons consume keyboard events instead of generating a native click.
  if (event instanceof KeyboardEvent && (event.repeat || !['Enter', ' '].includes(event.key) || !button.matches('.action-button'))) return;
  const play = ++buttonSoundPlay;
  buttonSound.currentTime = 0;
  buttonSound.onended = () => { if (play === buttonSoundPlay) buttonSoundHeard = play; };
  void buttonSound.play().catch(() => { if (play === buttonSoundPlay) buttonSoundHeard = play; });
}
for (const event of ['pointerdown', 'click', 'keydown']) document.addEventListener(event, playButtonSound, true);
// The click swells for about 0.2s. A link unloads the page on click, so hold the navigation until this play finishes.
document.addEventListener('click', event => {
  if (!(event instanceof MouseEvent) || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = (event.target as Element | null)?.closest?.('a[href]');
  if (!(link instanceof HTMLAnchorElement) || link.target === '_blank' || link.hasAttribute('download')) return;
  if (link.dataset.cloudTransfer === 'true') return;
  if (!readSettings().effects || buttonSoundHeard === buttonSoundPlay) return;
  event.preventDefault();
  const play = buttonSoundPlay;
  const started = performance.now();
  const finish = () => {
    if (buttonSoundHeard === play || performance.now() - started > 1000) location.assign(link.href);
    else requestAnimationFrame(finish);
  };
  finish();
}, true);

const params = new URLSearchParams(location.search);
const loading = document.createElement('dialog');
loading.className = 'game-loading';
loading.setAttribute('aria-label', '加载中');
document.body.append(loading);
loading.showModal();
async function boot() {
  if (params.has('character')) return (await import('./character-preview')).showCharacterPreview();
  const level = params.get('level');
  if (level === '1') return new (await import('./race')).Race().init();
  if (level === '2') return new (await import('./puzzle')).PuzzleGarden().init();
  return (await import('./home')).showHome();
}
async function start() {
  const level = params.get('level');
  const homeArrival = params.get('homeArrival') === '1';
  if (params.has('character') || (level !== '1' && level !== '2' && !homeArrival)) return boot();
  if (homeArrival) {
    const url = new URL(location.href);
    url.searchParams.delete('homeArrival');
    history.replaceState(null, '', url);
  }
  const { startJourney } = await import('./journey');
  const destination = level === '1' ? '天空赛道' : level === '2' ? '解谜花园' : '空岛';
  const journey = startJourney(loading, destination);
  try { await boot(); await journey.arrive(); }
  finally { journey.dispose(); }
}
start().catch(error => {
  document.body.innerHTML = '<main style="padding:40px;font:24px sans-serif">暂时无法打开游戏，请刷新再试一次。</main>';
  console.error(error);
}).finally(() => { loading.close(); loading.remove(); });
