import {
  addComponent,
  defineQuery,
  hasComponent,
  Not,
  removeComponent,
  removeEntity
} from 'bitecs'

import * as ROT from '../../lib/rotjs'
import { ECSWorld } from '../level'
import { Awareness, Flee, Movement, Pursue, Stunned } from '../components'
import { DEBUG, debugLog } from '../debug'
import XY from '../xy'
import Path from './path'
import { isValidPosition, isValidTerrain, relativePosition } from '../utils'
import Dino from '../entities/dino'
import Entity from '../entity'


export function addPursue(world: ECSWorld, id: number, other: Dino) {
  addComponent(world, Pursue, id)
  Pursue.target[id] = other.id
  Awareness.range[id] -= 20
}
export function removePursue(world: ECSWorld, id: number) {
  if (hasComponent(world, Pursue, id)) {
    removeComponent(world, Pursue, id)
    Awareness.range[id] += 20
  }
}

export function addFlee(world: ECSWorld, id: number, other: Entity) {
  addComponent(world, Flee, id)
  Flee.source[id].set([other.getXY().x, other.getXY().y])
  Awareness.turnsToSkip[id] += 5
}

export function removeFlee(world: ECSWorld, id: number) {
  if (hasComponent(world, Flee, id)) {
    removeComponent(world, Flee, id)
    Awareness.turnsToSkip[id] -= 5
  }
}

/**
 * Systems for pursuing and fleeing with account of speed
 */
export default function movementSystem(world: ECSWorld) {
  const pursueQuery = defineQuery([Movement, Pursue, Not(Stunned)])
  for (let eid of pursueQuery(world)) {

    Movement.turnsSinceLastMove[eid] += 1
    if (Movement.turnsSinceLastMove[eid] <= Movement.frequency[eid]) {
      continue
    }
    Movement.turnsSinceLastMove[eid] = 0
    _handlePursue(world, eid)


  }

  const fleeQuery = defineQuery([Movement, Flee, Not(Stunned)])
  for (let eid of fleeQuery(world)) {
    Movement.turnsSinceLastMove[eid] += 1
    if (Movement.turnsSinceLastMove[eid] <= Movement.frequency[eid]) {
      continue
    }
    Movement.turnsSinceLastMove[eid] = 0
    _handleFlee(world, eid)
  }

  return world
}



function _handlePursue(world: ECSWorld, id: number) {
  const targetId = Pursue.target[id]

  let selfDino = world.level.dinos.get(id)
  let targetDino = world.level.dinos.get(targetId)
  if (!selfDino) return


  // something else got the target; give up
  if (!targetDino) {
    removePursue(world, id)
    return
  }

  // initial pathfinding or "honing in"
  if (Pursue.offset[id] === 0 || Path.length(id) < 5) _calculatePath(selfDino, targetDino)


  let nextCoord = new XY(...Path.current(id))

  if (nextCoord.x === -1) {
    // means the path has run out
    // TODO shouldn't happen, but sometimes it does, not quite sure how
    if (DEBUG) console.error("empty pursue path", id, targetId)
    removePursue(world, id)
    return
  }

  debugLog(selfDino.id, "pursuing", targetDino.id, "distance:", Path.length(selfDino.id))

  // path has diagonals, but dino can only move orthogonally
  // so move orthogonally but don't advance the path so that the next pass will also be orthogonal
  let orthogonalTarget = selfDino.getXY().plus(new XY(...ROT.DIRS[4][relativePosition(selfDino.getXY(), nextCoord)]))
  if (!nextCoord.is(orthogonalTarget)) {
    // if a dino or lava got in the way, wait for next pass
    if (isValidPosition(orthogonalTarget, world.level)) selfDino.moveTo(orthogonalTarget)
    return
  }

  // reached target
  if (nextCoord.is(targetDino.getXY())) {
    debugLog(selfDino.id, "reached prey", targetDino.id)

    // TODO maybe remove all components instead and add carcass component?
    removeEntity(world, targetId)
    targetDino.dead = true

    removePursue(world, id)
    // rest after eating, based on how "heavy" the meal was
    addComponent(world, Stunned, id)
    Stunned.duration[id] = targetDino.dominance * 5
    return
  }

  // move closer (if able)
  if (isValidPosition(nextCoord, world.level)) {
    selfDino.moveTo(nextCoord)
    Path.advance(id)
    return
  }
}

let xy = new XY(0, 0)
function _calculatePath(selfDino: Dino, target: Dino) {
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


const dangerSource = new XY()
function _handleFlee(world: ECSWorld, id: number) {
  debugLog(id, "fleeing")
  const selfDino = world.level.dinos.get(id)
  if (!selfDino) return

  dangerSource.x = Flee.source[id][0]
  dangerSource.y = Flee.source[id][1]

  let directionOfThreat = relativePosition(selfDino.getXY(), dangerSource)
  let oppositeDirection = (directionOfThreat + 2) % 4
  let escape = selfDino.getXY().plus(new XY(...ROT.DIRS[4][oppositeDirection]))
  if (isValidPosition(escape, world.level)) {
    selfDino.moveTo(escape)
  } else {
    // try to go adjacent
    let adjacent = ROT.DIRS[4][Math.abs(oppositeDirection + ROT.RNG.getItem([1, -1])!) % 4]
    let otherEscape = selfDino.getXY().plus(new XY(...adjacent))
    if (isValidPosition(otherEscape, world.level)) selfDino.moveTo(otherEscape)
  }

}
