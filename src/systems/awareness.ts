import {
  hasComponent,
  removeComponent
} from 'bitecs'
import { ECSWorld } from '../level'
import { Awareness, Pursue, Stunned } from '../components'
import { debugLog } from '../debug'
import { removePursue, removeFlee, addPursue, addFlee } from './movement'



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
    // TODO doesn't seem to get playerDino?
    const sortedNearestDinos = world.level.dinos.nearest(selfDino.getXY())

    // TODO use risk/reward zones instead
    let behaviorSelected = false

    // check for predators
    for (let predator of sortedNearestDinos) {
      if (predator.id === d.id || predator.dead) continue
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
      if (prey.id === d.id || prey.dead) continue
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
    }
    if (behaviorSelected) continue
  }

  return world
}
