import Scheduler from "../lib/rotjs/scheduler/scheduler";
import Simplex from "../lib/rotjs/noise/simplex";
import Entity from "./entity";
import { TerrainConstructor, Terrain as TerrainClass } from "./entities/terrain";
import XY from "./xy";
import Game from "./game";
import Player from "./entities/player";
import TextBuffer from "./textbuffer"
import { Color } from "../lib/rotjs";
import * as ROT from "../lib/rotjs";
import * as Terrain from "./entities/terrain";
import WorldMap from "./map";
import { DEBUG, debug } from "./debug";
import Dino from "./entities/dino";
import Dinos from "./dinos";
import { Rectangle } from "@timohausmann/quadtree-ts";
import { MAP_SIZE } from "./constants";
import * as Animated from "./systems/animated";


export default class MainLevel {
  private _viewportSize: XY;
  private _viewportOffset: XY;
  private _fovCells: XY[] = []
  map: WorldMap
  dinos: Dinos
  scheduler: Scheduler;
  textBuffer: TextBuffer;
  game: Game
  player: Player
  paused: null | ((value: any) => void) = null // pause check and call to resume
  whenRunning: Promise<any> = Promise.resolve()

  constructor(game: Game) {
    this.game = game;
    this.map = new WorldMap(MAP_SIZE, MAP_SIZE)
    this.dinos = new Dinos({ width: MAP_SIZE, height: MAP_SIZE })
    this._viewportSize = new XY(65, 50);
    this._viewportOffset = new XY(200, 200);
    this.scheduler = new ROT.Scheduler.Speed();

    this.player = new Player(this, new XY(0, 0))

    this._generateMap();
    this._generateMobs();
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
    this.mainLoop()
  }

  waterLoop() {
    const tickTimeMs = 300
    const visible = new Rectangle({
      x: this._viewportOffset.x,
      y: this._viewportOffset.y,
      width: this._viewportSize.x,
      height: this._viewportSize.y
    })
    const loop = () => {
      visible.x = this._viewportOffset.x
      visible.y = this._viewportOffset.y
      visible.width = this._viewportSize.x
      visible.height = this._viewportSize.y
      Animated.run(visible)
      setTimeout(() => this.whenRunning.then(loop), tickTimeMs)
    }
    loop()
  }

