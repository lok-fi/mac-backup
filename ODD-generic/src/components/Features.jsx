import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileStack, Plug, Sparkles, MessagesSquare, Layers, Gauge, ShieldCheck, Share2, Check, FileSpreadsheet, FileText, Database } from 'lucide-react'
import { SectionHeading } from './Section'

const AUTO_MS = 4600
const vfade = { initial: { opacity: 0, scale: 0.97 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.98 }, transition: { duration: 0.4 } }

/* ── Feature previews (shown in the big panel) ─────────────────────────────── */
function PreviewUpload() {
  const chips = [{ I: FileSpreadsheet, n: 'sales.xlsx', c: '#10b981' }, { I: FileText, n: 'q3.pdf', c: '#f43f5e' }, { I: Database, n: 'crm.csv', c: '#2563eb' }]
  return (
    <motion.div {...vfade} className="flex h-full flex-col justify-center gap-4">
      <div className="flex justify-center gap-2.5">
        {chips.map((f, i) => (
          <motion.div key={f.n} animate={{ y: [0, -7, 0] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.25 }}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-800 dark:text-slate-300">
            <f.I size={14} style={{ color: f.c }} /> {f.n}
          </motion.div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-800">
        <div className="grid grid-cols-4 gap-1.5 text-[9px] font-bold uppercase text-slate-400">
          {['Region', 'Product', 'Sales', 'Units'].map((h) => <div key={h}>{h}</div>)}
        </div>
        {[['North', 'Widget', '1,200', '40'], ['South', 'Gadget', '2,500', '80'], ['East', 'Widget', '1,750', '55']].map((row, ri) => (
          <motion.div key={ri} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + ri * 0.12 }}
            className="mt-1.5 grid grid-cols-4 gap-1.5 border-t border-slate-100 pt-1.5 text-[11px] text-slate-700 dark:border-white/5 dark:text-slate-200">
            {row.map((c, ci) => <div key={ci}>{c}</div>)}
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
function PreviewConnect() {
  return (
    <motion.div {...vfade} className="flex h-full flex-col justify-center gap-4">
      <div className="flex items-center justify-center">
        <div className="grid h-12 w-12 place-items-center rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-brand-blue shadow-sm dark:border-white/10 dark:bg-slate-800">Zoho</div>
        <div className="relative mx-1 h-1 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
          <motion.div className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-brand-cyan to-brand-violet" animate={{ x: ['-40%', '320%'] }} transition={{ duration: 1.4, repeat: Infinity }} />
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand-cyan via-brand-blue to-brand-violet text-white shadow-md"><Plug size={20} /></div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-white/10 dark:bg-slate-800">
        {['Deal #4821 · synced', 'Account: Acme · synced', 'Invoice #209 · synced'].map((t, i) => (
          <motion.div key={t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.25 }}
            className="flex items-center gap-2 border-b border-slate-100 py-1.5 text-[11px] text-slate-600 last:border-0 dark:border-white/5 dark:text-slate-300">
            <Check size={12} className="text-emerald-500" /> {t}
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
function PreviewBuild() {
  const bars = [50, 78, 42, 92, 64, 84]
  return (
    <motion.div {...vfade} className="flex h-full flex-col gap-2.5">
      <div className="grid grid-cols-3 gap-2">
        {['$1.2M', '38K', '4.1%'].map((v, i) => (
          <motion.div key={v} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-white/10 dark:bg-slate-800">
            <div className="text-[8px] font-semibold uppercase text-slate-400">{['Revenue', 'Users', 'Churn'][i]}</div>
            <div className="text-base font-black" style={{ color: ['#2563eb', '#7c3aed', '#10b981'][i] }}>{v}</div>
          </motion.div>
        ))}
      </div>
      <div className="flex flex-1 items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-800">
        {bars.map((h, i) => <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 0.25 + i * 0.07, duration: 0.6 }} className="w-full rounded-t" style={{ background: ['#2563eb', '#06b6d4', '#7c3aed', '#10b981', '#f59e0b', '#f43f5e'][i] }} />)}
      </div>
    </motion.div>
  )
}
function PreviewChat() {
  return (
    <motion.div {...vfade} className="flex h-full flex-col justify-center gap-2.5 px-2">
      <div className="self-end rounded-2xl rounded-br-sm bg-brand-blue px-3.5 py-2 text-[12px] font-medium text-white shadow">Add a churn KPI and a regional breakdown</div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex items-center gap-2 self-start rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2 text-[12px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        <Sparkles size={13} className="text-brand-violet" /> Done — added both. Anything else?
      </motion.div>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.8 }} className="mt-1 flex items-end gap-1.5 self-start rounded-xl border border-slate-200 bg-white p-2.5 dark:border-white/10 dark:bg-slate-800">
        {[40, 70, 55, 85, 60].map((h, i) => <div key={i} className="w-3.5 rounded-t bg-gradient-to-t from-brand-blue to-brand-cyan" style={{ height: h / 2 }} />)}
      </motion.div>
    </motion.div>
  )
}
function PreviewPages() {
  const tabs = ['Overview', 'Trends', 'Segments']
  const [t, setT] = useState(0)
  useEffect(() => { const id = setInterval(() => setT((x) => (x + 1) % 3), 1300); return () => clearInterval(id) }, [])
  return (
    <motion.div {...vfade} className="flex h-full flex-col gap-2.5">
      <div className="flex gap-1.5">
        {tabs.map((tb, i) => <div key={tb} className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${i === t ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-500 dark:bg-white/5'}`}>{tb}</div>)}
      </div>
      <div className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-800">
        <AnimatePresence mode="wait">
          {t === 0 && <motion.div key="o" {...vfade} className="flex w-full items-end gap-2">{[60, 85, 50, 75].map((h, i) => <div key={i} className="h-20 w-full rounded-t bg-gradient-to-t from-brand-blue to-brand-cyan" style={{ height: h }} />)}</motion.div>}
          {t === 1 && <motion.svg key="t" {...vfade} viewBox="0 0 200 80" className="w-full"><polyline fill="none" stroke="#2563eb" strokeWidth="3" points="0,60 40,40 80,50 120,20 160,30 200,12" /></motion.svg>}
          {t === 2 && <motion.div key="s" {...vfade} className="h-24 w-24 rounded-full" style={{ background: 'conic-gradient(#2563eb 0 35%, #06b6d4 35% 60%, #7c3aed 60% 80%, #10b981 80% 100%)' }} />}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

const FEATURES = [
  { icon: FileStack, title: 'Upload anything', text: 'Excel, CSV, PDF, JSON — ODD parses messy real-world files and structures them automatically.', Preview: PreviewUpload },
  { icon: Plug, title: 'Live MCP connect', text: 'Connect Zoho via an MCP link and stream live data straight into dashboards.', Preview: PreviewConnect },
  { icon: Sparkles, title: 'AI auto-build', text: 'The model picks the metrics, charts and layout and assembles a finished dashboard — zero config.', Preview: PreviewBuild },
  { icon: MessagesSquare, title: 'Conversational assistant', text: 'Ask for a KPI, a page or a breakdown — the dashboard updates as you speak, by text or voice.', Preview: PreviewChat },
  { icon: Layers, title: 'Multi-page dashboards', text: 'Auto-organised into overview, trends, segments and detail pages you can flip through.', Preview: PreviewPages },
]

const EXTRAS = [
  { icon: Gauge, label: 'Real-time KPIs' },
  { icon: Share2, label: 'Present-ready' },
  { icon: ShieldCheck, label: 'Private & secure' },
]

export default function Features() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const id = setTimeout(() => setActive((a) => (a + 1) % FEATURES.length), AUTO_MS)
    return () => clearTimeout(id)
  }, [active, paused])

  const Preview = FEATURES[active].Preview

  return (
    <section id="features" className="relative z-10 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading eyebrow="Features" title="Everything you need, nothing to configure" sub="ODD packs the full analytics workflow into a single, AI-driven experience." />

        <div
          className="mt-14 grid items-center gap-10 lg:grid-cols-2"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Feature list */}
          <div className="flex flex-col gap-2">
            {FEATURES.map((f, i) => {
              const on = i === active
              return (
                <button key={f.title} onClick={() => setActive(i)} className="text-left">
                  <div className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${on ? 'border-brand-blue/40 bg-white shadow-md dark:border-brand-cyan/30 dark:bg-slate-900/70' : 'border-transparent hover:bg-white/60 dark:hover:bg-white/5'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-all ${on ? 'text-white shadow-md' : 'bg-slate-100 text-slate-400 dark:bg-white/5'}`} style={on ? { background: 'linear-gradient(135deg,#06b6d4,#2563eb,#7c3aed)' } : undefined}>
                        <f.icon size={18} />
                      </div>
                      <h3 className={`text-base font-bold ${on ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>{f.title}</h3>
                    </div>
                    <AnimatePresence initial={false}>
                      {on && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                          <p className="pt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400" style={{ paddingLeft: 52 }}>{f.text}</p>
                          {/* auto-advance progress */}
                          <div className="mt-3 ml-[52px] h-0.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                            <motion.div key={active + String(paused)} className="h-full rounded-full bg-gradient-to-r from-brand-cyan via-brand-blue to-brand-violet"
                              initial={{ width: '0%' }} animate={{ width: paused ? '0%' : '100%' }} transition={{ duration: paused ? 0 : AUTO_MS / 1000, ease: 'linear' }} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </button>
              )
            })}

            <div className="mt-3 flex flex-wrap gap-2">
              {EXTRAS.map((e) => (
                <span key={e.label} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/60 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  <e.icon size={13} className="text-brand-blue dark:text-brand-cyan" /> {e.label}
                </span>
              ))}
            </div>
          </div>

          {/* Big animated preview */}
          <div className="lg:sticky lg:top-28">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-white/10 dark:bg-slate-900">
              <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-white/5 dark:bg-slate-800/60">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="ml-2 text-[11px] font-semibold text-slate-400">{FEATURES[active].title}</span>
              </div>
              <div className="relative h-[320px] p-5">
                <AnimatePresence mode="wait">
                  <div key={active} className="absolute inset-5"><Preview /></div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
