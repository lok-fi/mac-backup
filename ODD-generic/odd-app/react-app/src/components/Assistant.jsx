import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, X, Loader2, Mic, MicOff, Volume2, VolumeX, Radio, Square, Minus } from 'lucide-react';
import { api } from '../api';
import { GeminiLiveSession, speakTextViaLive } from '../lib/GeminiLiveSession';
import { buildDataSummary, DASHBOARD_TOOLS } from '../lib/liveContext';
import { computePanel, normalizePanel, fmtNum } from '../lib/aggregate';

const STATUS = {
  listening: { label: 'Listening…', color: '#06b6d4' },
  processing: { label: 'Processing…', color: '#7c3aed' },
  speaking: { label: 'Speaking…', color: '#10b981' },
};

const SUGGESTIONS = [
  'Summarise the key insights in this data',
  'Compare the top categories as a bar chart',
  'Show the trend over time',
  'Add a KPI for the total',
  'What stands out the most?',
];

export default function Assistant({ dashboardId, spec, tablesByName, onActions, onVisualize, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([
    { role: 'assistant', text: 'Hi! Ask me about your data, tell me to add a chart or KPI, or hit Live to talk.', greeting: true },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [micTyping, setMicTyping] = useState(false);
  const [liveOn, setLiveOn] = useState(false);
  const [liveStatus, setLiveStatus] = useState('listening');

  const endRef = useRef(null);
  const inputRef = useRef('');
  const micRecRef = useRef(null);
  const liveRef = useRef(null);
  const ttsRef = useRef(null);
  const msgsRef = useRef(msgs);
  useEffect(() => { msgsRef.current = msgs; }, [msgs]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, open]);

  const cancelTTS = useCallback(() => { ttsRef.current?.cancel(); ttsRef.current = null; }, []);
  const speak = useCallback((text) => {
    if (muted || liveOn || !text) return;
    cancelTTS();
    try { ttsRef.current = speakTextViaLive(text); } catch (_) {}
  }, [muted, liveOn, cancelTTS]);

  // Apply assistant actions to dashboard / insights.
  const applyActions = useCallback((actions) => {
    const passthrough = [];
    for (const a of actions || []) {
      if (!a || !a.type) continue;
      if (a.type === 'visualize' && a.spec) onVisualize?.({ ...a.spec, append: !!a.append });
      else if (a.type === 'navigate') onNavigate?.(a.pageId || a.page);
      else passthrough.push(a);
    }
    if (passthrough.length) onActions?.(passthrough);
  }, [onActions, onVisualize, onNavigate]);

  const callAI = useCallback(async (question) => {
    const history = msgsRef.current.filter((m) => !m.greeting).map((m) => ({ role: m.role, text: m.text }));
    setMsgs((p) => [...p, { role: 'user', text: question }]);
    const res = await api.ask({ dashboardId, question, spec, history });
    const reply = res.reply || 'Done.';
    setMsgs((p) => [...p, { role: 'assistant', text: reply }]);
    speak(reply);
    if (res.actions?.length) applyActions(res.actions);
  }, [dashboardId, spec, speak, applyActions]);

  // Live → delegate a data/calc/chart request to the manual analyst (which has full
  // data access), render its result, and compute exact values to read back.
  const delegateToAnalyst = useCallback(async (question) => {
    setMsgs((p) => [...p, { role: 'user', text: question }, { role: 'assistant', text: 'Asking the analyst…', muted: true }]);
    const res = await api.ask({ dashboardId, question, spec, history: [] });
    if (res.actions?.length) applyActions(res.actions);

    // Compute exact figures from any returned panels so the voice speaks real numbers.
    const lines = [];
    const viz = (res.actions || []).find((a) => a.type === 'visualize' || a.type === 'addPanel');
    const panels = viz?.spec?.panels || (viz?.panel ? [viz.panel] : []);
    for (const pnl of panels.slice(0, 6)) {
      try {
        const rows = (pnl.table && tablesByName[pnl.table]) || Object.values(tablesByName).flat();
        const c = computePanel(normalizePanel(pnl), rows);
        if (c.kpi !== undefined && c.kpi !== null) lines.push(`${pnl.title}: ${fmtNum(c.kpi)}`);
        else if (c.data?.length && c.series?.[0]) {
          lines.push(`${pnl.title} — ` + c.data.slice(0, 6).map((d) => `${d[c.dimKey]}: ${fmtNum(d[c.series[0].key])}`).join(', '));
        }
      } catch (_) { /* skip */ }
    }
    const data = lines.join(' | ');
    setMsgs((p) => [...p, { role: 'assistant', text: res.reply || 'Done.' }]);
    return { answer: res.reply || 'Done.', data };
  }, [dashboardId, spec, applyActions, tablesByName]);

  const send = useCallback(async () => {
    const q = inputRef.current.trim();
    if (!q || loading) return;
    setInput(''); inputRef.current = '';
    setLoading(true);
    try { await callAI(q); }
    catch (err) { setMsgs((p) => [...p, { role: 'assistant', text: `Sorry — ${err.message}`, error: true }]); }
    finally { setLoading(false); }
  }, [loading, callAI]);

  // Mic-to-type (Web Speech API).
  const toggleMicType = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Voice input needs Chrome or Edge.'); return; }
    if (micTyping) { micRecRef.current?.stop(); setMicTyping(false); return; }
    cancelTTS();
    const rec = new SR();
    rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (e) => { const t = e.results[0][0].transcript; setInput(t); inputRef.current = t; setMicTyping(false); };
    rec.onerror = () => setMicTyping(false);
    rec.onend = () => setMicTyping(false);
    micRecRef.current = rec; rec.start(); setMicTyping(true);
  }, [micTyping, cancelTTS]);

  // Live voice mode.
  const toggleLive = useCallback(async () => {
    if (liveOn) {
      setLiveOn(false); setLiveStatus('listening');
      await liveRef.current?.stop(); liveRef.current = null;
      return;
    }
    micRecRef.current?.stop(); setMicTyping(false);
    cancelTTS();
    setLiveStatus('listening'); setLiveOn(true);

    const summary = buildDataSummary(spec, tablesByName);
    const systemInstruction = `You are the voice assistant embedded in an On Demand Dashboard by FI Digitals.
Answer concisely in natural, spoken language. The summary below is for orientation only — it is NOT complete.

LANGUAGE: Detect the language the user is speaking and ALWAYS reply in that SAME language,
including Indian languages such as Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali,
Gujarati, Punjabi, Odia and Urdu. The analyst tool returns its answer in English — when you read
it back, translate it naturally into the user's language. Keep numbers/units intact.

IMPORTANT: For ANY request that needs exact numbers, totals, averages, rankings, comparisons,
or a chart/KPI, you MUST call the askAnalyst tool with the user's request. The analyst has full
access to the real data, computes the precise result, and renders charts in the AI Insights tab.
Read back the 'answer' (and the exact 'data' values) it returns. Never make up or estimate numbers.
Use navigatePage only to switch between pages.

${summary}`;

    const session = new GeminiLiveSession({
      systemInstruction,
      tools: DASHBOARD_TOOLS,
      onAudioOutput: () => setLiveStatus('speaking'),
      onInterrupted: () => setLiveStatus('listening'),
      onTurnComplete: () => setLiveStatus('listening'),
      onTranscription: (text, isModel) => {
        if (!isModel) { setLiveStatus('processing'); setMsgs((p) => [...p, { role: 'user', text }]); }
        else setMsgs((p) => [...p, { role: 'assistant', text }]);
      },
      onToolCall: async (name, args) => {
        if (name === 'navigatePage') { onNavigate?.(args.page); return { success: true }; }
        if (name === 'askAnalyst') {
          try { return await delegateToAnalyst(args.question || ''); }
          catch (err) { return { answer: `The analyst could not complete that: ${err.message}` }; }
        }
        return { success: true };
      },
    });
    liveRef.current = session;
    try { await session.connect(); await session.startMic(); }
    catch (err) {
      setMsgs((p) => [...p, { role: 'assistant', text: `Live error: ${err.message}`, error: true }]);
      setLiveOn(false); liveRef.current = null;
    }
  }, [liveOn, spec, tablesByName, cancelTTS, onNavigate, onVisualize, delegateToAnalyst]);

  const st = STATUS[liveStatus];

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        {!open && (
          <span
            className="absolute inset-0 -z-10 animate-ping rounded-full"
            style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)', opacity: 0.3 }}
          />
        )}
        <motion.button
          onClick={() => setOpen((o) => !o)}
          aria-label="AI assistant"
          animate={open ? { y: 0 } : { y: [0, -4, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          className={`grid h-14 w-14 place-items-center rounded-full text-white shadow-xl ${liveOn ? 'ai-fab-live' : 'ai-fab-idle'}`}
          style={{ background: 'linear-gradient(135deg,#06b6d4,#2563eb,#7c3aed)', backgroundSize: '200% 200%' }}
        >
          <motion.span animate={open ? { rotate: 0 } : { rotate: [0, 15, -15, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
            {open ? <X size={22} /> : <Sparkles size={22} />}
          </motion.span>
        </motion.button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="fixed bottom-24 right-6 z-50 flex h-[34rem] w-[min(94vw,26rem)] flex-col overflow-hidden rounded-3xl border bg-white/95 shadow-2xl backdrop-blur"
            style={{ borderColor: liveOn ? st.color : '#e2e8f0' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: 'linear-gradient(135deg,#06b6d4,#2563eb,#7c3aed)' }}>
                  <Sparkles size={15} />
                </span>
                <div>
                  <div className="text-sm font-bold text-slate-800">ODD Assistant</div>
                  <div className="text-[11px] text-slate-400">{liveOn ? 'Live voice' : 'Text · voice · live'}</div>
                </div>
                {liveOn && (
                  <span className="ai-fade-up ml-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: st.color, background: `${st.color}18` }}>
                    <span className="ai-blink h-1.5 w-1.5 rounded-full" style={{ background: st.color }} /> LIVE
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => { setMuted((m) => !m); cancelTTS(); }} title={muted ? 'Unmute' : 'Mute'}
                  className={`grid h-8 w-8 place-items-center rounded-lg ${muted ? 'text-slate-300' : 'text-brand-blue'}`}>
                  {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <button onClick={toggleLive} title={liveOn ? 'Stop Live' : 'Start Live'}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                  style={{ background: liveOn ? `${st.color}1a` : '#f1f5f9', color: liveOn ? st.color : '#475569' }}>
                  {liveOn ? <Square size={12} /> : <Radio size={12} />} {liveOn ? 'Stop' : 'Live'}
                </button>
                <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400"><Minus size={16} /></button>
              </div>
            </div>

            {/* Live overlay */}
            {liveOn && (
              <div className="ai-fade-up flex flex-col items-center gap-2 border-b border-slate-100 py-4">
                <div className="relative grid h-24 w-24 place-items-center overflow-hidden">
                  <span className="ai-ring absolute h-16 w-16 rounded-full border-2" style={{ borderColor: st.color }} />
                  <span className="ai-ring2 absolute h-16 w-16 rounded-full border-2" style={{ borderColor: st.color }} />
                  <div className="relative grid h-12 w-12 place-items-center rounded-full" style={{ background: `${st.color}1a`, border: `2px solid ${st.color}55`, color: st.color }}>
                    {liveStatus === 'listening' && <Mic size={20} />}
                    {liveStatus === 'processing' && <Loader2 size={20} className="ai-spin" />}
                    {liveStatus === 'speaking' && <Volume2 size={20} />}
                  </div>
                </div>
                <div className="flex h-5 items-end gap-1" style={{ color: st.color }}>
                  {[16, 24, 12, 28, 18, 22, 14, 26, 12, 20].map((h, i) => (
                    <span key={i} className="ai-wave-bar" style={{ height: liveStatus === 'processing' ? 6 : h, background: st.color }} />
                  ))}
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: st.color }}>{st.label}</span>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {msgs.map((m, i) => (
                <div key={i} className={`ai-fade-up flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    m.role === 'user' ? 'bg-brand-blue text-white' : m.error ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-700'
                  }`}>{m.text}</div>
                </div>
              ))}
              {loading && !liveOn && (
                <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="ai-spin" /> Thinking…</div>
              )}
              {msgs.length === 1 && !liveOn && (
                <div className="space-y-1.5 pt-1">
                  {SUGGESTIONS.map((q) => (
                    <button key={q} onClick={() => { setInput(q); inputRef.current = q; }}
                      className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left text-xs text-slate-600 transition-colors hover:border-brand-blue/40 hover:bg-slate-50">
                      {q}
                    </button>
                  ))}
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Input */}
            {!liveOn && (
              <div className="border-t border-slate-100 p-3">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 pl-3">
                  <input value={input} onChange={(e) => { setInput(e.target.value); inputRef.current = e.target.value; }}
                    onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Type or use the mic…"
                    className="w-full bg-transparent py-2.5 text-sm outline-none" />
                  <button onClick={toggleMicType} title="Speak to type"
                    className={`grid h-8 w-8 place-items-center rounded-lg ${micTyping ? 'ai-mic-pulse bg-rose-50 text-rose-500' : 'text-slate-400 hover:text-slate-600'}`}>
                    {micTyping ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                  <button onClick={send} disabled={loading || !input.trim()} className="grid h-8 w-8 place-items-center rounded-lg text-brand-blue disabled:opacity-40">
                    <Send size={16} />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
