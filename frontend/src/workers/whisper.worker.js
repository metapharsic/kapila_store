/**
 * whisper.worker.js — Local speech recognition using Whisper Tiny (WASM).
 *
 * Loaded as a Vite web worker via:
 *   const worker = new Worker(new URL("../workers/whisper.worker.js", import.meta.url), { type: "module" });
 *
 * Messages IN  (from main thread):
 *   { type: "transcribe", audioBlob: Blob, language: string }
 *   { type: "cancel" }
 *
 * Messages OUT (to main thread):
 *   { type: "progress",    message: string }
 *   { type: "result",      text: string }
 *   { type: "error",       message: string }
 */

import { pipeline, env } from "@huggingface/transformers";

// Store model files in browser cache (IndexedDB) — downloaded once (~40 MB)
env.allowLocalModels = false;
env.useBrowserCache  = true;

let transcriber = null;
let loadingPromise = null;

// Load the model once and reuse across calls
async function getTranscriber() {
  if (transcriber) return transcriber;
  if (loadingPromise) return loadingPromise;

  loadingPromise = pipeline("automatic-speech-recognition", "onnx-community/whisper-tiny", {
    dtype: {
      encoder_model: "fp32",
      decoder_model_merged: "q4",  // 4-bit quantized decoder — smaller + faster
    },
    progress_callback: (progress) => {
      if (progress.status === "progress") {
        self.postMessage({
          type: "progress",
          message: `Loading model… ${Math.round(progress.progress || 0)}%`,
        });
      } else if (progress.status === "done") {
        self.postMessage({ type: "progress", message: "Model loaded ✓" });
      }
    },
  });

  transcriber = await loadingPromise;
  loadingPromise = null;
  return transcriber;
}

self.addEventListener("message", async (event) => {
  const { type, audioData, language } = event.data;

  if (type === "transcribe") {
    try {
      self.postMessage({ type: "progress", message: "Loading speech model…" });
      const model = await getTranscriber();

      self.postMessage({ type: "progress", message: "Recognizing speech…" });

      const result = await model(audioData, {
        language: language || "english",
        task: "transcribe",
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false,
      });

      const transcript = Array.isArray(result)
        ? result.map((r) => r.text).join(" ")
        : result.text || "";

      self.postMessage({ type: "result", text: transcript.trim() });
    } catch (err) {
      self.postMessage({ type: "error", message: err.message || "Transcription failed." });
    }
  }
});
