import * as ROT from "../lib/rotjs"
import Scheduler from "../lib/rotjs/scheduler/speed"
import EndScreen from "./end-screen";
import MainLevel from "./level"
import StartScreen from "./start-screen"
import XY from "./xy";

export default class Game {
  scheduler: Scheduler;
  engine: ROT.Engine;
  level: MainLevel | StartScreen;
  display: ROT.Display;
  HANDLED_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "w", "a", "s", "d", "Enter", "Escape", " "];

  _container: HTMLElement

  constructor() {
    this.scheduler = new ROT.Scheduler.Speed();
    this.engine = new ROT.Engine(this.scheduler);
    const scalar = 100
    let fontSize = window.innerWidth / scalar;
    window.addEventListener("resize", () => {
      fontSize = window.innerWidth / scalar;
      this.display.setOptions({ fontSize });
    })
    this.display = new ROT.Display({ fontSize });
    this._container = this.display.getContainer()!
    this._container.classList.add("max-h-screen", "max-w-full", "scale-y-90")
    document.body.appendChild(this._container);

    // TODO only for debugging
    let level = new MainLevel(this);
    // let level = new StartScreen(this);
    this.level = level;
    this.switchLevel(level);
    this.engine.start();

    window.addEventListener("keydown", this.onKeyDown.bind(this));
    if (this.detectMobile()) {
      this._container.addEventListener("touchstart", this.onClick.bind(this));
    }
  }

  detectMobile() {
    return (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
  }


  // for mobile
  public onClick(e: Event) {
    this.level.onClick(e)
  }

  public onKeyDown(e: KeyboardEvent) {
    if (this.HANDLED_KEYS.includes(e.key)) { e.preventDefault(); }
    this.level.onKeyDown(e);
  }


  switchLevel(level: MainLevel | StartScreen | EndScreen): void {
    this.level = level;
    let size = level.getSize();
    this.display.setOptions({ width: size.x, height: size.y, forceSquareRatio: false });

    if (level instanceof MainLevel) {

      if (this.detectMobile()) {
        let dirInput = null;
        let id = null;
        let move = () => {
          switch (dirInput) {
            case "up": this.onKeyDown(new KeyboardEvent("keydown", { 'key': 'ArrowUp', keyCode: 38 })); break;
            case "down": this.onKeyDown(new KeyboardEvent("keydown", { 'key': 'ArrowDown', keyCode: 40 })); break;
            case "left": this.onKeyDown(new KeyboardEvent("keydown", { 'key': 'ArrowLeft', keyCode: 37 })); break;
            case "right": this.onKeyDown(new KeyboardEvent("keydown", { 'key': 'ArrowRight', keyCode: 39 })); break;
          }
        }

        let virtualJoystickEl = document.getElementById("virtual-joystick")!
        virtualJoystickEl.style.display = "flex"
        virtualJoystickEl.addEventListener("touchstart", (e) => {
          dirInput = e.target?.id
          move()
          id = setInterval(move, 200)
        })
        virtualJoystickEl.addEventListener("touchend", (e) => {
          dirInput = null
          clearInterval(id)
        })
      }
    }
  }
}
