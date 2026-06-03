/**
 * Multimodal input: image attachments (file / camera / paste / drag-drop)
 * and voice input via the Web Speech API.
 *
 * All media is base64-encoded for Gemini's `inlineData` part format:
 *   { inlineData: { mimeType: "image/jpeg", data: "<base64>" } }
 */
(function (global) {
  "use strict";

  const MAX_IMAGE_DIMENSION = 1568; // px — resize before upload to keep payloads small
  const ALLOWED_TYPES = /^image\/(jpeg|png|webp|heic|heif|gif)$/i;

  // ---- Image encoding ----
  async function fileToInlinePart(file) {
    if (!ALLOWED_TYPES.test(file.type)) {
      throw new Error(`Unsupported file type: ${file.type || "unknown"}. Use JPG / PNG / WEBP / HEIC.`);
    }
    const blob = await maybeResize(file);
    const base64 = await blobToBase64(blob);
    return {
      mimeType: blob.type || "image/jpeg",
      data: base64,
      // metadata for UI (not sent to Gemini)
      _previewUrl: URL.createObjectURL(blob),
      _filename: file.name || "image",
      _size: blob.size,
    };
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const result = fr.result || "";
        // strip "data:<mime>;base64," prefix
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      fr.onerror = () => reject(fr.error || new Error("Failed to read file."));
      fr.readAsDataURL(blob);
    });
  }

  /** Downscale to MAX_IMAGE_DIMENSION on the longer edge if needed. JPEG output @ 0.9. */
  async function maybeResize(file) {
    if (!/^image\//i.test(file.type)) return file;
    try {
      const bitmap = await createImageBitmap(file);
      const maxSide = Math.max(bitmap.width, bitmap.height);
      if (maxSide <= MAX_IMAGE_DIMENSION) return file;
      const scale = MAX_IMAGE_DIMENSION / maxSide;
      const w = Math.round(bitmap.width * scale);
      const h = Math.round(bitmap.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0, w, h);
      return await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b || file), "image/jpeg", 0.9)
      );
    } catch (_) {
      return file; // fallback to original if browser can't decode (e.g. HEIC on some browsers)
    }
  }

  // ---- Clipboard / drag-drop helpers ----
  function filesFromClipboard(event) {
    const items = event.clipboardData?.items || [];
    const files = [];
    for (const it of items) {
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    return files;
  }

  function filesFromDrop(event) {
    const dt = event.dataTransfer;
    if (!dt) return [];
    if (dt.items && dt.items.length) {
      const out = [];
      for (const it of dt.items) {
        if (it.kind === "file") {
          const f = it.getAsFile();
          if (f) out.push(f);
        }
      }
      return out;
    }
    return Array.from(dt.files || []);
  }

  // ---- Voice (Web Speech API) ----
  class VoiceInput {
    constructor({ onPartial, onFinal, onError, onEnd, lang } = {}) {
      const SR = global.SpeechRecognition || global.webkitSpeechRecognition;
      this.supported = !!SR;
      if (!this.supported) return;
      this.recognition = new SR();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = lang || (navigator.language || "en-US");
      this.recognition.onresult = (e) => {
        let interim = "";
        let final = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript;
          if (e.results[i].isFinal) final += transcript;
          else interim += transcript;
        }
        if (interim && onPartial) onPartial(interim);
        if (final && onFinal) onFinal(final);
      };
      this.recognition.onerror = (e) => onError && onError(e.error || "voice-error");
      this.recognition.onend = () => { this.active = false; onEnd && onEnd(); };
      this.active = false;
    }
    start() {
      if (!this.supported || this.active) return;
      try {
        this.recognition.start();
        this.active = true;
      } catch (e) { /* already started */ }
    }
    stop() {
      if (!this.supported) return;
      try { this.recognition.stop(); } catch (_) {}
      this.active = false;
    }
    toggle() { this.active ? this.stop() : this.start(); }
  }

  // ---- Text-to-speech (optional briefing readout) ----
  function speak(text, { rate = 1, lang } = {}) {
    if (!global.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    if (lang) u.lang = lang;
    global.speechSynthesis.cancel();
    global.speechSynthesis.speak(u);
  }
  function stopSpeaking() { global.speechSynthesis && global.speechSynthesis.cancel(); }

  global.Multimodal = {
    fileToInlinePart,
    filesFromClipboard,
    filesFromDrop,
    VoiceInput,
    speak,
    stopSpeaking,
    ALLOWED_TYPES,
  };
})(window);
