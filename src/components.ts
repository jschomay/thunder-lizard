import { Types, defineComponent, } from 'bitecs'

/**
 * Component for observing the surrounding world and choosing how to react
 * Different factors effect how "alart" the entity is
 */
export const Awareness = defineComponent({
  cooldown: Types.ui8,// turns until next observation
  reactionTime: Types.ui8, // frequency of observations, 0 observes eery turn, higher numbers skip more turns
  range: Types.ui8, // how far the entity can see
  reactionTimeModifier: Types.i8, // other components can increase or decrease reaction time
  // accuracy: Types.i8, // how correctly entity identifies what it sees
})


/**
 * Component controlling relative "speed" aka frequency of movements
 */
export const Movement = defineComponent({
  cooldown: Types.ui8, // turns until next move
  lag: Types.ui8, // frequency of moves, 0 moves eery turn, higher numbers skip more turns
  lagModifier: Types.i8, // other components can increase or decrease lag
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
  source: [Types.i16, 2], // x,y of source of danger
})
