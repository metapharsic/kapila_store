/**
 * useLocalSpeech.js — React hook for speech-to-text via API (Gemini).
 */

import { useState, useRef, useCallback } from "react";
import * as api from "../api";

export function useLocalSpeech() {
  const [listening, setListening]     = useState(false);
  const [statusMsg, setStatusMsg]     = useState("");
  const [transcript, setTranscript]   = useState("");
  const [interimText, setInterimText] = useState("");

  const mediaRecorder   = useRef(null);
  const audioChunks     = useRef([]);

  const startRecording = useCallback(async (onResult, onStatus) => {
    if (listening) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks.current = [];
      mediaRecorder.current = new MediaRecorder(stream, { mimeType: "audio/webm" });

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      mediaRecorder.current.onstop = async () => {
        // Stop all tracks to release microphone
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunks.current, { type: "audio/webm" });

        setStatusMsg("Transcribing audio...");
        if (onStatus) onStatus("Transcribing audio...");

        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64 = reader.result.split(",")[1];
            const res = await api.scan.voice(base64, blob.type);
            if (res.success && res.text) {
              setTranscript((prev) => (prev ? prev + "\n" + res.text : res.text));
              setStatusMsg("");
              if (onResult) onResult(res.text);
            } else {
              const errMsg = res.error || "Transcription failed";
              setStatusMsg(errMsg);
              if (onStatus) onStatus(errMsg);
            }
          } catch (err) {
            const errMsg = "Transcription failed: " + err.message;
            setStatusMsg(errMsg);
            if (onStatus) onStatus(errMsg);
          }
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.current.start();
      setListening(true);
      setStatusMsg("🎙️ Recording… click stop when done.");
      if (onStatus) onStatus("🎙️ Recording… click stop when done.");
    } catch (err) {
      const msg =
        err.name === "NotAllowedError"
          ? "Microphone access denied. Please allow mic in browser settings."
          : "Could not start recording: " + err.message;
      setStatusMsg(msg);
      if (onStatus) onStatus(msg);
    }
  }, [listening]);

  const stopRecording = useCallback((onStatus) => {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.stop();
      setListening(false);
      setStatusMsg("Processing audio...");
      if (onStatus) onStatus("Processing audio...");
    }
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript("");
    setInterimText("");
    setStatusMsg("");
  }, []);

  return {
    listening,
    statusMsg,
    transcript,
    interimText,
    startRecording,
    stopRecording,
    clearTranscript,
  };
}
