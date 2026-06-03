import { useEffect, useRef } from 'react';

// A cursor-interactive "liquid" dot field (ported from the FI Digitals landing page).
// A grid of dots sits on a white canvas; the cursor pushes nearby dots outward and
// lights them in the brand gradient, and movement/clicks spawn expanding ripple rings.
// Pointer events pass through; we track the pointer on `window` so it keeps working
// while scrolling.

const SPACING = 40;
const CURSOR_RADIUS = 170;
const MAX_PUSH = 16;
const RIPPLE_SPEED = 320;
const RIPPLE_WIDTH = 60;
const RIPPLE_LIFE = 1.6;
const SPAWN_DISTANCE = 60;

const STOPS = [
  [6, 182, 212],
  [37, 99, 235],
  [124, 58, 237],
];

function gradientColor(t) {
  const seg = t * 2;
  const i = Math.min(1, Math.floor(seg));
  const f = seg - i;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

export default function InteractiveBackground({ opacity = 1 }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    pointer: { x: -9999, y: -9999 },
    last: { x: -9999, y: -9999 },
    ripples: [],
    raf: 0,
    prevT: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const s = stateRef.current;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const baseRGB = '100,116,139';

    const onMove = (e) => {
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      s.pointer.x = x;
      s.pointer.y = y;
      const dx = x - s.last.x;
      const dy = y - s.last.y;
      if (dx * dx + dy * dy > SPAWN_DISTANCE * SPAWN_DISTANCE) {
        s.ripples.push({ x, y, t: 0 });
        if (s.ripples.length > 14) s.ripples.shift();
        s.last.x = x;
        s.last.y = y;
      }
    };
    const onClick = (e) => {
      s.ripples.push({ x: e.clientX, y: e.clientY, t: 0, strong: true });
      if (s.ripples.length > 14) s.ripples.shift();
    };
    const onLeave = () => {
      s.pointer.x = -9999;
      s.pointer.y = -9999;
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('click', onClick);
    window.addEventListener('mouseout', onLeave);

    const draw = (now) => {
      const dt = s.prevT ? Math.min(0.05, (now - s.prevT) / 1000) : 0.016;
      s.prevT = now;

      ctx.clearRect(0, 0, w, h);

      for (const r of s.ripples) r.t += dt;
      s.ripples = s.ripples.filter((r) => r.t < RIPPLE_LIFE);

      const px = s.pointer.x;
      const py = s.pointer.y;

      for (let gx = SPACING / 2; gx < w; gx += SPACING) {
        for (let gy = SPACING / 2; gy < h; gy += SPACING) {
          let ox = 0;
          let oy = 0;
          let activation = 0;

          const cdx = gx - px;
          const cdy = gy - py;
          const cdist = Math.hypot(cdx, cdy);
          if (cdist < CURSOR_RADIUS) {
            const f = 1 - cdist / CURSOR_RADIUS;
            const ease = f * f;
            const ang = Math.atan2(cdy, cdx);
            ox += Math.cos(ang) * ease * MAX_PUSH;
            oy += Math.sin(ang) * ease * MAX_PUSH;
            activation = Math.max(activation, ease);
          }

          for (const r of s.ripples) {
            const radius = r.t * RIPPLE_SPEED;
            const rdx = gx - r.x;
            const rdy = gy - r.y;
            const rdist = Math.hypot(rdx, rdy);
            const band = Math.abs(rdist - radius);
            if (band < RIPPLE_WIDTH) {
              const fade = 1 - r.t / RIPPLE_LIFE;
              const ringF = (1 - band / RIPPLE_WIDTH) * fade * (r.strong ? 1.4 : 1);
              if (rdist > 0.01) {
                ox += (rdx / rdist) * ringF * 10;
                oy += (rdy / rdist) * ringF * 10;
              }
              activation = Math.max(activation, ringF);
            }
          }

          activation = Math.min(1, activation);
          const size = 1.1 + activation * 2.4;

          ctx.beginPath();
          ctx.arc(gx + ox, gy + oy, size, 0, Math.PI * 2);
          if (activation > 0.04) {
            const tcol = Math.min(1, Math.max(0, gx / w));
            const [r1, g1, b1] = gradientColor(tcol);
            ctx.fillStyle = `rgba(${r1},${g1},${b1},${0.25 + activation * 0.75})`;
          } else {
            ctx.fillStyle = `rgba(${baseRGB},0.16)`;
          }
          ctx.fill();
        }
      }

      s.raf = requestAnimationFrame(draw);
    };
    s.raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(s.raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('click', onClick);
      window.removeEventListener('mouseout', onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ opacity }}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
