import {
  hasComponent,
  removeComponent
} from 'bitecs'

import * as ROT from '../../lib/rotjs'
import { ECSWorld } from '../level'
import { Awareness, Flee, Movement, Pursue } from '../components'
import { DEBUG, debugLog } from '../debug'
import XY from '../xy'
import Path from './path'
import { relativePosition } from '../utils'


/**
 * Movement is based on the curent behavior like pursuing or fleeing or roaming
 * This system manages movement speed and the components defining movement behaviors.
 */
export default function movementSystem(world: ECSWorld) {
  const dinos = world.level.dinos.withIn(world.level.getViewport())
  for (let d of dinos) {
    if (!hasComponent(world, Movement, d.id)) continue

    if (Movement.cooldown[d.id] > 0) {
      Movement.cooldown[d.id] -= 1
      continue
    }

    Movement.cooldown[d.id] = Math.max(0, Movement.lag[d.id] + Movement.lagModifier[d.id])

    if (hasComponent(world, Pursue, d.id)) {
      _handlePursue(world, d.id)

    } else if (hasComponent(world, Flee, d.id)) {
      _handleFlee()
    }

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
    removeComponent(world, Pursue, id)
    return
  }

  let target = new XY(...Path.current(id))

  if (target.x === -1) {
    // means the path has run out
    // shouldn't happen, but rarely it does, not quite sure how
    // TODO I think it happens when pursuing a dino that goes away
    // and maybe reaching it before doing a new awareness check
    if (DEBUG) console.error("empty pursue path", id, targetId)
    removeComponent(world, Pursue, id)
    return
  }

  debugLog(selfDino.id, "pursuing", targetDino.id, "distance:", Path.length(selfDino.id))

  // path has diagonals, but dino can only move orthogonally
  // so move orthogonally but don't advance the path so that the next pass will also be orthogonal
  let orthogonalTarget = selfDino.getXY().plus(new XY(...ROT.DIRS[4][relativePosition(selfDino.getXY(), target)]))
  if (!target.is(orthogonalTarget)) {
    // TODO move this over from dino.ts after moving flee
    // if a dino or lava got in the way, wait for next pass
    if (selfDino.isValidPosition(orthogonalTarget)) selfDino.moveTo(orthogonalTarget)
    return
  }

  // reached target
  if (target.is(targetDino.getXY())) {
    debugLog(selfDino.id, "reached prey", targetDino.id)
    world.level.dinos.remove(targetDino)
    // TODO add carcase
    // rest after eating, based on how "heavy" the meal was
    // unsafe, but we can assume this dino with Pursue always has Awareness
    Awareness.reactionTimeModifier[id] = targetDino.dominance * 5
  }

  // move closer
  // TODO move this over from dino.ts after moving flee
  // if a dino or lava got in the way, wait for next pass
  if (selfDino.isValidPosition(target)) {
    selfDino.moveTo(target)
    Path.advance(id)
  }

  // "hone in" more accurately when closer (by observing every turn)
  // Makes dino go where target is, not where it was
  // NOTE this makes the dino more aware of all factors, not just the target
  if (Path.length(id) < 5) {
    // unsafe, but we can assume this dino with Pursue always has Awareness
    Awareness.reactionTimeModifier[id] = -99
    return
  }

}

function _handleFlee() {
  // TODO
}
