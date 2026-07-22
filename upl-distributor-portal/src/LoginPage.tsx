import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  onLogin: () => void;
}

const CORRECT_EMAIL = 'lok@upl-fi.com';
const CORRECT_PASSWORD = '1234';

const MOLECULES = [
  { size: 110, left: '4%',  delay: '0s',   duration: '22s' },
  { size: 65,  left: '14%', delay: '4s',   duration: '17s' },
  { size: 150, left: '72%', delay: '1.5s', duration: '28s' },
  { size: 85,  left: '84%', delay: '6s',   duration: '19s' },
  { size: 130, left: '44%', delay: '8s',   duration: '24s' },
  { size: 55,  left: '58%', delay: '2.5s', duration: '15s' },
  { size: 95,  left: '28%', delay: '10s',  duration: '20s' },
  { size: 75,  left: '91%', delay: '5s',   duration: '23s' },
  { size: 60,  left: '35%', delay: '13s',  duration: '18s' },
  { size: 100, left: '66%', delay: '7s',   duration: '26s' },
];

function HexMolecule({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <polygon
        points="50,5 89,27.5 89,72.5 50,95 11,72.5 11,27.5"
        stroke="rgba(180,180,180,0.55)"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="50" cy="50" r="16" stroke="rgba(200,200,200,0.35)" strokeWidth="1" fill="none" />
      {[[50,5],[89,27.5],[89,72.5],[50,95],[11,72.5],[11,27.5]].map(([x,y], i) => (
        <line key={i} x1="50" y1="50" x2={x} y2={y} stroke="rgba(180,180,180,0.4)" strokeWidth="0.8" />
      ))}
      <circle cx="50" cy="50" r="3" fill="rgba(200,200,200,0.5)" />
    </svg>
  );
}

export default function LoginPage({ onLogin }: Props) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    if (email.trim() === CORRECT_EMAIL && password === CORRECT_PASSWORD) {
      onLogin();
    } else {
      setError('Invalid email or password. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#04091a] flex items-center justify-center relative overflow-hidden">

      {/* Ambient glow blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-blue-700/10 blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-orange-500/10 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-blue-900/15 blur-[180px]" />
      </div>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />

      {/* Floating hex molecules */}
      {MOLECULES.map((m, i) => (
        <div
          key={i}
          className="absolute bottom-[-10%] pointer-events-none opacity-[0.11]"
          style={{
            left: m.left,
            animation: `floatMolecule ${m.duration} linear ${m.delay} infinite`,
          }}
        >
          <HexMolecule size={m.size} />
        </div>
      ))}

      {/* Pulsing ring behind card */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[420px] h-[420px] rounded-full border border-white/5 animate-ping-slow" />
        <div className="absolute w-[560px] h-[560px] rounded-full border border-white/[0.03] animate-ping-slow" style={{ animationDelay: '0.6s' }} />
      </div>

      {/* Industrial silhouette bottom */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none opacity-[0.07]">
        <svg viewBox="0 0 1440 160" fill="white" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full">
          <path d="M0,160 L0,120 L60,120 L60,60 L70,60 L70,40 L80,40 L80,60 L90,60 L90,120
            L160,120 L160,80 L170,80 L170,20 L180,20 L180,80 L190,80 L190,120
            L280,120 L280,100 L300,100 L300,70 L310,70 L310,50 L320,50 L320,70 L330,70 L330,100 L350,100 L350,120
            L440,120 L440,90 L450,90 L450,40 L460,40 L460,90 L470,90 L470,120
            L560,120 L560,100 L580,100 L580,60 L590,60 L590,30 L600,30 L600,60 L610,60 L610,100 L630,100 L630,120
            L700,120 L700,80 L710,80 L710,120
            L780,120 L780,70 L790,70 L790,50 L800,50 L800,70 L810,70 L810,120
            L900,120 L900,90 L920,90 L920,50 L930,50 L930,30 L940,30 L940,50 L950,50 L950,90 L970,90 L970,120
            L1050,120 L1050,80 L1060,80 L1060,120
            L1140,120 L1140,60 L1150,60 L1150,40 L1160,40 L1160,60 L1170,60 L1170,120
            L1260,120 L1260,100 L1280,100 L1280,70 L1290,70 L1290,50 L1300,50 L1300,70 L1310,70 L1310,100 L1330,100 L1330,120
            L1440,120 L1440,160 Z"/>
        </svg>
      </div>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="backdrop-blur-2xl bg-white/[0.04] border border-white/10 rounded-3xl p-8 shadow-[0_32px_80px_rgba(0,0,0,0.6)]">

          {/* Brand header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#002855] to-blue-600 shadow-lg shadow-blue-950/60 mb-5 mx-auto">
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                <circle cx="17" cy="17" r="4.5" fill="white" opacity="0.95" />
                <circle cx="6"  cy="10" r="3"   fill="white" opacity="0.55" />
                <circle cx="28" cy="10" r="3"   fill="white" opacity="0.55" />
                <circle cx="6"  cy="24" r="3"   fill="white" opacity="0.55" />
                <circle cx="28" cy="24" r="3"   fill="white" opacity="0.55" />
                <line x1="17" y1="17" x2="6"  y2="10" stroke="white" strokeWidth="1.5" opacity="0.65" />
                <line x1="17" y1="17" x2="28" y2="10" stroke="white" strokeWidth="1.5" opacity="0.65" />
                <line x1="17" y1="17" x2="6"  y2="24" stroke="white" strokeWidth="1.5" opacity="0.65" />
                <line x1="17" y1="17" x2="28" y2="24" stroke="white" strokeWidth="1.5" opacity="0.65" />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">UPL Distributor Portal</h1>
            <p className="text-white/35 text-sm font-medium mt-1.5 tracking-wide">Petrochemical & Agricultural Solutions</p>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-7" />

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-[0.18em] font-black text-white/35 mb-2 block">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="you@upl-fi.com"
                autoComplete="email"
                required
                className="w-full px-4 py-3.5 rounded-xl bg-white/[0.06] border border-white/10 text-white placeholder-white/20 text-sm font-medium focus:outline-none focus:border-orange-400/50 focus:bg-white/[0.08] transition-all"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-[0.18em] font-black text-white/35 mb-2 block">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full px-4 py-3.5 pr-16 rounded-xl bg-white/[0.06] border border-white/10 text-white placeholder-white/20 text-sm font-medium focus:outline-none focus:border-orange-400/50 focus:bg-white/[0.08] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black tracking-widest text-white/30 hover:text-white/60 transition-colors px-1"
                >
                  {showPwd ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </div>

            {/* Error message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                  <p className="text-red-400 text-sm font-semibold">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-4 rounded-xl bg-gradient-to-r from-[#ff8200] to-amber-400 text-white font-black text-[15px] tracking-wide shadow-xl shadow-orange-900/30 hover:shadow-orange-900/50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:scale-100 disabled:cursor-wait flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Authenticating…
                </>
              ) : (
                'Sign In to Portal'
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-white/15 text-[10px] font-black uppercase tracking-[0.2em] mt-8">
            © 2026 UPL Limited &nbsp;·&nbsp; Secure Portal v4.2
          </p>
        </div>
      </motion.div>
    </div>
  );
}
