import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Landmark, HeartPulse, ShoppingCart, Factory, ArrowUpRight, Play, MousePointerClick } from 'lucide-react'
import { ODD_APP_URL } from '../config'
import { SectionHeading } from './Section'
import { getDemos } from '../demo/demosData'
import DemoDashboard from '../demo/DemoDashboard'

// 4 industries shown as tabs; the live demo dashboard is embedded in a window below.
// Self = interact with the live dashboard (iframe). Auto = looping dashboard video.
const TABS = [
  { id: 'finance', label: 'BFSI', icon: Landmark },
  { id: 'healthcare', label: 'Healthcare', icon: HeartPulse },
  { id: 'retail', label: 'Retail', icon: ShoppingCart },
  { id: 'manufacturing', label: 'Manufacturing', icon: Factory },
]

export default function Industries() {
  const [active, setActive] = useState('finance')
  const [mode, setMode] = useState('self') // self | auto
  const [videoOk, setVideoOk] = useState(true)

  const demos = useMemo(() => {
    const m = {}
    getDemos().forEach((d) => { m[d.id] = d })
    return m
  }, [])

  const tab = TABS.find((t) => t.id === active)
  const activeDemo = demos[active]
  const liveUrl = `${ODD_APP_URL}/d/demo_${active}`
  const videoUrl = '/demo-videos/demo.mp4' // single walkthrough video, shared by all industries

  const switchTab = (id) => { setActive(id); setVideoOk(true) }

  return (
    <section id="industries" className="relative z-10 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Industries"
          title="See ODD live for your industry"
          sub="Pick an industry and explore a real, interactive dashboard right here — or watch it run on auto."
        />

        {/* Control bar — industry tabs + mode toggle */}
        <div className="mx-auto mt-10 flex max-w-6xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
          <div className="flex items-center gap-1.5">
            <span className="px-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Industry</span>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                  active === t.id ? 'bg-brand-blue text-white shadow' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                }`}
              >
                <t.icon size={15} /> <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Mode</span>
            <div className="flex rounded-xl bg-slate-100 p-0.5 dark:bg-white/5">
              {[
                { id: 'self', label: 'Self', icon: MousePointerClick },
                { id: 'auto', label: 'Auto', icon: Play },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    mode === m.id ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  }`}
                >
                  <m.icon size={14} /> {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* App window */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="mx-auto mt-5 max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-white/10 dark:bg-slate-900"
        >
          {/* Title bar */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-white/5 dark:bg-slate-800/60">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="ml-3 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <tab.icon size={13} /> FI Digital — {tab.label} Dashboard
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${mode === 'auto' ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-blue/10 text-brand-blue'}`}>
                {mode === 'auto' ? '● Auto-play' : '● Interactive'}
              </span>
              <a href={liveUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-brand-blue">
                Open <ArrowUpRight size={13} />
              </a>
            </div>
          </div>

          {/* Body */}
          <div className="relative h-[600px] w-full bg-white">
            {mode === 'self' ? (
              activeDemo ? <DemoDashboard key={active} demo={activeDemo} /> : null
            ) : videoOk ? (
              <video
                key="auto-video"
                src={videoUrl}
                autoPlay
                loop
                muted
                playsInline
                onError={() => setVideoOk(false)}
                className="h-full w-full bg-slate-950 object-contain"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <Play size={32} className="text-slate-300" />
                <p className="max-w-xs text-sm text-slate-500">
                  Auto-play video for {tab.label} isn't added yet. Switch to <span className="font-semibold text-slate-700">Self</span> to interact, or
                  <a href={liveUrl} target="_blank" rel="noreferrer" className="ml-1 font-semibold text-brand-blue">open it live ↗</a>.
                </p>
              </div>
            )}
          </div>
        </motion.div>

        <p className="mx-auto mt-4 max-w-2xl text-center text-xs text-slate-400">
          <span className="font-semibold text-slate-500">Self</span> runs the dashboard right here — switch tabs and ask the AI.
          <span className="font-semibold text-slate-500"> Auto</span> plays a recorded walkthrough. Want the full app?
          <a href={liveUrl} target="_blank" rel="noreferrer" className="ml-1 font-semibold text-brand-blue">open it live ↗</a>.
        </p>
      </div>
    </section>
  )
}
