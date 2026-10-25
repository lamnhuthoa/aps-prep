// Runs Kokoro-82M (8-bit, onnxruntime-web on WebAssembly) off the main thread: text in, 16-bit audio out. Everything it loads comes
// from vendor/tts/ of this site; nothing is sent anywhere.
import { KokoroTTS, env } from "./vendor/tts/kokoro.web.js";

const base = new URL("./vendor/tts/", import.meta.url).href;
globalThis.APS_TTS_HOST = new URL("models/", base).href;
env.wasmPaths = base;

let tts = null;
const post = (message, transfer = []) => self.postMessage(message, transfer);

async function init() {
  tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
    dtype: "q8",
    device: "wasm",
    progress_callback: (p) => { if (p.status === "progress") post({ type: "progress", file: p.file, loaded: p.loaded, total: p.total }); },
  });
  post({ type: "ready" });
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === "init") {
      await init();
    } else if (data.type === "say") {
      const audio = await tts.generate(data.text, { voice: data.voice, speed: 1 });
      const samples = audio.audio;
      const pcm = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i += 1) pcm[i] = Math.max(-1, Math.min(1, samples[i])) * 32767;
      post({ type: "audio", id: data.id, pcm, rate: audio.sampling_rate }, [pcm.buffer]);
    }
  } catch (error) {
    post({ type: "error", id: data.id, message: String((error && error.message) || error) });
  }
};
