import { useState } from 'react';
import { formatMoney } from '@lean-angle/core';
import { engine } from '../../engine/engine.ts';
import { useQuery } from '../../engine/hooks.ts';
import { Card, Explain, Help } from '../../design-system/components.tsx';
import { Bike, type BikePart } from '../../design-system/Bike.tsx';

export function BikeScreen({ notify }: { notify: (t: string, err?: boolean) => void }) {
  const q = useQuery('bikeView');
  const [hover, setHover] = useState<BikePart | null>(null);
  const [busy, setBusy] = useState(false);
  if (q.status !== 'ready' || !q.data) return <div className="loading">Caricamento…</div>;
  const b = q.data;
  const levels = Object.fromEntries(b.parts.map((p) => [p.key, p.level])) as Record<BikePart, number>;
  const partColors = Object.fromEntries(b.parts.map((p) => [p.key, p.color])) as Record<BikePart, string>;
  const diff = b.rating - b.rivalsAvg;

  async function buy(key: BikePart, name: string, level: number) {
    setBusy(true);
    try {
      await engine.dispatch({ type: 'BuyUpgrade', part: key });
      notify(`${name} potenziato al livello ${level + 1}: si vedrà già dalla prossima gara.`);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid12">
      <Card className="s8 accent bike-stage">
        <Bike
          team={b.team}
          colors={b.colors}
          number={b.numbers[0] ?? null}
          levels={levels}
          partColors={partColors}
          width={44}
          highlight={hover}
        />
        <div className="bike-legend">
          {b.parts.map((p) => (
            <span key={p.key} className={p.level ? '' : 'muted'}>
              <i style={{ background: p.level ? p.color : '#2a2b30' }} />
              {p.name}
              {p.level ? ` · liv. ${p.level}` : ''}
            </span>
          ))}
        </div>
      </Card>
      <Card title="La tua moto" className="s4">
        <div className="muted">Costruttore</div>
        <b style={{ fontSize: '1.15rem' }}>{b.manufacturer}</b>
        <div className="row" style={{ marginTop: '.8rem' }}>
          <span className="muted">
            Qualità della moto
            <Help>
              Valore da 0 a 100: base del costruttore più gli upgrade montati. In gara pesa per il 40% della
              prestazione (il resto è il pilota).
            </Help>
          </span>
          <b>{b.rating}</b>
        </div>
        <div className="row">
          <span className="muted">Media delle avversarie</span>
          <b>{b.rivalsAvg}</b>
        </div>
        <div className="row">
          <span>Rispetto agli altri</span>
          <b className={diff > 0 ? 'ok' : diff < 0 ? 'bad' : ''}>{diff > 0 ? `+${diff}` : diff}</b>
        </div>
        <div className="row">
          <span className="muted">Soldi in cassa</span>
          <b>{formatMoney(b.balance)}</b>
        </div>
        <Explain style={{ marginTop: '.8rem' }}>
          La moto di serie è nera. Ogni componente che potenzi si colora sul disegno: più è acceso, più è
          sviluppato. Anche le squadre avversarie investono durante la stagione.
        </Explain>
      </Card>
      {b.parts.map((p) => (
        <Card key={p.key} className="s4 part-card">
          <div onMouseEnter={() => setHover(p.key)} onMouseLeave={() => setHover(null)}>
            <div className="part-head">
              <i style={{ background: p.color }} />
              <b>{p.name}</b>
              <span className="pips" aria-label={`Livello ${p.level} di ${p.max}`}>
                {Array.from({ length: p.max }, (_, i) => (
                  <span key={i} style={{ background: i < p.level ? p.color : 'var(--bg-3)' }} />
                ))}
              </span>
            </div>
            <p className="t2">{p.what}</p>
            <div className="muted" style={{ fontSize: '.85rem', marginBottom: '.7rem' }}>
              Migliora: {p.effect}
            </div>
            {p.nextCost === null ? (
              <span className="pill ok">Livello massimo</span>
            ) : (
              <button
                className={`btn ${p.affordable ? 'primary' : ''}`}
                disabled={!p.affordable || busy}
                onClick={() => buy(p.key, p.name, p.level)}
                title={p.affordable ? undefined : 'Non hai abbastanza soldi in cassa'}
              >
                Potenzia al livello {p.level + 1} · {formatMoney(p.nextCost)}
              </button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
