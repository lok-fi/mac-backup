import { GoogleGenAI, Modality } from '@google/genai';

// Client-side Gemini Live (Zephyr voice). Key is exposed in the browser bundle —
// fine for the demo; restrict/rotate for a public deploy.
const GEMINI_API_KEY = 'AIzaSyBUh0n4zBjKJZ7qz34zxZ7o0LqyQGZ3jBA';
const LIVE_MODEL = 'gemini-3.1-flash-live-preview';
const VOICE = 'Zephyr';

// ── Gemini Live TTS — speak a text reply aloud, streaming PCM chunks ──────────
export function speakTextViaLive(text) {
  const audioPlayer = new AudioPlayer();
  let sessionRef = null;
  let cancelled = false;
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const sessionPromise = ai.live.connect({
    model: LIVE_MODEL,
    callbacks: {
      onopen: () => {},
      onclose: () => {},
      onerror: (err) => console.error('[LiveTTS] error:', err),
      onmessage: (msg) => {
        if (msg.setupComplete) { sessionRef?.sendRealtimeInput({ text }); return; }
        if (cancelled) return;
        const b64 = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (b64) audioPlayer.enqueue(b64);
        if (msg.serverContent?.turnComplete) { try { sessionRef?.close(); } catch (_) {} }
      },
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
      systemInstruction: { parts: [{ text: 'Read the following text aloud verbatim with natural intonation.' }] },
    },
  });

  sessionPromise
    .then((session) => { if (cancelled) { try { session.close(); } catch (_) {} return; } sessionRef = session; })
    .catch((err) => console.error('[LiveTTS] connect failed:', err));

  return {
    cancel() {
      cancelled = true;
      audioPlayer.close();
      sessionPromise.then((s) => { try { s.close(); } catch (_) {} }).catch(() => {});
    },
  };
}

// ── Gapless PCM audio player (24 kHz output from Gemini) ──────────────────────
// Uses ONE persistent AudioContext and tracks every scheduled source so cancel()
// can stop them instantly — this is what makes barge-in ("stop speaking when the
// user talks") reliable. The old approach recreated the context on every cancel,
// which is racy and hits Chrome's 6-AudioContext-per-page limit after a few turns,
// after which playback can no longer be stopped.
class AudioPlayer {
  constructor() {
    this.ctx = new AudioContext({ sampleRate: 24000 });
    this.nextTime = 0;
    this.sources = new Set();
  }
  enqueue(base64) {
    if (!this.ctx || this.ctx.state === 'closed') { this.ctx = new AudioContext({ sampleRate: 24000 }); this.nextTime = 0; }
    if (this.ctx.state === 'suspended') { this.ctx.resume().catch(() => {}); }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const pcm = new Int16Array(bytes.buffer);
    const buf = this.ctx.createBuffer(1, pcm.length, 24000);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    src.onended = () => this.sources.delete(src);
    const at = Math.max(this.ctx.currentTime, this.nextTime);
    src.start(at);
    this.nextTime = at + buf.duration;
    this.sources.add(src);
  }
  // Stop ALL scheduled/playing audio immediately (synchronous) — keeps the context
  // alive so the next turn can play without recreating it. This is the barge-in stop.
  cancel() {
    for (const s of this.sources) { try { s.stop(); } catch (_) {} try { s.disconnect(); } catch (_) {} }
    this.sources.clear();
    this.nextTime = 0;
  }
  // Full teardown — release the AudioContext (used when a session/TTS one-shot ends).
  close() { this.cancel(); try { this.ctx?.close(); } catch (_) {} }
}

// ── Gemini Live Session (bidirectional voice + tools) ─────────────────────────
export class GeminiLiveSession {
  constructor({ onAudioOutput, onInterrupted, onTranscription, onToolCall, onTurnComplete, systemInstruction, tools }) {
    this.ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    this.onAudioOutput = onAudioOutput;
    this.onInterrupted = onInterrupted;
    this.onTranscription = onTranscription;
    this.onToolCall = onToolCall;
    this.onTurnComplete = onTurnComplete;
    this.systemInstruction = systemInstruction;
    this.tools = tools || [];
    this.sessionPromise = null;
    this.audioPlayer = new AudioPlayer();
    this.audioCtx = null;
    this.mediaStream = null;
    this.processorNode = null;
  }

  connect = async () => {
    this.sessionPromise = this.ai.live.connect({
      model: LIVE_MODEL,
      callbacks: {
        onopen: () => {},
        onmessage: async (msg) => {
          const b64 = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (b64) { this.audioPlayer.enqueue(b64); this.onAudioOutput?.(b64); }
          if (msg.serverContent?.interrupted) { this.audioPlayer.cancel(); this.onInterrupted?.(); }

          const calls = msg.toolCall?.functionCalls;
          if (calls?.length) {
            const session = await this.sessionPromise;
            const responses = await Promise.all(calls.map(async (call) => {
              const result = this.onToolCall ? await this.onToolCall(call.name, call.args) : {};
              return { name: call.name, response: { result }, id: call.id };
            }));
            session.sendToolResponse({ functionResponses: responses });
          }

          const modelText = msg.serverContent?.modelTurn?.parts?.[0]?.text;
          if (modelText) this.onTranscription?.(modelText, true);
          const userText = msg.realtimeInputTranscription?.text;
          if (userText) {
            // User started talking → stop the assistant's voice immediately (barge-in),
            // even if the server's interrupted flag hasn't arrived yet.
            this.audioPlayer.cancel();
            this.onInterrupted?.();
            this.onTranscription?.(userText, false);
          }
          if (msg.serverContent?.turnComplete) this.onTurnComplete?.();
        },
        onclose: () => {},
        onerror: (err) => console.error('[GeminiLive] error', err),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
        systemInstruction: this.systemInstruction,
        tools: this.tools,
        outputAudioTranscription: {},
        inputAudioTranscription: {},
      },
    });
    await this.sessionPromise;
    return this;
  };

  startMic = async () => {
    this.audioCtx = new AudioContext({ sampleRate: 16000 });
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
    this.processorNode = this.audioCtx.createScriptProcessor(4096, 1, 1);
    this.processorNode.onaudioprocess = (e) => {
      const floats = e.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(floats.length);
      for (let i = 0; i < floats.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, floats[i] * 32768));
      const b64 = btoa(String.fromCharCode(...new Uint8Array(pcm.buffer)));
      this.sendAudio(b64);
    };
    source.connect(this.processorNode);
    this.processorNode.connect(this.audioCtx.destination);
  };

  stopMic = () => {
    this.processorNode?.disconnect();
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    try { this.audioCtx?.close(); } catch (_) {}
    this.audioCtx = this.mediaStream = this.processorNode = null;
  };

  cancelSpeech = () => { this.audioPlayer.cancel(); };

  sendAudio = async (base64) => {
    const session = await this.sessionPromise;
    session?.sendRealtimeInput({ audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } });
  };

  sendText = async (text) => {
    const session = await this.sessionPromise;
    session?.sendRealtimeInput([{ text }]);
  };

  stop = async () => {
    this.stopMic();
    this.audioPlayer.close();
    const session = await this.sessionPromise;
    session?.close();
    this.sessionPromise = null;
  };
}
