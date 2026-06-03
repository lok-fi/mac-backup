import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, FileSpreadsheet, Plug } from 'lucide-react'
import DashboardMockup from './DashboardMockup'
import { openBookDemo } from './BookDemoModal'

const fade = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.1 * i, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  }),
}

export default function Hero() {
  return (
    <section id="top" className="relative pb-24 pt-36 sm:pt-44">
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <motion.a
          href="#what"
          variants={fade}
          initial="hidden"
          animate="show"
          custom={0}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
        >
          <Sparkles size={13} className="text-brand-violet" />
          Dashboards built by AI — on demand
        </motion.a>

        <motion.h1
          variants={fade}
          initial="hidden"
          animate="show"
          custom={1}
          className="mt-7 text-5xl font-black leading-[1.05] tracking-tight text-slate-900 dark:text-white sm:text-7xl"
        >
          Dashboards That
          <br />
          <span className="text-gradient animate-gradient-x">Build Themselves.</span>
        </motion.h1>

        <motion.p
          variants={fade}
          initial="hidden"
          animate="show"
          custom={2}
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400"
        >
          Drop in any file — Excel, CSV, PDF — or connect a live source. ODD's AI reads,
          analyses and assembles a full interactive dashboard in seconds. Then just
          <span className="font-semibold text-slate-800 dark:text-slate-200"> ask </span>
          for more.
        </motion.p>

        <motion.div
          variants={fade}
          initial="hidden"
          animate="show"
          custom={3}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <button
            type="button"
            onClick={openBookDemo}
            className="group flex items-center gap-2 rounded-2xl bg-brand-blue px-7 py-3.5 text-base font-semibold text-white shadow-xl shadow-brand-blue/30 transition-all hover:bg-brand-blueDark hover:shadow-2xl"
          >
            Book a Demo
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </button>
          <a
            href="#how"
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/60 px-7 py-3.5 text-base font-semibold text-slate-700 backdrop-blur transition-colors hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            See how it works
          </a>
        </motion.div>

        <motion.div
          variants={fade}
          initial="hidden"
          animate="show"
          custom={4}
          className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500 dark:text-slate-500"
        >
          <span className="flex items-center gap-1.5"><FileSpreadsheet size={13} /> Excel · CSV · PDF · JSON</span>
          <span className="flex items-center gap-1.5"><Plug size={13} /> Live MCP connect (Zoho)</span>
          <span className="flex items-center gap-1.5"><Sparkles size={13} /> Built-in AI assistant</span>
        </motion.div>
      </div>

      {/* Floating mockup */}
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.6, duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 mx-auto mt-16 max-w-3xl px-6"
      >
        <div className="absolute inset-x-10 -top-6 bottom-0 rounded-3xl bg-gradient-to-tr from-brand-cyan/20 via-brand-blue/20 to-brand-violet/20 blur-2xl" />
        <div className="relative animate-float">
          <DashboardMockup />
        </div>
      </motion.div>
    </section>
  )
}
