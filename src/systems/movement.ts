import {
  addComponent,
  defineQuery,
  hasComponent,
  Not,
  removeComponent,
} from 'bitecs'

import * as ROT from '../../lib/rotjs'
import MainLevel, { ECSWorld } from '../level'
import { Awareness, Controlled, Flee, Movement, Pursue, Stunned } from '../components'
import { DEBUG, debugLog } from '../debug'
import XY from '../xy'
import Path from './path'
import { isValidPosition, isValidTerrain, relativePosition } from '../utils'
import Dino from '../entities/dino'


const pursueRangeReduction = 3
export function addPursue(world: ECSWorld, id: number, other: Dino) {
  addComponent(world, Pursue, id)
  Pursue.target[id] = other.id
  // NOTE be careful if this adjustment causes a negative range, as it will "wrap" (ui8)
  Awareness.range[id] /= pursueRangeReduction
}
export function removePursue(world: ECSWorld, id: number) {
  if (hasComponent(world, Pursue, id)) {
    removeComponent(world, Pursue, id)
    Awareness.range[id] *= pursueRangeReduction
  }
}

const fleeFrequencyReduction = 1.5
export function addFlee(world: ECSWorld, id: number, dir: number) {
  addComponent(world, Flee, id)
  Flee.source[id] = dir
  Awareness.turnsToSkip[id] *= fleeFrequencyReduction
}

export function removeFlee(world: ECSWorld, id: number) {
  if (hasComponent(world, Flee, id)) {
    removeComponent(world, Flee, id)
    Awareness.turnsToSkip[id] /= fleeFrequencyReduction
  }
}

/**
 * Systems for pursuing and fleeing with account of speed
 */
export default function movementSystem(world: ECSWorld) {
  _handlePlayer(world)

  if (defineQuery([Flee, Pursue])(world).length > 0) console.error("Unexpectedly found dinos with Flee and Pursue!")

  const pursueQuery = defineQuery([Movement, Pursue, Not(Stunned)])
  for (let eid of pursueQuery(world)) {

    Movement.turnsSinceLastMove[eid] += 1
    if (Movement.turnsSinceLastMove[eid] <= Movement.frequency[eid] + 1) {
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


// Totally unnecessary byte array packing to hold multiple keys, but it's fun bitwise
const DIRECTION_UP = parseInt('0001', 2);    // 1
const DIRECTION_RIGHT = parseInt('0010', 2); // 2
const DIRECTION_DOWN = parseInt('0100', 2);  // 4
const DIRECTION_LEFT = parseInt('1000', 2);  // 8

function _handlePlayer(world: ECSWorld) {
  if (world.level.playerDino.dead) return
  const eid = world.level.playerId
  Movement.turnsSinceLastMove[eid] += 1
  if (Movement.turnsSinceLastMove[eid] <= Movement.frequency[eid]) {
    return
  }
  Movement.turnsSinceLastMove[eid] = 0
  let dir = null
  if ((DIRECTION_UP & Controlled.pressed[eid]) !== 0) dir = ROT.DIRS[4][0];
  if ((DIRECTION_RIGHT & Controlled.pressed[eid]) !== 0) dir = ROT.DIRS[4][1];
  if ((DIRECTION_DOWN & Controlled.pressed[eid]) !== 0) dir = ROT.DIRS[4][2];
  if ((DIRECTION_LEFT & Controlled.pressed[eid]) !== 0) dir = ROT.DIRS[4][3];

  if (!dir) return

  Controlled.pressed[eid] = 0

  let dirXY = new XY(...dir!)
  const destination = world.level.playerDino.getXY().plus(dirXY)
  // TODO check for eating dino
  let prey = world.level.dinos.at(destination)
  if (prey) {
    removeComponent(world, Movement, prey.id)
    removeComponent(world, Awareness, prey.id)
    removeComponent(world, Controlled, prey.id)
    prey.dead = true
    return
  }
  if (!isValidPosition(destination, world.level)) return
  world.level.playerDino.moveTo(destination)
  world.level.viewportOffset = world.level.viewportOffset.plus(dirXY)
}

export function keypressCb(this: MainLevel, dir: string) {
  switch (dir) {
    case "ArrowUp": Controlled.pressed[this.playerId] |= DIRECTION_UP; break;
    case "ArrowRight": Controlled.pressed[this.playerId] |= DIRECTION_RIGHT; break;
    case "ArrowDown": Controlled.pressed[this.playerId] |= DIRECTION_DOWN; break;
    case "ArrowLeft": Controlled.pressed[this.playerId] |= DIRECTION_LEFT; break;
    default: 0
  }
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
    // TODO I haven't seen this happe any more, likely safe to remove
    if (DEBUG) console.error("empty pursue path", id, targetId)
    removePursue(world, id)
    return
  }

  debugLog(selfDino.id, "pursuing", targetDino.id, "distance:", Path.length(selfDino.id))

  // path has diagonals, but dino can only move orthogonally
  // so move orthogonally but don't advance the path so that the next pass will also be orthogonal
  let relDir = relativePosition(selfDino.getXY(), nextCoord)
  let orthogonalTarget = selfDino.getXY().plus(new XY(...ROT.DIRS[4][relDir]))
  if (!nextCoord.is(orthogonalTarget)) {
    // find the first valid orthogonal position (4 in total to check)
    let attempts = 0
    while (!isValidPosition(orthogonalTarget, world.level) && attempts < 3) {
      attempts++
      relDir = (relDir + 1) % 4
      orthogonalTarget = selfDino.getXY().plus(new XY(...ROT.DIRS[4][relDir]))
    }
    // TODO dino can still get stuck on lava, I may need to pathfind in 4 directions to get to a safe area
    // but risk/reward system might fix this
    if (isValidPosition(orthogonalTarget, world.level)) selfDino.moveTo(orthogonalTarget)
    _calculatePath(selfDino, targetDino)
    return
  }

  // reached target
  if (nextCoord.is(targetDino.getXY())) {
    debugLog(selfDino.id, "reached prey", targetDino.id)

    // TODO add carcass component?
    // TODO move this to a helper
    removeComponent(world, Movement, targetId)
    removeComponent(world, Awareness, targetId)
    removeComponent(world, Controlled, targetId)
    targetDino.dead = true
    // TODO game over if player

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


function _handleFlee(world: ECSWorld, id: number) {
  debugLog(id, "fleeing")
  const selfDino = world.level.dinos.get(id)
  if (!selfDino) return

  let dir = Flee.source[id]
  let oppositeDirection = (dir + 2) % 4
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
