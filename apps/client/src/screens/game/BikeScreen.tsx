import { useState } from 'react';
import { formatMoney } from '@lean-angle/core';
import { engine } from '../../engine/engine.ts';
import { useQuery } from '../../engine/hooks.ts';
import { Card, Explain, Help } from '../../design-system/components.tsx';
import { Bike, type BikePart } from '../../design-system/Bike.tsx';

/** Componente del garage → reparto di sviluppo che lo migliora (per evidenziarlo sul disegno). */
const PART_OF: Record<string, BikePart> = {
  engine: 'engine',
  gearbox: 'engine',
  clutch: 'engine',
  chain: 'engine',
  cooling: 'engine',
  exhaust: 'exhaust',
  chassis: 'chassis',
  swingarm: 'chassis',
  fork: 'suspension',
  shock: 'suspension',
  frontBrake: 'brakes',
  rearBrake: 'brakes',
  ecu: 'electronics',
  fairing: 'aero',
};

export function BikeScreen({ notify }: { notify: (t: string, err?: boolean) => void }) {
  const q = useQuery('bikeView');
  const [hover, setHover] = useState<BikePart | null>(null);
  const [busy, setBusy] = useState(false);
  const [riderIdx, setRiderIdx] = useState(0);
  const [slot, setSlot] = useState<'A' | 'B'>('A');
  const [sel, setSel] = useState<string>('engine');
  if (q.status !== 'ready' || !q.data) return <div className="loading">Caricamento…</div>;
  const b = q.data;
  const levels = Object.fromEntries(b.parts.map((p) => [p.key, p.level])) as Record<BikePart, number>;
  const partColors = Object.fromEntries(b.parts.map((p) => [p.key, p.color])) as Record<BikePart, string>;
  const diff = b.rating - b.rivalsAvg;

  const g = b.garage[Math.min(riderIdx, b.garage.length - 1)];
  const bike = g?.bikes.find((x) => x.slot === slot) ?? g?.bikes[0];
  const part = bike?.parts.find((p) => p.key === sel) ?? bike?.parts[0];
  const worn = bike?.parts.filter((p) => p.serviceable && p.wear >= 75) ?? [];
  const wornCost = worn.reduce((t, p) => t + p.cost, 0);
  const tone = (w: number) => (w >= 100 ? 'bad' : w >= 75 ? 'warn' : w >= 50 ? 'info' : 'ok');

  async function service(keys: string[], label: string) {
    if (!bike) return;
    setBusy(true);
    try {
      await engine.dispatch({ type: 'ServiceParts', bikeId: bike.id, parts: keys as never });
      notify(`${label}: revisione fatta sulla moto ${bike.slot} di ${g!.rider}.`);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  const tile = (p: NonNullable<typeof part>) => (
    <button
      key={p.key}
      className={`gar-tile ${sel === p.key ? 'on' : ''}`}
      onClick={() => setSel(p.key)}
      onMouseEnter={() => setHover(b.parts.find((x) => x.key === PART_OF[p.key])?.key ?? null)}
      onMouseLeave={() => setHover(null)}
    >
      <span className="gar-name">{p.name}</span>
      <span className={`gar-rel ${tone(p.wear)}`}>{p.reliability}%</span>
      <span className="gar-bar">
        <i className={tone(p.wear)} style={{ width: `${Math.min(100, p.wear)}%` }} />
      </span>
      <small>
        usura {p.wear}%{p.upgradeLevel ? ` · liv. ${p.upgradeLevel}` : ''}
      </small>
    </button>
  );

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
      {g && bike && part && (
        <Card className="s12 garage">
          <div className="gar-top">
            <div className="rv-speeds" role="group" aria-label="Pilota">
              {b.garage.map((x, i) => (
                <button key={x.riderId} className={i === riderIdx ? 'on' : ''} onClick={() => setRiderIdx(i)}>
                  #{x.number} {x.rider}
                </button>
              ))}
            </div>
            {g.bikes.length > 1 ? (
              <div className="rv-speeds" role="group" aria-label="Moto">
                {g.bikes.map((x) => (
                  <button
                    key={x.slot}
                    className={x.slot === bike.slot ? 'on' : ''}
                    onClick={() => setSlot(x.slot)}
                  >
                    Moto {x.slot}
                  </button>
                ))}
              </div>
            ) : (
              <span className="muted">Una moto per pilota (la moto B c'è solo in MotoGP)</span>
            )}
            <span className="spacer" />
            <div className="gar-kpi">
              <small>Affidabilità in gara</small>
              <b className={bike.reliability >= 90 ? 'ok' : bike.reliability >= 82 ? 'warn' : 'bad'}>
                {bike.reliability.toFixed(1).replace('.', ',')}%
              </b>
            </div>
            <div className="gar-kpi">
              <small>Chilometri</small>
              <b>{bike.km.toLocaleString('it-IT')} km</b>
            </div>
            <button
              className="btn primary"
              disabled={busy || worn.length === 0 || wornCost > b.balance}
              onClick={() =>
                service(
                  worn.map((p) => p.key),
                  `${worn.length} componenti`,
                )
              }
              title={worn.length === 0 ? 'Nessun componente oltre il 75% di usura' : undefined}
            >
              {worn.length === 0
                ? 'Nessun pezzo da revisionare'
                : `Revisiona i ${worn.length} pezzi oltre il 75% · ${formatMoney(wornCost)}`}
            </button>
          </div>
          <div className="gar-main">
            <div className="gar-col">{bike.parts.slice(0, 7).map(tile)}</div>
            <div className="gar-center">
              <Bike
                team={b.team}
                colors={b.colors}
                number={g.number}
                levels={levels}
                partColors={partColors}
                width={40}
                highlight={hover ?? (PART_OF[part.key] as BikePart)}
                pending={b.parts.filter((p) => p.inProduction).map((p) => p.key)}
              />
              <div className="gar-detail">
                <div>
                  <small className="muted">{part.group}</small>
                  <b>{part.name}</b>
                </div>
                <div className="gar-facts">
                  <span>
                    <small>Usura</small>
                    <b className={tone(part.wear)}>{part.wear}%</b>
                  </span>
                  <span>
                    <small>Affidabilità</small>
                    <b>{part.reliability}%</b>
                  </span>
                  <span>
                    <small>Percorsi</small>
                    <b>
                      {part.km.toLocaleString('it-IT')} / {part.lifeKm.toLocaleString('it-IT')} km
                    </b>
                  </span>
                  <span>
                    <small>Revisioni</small>
                    <b>{part.services}</b>
                  </span>
                  <span>
                    <small>Sviluppo</small>
                    <b>{part.upgradeLevel ? `livello ${part.upgradeLevel}` : 'di serie'}</b>
                  </span>
                </div>
                {part.serviceable ? (
                  <button
                    className="btn"
                    disabled={busy || part.km === 0 || part.cost > b.balance}
                    onClick={() => service([part.key], part.name)}
                  >
                    {part.km === 0 ? 'Appena revisionato' : `Revisiona · ${formatMoney(part.cost)}`}
                  </button>
                ) : (
                  <span className="muted" style={{ fontSize: '.85rem' }}>
                    In MotoGP il motore si cambia dalla dotazione del regolamento: uno nuovo ogni 3 weekend.
                  </span>
                )}
              </div>
            </div>
            <div className="gar-col">{bike.parts.slice(7).map(tile)}</div>
          </div>
          <Explain>
            Ogni pezzo si consuma con i chilometri (le prove si dividono fra moto A e B, qualifiche e gare si
            corrono sulla A). Fino a metà vita è perfetto, poi perde affidabilità e in gara aumenta il rischio
            di guasto. La revisione lo riporta a nuovo e si paga alla voce Riparazioni. Le squadre avversarie
            fanno lo stesso.
          </Explain>
        </Card>
      )}
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
          alla consegna (i giorni dipendono dal pezzo e dal livello dei tuoi reparti tecnici). Sul disegno del
          garage i pezzi in produzione sono tratteggiati, quelli montati si colorano. Anche le avversarie
          investono.
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
