import {
  defineQuery,
  Not,
  removeComponent
} from 'bitecs'
import { ECSWorld } from '../level'
import { Awareness, Pursue, Stunned } from '../components'
import { debugLog } from '../debug'
import { removePursue, removeFlee, addPursue, addFlee } from './movement'
import * as ROT from '../../lib/rotjs'
import Dino from '../entities/dino'



/**
 * Queries surroundings and potentially changes behavior
 */
export default function awarenessSystem(world: ECSWorld) {
  const stunQuery = defineQuery([Stunned])

  for (let eid of stunQuery(world)) {
    Stunned.duration[eid] -= 1
    if (Stunned.duration[eid] <= 0) removeComponent(world, Stunned, eid)
  }


  const awarenessQuery = defineQuery([Awareness, Not(Stunned)])
  for (let eid of awarenessQuery(world)) {
    Awareness.turnsSinceLastObserve[eid] += 1
    if (Awareness.turnsSinceLastObserve[eid] <= Awareness.turnsToSkip[eid]) {
      debugLog(eid, "cooldown", Awareness.turnsSinceLastObserve[eid], "until", Awareness.turnsToSkip[eid])
      continue
    }
    Awareness.turnsSinceLastObserve[eid] = 0
    debugLog(eid, "------------------")

    // TODO check for lava
    // TODO handle roaming
    // TODO handle scavengers
    const selfDino = world.level.dinos.get(eid)
    if (!selfDino) continue

    const sortedNearestDinos = world.level.dinos.nearest(selfDino.getXY())

    // TODO use risk/reward zones instead
    let behaviorSelected = false

    // check for predators
    for (let predator of sortedNearestDinos) {
      if (predator.id === eid || predator.dead) continue
      let dist = selfDino.getXY().dist(predator.getXY())
      if (dist > 20) break // none were close

      if (predator.dominance > selfDino.dominance) {
        // run away
        debugLog(eid, "running from", predator.id)
        removePursue(world, eid)
        addFlee(world, eid, predator)
        behaviorSelected = true
      }
    }
    if (behaviorSelected) continue


    // check for prey
    let target;
    for (let prey of sortedNearestDinos) {
      if (prey.id === eid || prey.dead) continue
      debugLog(selfDino.id, "considering", prey.id)
      // find first viable dino in observation range
      const dist = selfDino.getXY().dist(prey.getXY())
      if (dist > Awareness.range[eid]) break // no prey in sight
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

function calculateRiskReward(d: Dino) {
  var fov = new ROT.FOV.RecursiveShadowcasting(() => true);
  const scores = [0, 2, 4, 6].map(dir => {
    fov.compute90(d.getXY().x, d.getXY().y, 15, dir, (x, y, r, visibility) => {
      // check x,y
    });
  })
}
