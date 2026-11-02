import { useState } from 'react';
import { formatMoney } from '@lean-angle/core';
import type { BikeView } from '@lean-angle/game';
import { engine } from '../../engine/engine.ts';
import { Explain } from '../../design-system/components.tsx';
import { BikeTop } from '../../design-system/BikeTop.tsx';
import type { BikeTier } from '../../design-system/BikeArt.tsx';

/** Immagini originali dei gruppi tecnici (tools/portraits/parts.py). */
const IMG = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../assets/parts/*.webp', { eager: true, query: '?url', import: 'default' }),
  ).map(([p, u]) => [p.split('/').pop()!.replace('.webp', ''), u as string]),
);

/** Apertura dal pulsante di una notizia del capotecnico: mostra subito il gruppo più consumato. */
export const garageFocus = { worst: false };

type Group = BikeView['garage'][number]['bikes'][number]['groups'][number];

const state = (c: number) =>
  c <= 0
    ? { label: 'Fine vita', tone: 'bad' }
    : c < 30
      ? { label: 'Da revisionare', tone: 'warn' }
      : c < 60
        ? { label: 'Buono', tone: 'info' }
        : { label: 'Ottimo', tone: 'ok' };
const pct = (v: number) => `${v.toString().replace('.', ',')}%`;

/**
 * Garage (prototipo): moto della squadra vista dall'alto al centro, schede dei gruppi tecnici intorno, pannello
 * di confronto e azioni sotto. Due schede: Componenti (stato e sviluppo) e Assetto (regolazioni per pilota).
 * Tutti i valori arrivano dal gioco (bikeView); ogni pulsante invia un comando reale al motore.
 */
