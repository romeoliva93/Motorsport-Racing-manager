/**
 * Rientro ai box a fine uscita (prove del weekend e test): il pilota racconta com'è andata, il capotecnico
 * propone le modifiche e il manager sceglie quali fare prima di tornare in pista.
 */
import { useState } from 'react';
import type { StintView } from '@lean-angle/game';
import { engine } from '../../engine/engine.ts';
import { Card, lapTime } from '../../design-system/components.tsx';

type Rider = StintView['debrief'][number];

const MOOD: Record<Rider['mood'], string> = { good: '😀', ok: '😐', bad: '😟' };

export function PitStop({
  stint,
  title,
  busy,
  notify,
  onNext,
  onFinish,
}: {
  stint: StintView;
  title: string;
  busy: boolean;
  notify: (text: string, err?: boolean) => void;
  onNext: () => void;
  onFinish: () => void;
}) {
  return (
    <Card
      title={`Rientro ai box · ${title}`}
      aside={`Uscita ${stint.done} di ${stint.runs} fatta`}
      className="accent"
    >
      <p className="t2" style={{ marginTop: 0 }}>
        I piloti sono rientrati. Leggi cosa dicono e cosa propone il capotecnico: scegli le modifiche da fare
        (o nessuna), poi torna in pista. Non tutte le proposte sono sicure: quelle «da provare» possono anche
        peggiorare la moto.
      </p>
      <div className="pit-grid">
        {stint.debrief.map((d) => (
          <PitRider key={d.riderId} d={d} busy={busy} notify={notify} />
        ))}
      </div>
      <div className="ps-actions">
        <button className="btn primary big-cta" disabled={busy} onClick={onNext}>
          {busy ? 'In pista…' : `Torna in pista · uscita ${stint.done + 1} di ${stint.runs}`}
        </button>
        <button
          className="btn ghost"
          disabled={busy}
          onClick={onFinish}
          title="Le uscite rimaste si fanno senza fermarsi"
        >
          Finisci la sessione senza fermarti
        </button>
      </div>
    </Card>
  );
}

function PitRider({
  d,
  busy,
  notify,
}: {
  d: Rider;
  busy: boolean;
  notify: (t: string, e?: boolean) => void;
}) {
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const open = d.suggestions.filter((x) => !x.applied);
  const chosen = open.filter((x) => pick[x.key]);
  const minutes = chosen.reduce((t, x) => t + x.minutes, 0);
  const tooLong = d.minutesLeft !== null && minutes > d.minutesLeft;
  async function apply() {
    try {
      await engine.dispatch({
        type: 'SetSetup',
        riderId: d.riderId,
        condition: d.wet ? 'wet' : 'dry',
        values: Object.fromEntries(chosen.map((x) => [x.key, x.to])),
      });
      setPick({});
      notify(`${d.name}: modifiche fatte (${chosen.map((x) => x.name.toLowerCase()).join(', ')}).`);
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  return (
    <div className="tile pit-rider">
      <div className="strat-head">
        <span className="strat-num">{d.number}</span>
        <div>
          <b>{d.name}</b>
          <div className="muted">
            {d.best ? `Miglior giro ${lapTime(d.best)} · ${d.position}°` : 'Nessun giro valido'}
            {d.match !== null ? ` · intesa con l’assetto ${d.match}%` : ''}
          </div>
        </div>
      </div>
      <blockquote className={`pit-quote m-${d.mood}`}>
        <span aria-hidden>{MOOD[d.mood]}</span> «{d.quote}»
      </blockquote>
      <div className="pit-sub">
        <b>{d.chiefName}</b> propone
        {d.minutesLeft !== null && (
          <span className="muted"> · {Math.max(0, d.minutesLeft)} minuti di lavoro ai box</span>
        )}
      </div>
      {d.suggestions.length === 0 && <p className="t2">«Non toccherei niente: la moto è a posto.»</p>}
      <ul className="pit-list">
        {d.suggestions.map((x) => (
          <li key={x.key}>
            <label className={x.applied ? 'done' : ''}>
              <input
                type="checkbox"
                disabled={x.applied || busy}
                checked={x.applied || !!pick[x.key]}
                onChange={(ev) => setPick({ ...pick, [x.key]: ev.target.checked })}
              />
              <span>
                <b>{x.chief}</b>
                <small>
                  Pilota: «{x.rider}» · {x.minutes} min ·{' '}
                  <span className={x.sure ? 'ok' : 'warn'}>{x.sure ? 'sicuro' : 'da provare'}</span>
                  {x.applied ? ' · fatto' : ''}
                </small>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {open.length > 0 && (
        <button className="btn" disabled={busy || chosen.length === 0 || tooLong} onClick={apply}>
          {tooLong
            ? `Servono ${minutes} minuti: troppi`
            : chosen.length === 0
              ? 'Scegli le modifiche da fare'
              : `Fai ${chosen.length === 1 ? 'la modifica' : `le ${chosen.length} modifiche`} · ${minutes} min`}
        </button>
      )}
    </div>
  );
}
