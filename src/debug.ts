import MainLevel from "./level"
import XY from "./xy"

export const DEBUG = 1
export function debug(level: MainLevel) {
  // level.player.setPosition(new XY(99, 30))


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

  let originalSize = level.getSize()
  let originalOffset = level._viewportOffset
  let zoomedOut = false
  window.addEventListener("keydown", (e) => {
    if (e.key === "0") {
      if (zoomedOut) {
        level._viewportSize = originalSize
        level._viewportOffset = originalOffset
      } else {
        level._viewportSize = level.map.size
        level._viewportOffset = new XY(0, 0)
      }
      zoomedOut = !zoomedOut
      let size = level.getSize();
      level.game.display.setOptions({ width: size.x, height: size.y });
      level.drawMap()
    } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      if (e.key === "ArrowUp") level._viewportOffset.y--
      if (e.key === "ArrowDown") level._viewportOffset.y++
      if (e.key === "ArrowLeft") level._viewportOffset.x--
      if (e.key === "ArrowRight") level._viewportOffset.x++
      level.drawMap()
    }
  })
}


