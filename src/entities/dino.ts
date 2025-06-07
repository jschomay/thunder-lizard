import Entity from "../entity";
import XY from "../xy";
import Level from "../level";
import { DEBUG } from "../debug";


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
    if (DEBUG > 1) {
      return { ...super.getVisual(), ch: this.kind[0] + this.dominance }
    } else {
      return this.dead
        ? { ...super.getVisual(), ch: "%", fg: "lightgrey" }
        : super.getVisual()
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
