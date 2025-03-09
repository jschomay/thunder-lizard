import Game from "./game";
import XY from "./xy";
import level1Data from "./level-data/start-screen.txt?raw";
import MainLevel from "./level";


export default class StartScreen {

  size = new XY(120, 20);
  game: Game
  _levelData = level1Data

  constructor(game: Game) {
    this.game = game
    this._generateMap()
  }

  draw(xy: XY): void {
    this._generateMap()
  }

  // for mobile
  onClick(e: MouseEvent) {
    this.onKeyDown(new KeyboardEvent("keydown", { 'key': 'Enter' }))
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key !== "Enter") { return }
    this.game.switchLevel(new MainLevel(this.game))
  }

  getSize() { return this.size }

  _clear() {
    for (let i = 0; i < this.size.y; i++) {
      for (let j = 0; j < this.size.x; j++) {
        this.game.display.draw(j, i, " ", null, null);
      }
    }
  }

  _generateMap() {
    let map = this._levelData.split("\n")
    for (let row = 0; row < this.size.y; row++) {
      for (let col = 0; col < this.size.x; col++) {
        let ch = map[row][col]
        let color = "#6a6"
        this.game.display.draw(col, row, ch, color);
      }
    }
  }

}
