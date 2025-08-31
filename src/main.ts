import './style.css'
import Game from './game'
import { Howl, Howler, HowlOptions } from 'howler';


const sounds = [

  {
    src: ['bg.mp3'],
    loop: true,
    volume: 0.1
  },
  {
    src: ['steps.mp3'],
    loop: true,
    volume: 0,
    rate: 1.5,
  },
  {
    src: ['drums.mp3'],
    loop: true,
    volume: 0.2,
  },
  {
    src: ['hero.mp3'],
    loop: false,
    volume: 0.2,
  },
  {
    src: ['growl1.mp3'],
    loop: false,
    volume: 0.5,
  },
  {
    src: ['growl2.mp3'],
    loop: false,
    volume: 0.5,
  },
  {
    src: ['growl3.mp3'],
    loop: false,
    volume: 0.8,
  },
  {
    src: ['growl4.mp3'],
    loop: false,
    volume: 0.6,
  },
]

window.addEventListener("load", load);
function load(e) {
  if (e.type !== "load") return

  Promise.all(sounds.map(loadSound))
    // make sure these matcht the order of sounds config
    .then(([bg, steps, drums, hero, growl1, growl2, growl3, growl4]) => {
      document.querySelector("#status")?.classList.add("hidden", "absolute", "top-32", "z-10")
      let g = new Game()
      g.sounds.steps = steps
      g.sounds.drums = drums
      g.sounds.hero = hero
      g.sounds.growl1 = growl1
      g.sounds.growl2 = growl2
      g.sounds.growl3 = growl3
      g.sounds.growl4 = growl4
      g.soundIds.playerSteps = steps.play()
      g.soundIds.other1Steps = steps.play()
      g.soundIds.other2Steps = steps.play()
      steps.seek(0.5, g.soundIds.other1Steps).rate(1.5, g.soundIds.other1Steps)
      steps.seek(1.0, g.soundIds.other2Steps).rate(1, g.soundIds.other2Steps)
      bg.play()
      drums.play()
    })
}


function loadSound(config: HowlOptions): Promise<Howl> {
  return new Promise((resolve, reject) => {
    var sound = new Howl({
      onplayerror: function (id, error) {
        reject(new Error('Error playing sound!' + error))
      },
      onload: function () {
        resolve(sound)
      },
      ...config
    });
  })
}

