import * as ROT from "../../lib/rotjs";
import Entity from "../entity";
import XY from "../xy";
import Level from "../level";
import { SpeedActor } from "../../lib/rotjs";
import { debugLog } from "../debug";
import { relativePosition } from "../utils";
import * as Terrain from "../entities/terrain";

const dinoCharMap = ROT.RNG.shuffle(['ي', 'ݎ', 'ࠀ', 'చ', 'ᠥ', '𐀔', '𐎥'])

let xy = new XY(0, 0)
export default class Dino extends Entity implements SpeedActor {
  id: number
  dominance: number = 0

  // TODO put these in Predator component (herbavore and herding too)
  predator = true
  prey: Dino | null = null
  pursuit: XY[] | null = null

  constructor(level: Level, xy: XY, id: number) {
    super(level, xy, { ch: "𑿋", fg: "lightgrey" });
    this.id = id
  }

  getVisual() {
    return { ...super.getVisual(), ch: dinoCharMap[this.dominance - 1] }
  }

  getSpeed() {
    return this.dominance;
  }

  act() {
    const nearDinos = this.getLevel().dinos.nearest(this.getXY())

    debugLog(this.dominance, "------------------")

    // TODO periodically observe
    // faking this by forcing n% of the time
    if (ROT.RNG.getPercentage() < 20) {
      this.pursuit = null
      this.prey = null
    }

    // actively chasing
    if (this.pursuit && this.prey) {
      // chase
      debugLog(this.dominance, "chasing", this.prey.dominance)

      if (this.pursuit.length === 0) {
        // shouldn't happen, but rarely it does, not quite sure how
        this.pursuit = null
        this.prey = null
        return
      }

      // "hone in" more accurately when closer
      if (this.pursuit.length < 5) {
        this.pursue(this.prey)
      }

      // move closer
      if (this.pursuit.length > 1) {
        let pathTarget = this.pursuit[0]
        // path has diagonals, but dino can only move orthogonally
        let target = this.getXY().plus(new XY(...ROT.DIRS[4][relativePosition(this.getXY(), pathTarget)]))
        if (target.is(pathTarget)) this.pursuit.shift()
        // if a dino or lava got in the way, don't do anything, next observation cycle will get a better path
        if (this.isValidPosition(target)) this.moveTo(target)
        return
      }

      // reached target
      if (this.pursuit.length === 1) {
        // prey might have moved or died since setting path, so check
        if (this.getLevel().dinos.at(this.pursuit[0]) === this.prey) {
          debugLog(this.dominance, "reached prey")
          this.getLevel().dinos.remove(this.prey)
          // TODO move this to the system
          // rest after eating, based on how "heavy" the meal was
          // this.cooldown = this.prey.dominance * 5
        }
        this.prey = null
        this.pursuit = null
        return
      }
    }

    // TODO check for lava

    // TODO handle herbavores (who care about terrain food sources)

    // check for predators
    for (let d of nearDinos) {
      if (d === this) continue
      let dist = this.getXY().dist(d.getXY())
      if (dist > 30) break

      if (d.dominance > this.dominance) {
        // run away
        debugLog(this.dominance, "running from", d.dominance)
        this.flee(d)
        return
      }
    }

    // check for prey
    let target;
    for (let d of nearDinos) {
      debugLog(this.dominance, "considering", d.dominance)
      // find first viable dino in observation range
      const dist = this.getXY().dist(d.getXY())
      if (dist > 30) break
      if (d.dominance >= this.dominance) continue
      if (!target) {
        target = d
        continue
      }

      // look for next best target, stop looking if not found
      let score = 0
      if (d.dominance > target.dominance) {
        score += d.dominance - target.dominance
      }
      score -= Math.floor(d.getXY().dist(target.getXY()) / 2)
      if (score > 0) {
        target = d
        debugLog(this.dominance, "found better option", target.dominance)
      } else {
        debugLog(this.dominance, "stopping search")
        break
      }
    }

    if (target) {
      debugLog(this.dominance, "going to pursue", target.dominance)
      this.prey = target
      this.pursue(target)
      return
    }

    // TODO wander around?

  }

  pursue(target: Dino) {
    var passableCallback = (x, y) => {
      xy.x = x
      xy.y = y
      // only want to check terrain when making a path (to avoid expensive pathfinding)
      // when following the path we MUST make sure it is valid (since the terrain or dino positions can change)
      return this.isValidTerrain(xy);
    }

    // uses 8-direction for paths to get diagonals
    var astar = new ROT.Path.AStar(target.getXY().x, target.getXY().y, passableCallback);

    let path: XY[] = []
    astar.compute(this.getXY().x, this.getXY().y, (x, y) => {
      path.push(new XY(x, y))
    });
    // index 0 is current position
    path.shift()
    this.pursuit = path
  }

  flee(danger: Entity) {
    debugLog(this.dominance, "fleeing")
    let directionOfThreat = relativePosition(this.getXY(), danger.getXY())
    let oppositeDirection = (directionOfThreat + 2) % 4
    let escape = this.getXY().plus(new XY(...ROT.DIRS[4][oppositeDirection]))
    if (this.isValidPosition(escape)) {
      if (this.isValidPosition(escape)) this.moveTo(escape)
    } else {
      // try to go adjacent
      let adjacent = ROT.DIRS[4][Math.abs(oppositeDirection + ROT.RNG.getItem([1, -1])!) % 4]
      let otherEscape = this.getXY().plus(new XY(...adjacent))
      if (this.isValidPosition(otherEscape)) this.moveTo(otherEscape)
    }
  }

  // TODO move this check somewhere else
  /** No dino and no dangerous terrain in target
    */
  isValidPosition(xy: XY) {
    let d = this.getLevel().dinos.at(xy)
    return !d && this.isValidTerrain(xy)
  }
  isValidTerrain(xy: XY) {
    let t = this.getLevel().map.at(xy)
    return true
      && !(t instanceof Terrain.Ocean)
      && !(t instanceof Terrain.Lava)
  }

  moveTo(xy: XY) {
    this.getLevel().dinos.remove(this);
    this.setPosition(xy)
    this.getLevel().dinos.add(this);
  }

}
