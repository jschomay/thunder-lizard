import * as ROT from "../../lib/rotjs";
import Entity from "../entity";
import XY from "../xy";
import Level from "../level";

const dinoCharMap = ROT.RNG.shuffle(['ي', 'ݎ', 'ࠀ', 'చ', 'ᠥ', '𐀔', '𐎥'])
const colors = ROT.RNG.shuffle(["red", "brown", "lightgreen", "green", "gray", "orange"])

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
    return this.dead
      ? { ...super.getVisual(), ch: "%", fg: "lightgrey" }
      : { ...super.getVisual(), ch: dinoCharMap[this.dominance - 1], fg: colors[this.dominance - 1] }
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
