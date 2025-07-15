import { Terrain } from "./entities/terrain";
import XY from "./xy";

export type Bounds = { x: number, y: number, w: number, h: number }

type ConstructorOf<T extends Terrain> = new (...args: any[]) => T;
type IndexedMap = Map<ConstructorOf<Terrain>, Set<Terrain>>
type Only<T extends Terrain> = T

/**
 * Full map of all terrian entities only
 */
export default class WorldMap {
  size: XY;
  private _map: (Only<Terrain> | null)[][]
  private _indexed: IndexedMap = new Map()
  private _ids: Map<number, Terrain>


  constructor(x: number, y: number) {
    this._ids = new Map()
    this.size = new XY(x, y);
    this._map = Array.from(Array(x), () => Array(y).fill(null));
  }


  getById(id: number): Terrain | undefined { return this._ids.get(id) }

  /**
   * Adds terrain to map at the entities position
   * Replaces any existing terrain at that same position
   * Set index to true to index by terrain constructor for getTagged
   */
  set(terrain: Terrain, index: boolean = false): void {
    if (!(terrain instanceof Terrain)) throw new Error("Only instances of Terrain allowed in World map, got " + terrain.constructor.name)

    this.checkBounds(terrain.getXY())
    let { x, y } = terrain.getXY()
    this._map[x][y] = terrain;

    this._ids.set(terrain.id, terrain)

    if (index) {
      let key = terrain.constructor as ConstructorOf<Terrain>
      if (!this._indexed.has(key)) this._indexed.set(key, new Set())
      this._indexed.get(key)!.add(terrain)
    }
  }

  /**
   * Remove terrain from map and and index if set
   */
  remove(terrain: Terrain): void {
    let { x, y } = terrain.getXY()
    this._map[x][y] = null
    this.removeFromIndex(terrain)
    this._ids.delete(terrain.id)
  }

  removeFromIndex(terrain: Terrain): void {
    let key = terrain.constructor as ConstructorOf<Terrain>
    this._indexed.get(key)?.delete(terrain)
  }

  at(xy: XY): Terrain | null;
  at(x: number, y: number): Terrain | null;
  at(xyOrX: XY | number, y?: number): Terrain | null {
    let xy = (typeof xyOrX === "number" && typeof y === "number") ? new XY(xyOrX, y) : xyOrX as XY
    this.checkBounds(xy)
    return this._map[xy.x][xy.y];
  }

  /** 
   * Get non-null entities in bounds
   */
  get(bounds: Bounds | null = null): Terrain[] {
    if (!bounds) bounds = { x: 0, y: 0, w: this.size.x, h: this.size.y }
    return this._map.slice(bounds.x, bounds.x + bounds.w).flatMap(row => row.slice(bounds.y, bounds.y + bounds.h)).filter(terrain => terrain !== null)
  }

  nearest(xy: XY): Terrain[] { return [] }

  getTagged<T extends Terrain>(constructor: ConstructorOf<T>): Set<T> {
    return (this._indexed.get(constructor) || new Set()) as Set<T>;
  }

  private checkBounds({ x, y }: XY): void {
    if (x < 0 || y < 0 || x >= this.size.x || y >= this.size.y) throw `Terrain position (${x}, ${y}) is out of bounds`
  }

}
