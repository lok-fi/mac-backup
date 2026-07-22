import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import type { Session, LiveServerMessage } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';

const API_KEY    = 'AIzaSyDlr6ZVS5xJS9uw1168R4_6jRsbCWfIduM';
const LIVE_MODEL = 'gemini-2.0-flash-live-preview';
const TEXT_MODEL = 'gemini-2.0-flash';

// ── Audio helpers ──────────────────────────────────────────────────────────────

function float32ToInt16(f32: Float32Array): Int16Array {
  const i16 = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return i16;
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToFloat32(b64: string): Float32Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const i16 = new Int16Array(bytes.buffer);
  const f32 = new Float32Array(i16.length);
  for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 32768;
  return f32;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  streaming?: boolean;
  isVoice?: boolean;
}

export interface ChatBotProps {
  dashboardContext: string;
  onNavigate:    (tab: string) => void;
  onCreateOrder: () => void;
}

// ── Shared AI client ───────────────────────────────────────────────────────────

const ai = new GoogleGenAI({ apiKey: API_KEY });

const SUGGESTIONS = [
  'What are my active orders?',
  'Total value of all orders?',
  'Any pending deliveries?',
  'Check my credit balance',
];

// ── Component ──────────────────────────────────────────────────────────────────

export default function ChatBot({ dashboardContext, onNavigate, onCreateOrder }: ChatBotProps) {
  const [open, setOpen]           = useState(false);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [liveActive, setLiveActive] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'idle'|'connecting'|'live'|'error'>('idle');
  const [liveError, setLiveError]  = useState('');
  const [messages, setMessages]    = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      content: "Hi! I'm your UPL AI Assistant. I have full access to your dashboard — orders, invoices, credit — and can perform calculations. You can also click **Live** to talk to me directly by voice!",
    },
  ]);

  const bottomRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const sessionRef   = useRef<Session | null>(null);
  const inAudioCtx   = useRef<AudioContext | null>(null);
  const outAudioCtx  = useRef<AudioContext | null>(null);
  const mediaStream  = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTime = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  // Cleanup live session on unmount
  useEffect(() => () => { stopLive(); }, []); // eslint-disable-line

  // ── System instruction (shared by text + live) ────────────────────────────

  const systemInstruction = useMemo(() => `You are a smart AI assistant embedded in the UPL Distributor Portal for a petrochemical and agricultural solutions company.

LIVE DASHBOARD DATA:
${dashboardContext}

Rules:
- Answer questions about orders, invoices, credit, statuses accurately.
- Perform any calculations asked (sums, averages, percentages, etc.).
- Use ₹ for currency. Be concise and professional.
- If asked to navigate or open a section, use the appropriate tool.
- If asked to create/place a new order, use the open_new_order tool.
- Never make up data not present above.`, [dashboardContext]);

  // ── Tool definitions ───────────────────────────────────────────────────────

  const tools = [{
    functionDeclarations: [
      {
        name: 'navigate_to_tab',
        description: 'Navigate the user to a specific section of the dashboard',
        parameters: {
          type: 'object',
          properties: {
            tab: { type: 'string', enum: ['dashboard', 'orders', 'invoices', 'grn', 'profile'], description: 'The section to navigate to' },
          },
          required: ['tab'],
        },
      },
      {
        name: 'open_new_order',
        description: 'Open the new order creation form for the user',
        parameters: { type: 'object', properties: {} },
      },
    ],
  }];

  // ── Audio playback ────────────────────────────────────────────────────────

  function scheduleAudio(b64: string, mimeType: string) {
    const rate = parseInt(mimeType.split('rate=')[1]) || 24000;
    if (!outAudioCtx.current || outAudioCtx.current.state === 'closed') {
      outAudioCtx.current = new AudioContext({ sampleRate: rate });
      nextPlayTime.current = 0;
    }
    const ctx    = outAudioCtx.current;
    const f32    = base64ToFloat32(b64);
    const buffer = ctx.createBuffer(1, f32.length, rate);
    buffer.getChannelData(0).set(f32);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const now   = ctx.currentTime;
    const start = Math.max(now, nextPlayTime.current);
    src.start(start);
    nextPlayTime.current = start + buffer.duration;
  }

  // ── Mic capture ───────────────────────────────────────────────────────────

  async function startMicCapture() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    mediaStream.current = stream;
    inAudioCtx.current  = new AudioContext({ sampleRate: 16000 });
    const source    = inAudioCtx.current.createMediaStreamSource(stream);
    const processor = inAudioCtx.current.createScriptProcessor(512, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (!sessionRef.current) return;
      const f32  = e.inputBuffer.getChannelData(0);
      const i16  = float32ToInt16(f32);
      const b64  = bufferToBase64(i16.buffer);
      sessionRef.current.sendRealtimeInput({
        audio: { data: b64, mimeType: 'audio/pcm;rate=16000' },
      });
    };

    source.connect(processor);
    processor.connect(inAudioCtx.current.destination);
  }

  function stopMicCapture() {
    processorRef.current?.disconnect();
    processorRef.current = null;
    inAudioCtx.current?.close().catch(() => {});
    inAudioCtx.current = null;
    mediaStream.current?.getTracks().forEach(t => t.stop());
    mediaStream.current = null;
  }

  // ── Live message handler ──────────────────────────────────────────────────

  const handleLiveMessage = useCallback((msg: LiveServerMessage) => {
    // Audio from the model
    if (msg.serverContent?.modelTurn?.parts) {
      for (const part of msg.serverContent.modelTurn.parts) {
        if ((part as any).inlineData?.data) {
          const { data, mimeType } = (part as any).inlineData;
          scheduleAudio(data, mimeType ?? 'audio/pcm;rate=24000');
        }
      }
    }

    // Output transcription (what the model said)
    const outText = (msg.serverContent as any)?.outputTranscription?.text;
    if (outText?.trim()) {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.isVoice && last.role === 'model') {
          return prev.map(m => m.id === last.id ? { ...m, content: m.content + outText } : m);
        }
        return [...prev, { id: Date.now().toString(), role: 'model', content: outText, isVoice: true }];
      });
    }

    // Input transcription (what the user said)
    const inText = (msg.serverContent as any)?.inputTranscription?.text;
    if (inText?.trim()) {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.isVoice && last.role === 'user') {
          return prev.map(m => m.id === last.id ? { ...m, content: m.content + inText } : m);
        }
        return [...prev, { id: Date.now().toString(), role: 'user', content: inText, isVoice: true }];
      });
    }

    // Tool calls
    if (msg.toolCall?.functionCalls) {
      for (const fc of msg.toolCall.functionCalls) {
        let result = 'done';
        if (fc.name === 'navigate_to_tab' && (fc.args as any)?.tab) {
          onNavigate((fc.args as any).tab);
          result = `Navigated to ${(fc.args as any).tab}`;
        } else if (fc.name === 'open_new_order') {
          onCreateOrder();
          result = 'New order form opened';
        }
        sessionRef.current?.sendToolResponse({
          functionResponses: [{ id: fc.id!, name: fc.name, response: { result } }],
        });
      }
    }
  }, [onNavigate, onCreateOrder]);

  // ── Start / Stop Live ─────────────────────────────────────────────────────

  const startLive = useCallback(async () => {
    setLiveStatus('connecting');
    setLiveError('');
    try {
      const session = await ai.live.connect({
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
          },
          inputAudioTranscription:  {},
          outputAudioTranscription: {},
          tools,
        },
        callbacks: {
          onopen:    () => setLiveStatus('live'),
          onmessage: handleLiveMessage,
          onerror:   (e: ErrorEvent) => {
            setLiveError(e.message || 'Connection error');
            setLiveStatus('error');
            setLiveActive(false);
          },
          onclose:   () => {
            setLiveStatus('idle');
            setLiveActive(false);
          },
        },
      } as any);

      sessionRef.current = session;
      await startMicCapture();
      setLiveActive(true);

      // Greet the user
      session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: 'Hello, I\'ve just connected. Please greet me briefly.' }] }],
        turnComplete: true,
      });
    } catch (err: any) {
      setLiveError(err?.message || 'Failed to start live session');
      setLiveStatus('error');
    }
  }, [systemInstruction, handleLiveMessage]);

  const stopLive = useCallback(() => {
    stopMicCapture();
    sessionRef.current?.close();
    sessionRef.current = null;
    outAudioCtx.current?.close().catch(() => {});
    outAudioCtx.current = null;
    nextPlayTime.current = 0;
    setLiveActive(false);
    setLiveStatus('idle');
  }, []);

  // ── Text chat ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    // If live is active, send through live session
    if (sessionRef.current && liveActive) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: text }]);
      setInput('');
      sessionRef.current.sendClientContent({
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true,
      });
      return;
    }

    const userId = Date.now().toString();
    const botId  = (Date.now() + 1).toString();
    setMessages(prev => [
      ...prev,
      { id: userId, role: 'user',  content: text },
      { id: botId,  role: 'model', content: '', streaming: true },
    ]);
    setInput('');
    setLoading(true);

    try {
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role as 'user' | 'model', parts: [{ text: m.content }] }));
      history.push({ role: 'user', parts: [{ text }] });

      const stream = await ai.models.generateContentStream({
        model: TEXT_MODEL,
        contents: history,
        config: { systemInstruction },
      });

      let full = '';
      for await (const chunk of stream) {
        full += chunk.text ?? '';
        setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: full } : m));
      }
      setMessages(prev => prev.map(m => m.id === botId ? { ...m, streaming: false } : m));
    } catch (err: any) {
      setMessages(prev =>
        prev.map(m => m.id === botId
          ? { ...m, content: `⚠️ ${err?.message ?? 'Something went wrong.'}`, streaming: false }
          : m)
      );
    } finally {
      setLoading(false);
    }
  }, [loading, liveActive, messages, systemInstruction]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input); };
  const showSuggestions = messages.length === 1 && !loading;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating trigger */}
      <motion.button
        onClick={() => setOpen(v => !v)}
        whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl bg-gradient-to-br from-[#002855] to-blue-600 shadow-xl shadow-blue-900/40 flex items-center justify-center text-white"
      >
        <AnimatePresence mode="wait">
          {open
            ? <motion.svg key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></motion.svg>
            : <motion.svg key="star" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" /></motion.svg>
          }
        </AnimatePresence>
        {!open && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white">
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
          </span>
        )}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{   opacity: 0, y: 18, scale: 0.96  }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-24 right-6 z-50 w-[400px] h-[580px] bg-white rounded-3xl border border-slate-200 shadow-[0_24px_60px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden"
          >
            {/* ── Header ── */}
            <div className="bg-gradient-to-r from-[#002855] to-blue-700 px-5 py-3.5 flex items-center gap-3 shrink-0">
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-sm leading-none">UPL AI Assistant</p>
                <p className="text-white/50 text-[10px] font-medium mt-0.5">Gemini · Full Dashboard Access</p>
              </div>

              {/* Live toggle button */}
              <button
                onClick={liveActive ? stopLive : startLive}
                disabled={liveStatus === 'connecting'}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all
                  ${liveActive
                    ? 'bg-red-500/90 text-white hover:bg-red-600'
                    : liveStatus === 'connecting'
                      ? 'bg-white/10 text-white/50 cursor-wait'
                      : 'bg-white/15 text-white hover:bg-white/25 border border-white/20'}
                `}
              >
                {liveActive ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Stop
                  </>
                ) : liveStatus === 'connecting' ? (
                  <>
                    <div className="w-3 h-3 rounded-full border border-white/40 border-t-white animate-spin" />
                    Connecting
                  </>
                ) : (
                  <>
                    {/* Mic icon */}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                    Live
                  </>
                )}
              </button>
            </div>

            {/* Live active banner */}
            <AnimatePresence>
              {liveActive && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="bg-emerald-50 border-b border-emerald-100 px-5 py-2.5 flex items-center gap-2.5 overflow-hidden shrink-0"
                >
                  <div className="flex gap-0.5 items-end h-4">
                    {[1,2,3,2,1].map((h, i) => (
                      <span key={i} className="w-1 bg-emerald-500 rounded-full animate-bounce" style={{ height: `${h * 4}px`, animationDelay: `${i * 80}ms` }} />
                    ))}
                  </div>
                  <p className="text-emerald-700 text-xs font-bold">Listening · Speak naturally</p>
                  <span className="ml-auto text-emerald-500 text-[10px] font-black uppercase tracking-widest">Live</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error banner */}
            <AnimatePresence>
              {liveError && (
                <motion.div
                  initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                  className="bg-red-50 border-b border-red-100 px-5 py-2 flex items-center gap-2 overflow-hidden shrink-0"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                  <p className="text-red-600 text-xs font-semibold">{liveError}</p>
                  <button onClick={() => setLiveError('')} className="ml-auto text-red-400 hover:text-red-600 text-xs">✕</button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.map(msg => (
                <div key={msg.id} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'model' && (
                    <div className="w-6 h-6 rounded-lg bg-[#002855]/10 flex items-center justify-center shrink-0 mb-0.5">
                      {msg.isVoice
                        ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#002855" strokeWidth="2.5" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
                        : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#002855" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" /></svg>
                      }
                    </div>
                  )}
                  <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-[#ff8200] to-amber-400 text-white rounded-br-sm font-medium'
                      : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                  }`}>
                    {msg.streaming && !msg.content
                      ? <span className="flex gap-1 items-center py-0.5 px-1">{[0,150,300].map(d => <span key={d} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</span>
                      : <>{msg.content}{msg.streaming && <span className="inline-block w-[2px] h-3.5 bg-slate-500 ml-0.5 align-middle animate-pulse rounded-sm" />}</>
                    }
                  </div>
                  {msg.role === 'user' && msg.isVoice && (
                    <div className="w-5 h-5 rounded-md bg-[#ff8200]/20 flex items-center justify-center shrink-0 mb-0.5">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#ff8200" strokeWidth="2.5" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
                    </div>
                  )}
                </div>
              ))}

              {showSuggestions && (
                <div className="pt-1 flex flex-wrap gap-2">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => sendMessage(s)}
                      className="text-[11px] px-3 py-1.5 rounded-full border border-[#002855]/20 text-[#002855]/70 hover:bg-[#002855]/5 hover:border-[#002855]/30 transition-colors font-semibold"
                    >{s}</button>
                  ))}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="px-4 pb-4 pt-3 border-t border-slate-100 shrink-0">
              <div className="flex gap-2 items-center">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={liveActive ? 'Or type while talking…' : 'Ask about orders, invoices, credit…'}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 border border-transparent focus:outline-none focus:border-[#002855]/25 focus:bg-white text-sm transition-all disabled:opacity-50 placeholder-slate-400"
                />
                <button type="submit" disabled={!input.trim() || loading}
                  className="w-10 h-10 rounded-xl bg-[#002855] flex items-center justify-center text-white disabled:opacity-25 hover:bg-blue-900 active:scale-95 transition-all shrink-0"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
              <p className="text-center text-slate-300 text-[9px] font-black uppercase tracking-[0.2em] mt-2.5">Powered by Google Gemini</p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
