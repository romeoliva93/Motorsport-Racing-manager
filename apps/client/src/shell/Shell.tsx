import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { engine } from '../engine/engine.ts';
import { useEngineVersion, useQuery } from '../engine/hooks.ts';
import { Kpi, Money, TeamBadge } from '../design-system/components.tsx';
import { Backdrop } from '../design-system/Backdrop.tsx';
import { Overview } from '../screens/game/Overview.tsx';
import { TeamScreen } from '../screens/game/Team.tsx';
import { RidersScreen } from '../screens/game/Riders.tsx';
import { StaffScreen } from '../screens/game/Staff.tsx';
import { CalendarScreen } from '../screens/game/Calendar.tsx';
import { MarketScreen } from '../screens/game/Market.tsx';
import { WeekendScreen } from '../screens/game/Weekend.tsx';
import { ChampionshipScreen } from '../screens/game/Championship.tsx';
import { FinanceScreen } from '../screens/game/Finance.tsx';
import { NewsScreen } from '../screens/game/News.tsx';
import { BikeScreen } from '../screens/game/BikeScreen.tsx';
import { garageFocus } from '../screens/game/Garage.tsx';
import { SponsorsScreen } from '../screens/game/Sponsors.tsx';
import { PaddockScreen } from '../screens/game/Paddock.tsx';
import { Tutorial } from '../tutorial/Tutorial.tsx';
import { getPrefs, setPrefs } from '../prefs.ts';

export type Section =
  | 'overview'
  | 'weekend'
  | 'team'
  | 'riders'
  | 'staff'
  | 'market'
  | 'finance'
  | 'calendar'
  | 'championship'
  | 'news'
  | 'bike'
  | 'sponsors'
  | 'paddock';

const I = (d: string) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d={d} />
  </svg>
);
const ICON: Record<Section, ReactNode> = {
  overview: I('M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'),
  weekend: I('M5 21V4m0 0h11l-2 4 2 4H5'),
  team: I('M4 21V8l8-5 8 5v13M9 21v-6h6v6'),
  riders: I('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0'),
  staff: I('M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5z'),
  market: I('M3 7h18M6 7l1 13h10l1-13M9 7V5a3 3 0 0 1 6 0v2'),
  finance: I('M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6'),
  calendar: I('M4 6h16v15H4zM4 10h16M8 3v4M16 3v4'),
  championship: I('M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4'),
  news: I('M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5'),
  bike: I('M5 17a3 3 0 1 0 0-.01M19 17a3 3 0 1 0 0-.01M5 17l4-7h5l3 7M9 10l-1-3h3M14 10l2-3h3'),
  sponsors: I('M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z'),
  paddock: I('M3 21V10l5-3v14M8 21V7l8-4v18M16 21V10l5 3v8M3 21h18'),
};

