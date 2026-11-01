import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReplayData } from '@lean-angle/game';
import { raceTime } from '../../design-system/components.tsx';

const SPEEDS = [0, 1, 2, 4, 8, 16] as const;

/**
 * Vista 2D dall'alto della gara. Riproduce i fotogrammi registrati dalla simulazione (la gara è già stata
 * calcolata dal motore: qui la si guarda, alla velocità scelta). Fra due fotogrammi la posizione è interpolata.
 */
export function RaceViewer({ data, onDone }: { data: ReplayData; onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [speed, setSpeed] = useState<number>(8);
  const [t, setT] = useState(0);
  const tRef = useRef(0);
  const duration = (data.frames.length - 1) * data.frameEvery;
  const L = data.lengthM;
  const N = data.track.points.length;

  // Riquadro del tracciato per adattarlo al canvas mantenendo le proporzioni.
  const box = useMemo(() => {
    const xs = data.track.points.map((p) => p[0]);
    const ys = data.track.points.map((p) => p[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }, [data]);

  const distAt = (time: number): number[] => {
    const f = Math.max(0, time) / data.frameEvery;
    const i = Math.max(0, Math.min(data.frames.length - 1, Math.floor(f)));
    const j = Math.min(data.frames.length - 1, i + 1);
    const a = data.frames[i]!,
      b = data.frames[j]!;
    const k = f - i;
    return a.map((d, n) => (d < 0 || b[n]! < 0 ? (d < 0 ? -1 : d) : d + (b[n]! - d) * k));
  };

  // Ciclo di riproduzione.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.max(0, (now - last) / 1000);
      last = now;
      if (speed > 0 && tRef.current < duration) {
        tRef.current = Math.min(duration, tRef.current + dt * speed);
        setT(tRef.current);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [speed, duration]);

  const dists = distAt(t);
  const order = data.riders
    .map((r, i) => ({ r, d: dists[i]! }))
    .sort((a, b) => (a.d < 0 ? 1 : b.d < 0 ? -1 : b.d - a.d));
  const leader = order[0]!;
  const lap = Math.min(data.laps, Math.floor(Math.max(0, leader.d) / L) + 1);
  const avgSpeed = L / ((data.results[0]?.time ?? duration) / data.laps);
  const finished = t >= duration;

  // Disegno.
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = c.clientWidth,
      h = c.clientHeight;
    if (c.width !== Math.round(w * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const pad = 28;
    const sx = (w - pad * 2) / (box.x1 - box.x0 || 1);
    const sy = (h - pad * 2) / (box.y1 - box.y0 || 1);
    const s = Math.min(sx, sy);
    const ox = (w - (box.x1 - box.x0) * s) / 2;
    const oy = (h - (box.y1 - box.y0) * s) / 2;
    const P = (p: [number, number]): [number, number] => [ox + (p[0] - box.x0) * s, oy + (p[1] - box.y0) * s];
    const path = () => {
      ctx.beginPath();
      data.track.points.forEach((p, i) => (i ? ctx.lineTo(...P(p)) : ctx.moveTo(...P(p))));
      ctx.closePath();
    };
    ctx.lineJoin = 'round';
    path();
    ctx.strokeStyle = '#3a3c42';
    ctx.lineWidth = 20;
    ctx.stroke();
    path();
    ctx.strokeStyle = '#2a2c31';
    ctx.lineWidth = 16;
    ctx.stroke();
    path();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 10]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Traguardo.
    const [fx, fy] = P(data.track.points[0]!);
    ctx.fillStyle = '#fff';
    ctx.fillRect(fx - 2, fy - 11, 4, 22);

    const at = (d: number): [number, number] => {
      const frac = (((d % L) + L) % L) / L;
      const f = frac * N;
      const i = Math.floor(f) % N;
      const j = (i + 1) % N;
      const a = data.track.points[i]!,
        b = data.track.points[j]!;
      const k = f - Math.floor(f);
      return P([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
    };
    // Prima gli altri, poi i nostri sopra.
    const drawOrder = [...order].reverse().sort((a, b) => Number(a.r.mine) - Number(b.r.mine));
    for (const { r, d } of drawOrder) {
      if (d < 0) continue;
      const [x, y] = at(Math.max(0, d));
      const pos = order.findIndex((o) => o.r.id === r.id) + 1;
      ctx.beginPath();
      ctx.arc(x, y, r.mine ? 7 : 5.5, 0, Math.PI * 2);
      ctx.fillStyle = r.color;
      ctx.fill();
      ctx.lineWidth = r.mine ? 3 : 1.5;
      ctx.strokeStyle = r.mine ? '#ffd21f' : r.color2;
      ctx.stroke();
      if (r.mine || pos <= 3) {
        ctx.font = '700 11px Archivo, system-ui, sans-serif';
        const label = `${pos}. ${r.short}`;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = r.mine ? '#ffd21f' : 'rgba(20,21,24,0.85)';
        ctx.fillRect(x + 9, y - 18, tw + 8, 15);
        ctx.fillStyle = r.mine ? '#17150c' : '#f3f1ec';
        ctx.fillText(label, x + 13, y - 7);
      }
    }
  });

  const events = data.events
    .filter((e) => e.t <= t && e.kind !== 'fastestLap')
    .filter((e) => {
      if (e.kind !== 'overtake') return true;
      const a = data.riders.find((r) => r.id === e.riderId);
      const b = data.riders.find((r) => r.id === e.otherId);
      return a?.mine || b?.mine;
    })
    .slice(-6)
    .reverse();
  const name = (id: string | undefined) => data.riders.find((r) => r.id === id)?.name ?? '';
  const evText = (e: ReplayData['events'][number]) =>
    e.kind === 'overtake'
      ? `${name(e.riderId)} supera ${name(e.otherId)}`
      : e.kind === 'crash'
        ? `Caduta! ${name(e.riderId)} è fuori`
        : e.kind === 'remount'
          ? `${name(e.riderId)} scivola ma riparte`
          : e.kind === 'mechanical'
            ? `Guasto: ${name(e.riderId)} si ritira`
            : `Bandiera a scacchi: vince ${name(e.riderId)}`;

  return (
    <div className="race-viewer">
      <div className="rv-head">
        <div>
          <small className="muted">
            {data.categoryName} · {data.circuit}
          </small>
          <b className="display">{finished ? 'Gara finita' : `Giro ${lap} di ${data.laps}`}</b>
        </div>
        <div className="rv-speeds" role="group" aria-label="Velocità di riproduzione">
          {SPEEDS.map((v) => (
            <button key={v} className={speed === v ? 'on' : ''} onClick={() => setSpeed(v)}>
              {v === 0 ? '❚❚' : `${v}×`}
            </button>
          ))}
        </div>
        <span className="muted rv-clock">{raceTime(t)}</span>
        <button className="btn primary" onClick={onDone}>
          {finished ? 'Vedi i risultati' : 'Salta alla fine'}
        </button>
      </div>
      <div className="rv-body">
        <canvas ref={canvas} className="rv-canvas" aria-label="Mappa del circuito con le moto in pista" />
        <ol className="rv-board">
          {order.map(({ r, d }, i) => {
            const gap = i === 0 || d < 0 ? null : (leader.d - d) / avgSpeed;
            return (
              <li key={r.id} className={`${r.mine ? 'mine' : ''} ${d < 0 ? 'out' : ''}`}>
                <span className="p">{d < 0 ? '–' : i + 1}</span>
                <span className="c" style={{ background: r.color }} />
                <span className="n">{r.name}</span>
                <span className="g">
                  {d < 0
                    ? 'ritirato'
                    : i === 0
                      ? 'leader'
                      : leader.d - d > L
                        ? `+${Math.floor((leader.d - d) / L)} giro`
                        : `+${gap!.toFixed(1)}s`}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <ul className="rv-feed" aria-live="polite">
        {events.length === 0 && <li className="muted">Semaforo verde: si parte!</li>}
        {events.map((e, i) => (
          <li key={`${e.t}-${i}`} className={e.kind}>
            <span className="muted">Giro {Math.max(1, e.lap)}</span> {evText(e)}
          </li>
        ))}
      </ul>
    </div>
  );
}
