import { defineQuery, removeComponent } from "bitecs"
import { ECSWorld } from "../level"
import { Deplacable, Deplaced } from "../components"

export default function deplacementSystem(world: ECSWorld) {

  const query = defineQuery([Deplaced, Deplacable])
  for (let eid of query(world)) {
    Deplaced.deplaced[eid] -= Deplacable.healRate[eid]
    if (Deplaced.deplaced[eid] <= 0) {
      removeComponent(world, Deplaced, eid)
    }
  }
}
