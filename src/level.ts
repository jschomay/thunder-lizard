import Scheduler from "../lib/rotjs/scheduler/scheduler";
import Simplex from "../lib/rotjs/noise/simplex";
import Entity from "./entity";
import { TerrainConstructor, Terrain as TerrainClass } from "./entities/terrain";
import XY from "./xy";
import Game from "./game";
import TextBuffer from "./textbuffer"
import { Color } from "../lib/rotjs";
import * as ROT from "../lib/rotjs";
import * as Terrain from "./entities/terrain";
import WorldMap from "./map";
import { DEBUG, debug } from "./debug";
import Dino from "./entities/dino";
import Dinos from "./dinos";
import { Rectangle } from "@timohausmann/quadtree-ts";
import { MAP_SIZE, NUM_DINO_LEVELS, NUM_DINOS, VIEWPORT_SIZE } from "./constants";
import * as Animated from "./systems/animated";
import awarenessSystem from "./systems/awareness";
import { createWorld, addEntity, IWorld, addComponent, hasComponent } from "bitecs";
import { Awareness, Controlled, Movement, Pursue } from "./components";
import movementSystem, { keypressCb as movementKeypressCb } from "./systems/movement";
import Path from "./systems/path";
import { isValidPosition } from "./utils";

export interface ECSWorld extends IWorld {
  level: MainLevel;
}


export default class MainLevel {
  viewportSize: XY;
  viewportOffset: XY;
  map: WorldMap
  dinos: Dinos
  scheduler: Scheduler;
  textBuffer: TextBuffer;
  playerId: number
  playerDino: Dino
  game: Game
  ecsWorld: ECSWorld
  paused: null | ((value: any) => void) = null // pause check and call to resume
  whenRunning: Promise<any> = Promise.resolve()
  private _fovCells: XY[] = []

