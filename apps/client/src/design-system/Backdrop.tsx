import { useEffect, useRef } from 'react';

/**
 * Sfondo animato: tracciati disegnati a mano libera (curve chiuse generate da un seme) con alcune moto,
 * rappresentate come scie luminose, che girano a velocità diverse — rallentano in curva e accelerano
 * sul dritto, come nella simulazione vera.
 *
 * Leggero per scelta: 30 fotogrammi al secondo, si ferma quando la scheda non è visibile e resta statico se
 * il sistema chiede movimento ridotto (prefers-reduced-motion).
 */
export function Backdrop({ color = '#3d7bfd', intensity = 1 }: { color?: string; intensity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let w = 0,
      h = 0,
      raf = 0,
      last = 0;
    const tracks = [
      makeTrack(7, 0.62, 0.52, 0.34),
      makeTrack(19, 0.18, 0.8, 0.2),
      makeTrack(31, 0.9, 0.12, 0.16),
    ];
    const riders = [
      { track: 0, u: 0, lap: 21, hue: color, trail: [] as [number, number][] },
      { track: 0, u: 0.02, lap: 21.6, hue: '#e3120b', trail: [] as [number, number][] },
      { track: 0, u: 0.05, lap: 22.1, hue: '#e9e7e2', trail: [] as [number, number][] },
      { track: 1, u: 0.4, lap: 16, hue: color, trail: [] as [number, number][] },
      { track: 2, u: 0.7, lap: 13, hue: '#e3120b', trail: [] as [number, number][] },
    ];
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const toScreen = (t: Track, p: [number, number]): [number, number] => {
      const s = Math.min(w, h * 1.4) * t.scale;
      return [w * t.cx + (p[0] - 0.5) * s * 1.4, h * t.cy + (p[1] - 0.5) * s];
    };
    const draw = (dt: number) => {
      ctx.clearRect(0, 0, w, h);
      // Griglia leggera, come la carta millimetrata del muretto.
      ctx.strokeStyle = 'rgba(255,255,255,0.025)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < w; x += 56) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
      }
      for (let y = 0; y < h; y += 56) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
      }
      ctx.stroke();
      for (const t of tracks) {
        ctx.beginPath();
        t.pts.forEach((p, i) => {
          const [x, y] = toScreen(t, p);
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.closePath();
        ctx.strokeStyle = `rgba(255,255,255,${0.05 * intensity})`;
        ctx.lineWidth = 14;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.09 * intensity})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      for (const r of riders) {
        const t = tracks[r.track]!;
        const i = Math.floor(r.u * t.pts.length) % t.pts.length;
        r.u = (r.u + (dt / r.lap) * t.speed[i]!) % 1;
        const p = toScreen(t, t.pts[Math.floor(r.u * t.pts.length) % t.pts.length]!);
        r.trail.push(p);
        if (r.trail.length > 18) r.trail.shift();
        for (let k = 1; k < r.trail.length; k++) {
          const a = k / r.trail.length;
          ctx.strokeStyle = withAlpha(r.hue, 0.5 * a * intensity);
          ctx.lineWidth = 3 * a;
          ctx.beginPath();
          ctx.moveTo(...r.trail[k - 1]!);
          ctx.lineTo(...r.trail[k]!);
          ctx.stroke();
        }
        ctx.fillStyle = withAlpha(r.hue, 0.9 * intensity);
        ctx.beginPath();
        ctx.arc(p[0], p[1], 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden || now - last < 33) return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      draw(dt);
    };
    resize();
    window.addEventListener('resize', resize);
    if (reduce) draw(0);
    else raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [color, intensity]);
  return (
    <div className="backdrop" aria-hidden>
      <canvas ref={ref} />
    </div>
  );
}

interface Track {
  pts: [number, number][];
  speed: number[];
  cx: number;
  cy: number;
  scale: number;
}

/** Curva chiusa irregolare: raggio con poche armoniche casuali, poi velocità dalla curvatura. */
function makeTrack(seed: number, cx: number, cy: number, scale: number): Track {
  let x = seed * 9301 + 49297;
  const rnd = () => (x = (x * 9301 + 49297) % 233280) / 233280;
  const harmonics = [2, 3, 4, 5].map((k) => ({ k, a: (rnd() * 0.22) / (k * 0.6), ph: rnd() * Math.PI * 2 }));
  const n = 360;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    let r = 0.36;
    for (const hm of harmonics) r += hm.a * Math.sin(hm.k * th + hm.ph);
    pts.push([0.5 + r * Math.cos(th), 0.5 + r * Math.sin(th) * 0.8]);
  }
  const speed = pts.map((p, i) => {
    const a = pts[(i + n - 4) % n]!,
      b = pts[(i + 4) % n]!;
    const v1 = [p[0] - a[0], p[1] - a[1]],
      v2 = [b[0] - p[0], b[1] - p[1]];
    const ang = Math.abs(Math.atan2(v1[0]! * v2[1]! - v1[1]! * v2[0]!, v1[0]! * v2[0]! + v1[1]! * v2[1]!));
    return 1.25 - Math.min(0.75, ang * 6);
  });
  return { pts, speed, cx, cy, scale };
}

function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
}
