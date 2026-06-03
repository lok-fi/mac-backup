import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Loader2, CheckCircle2, CalendarDays } from 'lucide-react'
import { ODD_API_URL } from '../config'

// Open the Book-a-Demo modal from anywhere: openBookDemo()
const EVENT = 'odd:book-demo'
export function openBookDemo() {
  window.dispatchEvent(new Event(EVENT))
}

const EMPTY = { name: '', email: '', company: '', role: '', industry: '', message: '' }

export default function BookDemoModal() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onOpen = () => { setOpen(true); setDone(false); setError('') }
    window.addEventListener(EVENT, onOpen)
    return () => window.removeEventListener(EVENT, onOpen)
  }, [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e?.preventDefault()
    if (!form.name.trim() || !form.email.trim() || busy) return
    setBusy(true); setError('')
    const body = new URLSearchParams(form).toString()
    const url = `${ODD_API_URL}/request-demo`
    try {
      // Fire-and-forget: a single simple (urlencoded, no custom headers) POST has no
      // CORS preflight, so it reaches the Catalyst function even though the gateway
      // blocks reading the cross-origin response. `no-cors` → opaque response; it
      // resolves on delivery and only rejects on an actual network failure. One
      // request = exactly one email (no duplicate from a retry).
      await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
      setDone(true); setForm(EMPTY)
    } catch (_) {
      setError('Could not send right now — please email us at lok@fristinetech.com.')
    } finally { setBusy(false) }
  }

  const field = 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-white/10 dark:bg-white/5 dark:text-white'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900"
          >
            {/* Header */}
            <div className="relative overflow-hidden px-6 pt-6 pb-5">
              <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-brand-cyan to-brand-violet opacity-20 blur-3xl" />
              <button onClick={() => setOpen(false)} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10">
                <X size={18} />
              </button>
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-cyan via-brand-blue to-brand-violet text-white shadow-md">
                  <CalendarDays size={18} />
                </span>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Book a demo</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">See ODD on your own data — we'll reach out shortly.</p>
                </div>
              </div>
            </div>

            {done ? (
              <div className="px-6 pb-8 pt-2 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-500 dark:bg-emerald-500/15">
                  <CheckCircle2 size={28} />
                </div>
                <h4 className="mt-4 text-base font-bold text-slate-900 dark:text-white">Thanks — request received!</h4>
                <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                  Our team will get back to you at your email soon to schedule your ODD demo.
                </p>
                <button onClick={() => setOpen(false)} className="mt-5 rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-brand-blueDark">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3 px-6 pb-6">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Name *</label>
                    <input value={form.name} onChange={set('name')} required placeholder="Your name" className={field} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Work email *</label>
                    <input value={form.email} onChange={set('email')} required type="email" placeholder="you@company.com" className={field} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Company</label>
                    <input value={form.company} onChange={set('company')} placeholder="Company name" className={field} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Role</label>
                    <input value={form.role} onChange={set('role')} placeholder="e.g. Head of Analytics" className={field} />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Industry</label>
                  <input value={form.industry} onChange={set('industry')} placeholder="e.g. BFSI, Retail, Healthcare…" className={field} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">What would you like to see?</label>
                  <textarea value={form.message} onChange={set('message')} rows={3} placeholder="Tell us about your data or what you'd like the dashboard to show…" className={`${field} resize-y`} />
                </div>

                {error && <p className="text-xs font-medium text-rose-500">{error}</p>}

                <button type="submit" disabled={busy || !form.name.trim() || !form.email.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-cyan via-brand-blue to-brand-violet px-5 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {busy ? 'Sending…' : 'Book my demo'}
                </button>
                <p className="text-center text-[11px] text-slate-400">We'll only use your details to contact you about ODD.</p>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
