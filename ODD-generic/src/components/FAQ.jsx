import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import { SectionHeading } from './Section'

const faqs = [
  {
    q: 'What kinds of files can I upload?',
    a: 'Excel, CSV, PDF and JSON today. ODD parses structured and semi-structured data, infers the schema, and builds dashboards without any manual mapping.',
  },
  {
    q: 'How does the live MCP connection work?',
    a: 'Paste your MCP link (Zoho is supported now) and ODD securely accesses that source to pull live data. Dashboards then refresh from the source on demand.',
  },
  {
    q: 'Do I need to know how to build dashboards?',
    a: 'No. ODD’s AI decides the right metrics, charts and pages for your data automatically. You only step in if you want to — by asking the assistant.',
  },
  {
    q: 'What can the AI assistant actually do?',
    a: 'Almost anything: add a KPI, create a new page, change a breakdown, filter a segment, or reshape a chart — all in plain language, live on the dashboard.',
  },
  {
    q: 'Is my data safe?',
    a: 'Your data is used only to build your dashboards. It is never shared or sold, and connections are handled securely.',
  },
]

function Item({ faq, open, onToggle }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 transition-colors dark:border-white/10 dark:bg-slate-900/50">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-[15px] font-semibold text-slate-900 dark:text-white">{faq.q}</span>
        <motion.span animate={{ rotate: open ? 45 : 0 }} className="shrink-0 text-brand-blue dark:text-brand-cyan">
          <Plus size={20} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{faq.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function FAQ() {
  const [open, setOpen] = useState(0)
  return (
    <section id="faq" className="relative z-10 py-24">
      <div className="mx-auto max-w-3xl px-6">
        <SectionHeading eyebrow="FAQ" title="Questions, answered" />
        <div className="mt-12 space-y-3">
          {faqs.map((f, i) => (
            <Item key={f.q} faq={f} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
          ))}
        </div>
      </div>
    </section>
  )
}
