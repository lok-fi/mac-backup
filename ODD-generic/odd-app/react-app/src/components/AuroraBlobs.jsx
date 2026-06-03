import { motion } from 'framer-motion';

// Soft, slowly-drifting colour blobs behind the interactive dot field — the same
// subtle pastel wash used on the FI Digitals landing page.
const blobs = [
  {
    className: 'left-[2%] top-[2%] h-[26vw] w-[26vw] bg-brand-cyan/[0.10]',
    animate: { x: [0, 60, -20, 0], y: [0, 40, 70, 0] },
    duration: 26,
  },
  {
    className: 'right-[3%] top-[12%] h-[24vw] w-[24vw] bg-brand-violet/[0.09]',
    animate: { x: [0, -55, 20, 0], y: [0, 45, 15, 0] },
    duration: 32,
  },
  {
    className: 'left-[28%] top-[48%] h-[28vw] w-[28vw] bg-brand-blue/[0.07]',
    animate: { x: [0, 45, -40, 0], y: [0, -30, 25, 0] },
    duration: 38,
  },
];

export default function AuroraBlobs() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full blur-3xl ${b.className}`}
          animate={b.animate}
          transition={{ duration: b.duration, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}
