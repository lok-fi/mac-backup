import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Send, X, Loader2, Volume2, VolumeX, Radio, Square, Mic } from 'lucide-react'
import { AGENT_URL, AGENT_SECRET } from '../config'
import { buildDataSummary } from './buildSummary'
import { computePanel, normalizePanel, fmtNum } from './aggregate'
import { GeminiLiveSession, speakTextViaLive } from './GeminiLiveSession'

const STATUS = {
  listening: { label: 'Listening…', color: '#06b6d4' },
  processing: { label: 'Processing…', color: '#7c3aed' },
  speaking: { label: 'Speaking…', color: '#10b981' },
}

// Generic live tools — delegate data/chart work to the analyst, plus page nav.
const LIVE_TOOLS = [{
  functionDeclarations: [
    { name: 'navigatePage', description: "Switch the dashboard to a page by title, or 'AI Insights'.", parameters: { type: 'OBJECT', properties: { page: { type: 'STRING' } }, required: ['page'] } },
    { name: 'askAnalyst', description: 'Delegate any data question, calculation, ranking, comparison, or chart/KPI request to the analyst (it has the full data, computes precisely, and renders charts). Read back the answer it returns.', parameters: { type: 'OBJECT', properties: { question: { type: 'STRING' } }, required: ['question'] } },
  ],
}]