/** Voci attive (collegate a dati reali). */
const NAV: { group: string; items: { id: Section; label: string }[] }[] = [
  {
    group: 'La tua squadra',
    items: [
      { id: 'overview', label: 'Home' },
      { id: 'riders', label: 'Piloti' },
      { id: 'bike', label: 'Moto e upgrade' },
      { id: 'staff', label: 'Personale tecnico' },
      { id: 'team', label: 'Scuderia' },
    ],
  },
  {
    group: 'Le gare',
    items: [
      { id: 'weekend', label: 'Weekend di gara' },
      { id: 'championship', label: 'Classifiche' },
      { id: 'paddock', label: 'Squadre e piloti' },
      { id: 'calendar', label: 'Calendario' },
    ],
  },
  {
    group: 'Affari',
    items: [
      { id: 'market', label: 'Mercato piloti' },
      { id: 'sponsors', label: 'Sponsor' },
      { id: 'finance', label: 'Finanze' },
      { id: 'news', label: 'Notizie' },
    ],
  },
];
/** Sistemi previsti dalla roadmap e non ancora sviluppati: elencati, non cliccabili. */
const COMING = [
  'Sviluppo tecnico avanzato',
  'Strutture',
  'Accademia',
  'Test ufficiali e privati',
  'Statistiche',
  'Archivio storico',
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
  const [seasonEnd, setSeasonEnd] = useState(false);
  // Guida: si apre da sola alla prima carriera, poi dal pulsante "Guida".
  const [guide, setGuide] = useState(() => !getPrefs().tutorialSeen);
  const closeGuide = () => {
    setGuide(false);
    setPrefs({ tutorialSeen: true });
  };
  const version = useEngineVersion();
  const [commands, setCommands] = useState<string[]>([]);
  const summary = useQuery('careerSummary');

  useEffect(() => {
    engine.availableCommands().then(setCommands, () => setCommands([]));
  }, [version]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const s = summary.status === 'ready' ? summary.data : null;
  const team = s?.team ?? null;
  const notify = (text: string, err?: boolean) => setToast({ text, ...(err ? { err } : {}) });
  const go = (sec: Section, opts: { seasonEnd?: boolean } = {}) => {
    setSeasonEnd(!!opts.seasonEnd);
    setSection(sec);
    document.querySelector('.main')?.scrollTo(0, 0);
  };

  // Il prossimo passo, sempre uno solo e sempre spiegato.
  const raceDay = commands.includes('RunRace');
  const seasonOver = commands.includes('StartNextSeason');
  const next: { label: string; hint: string; action: () => void } | null = raceDay
    ? {
        label: 'Vai al weekend',
        hint: 'Oggi si corre',
        action: () => go('weekend'),
      }
    : seasonOver
      ? {
          label: 'Chiudi la stagione',
          hint: 'Campionato finito',
          action: () => go('weekend', { seasonEnd: true }),
        }
      : commands.includes('ContinueToNextEvent')
        ? {
            label: 'Vai al Gran Premio',
            hint: s?.nextRound ? `${s.nextRound.circuit} tra ${s.nextRound.inDays} giorni` : '',
            action: continueTime,
          }
        : null;

  async function continueTime() {
    setBusy(true);
    try {
      await engine.dispatch({ type: 'ContinueToNextEvent' });
      go('weekend');
      notify('È arrivato il weekend di gara: si comincia con le prove libere.');
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    try {
      const meta = await engine.save(slot);
      notify(`Partita salvata (${meta.gameDate}).`);
    } catch (e) {
      notify((e as Error).message, true);
    }
  }

  const style = { '--team': team?.colors.primary ?? '#3d7bfd' } as CSSProperties;
  return (
    <div className="app" style={style}>
      <Backdrop color={team?.colors.primary ?? '#3d7bfd'} intensity={0.55} />
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
                <button key={i.id} className={section === i.id ? 'on' : ''} onClick={() => go(i.id)}>
                  {ICON[i.id]}
                  {i.label}
                  {i.id === 'weekend' && (raceDay || seasonOver) && <span className="badge">!</span>}
                  {i.id === 'sponsors' && commands.includes('SignSponsorDeal') && (
                    <span className="badge">!</span>
                  )}
                </button>
              ))}
            </div>
          ))}
          <details>
            <summary>Prossimamente</summary>
            <ul>
              {COMING.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </details>
        </nav>
        <div className="foot">
          <button className="btn" onClick={save}>
            Salva
          </button>
          <button className="btn ghost" onClick={() => setGuide(true)} title="Come si gioca">
            Guida
          </button>
          <button className="btn ghost" onClick={exit} title="Torna al menu principale">
            Menu
          </button>
        </div>
      </aside>
      <header className="topbar">
        <h2>{TITLE[section]}</h2>
        {s && <Kpi label="Oggi" value={s.date} />}
        {team && team.balance !== null && <Kpi label="In cassa" value={<Money value={team.balance} />} />}
        {s && s.roundsTotal > 0 && <Kpi label="Gare corse" value={`${s.roundsDone} di ${s.roundsTotal}`} />}
        <div className="spacer" />
        {next && (
          <div className="kpi" style={{ textAlign: 'right' }}>
            <small>{next.hint}</small>
          </div>
        )}
        {next && (
          <button className="btn primary" disabled={busy} onClick={next.action}>
            {busy ? 'Un attimo…' : `${next.label} ▸`}
          </button>
        )}
      </header>
      <main className="main">
        {!team ? (
          <div className="loading">Caricamento…</div>
        ) : section === 'overview' ? (
          <Overview go={go} next={next} />
        ) : section === 'weekend' ? (
          <WeekendScreen
            notify={notify}
            goMarket={() => go('market')}
            showSeasonEnd={seasonEnd}
            openSeasonEnd={() => go('weekend', { seasonEnd: true })}
          />
        ) : section === 'team' ? (
          <TeamScreen teamId={team.id} />
        ) : section === 'riders' ? (
          <RidersScreen
            teamId={team.id}
            teamName={team.name}
            colors={team.colors}
            twoBikes={s!.category!.bikesPerRider === 2}
          />
        ) : section === 'staff' ? (
          <StaffScreen teamId={team.id} colors={team.colors} />
        ) : section === 'market' ? (
          <MarketScreen notify={notify} />
        ) : section === 'calendar' ? (
          <CalendarScreen categoryId={s!.category!.id} />
        ) : section === 'championship' ? (
          <ChampionshipScreen categoryId={s!.category!.id} />
        ) : section === 'finance' ? (
          <FinanceScreen />
        ) : section === 'news' ? (
          <NewsScreen
            openGarage={() => {
              garageFocus.worst = true;
              go('bike');
            }}
          />
        ) : section === 'bike' ? (
          <BikeScreen notify={notify} />
        ) : section === 'sponsors' ? (
          <SponsorsScreen notify={notify} />
        ) : section === 'paddock' ? (
          <PaddockScreen categoryId={s!.category!.id} myTeamId={team.id} />
        ) : null}
      </main>
      {guide && <Tutorial onClose={closeGuide} go={(sec) => go(sec)} />}
      {toast && (
        <div className={`toast ${toast.err ? 'err' : ''}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}
