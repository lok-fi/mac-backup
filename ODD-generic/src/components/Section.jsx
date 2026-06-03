import { motion } from 'framer-motion'

export function SectionHeading({ eyebrow, title, sub, center = true }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6 }}
      className={`max-w-2xl ${center ? 'mx-auto text-center' : ''}`}
    >
      {eyebrow && (
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue dark:text-brand-cyan">
          {eyebrow}
        </span>
      )}
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
        {title}
      </h2>
      {sub && <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-400">{sub}</p>}
    </motion.div>
  )
}
