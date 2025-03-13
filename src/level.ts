import Simplex from "../lib/rotjs/noise/simplex";
import * as ROT from "../lib/rotjs";
import Entity from "./entity";
import XY from "./xy";
import Game from "./game";
import Player from "./entities/player";
import TextBuffer from "./textbuffer"
import { Color } from "../lib/rotjs";


const DEBUG = 0
function debug(level: MainLevel) {
  // level.player.setPosition(new XY(99, 30))


  // inspect helpers
  window._at = (x, y, ...rest) => level.getEntityAt(new XY(x, y), ...rest)
  level.game._container.addEventListener("click", e => console.log(level.getEntityAt(new XY(...level.game.display.eventToPosition(e)), true)))
  level.game._container.addEventListener("click", e => {
    let xy = new XY(...level.game.display.eventToPosition(e))
    let oldXy = level.player.getXY()
    level.player.setPosition(xy)
    level.draw(oldXy)
    level.draw(xy)
    level.updateFOV()
  }
  )

  window.addEventListener("keyup", (e) => {
    if (e.key === "8") {
      // ...
    }
  })
}


export default class MainLevel {
  private _size: XY;
  private _map: Record<string, Entity>;
  private _fovCells: XY[] = []
  textBuffer: TextBuffer;
  game: Game
  player: Player

  constructor(game: Game) {
    this.game = game;
    this._map = {};
    this._size = new XY(120, 40);

    this.player = new Player(this, new XY(0, 0))

    this._generateMap();

    this.textBuffer = new TextBuffer(this.game);

    let size = this.getSize();
    let bufferSize = 3;
    this.textBuffer.configure({
      position: new XY(0, 0),
      size: new XY(size.x, bufferSize)
    });
    this.textBuffer.clear();

    game.scheduler.clear();
    game.scheduler.add(this.player, true);


    if (DEBUG) {
      debug(this)
    }
  }

  // for mobile
  public onClick(e: MouseEvent) {
    this.textBuffer.clear()

    if (this.textBuffer.showing) {
      this.textBuffer.clearDisplayBox()
      return
    }


    let [x, y] = this.game.display.eventToPosition(e);
    // do something with coord
  }


  onKeyDown(e: KeyboardEvent) {
    this.textBuffer.clear()

    if (this.textBuffer.showing) {
      if (e.key === "Enter") {
        this.textBuffer.clearDisplayBox()
      }
    } else {
      this.player.onKeyDown(e)
    }
  }


  draw(xy: XY): void {
    let entity = this.getEntityAt(xy);
    let visual = entity!.getVisual();
    this.game.display.draw(xy.x, xy.y, visual.ch, visual.fg);
  }

  getSize() { return this._size; }

  setEntity(entity: Entity, xy: XY) {
    entity.setPosition(xy, this); // propagate position data to the entity itself
    this._map[xy.toString()] = entity;
    this.draw(xy);
  }

  getEntityAt(xy: XY): Entity | null {
    return this._map[xy.toString()]
  }

  updateFOV() {
    // clear old FOV
    while (this._fovCells.length) {
      this.draw(this._fovCells.pop()!);
    }

    return

    let { x: player_x, y: player_y } = this.player.getXY()!
    let { r: fov_r, fov, cb } = get_fov()

    let wrappedCb = (x, y, r, visibility) => {
      // don't include player
      if (r === 0) return;
      // don't render over top and bottom display
      if (y < 3 || y > this._size.y - 2) return;

      let xy = new XY(x, y)
      this._fovCells.push(xy);

      cb(x, y, r, visibility)
    }

    // draw new FOV
    fov.compute(player_x, player_y, fov_r, wrappedCb);
  }

  _generateMap() {
    // clear out title
    for (let row = 0; row < this._size.y; row++) {
      for (let col = 0; col < this._size.x; col++) {
        this.game.display.draw(col, row, " ")
      }
    }
    // TODO
    let mapping = [
      "#000",
      "#222",
      "#444",
      "#666",
      "#888",
      "#aaa",
      "#ccc",
      "#eee",
    ]

    // more black, steeper
    let easeIn = x => 1 - Math.cos((x * Math.PI) / 2);
    // more white, steeper
    let easeOut = x => Math.sin((x * Math.PI) / 2);
    // blaanced, steeper
    let easeInOut = x => -(Math.cos(Math.PI * x) - 1) / 2;

    const noise = new Simplex()
    const { x, y } = this.getSize()
    let scale = 30
    for (var j = 0; j < y; j++) {
      for (var i = 0; i < x; i++) {
        var n = noise.get(i / scale, j / scale);
        let val = ((n + 1) / 2)
        // val = easeIn(val)
        // val = easeOut(val)
        // val = easeInOut(val)

        let alpha = val * 255
        let alpha_color = ROT.Color.toRGB([alpha, alpha, alpha])

        let terrain_color = mapping[Math.floor(val * mapping.length)]
        this.game.display.draw(i, j, ".", alpha_color, terrain_color)

        // let val = n * 255
        // var r = ~~(val > 0 ? val : 0);
        // this.game.display.draw(i, j, "", "", "rgb(" + r + "," + g + ",0)");
        // var g = ~~(val < 0 ? -val : 0);
      }
    }
    this._map["60,20"] = new Entity(this, new XY(60, 20))


    for (let key in this._map) {
      let entity = this._map[key]
      if (entity) this.draw(entity.getXY()!)
    }

  }
}
