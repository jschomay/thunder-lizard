import {
  hasComponent,
  removeComponent
} from 'bitecs'

import { ECSWorld } from '../level'
import { Awareness, Stunned } from '../components'
import { debugLog } from '../debug'


export default function awarenessSystem(world: ECSWorld) {
  const dinos = world.level.dinos.withIn(world.level.getViewport())
  for (let d of dinos) {
    if (!hasComponent(world, Awareness, d.id)) continue

    if (hasComponent(world, Stunned, d.id)) {
      Stunned.duration[d.id] -= 1
      if (Stunned.duration[d.id] <= 0) removeComponent(world, Stunned, d.id)
      continue
    }

    Awareness.turnsSinceLastObserve[d.id] += 1
    if (Awareness.turnsSinceLastObserve[d.id] < Awareness.observeFrequency[d.id] + Awareness.frequencyModifier[d.id]) {
      debugLog(d.id, "cooldown", Awareness.turnsSinceLastObserve[d.id], "until", Awareness.observeFrequency[d.id] + Awareness.frequencyModifier[d.id])
      continue
    }
    // NOTE not sure if this should be reset or not
    Awareness.turnsSinceLastObserve[d.id] = 0
    Awareness.frequencyModifier[d.id] = 0

    // TODO add behavior selection logic here
    d.act()

    // check for danger
    // lava
    // predators

    // check for prey
  }
  return world
}

