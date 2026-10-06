import './style.css';
import { Race } from './race';
import { PuzzleGarden } from './puzzle';
const game = new URLSearchParams(location.search).get('level') === '2' ? new PuzzleGarden() : new Race();
game.init().catch(error => {
  document.body.innerHTML = '<main style="padding:40px;font:24px sans-serif">暂时无法打开游戏，请刷新再试一次。</main>';
  console.error(error);
});
