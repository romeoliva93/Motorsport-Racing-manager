/**
 * Il manager (il giocatore): stipendio pagato dalla squadra, soldi personali da spendere in corsi o da
 * investire nella squadra, reputazione, carriera e offerte di lavoro di fine stagione con trattativa.
 */
import { useState } from 'react';
import { formatMoney } from '@lean-angle/core';
import type { ManagerView } from '@lean-angle/game';
import { engine } from '../../engine/engine.ts';
import { useQuery } from '../../engine/hooks.ts';
import { Card, Explain, Row, TeamBadge } from '../../design-system/components.tsx';
import { TEAM_TYPE } from '../../i18n/it.ts';
import './manager.css';

const KIND: Record<string, string> = {
  top: 'Squadra di vertice',
  star: 'Pilota di punta',
  bike: 'Moto al top',
};

export function ManagerScreen({ notify }: { notify: (t: string, e?: boolean) => void }) {
  const q = useQuery('managerView');
  const [invest, setInvest] = useState('0,5');
  const [busy, setBusy] = useState(false);
  if (q.status !== 'ready' || !q.data) return <div className="loading">Caricamento…</div>;
  const v = q.data;
  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      notify(ok);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  const amount = Math.round(parseFloat(invest.replace(',', '.')) * 1_000_000);
  return (
    <div className="mgr">
      <div className="grid12">
        <Card title="Il tuo profilo" className="s5">
          <div className="mgr-rep">
            <span>Reputazione</span>
            <i>
              <b style={{ width: `${v.reputation}%` }} />
            </i>
            <em>{v.reputation}</em>
          </div>
          <Row label="Squadra">{v.team}</Row>
          <Row label="Stipendio">
            <b>{formatMoney(v.salary)}</b> all’anno ({formatMoney(v.monthly)} al mese)
          </Row>
          <Row label="Soldi personali">
            <b className="ok">{formatMoney(v.wallet)}</b>
          </Row>
          <Explain style={{ marginTop: '.8rem' }}>
            Il tuo stipendio lo paga la squadra ogni mese (è un costo del bilancio). Con i tuoi soldi puoi
            fare corsi che migliorano il tuo lavoro o investire nella squadra. La reputazione cresce se fai
            meglio delle attese: a fine stagione può portarti offerte da altre squadre.
          </Explain>
        </Card>
        <Card title="Investi nella squadra" className="s7">
          <p className="t2" style={{ marginTop: 0 }}>
            Sposta i tuoi soldi nel bilancio della squadra: servono per upgrade, ricambi e ingaggi. Investire
            migliora un po’ la tua reputazione.
          </p>
          <div className="mgr-invest">
            <label className="field">
              <span>Importo (milioni di €)</span>
              <input value={invest} onChange={(e) => setInvest(e.target.value)} inputMode="decimal" />
            </label>
            <button
              className="btn primary"
              disabled={busy || !(amount > 0) || amount > v.wallet}
              onClick={() =>
                run(
                  () => engine.dispatch({ type: 'InvestInTeam', amount }),
                  `Hai investito ${formatMoney(amount)} nella squadra.`,
                )
              }
            >
              Investi
            </button>
          </div>
        </Card>
      </div>

      <Card title="Corsi da manager" aside="si pagano con i tuoi soldi">
        <div className="mgr-courses">
          {v.courses.map((c) => (
            <div key={c.skill} className="tile mgr-course">
              <b>{c.name}</b>
              <div className="mgr-pips" aria-label={`Livello ${c.level} di ${c.max}`}>
                {Array.from({ length: c.max }, (_, i) => (
                  <span key={i} className={i < c.level ? 'on' : ''} />
                ))}
              </div>
              <small className="muted">Ora: {c.effect}</small>
              {c.next && <small>Prossimo livello: {c.next}</small>}
              <button
                className="btn"
                disabled={busy || c.cost === null || c.cost > v.wallet}
                onClick={() =>
                  run(
                    () => engine.dispatch({ type: 'ManagerCourse', skill: c.skill }),
                    `Corso «${c.name}» completato.`,
                  )
                }
              >
                {c.cost === null ? 'Livello massimo' : `Iscriviti · ${formatMoney(c.cost)}`}
              </button>
            </div>
          ))}
        </div>
      </Card>

      {v.offers.length > 0 && <Offers v={v} busy={busy} run={run} />}

      {v.history.length > 0 && (
        <Card title="La tua carriera">
          {v.history.map((h) => (
            <Row key={h.year} label={String(h.year)}>
              {h.team} · {h.position}ª su {h.of}
            </Row>
          ))}
        </Card>
      )}
    </div>
  );
}

