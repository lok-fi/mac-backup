import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CheckCircle2, Send } from 'lucide-react';
import { api } from '../api';

export default function RequestDemoModal({ open, onClose, industry, accent = '#2563eb' }) {
  const [form, setForm] = useState({ name: '', email: '', company: '', role: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim()) { setError('Name and email are required.'); return; }
    setError(''); setBusy(true);
    try {
      await api.requestDemo({ ...form, industry });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="relative px-7 py-6 text-white" style={{ background: `linear-gradient(135deg, ${accent}, #7c3aed)` }}>
              <button onClick={onClose} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/20 hover:bg-white/30"><X size={16} /></button>
              <h3 className="text-xl font-extrabold">Request your own demo</h3>
              <p className="mt-1 text-sm text-white/90">Tell us about your data and we'll build a tailored dashboard for you.</p>
            </div>

            {done ? (
              <div className="px-7 py-10 text-center">
                <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
                <p className="mt-4 text-lg font-bold text-slate-900">Thanks, {form.name.split(' ')[0]}!</p>
                <p className="mt-1 text-sm text-slate-500">Our team will reach out at {form.email} shortly.</p>
                <button onClick={onClose} className="mt-6 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">Close</button>
              </div>
            ) : (
              <div className="space-y-3 p-7">
                <div className="grid grid-cols-2 gap-3">
                  <input value={form.name} onChange={set('name')} placeholder="Full name *" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" />
                  <input value={form.email} onChange={set('email')} placeholder="Work email *" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" />
                  <input value={form.company} onChange={set('company')} placeholder="Company" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" />
                  <input value={form.role} onChange={set('role')} placeholder="Role" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" />
                </div>
                <textarea value={form.message} onChange={set('message')} rows={3} placeholder="What would you like to see in your dashboard?" className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" />
                {error && <p className="text-sm text-rose-600">{error}</p>}
                <button onClick={submit} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md disabled:opacity-50" style={{ background: `linear-gradient(135deg, ${accent}, #7c3aed)` }}>
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Request demo
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
