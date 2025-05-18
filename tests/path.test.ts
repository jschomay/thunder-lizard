import { expect, test } from 'vitest'
import Path from '../src/systems/path'
import { Pursue } from '../src/components'


test('path', () => {
  let eid = 1
  Path.init(eid)
  expect(Path.length(eid)).toBe(0)
  expect(Path.length(999)).toBe(0)

  Path.push(eid, 0, 0)
  Path.push(eid, 0, 1)
  Path.push(eid, 1, 1)
  expect(Path.length(eid)).toBe(3)
  expect(Path.current(eid)).toEqual([0, 0])

  Path.advance(eid)
  expect(Path.length(eid)).toBe(2)
  expect(Path.current(eid)).toEqual([0, 1])
  Path.advance(eid)
  expect(Path.length(eid)).toBe(1)
  expect(Path.current(eid)).toEqual([1, 1])

  // diagonals
  Path.push(eid, 2, 2)
  expect(Path.length(eid)).toBe(2)
  expect(Path.current(eid)).toEqual([1, 1])

  // reset
  Path.init(eid)
  expect(Path.length(eid)).toBe(0)
  expect(Pursue.offset[eid]).toBe(0)
})
