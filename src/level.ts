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
import { BASE_OBSERVE_FREQUENCY, BASE_OBSERVE_RANGE, MAP_SIZE, MOVMENT_SPEED_BY_LEVEL, NUM_DINO_LEVELS, NUM_DINOS, SCORE_DURATION, VIEWPORT_SIZE } from "./constants";
import * as Animated from "./systems/animated";
import awarenessSystem from "./systems/awareness";
import { createWorld, addEntity, IWorld, addComponent, hasComponent, ComponentType, removeComponent, deleteWorld } from "bitecs";
import { Awareness, Controlled, Deplacable, Deplaced, Herding, Score, Movement, Pursue, Territorial } from "./components";
import movementSystem, { keypressCb as movementKeypressCb } from "./systems/movement";
import Path from "./systems/path";
import { brighten, darken, waterOrOcean } from "./utils";
import deplacementSystem from "./systems/displacement";
import scoreSystem from "./systems/score";
import winScreen from "./level-data/win-screen.txt?raw";

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
  score: number = 0
  terrainEcsWorld: ECSWorld
  dinoEcsWorld: ECSWorld
  playerWin: number = 0
  showingWinScreen = false
  paused: null | ((value: any) => void) = null // pause check and call to resume
  whenRunning: Promise<any> = Promise.resolve()
  private _fovCells: XY[] = []

  constructor(game: Game) {
    this.game = game;
    this.map = new WorldMap(MAP_SIZE, MAP_SIZE)
    this.dinos = new Dinos({ width: MAP_SIZE, height: MAP_SIZE })

    this.scheduler = new ROT.Scheduler.Speed();

    this.terrainEcsWorld = createWorld({ level: this })

    this.dinoEcsWorld = createWorld({ level: this })
    this.playerId = addEntity(this.dinoEcsWorld)
    addComponent(this.dinoEcsWorld, Controlled, this.playerId)
    addComponent(this.dinoEcsWorld, Movement, this.playerId)
    let startingDominance = 1
    Movement.turnsToSkip[this.playerId] = MOVMENT_SPEED_BY_LEVEL[startingDominance]
    // starting position gets set later in _generateMobs
    this.playerDino = new Dino(this, new XY(), this.playerId, startingDominance, "PREDATOR")
    this.dinos.add(this.playerDino)

    this._generateMap();
    this._generateMobs(); // positions player dino


    this.setScore(0)
    this.textBuffer = new TextBuffer(this.game);

    // TODO resize w/ map if needed
    // let size = this.getSize();
    // let bufferSize = 3;
    // this.textBuffer.configure({
    //   position: new XY(0, 0),
    //   size: new XY(size.x, bufferSize)
    // });
    // this.textBuffer.clear();

    if (DEBUG) { debug(this) }

    const startingViewportSize = 6
    this.viewportSize = new XY(startingViewportSize, startingViewportSize); // zoomed in
    this.viewportOffset = this.playerDino.getXY().minus(this.viewportSize.div(2))
    let targetSize = new XY(VIEWPORT_SIZE, VIEWPORT_SIZE)
    let targetOffset = this.playerDino.getXY().minus(targetSize.div(2))
    this.zoomOut(targetSize, targetOffset, (VIEWPORT_SIZE - startingViewportSize) / 2 / 2) // iterations needs to be a multiple of offset so that dOffset won't be a fraction (it gets rounded)

    this.game.sounds.hero.play()

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
    const tickTimeMs = 50
    const loop = () => {
      // cellular automata lava "spread"
      // using spread operator to force Set iterator or this loop would be recursive
      for (let lava of [...this.map.getTagged(Terrain.Lava)]) {
        // high tick and high chance to skip makes lava spread look "smoother"
        if (ROT.RNG.getPercentage() < (this.playerWin ? 0 : 90)) continue
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

            let dino = this.dinos.at(l.getXY())
            if (dino) {
              dino.kill(this.dinoEcsWorld)
              if (dino === this.playerDino) {
                this.game.sounds.hero.play()
                this.setGameOver()
              }
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
    const tickTimeMs = 70
    const loop = () => {
      awarenessSystem(this.dinoEcsWorld)
      movementSystem(this.dinoEcsWorld)
      deplacementSystem(this.terrainEcsWorld)
      scoreSystem(this.dinoEcsWorld)
      this.dynamicZoom()
      this.dinoSfx()

      this.drawMap()
      setTimeout(() => this.whenRunning.then(loop), tickTimeMs)
    }
    loop()
  }

  dynamicZoom() {
    let range = 14
    let nearDinos = this.dinos.withIn({
      x: this.playerDino.getXY().x - range / 2,
      y: this.playerDino.getXY().y - range / 2,
      w: range,
      h: range
    }).filter(d => !d.dead)
    let numDinosNearPlayer = nearDinos.length
    if (numDinosNearPlayer > 2 && ROT.RNG.getPercentage() < 10) {
      ROT.RNG.getPercentage() % 2 === 0
        ? this.game.sounds.growl1.play()
        : this.game.sounds.growl2.play()
    }


    let zoomAmount = 6
    if (numDinosNearPlayer > 2 && this.getSize().x === VIEWPORT_SIZE) {
      let targetSize = new XY(VIEWPORT_SIZE - zoomAmount, VIEWPORT_SIZE - zoomAmount)
      let targetOffset = this.playerDino.getXY().minus(targetSize.div(2))
      let i = (zoomAmount / 2 / 2)
      this.zoomIn(targetSize, targetOffset, i)
      this.game.sounds.drums.fade(0.2, 0.5, 1)

    } else if (numDinosNearPlayer < 2 && this.getSize().x === VIEWPORT_SIZE - zoomAmount) {
      let targetSize = new XY(VIEWPORT_SIZE, VIEWPORT_SIZE)
      let targetOffset = this.playerDino.getXY().minus(targetSize.div(2))
      let i = (zoomAmount / 2 / 2)
      this.zoomOut(targetSize, targetOffset, i)
      this.game.sounds.drums.fade(0.5, 0.2, 1)
    }
  }

  dinoSfx() {
    let nearDinos = this.dinos.nearest(this.playerDino.getXY()).filter(d => d !== this.playerDino && !d.dead)
    if (nearDinos.length === 0) return
    this.game.sounds.steps.volume(0, this.game.soundIds.other1Steps)
    this.game.sounds.steps.volume(0, this.game.soundIds.other2Steps)
    let range = 15
    let d1 = Math.max(0, 1 - nearDinos[0].getXY().dist(this.playerDino.getXY()) / range)
    this.game.sounds.steps.volume(d1 * 0.4, this.game.soundIds.other1Steps)

    if (nearDinos.length < 2 || nearDinos[1].dead) return
    let d2 = Math.max(0, 1 - nearDinos[1].getXY().dist(this.playerDino.getXY()) / range)
    this.game.sounds.steps.volume(d2 * 0.3, this.game.soundIds.other2Steps)
  }

  // for mobile
  public onClick(e: MouseEvent) {
    if (this.playerDino.dead) {
      window.location.reload()
      return
    }
    this.textBuffer.clear()

    if (this.textBuffer.showing) {
      this.textBuffer.clearDisplayBox()
      return
    }


    let [x, y] = this.game.display.eventToPosition(e);
    // do something with coord
  }


  onKeyDown(e: KeyboardEvent) {
    if (["x"].includes(e.key)) {
      this.playerDino.dominance = 6
      this.playerWin = 1
      // this.doWinState()
    }


    if (this.showingWinScreen || this.playerDino.dead) {
      if (e.key === " ") window.location.reload()
      return
    }

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
    if (this.paused) {
      this.paused(true)
      this.paused = null
      document.querySelector("#paused")?.classList.add("hidden")
      this.game.updateSize(this.getSize())
      this.drawMap()

    } else {
      this.game.sounds.steps.volume(0)
      let originalSize = this.getSize().div(1) // "clone"
      let originalOffset = this.viewportOffset.div(1) // "clone"
      this.whenRunning = new Promise((resolve, reject) => this.paused = resolve)
      this.whenRunning.then(() => {
        this.zoomIn(originalSize, originalOffset, 3)
      })
      document.querySelector("#paused")!.classList.remove("hidden")
      if (!surpressZoom) this.zoomOut(this.map.size, new XY(0, 0))
    }
  }

  setScore(score: number) {
    this.score += score
    document.querySelector("#score")!.innerHTML = "LEVEL: " + this.playerDino.dominance + " -- SCORE: " + this.score
  }

  setGameOver() {
    document.querySelector("#game-over")!.classList.remove("hidden")
  }

  zoomOut(targetSize: XY, targetOffset: XY, iterations = 6) {
    let dSize = targetSize.y - this.viewportSize.y // assumes square
    let dOffset = this.viewportOffset.minus(targetOffset)
    let dOX = dOffset.x / iterations
    let dOY = dOffset.y / iterations
    let dS = dSize / iterations
    let f = () => {
      this.viewportSize.x = Math.round(Math.min(targetSize.x, this.viewportSize.x + (dS)))
      this.viewportSize.y = Math.round(Math.min(targetSize.y, this.viewportSize.y + (dS)))
      this.viewportOffset.x = Math.round(Math.max((targetOffset.x), this.viewportOffset.x - (dOX)))
      this.viewportOffset.y = Math.round(Math.max((targetOffset.y), this.viewportOffset.y - (dOY)))
      this.game.updateSize(this.getSize())
      this.drawMap()
      if (this.viewportSize.y < targetSize.y) setTimeout(f, 70)
    }
    f()
  }

  zoomIn(targetSize: XY, targetOffset: XY, iterations = 8) {
    let dSize = this.viewportSize.y - targetSize.y // assumes square
    let dOffset = targetOffset.minus(this.viewportOffset)
    let dO = dOffset.div(iterations)
    let dS = dSize / iterations
    let f = () => {
      this.viewportSize.x = Math.round(Math.max(targetSize.x, this.viewportSize.x - dS))
      this.viewportSize.y = Math.round(Math.max(targetSize.y, this.viewportSize.y - dS))
      this.viewportOffset.x = Math.round(Math.min(targetOffset.x, this.viewportOffset.x + dO.x))
      this.viewportOffset.y = Math.round(Math.min(targetOffset.y, this.viewportOffset.y + dO.y))
      this.game.updateSize(this.getSize())
      this.drawMap()
      if (this.viewportSize.y > targetSize.y) setTimeout(f, 70)
    }
    f()
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
      fg = (entity instanceof Terrain.Water || entity instanceof Terrain.Ocean) ? brighten(fg, 0.3) : darken(fg, 0.7)
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
      if (hasComponent(this.dinoEcsWorld, Score, d.id)) this.drawScore(d)
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

  drawScore(d: Dino) {
    let score = Score.amount[d.id]
    let s = d.getXY().minus(this.viewportOffset)
    let text = "+" + Score.amount[d.id]
    let x = s.x - Math.floor(text.length / 2)
    let y = s.y - 3
    let color = darken("orange", Score.duration[d.id] / SCORE_DURATION)
    for (let i = 0; i < text.length; i++) {
      this.game.display.drawOver(x + i, y, text[i], color)
    }
  }

  drawSkeleton(d: Dino) {
    let dir = d.id % 4
    let tailCh = ["/", "-", "\\", "-"][dir]
    let tailXY = new XY(...ROT.DIRS[4][dir])
    let tail = d.getXY().minus(tailXY)
    if (!(this.getEntity(tail.x, tail.y) instanceof Dino)) {
      let bg = darken(this.map.at(tail)?.getVisual().fg!)
      tail = tail.minus(this.viewportOffset)
      this.game.display.draw(tail.x, tail.y, tailCh, d.getVisual().fg, bg);
    }

    let headCh = ["^", ">", "v", "<"][dir]
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
    let h = this.map.at(head)?.getVisual()?.fg
    if (h && !(this.getEntity(head.x, head.y) instanceof Dino)) {
      let bg = darken(h)
      head = head.minus(this.viewportOffset)
      this.game.display.draw(head.x, head.y, headCh, d.getVisual().fg, bg);
    }

    // Only head and body show in water
    let terrain = this.map.at(d.getXY().x, d.getXY().y)
    if (terrain && waterOrOcean(terrain)) return


    if (!hasComponent(this.dinoEcsWorld, Movement, d.id)) return
    let tailCh = ["⇂", "↼", "↾", "⇁"][dir]
    let tailChAlt = ["↲", "↜", "↱", "↝"][dir]
    let tailXY = new XY(...ROT.DIRS[4][dir])
    let tail = d.getXY().minus(tailXY)
    let t = this.map.at(tail)?.getVisual().fg!
    if (t && !(this.getEntity(tail.x, tail.y) instanceof Dino)) {
      let bg = darken(t)
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
    let rl = this.map.at(rLeg)?.getVisual().fg!
    if (rl && !(this.getEntity(rLeg.x, rLeg.y) instanceof Dino)) {
      let bg = darken(rl)
      rLeg = rLeg.minus(this.viewportOffset)
      this.game.display.draw(rLeg.x, rLeg.y, legCh, d.getVisual().fg, bg);
    }


    let lLegXY = new XY(...ROT.DIRS[4][(dir + 3) % 4])
    let lLeg = d.getXY().minus(lLegXY)
    let ll = this.map.at(lLeg)?.getVisual().fg!
    if (ll && !(this.getEntity(lLeg.x, lLeg.y) instanceof Dino)) {
      let bg = darken(ll)
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
        if (terrain_class === Terrain.Ocean) {
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
      if (!lavaSource.size) {
        console.debug("No Grass found either, using shrub instead")
        lavaSource = this.map.getTagged(Terrain.Shrub)
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

    const selectedCoords = ROT.RNG.shuffle(validCoords)
    const kinds: dinoKind[] = ROT.RNG.shuffle(["HERBIVORE", "HERBIVORE", "PREDATOR", "PREDATOR", "PREDATOR"])

    const countsPerLevel = (new Array(NUM_DINO_LEVELS)).fill(0)
      .map((_, i) => 0.5 + i / (NUM_DINO_LEVELS - 1))
      .map(n => Math.floor(n * NUM_DINOS / NUM_DINO_LEVELS))

    let zero = new XY(0, 0)
    const makeNPCDino = (dominance: number, kind: dinoKind, tags: ComponentType<any>[]) => {
      let id = addEntity(this.dinoEcsWorld)
      addComponent(this.dinoEcsWorld, Awareness, id)
      Awareness.range[id] = BASE_OBSERVE_RANGE
      Awareness.turnsToSkip[id] = BASE_OBSERVE_FREQUENCY
      Awareness.accuracy[id] = 90

      addComponent(this.dinoEcsWorld, Movement, id)
      Movement.turnsToSkip[id] = MOVMENT_SPEED_BY_LEVEL[dominance] || 1

      for (let tag of tags) { addComponent(this.dinoEcsWorld, tag, id) }

      // TODO keep adding components

      // starting at 0,0 then doing moveTo applies any terrain based effects
      let d = new Dino(this, zero, id, dominance, kind)
      const position = selectedCoords.pop()!
      d.moveTo(position)
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
    }
  }

  doWinState() {
    this.showingWinScreen = true
    this.whenRunning = Promise.reject()
    this.dinos.clear()
    this.map.clear()
    this.viewportSize = new XY(75, 45)
    this.viewportOffset = new XY(0, 0)
    this.game.updateSize(this.getSize())
    deleteWorld(this.dinoEcsWorld)
    deleteWorld(this.terrainEcsWorld)
    this.dinoEcsWorld = createWorld({ level: this })
    this.terrainEcsWorld = createWorld({ level: this })

    this.playerDino.id = addEntity(this.dinoEcsWorld)
    addComponent(this.dinoEcsWorld, Movement, this.playerDino.id)
    Movement.direction[this.playerDino.id] = 2
    this.playerId = this.playerDino.id

    this.makeWinMap()
    // make wake
    // this.playerDino.moveTo(new XY(35, 1))
    this.playerDino.moveTo(new XY(35, 0))
    this.waterLoop()

    document.querySelector("#win")?.classList.remove("hidden")

    const tickTimeMs = 70
    let frame = 0
    const loop = () => {
      frame++
      deplacementSystem(this.terrainEcsWorld)
      this.drawWinMap()

      let y = this.playerDino.getXY().y
      if (y < this.viewportSize.y - 1) {
        if (frame % 3 == 0) {
          // make wake
          // this.playerDino.moveTo(new XY(36 - 2, y - 4))
          // this.playerDino.moveTo(new XY(36 + 2, y - 4))
          // this.playerDino.moveTo(new XY(36, y - 4))
          let pauseMaybe = ROT.RNG.getPercentage() < (y > 36 ? 60 : 10)
          if (!pauseMaybe) this.playerDino.moveTo(new XY(36, y + 1))
        }
        let { ch, fg } = this.playerDino.getVisual()
        this.drawDino(this.playerDino)
        this.game.display.draw(this.playerDino.getXY().x, this.playerDino.getXY().y, ch, fg, darken(fg));
      }
      setTimeout(loop, tickTimeMs)
    }
    loop()
  }

  makeWinMap() {
    let titleMap = winScreen.split("\n")
    for (let row = 0; row < this.viewportSize.y; row++) {
      for (let col = 0; col < this.viewportSize.x; col++) {
        let pos = new XY(col, row)
        let ch = titleMap[row] && titleMap[row][col] ? titleMap[row][col] : "x"
        let t
        switch (ch) {
          case "1":
            t = new Terrain.Jungle(this, pos)
            this.map.set(t)
            t.id = addEntity(this.terrainEcsWorld)
            break;
          case "2":
            t = new Terrain.Shrub(this, pos)
            this.map.set(t)
            t.id = addEntity(this.terrainEcsWorld)
            break;
          case "3":
            t = new Terrain.Grass(this, pos)
            this.map.set(t)
            t.id = addEntity(this.terrainEcsWorld)
            break;

          default:
            let ocean = new Terrain.Ocean(this, pos)
            ocean.id = addEntity(this.terrainEcsWorld)
            Animated.add(ocean)
            addComponent(this.terrainEcsWorld, Deplacable, ocean.id)
            Deplacable.healRate[ocean.id] = 4
            this.map.set(ocean)
            break;
        }
      }
    }
  }

  drawWinMap() {
    let titleMap = winScreen.split("\n")
    for (let row = 0; row < this.viewportSize.y; row++) {
      for (let col = 0; col < this.viewportSize.x; col++) {
        let bg = this.map.at(col, row)!
        let ch = bg.getVisual().ch
        let color = bg.getVisual().fg
        if (col === 0 && row === 0) {
        }

        let titleX = row
        let titleY = col
        if (titleMap[titleX] && titleMap[titleX][titleY] && !["1", "2", "3", " "].includes(titleMap[titleX][titleY])) {
          ch = titleMap[titleX][titleY]
          color = "orange"// "#6a6"
        }
        if (hasComponent(this.terrainEcsWorld, Deplaced, bg.id)) {
          let amount = ROT.RNG.getWeightedValue({ 0.7: 0.01, 0.2: 0.8, 0.4: 0.3 })
          color = (bg instanceof Terrain.Ocean) ? brighten(color, amount) : darken(color, 0.7)
        }

        this.game.display.draw(col, row, ch, color);
      }
    }
  }
}
