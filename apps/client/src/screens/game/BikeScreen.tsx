import { useState } from 'react';
import { formatMoney } from '@lean-angle/core';
import { engine } from '../../engine/engine.ts';
import { useQuery } from '../../engine/hooks.ts';
import { Card, Explain, Help, Tabs } from '../../design-system/components.tsx';
import { BikeArt, type BikeTier, type BikeZone } from '../../design-system/BikeArt.tsx';

type Tab = 'overview' | 'status' | 'maintenance' | 'development';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Vista generale' },
  { id: 'status', label: 'Stato tecnico' },
  { id: 'maintenance', label: 'Manutenzione' },
  { id: 'development', label: 'Sviluppo' },
];

/** Colore di stato: verde → blu → giallo → rosso al crescere dell'usura. */
const tone = (condition: number) =>
  condition <= 0 ? 'bad' : condition < 25 ? 'warn' : condition < 50 ? 'info' : 'ok';

/**
 * Garage. Il giocatore vede pochi gruppi tecnici (6 in MotoGP, 4 Moto2, 3 Moto3, 2 Rookies); i 14 componenti
 * restano il modello interno di usura. La manutenzione ordinaria è delegata al capotecnico: il manager decide
 * solo le sostituzioni importanti (telaio, forcellone) e gli sviluppi in fabbrica.
 */
