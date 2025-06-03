import { Types, defineComponent, } from 'bitecs'

/**
 * Component for observing the surrounding world and choosing how to react
 * Different factors effect how "alart" the entity is
 */
export const Awareness = defineComponent({
  range: Types.ui8, // how far the entity can see
  turnsSinceLastObserve: Types.ui8,
  turnsToSkip: Types.ui8, // turns to skip, 0 observes every turn
  accuracy: Types.i8, // percentage how correctly entity identifies what it sees
})

export const Stunned = defineComponent({
  duration: Types.ui8, // number of turns until Awareness happens
})


/**
 * Component controlling relative "speed" aka frequency of movements
 */
export const Movement = defineComponent({
  turnsSinceLastMove: Types.ui8, // turns until next move
  frequency: Types.ui8, // frequency of moves, 0 moves eery turn, higher numbers skip more turns
})


export const MAX_PATH_LENGTH = 32
/**
 * Component tracking movement towards a target
 */
export const Pursue = defineComponent({
  target: Types.eid, // id of dino prey
  // can't store nested arrays or objects (unless upgrading to bitECS 4.0)
  // must use Int16Array, which doesn't have length/push/shift
  // so storing flattened path w/ offset, all logic to handle is in system
  path: [Types.i16, MAX_PATH_LENGTH], // flattened path like [x1,y1, x2,y2, ...]
  offset: Types.ui8, // current progress down path
})


/**
 * flee
 */
export const Flee = defineComponent({
  source: Types.ui8, // rotjs DIR to run from
})


/**
 * Component for the player
 * Holds pressed direction keys to control movement at the right speed
 */
export const Controlled = defineComponent({
  pressed: Types.ui8, // byte array of keys on/off
})
