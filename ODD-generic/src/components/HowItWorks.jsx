import { useRef, useState } from 'react'
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion'
import { Upload, Plug, ScanSearch, LayoutDashboard, Wand2, FileSpreadsheet, FileText, Database, Sparkles, Check } from 'lucide-react'
import { SectionHeading } from './Section'

const steps = [
  { icon: Upload, tag: 'Upload', title: 'Bring your data', text: 'Drag in a spreadsheet, PDF or export — anything from a sales sheet to a financial report.' },
  { icon: Plug, tag: 'MCP Connect', title: 'Or connect live', text: 'Paste your MCP link (Zoho today) and ODD pulls fresh data straight from the source.' },
  { icon: ScanSearch, tag: 'Analyse', title: 'AI analyses', text: 'Columns are profiled, relationships found, and the right metrics chosen — automatically.' },
  { icon: LayoutDashboard, tag: 'Generate', title: 'Dashboard appears', text: 'A full multi-page dashboard is generated, ready to explore and present.' },
  { icon: Wand2, tag: 'Assistant', title: 'Refine by chat', text: '"Add a churn KPI", "break revenue down by region" — the AI assistant does it instantly.' },
]

const fade = { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.98 }, transition: { duration: 0.4 } }

// ── Per-step animated visuals (inside a device frame) ────────────────────────
function VisualUpload() {
  const files = [{ I: FileSpreadsheet, n: 'sales.xlsx', c: '#10b981' }, { I: FileText, n: 'report.pdf', c: '#f43f5e' }, { I: Database, n: 'export.csv', c: '#2563eb' }]
  return (
    <motion.div {...fade} className="flex h-full flex-col items-center justify-center gap-4">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-cyan via-brand-blue to-brand-violet text-white shadow-lg">
        <Upload size={26} />
      </div>
      <div className="flex gap-2.5">
        {files.map((f, i) => (
          <motion.div key={f.n} animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.25 }}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-800 dark:text-slate-300">
            <f.I size={14} style={{ color: f.c }} /> {f.n}
          </motion.div>
        ))}
      </div>
      <div className="text-xs font-medium text-slate-400">Drop any file — Excel · CSV · PDF · JSON</div>
    </motion.div>
  )
}

function VisualConnect() {
  return (
    <motion.div {...fade} className="flex h-full items-center justify-center gap-0">
      <div className="grid h-16 w-16 place-items-center rounded-2xl border border-slate-200 bg-white text-sm font-extrabold text-brand-blue shadow-sm dark:border-white/10 dark:bg-slate-800">Zoho</div>
      <div className="relative mx-1 h-1 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
        <motion.div className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-brand-cyan to-brand-violet"
          animate={{ x: ['-40%', '320%'] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />
      </div>
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-cyan via-brand-blue to-brand-violet text-white shadow-lg"><Plug size={24} /></div>
      <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
        className="ml-3 flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
        <Check size={12} /> Connected
      </motion.div>
    </motion.div>
  )
}

function VisualAnalyse() {
  const cells = Array.from({ length: 24 })
  return (
    <motion.div {...fade} className="relative grid h-full place-items-center">
      <div className="grid grid-cols-6 gap-2">
        {cells.map((_, i) => (
          <motion.div key={i} className="h-7 w-9 rounded-md bg-slate-100 dark:bg-white/5"
            animate={{ backgroundColor: ['#f1f5f9', '#dbeafe', '#f1f5f9'] }} transition={{ duration: 1.4, repeat: Infinity, delay: (i % 6) * 0.12 }} />
        ))}
      </div>
      <motion.div className="absolute left-0 right-0 mx-auto h-12 w-[88%] rounded-lg border-2 border-brand-blue/60 bg-brand-blue/5"
        animate={{ y: [-70, 70, -70] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />
      <div className="absolute bottom-3 flex items-center gap-1.5 text-xs font-semibold text-brand-blue dark:text-brand-cyan"><ScanSearch size={14} /> profiling columns…</div>
    </motion.div>
  )
}

function VisualDashboard() {
  const bars = [55, 80, 45, 95, 70, 60]
  return (
    <motion.div {...fade} className="flex h-full flex-col gap-2.5 p-1">
      <div className="grid grid-cols-3 gap-2">
        {['Revenue', 'Users', 'Churn'].map((k, i) => (
          <motion.div key={k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }}
            className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-white/10 dark:bg-slate-800">
            <div className="text-[9px] font-semibold uppercase text-slate-400">{k}</div>
            <div className="text-base font-black" style={{ color: ['#2563eb', '#7c3aed', '#10b981'][i] }}>{['$1.2M', '38K', '4.1%'][i]}</div>
          </motion.div>
        ))}
      </div>
      <div className="flex flex-1 items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-800">
        {bars.map((h, i) => (
          <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 0.3 + i * 0.08, duration: 0.6, ease: 'easeOut' }}
            className="w-full rounded-t" style={{ background: ['#2563eb', '#06b6d4', '#7c3aed', '#10b981', '#f59e0b', '#f43f5e'][i] }} />
        ))}
      </div>
    </motion.div>
  )
}

function VisualAssistant() {
  return (
    <motion.div {...fade} className="flex h-full flex-col justify-center gap-2.5 px-2">
      <div className="self-end rounded-2xl rounded-br-sm bg-brand-blue px-3.5 py-2 text-[12px] font-medium text-white shadow">Break revenue down by region</div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="flex items-center gap-2 self-start rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2 text-[12px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        <Sparkles size={13} className="text-brand-violet" /> Done — added a regional breakdown.
      </motion.div>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.8 }}
        className="mt-1 flex items-end gap-1.5 self-start rounded-xl border border-slate-200 bg-white p-2.5 dark:border-white/10 dark:bg-slate-800">
        {[40, 70, 55, 85].map((h, i) => <div key={i} className="w-4 rounded-t bg-gradient-to-t from-brand-blue to-brand-cyan" style={{ height: h / 2 }} />)}
      </motion.div>
    </motion.div>
  )
}

