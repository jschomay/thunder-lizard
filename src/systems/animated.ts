import { Quadtree, Circle, Rectangle } from "@timohausmann/quadtree-ts";
import Entity from "../entity";
import { MAP_SIZE } from "../constants";
import { RNG } from "../../lib/rotjs";

const _qt = new Quadtree<Circle<Entity>>({
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
    animated.data!.flow() // TODO use component instead of class function
  }
}

export const add = (e: Entity) => {
  let { x, y } = e.getXY()
  const circle = new Circle<Entity>({
    x: x,
    y: y,
    r: 1,
    data: e
  })
  _qt.insert(circle);
}

export const remove = (e: Entity) => {
  let { x, y } = e.getXY()
  const circle = new Circle<Entity>({
    x: x,
    y: y,
    r: 1,
    data: e
  })
  _qt.remove(circle);
}
