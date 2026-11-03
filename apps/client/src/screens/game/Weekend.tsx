import { Flag, FlagName } from '../../design-system/Flag.tsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReplayData, ResultRowView, WeekendView } from '@lean-angle/game';
import { engine } from '../../engine/engine.ts';
import { useQuery } from '../../engine/hooks.ts';
import { Card, Explain, Help, Pos, Tabs, lapTime, raceTime } from '../../design-system/components.tsx';
import { WeatherIcon, SKY_LABEL } from '../../design-system/WeatherIcon.tsx';

import { RaceViewer } from './RaceViewer.tsx';
import './weekend.css';

type Compound = 'soft' | 'medium' | 'hard' | 'wet';
type Mode = 'conservative' | 'normal' | 'attack';
type Session = WeekendView['sessions'][number];
type Plan = Record<string, { compound: Compound; mode: Mode }>;

export const TYRES: { id: Compound; label: string; short: string; text: string }[] = [
  {
    id: 'soft',
    label: 'Morbida',
    short: 'M',
    text: 'La più veloce sul giro secco; in gara cala prima nel finale.',
  },
  { id: 'medium', label: 'Media', short: 'MD', text: 'Il compromesso: buona velocità, consumo regolare.' },
  {
    id: 'hard',
    label: 'Dura',
    short: 'D',
    text: 'Più lenta all’inizio, ma resiste meglio fino alla bandiera a scacchi.',
  },
  {
    id: 'wet',
    label: 'Pioggia',
    short: 'P',
    text: 'Per l’asfalto bagnato o umido. Sull’asciutto è lenta e si distrugge.',
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

function explain(kind: Session['kind'], w: WeekendView): string {
  const fmt = w.sessions.map((x) => x.kind);
  const toQ2 = fmt.includes('fp2') ? 10 : 14;
  const fromQ1 = fmt.includes('fp2') ? 2 : 4;
  switch (kind) {
    case 'fp1':
      return 'Prime prove libere: i piloti prendono confidenza con la pista. Il tempo non conta: conviene usare dure o medie e risparmiare le morbide.';
    case 'practice':
      return `Sessione decisiva del venerdì: i primi ${toQ2} entrano direttamente in Qualifiche 2, gli altri dovranno passare dalla Q1. Qui di solito si monta la morbida.`;
    case 'fp2':
      return 'Prove libere del sabato mattina: servono a preparare la gara, il tempo non conta.';
    case 'q1':
      return `Qualifiche 1, per chi non è entrato in Q2 dalle Prove: i primi ${fromQ1} salgono in Q2, gli altri partono dalla ${toQ2 + fromQ1 + 1}ª posizione in giù.`;
    case 'q2':
      return `Qualifiche 2: i migliori ${toQ2 + fromQ1} si giocano la pole position e le prime file della griglia.`;
    case 'qualifying':
      return 'Qualifica unica: vale il giro migliore e decide l’ordine di partenza.';
    case 'warmup':
      return 'Warm Up della domenica mattina: 10 minuti per controllare la moto prima della gara. Il tempo non conta.';
    case 'sprint':
      return `Gara Sprint del sabato, a metà distanza (${w.nextLaps} giri): punti ai primi 9, 12 al vincitore. Limiti della pista: alla 3ª uscita c’è la Long Lap Penalty, da scontare entro 3 giri passando nell’anello segnato sul circuito.`;
    case 'race':
      return `La gara della domenica (${w.round?.laps} giri): punti ai primi 15, 25 al vincitore. Limiti della pista: avviso alla 3ª uscita, Long Lap Penalty alla 5ª. Partenza anticipata = doppia Long Lap. Il ritmo «Attacco» fa uscire di pista più spesso.`;
  }
}

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
  /** Gara in diretta (simulazione incrementale) e istante da cui riprendere la visione. */
  const [liveFrom, setLiveFrom] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<string | null>(null);

  const roundId = q.status === 'ready' ? q.data.round?.id : undefined;
  useEffect(() => {
    if (!roundId) return;
    engine.replay().then(
      (r) => setReplay(r && r.roundId === roundId ? r : null),
      () => setReplay(null),
    );
    // Gara rimasta in corso (es. salvataggio a metà gara): si riprende la visione da dove era.
    engine.liveStatus().then(
      (ls) => {
        if (ls && ls.roundId === roundId)
          engine.replay().then((r) => {
            if (!r) return;
            setReplay(r);
            setLiveFrom(ls.viewerT);
            setWatching(true);
          });
      },
      () => {},
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
  async function afterRace(kind: string) {
    const rep = await engine.replay();
    if (rep && (rep.kind === kind || kind === 'all')) {
      setReplay(rep);
      setLiveFrom(rep.results.length === 0 ? -45 : null);
      setWatching(true);
    }
  }

  if (w.state === 'seasonOver' || (w.seasonFinished && showSeasonEnd && !watching))
    return <SeasonEnd notify={notify} goMarket={goMarket} />;
  if (!w.round) return <div className="loading">Nessun evento in calendario.</div>;

  if (watching && replay)
    return (
      <RaceViewer
        data={replay}
        live={liveFrom !== null}
        startT={liveFrom ?? undefined}
        onDone={(final) => {
          if (final) setReplay(final);
          setLiveFrom(null);
          setWatching(false);
          setTab(replay.kind);
          window.scrollTo(0, 0);
        }}
      />
    );

  const r = w.round;
  const done = w.sessions.filter((x) => x.done);
  const nextS = w.sessions.find((x) => x.kind === w.next) ?? null;
  const shownTab =
    tab && (done.some((x) => x.kind === tab) || (tab === 'qualifying' && w.qualifying))
      ? tab
      : (done.at(-1)?.kind ?? null);
  const shown = done.find((x) => x.kind === shownTab);
  const heroWx = nextS?.weather ?? done.at(-1)?.weather ?? w.sessions[0]?.weather;

  return (
    <div className="weekend">
      <div className="wk-hero card accent">
        <div className="wk-info">
          <small className="muted">
            Gran Premio {r.number} di {r.total} · {r.category}
          </small>
          <h1>{r.circuit}</h1>
          <div className="t2">
            <FlagName code={r.country} /> · {r.date}
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
        {heroWx && w.state === 'today' && (
          <WeatherBox wx={heroWx} title={nextS ? nextS.name : 'Ultima sessione'} />
        )}
        {w.track && <TrackMap points={w.track} />}
      </div>

      <div className="wk-program">
        {(['Venerdì', 'Sabato', 'Domenica'] as const).map((day) => {
          const list = w.sessions.filter((x) => x.day === day);
          if (list.length === 0) return null;
          return (
            <div key={day} className="wk-day">
              <small className="muted">{day}</small>
              <div className="wk-sessions">
                {list.map((x) => (
                  <button
                    key={x.kind}
                    className={`wk-sess ${x.done ? 'done' : ''} ${x.kind === w.next && w.state === 'today' ? 'now' : ''}`}
                    disabled={!x.done}
                    onClick={() => setTab(x.kind)}
                    title={x.done ? 'Vedi i risultati' : undefined}
                  >
                    <WeatherIcon sky={x.weather.sky} size={1.3} />
                    <span>
                      <b>{x.name}</b>
                      <small>
                        {x.done || x.kind === w.next
                          ? `${x.weather.airTemp}° aria · ${x.weather.trackTemp}° asfalto`
                          : `pioggia ${x.weather.rainChance}%`}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {w.state === 'upcoming' && (
        <Card title="Il prossimo Gran Premio">
          <Explain>
            Il weekend ha più sessioni: <b>prove libere</b> per prendere le misure, le <b>Prove</b> del
            venerdì che decidono chi va direttamente in Qualifiche 2, le <b>qualifiche</b> per l’ordine di
            partenza e, in MotoGP, la <b>Sprint</b> del sabato (mezza gara, metà punti) prima della{' '}
            <b>gara</b> della domenica. Ogni pilota ha un numero limitato di gomme per tutto il weekend.
          </Explain>
          <p className="t2">Premi «Vai al Gran Premio» in alto per far scorrere i giorni fino al weekend.</p>
          {w.last && <LastRace last={w.last} />}
        </Card>
      )}

      {w.state === 'today' && nextS && (
        <SessionPanel
          key={nextS.kind}
          w={w}
          session={nextS}
          busy={busy}
          onRun={(plan) =>
            run(async () => {
              const raceKind = nextS.kind === 'sprint' || nextS.kind === 'race';
              // Sprint e gara in diretta: strategie modificabili mentre si corre.
              await engine.dispatch({
                type: 'RunSession',
                strategies: plan,
                ...(raceKind ? { live: true } : {}),
              });
              if (raceKind) await afterRace(nextS.kind);
              else setTab(nextS.kind === 'q2' ? 'qualifying' : nextS.kind);
            })
          }
          onSimulate={(plan) =>
            run(async () => {
              await engine.dispatch({ type: 'RunRace', strategies: plan });
              setTab('race');
            })
          }
        />
      )}

      {w.state === 'today' && !w.next && w.race && (
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
        </>
      )}

      {done.length > 0 && (
        <div className="wk-results">
          <Tabs
            value={shownTab ?? ''}
            onChange={(v) => setTab(v)}
            options={[
              ...done.map((x) => ({ id: x.kind as string, label: x.name })),
              ...(w.qualifying && done.some((x) => x.kind === 'q2')
                ? [{ id: 'qualifying', label: 'Griglia' }]
                : []),
            ]}
          />
          {shownTab === 'qualifying' && w.qualifying ? (
            <ResultTable title="Griglia di partenza" rows={w.qualifying} kind="quali" />
          ) : shown && shown.results ? (
            <ResultTable
              title={shown.name}
              rows={shown.results}
              kind={shown.kind === 'race' || shown.kind === 'sprint' ? 'race' : 'quali'}
              cut={
                shown.kind === 'practice' ? (w.sessions.some((x) => x.kind === 'fp2') ? 10 : 14) : undefined
              }
            />
          ) : null}
          {replay && shown && replay.kind === shown.kind && (
            <button className="btn" onClick={() => setWatching(true)}>
              Rivedi {shown.kind === 'sprint' ? 'la Sprint' : 'la gara'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Penalty({ p }: { p: NonNullable<ResultRowView['penalty']> }) {
  const parts = [
    p.longLaps ? `Long Lap ×${p.longLaps}${p.served < p.longLaps ? ` (${p.served} scontate)` : ''}` : '',
    p.timeAdded ? `+${p.timeAdded.toFixed(1).replace('.', ',')} s` : '',
    p.positionDrop ? '−1 posizione' : '',
  ].filter(Boolean);
  return (
    <span className="pen" title={`Penalità: ${parts.join(', ')}`} style={{ marginRight: '.4rem' }}>
      {parts.join(' · ')}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
function WeatherBox({ wx, title }: { wx: Session['weather']; title: string }) {
  const grip =
    wx.grip === 'wet' ? 'Asfalto bagnato' : wx.grip === 'damp' ? 'Asfalto umido' : 'Asfalto asciutto';
  return (
    <div className="wx-box" aria-label="Meteo">
      <WeatherIcon sky={wx.sky} size={2.6} />
      <div>
        <small className="muted">Meteo · {title}</small>
        <b>{SKY_LABEL[wx.sky]}</b>
        <div className="t2">
          Aria {wx.airTemp}° · asfalto {wx.trackTemp}°
        </div>
        <div className={wx.grip === 'dry' ? 'muted' : 'info'}>{grip}</div>
      </div>
    </div>
  );
}

function SessionPanel({
  w,
  session,
  busy,
  onRun,
  onSimulate,
}: {
  w: WeekendView;
  session: Session;
  busy: boolean;
  onRun: (plan: Plan) => void;
  onSimulate: (plan: Plan) => void;
}) {
  const raceType = session.kind === 'sprint' || session.kind === 'race';
  const initial = useMemo(
    () => Object.fromEntries(w.myRiders.map((r) => [r.id, { ...r.suggested }])) as Plan,
    [w.myRiders],
  );
  const [plan, setPlan] = useState<Plan>(initial);
  const riders = w.myRiders.filter((r) => r.inNext);
  const sat = w.myRiders.filter((r) => !r.inNext);
  const sendPlan = Object.fromEntries(Object.entries(plan).filter(([id]) => riders.some((r) => r.id === id)));
  return (
    <Card title={`Prossima sessione: ${session.name}`} aside={session.day}>
      <Explain style={{ marginBottom: '1rem' }}>{explain(session.kind, w)}</Explain>
      {sat.length > 0 && (
        <p className="t2">
          {sat.map((x) => x.name).join(' e ')} {sat.length > 1 ? 'non corrono' : 'non corre'} questa sessione
          {session.kind === 'q1' ? ' (già in Q2)' : session.kind === 'q2' ? ' (eliminato in Q1)' : ''}.
        </p>
      )}
      <div className="strat-grid">
        {riders.map((r) => {
          const p = plan[r.id]!;
          return (
            <div key={r.id} className="tile strat">
              <div className="strat-head">
                <span className="strat-num">{r.number}</span>
                <div>
                  <b>{r.name}</b>
                  <div className="muted">
                    {r.grid ? `Parte ${r.grid}° in griglia` : 'Griglia non ancora decisa'}
                  </div>
                </div>
              </div>
              <div className="strat-label">
                Gomma
                <Help>
                  Ogni pilota ha un numero limitato di gomme nuove per tutto il weekend: ogni sessione ne usa
                  un treno.{' '}
                  {raceType
                    ? 'Sotto ogni mescola: i secondi stimati persi sulla gara rispetto alla scelta migliore.'
                    : ''}
                </Help>
              </div>
              <div className="choice four">
                {TYRES.map((t) => {
                  const left = r.tyresLeft[t.id];
                  return (
                    <button
                      key={t.id}
                      className={p.compound === t.id ? 'on' : ''}
                      disabled={left <= 0}
                      onClick={() => setPlan({ ...plan, [r.id]: { ...p, compound: t.id } })}
                    >
                      <i className={`tyre ${t.id}`} />
                      {t.label}
                      <small className="muted">
                        {left} di {w.allocation[t.id]}
                      </small>
                      {raceType && left > 0 && (
                        <small className={r.forecast[p.mode][t.id] === 0 ? 'ok' : 'muted'}>
                          {r.forecast[p.mode][t.id] === 0
                            ? 'migliore'
                            : `+${r.forecast[p.mode][t.id].toFixed(1).replace('.', ',')} s`}
                        </small>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="muted strat-text">{TYRES.find((t) => t.id === p.compound)!.text}</div>
              {raceType && (
                <>
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
                </>
              )}
              <div className="advice">
                <b>Consiglio dell’ingegnere:</b> {TYRES.find((t) => t.id === r.suggested.compound)!.label}
                {raceType
                  ? `, ${MODES.find((m) => m.id === r.suggested.mode)!.label.toLowerCase()}`
                  : ''}.{' '}
                {raceType ? r.why : session.weather.grip !== 'dry' ? 'Pista bagnata: gomme da pioggia.' : ''}
              </div>
            </div>
          );
        })}
      </div>
      {w.myRiders.length === 0 && <p className="warn">Non hai piloti in griglia per questo weekend.</p>}
      <div
        style={{ marginTop: '1rem', display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}
      >
        <button className="btn primary big-cta" disabled={busy} onClick={() => onRun(sendPlan)}>
          {busy
            ? 'In pista…'
            : raceType
              ? `Via alla ${session.kind === 'sprint' ? 'Sprint' : 'gara'}!`
              : `Corri ${session.name}`}
        </button>
        <button className="btn ghost" disabled={busy} onClick={() => setPlan(initial)}>
          Ripristina i consigli
        </button>
        <span className="spacer" />
        <button
          className="btn"
          disabled={busy}
          onClick={() => onSimulate(sendPlan)}
          title="Corre in automatico tutte le sessioni rimaste, gara compresa"
        >
          Simula il resto del weekend
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
  cut,
}: {
  title: string;
  rows: ResultRowView[];
  kind: 'quali' | 'race';
  /** Disegna una linea dopo questa posizione (es. chi entra in Q2). */
  cut?: number;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.filter((r, i) => i < 10 || r.mine);
  return (
    <Card
      title={title}
      aside={
        kind === 'race' ? (
          title === 'Sprint' ? (
            <>
              Punti ai primi 9
              <Help>Nella Sprint il vincitore prende 12 punti, poi 9, 7, 6, 5, 4, 3, 2, 1.</Help>
            </>
          ) : (
            <>
              Punti ai primi 15
              <Help>
                Il vincitore prende 25 punti, il secondo 20, il terzo 16… fino a 1 punto per il 15°.
              </Help>
            </>
          )
        ) : cut ? (
          `i primi ${cut} vanno in Q2`
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
              <th>Gomma</th>
              <th className="r">{kind === 'race' ? 'Tempo / distacco' : 'Tempo'}</th>
              {kind === 'race' && <th className="r">Giro migliore</th>}
              {kind === 'race' && <th className="r">Punti</th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr
                key={r.riderId}
                className={`${r.mine ? 'mine' : ''} ${cut && r.position === cut ? 'cut' : ''}`}
              >
                <td>
                  <Pos value={r.position} />
                </td>
                <td>
                  <span className="swatch" style={{ background: r.color }} />
                  <Flag code={r.nationality} size={0.85} /> <b>{r.name}</b>{' '}
                  <span className="muted">#{r.number}</span>
                </td>
                <td className="t2">{r.team}</td>
                <td>
                  {r.compound ? (
                    <span className="tyre-tag">
                      <i className={`tyre ${r.compound}`} />
                      {TYRES.find((t) => t.id === r.compound)!.label}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="r">
                  {r.penalty && <Penalty p={r.penalty} />}
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
