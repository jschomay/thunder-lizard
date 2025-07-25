import Entity from "../entity";
import XY from "../xy";
import Level from "../level";
import { DEBUG } from "../debug";
import { Color } from "../../lib/rotjs";
import { Controlled, Deplacable, Deplaced, Hiding, Movement } from "../components";
import { addComponent, hasComponent } from "bitecs";
import { relativePosition } from "../utils";
import { Water } from "./terrain";
import { MOVEMENT_DECREASE_IN_WATER } from "../constants";

// const dinoCharMap = ROT.RNG.shuffle(['ي', 'ݎ', 'ࠀ', 'చ', 'ᠥ', '𐀔', '𐎥'])
// const visuals = ["➊", "➋", "➌", "➍", "➎", "➏"]
const visuals = ["①", "②", "③", "④", "⑤", "⑥"]
// const colors = ROT.RNG.shuffle(["red", "brown", "lightgreen", "purple", "orange"])
const colors = ["#69A1B5", "#A1663B", "#E2A651", "#C94A24", "#79547D"]
const playerColor = "#eee"

export type dinoKind = "PREDATOR" | "HERBIVORE" | "SCAVENGER"

export default class Dino extends Entity {
  id: number
  dominance: number
  kind: dinoKind
  dead = false


  constructor(level: Level, xy: XY, id: number, dominance: number, kind: dinoKind) {
    super(level, xy, { ch: "𑿋", fg: "lightgrey" });
    this.id = id
    this.dominance = dominance
    this.kind = kind
  }

  getVisual() {

    if (this.dead) {
      return { ...super.getVisual(), ch: "%", fg: "lightgrey" }
    }

    let visual = { ch: "X", fg: this.id === 0 ? playerColor : colors[this.dominance - 1] }
    visual.ch = visuals[this.dominance - 1]

    if (DEBUG > 1) {
      return { ...visual, ch: this.kind[0] + this.dominance }

    } else if (hasComponent(this.getLevel().dinoEcsWorld, Hiding, this.id)) {
      let fg = super.getVisual()!.fg
      let terrainFg = this.getLevel().map.at(this.getXY())!.getVisual().fg
      let darkened = Color.toHex(Color.interpolate(Color.fromString(fg), Color.fromString(terrainFg), 0.5))
      return { ...visual, fg: darkened }

    } else {
      return visual
    }
  }

  getSpeed() {
    return this.dominance;
  }


  moveTo(xy: XY) {
    const from_terrain = this.getLevel().map.at(this.getXY())
    Movement.direction[this.id] = relativePosition(this.getXY(), xy)
    this.getLevel().dinos.remove(this);
    this.setPosition(xy)
    const to_terrain = this.getLevel().map.at(this.getXY())
    this.getLevel().dinos.add(this);

    if (!from_terrain || !to_terrain) {
      console.warn("from", from_terrain, "to", to_terrain)
      return
    }

    // changing speed when entering/exiting water
    if (from_terrain instanceof Water && !(to_terrain instanceof Water)) {
      Movement.turnsToSkip[this.id] -= MOVEMENT_DECREASE_IN_WATER
    }
    if (!(from_terrain instanceof Water) && to_terrain instanceof Water) {
      Movement.turnsToSkip[this.id] += MOVEMENT_DECREASE_IN_WATER
    }

    // displacment
    if (hasComponent(this.getLevel().terrainEcsWorld, Deplacable, from_terrain.id)) {
      addComponent(this.getLevel().terrainEcsWorld, Deplaced, from_terrain.id)
      Deplaced.deplaced[from_terrain.id] = 100
    }
  }

}
