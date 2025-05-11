import { expect, test } from 'vitest'
import Path from '../src/systems/path'


test('path', () => {
  let eid = 1
  Path.init(eid)
  expect(Path.length(eid)).toBe(0)
  expect(Path.length(999)).toBe(0)

  Path.push(eid, 0, 0)
  Path.push(eid, 0, 1)
  expect(Path.length(eid)).toBe(2)
  expect(Path.current(eid)).toEqual([0, 0])

  Path.advance(eid)
  expect(Path.current(eid)).toEqual([0, 1])
})