const VISUALS = [VisualUpload, VisualConnect, VisualAnalyse, VisualDashboard, VisualAssistant]

function DeviceFrame({ active }) {
  const Visual = VISUALS[active]
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-white/5 dark:bg-slate-800/60">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 text-[11px] font-semibold text-slate-400">ODD · step {active + 1} of {steps.length}</span>
      </div>
      <div className="relative h-[300px] p-5">
        <AnimatePresence mode="wait">
          <div key={active} className="absolute inset-5"><Visual /></div>
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function HowItWorks() {
  const ref = useRef(null)
  const [active, setActive] = useState(0)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    setActive(Math.max(0, Math.min(steps.length - 1, Math.floor(v * steps.length))))
  })

  return (
    <section id="how" className="relative z-10 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="How it works"
          title="From raw file to live dashboard in one flow"
          sub="Scroll through the pipeline — watch each stage come to life."
        />

        {/* Mobile: stacked steps with their own visual */}
        <div className="mt-12 space-y-10 lg:hidden">
          {steps.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5 }}>
              <DeviceFrame active={i} />
              <span className="mt-4 inline-block rounded-full bg-brand-blue/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-blue dark:bg-brand-cyan/10 dark:text-brand-cyan">{s.tag}</span>
              <h3 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{s.text}</p>
            </motion.div>
          ))}
        </div>

        {/* Desktop: sticky scrollytelling — device + text both centred and synced to scroll */}
        <div ref={ref} className="mt-8 hidden lg:block" style={{ height: `${steps.length * 80}vh` }}>
          <div className="sticky top-0 flex h-screen items-center">
            <div className="grid w-full grid-cols-2 items-center gap-14">
              {/* Morphing device */}
              <div>
                <DeviceFrame active={active} />
                <div className="mt-6 flex items-center gap-2">
                  {steps.map((_, i) => (
                    <button key={i} aria-label={`Step ${i + 1}`} className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                      <motion.div className="h-full rounded-full bg-gradient-to-r from-brand-cyan via-brand-blue to-brand-violet" animate={{ width: i <= active ? '100%' : '0%' }} transition={{ duration: 0.4 }} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Only the ACTIVE step's text — cross-fades as you scroll */}
              <div className="relative flex min-h-[320px] items-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active}
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -28 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="mb-4 flex items-baseline gap-2 font-black leading-none tracking-tight">
                      <span className="text-7xl" style={{ background: 'linear-gradient(135deg,#06b6d4,#2563eb,#7c3aed)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                        {String(active + 1).padStart(2, '0')}
                      </span>
                      <span className="text-xl text-slate-300 dark:text-white/20">/ {String(steps.length).padStart(2, '0')}</span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-blue/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-blue dark:bg-brand-cyan/10 dark:text-brand-cyan">
                      {(() => { const I = steps[active].icon; return <I size={12} /> })()} {steps[active].tag}
                    </span>
                    <h3 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{steps[active].title}</h3>
                    <p className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">{steps[active].text}</p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
