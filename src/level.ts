import Simplex from "../lib/rotjs/noise/simplex";
import Entity, { EntityConstructor } from "./entity";
import XY from "./xy";
import Game from "./game";
import Player from "./entities/player";
import TextBuffer from "./textbuffer"
import { Color } from "../lib/rotjs";
import * as Terrain from "./entities/terrain";


const DEBUG = 1
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

  let originalSize = level.getSize()
  let originalOffset = level._offset
  let zoomedOut = false
  window.addEventListener("keydown", (e) => {
    if (e.key === "0") {
      if (zoomedOut) {
        level._size = originalSize
        level._offset = originalOffset
      } else {
        level._size = level._map_size
        level._offset = new XY(0, 0)
      }
      zoomedOut = !zoomedOut
      let size = level.getSize();
      level.game.display.setOptions({ width: size.x, height: size.y });
      level.drawMap()
    } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      if (e.key === "ArrowUp") level._offset.y--
      if (e.key === "ArrowDown") level._offset.y++
      if (e.key === "ArrowLeft") level._offset.x--
      if (e.key === "ArrowRight") level._offset.x++
      level.drawMap()
    }
  })
}


export default class MainLevel {
  private _map_size: XY;
  private _map: Entity[][]
  private _size: XY;
  private _offset: XY;
  private _fovCells: XY[] = []
  textBuffer: TextBuffer;
  game: Game
  player: Player

  constructor(game: Game) {
    this.game = game;
    this._map_size = new XY(400, 400);
    this._map = Array.from(Array(this._map_size.y), () => Array(this._map_size.x));
    this._size = new XY(65, 50);
    this._offset = new XY(200, 200);

    this.player = new Player(this, new XY(0, 0))

    this._generateMap();
    this.drawMap()

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


  draw(viewportXY: XY): void {
    let mapXY = viewportXY.plus(this._offset)
    let entity = this.getEntityAt(mapXY);
    let visual = entity ? entity.getVisual() : { ch: "x", fg: "black" }
    let color = visual.fg
    let brightened = Color.toHex(Color.add(Color.fromString("#111"), Color.fromString(visual.fg)))
    this.game.display.draw(viewportXY.x, viewportXY.y, visual.ch, brightened);
  }

  drawMap(): void {
    // draws curent viewport
    const xy = new XY()
    for (let j = 0; j < this._size.y; j++) {
      for (let i = 0; i < this._size.x; i++) {
        xy.x = i
        xy.y = j
        this.draw(xy)
      }
    }
  }

  getSize() { return this._size; }

  setEntity(entity: Entity, xy: XY) {
    entity.setPosition(xy); // propagate position data to the entity itself
    this._map[xy.x][xy.y] = entity;
    this.draw(xy);
  }

  getEntityAt(xy: XY): Entity | null {
    return this._map[xy.x][xy.y]
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
    // let mapping = [
    //   "red", // lava
    //   "#754", // dirt
    //   "#2a2", // grass
    //   "#33f", // water
    //   "#2a2", // grass
    //   "#172", // trees
    //   "#050", // jungle
    // ]
    let mapping = [
      Terrain.Lava,
      Terrain.Dirt,
      Terrain.Grass,
      Terrain.Water,
      Terrain.Grass,
      Terrain.Shrub,
      Terrain.Jungle
    ]

    let easeIn = x => 1 - Math.cos((x * Math.PI) / 2);
    let easeOut = x => Math.sin((x * Math.PI) / 2);
    let easeInOut = x => -(Math.cos(Math.PI * x) - 1) / 2;

    const noise = new Simplex()

    // noise with l octaves
    let get_noise = (x, y, scale, l = 3, height = 1) => {
      if (l === 0) return 0
      var n = noise.get(x / scale, y / scale) * height
      let decay = 0.5
      return n + get_noise(x, y, scale * decay, l - 1, height * decay)
    }

    const { x, y } = this._map_size
    const scale = 120
    const center = new XY(x / 2, y / 2)

    for (var j = 0; j < y; j++) {
      for (var i = 0; i < x; i++) {
        let dist = center.dist(new XY(i, j))
        let waterLevel = dist / (x / 2)
        let n = get_noise(i, j, scale, 5)

        n = ((n + 0.7) / 2) // "lowers" water level of rivers (compresses alpha range to 0.5-1, cutting off lowe end of terrain map)
        // n = easeInOut(n)
        n = Math.abs(n) // makes nicer sharper valleys and peaks
        n = n + waterLevel // makes "island" shape

        let entity_class: EntityConstructor = mapping[Math.floor(n * mapping.length)] || Terrain.Ocean
        this._map[i][j] = new entity_class(this, new XY(j, i))
      }
    }


    // TODO generate mobs/items
    // this._map[60][20] = new Entity(this, new XY(60, 20), { ch: "@", fg: "yellow" })
  }
}
