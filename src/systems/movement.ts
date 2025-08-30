import {
  addComponent,
  defineQuery,
  hasComponent,
  Not,
  removeComponent,
} from 'bitecs'

import * as ROT from '../../lib/rotjs'
import MainLevel, { ECSWorld } from '../level'
import { Awareness, Controlled, Flee, Score, Movement, Pursue, Stunned } from '../components'
import { DEBUG, debugLogNoisy } from '../debug'
import XY from '../xy'
import Path from './path'
import { isValidPosition, isValidTerrain, relativePosition } from '../utils'
import Dino from '../entities/dino'
import { MOVEMENT_DECREASE_IN_WATER, MOVMENT_SPEED_BY_LEVEL, SCORE_DURATION } from '../constants'
import { Water } from '../entities/terrain'


// const pursueFrequencyReduction = 2
export function addPursue(world: ECSWorld, id: number, other: Dino) {
  addComponent(world, Pursue, id)
  Pursue.target[id] = other.id
  // NOTE be careful if this adjustment causes a negative range, as it will "wrap" (ui8)
  // Awareness.turnsToSkip[id] *= pursueFrequencyReduction
}
export function removePursue(world: ECSWorld, id: number) {
  if (hasComponent(world, Pursue, id)) {
    removeComponent(world, Pursue, id)
    // Awareness.turnsToSkip[id] /= pursueFrequencyReduction
  }
}

