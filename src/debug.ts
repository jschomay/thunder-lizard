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

  window.dinos = level.dinos

  // inspect helpers
  window._at = (x, y) => level.map.at(new XY(x, y))
  level.game._container.addEventListener("click", e => {
    let xy = new XY(...level.game.display.eventToPosition(e)).plus(level.viewportOffset)
    let terrain = level.map.at(xy)
    let dino = level.dinos.at(xy)
    if (dino) {
      console.log(dino, getEntityComponents(level.ecsWorld, dino.id).reduce((acc: any[], c) => {
        acc.push(Object.entries(c).flatMap(([k, v]) => `${k}: ${v[dino.id]}`).join(", "))
        return acc
      }, []))
    } else if (terrain) {
      console.log(terrain)
    }
  })

  window.addEventListener("keydown", (e) => {
  })
}

export function debugLogNoisy(...args: any[]) {
  if (DEBUG >= 2) console.log(...args)
}

export function debugLog(...args: any[]) {
  if (DEBUG >= 1) console.log(...args)
}
