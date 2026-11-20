/**
 * Test pre-stagionali: nelle giornate di test il giocatore sceglie un programma per ogni pilota e corre la
 * giornata (tutti i piloti della categoria girano). Fuori dalle giornate mostra il calendario dei test e i
 * loro effetti sulla stagione.
 */
import { useState } from 'react';
import { formatMoney } from '@lean-angle/core';
import type { PreseasonView, SessionTiming, StintView } from '@lean-angle/game';
import { engine } from '../../engine/engine.ts';
import { Card, Explain, lapTime } from '../../design-system/components.tsx';
import { FlagName } from '../../design-system/Flag.tsx';
import { SessionViewer } from '../../race/SessionViewer.tsx';
import { PitStop } from './PitStop.tsx';

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
  v: PreseasonView & { stint?: StintView | null };
  notify: (text: string, err?: boolean) => void;
}) {
  const t = v.today;
  const [plan, setPlan] = useState<Record<string, Program>>({});
  const [busy, setBusy] = useState(false);
  const [timing, setTiming] = useState<SessionTiming | null>(null);
  const [title, setTitle] = useState('');

  if (timing) return <SessionViewer timing={timing} title={title} onClose={() => setTiming(null)} />;

  const progOf = (id: string): Program => plan[id] ?? 'setup';
  async function runDay(all = false) {
    if (!t) return;
    setBusy(true);
    try {
      const programs = Object.fromEntries(t.riders.map((r) => [r.id, progOf(r.id)]));
      await engine.dispatch({ type: 'RunTestDay', programs, ...(all ? { all: true } : {}) });
      const tm = await engine.timing();
      setTitle(`${t.name} · giorno ${t.day}${tm?.run ? ` · uscita ${tm.run.n} di ${tm.run.of}` : ''}`);
      if (tm) setTiming(tm);
      if (all || (tm?.run && tm.run.n === tm.run.of))
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
      {t && v.stint && (
        <PitStop
          stint={v.stint}
          title={`${t.name} · giorno ${t.day}`}
          busy={busy}
          notify={notify}
          onNext={() => runDay()}
          onFinish={() => runDay(true)}
        />
      )}
      {t && !v.stint && (
        <Card title={`${t.name} · ${t.circuit}`} aside={`Giorno ${t.day} di ${t.days}`} className="accent">
          <Explain style={{ marginBottom: '1rem' }}>
            Ogni pilota ha una <b>percentuale</b> per ogni programma (diversa per tutti). Scegli su cosa
            lavora oggi: a fine giornata quella percentuale riceve il boost più grande (la parte verde della
            barra), le altre salgono poco. Le percentuali valgono per tutta la stagione. La giornata ha 3
            uscite: a ogni rientro ai box il pilota ti dice com’è la moto e il capotecnico propone modifiche.
            Ogni giornata costa {formatMoney(t.cost)} di trasferta.
          </Explain>
          <div className="strat-grid">
            {t.riders.map((r) => (
              <div key={r.id} className="tile strat">
                <div className="strat-head">
                  <span className="strat-num">{r.number}</span>
                  <div>
                    <b>{r.name}</b>
                    <div className="muted">Scegli su cosa lavora oggi: tocca un programma.</div>
                  </div>
                </div>
                <ProgramBars
                  r={r}
                  v={v}
                  selected={progOf(r.id)}
                  onPick={(p) => setPlan({ ...plan, [r.id]: p })}
                />
              </div>
            ))}
          </div>
          <div className="ps-actions">
            <button className="btn primary big-cta" disabled={busy} onClick={() => runDay()}>
              {busy ? 'In pista…' : `Corri la giornata ${t.day} · uscita 1`}
            </button>
            <button className="btn ghost" disabled={busy} onClick={skip}>
              Salta il resto del test
            </button>
          </div>
        </Card>
      )}

      <Card title="Test pre-stagionali">
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
        {!t && (
        <div className="strat-grid" style={{ marginTop: '1rem' }}>
          {v.riders.map((r) => (
            <div key={r.id} className="tile strat">
              <div className="strat-head">
                <span className="strat-num">{r.number}</span>
                <b>{r.name}</b>
              </div>
              <ProgramBars r={r} v={v} />
            </div>
        )}
          ))}
        </div>
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

/**
 * Le quattro percentuali del pilota: barra piena = valore attuale, parte chiara = boost della giornata se si
 * sceglie quel programma. Sotto, cosa vale in stagione.
 */
function ProgramBars({
  r,
  v,
  selected,
  onPick,
}: {
  r: PreseasonView['riders'][number];
  v: PreseasonView;
  selected?: Program;
  onPick?: (p: Program) => void;
}) {
  const fx = r.effects;
  const effect: Record<Program, string> = {
    track: `confidenza col circuito ${fx.trackConf >= 0 ? '+' : ''}${fx.trackConf} a inizio weekend`,
    setup: `confidenza con la moto ${fx.bikeConf} a inizio weekend`,
    longRun: `gestione gomme in gara ${fx.tyres >= 0 ? '+' : ''}${fx.tyres}%`,
    development: `upgrade −${fx.upgradeCost}% di costo, −${fx.upgradeTime}% di tempo`,
  };
  return (
    <div className="prog-bars" role={onPick ? 'radiogroup' : undefined} aria-label="Programmi">
      {v.programs.map((p) => {
        const now = r.levels[p.id];
        const plus = selected ? r.boost[selected][p.id] : 0;
        const on = selected === p.id;
        const Tag = onPick ? 'button' : 'div';
        return (
          <Tag
            key={p.id}
            className={`prog-row ${on ? 'on' : ''}`}
            {...(onPick
              ? { type: 'button' as const, role: 'radio', 'aria-checked': on, onClick: () => onPick(p.id) }
              : {})}
            title={`${p.text} ${p.effect}`}
          >
            <span className="prog-name">
              {onPick && <span className="prog-dot" aria-hidden />}
              {p.label}
            </span>
            <span className="prog-bar" aria-hidden>
              <i style={{ width: `${now}%` }} />
              {plus > 0 && <em style={{ left: `${now}%`, width: `${plus}%` }} />}
            </span>
            <span className="prog-val">
              <b>{Math.round(now)}%</b>
              {plus > 0 && <small className={on ? 'ok' : 'muted'}> +{plus.toFixed(1)}</small>}
            </span>
            <span className="prog-fx">{effect[p.id]}</span>
          </Tag>
        );
      })}
    </div>
  );
}