export default function DemoAssistant({ spec, tablesByName, onVisualize, onNavigate, accent = '#2563eb' }) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState([{ role: 'assistant', text: 'Ask me about this data, say "chart revenue by region", or hit Live to talk.' }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [muted, setMuted] = useState(false)
  const [liveOn, setLiveOn] = useState(false)
  const [liveStatus, setLiveStatus] = useState('listening')
  const listRef = useRef(null)
  const liveRef = useRef(null)
  const ttsRef = useRef(null)
  const msgsRef = useRef(msgs)
  useEffect(() => { msgsRef.current = msgs }, [msgs])
  // Scroll ONLY the message list (not the page) — scrollIntoView would scroll every
  // ancestor, nudging the whole landing page.
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight }, [msgs, open])

  const cancelTTS = useCallback(() => { ttsRef.current?.cancel(); ttsRef.current = null }, [])
  const speak = useCallback((t) => { if (muted || liveOn || !t) return; cancelTTS(); try { ttsRef.current = speakTextViaLive(t) } catch (_) {} }, [muted, liveOn, cancelTTS])

  // Call the ADK agent (Cloud Run, CORS-open) with the in-code data summary.
  const askAgent = useCallback(async (question, history = []) => {
    const summary = buildDataSummary(spec, tablesByName)
    const res = await fetch(`${AGENT_URL}/ask`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-ODD-Secret': AGENT_SECRET },
      body: JSON.stringify({ question, spec, history, summary, profile: {} }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || data.error || 'AI request failed')
    return data
  }, [spec, tablesByName])

  const applyActions = useCallback((actions) => {
    for (const a of actions || []) {
      if (a.type === 'visualize' && a.spec) onVisualize?.({ ...a.spec, append: !!a.append })
      else if (a.type === 'navigate') onNavigate?.(a.pageId || a.page)
    }
  }, [onVisualize, onNavigate])

  const sendText = useCallback(async () => {
    const q = input.trim(); if (!q || busy) return
    setInput('')
    const history = msgsRef.current.map((m) => ({ role: m.role, text: m.text }))
    setMsgs((m) => [...m, { role: 'user', text: q }]); setBusy(true)
    try {
      const data = await askAgent(q, history)
      setMsgs((m) => [...m, { role: 'assistant', text: data.reply || 'Done.' }])
      speak(data.reply); applyActions(data.actions)
    } catch (err) {
      setMsgs((m) => [...m, { role: 'assistant', text: `Sorry — ${err.message}`, error: true }])
    } finally { setBusy(false) }
  }, [input, busy, askAgent, speak, applyActions])

  // Live → delegate to analyst, render its chart, compute exact values to read back.
  const delegateToAnalyst = useCallback(async (question) => {
    setMsgs((m) => [...m, { role: 'user', text: question }])
    const data = await askAgent(question)
    applyActions(data.actions)
    const lines = []
    const viz = (data.actions || []).find((a) => a.type === 'visualize')
    for (const pnl of (viz?.spec?.panels || []).slice(0, 6)) {
      try {
        const rows = (pnl.table && tablesByName[pnl.table]) || Object.values(tablesByName).flat()
        const c = computePanel(normalizePanel(pnl), rows)
        if (c.kpi != null) lines.push(`${pnl.title}: ${fmtNum(c.kpi)}`)
        else if (c.data?.length && c.series?.[0]) lines.push(`${pnl.title} — ` + c.data.slice(0, 6).map((d) => `${d[c.dimKey]}: ${fmtNum(d[c.series[0].key])}`).join(', '))
      } catch (_) {}
    }
    setMsgs((m) => [...m, { role: 'assistant', text: data.reply || 'Done.' }])
    return { answer: data.reply || 'Done.', data: lines.join(' | ') }
  }, [askAgent, applyActions, tablesByName])

  const toggleLive = useCallback(async () => {
    if (liveOn) { setLiveOn(false); setLiveStatus('listening'); await liveRef.current?.stop(); liveRef.current = null; return }
    cancelTTS(); setLiveStatus('listening'); setLiveOn(true)
    const summary = buildDataSummary(spec, tablesByName)
    const systemInstruction = `You are the voice assistant inside an FI Digital ODD demo dashboard. Answer concisely in natural, spoken language.
LANGUAGE: Detect the language the user speaks and ALWAYS reply in that SAME language, including Indian languages such as Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Odia and Urdu. The askAnalyst tool returns English — translate its answer naturally into the user's language when reading it back, keeping numbers/units intact.
For ANY data question, calculation, ranking, comparison, or chart/KPI request, call askAnalyst with the user's request and read back its answer/data. Use navigatePage to switch pages. Never invent numbers.

${summary}`
    const session = new GeminiLiveSession({
      systemInstruction, tools: LIVE_TOOLS,
      onAudioOutput: () => setLiveStatus('speaking'),
      onInterrupted: () => setLiveStatus('listening'),
      onTurnComplete: () => setLiveStatus('listening'),
      onTranscription: (text, isModel) => {
        if (!isModel) { setLiveStatus('processing'); setMsgs((m) => [...m, { role: 'user', text }]) }
        else setMsgs((m) => [...m, { role: 'assistant', text }])
      },
      onToolCall: async (name, args) => {
        if (name === 'navigatePage') { onNavigate?.(args.page); return { success: true } }
        if (name === 'askAnalyst') { try { return await delegateToAnalyst(args.question || '') } catch (e) { return { answer: 'Could not complete that.' } } }
        return { success: true }
      },
    })
    liveRef.current = session
    try { await session.connect(); await session.startMic() }
    catch (err) { setMsgs((m) => [...m, { role: 'assistant', text: `Live error: ${err.message}`, error: true }]); setLiveOn(false); liveRef.current = null }
  }, [liveOn, spec, tablesByName, cancelTTS, onNavigate, delegateToAnalyst])

  const st = STATUS[liveStatus]

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`absolute bottom-4 right-4 z-30 grid h-12 w-12 place-items-center rounded-full text-white shadow-xl ${liveOn ? 'ai-fab-live' : ''}`}
        style={{ background: `linear-gradient(135deg, ${accent}, #7c3aed)` }}
        aria-label="AI assistant"
      >
        {open ? <X size={20} /> : <Sparkles size={20} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }}
            className="absolute bottom-20 right-4 z-30 flex h-[24rem] w-[min(92%,22rem)] flex-col overflow-hidden rounded-2xl border bg-white/95 shadow-2xl backdrop-blur"
            style={{ borderColor: liveOn ? st.color : '#e2e8f0' }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ background: `linear-gradient(135deg, ${accent}, #7c3aed)` }}><Sparkles size={13} /></span>
                <div className="text-sm font-bold text-slate-800">ODD Assistant</div>
                {liveOn && <span className="ai-blink h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => { setMuted((m) => !m); cancelTTS() }} title={muted ? 'Unmute' : 'Mute'} className={`grid h-7 w-7 place-items-center rounded-lg ${muted ? 'text-slate-300' : 'text-brand-blue'}`}>
                  {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
                <button onClick={toggleLive} title={liveOn ? 'Stop Live' : 'Start Live'} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold" style={{ background: liveOn ? `${st.color}1a` : '#f1f5f9', color: liveOn ? st.color : '#475569' }}>
                  {liveOn ? <Square size={11} /> : <Radio size={11} />} {liveOn ? 'Stop' : 'Live'}
                </button>
              </div>
            </div>

            {liveOn && (
              <div className="flex flex-col items-center gap-2 border-b border-slate-100 py-3">
                <div className="relative grid h-20 w-20 place-items-center overflow-hidden">
                  <span className="ai-ring absolute h-14 w-14 rounded-full border-2" style={{ borderColor: st.color }} />
                  <span className="ai-ring2 absolute h-14 w-14 rounded-full border-2" style={{ borderColor: st.color }} />
                  <div className="relative grid h-11 w-11 place-items-center rounded-full" style={{ background: `${st.color}1a`, border: `2px solid ${st.color}55`, color: st.color }}>
                    {liveStatus === 'processing' ? <Loader2 size={18} className="ai-spin" /> : liveStatus === 'speaking' ? <Volume2 size={18} /> : <Mic size={18} />}
                  </div>
                </div>
                <div className="flex h-4 items-end gap-1" style={{ color: st.color }}>
                  {[14, 20, 10, 24, 16, 18, 12, 22, 10, 16].map((h, i) => <span key={i} className="ai-wave-bar" style={{ height: liveStatus === 'processing' ? 5 : h, background: st.color }} />)}
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: st.color }}>{st.label}</span>
              </div>
            )}

            <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3 py-3">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${m.role === 'user' ? 'text-white' : m.error ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-700'}`} style={m.role === 'user' ? { background: accent } : undefined}>{m.text}</div>
                </div>
              ))}
              {busy && <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="ai-spin" /> Thinking…</div>}
            </div>

            {!liveOn && (
              <div className="border-t border-slate-100 p-2.5">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                  <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendText()} placeholder="Ask or chart something…" className="w-full bg-transparent py-2 text-sm outline-none" />
                  <button onClick={sendText} disabled={busy || !input.trim()} className="text-brand-blue disabled:opacity-40"><Send size={16} /></button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
