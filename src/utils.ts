import * as Terrain from "./entities/terrain";
import MainLevel from "./level";
import XY from "./xy";
import { Bounds } from '../src/dinos.ts'

/**
 * Returns the degrees between two points in terms of a compass
 * Based on a grid with 0,0 in the top left
 * (dur North is 0 degrees, East is 90 degrees, South is 180 degrees, West is 270 degrees)
 * The result will always be expressed as a positive value between 0 and 359
 */
export function angleBetweenPoints(xy1: XY, xy2: XY): number {
  let dx = xy2.minus(xy1).x
  let dy = xy2.minus(xy1).y * -1
  let deg = radiansToDegrees(Math.atan2(dy, dx));
  deg *= -1
  deg += 90
  return (deg < 0) ? deg + 360 : deg
}

export function radiansToDegrees(radians: number): number {
  return radians * 180 / Math.PI;
}

/**
  * Converts angle in degrees to a cardinal direction (N,E,S,W)
  * The angle should match a compass direction (0 is North, 90 is East, etc)
  */
export function angleToCardinalDirection(angle: number): string {
  if (angle < 0) { angle = angle % 360 + 360 }
  const directions = ["N", "E", "S", "W"];
  return directions[Math.round(angle / (360 / 4)) % 4];
}

/**
 * Returns the index for the rotjs DIRS4 matching the cardinal direction
 * rot.js defines DIRS4 as [[0, -1], [1, 0], [0, 1], [-1, 0]]
 * So N = DIRS4[0], E = DIRS4[1], S = DIRS4[2], W = DIRS4[3]
 */
export function cardinalToRotjsDirs4(cardinal: string): number {
  switch (cardinal) {
    case "N": return 0;
    case "E": return 1;
    case "S": return 2;
    case "W": return 3;
    default: throw new Error("Invalid cardinal direction: " + cardinal)
  }
}

/**
 * Returns rotjs DIRS4 index towards xy2 from xy1
 * For example, if xy2 is to the left of xy1, returns 3
 * Based on a grid with 0,0 in the top left
 */
export function relativePosition(from: XY, to: XY) {
  return cardinalToRotjsDirs4(angleToCardinalDirection(angleBetweenPoints(from, to)))
}

/**
 * Same as relativePosition, but without all the math
 * Probably equivelent, but less "correct"
 * For 4-directions this one is fine
 */
export function relativePositionAlternative(xy1: XY, xy2: XY) {
  let dx = Math.abs(xy1.x - xy2.x)
  let dy = Math.abs(xy1.y - xy2.y)
  if (dx > dy) return (xy1.x > xy2.x) ? 3 : 1
  else return (xy1.y > xy2.y) ? 0 : 2
}



/** No dino and no dangerous terrain in target
  */
export function isValidPosition(xy: XY, level: MainLevel) {
  let d = level.dinos.at(xy)
  return !d && isValidTerrain(xy, level)
}

export function isValidTerrain(xy: XY, level: MainLevel) {
  let t = level.map.at(xy)
  return true
    && !(t instanceof Terrain.Ocean)
    && !(t instanceof Terrain.Lava)
}


/**
  * In bounds, exclusive
  */
export function withIn(bounds: Bounds, x: number, y: number) {
  return x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h
}
