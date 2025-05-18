import { Pursue, MAX_PATH_LENGTH } from "../components"

export default { init, length: length, push, current: current, advance }

function init(eid: number) {
  Pursue.path[eid] = (new Int16Array(MAX_PATH_LENGTH)).fill(-1)
  Pursue.offset[eid] = 0
}

function length(eid: number) {
  let l = Pursue.path[eid].indexOf(-1)
  return l === -1 ? 0 : (l - Pursue.offset[eid]) / 2
}

function push(eid: number, x: number, y: number) {
  let path = Pursue.path[eid]
  let endOfPath = Pursue.path[eid].indexOf(-1)
  path[endOfPath] = x
  path[endOfPath + 1] = y
}

function current(eid: number): [number, number] {
  return [
    Pursue.path[eid][Pursue.offset[eid]],
    Pursue.path[eid][Pursue.offset[eid] + 1]
  ]
}

function advance(eid: number) {
  Pursue.offset[eid] += 2
}
