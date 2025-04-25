import { expect, test } from 'vitest'
import WorldMap from '../src/map'
import XY from '../src/xy'
import * as Terrain from '../src/entities/terrain'
import MainLevel from '../src/level'
import Entity from '../src/entity'

class MockLevel {}


class NotTerrain extends Entity { }
const level = new MockLevel() as MainLevel

test('basic', () => {
  const m = new WorldMap(20, 20)

  // only takes Terrain
  expect(() => m.set(new XY(0, 0))).toThrow('Only instances of Terrain allowed in World map, got XY')
  expect(() => m.set(new NotTerrain(level, new XY(0, 0)))).toThrow('Only instances of Terrain allowed in World map, got NotTerrain')
  // out of range
  expect(() => m.set(new Terrain.Water(level, new XY(30, 0)))).toThrow('Terrain position (30, 0) is out of bounds')
  expect(m.get()).toHaveLength(0)

  const water = new Terrain.Water(level, new XY(0, 0))
  const lava = new Terrain.Lava(level, new XY(1, 0))
  m.set(water)
  m.set(lava, true) // indexed

  // getting
  expect(m.get()).toHaveLength(2)
  m.set(water) // replaces water in same posiion
  m.set(water) // replaces water in same posiion
  m.set(water) // replaces water in same posiion
  expect(m.get()).toHaveLength(2)
  const entitiesInViewport = m.get({ x: 1, y: 0, w: 10, h: 10 })
  const entitiesInViewport2 = m.get({ x: 2, y: 0, w: 10, h: 10 })
  expect(entitiesInViewport).toHaveLength(1)
  expect(entitiesInViewport2).toHaveLength(0)
  expect(entitiesInViewport[0]).toBe(lava)
  expect(m.at(new XY(1, 0))).toBe(lava)
  expect(m.at(1, 0)).toBe(lava)
  expect(m.at(new XY(9, 9))).toBe(null)
  expect(() => m.at(new XY(30, 0))).toThrow('Terrain position (30, 0) is out of bounds')

  // indexes
  expect(m.getTagged(Terrain.Lava).size).toBe(1)
  expect(m.getTagged(Terrain.Lava).has(lava)).toBe(true)
  expect(m.getTagged(Terrain.Lava).has(water)).toBe(false)
  expect(m.getTagged(Terrain.Water).size).toBe(0)

  // removing
  expect(m.get()).toHaveLength(2)
  m.remove(lava)
  expect(m.get()).toHaveLength(1)
  expect(m.getTagged(Terrain.Lava).size).toBe(0)
})

