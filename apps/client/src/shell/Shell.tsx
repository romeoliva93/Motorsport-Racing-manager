import { useEffect, useState } from 'react';
import { engine } from '../engine/engine.ts';
import { useEngineVersion, useQuery } from '../engine/hooks.ts';
import { Kpi, Money, TeamBadge } from '../design-system/components.tsx';
import { Overview } from '../screens/game/Overview.tsx';
import { TeamScreen } from '../screens/game/Team.tsx';
import { RidersScreen } from '../screens/game/Riders.tsx';
import { StaffScreen } from '../screens/game/Staff.tsx';
import { CalendarScreen } from '../screens/game/Calendar.tsx';
import { MarketScreen } from '../screens/game/Market.tsx';

export type Section =
  | 'overview'
  | 'team'
  | 'riders'
  | 'staff'
  | 'bike'
  | 'development'
  | 'facilities'
  | 'academy'
  | 'market'
  | 'sponsors'
  | 'finance'
  | 'calendar'
  | 'championship'
  | 'stats'
  | 'news'
  | 'archive';

/** Le 16 voci del menu (UI_DESIGN.md §3). `ready` = collegata a dati reali; le altre sono disabilitate. */
const NAV: { group: string; items: { id: Section; label: string; ready: boolean }[] }[] = [
  {
    group: 'Squadra',
    items: [
      { id: 'overview', label: 'Panoramica', ready: true },
      { id: 'team', label: 'Scuderia', ready: true },
      { id: 'riders', label: 'Piloti', ready: true },
      { id: 'staff', label: 'Personale', ready: true },
    ],
  },
  {
    group: 'Tecnica',
    items: [
      { id: 'bike', label: 'Moto', ready: false },
      { id: 'development', label: 'Sviluppo', ready: false },
      { id: 'facilities', label: 'Strutture', ready: false },
    ],
  },
  {
    group: 'Persone e affari',
    items: [
      { id: 'academy', label: 'Accademia', ready: false },
      { id: 'market', label: 'Mercato', ready: true },
      { id: 'sponsors', label: 'Sponsor', ready: false },
      { id: 'finance', label: 'Finanze', ready: false },
    ],
  },
  {
    group: 'Competizione',
    items: [
      { id: 'calendar', label: 'Calendario', ready: true },
      { id: 'championship', label: 'Campionato', ready: false },
      { id: 'stats', label: 'Statistiche', ready: false },
    ],
  },
  {
    group: 'Mondo',
    items: [
      { id: 'news', label: 'Notizie', ready: false },
      { id: 'archive', label: 'Archivio', ready: false },
    ],
  },
];
const TITLE = Object.fromEntries(NAV.flatMap((g) => g.items.map((i) => [i.id, i.label]))) as Record<
  Section,
  string
>;

export function Shell({
  slot,
  exit,
  initialSection = 'overview',
}: {
  slot: string;
  exit: () => void;
  initialSection?: Section;
}) {
  const [section, setSection] = useState<Section>(initialSection);
  const [toast, setToast] = useState<{ text: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const version = useEngineVersion();
  const [commands, setCommands] = useState<string[]>([]);
  const summary = useQuery('careerSummary');

  useEffect(() => {
    engine.availableCommands().then(setCommands, () => setCommands([]));
  }, [version]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const s = summary.status === 'ready' ? summary.data : null;
  const team = s?.team ?? null;
  const canContinue = commands.includes('ContinueToNextEvent') && s?.nextRound !== null;

  async function continueTime() {
    setBusy(true);
    try {
      const events = await engine.dispatch({ type: 'ContinueToNextEvent' });
      const round = events.find((e) => e.type === 'RoundReached');
      if (round) {
        const p = round.payload as { roundNumber: number };
        setToast({
          text: `Arrivati al round ${p.roundNumber}. Il weekend di gara (prove, qualifiche, gara) arriverà con la Fase 2.`,
        });
      }
    } catch (e) {
      setToast({ text: (e as Error).message, err: true });
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    try {
      const meta = await engine.save(slot);
      setToast({ text: `Partita salvata nello slot "${meta.slot}" (${meta.gameDate}).` });
    } catch (e) {
      setToast({ text: (e as Error).message, err: true });
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="team">
          {team && <TeamBadge colors={team.colors} short={team.shortName} />}
          <div>
            <b>{team?.name ?? '…'}</b>
            <span>
              {s?.category?.name ?? ''}
              {team ? ` · ${team.manufacturer}` : ''}
            </span>
          </div>
        </div>
        <nav className="nav" aria-label="Menu di gioco">
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="grp">{g.group}</div>
              {g.items.map((i) => (
                <button
                  key={i.id}
                  className={section === i.id ? 'on' : ''}
                  disabled={!i.ready}
                  onClick={() => setSection(i.id)}
                  title={i.ready ? undefined : 'Sistema non ancora sviluppato (vedi roadmap)'}
                >
                  {i.label}
                  {!i.ready && <span className="soon">In sviluppo</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="foot">
          <button className="btn" onClick={save}>
            Salva
          </button>
          <button className="btn ghost" onClick={exit}>
            Menu
          </button>
        </div>
      </aside>
      <header className="topbar">
        <h2>{TITLE[section]}</h2>
        {s && <Kpi label="Data" value={s.date} />}
        {s && (
          <Kpi
            label="Prossimo evento"
            value={
              s.nextRound
                ? `Round ${s.nextRound.number} · ${s.nextRound.circuit} · tra ${s.nextRound.inDays} giorni`
                : 'Stagione conclusa'
            }
          />
        )}
        {team && team.balance !== null && (
          <Kpi label="Saldo" value={<Money value={team.balance} />} tone="ok" />
        )}
        <div className="spacer" />
        <button
          className="btn primary"
          disabled={!canContinue || busy}
          onClick={continueTime}
          title="Avanza fino al prossimo evento in calendario"
        >
          {busy ? '…' : 'Continua ▸'}
        </button>
      </header>
      <main className="main">
        {!team ? (
          <div className="loading">Caricamento…</div>
        ) : section === 'overview' ? (
          <Overview go={setSection} />
        ) : section === 'team' ? (
          <TeamScreen teamId={team.id} />
        ) : section === 'riders' ? (
          <RidersScreen teamId={team.id} colors={team.colors} />
        ) : section === 'staff' ? (
          <StaffScreen teamId={team.id} colors={team.colors} />
        ) : section === 'market' ? (
          <MarketScreen notify={(text, err) => setToast({ text, ...(err ? { err } : {}) })} />
        ) : section === 'calendar' ? (
          <CalendarScreen categoryId={s!.category!.id} />
        ) : null}
      </main>
      {toast && (
        <div className={`toast ${toast.err ? 'err' : ''}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}
