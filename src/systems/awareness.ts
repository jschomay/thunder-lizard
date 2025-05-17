import {
  addComponent,
  hasComponent,
  removeComponent
} from 'bitecs'
import * as ROT from '../../lib/rotjs'
import { ECSWorld } from '../level'
import { Awareness, Flee, Pursue, Stunned } from '../components'
import { debugLog } from '../debug'
import Dino from '../entities/dino'
import Entity from '../entity'
import Path from '../systems/path'
import XY from '../xy'
import { isValidTerrain } from '../utils'



/**
 * Queries surroundings and potentially changes behavior
 */
export default function awarenessSystem(world: ECSWorld) {
  const dinos = world.level.dinos.withIn(world.level.getViewport())
  for (let d of dinos) {
    if (!hasComponent(world, Awareness, d.id)) continue

    // TODO change to query [Awareness, NOT(Stunned)]
    // and decrement stun as separate system
    if (hasComponent(world, Stunned, d.id)) {
      Stunned.duration[d.id] -= 1
      if (Stunned.duration[d.id] <= 0) removeComponent(world, Stunned, d.id)
      continue
    }

    Awareness.turnsSinceLastObserve[d.id] += 1
    if (Awareness.turnsSinceLastObserve[d.id] <= Awareness.turnsToSkip[d.id]) {
      debugLog(d.id, "cooldown", Awareness.turnsSinceLastObserve[d.id], "until", Awareness.turnsToSkip[d.id])
      continue
    }
    Awareness.turnsSinceLastObserve[d.id] = 0
    debugLog(d.id, "------------------")

    // TODO check for lava
    // TODO handle roaming
    // TODO handle scavengers
    const selfDino = world.level.dinos.get(d.id)
    if (!selfDino) continue
    const sortedNearestDinos = world.level.dinos.nearest(selfDino.getXY())

    // TODO use risk/reward zones instead
    let behaviorSelected = false

    // check for predators
    for (let predator of sortedNearestDinos) {
      if (predator.id === d.id) continue
      let dist = selfDino.getXY().dist(predator.getXY())
      if (dist > 20) break // none were close

      if (predator.dominance > selfDino.dominance) {
        // run away
        debugLog(d.id, "running from", predator.id)
        removePursue(world, d.id)
        addFlee(world, d.id, predator)
        behaviorSelected = true
      }
    }
    if (behaviorSelected) continue


    // check for prey
    let target;
    for (let prey of sortedNearestDinos) {
      debugLog(selfDino.id, "considering", prey.id)
      // find first viable dino in observation range
      const dist = selfDino.getXY().dist(prey.getXY())
      if (dist > Awareness.range[prey.id]) break // no prey in sight
      if (prey.dominance >= selfDino.dominance) continue
      behaviorSelected = true
      if (!target) {
        target = prey
        continue
      }

      // look for next best target, stop looking if not found
      let score = 0
      if (prey.dominance > target.dominance) {
        score += prey.dominance - target.dominance
      }
      score -= Math.floor(prey.getXY().dist(target.getXY()) / 2)
      if (score > 0) {
        target = prey
        debugLog(selfDino.id, "found better option", target.id)
      } else {
        debugLog(selfDino.id, "stopping search")
        break
      }
    }
    if (target) {
      debugLog(selfDino.id, "going to pursue", target.id)
      removeFlee(world, selfDino.id)
      addPursue(world, selfDino.id, target)
      // TODO move this to the pursue system
      calculatePath(selfDino, target)
    }
    if (behaviorSelected) continue
  }

  return world
}

// TODO move this to the pursue system (and manage updating path there)
let xy = new XY(0, 0)
function calculatePath(selfDino: Dino, target: Dino) {
  Path.init(selfDino.id)
  var passableCallback = (x, y) => {
    xy.x = x
    xy.y = y
    // only want to check terrain when making a path (to avoid expensive pathfinding)
    // when following the path we MUST make sure it is valid (since the terrain or dino positions can change)
    return isValidTerrain(xy, selfDino.getLevel());
  }

  // uses 8-direction for paths to get diagonals
  var astar = new ROT.Path.AStar(target.getXY().x, target.getXY().y, passableCallback);

  astar.compute(selfDino.getXY().x, selfDino.getXY().y, (x, y) => {
    Path.push(selfDino.id, x, y)
  });
  // index 0 is current position, so set focus on the next step
  Path.advance(selfDino.id)
}

function addPursue(world: ECSWorld, id: number, other: Dino) {
  // TODO add modifiers
  addComponent(world, Pursue, id)
  Pursue.target[id] = other.id
}
function removePursue(world: ECSWorld, id: number) {
  if (hasComponent(world, Pursue, id)) {
    // TODO reset modifiers
    removeComponent(world, Pursue, id)
  }
}

function addFlee(world: ECSWorld, id: number, other: Entity) {
  // TODO add modifiers
  addComponent(world, Flee, id)
  Flee.source[id].set([other.getXY().x, other.getXY().y])
}

function removeFlee(world: ECSWorld, id: number) {
  if (hasComponent(world, Flee, id)) {
    // TODO reset modifiers
    removeComponent(world, Flee, id)
  }
}
