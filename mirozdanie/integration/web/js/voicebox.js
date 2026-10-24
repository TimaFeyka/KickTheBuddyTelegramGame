/* Custom voice clips: IndexedDB storage + microphone recorder. */

import {tgUser} from "./telegram.js";
const voiceDatabaseName = () => "mirozdanie-kick-buddy-voice-" + (tgUser()?.id || "unavailable");
const STORE = "clips";
const VERSION = 1;

export const VOICE_EVENTS = [
  { id: "hit", label: "Hit", emoji: "💥", hint: "Plays on every hit" },
  { id: "ouch", label: "Ouch", emoji: "😖", hint: "When he complains" },
  { id: "ko", label: "K.O.", emoji: "💫", hint: "When he goes down" },
  { id: "taunt", label: "Taunt", emoji: "🗯️", hint: "Between attacks" },
  { id: "special", label: "Special", emoji: "⚡", hint: "Heavy weapons" },
  { id: "coin", label: "Coin", emoji: "🪙", hint: "Coins collected" },
];

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("no_indexeddb"));
    const request = indexedDB.open(voiceDatabaseName(), VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "event" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

export async function saveClip(event, blob) {
  if (!blob) return false;
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ event, blob, at: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function loadClipBlob(event) {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(event);
      request.onsuccess = () => resolve(request.result?.blob || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function deleteClip(event) {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(event);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
    return true;
  } catch {
    return false;
  }
}

export async function listClips() {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function clearClips() {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
    return true;
  } catch {
    return false;
  }
}

/** Record up to `maxMs` from the microphone. */
export class VoiceRecorder {
  constructor() {
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this.maxTimer = null;
  }

  get supported() {
    return Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  }

  async start({ maxMs = 3500 } = {}) {
    if (!this.supported) throw new Error("unsupported");
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
    });
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((type) =>
      MediaRecorder.isTypeSupported?.(type)
    );
    this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (event) => {
      if (event.data.size) this.chunks.push(event.data);
    };
    this.recorder.start(120);
    this.maxTimer = setTimeout(() => this.stop().catch(() => {}), maxMs);
    return true;
  }

  stop() {
    clearTimeout(this.maxTimer);
    return new Promise((resolve) => {
      const rec = this.recorder;
      if (!rec || rec.state === "inactive") {
        this.cleanup();
        resolve(null);
        return;
      }
      rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: rec.mimeType || "audio/webm" });
        this.cleanup();
        resolve(blob.size > 600 ? blob : null);
      };
      try {
        rec.stop();
      } catch {
        this.cleanup();
        resolve(null);
      }
    });
  }

  cancel() {
    clearTimeout(this.maxTimer);
    try {
      this.recorder?.stop();
    } catch {
      /* ignore */
    }
    this.cleanup();
  }

  cleanup() {
    this.stream?.getTracks?.().forEach((track) => track.stop());
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
  }
}
