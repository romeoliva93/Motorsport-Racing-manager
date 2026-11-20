/**
 * Test pre-stagionali: nelle giornate di test il giocatore sceglie un programma per ogni pilota e corre la
 * giornata (tutti i piloti della categoria girano). Fuori dalle giornate mostra il calendario dei test e i
 * loro effetti sulla stagione.
 */
import { useState } from 'react';
import { formatMoney } from '@lean-angle/core';
import type { PreseasonView, SessionTiming } from '@lean-angle/game';
import { engine } from '../../engine/engine.ts';
import { Card, Explain, Help, lapTime } from '../../design-system/components.tsx';
import { FlagName } from '../../design-system/Flag.tsx';
import { SessionViewer } from '../../race/SessionViewer.tsx';

type Program = PreseasonView['programs'][number]['id'];

const STATUS: Record<PreseasonView['tests'][number]['status'], string> = {
  upcoming: 'In programma',
  today: 'Oggi',
  done: 'Completato',
  skipped: 'Saltato',
};

export function PreseasonPanel({
  v,
  notify,
}: {
  v: PreseasonView;
  notify: (text: string, err?: boolean) => void;
}) {
  const t = v.today;
  const [plan, setPlan] = useState<Record<string, Program>>({});
  const [busy, setBusy] = useState(false);
  const [timing, setTiming] = useState<SessionTiming | null>(null);
  const [title, setTitle] = useState('');

  if (timing) return <SessionViewer timing={timing} title={title} onClose={() => setTiming(null)} />;

  const progOf = (id: string): Program => plan[id] ?? 'setup';
  async function runDay() {
    if (!t) return;
    setBusy(true);
    try {
      const programs = Object.fromEntries(t.riders.map((r) => [r.id, progOf(r.id)]));
      await engine.dispatch({ type: 'RunTestDay', programs });
      const tm = await engine.timing();
      setTitle(`${t.name} · giorno ${t.day}`);
      if (tm) setTiming(tm);
      notify(`${t.name}: giorno ${t.day} di ${t.days} completato.`);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function skip() {
    if (!t) return;
    setBusy(true);
    try {
      await engine.dispatch({ type: 'ContinueToNextEvent' });
      notify(`Hai saltato il resto del ${t.name.toLowerCase()}.`);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="preseason">
      {t && (
        <Card title={`${t.name} · ${t.circuit}`} aside={`Giorno ${t.day} di ${t.days}`} className="accent">
          <Explain style={{ marginBottom: '1rem' }}>
            Nei test girano tutte le squadre della categoria. Il lavoro fatto qui resta per tutta la stagione:
            ogni giornata alza la <b>confidenza con la moto</b> da cui i tuoi piloti partono in ogni weekend
            (senza test si parte da 50, le squadre avversarie partono da 60). Il programma <b>Sviluppo</b>{' '}
            invece rende gli upgrade della stagione più rapidi ed economici. Ogni giornata costa{' '}
            {formatMoney(t.cost)} di trasferta.
          </Explain>
          <div className="strat-grid">
            {t.riders.map((r) => (
              <div key={r.id} className="tile strat">
                <div className="strat-head">
                  <span className="strat-num">{r.number}</span>
                  <div>
                    <b>{r.name}</b>
                    <div className="muted">Confidenza con la moto di partenza: {r.bikeBase}</div>
                  </div>
                </div>
                <div className="strat-label">
                  Programma
                  <Help>{v.programs.find((p) => p.id === progOf(r.id))!.text}</Help>
                </div>
                <div className="choice four">
                  {v.programs.map((p) => (
                    <button
                      key={p.id}
                      className={progOf(r.id) === p.id ? 'on' : ''}
                      onClick={() => setPlan({ ...plan, [r.id]: p.id })}
                      title={p.text}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <p className="t2 ps-prog">{v.programs.find((p) => p.id === progOf(r.id))!.text}</p>
              </div>
            ))}
          </div>
          <div className="ps-actions">
            <button className="btn primary big-cta" disabled={busy} onClick={runDay}>
              {busy ? 'In pista…' : `Corri la giornata ${t.day}`}
            </button>
            <button className="btn ghost" disabled={busy} onClick={skip}>
              Salta il resto del test
            </button>
          </div>
        </Card>
      )}

      <Card title="Test pre-stagionali" aside={`Sviluppo: ${v.devEffect}`}>
        <table className="std">
          <thead>
            <tr>
              <th>Test</th>
              <th>Circuito</th>
              <th>Data</th>
              <th>Giornate</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {v.tests.map((x) => (
              <tr key={x.id} className={x.status === 'today' ? 'mine' : undefined}>
                <td>{x.name}</td>
                <td>
                  <FlagName code={x.country} /> · {x.circuit}
                </td>
                <td>{x.date}</td>
                <td>
                  {x.done}/{x.days}
                </td>
                <td>{STATUS[x.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="t2">
          Confidenza con la moto di partenza:{' '}
          {v.riders.map((r, i) => (
            <span key={r.id}>
              {i > 0 && ' · '}
              {r.name} <b>{r.bikeBase}</b>
            </span>
          ))}
        </p>
      </Card>

      {v.lastDay && (
        <Card title="Tempi dell’ultima giornata" aside={v.lastDay.title}>
          <table className="std">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Pilota</th>
                <th>Squadra</th>
                <th>Tempo</th>
                <th>Distacco</th>
              </tr>
            </thead>
            <tbody>
              {v.lastDay.rows.map((x) => (
                <tr key={x.pos} className={x.mine ? 'mine' : undefined}>
                  <td>{x.pos}</td>
                  <td>
                    <span style={{ borderLeft: `4px solid ${x.color}`, paddingLeft: 6 }}>
                      {x.number} {x.name}
                    </span>
                  </td>
                  <td>{x.team}</td>
                  <td>{lapTime(x.best)}</td>
                  <td>{x.pos === 1 ? '' : `+${x.gap.toFixed(3)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {v.log.length > 0 && (
        <Card title="Diario dei test">
          <ul className="ps-log">
            {[...v.log].reverse().map((l, i) => (
              <li key={i} className="t2">
                {l.text}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
