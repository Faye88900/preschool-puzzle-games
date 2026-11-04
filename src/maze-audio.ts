import { PuzzleAudio } from './puzzle-audio';

export class MazeAudio extends PuzzleAudio {
  exploration = this.music;
  battle = new Audio(`${import.meta.env.BASE_URL}audio/maze/gust-of-the-crystal-wand.mp3`);

  constructor() {
    super('audio/maze/whispering-maze.mp3');
    this.battle.loop = true;
    this.battle.preload = 'auto';
  }

  setCombat(combat: boolean) {
    const next = combat ? this.battle : this.exploration;
    if (next === this.music) return;
    const playing = !this.music.paused;
    this.music.pause();
    next.volume = this.music.volume;
    next.muted = this.music.muted;
    this.music = next;
    if (playing) this.resume();
  }

  override stop() {
    super.stop();
    for (const track of [this.exploration, this.battle]) {
      track.pause();
      track.currentTime = 0;
    }
    this.exploration.muted = this.music.muted;
    this.music = this.exploration;
    this.music.volume = .22;
  }
}
