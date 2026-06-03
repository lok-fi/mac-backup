import { motion } from 'framer-motion'
import { Database, BrainCircuit, LayoutDashboard, MessagesSquare } from 'lucide-react'
import { SectionHeading } from './Section'

const pillars = [
  {
    icon: Database,
    title: 'Any data, in',
    text: 'Upload Excel, CSV, PDF or JSON — or connect a live source through MCP. No schemas, no setup.',
    color: 'from-brand-cyan to-brand-blue',
  },
  {
    icon: BrainCircuit,
    title: 'AI understands it',
    text: 'ODD reads your data, infers what matters, and decides the right metrics, charts and breakdowns.',
    color: 'from-brand-blue to-brand-violet',
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboards, out',
    text: 'A complete multi-page dashboard is generated automatically — KPIs, trends, segments and more.',
    color: 'from-brand-violet to-brand-blue',
  },
  {
    icon: MessagesSquare,
    title: 'Just ask for more',
    text: 'A built-in AI assistant lets you add KPIs, new pages or any view — in plain language.',
    color: 'from-brand-blue to-brand-cyan',
  },
]

export default function WhatIsODD() {
  return (
    <section id="what" className="relative z-10 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="What is ODD"
          title="On Demand Dashboards"
          sub="ODD turns raw data into living, interactive dashboards — built by AI, in seconds. No analysts, no dashboard-building, no waiting. Bring data, get insight."
        />

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/5 dark:border-white/10 dark:bg-slate-900/50"
            >
              <div className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${p.color} text-white shadow-lg`}>
                <p.icon size={22} />
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{p.text}</p>
              <span className="absolute right-4 top-5 text-5xl font-black text-slate-100 transition-colors group-hover:text-slate-200/70 dark:text-white/5 dark:group-hover:text-white/10">
                {i + 1}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
