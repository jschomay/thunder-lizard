import * as ROT from "../../lib/rotjs";
import Entity from "../entity";
import XY from "../xy";
import Level from "../level";
import { SpeedActor } from "../../lib/rotjs";

export default class Dino extends Entity implements SpeedActor {
  constructor(level: Level, xy: XY) {
    super(level, xy, { ch: "𑿋", fg: "lightgrey" });
  }

  getSpeed() {
    return 1;
  }

  act() {
    //TODO
    // just moves randomly for now

    if (ROT.RNG.getPercentage() > 10) return false

    let dir = ROT.DIRS[4][ROT.RNG.getItem([0, 1, 2, 3]) || 0];
    let target = new XY(dir[0], dir[1])
    let newXY = this.getXY().plus(target);
    this.moveTo(newXY);
    return true;
  }

  moveTo(xy: XY) {
    this.getLevel().dinos.remove(this);
    this.setPosition(xy)
    this.getLevel().dinos.add(this);
  }

}



