import { useState } from 'react';
import { formatMoney } from '@lean-angle/core';
import { engine } from '../../engine/engine.ts';
import { useQuery } from '../../engine/hooks.ts';
import { Card, Explain } from '../../design-system/components.tsx';

const RISK_TEXT: Record<string, string> = {
  safe: 'Obiettivo facile, pochi soldi in più. Per andare sul sicuro.',
  balanced: 'Obiettivo in linea con il valore della squadra. Buon compromesso.',
  ambitious: 'Obiettivo difficile, ma tanti soldi e un premio grande se ce la fai.',
};

export function SponsorsScreen({ notify }: { notify: (t: string, err?: boolean) => void }) {
  const q = useQuery('sponsorView');
  const [busy, setBusy] = useState(false);
  if (q.status !== 'ready' || !q.data) return <div className="loading">Caricamento…</div>;
  const v = q.data;

  async function sign(risk: 'safe' | 'balanced' | 'ambitious', name: string) {
    setBusy(true);
    try {
      await engine.dispatch({ type: 'SignSponsorDeal', risk });
      notify(`Contratto firmato con ${name}.`);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Explain>
        Oltre agli sponsor fissi (<b>{formatMoney(v.baseMonthly)}</b> al mese), ogni stagione puoi firmare con
        uno sponsor principale che ti chiede un <b>obiettivo</b>: la posizione minima della tua squadra nella
        classifica squadre a fine anno. Ti paga una rata ogni mese e, se raggiungi l’obiettivo, un premio
        finale. Si sceglie prima del primo Gran Premio. Secondo gli esperti la tua squadra vale il{' '}
        <b>
          {v.expected.position}° posto su {v.expected.of}
        </b>
        .
      </Explain>

      {v.deal && (
        <Card title="Sponsor della stagione" className="accent">
          <div className="deal">
            <div>
              <div className="muted">{v.deal.label}</div>
              <div className="big" style={{ fontSize: '1.7rem' }}>
                {v.deal.sponsorName}
              </div>
            </div>
            <div>
              <div className="muted">Obiettivo</div>
              <b>almeno {v.deal.targetPosition}ª squadra</b>
            </div>
            <div>
              <div className="muted">Adesso sei</div>
              <b
                className={
                  v.deal.currentPosition === null
                    ? ''
                    : v.deal.currentPosition <= v.deal.targetPosition
                      ? 'ok'
                      : 'bad'
                }
              >
                {v.deal.currentPosition === null ? 'si parte' : `${v.deal.currentPosition}ª`}
              </b>
            </div>
            <div>
              <div className="muted">Ogni mese</div>
              <b className="ok">+{formatMoney(v.deal.monthly)}</b>
            </div>
            <div>
              <div className="muted">Premio finale</div>
              <b className={v.deal.status === 'missed' ? 'muted' : 'ok'}>
                {v.deal.status === 'met'
                  ? `incassato ${formatMoney(v.deal.bonus)}`
                  : v.deal.status === 'missed'
                    ? 'obiettivo mancato'
                    : formatMoney(v.deal.bonus)}
              </b>
            </div>
          </div>
        </Card>
      )}

      {!v.deal && v.windowOpen && (
        <div className="offers">
          {v.offers.map((o) => (
            <Card key={o.risk} className={o.risk === 'balanced' ? 'accent' : ''}>
              <div className="muted">Offerta {o.label.toLowerCase()}</div>
              <h3 style={{ margin: '.2rem 0 .1rem', fontSize: '1.35rem' }}>{o.sponsorName}</h3>
              <div className="muted" style={{ marginBottom: '.8rem' }}>
                {o.industry}
              </div>
              <div className="row">
                <span className="muted">Obiettivo</span>
                <b>almeno {o.targetPosition}ª squadra</b>
              </div>
              <div className="row">
                <span className="muted">Ogni mese</span>
                <b className="ok">+{formatMoney(o.monthly)}</b>
              </div>
              <div className="row">
                <span className="muted">Premio se ce la fai</span>
                <b className="ok">+{formatMoney(o.bonus)}</b>
              </div>
              <p className="t2" style={{ minHeight: '2.8em' }}>
                {RISK_TEXT[o.risk]}
              </p>
              <button
                className={`btn ${o.risk === 'balanced' ? 'primary' : ''}`}
                disabled={busy}
                onClick={() => sign(o.risk, o.sponsorName)}
              >
                Firma con {o.sponsorName}
              </button>
            </Card>
          ))}
        </div>
      )}

      {!v.deal && !v.windowOpen && (
        <Card>
          <p className="t2" style={{ margin: 0 }}>
            Quest’anno non hai firmato con uno sponsor principale: la scelta si fa prima del primo Gran
            Premio. Potrai farlo all’inizio della prossima stagione.
          </p>
        </Card>
      )}
    </div>
  );
}
