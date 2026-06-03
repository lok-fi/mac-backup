/* global CRMTools */
/**
 * Gemini Live API client (WebSocket, bidirectional audio).
 *
 * Endpoint:  wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=...
 *
 * Audio:
 *   - Input  : PCM 16-bit mono, 16 kHz, base64
 *   - Output : PCM 16-bit mono, 24 kHz, base64
 *
 * Protocol (simplified, what we actually need):
 *   client -> server: { setup: { model, systemInstruction, tools, generationConfig } }
 *   client -> server: { realtimeInput: { mediaChunks: [{ mimeType, data }] } }
 *   server -> client: { serverContent: { modelTurn: { parts: [{ inlineData|text }] } } }
 *   server -> client: { toolCall: { functionCalls: [{ id, name, args }] } }
 *   client -> server: { toolResponse: { functionResponses: [{ id, name, response }] } }
 *   server -> client: { setupComplete: {} } | { serverContent: { turnComplete: true } } | ...
 */
(function (global) {
  "use strict";

  const WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

  // ---- helpers ----
  function pcmToBase64(int16Array) {
    const bytes = new Uint8Array(int16Array.buffer, int16Array.byteOffset, int16Array.byteLength);
    // Chunk-based btoa to avoid maxArgs limits.
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function base64ToInt16(b64) {
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new Int16Array(bytes.buffer);
  }

  /** Linear-interpolation resampler from `inRate` to `outRate` for mono Float32. */
  function resampleFloat32(input, inRate, outRate) {
    if (inRate === outRate) return input;
    const ratio = inRate / outRate;
    const outLen = Math.floor(input.length / ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const src = i * ratio;
      const i0 = Math.floor(src);
      const i1 = Math.min(i0 + 1, input.length - 1);
      const t = src - i0;
      out[i] = input[i0] * (1 - t) + input[i1] * t;
    }
    return out;
  }

  function float32ToInt16(input) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return out;
  }

  // Hardcoded — this is the model that actually works for live voice.
  const LIVE_MODEL = "gemini-3.1-flash-live-preview";

  class LiveChat {
    constructor({ apiKey, systemPrompt, tools, voice = "Zephyr", onState, onUserText, onModelText, onError, onLevel, onInterrupted, onClientTool, onConfirmWrites }) {
      this.apiKey = apiKey;
      this.model = LIVE_MODEL;
      this.systemPrompt = systemPrompt || "";
      this.tools = tools || [];
      this.voice = voice;
      this.onState = onState || (() => {});
      this.onUserText = onUserText || (() => {});
      this.onModelText = onModelText || (() => {});
      this.onError = onError || (() => {});
      this.onLevel = onLevel || (() => {});
      this.onInterrupted = onInterrupted || (() => {});
      // Optional handler for client-side tools (forms, visualizations, memory).
      // Called instead of CRMTools.call() when CRMTools.isUI(name) === true.
      this.onClientTool = onClientTool || null;
      // Optional handler that pops the "approve these writes" card before
      // create/update/delete tools execute. Receives the write call list,
      // returns { approved, trustChat }.
      this.onConfirmWrites = onConfirmWrites || null;

      this.ws = null;
      this.audioCtx = null;
      this.micStream = null;
      this.micSource = null;
      this.micProcessor = null;
      this.outCtx = null;
      this.playHead = 0;
      this.activeSources = []; // BufferSourceNodes currently scheduled / playing
      this.muted = false;
      this.state = "idle"; // idle | connecting | live | ended | error
      this._closedByUs = false;
    }

    _setState(s) { this.state = s; this.onState(s); }

    async start() {
      if (this.state === "live" || this.state === "connecting") return;
      this._setState("connecting");
      try {
        await this._openMic();
        await this._openWs();
      } catch (e) {
        this._setState("error");
        this.onError(e.message || String(e));
        await this.stop();
      }
    }

    async stop() {
      this._closedByUs = true;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try { this.ws.close(1000); } catch (_) {}
      }
      this.ws = null;
      if (this.micProcessor) { try { this.micProcessor.disconnect(); } catch (_) {} this.micProcessor = null; }
      if (this.micSource) { try { this.micSource.disconnect(); } catch (_) {} this.micSource = null; }
      if (this.micStream) { this.micStream.getTracks().forEach((t) => t.stop()); this.micStream = null; }
      if (this.audioCtx) { try { await this.audioCtx.close(); } catch (_) {} this.audioCtx = null; }
      if (this.outCtx) { try { await this.outCtx.close(); } catch (_) {} this.outCtx = null; }
      this.playHead = 0;
      this._setState("ended");
    }

    setMuted(m) { this.muted = !!m; }

    async _openMic() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone API not available. Use a modern browser over HTTPS.");
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      } catch (e) {
        if (e.name === "NotAllowedError") throw new Error("Mic permission denied. Allow it in the browser site settings.");
        if (e.name === "NotFoundError")  throw new Error("No microphone found.");
        throw new Error(`Mic error: ${e.message || e.name}`);
      }
      this.micStream = stream;
      console.info("[Live] mic opened");

      // Use the device's natural rate then resample to 16k.
      this.audioCtx = new (global.AudioContext || global.webkitAudioContext)();
      this.micSource = this.audioCtx.createMediaStreamSource(stream);

      // ScriptProcessor is deprecated but still works everywhere; AudioWorklet would be cleaner.
      const bufferSize = 2048;
      this.micProcessor = this.audioCtx.createScriptProcessor(bufferSize, 1, 1);
      this.micSource.connect(this.micProcessor);
      this.micProcessor.connect(this.audioCtx.destination); // required on some browsers to keep node alive

      const inRate = this.audioCtx.sampleRate;
      this.micProcessor.onaudioprocess = (e) => {
        if (this.muted || this.state !== "live" || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const float = e.inputBuffer.getChannelData(0);
        // Rough RMS level for UI pulse.
        let sum = 0;
        for (let i = 0; i < float.length; i++) sum += float[i] * float[i];
        this.onLevel(Math.sqrt(sum / float.length));

        const down = resampleFloat32(float, inRate, 16000);
        const pcm = float32ToInt16(down);
        const b64 = pcmToBase64(pcm);
        try {
          this.ws.send(JSON.stringify({
            realtimeInput: {
              audio: { mimeType: "audio/pcm;rate=16000", data: b64 },
            },
          }));
        } catch (_) {}
      };
    }

    async _openWs() {
      const url = `${WS_URL}?key=${encodeURIComponent(this.apiKey)}`;
      console.info("[Live] connecting to", url.replace(/key=[^&]+/, "key=…"), "model:", this.model);
      this.ws = new WebSocket(url);
      this.ws.binaryType = "arraybuffer";

      // Capture the close code/reason if connect fails. Browsers don't expose
      // 401/403 details on WS — onerror is generic, but onclose has the code.
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          reject(new Error("WebSocket connect timed out after 10s. Network blocked?"));
        }, 10000);
        this.ws.onopen = () => {
          clearTimeout(t);
          resolve();
        };
        this.ws.onclose = (ev) => {
          clearTimeout(t);
          console.warn("[Live] ws close during connect:", ev.code, ev.reason);
          let hint = "";
          if (ev.code === 1006) {
            hint = "API key likely doesn't have Live API access, or the model is gated. Try gemini-2.0-flash-live-001 (stable), or get a fresh key from aistudio.google.com/apikey on a project with the Live API enabled. Also check the key has no HTTP-referrer restriction blocking 127.0.0.1.";
          } else if (ev.code === 1008 || ev.code === 1011) {
            hint = "Model name was rejected. Try gemini-2.0-flash-live-001.";
          }
          const reasonText = ev.reason ? ` — ${ev.reason}` : "";
          reject(new Error(`Could not open WebSocket (code ${ev.code}${reasonText}). ${hint}`));
        };
        this.ws.onerror = () => { /* close handler will reject with code */ };
      });

      // Wire format: { setup: { ... } }
      // (The @google/genai SDK calls the arg "config", but it translates to
      //  `setup` on the websocket. We're talking raw, so use `setup` directly.)
      const setup = {
        setup: {
          model: `models/${this.model}`,
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: this.voice } },
            },
          },
          systemInstruction: this.systemPrompt
            ? { parts: [{ text: this.systemPrompt }] }
            : undefined,
          tools: this.tools.length ? [{ functionDeclarations: this.tools }] : undefined,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      };
      console.debug("[Live] sending setup", { model: setup.setup.model, tools: this.tools.length, voice: this.voice });
      this.ws.send(JSON.stringify(setup));

      // Replace the close handler now that we're past the connect phase.
      this.ws.onmessage = (ev) => this._onMessage(ev);
      this.ws.onclose = (ev) => {
        const reason = ev.reason || (ev.code === 1011 ? "model rejected the request" : `code ${ev.code}`);
        console.warn("[Live] ws close:", ev.code, ev.reason);
        if (!this._closedByUs) this.onError(`Connection closed: ${reason}`);
        this._setState("ended");
      };
      this.ws.onerror = (e) => {
        console.warn("[Live] ws error", e);
      };

      this._setState("live");
    }

    async _onMessage(ev) {
      let payload;
      try {
        if (typeof ev.data === "string") payload = JSON.parse(ev.data);
        else if (ev.data instanceof ArrayBuffer) payload = JSON.parse(new TextDecoder("utf-8").decode(ev.data));
        else if (ev.data instanceof Blob) {
          const text = await ev.data.text();
          payload = JSON.parse(text);
        }
      } catch (e) { return; }
      if (!payload) return;

      // Transcriptions arrive as serverContent with inputTranscription / outputTranscription
      if (payload.serverContent) {
        const sc = payload.serverContent;
        // User started talking while model was speaking → cancel playback immediately.
        if (sc.interrupted) {
          console.info("[Live] interrupted by user");
          this.cancelAudio();
          this.onInterrupted();
        }
        if (sc.inputTranscription?.text)  this.onUserText(sc.inputTranscription.text, !!sc.inputTranscription.finished);
        if (sc.outputTranscription?.text) this.onModelText(sc.outputTranscription.text, !!sc.outputTranscription.finished);
        const parts = sc.modelTurn?.parts || [];
        for (const p of parts) {
          if (typeof p.text === "string") {
            this.onModelText(p.text, false);
          } else if (p.inlineData?.mimeType?.startsWith("audio/pcm")) {
            this._enqueueAudio(p.inlineData.data, p.inlineData.mimeType);
          }
        }
      }

      if (payload.toolCall?.functionCalls?.length) {
        const calls = payload.toolCall.functionCalls;
        console.info("[Live] toolCall:", calls.map((c) => `${c.name}(${JSON.stringify(c.args || {}).slice(0, 80)})`));

        // Gate writes through the same confirmation card as text mode.
        const writeCalls = calls.filter((c) => CRMTools.isWrite(c.name));
        let writesApproved = true;
        if (writeCalls.length && this.onConfirmWrites) {
          try {
            const decision = await this.onConfirmWrites(writeCalls);
            writesApproved = !!decision?.approved;
          } catch (_) { writesApproved = false; }
        }

        const responses = [];
        for (const c of calls) {
          let result;
          if (CRMTools.isWrite(c.name) && !writesApproved) {
            result = { ok: false, error: "User cancelled this action." };
          } else if (CRMTools.isUI(c.name) && this.onClientTool) {
            // All UI tools — including request_user_input — go through the widget so
            // forms render inline and memory/visualization tools work the same as text mode.
            try { result = await this.onClientTool({ name: c.name, args: c.args || {} }); }
            catch (e) { result = { ok: false, error: e?.message || String(e) }; }
          } else if (CRMTools.isUI(c.name)) {
            result = { ok: false, error: "UI tool unavailable (no handler)." };
          } else {
            result = await CRMTools.call(c.name, c.args || {});
          }
          console.info("[Live] toolResult:", c.name, result?.ok ? "ok" : `err: ${result?.error || "?"}`);
          responses.push({ id: c.id, name: c.name, response: result });
        }
        try {
          this.ws.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
        } catch (_) {}
      }
    }

    _enqueueAudio(b64, mime) {
      try {
        if (!this.outCtx) {
          this.outCtx = new (global.AudioContext || global.webkitAudioContext)();
          this.playHead = this.outCtx.currentTime;
        }
        const int16 = base64ToInt16(b64);
        const f32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768;
        const m = /rate=(\d+)/.exec(mime || "");
        const rate = m ? parseInt(m[1], 10) : 24000;
        const buf = this.outCtx.createBuffer(1, f32.length, rate);
        buf.copyToChannel(f32, 0);
        const src = this.outCtx.createBufferSource();
        src.buffer = buf;
        src.connect(this.outCtx.destination);
        const now = this.outCtx.currentTime;
        if (this.playHead < now) this.playHead = now;
        src.start(this.playHead);
        this.playHead += buf.duration;
        this.activeSources.push(src);
        src.onended = () => {
          const i = this.activeSources.indexOf(src);
          if (i >= 0) this.activeSources.splice(i, 1);
        };
      } catch (_) {}
    }

    /** Cancel everything currently playing or scheduled. Used for barge-in. */
    cancelAudio() {
      for (const src of this.activeSources) {
        try { src.onended = null; src.stop(); src.disconnect(); } catch (_) {}
      }
      this.activeSources = [];
      if (this.outCtx) this.playHead = this.outCtx.currentTime;
    }
  }

  global.LiveChat = LiveChat;
})(window);
