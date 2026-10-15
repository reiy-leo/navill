import { useEffect, useRef } from 'react';

const COLORS: string[] = ['#f59f00', '#e8590c', '#1c7ed6', '#2f9e44', '#ae3ec9', '#f06595'];

/** 喷纸花：从底部两侧向上喷出，约 2.5 秒后自动停止；尊重「减少动画」 */
export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = cv.getContext('2d')!;
    const dpr = devicePixelRatio || 1;
    const W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.scale(dpr, dpr);
    const parts = Array.from({ length: 160 }, (_, i) => {
      const left = i % 2 === 0;
      const a = (left ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.7;
      const v = 11 + Math.random() * 9;
      return { x: left ? W * 0.15 : W * 0.85, y: H, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, w: 6 + Math.random() * 6, h: 3 + Math.random() * 4, c: COLORS[i % COLORS.length]! };
    });
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = t - start;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = Math.max(0, Math.min(1, (2600 - k) / 600));
      for (const p of parts) {
        p.vy += 0.28; p.vx *= 0.99; p.vy *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2))); ctx.restore();
      }
      if (k < 2600) raf = requestAnimationFrame(tick); else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[1000] size-full" />;
}
