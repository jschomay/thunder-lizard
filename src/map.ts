import Entity from "./entity";
import XY from "./xy";
import * as Terrain from "./entities/terrain";

export type Bounds = { x: number, y: number, w: number, h: number }

type EntityConstructor<T extends Entity> = new (...args: any[]) => T;
type IndexedMap = Map<EntityConstructor<Entity>, Set<Entity>>

export default class WorldMap {
  size: XY;
  private _map: (Entity | null)[][]
  private _indexed: IndexedMap = new Map()


  constructor(x: number, y: number) {
    this.size = new XY(x, y);
    this._map = Array.from(Array(x), () => Array(y).fill(null));
  }


  /**
   * Adds entity to map at the entities position
   * Replaces any existing entity at that same position
   * Set index to true to index by entity constructor for getTagged
   */
  set(entity: Entity, index: boolean = false): void {
    // TODO set "layers" that are spacially indexed
    this.checkBounds(entity.getXY())
    let { x, y } = entity.getXY()
    this._map[x][y] = entity;

    if (index) {
      let key = entity.constructor as EntityConstructor<Entity>
      if (!this._indexed.has(key)) this._indexed.set(key, new Set())
      this._indexed.get(key)!.add(entity)
    }
  }

  /**
   * Remove entity from map and and index if set
   */
  remove(entity: Entity): void {
    let { x, y } = entity.getXY()
    this._map[x][y] = null
    this.removeFromIndex(entity)
  }

  removeFromIndex(entity: Entity): void {
    let key = entity.constructor as EntityConstructor<Entity>
    this._indexed.get(key)?.delete(entity)
  }

  at(xy: XY): Entity | null;
  at(x: number, y: number): Entity | null;
  at(xyOrX: XY | number, y?: number): Entity | null {
    let xy = (typeof xyOrX === "number" && typeof y === "number") ? new XY(xyOrX, y) : xyOrX as XY
    this.checkBounds(xy)
    return this._map[xy.x][xy.y];
  }

  /** 
   * Get non-null entities in bounds
   */
  get(bounds: Bounds | null = null): Entity[] {
    if (!bounds) bounds = { x: 0, y: 0, w: this.size.x, h: this.size.y }
    return this._map.slice(bounds.x, bounds.x + bounds.w).flatMap(row => row.slice(bounds.y, bounds.y + bounds.h)).filter(entity => entity !== null)
  }

  nearest(xy: XY): Entity[] { return [] }

  getTagged<T extends Entity>(constructor: EntityConstructor<T>): Set<T> {
    return (this._indexed.get(constructor) || new Set()) as Set<T>;
  }

  private checkBounds({ x, y }: XY): void {
    if (x < 0 || y < 0 || x >= this.size.x || y >= this.size.y) throw `Entity position (${x}, ${y}) is out of bounds`
  }

}
