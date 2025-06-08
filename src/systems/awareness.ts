import {
  defineQuery,
  hasComponent,
  Not,
  removeComponent
} from 'bitecs'
import { ECSWorld } from '../level'
import { Awareness, Herding, Hiding, Pursue, Stunned, Territorial } from '../components'
import { debugLog, debugLogNoisy } from '../debug'
import { removePursue, removeFlee, addPursue, addFlee } from './movement'
import * as ROT from '../../lib/rotjs'
import Dino from '../entities/dino'
import { relativePosition, withIn } from '../utils'
import * as Terrain from '../entities/terrain'
import XY from '../xy'
import { MAP_SIZE } from '../constants'



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
    const selfDino = world.level.dinos.get(eid)
    if (!selfDino) continue
    if (!withIn(world.level.getViewport(), selfDino.getXY().x, selfDino.getXY().y)) continue

    Awareness.turnsSinceLastObserve[eid] += 1
    if (Awareness.turnsSinceLastObserve[eid] <= Awareness.turnsToSkip[eid]) {
      debugLogNoisy(eid, "cooldown", Awareness.turnsSinceLastObserve[eid], "until", Awareness.turnsToSkip[eid])
      continue
    }
    Awareness.turnsSinceLastObserve[eid] = 0
    debugLogNoisy(eid, "------------------")

    // clear out any current behavior
    removeFlee(world, selfDino.id)
    removePursue(world, selfDino.id)

    let overrideScore = 0
    let foundPrey = null
    // finding prety is more targeted than surveyQuadrants and higher weighted
    if (selfDino.kind === "PREDATOR") {
      foundPrey = detectPrey(world.level.dinos.nearest(selfDino.getXY()), selfDino)
      if (foundPrey) overrideScore = 3
    }

    const scores = surveyQuadrants(selfDino, world)

    debugLogNoisy("scores for", eid, scores, overrideScore)

    if (overrideScore >= Math.max(...scores.map(Math.abs))) {
      if (foundPrey) {
        debugLogNoisy(selfDino.id, "going to pursue", foundPrey.id)
        addPursue(world, selfDino.id, foundPrey)
      }
      return world
    }

    const highestScoringDir = scores.reduce(([high, i], curV, curI) => Math.abs(curV) > Math.abs(high) ? [curV, curI] : [high, i], [0, 0])[1]
    // NOTE do something random if score is 0?
    const dirScore = scores[highestScoringDir]
    if (dirScore < 0) {
      addFlee(world, selfDino.id, highestScoringDir)
      debugLogNoisy(selfDino.id, "going to flee", highestScoringDir)
    } else {
      // NOTE maybe add a Roam component or something other than Flee for a better tag
      let oppositeDirection = (highestScoringDir + 2) % 4
      addFlee(world, selfDino.id, oppositeDirection)
      debugLogNoisy(selfDino.id, "going to wander", highestScoringDir)
    }

    return world
  }
}
function surveyQuadrants(self: Dino, world: ECSWorld) {
  // NOTE Recursive shadow casting would be better, better but it doubles up on the 45° lines
  // could do a unique check, but PreciseShadowcasting works just fine (hit range is a square not a circle but that's ok)
  const range = Awareness.range[self.id]
  if (range > 20) throw new Error(self.id + " Awareness range too high" + range)
  let dirScores = [0, 0, 0, 0]
  let dir = 0
  const fov = new ROT.FOV.PreciseShadowcasting(() => true);
  fov.compute(self.getXY().x, self.getXY().y, range, (x, y, r, v) => {
    if (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) return
    const other = world.level.getEntity(x, y)!
    if (other === self) return
    dir = relativePosition(self.getXY(), other.getXY())
    const dist = self.getXY().dist(other.getXY())

    if (other instanceof Dino) {

      if ((other.kind = "PREDATOR") && other.dominance > self.dominance) {
        if (seesDino(self, other)) {
          // NOTE can weight danger level based on dino type
          dirScores[dir] += -1 * proximityMultiplier(self.getXY(), other.getXY())
        }
      }

      if (self.kind === "PREDATOR") {
        if (hasComponent(world, Territorial, self.id) && other.dominance === self.dominance) {
          dirScores[dir] += -2 * proximityMultiplier(self.getXY(), other.getXY())
        }
      }

      if (self.kind === "HERBIVORE") {
        if (hasComponent(world, Herding, self.id) && other.dominance === self.dominance && dist > 2) {
          dirScores[dir] += 2
        }
      }


    } else if (other instanceof Terrain.Lava) {
      // small because lava comes in groups
      dirScores[dir] += -0.3 * proximityMultiplier(self.getXY(), other.getXY())

    } else if (other instanceof Terrain.Terrain) {
      // preferred terrain
    }
  });
  return dirScores
}

function detectPrey(sortedNearestDinos: Dino[], selfDino: Dino): Dino | null {
  let target = null;
  for (let prey of sortedNearestDinos) {
    if (prey.id === selfDino.id || prey.dead) continue

    if (!seesDino(selfDino, prey)) continue

    debugLogNoisy(selfDino.id, "considering", prey.id)
    // find first viable dino in observation range
    const dist = selfDino.getXY().dist(prey.getXY())
    // Predators have longer range when hunting
    if (dist > Awareness.range[selfDino.id] * 2) break // no prey in sight
    if (prey.dominance >= selfDino.dominance) continue
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
      debugLogNoisy(selfDino.id, "found better option", target.id)
    } else {
      debugLogNoisy(selfDino.id, "stopping search, going after", target.id)
      break
    }
  }
  return target
}

function seesDino(selfDino: Dino, otherDino: Dino): boolean {
  let accuracy = Awareness.accuracy[selfDino.id]
  if (hasComponent(selfDino.getLevel().ecsWorld, Hiding, otherDino.id)) accuracy *= 0.5
  // TODO hiding multiplier should be based on terrain under it
  return ROT.RNG.getPercentage() < accuracy
}

function proximityMultiplier(a: XY, b: XY): number {
  const dist = a.dist(b)
  if (dist <= 5) return 3
  if (dist <= 7) return 2
  return 1

}