  constructor(game: Game) {
    this.game = game;
    this.map = new WorldMap(MAP_SIZE, MAP_SIZE)
    this.dinos = new Dinos({ width: MAP_SIZE, height: MAP_SIZE })
    this.viewportSize = new XY(VIEWPORT_SIZE, VIEWPORT_SIZE);
    this.viewportOffset = new XY(MAP_SIZE / 3, MAP_SIZE / 3);
    this.scheduler = new ROT.Scheduler.Speed();

    this.ecsWorld = createWorld({ level: this })
    this.playerId = addEntity(this.ecsWorld)
    addComponent(this.ecsWorld, Controlled, this.playerId)
    addComponent(this.ecsWorld, Movement, this.playerId)
    Movement.frequency[this.playerId] = 0
    let xy = new XY(this.viewportOffset.x + this.viewportSize.x / 2, this.viewportOffset.y + this.viewportSize.y / 2)
    this.playerDino = new Dino(this, xy, this.playerId, 3, "PREDATOR")
    this.playerDino.setVisual({ ch: "𑿋", fg: "yellow" })
    this.dinos.add(this.playerDino)

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
      x: this.viewportOffset.x,
      y: this.viewportOffset.y,
      width: this.viewportSize.x,
      height: this.viewportSize.y
    })
    const loop = () => {
      visible.x = this.viewportOffset.x
      visible.y = this.viewportOffset.y
      visible.width = this.viewportSize.x
      visible.height = this.viewportSize.y
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
              // TODO game over if player
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
    const tickTimeMs = 200
    const loop = () => {
      awarenessSystem(this.ecsWorld)
      movementSystem(this.ecsWorld)
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

    } else if (DEBUG && e.key.toLowerCase() === "d") {
      this.handlePause(true)

    } else if (e.key.toLowerCase() === "p") {
      this.handlePause()

    } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      movementKeypressCb.call(this, e.key)
    }
  }

  handlePause(surpressZoom = false) {
    let originalSize = this.getSize()
    let originalOffset = this.viewportOffset

    if (this.paused) {
      this.paused(true)
      this.paused = null
      document.querySelector("#status")?.classList.add("hidden")

    } else {
      this.whenRunning = new Promise((resolve, reject) => this.paused = resolve)
      document.querySelector("#status")!.innerHTML = "PAUSED"
      document.querySelector("#status")!.classList.remove("hidden")
      if (!surpressZoom) {
        this.viewportSize = this.map.size
        this.viewportOffset = new XY(0, 0)
      }
    }

    let size = this.getSize();
    this.game.display.setOptions({ width: size.x, height: size.y });
    this.drawMap()

    this.viewportSize = originalSize
    this.viewportOffset = originalOffset
  }



  /**
   * Draws a single map coordinate
   */
  draw(xyOrEntity: XY | Entity): void {
    let entity = xyOrEntity instanceof Entity ? xyOrEntity : this.map.at(xyOrEntity);
    if (!entity) throw new Error("No entity to draw for " + xyOrEntity.toString())
    let { x, y } = entity.getXY().minus(this.viewportOffset)
    let visual = entity.getVisual()
    let color = visual.fg
    let brightened = Color.toHex(Color.add(Color.fromString("#222"), Color.fromString(color)))
    this.game.display.draw(x, y, visual.ch, brightened);
  }

  /**
   * Draws the current viewport
   */
  drawMap(): void {
    for (let e of (this.map.get(this.getViewport()) as Entity[])) {
      e = this.dinos.at(e.getXY()) || e
      this.draw(e)
    }
    if (DEBUG > 1) {
      for (let d of this.dinos.withIn(this.getViewport())) {
        if (hasComponent(this.ecsWorld, Pursue, d.id)) {
          let x, y
          let len = Path.length(d.id) * 2
          for (let i = 2; i < (len - 2); i += 2) {
            x = Pursue.path[d.id][i]
            y = Pursue.path[d.id][i + 1]
            this.game.display.drawOver(x - this.viewportOffset.x, y - this.viewportOffset.y, ".", "red")
          }
        }
      }
    }
  }

  getEntity(x: number, y: number) {
    return this.dinos.at(x, y) || this.map.at(x, y)
  }

  getSize() { return this.viewportSize; }

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
      if (y < 3 || y > this.viewportSize.y - 2) return;

      let xy = new XY(x, y)
      this._fovCells.push(xy);

      cb(x, y, r, visibility)
    }

    // draw new FOV
    fov.compute(player_x, player_y, fov_r, wrappedCb);
  }

  getViewport() {
    return {
      x: this.viewportOffset.x,
      y: this.viewportOffset.y,
      w: this.viewportSize.x,
      h: this.viewportSize.y
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

    let validCoords: XY[] = terrainsWithMobs.flatMap(
      (terrainClass: TerrainConstructor) => [...this.map.getTagged(terrainClass)].map((e: Entity) => e.getXY()))

    const dinoCharMap = ROT.RNG.shuffle(['ي', 'ݎ', 'ࠀ', 'చ', 'ᠥ', '𐀔', '𐎥'])
    const colors = ROT.RNG.shuffle(["red", "brown", "lightgreen", "purple", "gray", "orange"])

    ROT.RNG.shuffle(validCoords).slice(0, NUM_DINOS).forEach((xy, i) => {
      let dominance = i % NUM_DINO_LEVELS + 1

      let id = addEntity(this.ecsWorld)

      const BASE_OBSERVE_FREQUENCY = 3

      addComponent(this.ecsWorld, Awareness, id)
      Awareness.range[id] = 10
      Awareness.turnsToSkip[id] = BASE_OBSERVE_FREQUENCY

      addComponent(this.ecsWorld, Movement, id)
      Movement.frequency[id] = 0 //NUM_DINO_LEVELS - dominance

      // TODO keep adding components
      let d = new Dino(this, xy, id, dominance, "PREDATOR")
      this.dinos.add(d)
      d.setVisual({ ch: dinoCharMap[dominance - 1], fg: colors[dominance - 1] })
    })
  }
}
