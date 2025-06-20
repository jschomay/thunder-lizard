import Entity from "../entity";
import XY from "../xy";
import Level from "../level";
import { DEBUG } from "../debug";
import { Color } from "../../lib/rotjs";
import { Controlled, Hiding } from "../components";
import { hasComponent } from "bitecs";


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

    else if (DEBUG > 1) {
      return { ...super.getVisual(), ch: this.kind[0] + this.dominance }

    } else if (hasComponent(this.getLevel().ecsWorld, Hiding, this.id)) {
      let fg = super.getVisual()!.fg
      let terrainFg = this.getLevel().map.at(this.getXY())!.getVisual().fg
      let darkened = Color.toHex(Color.interpolate(Color.fromString(fg), Color.fromString(terrainFg), 0.5))
      return { ...super.getVisual(), fg: darkened }

    } else {
      return super.getVisual()
    }
  }

  getSpeed() {
    return this.dominance;
  }


  moveTo(xy: XY) {
    this.getLevel().dinos.remove(this);
    this.setPosition(xy)
    this.getLevel().dinos.add(this);
  }

}