function Offers({
  v,
  busy,
  run,
}: {
  v: ManagerView;
  busy: boolean;
  run: (fn: () => Promise<unknown>, ok: string) => Promise<void>;
}) {
  const [ask, setAsk] = useState<Record<string, string>>({});
  return (
    <Card title="Offerte di lavoro" aside="trattativa sullo stipendio, poi firma">
      <Explain style={{ marginBottom: '.8rem' }}>
        Puoi chiedere uno stipendio più alto: la squadra accetta se rientra nel suo limite, altrimenti
        rilancia; al terzo rifiuto si ritira. Firmando diventi subito il manager della nuova squadra (con le
        sue promesse).
      </Explain>
      <div className="mgr-offers">
        {v.offers.map((o) => {
          const val = ask[o.id] ?? (o.salary / 1e6).toFixed(2).replace('.', ',');
          const n = Math.round(parseFloat(val.replace(',', '.')) * 1_000_000);
          const open = o.status === 'open';
          return (
            <div
              key={o.id}
              className={`tile mgr-offer ${o.kind}`}
              style={{ ['--tc' as string]: o.colors.primary }}
            >
              <div className="mgr-offer-head">
                <TeamBadge colors={o.colors} short={o.team.slice(0, 3).toUpperCase()} size={2.4} />
                <div>
                  <small className="or">{KIND[o.kind]}</small>
                  <b>{o.team}</b>
                  <small className="muted">
                    {TEAM_TYPE[o.teamType as keyof typeof TEAM_TYPE] ?? o.teamType} · {o.manufacturer} ·
                    reputazione {o.reputation}
                  </small>
                </div>
              </div>
              <p>{o.pitch}</p>
              <div className="muted" style={{ fontSize: '.8rem' }}>
                Piloti attuali: {o.riders.map((r) => `${r.name} (${r.rating})`).join(', ') || '—'}
              </div>
              <Row label="Stipendio offerto">
                <b>{formatMoney(o.salary)}</b> all’anno · {o.years} anni
              </Row>
              {o.rounds.map((r, i) => (
                <div key={i} className="muted" style={{ fontSize: '.8rem' }}>
                  Hai chiesto {formatMoney(r.ask)} →{' '}
                  {r.answer === 'accepted'
                    ? 'accettato'
                    : r.answer === 'countered'
                      ? `rilanciano a ${formatMoney(r.offer)}`
                      : 'si sono ritirati'}
                </div>
              ))}
              {open ? (
                <div className="mgr-invest">
                  <label className="field">
                    <span>Chiedi (milioni di € all’anno)</span>
                    <input
                      value={val}
                      onChange={(e) => setAsk({ ...ask, [o.id]: e.target.value })}
                      inputMode="decimal"
                    />
                  </label>
                  <button
                    className="btn"
                    disabled={busy || !(n > 0)}
                    onClick={() =>
                      run(
                        () => engine.dispatch({ type: 'NegotiateJobOffer', offerId: o.id, salary: n }),
                        'Risposta ricevuta.',
                      )
                    }
                  >
                    Chiedi
                  </button>
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => engine.dispatch({ type: 'AcceptJobOffer', offerId: o.id }),
                        `Firmato: sei il nuovo manager di ${o.team}.`,
                      )
                    }
                  >
                    Firma per {formatMoney(o.salary)}
                  </button>
                </div>
              ) : (
                <span className={`pill ${o.status === 'accepted' ? 'ok' : ''}`}>
                  {o.status === 'accepted' ? 'Firmata' : o.status === 'withdrawn' ? 'Ritirata' : 'Scaduta'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
