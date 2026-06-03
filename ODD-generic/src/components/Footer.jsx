import { motion } from 'framer-motion'
import { ArrowRight, BarChart3 } from 'lucide-react'
import { openBookDemo } from './BookDemoModal'

export default function Footer() {
  return (
    <footer className="relative z-10">
      {/* Final CTA banner */}
      <div className="mx-auto max-w-6xl px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-cyan via-brand-blue to-brand-violet px-8 py-16 text-center text-white shadow-2xl shadow-brand-blue/30"
        >
          {/* subtle moving sheen */}
          <motion.div
            className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_55%)]"
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 6, repeat: Infinity }}
          />
          <div className="relative">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Bring data. Get dashboards.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/90">
              No setup, no analysts, no waiting. Book a demo and watch your first dashboard
              build itself.
            </p>
            <button
              type="button"
              onClick={openBookDemo}
              className="group mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-3.5 text-base font-bold text-brand-blue shadow-lg transition-transform hover:scale-[1.03]"
            >
              Book a Demo
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Footer bar */}
      <div className="border-t border-slate-200 dark:border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center">
            <img src="/fi-logo.png" alt="FI Digital" className="h-7 w-auto dark:brightness-0 dark:invert" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-500">
            © {2026} FI Digitals · On Demand Dashboards. All rights reserved.
          </p>
          <div className="flex items-center gap-5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <a href="#what" className="hover:text-slate-900 dark:hover:text-white">About ODD</a>
            <a href="#features" className="hover:text-slate-900 dark:hover:text-white">Features</a>
            <button type="button" onClick={openBookDemo} className="hover:text-slate-900 dark:hover:text-white">Book a Demo</button>
          </div>
        </div>
      </div>
    </footer>
  )
}
