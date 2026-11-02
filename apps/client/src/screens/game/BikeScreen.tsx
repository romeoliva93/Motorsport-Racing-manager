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
      notify(`${name} livello ${level + 1} ordinato: la fabbrica lo consegnerà nei prossimi giorni.`);
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
          pending={b.parts.filter((p) => p.inProduction).map((p) => p.key)}
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
        {b.concession && (
          <div className="row">
            <span className="muted">
              Concessioni
              <Help>
                Fascia decisa dai punti del costruttore nella stagione precedente: A per chi vince di più, D
                per chi è più indietro. Più la fascia è bassa, più gli upgrade costano meno, arrivano prima e
                si hanno più motori (D: 10 invece di 8).
              </Help>
            </span>
            <b>Fascia {b.concession}</b>
          </div>
        )}
        {b.engines.map((e) => (
          <div key={e.name} className="row">
            <span className="muted">Motori · {e.name}</span>
            <b className={e.overLimit ? 'bad' : e.allocation - e.used <= 1 ? 'warn' : ''}>
              {e.used} di {e.allocation}
            </b>
          </div>
        ))}
        {b.engines.some((e) => e.overLimit) && (
          <p className="bad" style={{ fontSize: '.85rem' }}>
            Motori finiti: al prossimo GP partirà dalla corsia box.
          </p>
        )}
        <Explain style={{ marginTop: '.8rem' }}>
          La moto di serie è nera. Ogni upgrade si ordina alla fabbrica e si paga subito; viene montato solo
          alla consegna (i giorni dipendono dal pezzo e dal livello dei tuoi reparti tecnici). Sul disegno i
          pezzi in produzione sono tratteggiati, quelli montati si colorano. Anche le avversarie investono.
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
                  <span
                    key={i}
                    className={p.inProduction && i === p.level ? 'building' : ''}
                    style={{
                      background: i < p.level ? p.color : 'var(--bg-3)',
                      ['--c' as string]: p.color,
                    }}
                  />
                ))}
              </span>
            </div>
            <p className="t2">{p.what}</p>
            <div className="muted" style={{ fontSize: '.85rem', marginBottom: '.7rem' }}>
              Migliora: {p.effect}
            </div>
            {p.inProduction ? (
              <div className="building-note">
                <span className="pill info">In produzione</span> Livello {p.inProduction.level} pronto il{' '}
                {p.inProduction.ready}
                <span className="muted">
                  {' '}
                  (tra {p.inProduction.daysLeft} {p.inProduction.daysLeft === 1 ? 'giorno' : 'giorni'})
                </span>
              </div>
            ) : p.nextCost === null ? (
              <span className="pill ok">Livello massimo</span>
            ) : (
              <button
                className={`btn ${p.affordable ? 'primary' : ''}`}
                disabled={!p.affordable || busy}
                onClick={() => buy(p.key, p.name, p.level)}
                title={p.affordable ? undefined : 'Non hai abbastanza soldi in cassa'}
              >
                Ordina il livello {p.level + 1} · {formatMoney(p.nextCost)} · {p.nextLeadDays} giorni
              </button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
