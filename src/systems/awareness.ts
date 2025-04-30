import {
  hasComponent
} from 'bitecs'

import { ECSWorld } from '../level'
import { Awareness } from '../components'


export default function awarenessSystem(world: ECSWorld) {
  const dinos = world.level.dinos.withIn(world.level.getViewport())
  for (let d of dinos) {
    if (!hasComponent(world, Awareness, d.id)) continue

    if (Awareness.cooldown[d.id] > 0) {
      Awareness.cooldown[d.id] -= 1
      continue
    }
    Awareness.cooldown[d.id] = Awareness.responsiveness[d.id]

    d.act()
  }
  return world
}

