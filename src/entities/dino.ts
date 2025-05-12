import * as ROT from "../../lib/rotjs";
import Entity from "../entity";
import XY from "../xy";
import Level from "../level";
import { SpeedActor } from "../../lib/rotjs";
import { debugLog } from "../debug";
import { addComponent } from "bitecs";
import { Awareness, Flee, Pursue } from "../components";
import Path from '../systems/path'
import { isValidTerrain } from "../utils";

const dinoCharMap = ROT.RNG.shuffle(['ي', 'ݎ', 'ࠀ', 'చ', 'ᠥ', '𐀔', '𐎥'])

export type dinoKind = "PREDATOR" | "HERBIVORE" | "SCAVENGER"

let xy = new XY(0, 0)
export default class Dino extends Entity implements SpeedActor {
  id: number
  dominance: number
  kind: dinoKind


  constructor(level: Level, xy: XY, id: number, dominance: number, kind: dinoKind) {
    super(level, xy, { ch: "𑿋", fg: "lightgrey" });
    this.id = id
    this.dominance = dominance
    this.kind = kind
  }

  getVisual() {
    return { ...super.getVisual(), ch: dinoCharMap[this.dominance - 1] }
  }

  getSpeed() {
    return this.dominance;
  }

  act() {
    const nearDinos = this.getLevel().dinos.nearest(this.getXY())

    debugLog(this.id, "------------------")

    // // TODO periodically observe
    // // faking this by forcing n% of the time
    // if (ROT.RNG.getPercentage() < 20) {
    //   this.pursuit = null
    //   this.prey = null
    // }

    // // actively chasing
    // if (this.pursuit && this.prey) {
    //   // chase
    // }

    // TODO check for lava

    // TODO handle herbavores (who care about terrain food sources)

    // check for predators
    for (let d of nearDinos) {
      if (d === this) continue
      let dist = this.getXY().dist(d.getXY())
      if (dist > 30) break

      if (d.dominance > this.dominance) {
        // run away
        debugLog(this.id, "running from", d.id)
        addComponent(this.getLevel().ecsWorld, Flee, this.id)
        Flee.source[this.id].set([d.getXY().x, d.getXY().y])
        return
      }
    }

    // check for prey
    let target;
    for (let d of nearDinos) {
      debugLog(this.id, "considering", d.id)
      // find first viable dino in observation range
      const dist = this.getXY().dist(d.getXY())
      if (dist > Awareness.range[d.id]) break
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
        debugLog(this.id, "found better option", target.id)
      } else {
        debugLog(this.id, "stopping search")
        break
      }
    }

    if (target) {
      debugLog(this.id, "going to pursue", target.id)
      addComponent(this.getLevel().ecsWorld, Pursue, this.id)
      Pursue.target[this.id] = target.id
      this.calculatePath(target)
      return
    }

    // TODO wander around?

  }

  // TODO probably this should live in the Awareness system
  calculatePath(target: Dino) {
    Path.init(this.id)
    var passableCallback = (x, y) => {
      xy.x = x
      xy.y = y
      // only want to check terrain when making a path (to avoid expensive pathfinding)
      // when following the path we MUST make sure it is valid (since the terrain or dino positions can change)
      return isValidTerrain(xy, this.getLevel());
    }

    // uses 8-direction for paths to get diagonals
    var astar = new ROT.Path.AStar(target.getXY().x, target.getXY().y, passableCallback);

    astar.compute(this.getXY().x, this.getXY().y, (x, y) => {
      Path.push(this.id, x, y)
    });
    // index 0 is current position, so set focus on the next step
    Path.advance(this.id)
  }

  moveTo(xy: XY) {
    this.getLevel().dinos.remove(this);
    this.setPosition(xy)
    this.getLevel().dinos.add(this);
  }

}
