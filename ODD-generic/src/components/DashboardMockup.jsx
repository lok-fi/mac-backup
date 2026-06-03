import { motion } from 'framer-motion'
import { Sparkles, TrendingUp, Activity } from 'lucide-react'

// A faux, animated dashboard preview used in the hero.
const bars = [42, 68, 55, 80, 62, 95, 74]

export default function DashboardMockup() {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/40">
      {/* Top bar */}
      <div className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-3 dark:border-white/5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <div className="ml-3 flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-500 dark:bg-white/5 dark:text-slate-400">
          <Sparkles size={10} className="text-brand-violet" />
          AI generated · Revenue dashboard
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 p-4">
        {/* KPI cards */}
        {[
          { label: 'Revenue', value: '$1.24M', delta: '+12.4%', icon: TrendingUp },
          { label: 'Active Users', value: '38,212', delta: '+8.1%', icon: Activity },
          { label: 'Conversion', value: '6.7%', delta: '+1.2%', icon: TrendingUp },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-white/5 dark:bg-white/[0.03]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{kpi.label}</span>
              <kpi.icon size={12} className="text-brand-blue" />
            </div>
            <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{kpi.value}</div>
            <div className="text-[10px] font-semibold text-emerald-500">{kpi.delta}</div>
          </motion.div>
        ))}

        {/* Bar chart */}
        <div className="col-span-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-white/5 dark:bg-white/[0.03]">
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Weekly performance</span>
          <div className="mt-3 flex h-24 items-end justify-between gap-1.5">
            {bars.map((h, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                whileInView={{ height: `${h}%` }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 + i * 0.07, duration: 0.6, ease: 'easeOut' }}
                className="w-full rounded-t bg-gradient-to-t from-brand-blue to-brand-cyan"
              />
            ))}
          </div>
        </div>

        {/* Donut-ish */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-white/5 dark:bg-white/[0.03]">
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Channels</span>
          <div className="mt-2 grid place-items-center">
            <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="4" />
              <motion.circle
                cx="18" cy="18" r="15.9" fill="none" stroke="#2563eb" strokeWidth="4"
                strokeLinecap="round" strokeDasharray="100"
                initial={{ strokeDashoffset: 100 }}
                whileInView={{ strokeDashoffset: 32 }}
                viewport={{ once: true }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
