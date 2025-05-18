import { expect, test } from 'vitest'
import { Awareness, Flee, Pursue } from '../src/components';
import { addComponent, addEntity, createWorld, hasComponent, removeComponent, removeEntity } from 'bitecs';

test('removing component behavior', () => {
  const world = createWorld()
  let eid = addEntity(world)
  expect(hasComponent(world, Awareness, eid)).toBe(false)
  // default exists for eid even when never added
  expect(Awareness.turnsToSkip[eid]).toBe(0)
  expect(() => removeComponent(world, Awareness, eid)).not.toThrow()
  addComponent(world, Awareness, eid)
  Awareness.turnsToSkip[eid] = 1
  expect(Awareness.turnsToSkip[eid]).toBe(1)
  removeComponent(world, Awareness, eid)
  // default still exists for eid after removed
  expect(Awareness.turnsToSkip[eid]).toBe(0)

  expect(hasComponent(world, Awareness, eid)).toBe(false)
  removeEntity(world, eid)
  expect(hasComponent(world, Awareness, eid)).toBe(false)
})
