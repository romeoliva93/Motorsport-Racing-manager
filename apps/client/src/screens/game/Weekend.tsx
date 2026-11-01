import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReplayData, ResultRowView, WeekendView } from '@lean-angle/game';
import { engine } from '../../engine/engine.ts';
import { useQuery } from '../../engine/hooks.ts';
import { Card, Explain, Help, Pos, lapTime, raceTime } from '../../design-system/components.tsx';
import { country } from '../../i18n/it.ts';
import { RaceViewer } from './RaceViewer.tsx';
import './weekend.css';

type Compound = 'soft' | 'medium' | 'hard';
type Mode = 'conservative' | 'normal' | 'attack';

const TYRES: { id: Compound; label: string; text: string }[] = [
  { id: 'soft', label: 'Morbida', text: 'Più veloce nei primi giri, ma si consuma prima e cala nel finale.' },
  { id: 'medium', label: 'Media', text: 'Il compromesso: buona velocità, consumo regolare.' },
  {
    id: 'hard',
    label: 'Dura',
    text: "Più lenta all'inizio, ma resiste meglio fino alla bandiera a scacchi.",
  },
];
const MODES: { id: Mode; label: string; text: string }[] = [
  {
    id: 'conservative',
    label: 'Prudente',
    text: 'Meno rischi di cadere, gomme che durano di più, un po’ più lento.',
  },
  { id: 'normal', label: 'Normale', text: 'Ritmo di gara equilibrato.' },
  { id: 'attack', label: 'Attacco', text: 'Più veloce e più sorpassi, ma il doppio del rischio di caduta.' },
];