export function GarageV2({ b, notify }: { b: BikeView; notify: (t: string, err?: boolean) => void }) {
  const [tab, setTab] = useState<'components' | 'setup'>('components');
  const [riderIdx, setRiderIdx] = useState(0);
  const [slot, setSlot] = useState<'A' | 'B'>('A');
  // Aperto da una notizia del capotecnico: parte dal gruppo più consumato della prima moto.
  const [sel, setSel] = useState<string | null>(() => {
    if (!garageFocus.worst) return null;
    garageFocus.worst = false;
    const groups = b.garage[0]?.bikes[0]?.groups ?? [];
    return [...groups].sort((x, y) => x.condition - y.condition)[0]?.key ?? null;
  });
  const [busy, setBusy] = useState(false);
  const [wet, setWet] = useState(false);
  const [draft, setDraft] = useState<Record<string, Record<string, number>>>({});
  const g = b.garage[Math.min(riderIdx, b.garage.length - 1)];
  const bike = g?.bikes.find((x) => x.slot === slot) ?? g?.bikes[0];
  if (!g || !bike) return <p className="muted">Nessun pilota sotto contratto.</p>;
  const group = bike.groups.find((x) => x.key === sel) ?? bike.groups[0]!;
  const worstCond = Math.min(...bike.groups.map((x) => x.condition));
  const half = Math.ceil(bike.groups.length / 2);

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

  const card = (x: Group) => {
    const st = state(x.condition);
    const upgrade = x.next && !x.next.inProduction && x.next.affordable;
    return (
      <button
        key={x.key}
        className={`gx-card ${x.key === group.key ? 'on' : ''}`}
        onClick={() => setSel(x.key)}
      >
        <span className="gx-img" style={{ backgroundImage: `url(${IMG[x.key] ?? IMG.balance})` }} />
        <span className="gx-lvl">
          <small>Liv.</small>
          <b>{x.level ? x.level.toString().replace('.', ',') : '0'}</b>
        </span>
        <span className="gx-name">{x.name}</span>
        <span className="gx-stats">
          <span title="Indice di prestazione (costruttore + sviluppo)">
            <small>Prest.</small>
            <b>{x.performance}</b>
          </span>
          <span title="Usura media dei componenti">
            <small>Usura</small>
            <b>{x.wear}%</b>
          </span>
          <span title="Affidabilità del gruppo">
            <small>Affid.</small>
            <b>{pct(x.reliability)}</b>
          </span>
        </span>
        <span className="gx-tags">
          <span className={`pill ${st.tone}`}>{st.label}</span>
          {x.next?.inProduction ? (
            <span className="pill info">In produzione</span>
          ) : upgrade ? (
            <span className="pill or">Aggiornamento disponibile</span>
          ) : null}
        </span>
      </button>
    );
  };

  const sv = b.setups.find((x) => x.riderId === g.riderId);
  const side = sv ? (wet ? sv.wet : sv.dry) : null;
  const dkey = `${g.riderId}-${wet ? 'wet' : 'dry'}`;
  const values = { ...(side?.values ?? {}), ...(draft[dkey] ?? {}) };
  const dirty = !!draft[dkey] && Object.keys(draft[dkey]!).length > 0;

  return (
    <div className="gx">
      <div className="gx-head">
        <div className="gx-team">
          <small>{b.manufacturer}</small>
          <b>{b.team}</b>
        </div>
        <div className="rv-speeds" role="group" aria-label="Pilota">
          {b.garage.map((x, i) => (
            <button key={x.riderId} className={i === riderIdx ? 'on' : ''} onClick={() => setRiderIdx(i)}>
              #{x.number} {x.rider}
            </button>
          ))}
        </div>
        {g.bikes.length > 1 && (
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
        )}
        <span className="spacer" />
        <div className="gar-kpi">
          <small>Affidabilità</small>
          <b className={bike.reliability >= 90 ? 'ok' : bike.reliability >= 82 ? 'warn' : 'bad'}>
            {pct(Math.round(bike.reliability * 10) / 10)}
          </b>
        </div>
        <div className="gar-kpi">
          <small>Chilometri</small>
          <b>{bike.km.toLocaleString('it-IT')}</b>
        </div>
        <div className="gar-kpi">
          <small>Stato tecnico</small>
          <b className={state(worstCond).tone}>{state(worstCond).label}</b>
        </div>
      </div>

      <div className="gx-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'components'}
          className={tab === 'components' ? 'on' : ''}
          onClick={() => setTab('components')}
        >
          Componenti
        </button>
        <button
          role="tab"
          aria-selected={tab === 'setup'}
          className={tab === 'setup' ? 'on' : ''}
          onClick={() => setTab('setup')}
        >
          Assetto
        </button>
        <span className="spacer" />
        <span className="muted">Manutenzione</span>
        <div className="rv-speeds" role="group" aria-label="Manutenzione">
          {(
            [
              ['auto', 'Automatica', 'Il capotecnico revisiona da solo i pezzi ordinari oltre il 70%'],
              ['assisted', 'Assistita', 'Il capotecnico avvisa quando un gruppo scende sotto il 30%'],
              ['manual', 'Manuale', 'Decidi tutto tu'],
            ] as const
          ).map(([m, l, t]) => (
            <button
              key={m}
              title={t}
              className={b.garageMode === m ? 'on' : ''}
              disabled={busy}
              onClick={() => run({ type: 'SetGarageMode', mode: m }, `Manutenzione ${l.toLowerCase()}.`)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {tab === 'components' && (
        <>
          {b.decisions.length > 0 && (
            <div className="gar-decisions">
              {b.decisions.map((d) => (
                <div key={d.bikeId + d.part}>
                  <span className="pill warn">Decisione</span> Il capotecnico consiglia di sostituire il{' '}
                  <b>{d.name.toLowerCase()}</b> della moto {d.slot} di {d.rider} (usura {d.wear}%).
                  <button
                    className="btn primary"
                    disabled={busy || d.cost > b.balance}
                    onClick={() =>
                      run(
                        { type: 'ServiceParts', bikeId: d.bikeId, parts: [d.part as never] },
                        `${d.name}: sostituito.`,
                      )
                    }
                  >
                    Approva · {formatMoney(d.cost)}
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className={`gx-main n${bike.groups.length}`}>
            <div className="gx-col">{bike.groups.slice(0, half).map(card)}</div>
            <div className="gx-bike">
              <BikeTop tier={b.tier as BikeTier} colors={b.colors} number={g.number} height={38} />
            </div>
            <div className="gx-col">{bike.groups.slice(half).map(card)}</div>
          </div>

          <div className="gx-detail">
            <div className="gx-detail-head">
              <span
                className="gx-img big"
                style={{ backgroundImage: `url(${IMG[group.key] ?? IMG.balance})` }}
              />
              <div>
                <small className="muted">
                  Gruppo tecnico · moto {bike.slot} di {g.rider}
                </small>
                <h3>{group.name}</h3>
                <p className="t2">{group.what}</p>
              </div>
            </div>
            <table className="std static gx-compare">
              <thead>
                <tr>
                  <th />
                  <th>Installato</th>
                  <th>{group.next ? `Nuovo pacchetto: ${group.next.part}` : 'Nuovo pacchetto'}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Livello di sviluppo</td>
                  <td>{group.level ? group.level.toString().replace('.', ',') : 'di serie'}</td>
                  <td>{group.next ? `livello ${group.next.level}` : '—'}</td>
                </tr>
                <tr>
                  <td>Prestazione</td>
                  <td>{group.performance}</td>
                  <td className={group.next ? 'ok' : ''}>
                    {group.next
                      ? `${group.next.performance} (+${group.next.performance - group.performance})`
                      : '—'}
                  </td>
                </tr>
                <tr>
                  <td>Condizione / usura</td>
                  <td className={state(group.condition).tone}>
                    {group.condition}% · usura {group.wear}%
                  </td>
                  <td>{group.next ? 'nuovo: 100% · usura 0%' : '—'}</td>
                </tr>
                <tr>
                  <td>Affidabilità</td>
                  <td>{pct(group.reliability)}</td>
                  <td>{group.next ? '100% (pezzi nuovi)' : '—'}</td>
                </tr>
                <tr>
                  <td>Vita residua</td>
                  <td>
                    {group.lifeLeftKm <= 0
                      ? 'scaduta'
                      : `${group.lifeLeftKm.toLocaleString('it-IT')} km · ~${group.lifeLeftWeekends.toString().replace('.', ',')} GP`}
                  </td>
                  <td>{group.next ? 'piena' : '—'}</td>
                </tr>
                <tr>
                  <td>Consegna e montaggio</td>
                  <td>—</td>
                  <td>
                    {group.next?.inProduction
                      ? `in produzione, pronto il ${group.next.inProduction.ready}`
                      : group.next?.leadDays !== null && group.next?.leadDays !== undefined
                        ? `${group.next.leadDays} giorni dalla fabbrica`
                        : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="gx-actions">
              <button
                className="btn"
                disabled={busy || group.serviceable.length === 0 || group.serviceCost > b.balance}
                title={
                  group.serviceable.length === 0 ? 'Componenti nuovi o gestiti dal regolamento' : undefined
                }
                onClick={() =>
                  run(
                    { type: 'ServiceParts', bikeId: bike.id, parts: group.serviceable as never },
                    `${group.name}: revisione fatta.`,
                  )
                }
              >
                Revisiona · {formatMoney(group.serviceCost)}
              </button>
              <button
                className="btn"
                disabled={busy || group.spares < 1}
                title={group.spares < 1 ? 'Nessun ricambio in magazzino' : undefined}
                onClick={() =>
                  run(
                    { type: 'ReplaceGroup', bikeId: bike.id, group: group.key },
                    `${group.name}: sostituito con un ricambio.`,
                  )
                }
              >
                Sostituisci con ricambio ({group.spares} in magazzino)
              </button>
              <button
                className="btn"
                disabled={busy || group.spareCost === null || group.spareCost > b.balance}
                onClick={() =>
                  run(
                    { type: 'BuySpare', group: group.key },
                    `${group.name}: ricambio ordinato e messo in magazzino.`,
                  )
                }
              >
                Ordina ricambio · {formatMoney(group.spareCost ?? 0)}
              </button>
              {group.next && !group.next.inProduction && (
                <button
                  className="btn primary"
                  disabled={busy || !group.next.affordable}
                  title={group.next.affordable ? undefined : 'Non hai abbastanza soldi in cassa'}
                  onClick={() =>
                    run(
                      { type: 'BuyUpgrade', part: group.next!.partKey as never },
                      `${group.next!.part} livello ${group.next!.level} ordinato alla fabbrica.`,
                    )
                  }
                >
                  Sviluppa: ordina livello {group.next.level} · {formatMoney(group.next.cost ?? 0)}
                </button>
              )}
            </div>
            <Explain>
              <b>Prestazione</b>: indice da costruttore e sviluppo (non cambia con l'usura). <b>Condizione</b>
              : stato del pezzo più consumato. <b>Affidabilità</b>: resta piena fino a metà vita, poi scende e
              in gara aumenta il rischio di guasto. La revisione si paga subito; il ricambio si compra prima e
              si monta quando serve. Gli aggiornamenti arrivano dalla fabbrica e si montano nuovi alla
              consegna.
            </Explain>
          </div>
        </>
      )}

      {tab === 'setup' && sv && side && (
        <div className="gx-setup">
          <div className="gx-setup-head">
            <div>
              <small className="muted">Assetto di {sv.rider}</small>
              <h3>{b.nextCircuit ? `Per ${b.nextCircuit}` : 'Assetto base'}</h3>
            </div>
            <div className="rv-speeds" role="group" aria-label="Condizione">
              <button className={!wet ? 'on' : ''} onClick={() => setWet(false)}>
                Asciutto
              </button>
              <button className={wet ? 'on' : ''} onClick={() => setWet(true)}>
                Bagnato
              </button>
            </div>
            <div className="gar-kpi">
              <small>Intesa con il pilota</small>
              <b className={side.match >= 80 ? 'ok' : side.match >= 60 ? 'warn' : 'bad'}>{side.match}%</b>
            </div>
          </div>
          <ul className="gx-sliders">
            {sv.keys.map((k) => {
              const fb = side.feedback.find((f) => f.key === k.key);
              const v = values[k.key] ?? 0;
              return (
                <li key={k.key}>
                  <label>
                    <b>{k.name}</b>
                    <span className="muted">
                      {k.low} ← → {k.high}
                    </span>
                  </label>
                  <input
                    type="range"
                    min={-5}
                    max={5}
                    step={1}
                    value={v}
                    aria-label={k.name}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        [dkey]: { ...(draft[dkey] ?? {}), [k.key]: Number(e.target.value) },
                      })
                    }
                  />
                  <b className="gx-val">{v > 0 ? `+${v}` : v}</b>
                  <span className={`gx-fb ${fb?.ok ? 'ok' : ''}`}>«{fb?.text}»</span>
                </li>
              );
            })}
          </ul>
          <div className="gx-actions">
            <button
              className="btn primary"
              disabled={busy || !dirty}
              onClick={async () => {
                await run(
                  {
                    type: 'SetSetup',
                    riderId: sv.riderId,
                    condition: wet ? 'wet' : 'dry',
                    values: draft[dkey]!,
                  },
                  `Assetto ${wet ? 'bagnato' : 'asciutto'} di ${sv.rider} salvato.`,
                );
                setDraft({ ...draft, [dkey]: {} });
              }}
            >
              Applica assetto
            </button>
            {dirty && (
              <button className="btn" onClick={() => setDraft({ ...draft, [dkey]: {} })}>
                Annulla modifiche
              </button>
            )}
          </div>
          <Explain>
            Ogni pilota ha il suo assetto, separato da componenti e sviluppo. I commenti arrivano dal pilota (feedback {sv.feedbackQuality}): più l'assetto si avvicina a ciò che vuole su questo circuito, più
            va forte (fino a ±1,5% di ritmo). L'intesa si aggiorna dopo aver applicato le modifiche. Le prove
            libere con giri di prova e tempi di intervento arriveranno con la milestone delle sessioni
            simulate.
          </Explain>
        </div>
      )}
    </div>
  );
}
