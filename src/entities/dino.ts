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

    if (ROT.RNG.getPercentage() > 10) return false

    let dir = ROT.DIRS[4][ROT.RNG.getItem([0, 1, 2, 3]) || 0];
    let target = new XY(dir[0], dir[1])
    let newXY = this.getXY().plus(target);

    let entity_at_xy = this.getLevel().map.at(newXY)
    if (entity_at_xy!.onInteract(this)) {
      this.moveTo(newXY);
    }
    return true;
  }

  moveTo(xy: XY) {
    let oldPos = this.getXY();
    this.getLevel().map.remove(this);
    // TODO need to add layers to map, for now replace with grass
    let fakeUnder = this.getLevel().map.at(xy)
    fakeUnder?.setPosition(oldPos)
    this.getLevel().map.set(fakeUnder);

    this.setPosition(xy)
    this.getLevel().map.set(this, true);

    this.getLevel().draw(oldPos);
    this.getLevel().draw(this);
  }

}



