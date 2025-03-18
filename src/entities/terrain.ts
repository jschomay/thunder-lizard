import Entity, { Visual } from "../entity";
import XY from "../xy";
import Level from "../level";
import { RNG } from "../../lib/rotjs";

export class Lava extends Entity {
  constructor(level: Level, xy: XY) {
    let fg: string = RNG.getItem(["#e11", "#e43"])!
    super(level, xy, { ch: "༉", fg });
  }
}

export class Water extends Entity {
  constructor(level: Level, xy: XY) {
    super(level, xy);
    this.setVisual(this.getRandomVisual())
  }
  getRandomVisual(): Visual {
    let ch: string = RNG.getItem("≋≈".split(""))!
    let fg: string = RNG.getItem(["#44f", "#66e"])!
    return { ch, fg }
  }
  act() {
    this.setVisual(this.getRandomVisual())
  }

}

export class Ocean extends Entity {
  constructor(level: Level, xy: XY) {
    super(level, xy);
    this.setVisual(this.getRandomVisual())
  }
  getRandomVisual(): Visual {
    let ch: string = RNG.getItem("༄༅".split(""))!
    let fg: string = RNG.getItem(["#11d", "#11a"])!
    return { ch, fg }
  }
  act() {
    this.setVisual(this.getRandomVisual())
  }
}

export class Dirt extends Entity {
  constructor(level: Level, xy: XY) {
    let ch = RNG.getItem("¸ʾ˚˓")
    super(level, xy, { ch, fg: "#754" });
  }
}

export class Grass extends Entity {
  constructor(level: Level, xy: XY) {
    let ch = RNG.getItem("ɷɞɜ")
    super(level, xy, { ch, fg: "#2a2" });
  }
}

export class Shrub extends Entity {
  constructor(level: Level, xy: XY) {
    let ch = RNG.getItem("ɰɱɵɛ")
    super(level, xy, { ch, fg: "#172" });
  }
}
export class Jungle extends Entity {
  constructor(level: Level, xy: XY) {
    let ch = RNG.getItem("ƍʕʔʃʆψβϡ")
    super(level, xy, { ch, fg: "#050" });
  }
}

