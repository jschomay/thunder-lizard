import * as ROT from "../lib/rotjs"
import MainLevel from "./level"
import StartScreen from "./start-screen"
import XY from "./xy";
import { fal } from "@fal-ai/client";

fal.config({
  credentials: "KEYHERE",
});


let throttle = 0
let sourceCanvas, targetCanvas, preview
const scaledCanvas = document.createElement("canvas");
const scaledCanvasCtx = scaledCanvas.getContext("2d");
scaledCanvas.width = 512;
scaledCanvas.height = 512;

export default class Game {
  level: MainLevel | StartScreen;
  display: ROT.Display;
  HANDLED_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "w", "a", "s", "d", "Enter", "Escape", " "];
  aiRenderCanvas: HTMLCanvasElement | null = null
  _container: HTMLCanvasElement

  constructor() {
    window.addEventListener("resize", () => {
      this.updateSize(this.level.getSize())
    })
    this.display = new ROT.Display({
      forceSquareRatio: true,
      fontFamily: "Sans-serif",
      bg: "#111",
      spacing: 0.9
    });
    this._container = this.display.getContainer() as HTMLCanvasElement
    this._container.classList.add("w-[512px]", "h-[512px]")
    document.body.appendChild(this._container);

    // TODO only for debugging
    // let level = new MainLevel(this);
    let level = new StartScreen(this);
    this.switchLevel(level);

    window.addEventListener("keydown", this.onKeyDown.bind(this));
    window.addEventListener("keyup", this.onKeyUp.bind(this));
    if (this.detectMobile()) {
      this._container.addEventListener("touchstart", this.onClick.bind(this));
    }

    this.aiRenderCanvas = this._container.cloneNode() as HTMLCanvasElement
    this.aiRenderCanvas.className = this._container.className
    this.aiRenderCanvas.width = 512
    this.aiRenderCanvas.height = 512
    this._container.after(this.aiRenderCanvas);
    sourceCanvas = this._container
    targetCanvas = this.aiRenderCanvas
    preview = new Image();
    // this._container.after(preview);
  }



  postprocess() {
    throttle++
    if (throttle < 2) {
      return
    }
    throttle = 0
    // if (this.done) return
    // this.done = true

    if (!this._container) return
    // TODO the window.devicePixelRatio is 2 so this is 1024 instead of 512
    scaledCanvasCtx.drawImage(this._container, 0, 0, 512, 512);
    const dataURL = scaledCanvas.toDataURL();
    renderFrame(dataURL)
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

  public onKeyUp(e: KeyboardEvent) {
    if (this.HANDLED_KEYS.includes(e.key)) { e.preventDefault(); }
    this.level.onKeyUp(e);
  }

  updateSize(size: XY) {
    const scalar = 1.1
    let h = this._container.parentElement!.offsetHeight
    let fs = scalar * h / size.y
    this.display.setOptions({
      width: size.x,
      height: size.y,
      fontSize: fs
    });
  }


  switchLevel(level: MainLevel | StartScreen): void {
    this.level = level;
    let size = level.getSize();
    this.updateSize(size)

    if (level instanceof MainLevel) {

      if (this.detectMobile()) {
        let pauseButtonEl = document.getElementById("pause")!
        pauseButtonEl.style.display = "block"
        pauseButtonEl.addEventListener("touchstart",
          () => this.onKeyDown(new KeyboardEvent("keydown", { 'key': 'p', keyCode: 80 })))

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


// ws approach (doesn't work with lcm-sd15-i2i model though)
const connection = fal.realtime.connect("fal-ai/fast-lcm-diffusion/image-to-image", {
  onResult: (result) => {
    // console.log(result);
    const bytes = result.images[0].content
    const type = result.content_type; // "image/jpeg"
    const blob = new Blob([bytes], { type });
    createImageBitmap(blob).then(bitmap => {
      const ctx = targetCanvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
    });
    // alternate way
    // const url = URL.createObjectURL(blob);
    // preview.onload = () => {
    //   const ctx = targetCanvas.getContext("2d")!;
    //   ctx.drawImage(preview, 0, 0, 512, 512);
    //   // cleanup the temp URL once drawn
    //   // URL.revokeObjectURL(url);
    // };
    // preview.src = url;
  },
  onError: (error) => {
    console.error(error);
  }
});

function renderFrame(imageData: string) {
  // console.log(imageData)
  // set imageData to preview img element
  connection.send({
    model_name: "runwayml/stable-diffusion-v1-5",
    prompt: "top down, rpg terrain map for a game set in prehistoric times. red is lava, blue is water, green is grass / trees, crosses are dinosaurs",
    image_url: imageData,
    strength: 0.5,
    negative_prompt: "cartoon, illustration, animation. face. male, female",
    seed: 4097380,
    guidance_scale: 0,
    num_inference_steps: 4,
    num_images: 1,
    enable_safety_checks: false,
    sync_mode: true,
    "image_size": {
      "width": 512,
      "height": 512
    }
  });
}



// async function renderFrame(inputImageData: string) {
//   const result = await fal.subscribe("fal-ai/lcm-sd15-i2i", {
//     input: {
//       prompt: "top down, rpg terrain map for a game set in prehistoric times. red is lava, blue is water, green is grass / trees, crosses are dinosaurs",
//       image_url: inputImageData,
//       strength: 0.5,
//       negative_prompt: "cartoon, illustration, animation. face. male, female",
//       seed: 4097380,
//       guidance_scale: 0,
//       num_inference_steps: 4,
//       num_images: 1,
//       enable_safety_checks: false,
//       sync_mode: true
//     },
//     logs: true,
//     onQueueUpdate: (update) => {
//       if (update.status === "IN_PROGRESS") {
//         update.logs.map((log) => log.message).forEach(console.log);
//       }
//     },
//   });
//   // console.log(result.data);
//   const outputImageDataUrl = result.data.images[0].url
//   preview.onload = () => {
//     const ctx = targetCanvas.getContext("2d")!;
//     ctx.drawImage(preview, 0, 0);
//     // cleanup the temp URL once drawn
//     // URL.revokeObjectURL(url);
//   };
//   preview.src = outputImageDataUrl;
// }
