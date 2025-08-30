import { defineQuery, removeComponent, hasComponent, addComponent } from "bitecs"
import { ECSWorld } from "../level"
import { Score } from "../components"

export default function scoreSystem(world: ECSWorld) {

  const query = defineQuery([Score])
  for (let eid of query(world)) {
    Score.duration[eid] -= 1
    // remove at 1 or it flashes after fading out
    if (Score.duration[eid] === 1) {
      removeComponent(world, Score, eid)
    }
  }
}
