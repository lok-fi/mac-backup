import { motion, useScroll, useSpring } from 'framer-motion'
import { useTheme } from './hooks/useTheme'
import InteractiveBackground from './components/InteractiveBackground'
import AuroraBlobs from './components/AuroraBlobs'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import WhatIsODD from './components/WhatIsODD'
import HowItWorks from './components/HowItWorks'
import Features from './components/Features'
import Industries from './components/Industries'
import FAQ from './components/FAQ'
import Footer from './components/Footer'
import BookDemoModal from './components/BookDemoModal'

export default function App() {
  const { theme, toggle } = useTheme()
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 })

  return (
    <div className="min-h-screen bg-white text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-white">
      {/* scroll progress */}
      <motion.div
        style={{ scaleX }}
        className="fixed inset-x-0 top-0 z-[70] h-0.5 origin-left bg-gradient-to-r from-brand-cyan via-brand-blue to-brand-violet"
      />

      {/* slowly-drifting colour wash, then the cursor-interactive dot field on top */}
      <AuroraBlobs />
      <InteractiveBackground theme={theme} />

      <Navbar theme={theme} toggle={toggle} />

      <main className="relative z-10">
        <Hero />
        <WhatIsODD />
        <HowItWorks />
        <Features />
        <Industries />
        <FAQ />
      </main>

      <Footer />
      <BookDemoModal />
    </div>
  )
}
