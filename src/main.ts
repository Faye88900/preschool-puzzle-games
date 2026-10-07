import './style.css';
import { Race } from './race';
import { PuzzleGarden } from './puzzle';
const params = new URLSearchParams(location.search);
const ready = params.has('character')
  ? import('./character-preview').then(({ showCharacterPreview }) => showCharacterPreview())
  : (params.get('level') === '2' ? new PuzzleGarden() : new Race()).init();
ready.catch(error => {
  document.body.innerHTML = '<main style="padding:40px;font:24px sans-serif">暂时无法打开游戏，请刷新再试一次。</main>';
  console.error(error);
});
