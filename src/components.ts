import { Types, defineComponent, } from 'bitecs'

/**
 * Component for observing the surrounding world and choosing how to react
 * Different factors effect how "alart" the entity is
 */
export const Awareness = defineComponent({
  cooldown: Types.ui8,// turns until next observation
  responsiveness: Types.ui8, // frequency of observations, 0 is base line, higher numbers are less frequent
  range: Types.ui8, // how far the entity can see
  // accuracy: Types.i8, // how correctly entity identifies what it sees
})
