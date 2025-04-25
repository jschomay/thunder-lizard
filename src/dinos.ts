import { Quadtree, Circle, Rectangle, QuadtreeProps } from "@timohausmann/quadtree-ts";
import Dino from "./entities/dino";
import XY from "./xy";
import { MAP_SIZE } from "./constants";

export type Bounds = { x: number, y: number, w: number, h: number }

/**
 * Performant indexes of all dino entities
 */
export default class Dinos {

  private _qt: Quadtree<Dino>
  private _index: Map<string, Dino>

  constructor(qtProps: Partial<QuadtreeProps> = {}) {
    this._qt = new Quadtree<Dino>({
      width: MAP_SIZE,
      height: MAP_SIZE,
      x: 0,
      y: 0,
      maxObjects: 30,
      maxLevels: 8
      , ...qtProps
    });

    this._index = new Map()
  }

  at(xy: XY): Dino | null;
  at(x: number, y: number): Dino | null;
  at(xyOrX: XY | number, y?: number): Dino | null {
    let xy = (typeof xyOrX === "number" && typeof y === "number") ? new XY(xyOrX, y) : xyOrX as XY
    return this._index.get(xy.toString()) || null
  }

  add(e: Dino) {
    this._qt.insert(e);
    this._index.set(e.getXY().toString(), e)
  }

  remove(e: Dino) {
    this._qt.remove(e);
    this._index.delete(e.getXY().toString())
  }

  /**
   * Returns a list of nearest dinos, sorted by distance
   */
  nearest(xy: XY): Dino[] {
    let found = this._qt.retrieve(new Circle({ x: xy.x, y: xy.y, r: 1 }));
    return found.sort((a, b) => a.getXY().dist(xy) - b.getXY().dist(xy))
  }

  /**
    * In bounds, exclusive
    */
  withIn(bounds: Bounds) {
    const r = new Rectangle({
      x: bounds.x,
      y: bounds.y,
      width: bounds.w,
      height: bounds.h
    })
    return this._qt.retrieve(r).filter((e: Dino) => {
      const { x, y } = e.getXY()
      return x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h
    })
  }
}
