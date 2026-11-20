import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CircuitInfo } from '@lean-angle/game';
import { FlagName } from '../../design-system/Flag.tsx';
import { useQuery } from '../../engine/hooks.ts';
import { Card, lapTime, raceTime } from '../../design-system/components.tsx';
import './calendar.css';

export function CalendarScreen({ categoryId }: { categoryId: string }) {
  const q = useQuery('calendar', categoryId);
  const [open, setOpen] = useState<string | null>(null);
  if (q.status !== 'ready') return <div className="loading">Caricamento…</div>;
  return (
    <>
      <Card
        title="Calendario della stagione"
        aside={`${q.data.length} Gran Premi · tocca un circuito per i dettagli`}
      >
        <table className="std cal-table">
          <thead>
            <tr>
              <th>Round</th>
              <th>Circuito</th>
              <th>Paese</th>
              <th>Data</th>
              <th className="r">Lunghezza</th>
              <th className="r">Curve</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {q.data.map((r) => (
              <tr
                key={r.id}
                className={r.status === 'next' ? 'sel' : ''}
                style={{ opacity: r.status === 'done' ? 0.6 : 1 }}
                onClick={() => setOpen(r.id)}
              >
                <td>
                  <b>{r.number}</b>
                </td>
                <td>
                  <button className="cal-link" onClick={() => setOpen(r.id)}>
                    {r.circuit}
                  </button>
                </td>
                <td>
                  <FlagName code={r.country} />
                </td>
                <td>{r.date}</td>
                <td className="r">{(r.lengthM / 1000).toFixed(2).replace('.', ',')} km</td>
                <td className="r">{r.turns}</td>
                <td>
                  {r.status === 'done' ? (
                    <span className="pill">Raggiunto</span>
                  ) : r.status === 'next' ? (
                    <span className="pill or">Prossimo</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {open && <CircuitSheet roundId={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function CircuitSheet({ roundId, onClose }: { roundId: string; onClose: () => void }) {
  const q = useQuery('circuitInfo', roundId);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const c = q.status === 'ready' ? q.data : null;
  return createPortal(
    <div className="sheet-back" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={c ? `Scheda del circuito ${c.name}` : 'Scheda del circuito'}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="sheet-x" onClick={onClose} aria-label="Chiudi">
          ✕
        </button>
        {!c ? (
          <div className="loading">Caricamento…</div>
        ) : (
          <>
            <header className="sheet-head">
              <small className="muted">
                Gran Premio {c.number} di {c.total} · {c.category} · {c.date}
              </small>
              <h2>{c.name}</h2>
              <FlagName code={c.country} />
            </header>
            <div className="sheet-body">
              <figure className="circ-fig">
                <CircuitMap points={c.track} sectors={c.sectors} />
                <figcaption>
                  <span className="s1">S1</span> <span className="s2">S2</span> <span className="s3">S3</span>{' '}
                  <span className="s4">S4</span> · il pallino è il traguardo
                </figcaption>
              </figure>
              <div className="circ-facts">
                <div className="fact">
                  <b>{(c.lengthM / 1000).toFixed(2).replace('.', ',')} km</b>
                  <small>lunghezza</small>
                </div>
                <div className="fact">
                  <b>{c.turns}</b>
                  <small>curve</small>
                </div>
                <div className="fact">
                  <b>{c.laps}</b>
                  <small>giri di gara</small>
                </div>
                <div className="fact">
                  <b>{c.raceKm.toFixed(1).replace('.', ',')} km</b>
                  <small>distanza di gara</small>
                </div>
                {c.traits.map((t) => (
                  <div key={t.label} className="trait">
                    <div className="trait-top">
                      <span>{t.label}</span>
                      <b>{t.value}/100</b>
                    </div>
                    <div className="trait-bar">
                      <i style={{ width: `${t.value}%` }} />
                    </div>
                    <small>{t.text}</small>
                  </div>
                ))}
              </div>
            </div>
            <h3 className="sheet-h3">Albo d’oro</h3>
            {c.history.length === 0 && <p className="t2">Nessun dato.</p>}
            <div className="circ-hist">
              {c.history.map((h) => (
                <div key={h.year} className="hist-year">
                  <div className="hist-title">
                    <b>{h.year}</b>
                    <small className="muted">{h.played ? 'nella tua carriera' : 'stagione precedente'}</small>
                  </div>
                  <HistRow label="Pole position" p={h.pole} time={h.pole?.time ? lapTime(h.pole.time) : ''} />
                  <HistRow
                    label="Vincitore"
                    p={h.winner}
                    time={h.winner?.time ? raceTime(h.winner.time) : ''}
                  />
                  <HistRow
                    label="Giro più veloce"
                    p={h.fastestLap}
                    time={h.fastestLap?.time ? lapTime(h.fastestLap.time) : ''}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function HistRow({
  label,
  p,
  time,
}: {
  label: string;
  p: CircuitInfo['history'][number]['pole'];
  time: string;
}) {
  return (
    <div className="hist-row">
      <small>{label}</small>
      {p ? (
        <span>
          <i className="hist-dot" style={{ background: p.color ?? '#888' }} />
          <b>{p.name}</b>
          {p.team && <span className="muted"> · {p.team}</span>}
          {time && <span className="hist-time">{time}</span>}
        </span>
      ) : (
        <span className="muted">—</span>
      )}
    </div>
  );
}

/** Disegno grande del tracciato, con i quattro settori colorati. */
function CircuitMap({ points, sectors }: { points: [number, number][]; sectors: [number, number, number] }) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x0 = Math.min(...xs),
    y0 = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0) || 1;
  const P = (p: [number, number]) => [((p[0] - x0) / span) * 100, ((p[1] - y0) / span) * 100] as const;
  const h = ((Math.max(...ys) - y0) / span) * 100;
  const w = ((Math.max(...xs) - x0) / span) * 100;
  const cuts = [0, ...sectors, 1].map((f) => Math.round(f * points.length));
  const seg = (a: number, b: number) =>
    points
      .slice(a, Math.min(points.length, b + 1))
      .map((p, i) => {
        const [x, y] = P(p);
        return `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  const full = seg(0, points.length) + ' Z';
  const [sx, sy] = P(points[0]!);
  return (
    <svg className="circ-map" viewBox={`-8 -8 ${w + 16} ${h + 16}`} aria-label="Disegno del circuito">
      <path d={full} className="cm-base" />
      {[0, 1, 2, 3].map((k) => (
        <path
          key={k}
          d={k === 3 ? seg(cuts[3]!, points.length) + ` L${sx} ${sy}` : seg(cuts[k]!, cuts[k + 1]!)}
          className={`cm-s s${k + 1}`}
        />
      ))}
      <circle cx={sx} cy={sy} r="2.8" className="cm-start" />
    </svg>
  );
}
