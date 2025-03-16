import Entity from "../entity";
import XY from "../xy";
import Level from "../level";
import { RNG } from "../../lib/rotjs";

export class Lava extends Entity {
  constructor(level: Level, xy: XY) {
    super(level, xy, { ch: "༉", fg: "#e11" });
  }
}

export class Water extends Entity {
  constructor(level: Level, xy: XY) {
    let ch = RNG.getItem("≋≈")
    super(level, xy, { ch, fg: "#44f" });
  }
}

export class Ocean extends Entity {
  constructor(level: Level, xy: XY) {
    let ch = RNG.getItem("༄༅")
    super(level, xy, { ch, fg: "#11d" });
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

