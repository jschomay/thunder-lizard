import { getEntityComponents } from "bitecs"
import MainLevel from "./level"
import XY from "./xy"
import { FPS } from 'yy-fps'

export const DEBUG = 1
export function debug(level: MainLevel) {
  // level.player.setPosition(new XY(99, 30))


  const fps = new FPS({ meter: true, stylesFPS: { 'fontSize': '10px' }, meterLineHeight: 1 })
  function updateFPS() {
    fps.frame()
    requestAnimationFrame(updateFPS)
  }
  updateFPS()

  // inspect helpers
  window._at = (x, y) => level.map.at(new XY(x, y))
  level.game._container.addEventListener("click", e => {
    let xy = new XY(...level.game.display.eventToPosition(e)).plus(level.viewportOffset)
    let terrain = level.map.at(xy)
    let dino = level.dinos.at(xy)
    if (dino) {
      console.log(dino, getEntityComponents(level.ecsWorld, dino.id).reduce((acc, c) => {
        let componentClassName = c.constructor.name
        return acc[componentClassName] = [...Object.entries(c).flatMap(([k, v]) => [k, v[dino.id]])]
      }, {}))
    } else if (terrain) {
      console.log(terrain)
    }
  })

  window.addEventListener("keydown", (e) => {
  })
}

export function debugLog(...args: any[]) {
  if (DEBUG > 1) console.log(...args)
}