export function WeekendScreen({
  notify,
  goMarket,
  showSeasonEnd,
  openSeasonEnd,
}: {
  notify: (text: string, err?: boolean) => void;
  goMarket: () => void;
  /** Mostra il riepilogo di fine stagione (richiesto dal pulsante "Chiudi la stagione"). */
  showSeasonEnd: boolean;
  openSeasonEnd: () => void;
}) {
  const q = useQuery('weekendView');
  const [replay, setReplay] = useState<ReplayData | null>(null);
  const [watching, setWatching] = useState(false);
  const [busy, setBusy] = useState(false);

  // Se si torna su questa schermata dopo una gara, si possono comunque rivedere i dati in memoria.
  const roundId = q.status === 'ready' ? q.data.round?.id : undefined;
  useEffect(() => {
    if (!roundId) return;
    engine.replay().then(
      (r) => setReplay(r && r.roundId === roundId ? r : null),
      () => setReplay(null),
    );
  }, [roundId]);

  if (q.status !== 'ready') return <div className="loading">Caricamento…</div>;
  const w = q.data;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  if (w.state === 'seasonOver' || (w.seasonFinished && showSeasonEnd && !watching))
    return <SeasonEnd notify={notify} goMarket={goMarket} />;
  if (!w.round) return <div className="loading">Nessun evento in calendario.</div>;

  if (watching && replay)
    return (
      <RaceViewer
        data={replay}
        onDone={() => {
          setWatching(false);
          window.scrollTo(0, 0);
        }}
      />
    );

  const r = w.round;
  const step = w.state === 'upcoming' ? 0 : r.status === 'pending' ? 1 : r.status === 'qualified' ? 2 : 4;

  return (
    <div className="weekend">
      <div className="wk-hero card accent">
        <div className="wk-info">
          <small className="muted">
            Gran Premio {r.number} di {r.total} · {r.category}
          </small>
          <h1>{r.circuit}</h1>
          <div className="t2">
            {country(r.country)} · {r.date}
            {w.state === 'upcoming' && ` · tra ${r.inDays} giorni`}
          </div>
          <div className="wk-facts">
            <span>
              <b>{r.laps}</b> giri
            </span>
            <span>
              <b>{r.lengthKm.toFixed(2).replace('.', ',')}</b> km
            </span>
            <span>
              <b>{r.turns}</b> curve
            </span>
          </div>
        </div>
        {w.track && <TrackMap points={w.track} />}
      </div>

      <ol className="wk-steps" aria-label="Fasi del weekend">
        {['Arrivo', 'Qualifiche', 'Strategia', 'Gara', 'Risultati'].map((s, i) => (
          <li key={s} className={i < step ? 'done' : i === step || (step === 4 && i === 3) ? 'now' : ''}>
            <span>{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      {w.state === 'upcoming' && (
        <Card title="Il prossimo Gran Premio">
          <Explain>
            Un weekend di gara ha due momenti: le <b>qualifiche</b>, un giro veloce per decidere l’ordine di
            partenza (chi è più avanti parte davanti), e la <b>gara</b>, dove si guadagnano i punti per il
            campionato. Prima della gara scegli gomme e ritmo dei tuoi piloti.
          </Explain>
          <p className="t2">Premi «Vai al Gran Premio» in alto per far scorrere i giorni fino al weekend.</p>
          {w.last && <LastRace last={w.last} />}
        </Card>
      )}

      {w.state === 'today' && r.status === 'pending' && (
        <Card title="Qualifiche">
          <Explain>
            Ogni pilota fa tre giri lanciati: conta il migliore. Il più veloce conquista la{' '}
            <b>pole position</b> e parte primo. Partire davanti è un grande vantaggio: sorpassare costa tempo.
          </Explain>
          <div style={{ marginTop: '1rem' }}>
            <button
              className="btn primary big-cta"
              disabled={busy}
              onClick={() => run(() => engine.dispatch({ type: 'RunQualifying' }))}
            >
              Corri le qualifiche
            </button>
          </div>
        </Card>
      )}

      {w.state === 'today' && r.status === 'qualified' && (
        <>
          <Strategy
            w={w}
            busy={busy}
            onStart={(strategies) =>
              run(async () => {
                await engine.dispatch({ type: 'RunRace', strategies });
                const rep = await engine.replay();
                setReplay(rep);
                setWatching(!!rep);
              })
            }
          />
          {w.qualifying && <ResultTable title="Griglia di partenza" rows={w.qualifying} kind="quali" />}
        </>
      )}

      {w.state === 'today' && r.status === 'raced' && w.race && (
        <>
          <MyRaceSummary rows={w.race} />
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
            {replay && (
              <button className="btn" onClick={() => setWatching(true)}>
                Rivedi la gara
              </button>
            )}
            {w.seasonFinished && (
              <button className="btn primary" onClick={openSeasonEnd}>
                Era l’ultima gara: vedi com’è andata la stagione ▸
              </button>
            )}
          </div>
          <ResultTable title="Ordine d’arrivo" rows={w.race} kind="race" />
          {w.qualifying && <ResultTable title="Qualifiche" rows={w.qualifying} kind="quali" />}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function Strategy({
  w,
  busy,
  onStart,
}: {
  w: WeekendView;
  busy: boolean;
  onStart: (s: Record<string, { compound: Compound; mode: Mode }>) => void;
}) {
  const initial = useMemo(
    () => Object.fromEntries(w.myRiders.map((r) => [r.id, { ...r.suggested }])),
    [w.myRiders],
  ) as Record<string, { compound: Compound; mode: Mode }>;
  const [plan, setPlan] = useState(initial);
  return (
    <Card title="Strategia di gara" aside="scegli per ogni pilota">
      <Explain style={{ marginBottom: '1rem' }}>
        Due decisioni per pilota: la <b>gomma</b> (più morbida = più veloce ma dura meno) e il <b>ritmo</b>{' '}
        (più aggressivo = più veloce ma più rischi). Il tuo ingegnere ha già impostato un consiglio.
      </Explain>
      <div className="strat-grid">
        {w.myRiders.map((r) => {
          const p = plan[r.id]!;
          return (
            <div key={r.id} className="tile strat">
              <div className="strat-head">
                <span className="strat-num">{r.number}</span>
                <div>
                  <b>{r.name}</b>
                  <div className="muted">
                    {r.grid ? `Parte ${r.grid}° in griglia` : 'Posizione in griglia non disponibile'}
                  </div>
                </div>
              </div>
              <div className="strat-label">
                Gomma
                <Help>Le gomme si consumano giro dopo giro: una gomma consumata fa perdere tempo.</Help>
              </div>
              <div className="choice">
                {TYRES.map((t) => (
                  <button
                    key={t.id}
                    className={p.compound === t.id ? 'on' : ''}
                    onClick={() => setPlan({ ...plan, [r.id]: { ...p, compound: t.id } })}
                  >
                    <i className={`tyre ${t.id}`} />
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="muted strat-text">{TYRES.find((t) => t.id === p.compound)!.text}</div>
              <div className="strat-label">Ritmo</div>
              <div className="choice">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    className={p.mode === m.id ? 'on' : ''}
                    onClick={() => setPlan({ ...plan, [r.id]: { ...p, mode: m.id } })}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="muted strat-text">{MODES.find((m) => m.id === p.mode)!.text}</div>
              <div className="advice">
                <b>Consiglio dell’ingegnere:</b> {TYRES.find((t) => t.id === r.suggested.compound)!.label},{' '}
                {MODES.find((m) => m.id === r.suggested.mode)!.label.toLowerCase()}. {r.why}
              </div>
            </div>
          );
        })}
      </div>
      {w.myRiders.length === 0 && <p className="warn">Non hai piloti in griglia per questa gara.</p>}
      <div style={{ marginTop: '1rem', display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
        <button className="btn primary big-cta" disabled={busy} onClick={() => onStart(plan)}>
          {busy ? 'La gara è in corso…' : 'Via alla gara!'}
        </button>
        <button className="btn ghost" disabled={busy} onClick={() => setPlan(initial)}>
          Ripristina i consigli
        </button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
function MyRaceSummary({ rows }: { rows: ResultRowView[] }) {
  const mine = rows.filter((r) => r.mine);
  return (
    <div className="my-result">
      {mine.map((r) => (
        <div key={r.riderId} className="card accent my-res">
          <Pos value={r.position} />
          <div>
            <b>{r.name}</b>
            <div className="t2">
              {r.position
                ? r.position === 1
                  ? 'Vittoria!'
                  : r.position <= 3
                    ? 'Sul podio'
                    : r.points > 0
                      ? 'Nella zona punti'
                      : 'Fuori dalla zona punti'
                : r.reason === 'mechanical'
                  ? 'Ritirato per un guasto alla moto'
                  : 'Caduto, gara finita'}
            </div>
          </div>
          <div className="pts">
            <b>{r.points}</b>
            <small>punti</small>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ResultTable({
  title,
  rows,
  kind,
}: {
  title: string;
  rows: ResultRowView[];
  kind: 'quali' | 'race';
}) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.filter((r, i) => i < 10 || r.mine);
  return (
    <Card
      title={title}
      aside={
        kind === 'race' ? (
          <>
            Punti ai primi 15
            <Help>Il vincitore prende 25 punti, il secondo 20, il terzo 16… fino a 1 punto per il 15°.</Help>
          </>
        ) : (
          'il miglior giro di ciascuno'
        )
      }
    >
      <div style={{ overflowX: 'auto' }}>
        <table className="std static">
          <thead>
            <tr>
              <th>Pos.</th>
              <th>Pilota</th>
              <th>Squadra</th>
              <th className="r">{kind === 'race' ? 'Tempo / distacco' : 'Tempo'}</th>
              {kind === 'race' && <th className="r">Giro migliore</th>}
              {kind === 'race' && <th className="r">Punti</th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.riderId} className={r.mine ? 'mine' : ''}>
                <td>
                  <Pos value={r.position} />
                </td>
                <td>
                  <span className="swatch" style={{ background: r.color }} />
                  <b>{r.name}</b> <span className="muted">#{r.number}</span>
                </td>
                <td className="t2">{r.team}</td>
                <td className="r">
                  {r.status === 'dnf'
                    ? r.reason === 'mechanical'
                      ? 'Guasto'
                      : 'Caduta'
                    : kind === 'quali'
                      ? lapTime(r.time)
                      : i === 0
                        ? raceTime(r.time)
                        : r.gap === null
                          ? 'doppiato'
                          : `+${r.gap.toFixed(3)}`}
                </td>
                {kind === 'race' && <td className="r t2">{lapTime(r.bestLap)}</td>}
                {kind === 'race' && <td className="r">{r.points ? <b>{r.points}</b> : '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > shown.length || all ? (
        <button className="btn ghost" onClick={() => setAll(!all)} style={{ marginTop: '.5rem' }}>
          {all ? 'Mostra meno' : `Mostra tutti (${rows.length})`}
        </button>
      ) : null}
    </Card>
  );
}

function LastRace({ last }: { last: NonNullable<WeekendView['last']> }) {
  return (
    <div style={{ marginTop: '1rem' }}>
      <h4 style={{ margin: '0 0 .5rem' }}>
        Ultima gara: GP {last.number} · {last.circuit}
      </h4>
      <MyRaceSummary rows={last.race} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
export function TrackMap({ points, size = 15 }: { points: [number, number][]; size?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x0 = Math.min(...xs),
    y0 = Math.min(...ys);
  const wv = Math.max(...xs) - x0 || 1,
    hv = Math.max(...ys) - y0 || 1;
  const d =
    points
      .filter((_, i) => i % 3 === 0)
      .map(
        (p, i) =>
          `${i ? 'L' : 'M'}${(((p[0] - x0) / wv) * 100).toFixed(1)} ${(((p[1] - y0) / hv) * 100 * (hv / wv)).toFixed(1)}`,
      )
      .join(' ') + ' Z';
  const [sx, sy] = [((points[0]![0] - x0) / wv) * 100, ((points[0]![1] - y0) / hv) * 100 * (hv / wv)];
  return (
    <svg
      ref={ref}
      className="track-map"
      viewBox={`-8 -8 116 ${100 * (hv / wv) + 16}`}
      style={{ width: `${size}rem` }}
      aria-label="Disegno del circuito"
    >
      <path d={d} className="tm-base" />
      <path d={d} className="tm-line" />
      <circle cx={sx} cy={sy} r="2.6" className="tm-start" />
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------
function SeasonEnd({ notify, goMarket }: { notify: (t: string, e?: boolean) => void; goMarket: () => void }) {
  const q = useQuery('seasonReview');
  const [busy, setBusy] = useState(false);
  if (q.status !== 'ready' || !q.data) return <div className="loading">Caricamento…</div>;
  const r = q.data;
  const expiring = r.myRiders.filter((x) => x.expiring);
  return (
    <div className="weekend">
      <div className="card accent wk-hero">
        <div className="wk-info">
          <small className="muted">Stagione {r.year} conclusa</small>
          <h1>
            {r.myTeam ? `La tua squadra chiude ${r.myTeam.position}ª su ${r.myTeam.of}` : 'Stagione conclusa'}
          </h1>
          {r.myTeam && (
            <div className="t2">
              {r.myTeam.points} punti · {r.myTeam.wins} {r.myTeam.wins === 1 ? 'vittoria' : 'vittorie'}
            </div>
          )}
        </div>
      </div>
      <div className="grid12">
        <Card title="I campioni" className="s6">
          {r.champions.map((c) => (
            <div key={c.category} className="row">
              <span className="muted">{c.category}</span>
              <b>
                {c.rider}{' '}
                <span className="muted">
                  · {c.team} · {c.points} pt
                </span>
              </b>
            </div>
          ))}
        </Card>
        <Card title="I tuoi piloti" className="s6">
          {r.myRiders.map((m) => (
            <div key={m.name} className="row">
              <span>
                <b>{m.name}</b>
                <span className="muted">
                  {' '}
                  · {m.position}° con {m.points} pt
                </span>
              </span>
              <span className={m.expiring ? 'warn' : 'muted'}>
                {m.expiring ? 'contratto in scadenza' : `contratto fino al ${m.contractEnds}`}
              </span>
            </div>
          ))}
        </Card>
        <Card title="Prima di ripartire" className="s12">
          {expiring.length > 0 ? (
            <Explain>
              {expiring.map((x) => x.name).join(' e ')}{' '}
              {expiring.length > 1 ? 'hanno il contratto in scadenza' : 'ha il contratto in scadenza'}: se non{' '}
              {expiring.length > 1 ? 'li rinnovi' : 'lo rinnovi'} ora dal Mercato,{' '}
              {expiring.length > 1 ? 'se ne andranno' : 'se ne andrà'} all’inizio della nuova stagione. Il
              mercato è aperto: puoi anche ingaggiare piloti per l’anno prossimo.
            </Explain>
          ) : (
            <Explain>
              I contratti dei tuoi piloti sono in regola. Il mercato è aperto se vuoi rinforzare la squadra.
            </Explain>
          )}
          <p className="t2">
            Con la nuova stagione: i giovani migliorano, i veterani calano, qualcuno si ritira, nella Rookies
            Cup arrivano ragazzi nuovi e le squadre riempiono i posti liberi.
          </p>
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
            <button className="btn" onClick={goMarket}>
              Vai al mercato
            </button>
            <button
              className="btn primary big-cta"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await engine.dispatch({ type: 'StartNextSeason' });
                  notify(`Benvenuto nella stagione ${r.year + 1}!`);
                } catch (e) {
                  notify((e as Error).message, true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Inizia la stagione {r.year + 1}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
