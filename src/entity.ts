import XY from './xy'
import Level from './level'

export type Visual = { ch: string, fg: string };
export type EntityConstructor = new (level: Level, xy: XY) => Entity
export interface Actor {
  act(): void
}


export default class Entity {
  private _visual: Visual;
  private _xy: XY;
  private _level: Level;

  constructor(level: Level, xy: XY, visual: Visual = { ch: "!", fg: "red" }) {
    this._level = level
    this._xy = xy
    this._visual = visual
  }

  setVisual(visual: { ch?: string, fg?: string }) {
    this._visual = { ...this._visual, ...visual };
  }

  getVisual() { return this._visual; }
  getXY() { return this._xy; }
  getLevel() { return this._level; }

  setPosition(xy: XY) {
    this._xy = xy;
    return this;
  }

  remove() {
    // TODO
  }
  /**
   * Perform side effects and return true if the iterating entity can move here
   */
  onInteract(entity: Entity) { return true; }
}
