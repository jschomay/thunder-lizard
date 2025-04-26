import { expect, test } from 'vitest'
import XY from '../src/xy'
import * as utils from '../src/utils'



test('radiansToDegrees', () => {
  expect(utils.radiansToDegrees(0)).toBe(0)
  expect(utils.radiansToDegrees(Math.PI)).toBe(180)
  expect(utils.radiansToDegrees(Math.PI / 2)).toBe(90)
  expect(utils.radiansToDegrees(Math.PI / 4)).toBe(45)
})

test('angleBetweenPoints', () => {
  expect(utils.angleBetweenPoints(new XY(0, 0), new XY(1, 0))).toBe(90)
  expect(utils.angleBetweenPoints(new XY(0, 0), new XY(100, 0))).toBe(90)
  expect(utils.angleBetweenPoints(new XY(1, 0), new XY(0, 0))).toBe(270)
  expect(utils.angleBetweenPoints(new XY(10, 0), new XY(1, 0))).toBe(270)

  // our xy grid is flipped (higher is lower on screen)
  expect(utils.angleBetweenPoints(new XY(10, 10), new XY(10, 5))).toBe(0)
  expect(utils.angleBetweenPoints(new XY(10, 10), new XY(10, 15))).toBe(180)

  expect(utils.angleBetweenPoints(new XY(0, 1), new XY(1, 0))).toBe(45)
  expect(utils.angleBetweenPoints(new XY(0, 0), new XY(1, 1))).toBe(90 + 45)

  expect(utils.angleBetweenPoints(new XY(10, 10), new XY(0, 0))).toBe(360 - 45)
})

test('angleToCardinal', () => {
  expect(utils.angleToCardinalDirection(0)).toBe('N')
  expect(utils.angleToCardinalDirection(90)).toBe('E')
  expect(utils.angleToCardinalDirection(180)).toBe('S')
  expect(utils.angleToCardinalDirection(270)).toBe('W')

  expect(utils.angleToCardinalDirection(2)).toBe('N')
  expect(utils.angleToCardinalDirection(44)).toBe('N')
  expect(utils.angleToCardinalDirection(45)).toBe('E')

  expect(utils.angleToCardinalDirection(180 - 20)).toBe('S')
  expect(utils.angleToCardinalDirection(180 + 20)).toBe('S')
  expect(utils.angleToCardinalDirection(180 - 50)).toBe('E')
  expect(utils.angleToCardinalDirection(180 + 50)).toBe('W')

  expect(utils.angleToCardinalDirection(270 - 20)).toBe('W')
  expect(utils.angleToCardinalDirection(270 + 20)).toBe('W')
  expect(utils.angleToCardinalDirection(270 - 50)).toBe('S')
  expect(utils.angleToCardinalDirection(270 + 50)).toBe('N')

  expect(utils.angleToCardinalDirection(315)).toBe('N')
  expect(utils.angleToCardinalDirection(314)).toBe('W')

  expect(utils.angleToCardinalDirection(360 + 90)).toBe('E')
  expect(utils.angleToCardinalDirection(360 * 10 + 90)).toBe('E')

  expect(utils.angleToCardinalDirection(-90)).toBe('W')
  expect(utils.angleToCardinalDirection(-360 * 10 - 90)).toBe('W')
})

test('relativePosition', () => {
  // rotjs dirs: N = DIRS4[0], E = DIRS4[1], S = DIRS4[2], W = DIRS4[3]
  expect(utils.relativePosition(new XY(5, 5), new XY(5, 1))).toBe(0)
  expect(utils.relativePosition(new XY(5, 5), new XY(10, 5))).toBe(1)
  expect(utils.relativePosition(new XY(5, 5), new XY(5, 15))).toBe(2)
  expect(utils.relativePosition(new XY(5, 5), new XY(1, 5))).toBe(3)

  // SE, more E
  expect(utils.relativePosition(new XY(5, 5), new XY(20, 15))).toBe(1)
  // SE, more S
  expect(utils.relativePosition(new XY(5, 5), new XY(15, 20))).toBe(2)
})
