import { expect, test } from 'vitest'
import Dinos from '../src/dinos'
import XY from '../src/xy'
import MainLevel from '../src/level'
import Dino from '../src/entities/dino'


class MockLevel { }
const level = new MockLevel() as MainLevel

test('basic', () => {
  let dinos = new Dinos({
    width: 10,
    height: 1,
    maxObjects: 2,
  })
  expect(dinos.at(0, 0)).toBe(null)
  expect(dinos.nearest(new XY(0, 0))).toEqual([])

  // sets

  const d1 = new Dino(level, new XY(0, 0), 1)
  const d2 = new Dino(level, new XY(9, 0), 2)
  const d3 = new Dino(level, new XY(8, 0), 3)
  dinos.add(d1)
  dinos.add(d2)

  expect(dinos.get(1)).toBe(d1)
  expect(dinos.at(0, 0)).toBe(d1)

  // nearest sorts for you
  expect(dinos.nearest(new XY(0, 0))).toEqual([d1, d2])
  expect(dinos.nearest(new XY(10, 0))).toEqual([d2, d1])

  // removeals
  dinos.remove(d1)
  expect(dinos.get(1)).toBeUndefined()
  expect(dinos.at(0, 0)).toBeNull(0)
  expect(dinos.nearest(new XY(0, 0))).toEqual([d2])

  dinos.add(d1)

  // maxObjects is respected
  dinos.add(d3)
  expect(dinos.nearest(new XY(0, 0)).length).toEqual(1)
  expect(dinos.nearest(new XY(10, 0)).length).toEqual(2)
  // on the border
  expect(dinos.nearest(new XY(5, 0)).length).toEqual(3)

  expect(dinos.withIn({ x: 0, y: 0, w: 10, h: 1 }).length).toEqual(3)

  // updates

  dinos.remove(d1)
  d1.setPosition(new XY(10, 0))
  dinos.add(d1)

  expect(dinos.withIn({ x: 0, y: 0, w: 5, h: 1 }).length).toEqual(0)
  expect(dinos.withIn({ x: 5, y: 0, w: 5, h: 1 }).length).toEqual(3)

  expect(dinos.at(0, 0)).toBe(null)
  expect(dinos.at(10, 0)).toBe(d1)
})
