import { defineQuery, removeComponent, hasComponent, addComponent } from "bitecs"
import { ECSWorld } from "../level"
import { Deplacable, Deplaced } from "../components"
import XY from "../xy"
import { Ocean, Water } from "../entities/terrain"
import { MAP_SIZE } from "../constants"
import { waterOrOcean } from "../utils"

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
      if (neighborXY.x < 0 || neighborXY.y < 0 || neighborXY.x > MAP_SIZE || neighborXY.y > MAP_SIZE) continue
      let neighborEntity = world.level.map.at(neighborXY)
      if (neighborEntity
        && (waterOrOcean(neighborEntity))
        && currentDisplacementAmount > 0
        && hasComponent(world, Deplacable, neighborEntity.id)
        && !hasComponent(world, Deplaced, neighborEntity.id)) {
        addComponent(world, Deplaced, neighborEntity.id)
        Deplaced.deplaced[neighborEntity.id] = Math.floor(currentDisplacementAmount / 4)
      }
    }
  }
}