  lavaloop() {
    const tickTimeMs = 100
    const loop = () => {
      // cellular automata lava "spread"
      // using spread operator to force Set iterator or this loop would be recursive
      for (let lava of [...this.map.getTagged(Terrain.Lava)]) {
        // high tick and high chance to skip makes lava spread look "smoother"
        if (ROT.RNG.getPercentage() < 90) continue
        // TODO move to lava.act OR treat as component
        // TODO ultimately needs to return terrain, items and mobs - items and mobs get destroyed
        let { x, y } = lava.getXY()
        let north = this.map.at(x, y - 1)
        let south = this.map.at(x, y + 1)
        let west = this.map.at(x - 1, y)
        let east = this.map.at(x + 1, y)
        let neighbors = new Set([north, south, west, east].filter(e => e)) as Set<TerrainClass>
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
            // TODO should probably call remove or die on n (animation system will keep animating it)
            // or bulk remove from quadtree

            // need to kil off dinos too
            let dino = this.dinos.at(l.getXY())
            if (dino) {
              this.dinos.remove(dino)
            }
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
      setTimeout(() => this.whenRunning.then(loop), tickTimeMs)
    }
    loop()
  }

  async mainLoop() {
    const tickTimeMs = 300
    const loop = () => {
      for (let e of this.dinos.withIn(this._getViewport())) {
        e.act()
      }
      this.drawMap()
      setTimeout(() => this.whenRunning.then(loop), tickTimeMs)
    }
    loop()
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
      this.whenRunning = new Promise((resolve, reject) => this.paused = resolve)
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



  /**
   * Draws a single map coordinate
   */
  draw(xyOrEntity: XY | Entity): void {
    let entity = xyOrEntity instanceof Entity ? xyOrEntity : this.map.at(xyOrEntity);
    if (!entity) throw new Error("No entity to draw for " + xyOrEntity.toString())
    let { x, y } = entity.getXY().minus(this._viewportOffset)
    let visual = entity.getVisual()
    let color = visual.fg
    let brightened = Color.toHex(Color.add(Color.fromString("#222"), Color.fromString(color)))
    this.game.display.draw(x, y, visual.ch, brightened);
  }

  /**
   * Draws the current viewport
   */
  drawMap(): void {
    for (let e of (this.map.get(this._getViewport()) as Entity[])) {
      e = this.dinos.at(e.getXY()) || e
      this.draw(e)
    }
    if (DEBUG > 1) {
      for (let d of this.dinos.withIn(this._getViewport())) {
        if (d.pursuit) {
          for (let xy of d.pursuit.slice(0, -1)) {
            this.game.display.drawOver(xy.x - this._viewportOffset.x, xy.y - this._viewportOffset.y, ".", "red")
          }
        }
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
    let colorMapping = [
      "red", // lava
      "#754", // dirt
      "#2a2", // grass
      "#33f", // water
      "#2a2", // grass
      "#172", // trees
      "#050", // jungle
    ]
    let terrainMapping = [
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
    const center2 = center.plus(new XY(
      ROT.RNG.getUniformInt(0.5, 1) * ROT.RNG.getItem([1, -1])! * x / 5,
      ROT.RNG.getUniformInt(0.5, 1) * ROT.RNG.getItem([1, -1])! * y / 5)
    )


    for (var j = 0; j < y; j++) {
      for (var i = 0; i < x; i++) {
        let dist = center.dist(new XY(i, j))
        let dist2 = center2.dist(new XY(i, j))
        let height = 1 - (dist / (x / 2)) // 1-0 where 1 is max
        let height2 = 1 - (dist2 / (x / 5))
        let n = get_noise(i, j, scale, 5) // -1.5 - 1.5 about

        n = n + 1.5 // higher number = rounder single island

        height *= 0.5 // smaller peaks, less lava
        height2 *= 0.3
        let h = Math.max(0, height) + Math.max(0, height2)
        // alpha
        let a = Math.min(h * 255, 255) * n

        // set viewport to map size to draw whole map
        // draw alpha
        // a = Math.round(a / 30) * 30 // posterize
        // let color = Color.toRGB([a, a, a])
        // this.game.display.draw(i, j, "x", color)

        // draw terrain colors
        // map alpha to terrain space more or less (note terrain is opposite order of alpha)
        a = 9 - Math.round(a / 30) // base determins overall size
        // let color = colorMapping[a] || "blue"
        // if (a < 0) color = "red"
        // this.game.display.draw(i, j, "x", color)

        let terrain_class: TerrainConstructor = terrainMapping[a] || Terrain.Ocean
        if (a < 0) terrain_class = terrain_class = Terrain.Lava

        let e = new terrain_class(this, new XY(i, j))
        // index everything for now
        let needsIndex = terrainMapping.includes(terrain_class)
        this.map.set(e, needsIndex)

        // add "systems"
        // TODO use better component registering
        if ("flow" in e) {
          Animated.add(e)
        }
      }
    }

    // sometimes the generator doesn't make any lava, so make sure
    if (this.map.getTagged(Terrain.Lava).size === 0) {
      let lavaSeed = ROT.RNG.getItem([...this.map.getTagged(Terrain.Dirt)])?.getXY()
      if (lavaSeed) this.map.set(new Terrain.Lava(this, lavaSeed), true)
    }


  }

  _generateMobs() {
    let terrainsWithMobs = [
      Terrain.Dirt,
      Terrain.Grass,
      Terrain.Water,
      Terrain.Shrub,
      Terrain.Jungle
    ]

    let population = 60
    let validCoords: XY[] = terrainsWithMobs.flatMap(
      (terrainClass: TerrainConstructor) => [...this.map.getTagged(terrainClass)].map((e: Entity) => e.getXY()))

    ROT.RNG.shuffle(validCoords).slice(0, population).forEach((xy, i) => {
      let level = i % 3 + 1
      let d = new Dino(this, xy)
      d.level = level
      this.dinos.add(d)
    })
  }
}
