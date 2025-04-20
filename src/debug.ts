import MainLevel from "./level"
import XY from "./xy"
import { FPS } from 'yy-fps'

export const DEBUG = 1
export function debug(level: MainLevel) {
  // level.player.setPosition(new XY(99, 30))


  const fps = new FPS({meter: true, stylesFPS: {'fontSize': '10px'}, meterLineHeight: 1})
  function updateFPS() {
    fps.frame()
    requestAnimationFrame(updateFPS)
  }
  updateFPS()

  // inspect helpers
  window._at = (x, y) => level.map.at(new XY(x, y))
  level.game._container.addEventListener("click", e => console.log(level.map.at(new XY(...level.game.display.eventToPosition(e)))))
  level.game._container.addEventListener("click", e => {
    let xy = new XY(...level.game.display.eventToPosition(e))
    let oldXy = level.player.getXY()
    level.player.setPosition(xy)
    level.draw(oldXy)
    level.draw(xy)
    level.updateFOV()
  }
  )

  window.addEventListener("keydown", (e) => {
  })
}


