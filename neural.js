/* An optional, better English voice for the podcast: Kokoro-82M runs in a Web Worker on the device, and the audio of every
   sentence is kept in IndexedDB, so a sentence is generated once and then plays at once (also offline). The generation is slower
   than the speech (about 2 to 3.5 times its length on a laptop), so the podcast asks for sentences ahead of the one it is
   reading and uses the voice of the browser for a sentence that is not ready. */
(function () {
  "use strict";
  const DB_NAME = "aps-prep-voice";
  const STORE = "audio";
  const SIZE_KEY = "\u0000size"; // the bytes of audio kept, stored beside the sentences
  const VOICES = [
    ["af_heart", "Heart (nữ, giọng Mỹ)"],
    ["bf_emma", "Emma (nữ, giọng Anh)"],
    ["am_michael", "Michael (nam, giọng Mỹ)"],
  ];
  const SCRIPT_URL = document.currentScript ? document.currentScript.src : location.href;
  const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

  const state = { status: "off", loaded: 0, total: 0, message: "", queued: 0, done: 0, failed: 0, bytes: 0 };
  const listeners = new Set();
  const cached = new Set();
  let db = null;
  let worker = null;
  let ready = null;
  let queue = [];
  let pumping = false;
  let inflight = null; // key of the sentence being generated now
  let nextId = 1;
  const waiting = new Map();
  const player = typeof Audio === "undefined" ? null : new Audio();
  let playToken = 0;
  let endPlay = null; // finishes the sentence that is playing

  const key = (text, voice) => `${voice}|${text}`;
  const notify = () => listeners.forEach((fn) => fn({ ...state }));
  const set = (patch) => { Object.assign(state, patch); notify(); };

  function supported() {
    return typeof Worker !== "undefined" && typeof WebAssembly !== "undefined" && typeof indexedDB !== "undefined" && Boolean(player);
  }

  // ----- the store of sentences -----
  function open() {
    if (db) return Promise.resolve(db);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => { db = request.result; resolve(db); };
      request.onerror = () => reject(request.error);
    });
  }
  function store(mode) { return db.transaction(STORE, mode).objectStore(STORE); }
  const wrap = (request) => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  async function loadIndex() {
    await open();
    const keys = await wrap(store("readonly").getAllKeys());
    keys.forEach((k) => { if (k !== SIZE_KEY) cached.add(k); });
    set({ bytes: (await wrap(store("readonly").get(SIZE_KEY))) || 0 });
  }

  // ----- the worker -----
  function ask(message) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      waiting.set(id, { resolve, reject });
      worker.postMessage({ ...message, id });
    });
  }
  function start() {
    if (ready) return ready;
    set({ status: "loading", message: "" });
    ready = new Promise((resolve, reject) => {
      worker = new Worker(new URL("neural-worker.js?v=6a264f72a9", SCRIPT_URL), { type: "module" });
      const files = new Map();
      worker.onmessage = ({ data }) => {
        if (data.type === "progress") {
          files.set(data.file, { loaded: data.loaded, total: data.total });
          let loaded = 0, total = 0;
          files.forEach((f) => { loaded += f.loaded; total += f.total; });
          set({ loaded, total });
        } else if (data.type === "ready") {
          set({ status: "ready" });
          resolve();
        } else if (data.type === "audio" || data.type === "error") {
          const entry = waiting.get(data.id);
          waiting.delete(data.id);
          if (!entry) { if (data.type === "error") { set({ status: "error", message: data.message }); reject(new Error(data.message)); } return; }
          if (data.type === "audio") entry.resolve(data); else entry.reject(new Error(data.message));
        }
      };
      worker.onerror = (e) => { set({ status: "error", message: e.message || "worker" }); reject(new Error(e.message || "worker")); };
      worker.postMessage({ type: "init" });
    });
    ready.catch(() => { ready = null; });
    return ready;
  }
  async function enable() {
    if (!supported()) throw new Error("not supported");
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* the browser decides */ }
    await loadIndex();
    await start();
  }
  function disable() {
    queue = [];
    stop();
    if (worker) { worker.terminate(); worker = null; }
    waiting.forEach((entry) => entry.reject(new Error("stopped")));
    waiting.clear();
    ready = null;
    pumping = false;
    set({ status: "off", queued: 0, done: 0, failed: 0, loaded: 0, total: 0 });
  }

  // ----- generation: the sentences asked for last, in the order given -----
  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      await ready;
      while (queue.length && state.status === "ready") {
        const { text, voice } = queue.shift();
        const k = key(text, voice);
        if (!cached.has(k)) {
          inflight = k;
          try {
            const audio = await ask({ type: "say", text, voice });
            const bytes = state.bytes + audio.pcm.byteLength;
            const write = store("readwrite");
            write.put({ pcm: audio.pcm, rate: audio.rate }, k);
            await wrap(write.put(bytes, SIZE_KEY));
            cached.add(k);
            state.bytes = bytes;
          } catch (e) {
            set({ failed: state.failed + 1 });
          }
          inflight = null;
        }
        set({ done: state.done + 1, queued: queue.length });
      }
    } catch (e) { /* the worker failed: the status says so */ }
    pumping = false;
    set({ queued: queue.length });
  }
  // Replaces what is waiting to be generated; the sentence being generated now is finished first.
  function prepare(texts, voice) {
    const seen = new Set();
    queue = texts.filter((text) => {
      const k = key(text, voice);
      if (cached.has(k) || seen.has(k) || k === inflight) return false;
      seen.add(k);
      return true;
    }).map((text) => ({ text, voice }));
    set({ queued: queue.length, done: 0, failed: 0 });
    if (queue.length && state.status === "ready") pump();
  }
  function cancel() { queue = []; set({ queued: 0 }); }
  const has = (text, voice) => cached.has(key(text, voice));
  function count(texts, voice) { return texts.reduce((n, text) => n + (cached.has(key(text, voice)) ? 1 : 0), 0); }
  async function clear() {
    queue = [];
    await open();
    await wrap(store("readwrite").clear());
    cached.clear();
    set({ queued: 0, done: 0, bytes: 0 });
  }

  // ----- playback -----
  function wav(pcm, rate) {
    const bytes = new DataView(new ArrayBuffer(44 + pcm.length * 2));
    const text = (at, s) => { for (let i = 0; i < s.length; i += 1) bytes.setUint8(at + i, s.charCodeAt(i)); };
    text(0, "RIFF"); bytes.setUint32(4, 36 + pcm.length * 2, true); text(8, "WAVE"); text(12, "fmt ");
    bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 1, true);
    bytes.setUint32(24, rate, true); bytes.setUint32(28, rate * 2, true); bytes.setUint16(32, 2, true); bytes.setUint16(34, 16, true);
    text(36, "data"); bytes.setUint32(40, pcm.length * 2, true);
    new Int16Array(bytes.buffer, 44).set(pcm);
    return new Blob([bytes], { type: "audio/wav" });
  }
  // Mobile browsers let a page play sound only after a tap: the element is "opened" in the tap that starts the podcast.
  function unlock() {
    if (!player || player.dataset.unlocked) return;
    player.dataset.unlocked = "1";
    player.src = SILENCE;
    player.play().catch(() => { delete player.dataset.unlocked; });
  }
  // Plays a sentence that is ready: resolves true when it ended, false when it was not ready or could not be played (the caller then
  // uses the voice of the browser) and "stopped" when stop() cut it short.
  async function play(text, voice, rate) {
    const k = key(text, voice);
    if (!cached.has(k) || !player) return false;
    const token = ++playToken;
    try {
      await open();
      const record = await wrap(store("readonly").get(k));
      if (!record || token !== playToken) return token !== playToken ? "stopped" : false;
      const url = URL.createObjectURL(wav(record.pcm, record.rate));
      return await new Promise((resolve) => {
        const finish = (result) => { player.onended = player.onerror = null; endPlay = null; URL.revokeObjectURL(url); resolve(result); };
        endPlay = finish;
        player.onended = () => finish(true);
        player.onerror = () => finish(false);
        player.src = url;
        player.playbackRate = rate || 1;
        player.preservesPitch = true;
        player.webkitPreservesPitch = true;
        player.play().then(() => { if (token !== playToken) finish("stopped"); }).catch(() => finish(false));
      });
    } catch (e) {
      return false;
    }
  }
  function stop() {
    playToken += 1;
    if (player && !player.paused) player.pause();
    if (endPlay) endPlay("stopped");
  }

  window.ApsNeural = {
    voices: VOICES,
    supported,
    state: () => ({ ...state }),
    onchange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    enable, disable, prepare, cancel, has, count, clear, unlock, play, stop,
  };
})();
