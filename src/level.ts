import Scheduler from "../lib/rotjs/scheduler/scheduler";
import Simplex from "../lib/rotjs/noise/simplex";
import Entity from "./entity";
import { TerrainConstructor, Terrain as TerrainClass } from "./entities/terrain";
import XY from "./xy";
import Game from "./game";
import TextBuffer from "./textbuffer"
import * as ROT from "../lib/rotjs";
import * as Terrain from "./entities/terrain";
import WorldMap from "./map";
import { DEBUG, debug, debugLog } from "./debug";
import Dino, { dinoKind } from "./entities/dino";
import Dinos from "./dinos";
import { Rectangle } from "@timohausmann/quadtree-ts";
import { MAP_SIZE, MOVEMENT_DECREASE_IN_WATER, NUM_DINO_LEVELS, NUM_DINOS, VIEWPORT_SIZE } from "./constants";
import * as Animated from "./systems/animated";
import awarenessSystem from "./systems/awareness";
import { createWorld, addEntity, IWorld, addComponent, hasComponent, ComponentType } from "bitecs";
import { Awareness, Controlled, Deplacable, Deplaced, Herding, Movement, Pursue, Territorial } from "./components";
import movementSystem, { keypressCb as movementKeypressCb } from "./systems/movement";
import Path from "./systems/path";
import { brighten, darken, isValidPosition } from "./utils";
import deplacementSystem from "./systems/displacement";

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
  playerId!: number
  playerDino!: Dino
  game: Game
  terrainEcsWorld: ECSWorld
  dinoEcsWorld: ECSWorld
  paused: null | ((value: any) => void) = null // pause check and call to resume
  whenRunning: Promise<any> = Promise.resolve()
  private _fovCells: XY[] = []

  constructor(game: Game) {
    this.game = game;
    this.map = new WorldMap(MAP_SIZE, MAP_SIZE)
    this.dinos = new Dinos({ width: MAP_SIZE, height: MAP_SIZE })
    this.viewportSize = new XY(0, 0);

    this.scheduler = new ROT.Scheduler.Speed();

    this.terrainEcsWorld = createWorld({ level: this })

    this.dinoEcsWorld = createWorld({ level: this })
    this.playerId = addEntity(this.dinoEcsWorld)
    addComponent(this.dinoEcsWorld, Controlled, this.playerId)
    addComponent(this.dinoEcsWorld, Movement, this.playerId)
    Movement.turnsToSkip[this.playerId] = 0
    // starting position gets set later in _generateMobs
    this.playerDino = new Dino(this, new XY(), this.playerId, 2, "PREDATOR")
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
    const tickTimeMs = 200
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
    const tickTimeMs = 70
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
    const tickTimeMs = 100
    const loop = () => {
      if (this.viewportSize.x <= VIEWPORT_SIZE) {
        this.viewportSize.x += 4
        this.viewportSize.y += 4
        this.viewportOffset.x -= 2
        this.viewportOffset.y -= 2
        this.game.display.setOptions({ width: this.getSize().x, height: this.getSize().y });
      }
      awarenessSystem(this.dinoEcsWorld)
      movementSystem(this.dinoEcsWorld)
      deplacementSystem(this.terrainEcsWorld)
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

    } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
      movementKeypressCb.call(this, e.key)
    }
  }

  onKeyUp(e: KeyboardEvent) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
      movementKeypressCb.call(this, e.key, true)
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
    let { ch, fg } = entity.getVisual()
    let bg = fg
    if (entity instanceof Dino && entity.dead) bg = this.map.at(entity.getXY())!.getVisual().fg
    if (hasComponent(this.terrainEcsWorld, Deplaced, (entity as TerrainClass).id)) {
      // let amt = 1 - Deplaced.deplaced[(entity as TerrainClass).id] / 100
      fg = (entity instanceof Terrain.Water) ? brighten(fg, 0.3) : darken(fg, 0.7)
    }
    this.game.display.draw(x, y, ch, fg, darken(bg));
  }

  /**
   * Draws the current viewport
   */
  drawMap(): void {
    for (let e of (this.map.get(this.getViewport()) as Entity[])) {
      e = this.dinos.at(e.getXY()) || e
      this.draw(e)
    }
    for (let d of this.dinos.withIn(this.getViewport())) {
      d.dead ? this.drawSkeleton(d) : this.drawDino(d)
    }
    if (DEBUG > 1) {
      for (let d of this.dinos.withIn(this.getViewport())) {
        if (hasComponent(this.dinoEcsWorld, Pursue, d.id)) {
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

  drawSkeleton(d: Dino) {
    let dir = d.id % 4
    let tailCh = "/"
    let tailXY = new XY(...ROT.DIRS[4][dir])
    let tail = d.getXY().minus(tailXY)
    if (!(this.getEntity(tail.x, tail.y) instanceof Dino)) {
      let bg = darken(this.map.at(tail)?.getVisual().fg!)
      tail = tail.minus(this.viewportOffset)
      this.game.display.draw(tail.x, tail.y, tailCh, d.getVisual().fg, bg);
    }

    let headCh = "o"
    let headXY = new XY(...ROT.DIRS[4][(dir + 2) % 4])
    let head = d.getXY().minus(headXY)
    if (!(this.getEntity(head.x, head.y) instanceof Dino)) {
      let bg = darken(this.map.at(head)?.getVisual().fg!)
      head = head.minus(this.viewportOffset)
      this.game.display.draw(head.x, head.y, headCh, d.getVisual().fg, bg);
    }
  }


  drawDino(d: Dino) {
    let dir = Movement.direction[d.id]

    let headCh = ["⏶", "⏵", "⏷", "⏴"][dir]
    let headXY = new XY(...ROT.DIRS[4][(dir + 2) % 4])
    let head = d.getXY().minus(headXY)
    let bg = darken(this.map.at(head)?.getVisual().fg!)
    if (!(this.getEntity(head.x, head.y) instanceof Dino)) {
      head = head.minus(this.viewportOffset)
      this.game.display.draw(head.x, head.y, headCh, d.getVisual().fg, bg);
    }

    // Only head and body show in water
    if (this.map.at(d.getXY().x, d.getXY().y) instanceof Terrain.Water) return


    if (!hasComponent(this.dinoEcsWorld, Movement, d.id)) return
    let tailCh = ["⇂", "↼", "↾", "⇁"][dir]
    let tailChAlt = ["↲", "↜", "↱", "↝"][dir]
    let tailXY = new XY(...ROT.DIRS[4][dir])
    let tail = d.getXY().minus(tailXY)
    if (!(this.getEntity(tail.x, tail.y) instanceof Dino)) {
      bg = darken(this.map.at(tail)?.getVisual().fg!)
      tail = tail.minus(this.viewportOffset)
      let ch = ROT.RNG.getPercentage() < 20 ? tailChAlt : tailCh
      this.game.display.draw(tail.x, tail.y, ch, d.getVisual().fg, bg);
    }


    // let legCh = dir % 2 ? "܅" : ":"
    let frame = (d.getXY().x + d.getXY().y) % 2
    let legChs = ["'", "-"]
    let legCh = dir % 2 ? legChs[frame] : legChs[1 - frame]
    let rLegXY = new XY(...ROT.DIRS[4][(dir + 1) % 4])
    let rLeg = d.getXY().minus(rLegXY)
    if (!(this.getEntity(rLeg.x, rLeg.y) instanceof Dino)) {
      bg = darken(this.map.at(rLeg)?.getVisual().fg!)
      rLeg = rLeg.minus(this.viewportOffset)
      this.game.display.draw(rLeg.x, rLeg.y, legCh, d.getVisual().fg, bg);
    }


    let lLegXY = new XY(...ROT.DIRS[4][(dir + 3) % 4])
    let lLeg = d.getXY().minus(lLegXY)
    if (!(this.getEntity(lLeg.x, lLeg.y) instanceof Dino)) {
      bg = darken(this.map.at(lLeg)?.getVisual().fg!)
      lLeg = lLeg.minus(this.viewportOffset)
      this.game.display.draw(lLeg.x, lLeg.y, legCh, d.getVisual().fg, bg);
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
        let id = addEntity(this.terrainEcsWorld)
        e.id = id
        if (terrain_class === Terrain.Grass) {
          addComponent(this.terrainEcsWorld, Deplacable, id)
          Deplacable.healRate[id] = 15
        }
        if (terrain_class === Terrain.Shrub) {
          addComponent(this.terrainEcsWorld, Deplacable, id)
          Deplacable.healRate[id] = 10
        }
        if (terrain_class === Terrain.Water) {
          addComponent(this.terrainEcsWorld, Deplacable, id)
          Deplacable.healRate[id] = 10
        }
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
      let lavaSource = this.map.getTagged(Terrain.Dirt)
      if (!lavaSource.size) {
        console.debug("No Dirt found for lava, using Grass instead")
        lavaSource = this.map.getTagged(Terrain.Grass)
      }
      let lavaSeed = ROT.RNG.getItem([...lavaSource])?.getXY()
      if (lavaSeed) this.map.set(new Terrain.Lava(this, lavaSeed), true)
    }


  }

  _generateMobs() {
    let terrainsWithMobs = [
      Terrain.Grass,
      Terrain.Water,
      Terrain.Shrub,
      Terrain.Jungle
    ]

    let validCoords: XY[] = terrainsWithMobs.flatMap(
      (terrainClass: TerrainConstructor) => [...this.map.getTagged(terrainClass)].map((e: Entity) => e.getXY()))

    const BASE_OBSERVE_FREQUENCY = 3
    const BASE_OBSERVE_RANGE = 10
    const DEFAULT_MOVEMENT_FREQUENCY = 1
    const selectedCoords = ROT.RNG.shuffle(validCoords)
    const kinds: dinoKind[] = ROT.RNG.shuffle(["HERBIVORE", "HERBIVORE", "PREDATOR", "PREDATOR", "PREDATOR"])

    const countsPerLevel = (new Array(NUM_DINO_LEVELS)).fill(0)
      .map((_, i) => 0.5 + i / (NUM_DINO_LEVELS - 1))
      .map(n => Math.floor(n * NUM_DINOS / NUM_DINO_LEVELS))

    const makeNPCDino = (dominance: number, kind: dinoKind, tags: ComponentType<any>[]) => {
      let id = addEntity(this.dinoEcsWorld)
      addComponent(this.dinoEcsWorld, Awareness, id)
      Awareness.range[id] = BASE_OBSERVE_RANGE
      Awareness.turnsToSkip[id] = BASE_OBSERVE_FREQUENCY
      Awareness.accuracy[id] = 70

      addComponent(this.dinoEcsWorld, Movement, id)
      // TODO maybe set speed by level?
      Movement.turnsToSkip[id] = DEFAULT_MOVEMENT_FREQUENCY || DEFAULT_MOVEMENT_FREQUENCY

      for (let tag of tags) { addComponent(this.dinoEcsWorld, tag, id) }

      // TODO keep adding components

      const position = selectedCoords.pop()!
      // starting in water starts slow
      if (this.map.at(position) instanceof Terrain.Water) Movement.turnsToSkip[id] += MOVEMENT_DECREASE_IN_WATER
      let d = new Dino(this, position, id, dominance, kind)
      this.dinos.add(d)
    }
    const generateNPCDinosPerLevel = (level: number, populationRemaining: number) => {
      let numInLevel = countsPerLevel.shift()!
      let kind: dinoKind = "PREDATOR"
      if (level === NUM_DINO_LEVELS) {
        // alpha predator
        numInLevel = Math.floor(numInLevel / 2)
        kind = "PREDATOR"

      } else if (level === 1) {
        // bottom of the food chain (non-predator)
        numInLevel = populationRemaining
        kind = "HERBIVORE"

      } else {
        // in between dinos
        kind = kinds.shift()!
        kinds.push(kind)

      }

      const tags: ComponentType<any>[] = []
      // const chance = ROT.RNG.getPercentage()
      // if (chance < 20) { tags.push(Territorial) }
      // if (chance > 88) { tags.push(Herding) }
      if (level <= 3) tags.push(Herding)
      if (level === 5) tags.push(Territorial)

      for (let i = 0; i < numInLevel; i++) { makeNPCDino(level, kind, tags) }
      debugLog(`Generated ${numInLevel} dinosaurs at level ${level} of kind ${kind}`)

      if (level > 1) generateNPCDinosPerLevel(level - 1, populationRemaining - numInLevel)
    }

    generateNPCDinosPerLevel(NUM_DINO_LEVELS, NUM_DINOS)

    // make sure it is not on an island (check if it can reach the lava)
    const targetXY = [...this.map.getTagged(Terrain.Lava)][0].getXY()
    let passable = (x: number, y: number) => !(this.map.at(x, y) instanceof Terrain.Ocean)
    let pathLen = 0
    while (pathLen === 0 && selectedCoords.length > 0) {
      let playerStartOption = selectedCoords.pop()!

      let astar = new ROT.Path.AStar(targetXY.x, targetXY.y, passable, { topology: 4 });
      astar.compute(playerStartOption.x, playerStartOption.y, () => pathLen += 1);
      if (!pathLen) console.log("No path to lava")
      if (!pathLen) continue
      this.playerDino.moveTo(playerStartOption)
      this.viewportOffset = this.playerDino.getXY().minus(this.viewportSize.div(2))
    }
  }
}
