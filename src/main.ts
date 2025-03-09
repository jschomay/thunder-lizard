import './style.css'
import Game from './game'



window.addEventListener("load", loadNoMusic);
function loadNoMusic(e) {
  if (e.type !== "load") return
  document.querySelector("p")?.remove()
  new Game()
  return
}


function handleEvent(e: Event) {
  switch (e.type) {
    case "load":
      launch(null).catch((e) => {
        // you can load audio here (with mp3 fallback)
        // don't need for now and might switch to howler anyway
        console.error(e);
        if (e.message.includes("Decoding")) {
          console.error(e)
          launch(null).catch((e) => showError(e.message))
        } else {
          showError(e.message)
        }
      })
  }
  window.removeEventListener("load", handleEvent);
}

function showError(msg) {
  document.body.innerHTML = `
    <p>I'm sorry, there's been some trouble loading the sound file. If you see this, please try running it in a different browser.  Also, you can leave a comment with the error: "${msg}"</p>
    `
}


const audioCtx = new AudioContext();

async function launch(file) {
  return loadFile(file).then((track) => {
    document.querySelector("p")?.remove()
    new Game(() => startBgMusic(track))
  })
}

async function loadFile(filepath) {
  const response = await fetch(filepath);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  return audioBuffer;
}

function playTrack(audioBuffer) {
  const trackSource = audioCtx.createBufferSource();
  trackSource.buffer = audioBuffer;
  trackSource.connect(audioCtx.destination);
  trackSource.start();
  trackSource.loop = true;
  return trackSource;
}

function startBgMusic(track) {
  // Check if context is in suspended state (autoplay policy)
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  playTrack(track);
}
