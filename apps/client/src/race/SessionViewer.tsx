/**
 * Visore delle sessioni a tempo (prove libere, Prove, qualifiche, Warm Up): la schermata tempi scorre con
 * l'orologio della sessione. Velocità da 1× a 64×, pausa, salto alla fine.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SessionTiming } from '@lean-angle/game';
import { sessionModel, sessionRows } from './timing.ts';
import { TimingTower } from './TimingTower.tsx';

const SPEEDS = [0, 1, 8, 16, 32, 64];

const clock = (s: number) => {
  const v = Math.max(0, Math.round(s));
  const h = Math.floor(v / 3600),
    m = Math.floor((v % 3600) / 60),
    x = v % 60;
  return `${h > 0 ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
};

export function SessionViewer({
  timing,
  title,
  onClose,
}: {
  timing: SessionTiming;
  title: string;
  onClose: () => void;
}) {
  const model = useMemo(() => sessionModel(timing), [timing]);
  const [t, setT] = useState(0);
  const [speed, setSpeed] = useState(32);
  const tRef = useRef(0);
  const end = timing.length;

  useEffect(() => {
    if (speed === 0) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      tRef.current = Math.min(end, tRef.current + dt * speed);
      setT(tRef.current);
      if (tRef.current < end) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [speed, end]);

  const rows = useMemo(() => sessionRows(model, t), [model, t]);
  const over = t >= end;
  const onTrack = rows.filter((r) => r.status !== 'box').length;

  return (
    <div className="sv">
      <div className="sv-bar">
        <div className="sv-title">
          <small className="muted">{timing.circuit}</small>
          <b className="display">{title}</b>
        </div>
        <div className="sv-clock" aria-label="Tempo rimanente">
          <small>{over ? 'Sessione finita' : 'Tempo rimanente'}</small>
          <b>{over ? '🏁' : clock(end - t)}</b>
        </div>
        <div className="sv-clock">
          <small>In pista</small>
          <b>{onTrack}</b>
        </div>
        <span className="spacer" />
        <div className="rv-speeds" role="group" aria-label="Velocità">
          {SPEEDS.map((v) => (
            <button key={v} className={speed === v ? 'on' : ''} disabled={over} onClick={() => setSpeed(v)}>
              {v === 0 ? '❚❚' : `${v}×`}
            </button>
          ))}
        </div>
        {!over && (
          <button
            className="btn"
            onClick={() => {
              tRef.current = end;
              setT(end);
            }}
          >
            Salta alla fine
          </button>
        )}
        <button className="btn primary" onClick={onClose}>
          {over ? 'Chiudi i tempi' : 'Chiudi'}
        </button>
      </div>
      <TimingTower rows={rows} mode="session" q2Cut={timing.q2Cut} />
    </div>
  );
}
