import {
  hasComponent
} from 'bitecs'

import { ECSWorld } from '../level'
import { Awareness } from '../components'
import { debugLog } from '../debug'


export default function awarenessSystem(world: ECSWorld) {
  const dinos = world.level.dinos.withIn(world.level.getViewport())
  for (let d of dinos) {
    if (!hasComponent(world, Awareness, d.id)) continue

    if (Awareness.cooldown[d.id] > 0) {
      debugLog(d.id, "cooldown", Awareness.cooldown[d.id])
      Awareness.cooldown[d.id] -= 1
      continue
    }

    // TODO this doesn't work
    // example:
    // wait normal time
    // set new normal time
    // act, which sets modifier
    // wait normal time (this should include the modifier!)
    // set normal plus modifier and clear modifier
    // act (shouldn't have happened yet)
    // wait normal time plus modifier
    // I think just adding the modifier add before the cooldown check and resetting it will work
    // But not for persistant modifiers or ones that get called from outside of the movement system...
    Awareness.cooldown[d.id] = Math.max(0, Awareness.reactionTime[d.id] + Awareness.reactionTimeModifier[d.id])
    Awareness.reactionTimeModifier[d.id] = 0

    // TODO add behavior selection logic here
    d.act()

    // check for danger
    // lava
    // predators

    // check for prey
  }
  return world
}

