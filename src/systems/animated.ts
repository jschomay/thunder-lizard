import { Quadtree, Rectangle } from "@timohausmann/quadtree-ts";
import Entity from "../entity";
import { MAP_SIZE } from "../constants";
import { RNG } from "../../lib/rotjs";

const _qt = new Quadtree<Entity>({
  width: MAP_SIZE,
  height: MAP_SIZE,
  x: 0,
  y: 0,
  maxObjects: 30,
  maxLevels: 8
});

export const run = (bounds: Rectangle) => {
  for (let animated of _qt.retrieve(bounds)) {
    if (RNG.getUniform() < 0.9) continue
    animated.flow() // TODO use component instead of class function
  }
}

export const add = (e: Entity) => {
  _qt.insert(e);
}

export const remove = (e: Entity) => {
  _qt.remove(e);
}
