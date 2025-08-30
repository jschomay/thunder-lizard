import Game from "./game";
import XY from "./xy";
import level1Data from "./level-data/start-screen.txt?raw";
import MainLevel from "./level";
import * as Terrain from "./entities/terrain";
import WorldMap from "./map";
import { RNG } from "../lib/rotjs";
import Entity from "./entity";

const [W, H] = [80, 55]

export default class StartScreen {

  size = new XY(W, H);
  game: Game
  bgMap: WorldMap = new WorldMap(W, H)
  _levelData = level1Data
  _interval: number = 0

  constructor(game: Game) {
    this.game = game
    this._generateBG()
    this._drawMap()
    this._lavaloop()
  }

  draw(xy: XY): void {
    this._drawMap()
  }

  // for mobile
  onClick(e: MouseEvent) {
    clearInterval(this._interval)
    this.game.switchLevel(new MainLevel(this.game))
  }

  onKeyUp(e: KeyboardEvent): void { }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key !== " ") return
    clearInterval(this._interval)
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

  _lavaloop() {
    const tickTimeMs = 300
    const loop = () => {
      // cellular automata lava "spread"
      // using spread operator to force Set iterator or this loop would be recursive
      for (let lava of [...this.bgMap.getTagged(Terrain.Lava)]) {
        let { x, y } = lava.getXY()
        if (x === 0 || y === 0 || x === this.size.x - 1 || y === this.size.y - 1) continue
        let north = this.bgMap.at(x, y - 1)
        let south = this.bgMap.at(x, y + 1)
        let west = this.bgMap.at(x - 1, y)
        let east = this.bgMap.at(x + 1, y)
        let neighbors = new Set([north, south, west, east].filter(e => e)) as Set<Entity>
        for (let n of neighbors) {
          if (!(n instanceof Terrain.Dirt)) {
            neighbors.delete(n)
            continue
          }
          if (RNG.getPercentage() <= 10) {
            let l = new Terrain.Lava(this, n.getXY())
            // overwrite the existing terrain
            this.bgMap.set(l, true)
            this.bgMap.removeFromIndex(n) // currently no necessary, but just in case
          }
        }
        // lava "burns out" when surrounded by lava or ocean
        if (neighbors.size === 0) {
          this.bgMap.removeFromIndex(lava)
          let ch = RNG.getItem("¸ʾ˚˓".split(""))!
          lava.setVisual({ ch })
        }
      }
      this._drawMap()
      this._interval = setTimeout(loop, tickTimeMs)
    }
    loop()
  }

  _generateBG() {
    let mapping = [100, 80, 50, 10, 0]
    for (let row = 0; row < this.size.y; row++) {
      for (let col = 0; col < this.size.x; col++) {
        let lavaAbove = row === 0 || (this.bgMap.at(col, row - 1) instanceof Terrain.Lava)
        if (lavaAbove && RNG.getPercentage() <= (mapping[row] || 0)) {
          this.bgMap.set(new Terrain.Lava(this.game.level, new XY(col, row)), true)
        } else {
          this.bgMap.set(new Terrain.Dirt(this.game.level, new XY(col, row)), true)
        }
      }
    }
  }

  _drawMap() {
    let titleMap = this._levelData.split("\n")
    let titleOffsetX = Math.ceil((this.size.x - titleMap[0].length) / 2)
    let titleOffsetY = 13
    for (let row = 0; row < this.size.y; row++) {
      for (let col = 0; col < this.size.x; col++) {
        let bg = this.bgMap.at(col, row)!
        let ch = bg.getVisual().ch
        let color = bg.getVisual().fg

        let titleX = row - titleOffsetY
        let titleY = col - titleOffsetX
        if (titleMap[titleX] && titleMap[titleX][titleY] && titleMap[titleX][titleY] != ' ') {
          ch = titleMap[titleX][titleY]
          color = "orange"// "#6a6"
        }

        this.game.display.draw(col, row, ch, color);
      }
    }
  }

}