const fleeFrequencyReduction = 2
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
    if (Movement.turnsSinceLastMove[eid] <= Movement.turnsToSkip[eid] + 1) {
      continue
    }
    Movement.turnsSinceLastMove[eid] = 0
    _handlePursue(world, eid)


  }

  const fleeQuery = defineQuery([Movement, Flee, Not(Stunned)])
  for (let eid of fleeQuery(world)) {
    Movement.turnsSinceLastMove[eid] += 1
    if (Movement.turnsSinceLastMove[eid] <= Movement.turnsToSkip[eid]) {
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
// const SPACE = parseInt('10000', 2) // 16

function _handlePlayer(world: ECSWorld) {
  if (world.level.playerDino.dead) return
  const eid = world.level.playerId
  Movement.turnsSinceLastMove[eid] += 1
  if (Movement.turnsSinceLastMove[eid] <= Movement.turnsToSkip[eid]) {
    return
  }
  Movement.turnsSinceLastMove[eid] = 0
  // if ((SPACE & Controlled.pressed[eid]) !== 0) {
  // TODO when tracking downs and ups, reset here based on ups, for now reset all
  // for now that means you can't hold multiple keys (like arrow and space then let go of space)
  //   Controlled.pressed[eid] = 0
  //   return // hiding; cant move
  // }
  let dir = null
  if ((DIRECTION_UP & Controlled.pressed[eid]) !== 0) dir = ROT.DIRS[4][0];
  if ((DIRECTION_RIGHT & Controlled.pressed[eid]) !== 0) dir = ROT.DIRS[4][1];
  if ((DIRECTION_DOWN & Controlled.pressed[eid]) !== 0) dir = ROT.DIRS[4][2];
  if ((DIRECTION_LEFT & Controlled.pressed[eid]) !== 0) dir = ROT.DIRS[4][3];

  if (!dir) return

  // TODO when tracking downs and ups, reset here based on ups, for now reset all
  // for now that means you can't hold multiple keys (like arrow and space then let go of space)
  Controlled.pressed[eid] = 0

  let dirXY = new XY(...dir!)
  const destination = world.level.playerDino.getXY().plus(dirXY)
  let other = world.level.dinos.at(destination)
  let playerDino = world.level.playerDino
  if (other && !other.dead && other.dominance <= playerDino.dominance) {
    let score = other.dominance * playerDino.dominance * 100
    let levelUpMultiplier = 1
    // check level up
    if (other.dominance === playerDino.dominance) {
      playerDino.dominance += 1
      levelUpMultiplier = 10
      Movement.turnsToSkip[playerDino.id] = MOVMENT_SPEED_BY_LEVEL[playerDino.dominance]
      // adjust speed if eating in water
      let t = world.level.map.at(playerDino.getXY())
      if (t instanceof Water) Movement.turnsToSkip[playerDino.id] += MOVEMENT_DECREASE_IN_WATER
      // TODO check for game win
    }
    other.kill(world)
    addComponent(world, Score, other.id)
    score *= levelUpMultiplier
    Score.amount[other.id] = score
    Score.duration[other.id] = SCORE_DURATION
    world.level.setScore(score)
    return
  }
  if (!isValidPosition(destination, world.level)) return
  world.level.playerDino.moveTo(destination)
  world.level.viewportOffset = world.level.viewportOffset.plus(dirXY)
}

export function keypressCb(this: MainLevel, key: string, keyUp = false) {
  if (keyUp) {
    switch (key) {
      //   case " ":
      //     Controlled.pressed[this.playerId] &= ~SPACE;
      //     removeComponent(this.dinoEcsWorld, Hiding, this.playerId)
      //     break;
      // TODO this doesn't work nicel if key is tapped between frames
      // instead track both downs and ups and clear downs after processed if up is logged
      // case "ArrowUp": Controlled.pressed[this.playerId] &= ~DIRECTION_UP; break;
      // case "ArrowRight": Controlled.pressed[this.playerId] &= ~DIRECTION_RIGHT; break;
      // case "ArrowDown": Controlled.pressed[this.playerId] &= ~DIRECTION_DOWN; break;
      // case "ArrowLeft": Controlled.pressed[this.playerId] &= ~DIRECTION_LEFT; break;
      // default: 0
    }
    return
  }
  switch (key) {
    // case " ":
    //   Controlled.pressed[this.playerId] |= SPACE;
    //   addComponent(this.dinoEcsWorld, Hiding, this.playerId)
    //   break;
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

  debugLogNoisy(selfDino.id, "pursuing", targetDino.id, "distance:", Path.length(selfDino.id))

  let nextCoord = selfDino.getXY().plus(new XY(...ROT.DIRS[4][relativePosition(selfDino.getXY(), targetDino.getXY())]))

  if (nextCoord.is(targetDino.getXY())) {
    // reached target
    debugLogNoisy(selfDino.id, "reached prey", targetDino.id)

    if (targetDino.id === world.level.playerId) {
      targetDino.dominance -= 1
      world.level.setScore(-1000)
      if (targetDino.dominance === 0) {
        targetDino.kill(world)
        world.level.setGameOver()
      }

    } else {
      targetDino.kill(world)
    }

    removePursue(world, id)
    // rest after eating, based on how "heavy" the meal was
    addComponent(world, Stunned, id)
    Stunned.duration[id] = Math.max(1, targetDino.dominance) * 5

  } else if (isValidPosition(nextCoord, world.level)) {
    // move closer (if able)
    selfDino.moveTo(nextCoord)

  } else {
    // fall back to pathfinding
    _calculatePath(selfDino, targetDino, 4)
    nextCoord = new XY(...Path.current(id))
    selfDino.moveTo(nextCoord)
  }
}

let xy = new XY(0, 0)
function _calculatePath(selfDino: Dino, target: Dino, topology: 4 | 8 = 8) {
  Path.init(selfDino.id)
  var passableCallback = (x, y) => {
    xy.x = x
    xy.y = y
    // only want to check terrain and dead dinos when making a path (to avoid expensive pathfinding)
    // when following the path we MUST make sure it is valid (since the terrain or dino positions can change)
    return isValidTerrain(xy, selfDino.getLevel()) && !selfDino.getLevel().dinos.at(xy)?.dead
  }

  var astar = new ROT.Path.AStar(target.getXY().x, target.getXY().y, passableCallback, { topology });

  astar.compute(selfDino.getXY().x, selfDino.getXY().y, (x, y) => {
    Path.push(selfDino.id, x, y)
  });
  // index 0 is current position, so set focus on the next step
  Path.advance(selfDino.id)
}


function _handleFlee(world: ECSWorld, id: number) {
  debugLogNoisy(id, "fleeing")
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