export function BikeScreen({ notify }: { notify: (t: string, err?: boolean) => void }) {
  const q = useQuery('bikeView');
  const [tab, setTab] = useState<Tab>('overview');
  const [busy, setBusy] = useState(false);
  const [riderIdx, setRiderIdx] = useState(0);
  const [slot, setSlot] = useState<'A' | 'B'>('A');
  const [sel, setSel] = useState<string | null>(null);
  if (q.status !== 'ready' || !q.data) return <div className="loading">Caricamento…</div>;
  const b = q.data;
  const diff = b.rating - b.rivalsAvg;
  const g = b.garage[Math.min(riderIdx, b.garage.length - 1)];
  const bike = g?.bikes.find((x) => x.slot === slot) ?? g?.bikes[0];
  const group = bike?.groups.find((x) => x.key === sel) ?? bike?.groups[0];

  async function run(cmd: Parameters<typeof engine.dispatch>[0], ok: string) {
    setBusy(true);
    try {
      await engine.dispatch(cmd);
      notify(ok);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function buy(key: string, name: string, level: number) {
    await run(
      { type: 'BuyUpgrade', part: key as never },
      `${name} livello ${level + 1} ordinato: la fabbrica lo consegnerà nei prossimi giorni.`,
    );
  }
  const serviceGroup = (bikeId: string, parts: string[], label: string) =>
    run({ type: 'ServiceParts', bikeId, parts: parts as never }, `${label}: revisione fatta.`);

  const zones = (bike?.groups ?? []).map((x) => x.zone);
  const labels = Object.fromEntries((bike?.groups ?? []).map((x) => [x.zone, x.name])) as Partial<
    Record<BikeZone, string>
  >;

  const metrics = (x: NonNullable<typeof group>) => (
    <div className="gar-facts">
      <span>
        <small>Sviluppo</small>
        <b>{x.level ? `livello ${x.level.toString().replace('.', ',')} su 3` : 'di serie'}</b>
      </span>
      <span>
        <small>Condizione</small>
        <b className={tone(x.condition)}>{x.condition}%</b>
      </span>
      <span>
        <small>Usura media</small>
        <b>{x.wear}%</b>
      </span>
      <span>
        <small>Affidabilità</small>
        <b className={x.reliability >= 98 ? 'ok' : x.reliability >= 93 ? 'warn' : 'bad'}>
          {x.reliability.toString().replace('.', ',')}%
        </b>
      </span>
      <span>
        <small>Vita residua</small>
        <b className={x.lifeLeftKm <= 0 ? 'bad' : ''}>
          {x.lifeLeftKm <= 0
            ? 'scaduta'
            : `${x.lifeLeftKm.toLocaleString('it-IT')} km · ~${x.lifeLeftWeekends.toString().replace('.', ',')} GP`}
        </b>
      </span>
    </div>
  );

  return (
    <div className="grid12">
      {g && bike && group && (
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
            <div className="gar-kpi">
              <small>Manutenzione</small>
              <b className={b.garageAuto ? 'ok' : 'warn'}>{b.garageAuto ? 'al capotecnico' : 'manuale'}</b>
            </div>
          </div>
          {b.decisions.length > 0 && (
            <div className="gar-decisions">
              {b.decisions.map((d) => (
                <div key={d.bikeId + d.part}>
                  <span className="pill warn">Decisione</span> Il capotecnico consiglia di sostituire il{' '}
                  <b>{d.name.toLowerCase()}</b> della moto {d.slot} di {d.rider} (usura {d.wear}%).
                  <button
                    className="btn primary"
                    disabled={busy || d.cost > b.balance}
                    onClick={() => serviceGroup(d.bikeId, [d.part], d.name)}
                  >
                    Approva · {formatMoney(d.cost)}
                  </button>
                </div>
              ))}
            </div>
          )}
          <Tabs value={tab} onChange={setTab} options={TABS} />

          {tab === 'overview' && (
            <div className="gar-v2">
              <div className="gar-stage">
                <BikeArt
                  tier={b.tier as BikeTier}
                  colors={b.colors}
                  number={g.number}
                  width={46}
                  zones={zones}
                  selected={group.zone}
                  labels={labels}
                  onSelect={(z) => setSel(bike.groups.find((x) => x.zone === z)?.key ?? null)}
                />
                <p className="muted gar-hint">
                  Clicca su una zona della moto o su un gruppo per vederne lo stato.
                </p>
              </div>
              <div className="gar-side">
                <div className="gar-group-card">
                  <small className="muted">Gruppo tecnico</small>
                  <b className="gar-group-name">{group.name}</b>
                  <p className="t2">{group.what}</p>
                  {metrics(group)}
                  {group.serviceable.length > 0 ? (
                    <button
                      className="btn"
                      disabled={busy || group.serviceCost > b.balance}
                      onClick={() => serviceGroup(bike.id, group.serviceable, group.name)}
                    >
                      Revisiona ora il gruppo · {formatMoney(group.serviceCost)}
                    </button>
                  ) : (
                    <span className="muted" style={{ fontSize: '.85rem' }}>
                      Nulla da revisionare: i componenti sono nuovi o seguono il regolamento.
                    </span>
                  )}
                </div>
                <ul className="gar-groups">
                  {bike.groups.map((x) => (
                    <li key={x.key}>
                      <button className={x.key === group.key ? 'on' : ''} onClick={() => setSel(x.key)}>
                        <span>{x.name}</span>
                        <span className="gar-bar">
                          <i className={tone(x.condition)} style={{ width: `${x.condition}%` }} />
                        </span>
                        <b className={tone(x.condition)}>{x.condition}%</b>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {tab === 'status' && (
            <div className="gar-status">
              <table className="std static">
                <thead>
                  <tr>
                    <th>Gruppo</th>
                    <th>Sviluppo</th>
                    <th>Condizione</th>
                    <th>Usura media</th>
                    <th>Affidabilità</th>
                    <th>Vita residua</th>
                  </tr>
                </thead>
                <tbody>
                  {bike.groups.map((x) => (
                    <tr key={x.key}>
                      <td>
                        <b>{x.name}</b>
                        <details>
                          <summary className="muted">componenti</summary>
                          {bike.parts
                            .filter((pt) => x.parts.includes(pt.key))
                            .map((pt) => (
                              <div key={pt.key} className="muted" style={{ fontSize: '.8rem' }}>
                                {pt.name}: usura {pt.wear}% · {pt.km.toLocaleString('it-IT')}/
                                {pt.lifeKm.toLocaleString('it-IT')} km · affidabilità {pt.reliability}% ·
                                revisioni {pt.services}
                              </div>
                            ))}
                        </details>
                      </td>
                      <td>{x.level ? `liv. ${x.level.toString().replace('.', ',')}` : 'di serie'}</td>
                      <td className={tone(x.condition)}>{x.condition}%</td>
                      <td>{x.wear}%</td>
                      <td>{x.reliability.toString().replace('.', ',')}%</td>
                      <td>{x.lifeLeftKm <= 0 ? 'scaduta' : `${x.lifeLeftKm.toLocaleString('it-IT')} km`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bike.supplier.length > 0 && (
                <p className="muted" style={{ fontSize: '.85rem' }}>
                  Componenti di fornitura (li cura il fornitore unico, senza costi per la squadra):{' '}
                  {bike.supplier.join(', ').toLowerCase()}.
                </p>
              )}
              <Explain>
                <b>Condizione</b>: quanto resta del componente più consumato del gruppo (100% = nuovo).{' '}
                <b>Usura media</b>: media di tutti i componenti. <b>Affidabilità</b>: resta al 100% finché i
                pezzi sono sotto metà vita, poi scende e in gara aumenta il rischio di guasto.{' '}
                <b>Vita residua</b>: chilometri prima che il pezzo più consumato arrivi a fine vita.{' '}
                <b>Sviluppo</b>: livello degli upgrade di fabbrica montati (prestazione, non usura).
              </Explain>
            </div>
          )}

          {tab === 'maintenance' && (
            <div className="gar-maint">
              <div className="settings-row">
                <span>
                  Manutenzione delegata al capotecnico
                  <small>
                    Prima di ogni weekend revisiona da solo i componenti ordinari oltre il 70% e ti lascia una
                    notizia con la spesa. Telaio e forcellone li decidi tu.
                  </small>
                </span>
                <div className="rv-speeds" role="group" aria-label="Manutenzione">
                  <button
                    className={b.garageAuto ? 'on' : ''}
                    disabled={busy}
                    onClick={() =>
                      run({ type: 'SetGarageAuto', auto: true }, 'Manutenzione affidata al capotecnico.')
                    }
                  >
                    Al capotecnico
                  </button>
                  <button
                    className={!b.garageAuto ? 'on' : ''}
                    disabled={busy}
                    onClick={() =>
                      run(
                        { type: 'SetGarageAuto', auto: false },
                        'Manutenzione manuale: le revisioni le decidi tu.',
                      )
                    }
                  >
                    Manuale
                  </button>
                </div>
              </div>
              {b.decisions.length === 0 && <p className="muted">Nessuna decisione importante in sospeso.</p>}
              <h4>Revisione manuale per gruppo</h4>
              <ul className="gar-groups">
                {bike.groups.map((x) => (
                  <li key={x.key}>
                    <div className="gar-maint-row">
                      <span>{x.name}</span>
                      <b className={tone(x.condition)}>{x.condition}%</b>
                      {x.serviceable.length ? (
                        <button
                          className="btn"
                          disabled={busy || x.serviceCost > b.balance}
                          onClick={() => serviceGroup(bike.id, x.serviceable, x.name)}
                        >
                          Revisiona · {formatMoney(x.serviceCost)}
                        </button>
                      ) : (
                        <span className="muted">nulla da fare</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {tab === 'development' && (
        <>
          <Card title="La tua moto" className="s4">
            <div className="muted">Costruttore</div>
            <b style={{ fontSize: '1.15rem' }}>{b.manufacturer}</b>
            <div className="row" style={{ marginTop: '.8rem' }}>
              <span className="muted">
                Qualità della moto
                <Help>
                  Valore da 0 a 100: base del costruttore più gli upgrade montati. In gara pesa per il 40%
                  della prestazione (il resto è il pilota).
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
                    Fascia decisa dai punti del costruttore nella stagione precedente: A per chi vince di più,
                    D per chi è più indietro. Più la fascia è bassa, più gli upgrade costano meno, arrivano
                    prima e si hanno più motori (D: 10 invece di 8).
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
              La moto di serie è nera. Ogni upgrade si ordina alla fabbrica e si paga subito; viene montato
              solo alla consegna (i giorni dipendono dal pezzo e dal livello dei tuoi reparti tecnici). Sul
              disegno del garage i pezzi in produzione sono tratteggiati, quelli montati si colorano. Anche le
              avversarie investono.
            </Explain>
          </Card>
          {b.parts.map((p) => (
            <Card key={p.key} className="s4 part-card">
              <div>
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
        </>
      )}
    </div>
  );
}
