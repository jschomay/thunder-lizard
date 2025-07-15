import { defineQuery, removeComponent, hasComponent, addComponent } from "bitecs"
import { ECSWorld } from "../level"
import { Deplacable, Deplaced } from "../components"
import XY from "../xy"
import { Water } from "../entities/terrain"

export default function deplacementSystem(world: ECSWorld) {

  const query = defineQuery([Deplaced, Deplacable])
  for (let eid of query(world)) {
    Deplaced.deplaced[eid] -= Deplacable.healRate[eid]
    if (Deplaced.deplaced[eid] <= 0) {
      removeComponent(world, Deplaced, eid)
    }

    let currentDisplacementAmount = Deplaced.deplaced[eid]

    let currentXY = world.level.map.getById(eid)!.getXY()
    let neighborXYs = [
      currentXY.plus(new XY(0, 1)),
      currentXY.plus(new XY(0, -1)),
      currentXY.plus(new XY(1, 0)),
      currentXY.plus(new XY(-1, 0)),
    ]

    for (let neighborXY of neighborXYs) {
      let neighborEntity = world.level.map.at(neighborXY)
      if (currentDisplacementAmount > 0
        && neighborEntity instanceof Water
        && !hasComponent(world, Deplaced, neighborEntity.id)) {
        addComponent(world, Deplaced, neighborEntity.id)
        Deplaced.deplaced[neighborEntity.id] = Math.floor(currentDisplacementAmount / 4)
      }
    }
  }
}
