import Scheduler from "../lib/rotjs/scheduler/scheduler";
import Simplex from "../lib/rotjs/noise/simplex";
import Entity, { EntityConstructor, Actor } from "./entity";
import XY from "./xy";
import Game from "./game";
import Player from "./entities/player";
import TextBuffer from "./textbuffer"
import { Color } from "../lib/rotjs";
import * as ROT from "../lib/rotjs";
import * as Terrain from "./entities/terrain";
import WorldMap from "./map";
import { DEBUG, debug } from "./debug";



const MAP_SIZE = 400

export default class MainLevel {
  private _viewportSize: XY;
  private _viewportOffset: XY;
  private _fovCells: XY[] = []
  map: WorldMap
  scheduler: Scheduler;
  textBuffer: TextBuffer;
  game: Game
  player: Player
  paused: null | ((value: any) => void) = null // pause check and call to resume
  whenRunning: Promise<any> = Promise.resolve()

  constructor(game: Game) {
    this.game = game;
    this.map = new WorldMap(MAP_SIZE, MAP_SIZE)
    this._viewportSize = new XY(65, 50);
    this._viewportOffset = new XY(200, 200);
    this.scheduler = new ROT.Scheduler.Speed();

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

    // this.scheduler.add(this.player, true);


    if (DEBUG) {
      debug(this)
    }

    this.waterLoop()
    this.lavaloop()
    // this.mainLoop()
  }

  waterLoop() {
    const tickTimeMs = 300
    const loop = () => {
      for (let e of this.map.get(this._getViewport())) {
        if (ROT.RNG.getUniform() < 0.9) continue
        if ('act' in e) (e as Actor).act()
      }
      this.drawMap()
      setTimeout(() => this.whenRunning.then(loop), tickTimeMs)
    }
    loop()
  }

  lavaloop() {
    const tickTimeMs = 5000
    const loop = () => {
      // cellular automata lava "spread"
      // using spread operator to force Set iterator or this loop would be recursive
      for (let lava of [...this.map.getTagged(Terrain.Lava)]) {
        // TODO move to lava.act OR treat as component
        // TODO ultimately needs to return terrain, items and mobs - items and mobs get destroyed
        let { x, y } = lava.getXY()
        let north = this.map.at(x, y - 1)
        let south = this.map.at(x, y + 1)
        let west = this.map.at(x - 1, y)
        let east = this.map.at(x + 1, y)
        let neighbors = new Set([north, south, west, east].filter(e => e)) as Set<Entity>
        for (let n of neighbors) {
          if (n instanceof Terrain.Lava || n instanceof Terrain.Ocean) {
            neighbors.delete(n)
            continue
          }
          let p = 50
          if (n instanceof Terrain.Grass) p = 10
          if (n instanceof Terrain.Shrub) p = 7
          if (n instanceof Terrain.Jungle) p = 3
          if (n instanceof Terrain.Water) p = 1
          if (ROT.RNG.getPercentage() <= p) {
            let l = new Terrain.Lava(this, n.getXY())
            // overwrite the existing terrain
            this.map.set(l, true)
            this.map.removeFromIndex(n) // currently no necessary, but just in case
          }
        }
        // lava "burns out" when surrounded by lava or ocean
        if (neighbors.size === 0) {
          // TODO use lava.die()
          // and return from act (or don't use act, or use ecs)
          this.map.removeFromIndex(lava)
          let ch = ROT.RNG.getItem("¸ʾ˚˓".split(""))!
          lava.setVisual({ ch })
        }
      }
      this.drawMap()
      setTimeout(() => this.whenRunning.then(loop), tickTimeMs)
    }
    loop()
  }

  async mainLoop() {
    const tickTimeMs = 100
    const loop = async () => {
      let actor = this.scheduler.next();
      await actor.act();
      this.drawMap()
      setTimeout(() => this.whenRunning.then(loop), tickTimeMs)
    }
    await loop()
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
    if (this.paused && e.key.toLowerCase() !== "p") { return }

    this.textBuffer.clear()


    if (this.textBuffer.showing && e.key === "Enter") {
      this.textBuffer.clearDisplayBox()

    } else if (e.key.toLowerCase() === "p") {
      this.handlePause()

    } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      this.move(e.key)
    }
  }

  move(dir: string) {
    // TODO validate move
    if (dir === "ArrowUp") this._viewportOffset.y--
    if (dir === "ArrowDown") this._viewportOffset.y++
    if (dir === "ArrowLeft") this._viewportOffset.x--
    if (dir === "ArrowRight") this._viewportOffset.x++
    this.drawMap()
  }

  handlePause() {
    let originalSize = this.getSize()
    let originalOffset = this._viewportOffset

    if (this.paused) {
      this.paused(true)
      this.paused = null
      document.querySelector("#status")?.classList.add("hidden")

    } else {
      this.whenRunning = new Promise((resolve, reject) => {
        this.paused = resolve
      })
      document.querySelector("#status")!.innerHTML = "PAUSED"
      document.querySelector("#status")!.classList.remove("hidden")
      this._viewportSize = this.map.size
      this._viewportOffset = new XY(0, 0)
    }

    let size = this.getSize();
    this.game.display.setOptions({ width: size.x, height: size.y });
    this.drawMap()

    this._viewportSize = originalSize
    this._viewportOffset = originalOffset
  }



  draw(viewportXY: XY): void {
    let mapXY = viewportXY.plus(this._viewportOffset)
    let entity = this.map.at(mapXY);
    let visual = entity ? entity.getVisual() : { ch: "x", fg: "black" }
    let color = visual.fg
    let brightened = Color.toHex(Color.add(Color.fromString("#111"), Color.fromString(visual.fg)))
    this.game.display.draw(viewportXY.x, viewportXY.y, visual.ch, brightened);
  }

  drawMap(): void {
    // draws curent viewport
    const xy = new XY()
    for (let j = 0; j < this._viewportSize.y; j++) {
      for (let i = 0; i < this._viewportSize.x; i++) {
        xy.x = i
        xy.y = j
        this.draw(xy)
      }
    }
  }

  getSize() { return this._viewportSize; }

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
      if (y < 3 || y > this._viewportSize.y - 2) return;

      let xy = new XY(x, y)
      this._fovCells.push(xy);

      cb(x, y, r, visibility)
    }

    // draw new FOV
    fov.compute(player_x, player_y, fov_r, wrappedCb);
  }

  _getViewport() {
    return {
      x: this._viewportOffset.x,
      y: this._viewportOffset.y,
      w: this._viewportSize.x,
      h: this._viewportSize.y
    }
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

    const x = MAP_SIZE
    const y = MAP_SIZE
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
        let e = new entity_class(this, new XY(i, j))
        let needsIndex = entity_class === Terrain.Lava
        this.map.set(e, needsIndex)
      }
    }


    // TODO generate mobs/items
    // this._map[60][20] = new Entity(this, new XY(60, 20), { ch: "@", fg: "yellow" })
  }
}
