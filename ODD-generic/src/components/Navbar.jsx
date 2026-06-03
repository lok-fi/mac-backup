import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Moon, Sun, ArrowUpRight, BarChart3, Menu, X } from 'lucide-react'
import { COMPANY } from '../config'
import { openBookDemo } from './BookDemoModal'

const LINKS = [
  { label: 'What is ODD', href: '#what' },
  { label: 'How it works', href: '#how' },
  { label: 'Features', href: '#features' },
  { label: 'Industries', href: '#industries' },
  { label: 'FAQ', href: '#faq' },
]

export default function Navbar({ theme, toggle }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <nav
        className={`w-full border-b transition-all duration-300 ${
          scrolled
            ? 'glass border-slate-200/70 bg-white/80 shadow-sm shadow-slate-900/5 dark:border-white/10 dark:bg-slate-900/70'
            : 'border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo */}
        <a href="#top" className="flex items-center">
          <img src="/fi-logo.png" alt="FI Digital" className="h-8 w-auto dark:brightness-0 dark:invert" />
        </a>

        {/* Center links */}
        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            type="button"
            onClick={openBookDemo}
            className="group hidden items-center gap-1.5 rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand-blue/30 transition-all hover:bg-brand-blueDark hover:shadow-lg sm:flex"
          >
            Book a Demo
            <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300 md:hidden"
          >
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass absolute top-16 mx-4 w-[calc(100%-2rem)] max-w-5xl rounded-2xl border border-slate-200/70 bg-white/90 p-3 shadow-xl dark:border-white/10 dark:bg-slate-900/90 md:hidden"
        >
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
            >
              {l.label}
            </a>
          ))}
          <button
            type="button"
            onClick={() => { setOpen(false); openBookDemo() }}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white"
          >
            Book a Demo <ArrowUpRight size={15} />
          </button>
        </motion.div>
      )}
    </motion.header>
  )
}
