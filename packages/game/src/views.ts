/**
 * Viste di Fase 2: weekend di gara, classifiche, finanze, notizie e riepilogo di fine stagione.
 * Come per queries.ts sono funzioni pure di sola lettura sullo stato.
 */
import { GameCalendar } from '@lean-angle/core';
import {
  RACE_FEE,
  TRAVEL_COST,
  PRIZE_PER_POINT,
  MAX_PART_LEVEL,
  PARTS,
  GARAGE_PARTS,
  GARAGE_WEEKEND_KM,
  type GarageKey,
  SPONSOR_DEAL_RISK,
  rows,
  teamBalance,
  type PartKey,
  type CategoryTier,
  type Rider,
  type SessionKind,
  type GameState,
  type NewsItem,
  type Round,
  type SessionResult,
  type TeamId,
  type TransactionCategory,
} from '@lean-angle/data';
import { payrollMonthly, runningCostMonthly, sponsorMonthly } from './economy.ts';
import { activeRiderContract, buyoutFor } from './market.ts';
import { riderDetail, type RiderDetail } from './queries.ts';
import { careerTotals, riderHistory, technicalPreferences, type SeasonStats } from './stats.ts';
import { engineStatus, teamConcession, type ConcessionRank } from './regulations.ts';
import {
  bikeReliabilityFactor,
  canService,
  groupStatus,
  groupsFor,
  isSupplierPart,
  partReliability,
  partWear,
  pendingDecisions,
  serviceCost,
  garageModeOf,
  spareCost,
  sparesOf,
} from './garage.ts';
import { SETUP_KEYS, setupFeedback, setupMatch, setupOf, turnsOf } from './setup.ts';
import {
  BREAK_MINUTES,
  PROGRAMS,
  baseTrackConf,
  changeMinutes,
  crewChiefAdvice,
  feedbackIsClear,
  practiceRiderOf,
  workMinutesLeft,
} from './practice.ts';
import type { PracticeLogEntry, PracticeProgram } from '@lean-angle/data';
import { leadDays, partLevel, pendingOrder, upgradeBonus, upgradeCost } from './upgrades.ts';
import {
  currentDeal,
  dealWindowOpen,
  expectedPosition,
  sponsorOffers,
  type SponsorOffer,
} from './sponsors.ts';
import { compoundForecast, unit } from '@lean-angle/sim';
import { conditionsFor, type SessionWeather } from './weather.ts';
import {
  RACE_FORMAT,
  playerRoundToday,
  bikeOf,
  TYRE_ALLOCATION,
  WEEKEND_FORMAT,
  nextSession,
  sessionsOf,
  sprintLaps,
  tyresLeft,
  weatherOf,
  standings,
  trackFor,
  type StandingsView,
  type Strategy,
} from './weekend.ts';

const cal = (s: GameState) => new GameCalendar(s.meta.startYear);

function playerEntry(s: GameState) {
  const teamId = s.meta.playerTeamId;
  return teamId ? rows(s, 'teamEntries').find((e) => e.teamId === teamId) : undefined;
}

function seasonRounds(s: GameState, seasonId: string): Round[] {
  const season = s.tables.seasons[seasonId as never];
  return season
    ? season.roundIds.map((id) => s.tables.rounds[id]!).sort((a, b) => a.startDay - b.startDay)
    : [];
}

// ---------------------------------------------------------------------------------------------
export interface ResultRowView {
  position: number | null;
  riderId: string;
  name: string;
  nationality: string;
  number: number;
  team: string;
  color: string;
  mine: boolean;
  time: number | null;
  gap: number | null;
  bestLap: number;
  points: number;
  status: 'finished' | 'dnf';
  reason?: 'crash' | 'mechanical' | 'fuel';
  compound?: 'soft' | 'medium' | 'hard' | 'wet';
  penalty?: { longLaps: number; served: number; timeAdded: number; positionDrop: boolean };
}

function resultView(s: GameState, res: SessionResult | undefined): ResultRowView[] | null {
  if (!res) return null;
  const numbers = new Map<string, number>();
  for (const e of rows(s, 'teamEntries'))
    for (const seat of e.seats) if (seat.riderId) numbers.set(seat.riderId, seat.number);
  return res.rows.map((r) => {
    const rider = s.tables.riders[r.riderId]!;
    const team = s.tables.teams[r.teamId]!;
    return {
      position: r.position,
      riderId: r.riderId,
      name: `${rider.firstName} ${rider.lastName}`,
      nationality: rider.nationality,
      number: numbers.get(r.riderId) ?? 0,
      team: team.name,
      color: team.colors.primary,
      mine: r.teamId === s.meta.playerTeamId,
      time: r.time,
      gap: r.gap,
      bestLap: r.bestLap,
      points: r.points,
      status: r.status,
      ...(r.reason ? { reason: r.reason } : {}),
      ...(r.compound ? { compound: r.compound } : {}),
      ...(r.penalty ? { penalty: r.penalty } : {}),
    };
  });
}

export const SESSION_NAME: Record<SessionKind, { name: string; day: string }> = {
  fp1: { name: 'Prove libere 1', day: 'Venerdì' },
  practice: { name: 'Prove', day: 'Venerdì' },
  fp2: { name: 'Prove libere 2', day: 'Sabato' },
  q1: { name: 'Qualifiche 1', day: 'Sabato' },
  q2: { name: 'Qualifiche 2', day: 'Sabato' },
  qualifying: { name: 'Qualifiche', day: 'Sabato' },
  sprint: { name: 'Sprint', day: 'Sabato' },
  warmup: { name: 'Warm Up', day: 'Domenica' },
  race: { name: 'Gara', day: 'Domenica' },
};

export interface WeekendView {
  /** today = si corre oggi; upcoming = prossimo GP; seasonOver = stagione conclusa; none = niente squadra. */
  state: 'none' | 'today' | 'upcoming' | 'seasonOver';
  /** La stagione della squadra del giocatore è conclusa (anche nel giorno dell'ultima gara). */
  seasonFinished: boolean;
  round: {
    id: string;
    number: number;
    total: number;
    circuit: string;
    country: string;
    date: string;
    inDays: number;
    laps: number;
    lengthKm: number;
    turns: number;
    category: string;
    status: 'pending' | 'qualified' | 'raced';
  } | null;
  track: [number, number][] | null;
  categoryId: string;
  /** Sessioni del weekend nell'ordine del formato della categoria. */
  sessions: {
    kind: SessionKind;
    name: string;
    day: string;
    done: boolean;
    results: ResultRowView[] | null;
    /** Meteo della sessione; per quelle future la probabilità di pioggia è una previsione. */
    weather: SessionWeather;
  }[];
  /** Prossima sessione da disputare (null = weekend concluso). */
  next: SessionKind | null;
  /** Giri della prossima Sprint/gara (per la previsione gomme). */
  nextLaps: number;
  qualifying: ResultRowView[] | null;
  sprint: ResultRowView[] | null;
  race: ResultRowView[] | null;
  /** Dotazione di gomme del weekend per pilota. */
  allocation: Record<Strategy['compound'], number>;
  myRiders: {
    id: string;
    name: string;
    number: number;
    grid: number | null;
    /** Gomme nuove rimaste. */
    tyresLeft: Record<Strategy['compound'], number>;
    /** Partecipa alla prossima sessione (in Q1 e Q2 non corrono tutti). */
    inNext: boolean;
    suggested: Strategy;
    why: string;
    /** Secondi persi da ogni mescola rispetto alla migliore, per ciascun ritmo (0 = la migliore). */
    forecast: Record<Strategy['mode'], Record<Strategy['compound'], number>>;
    /** Prove e briefing: confidenza, commenti, consiglio del capotecnico, tempo di lavoro, cronologia. */
    practice: PracticeView;
  }[];
  /** Ultima gara del giocatore, per mostrare i risultati fra un weekend e l'altro. */
  last: { circuit: string; number: number; race: ResultRowView[] } | null;
}

export interface PracticeView {
  laps: number;
  trackConf: number;
  bikeConf: number;
  longRun: boolean;
  /** Intesa con l'assetto per la condizione della prossima sessione (0–100). */
  match: number;
  wet: boolean;
  /** Minuti di lavoro rimasti prima della prossima sessione (null = nessun limite). */
  minutesLeft: number | null;
  breakMinutes: number;
  feedback: { key: string; name: string; text: string; ok: boolean }[];
  clear: boolean;
  advice: {
    crewChief: string;
    text: string;
    /** Modifica proposta (null = nessuna). */
    change: { key: string; from: number; to: number; minutes: number } | null;
  };
  suggestedProgram: PracticeProgram;
  programs: { id: PracticeProgram; label: string; text: string }[];
  log: PracticeLogEntry[];
}

export function weekendView(s: GameState): WeekendView {
  const entry = playerEntry(s);
  const empty: WeekendView = {
    state: 'none',
    seasonFinished: false,
    round: null,
    track: null,
    categoryId: '',
    sessions: [],
    next: null,
    nextLaps: 0,
    qualifying: null,
    sprint: null,
    race: null,
    allocation: { soft: 0, medium: 0, hard: 0, wet: 0 },
    myRiders: [],
    last: null,
  };
  if (!entry) return empty;
  const season = s.tables.seasons[entry.seasonId]!;
  const cat = s.tables.categories[entry.categoryId]!;
  const rounds = seasonRounds(s, season.id);
  const today = s.meta.currentDay;
  const current =
    rounds.find((r) => r.startDay === today && r.status !== 'raced') ??
    rounds.find((r) => r.startDay === today) ??
    rounds.find((r) => r.startDay > today);
  const lastRaced = [...rounds].reverse().find((r) => r.status === 'raced');
  const lastRes = lastRaced
    ? rows(s, 'sessionResults').find((x) => x.roundId === lastRaced.id && x.kind === 'race')
    : undefined;
  const last =
    lastRaced && lastRes
      ? {
          circuit: s.tables.circuits[lastRaced.circuitId]!.name,
          number: lastRaced.number,
          race: resultView(s, lastRes)!,
        }
      : null;
  const seasonFinished = season.status === 'finished';
  if (!current) return { ...empty, state: 'seasonOver', seasonFinished, last };

  const circuit = s.tables.circuits[current.circuitId]!;
  const quali = rows(s, 'sessionResults').find((x) => x.roundId === current.id && x.kind === 'qualifying');
  const race = rows(s, 'sessionResults').find((x) => x.roundId === current.id && x.kind === 'race');
  const resOf = (k: SessionKind) =>
    rows(s, 'sessionResults').find((x) => x.roundId === current.id && x.kind === k);
  const fmtW = WEEKEND_FORMAT[cat.tier];
  const kinds = sessionsOf(s, current);
  const next = nextSession(s, current);
  const fullLaps = RACE_FORMAT[cat.tier].laps;
  const nextLaps = next === 'sprint' ? sprintLaps(fullLaps) : fullLaps;
  const wx = weatherOf(s, current);
  const raceKind = next === 'sprint' ? 'sprint' : 'race';
  const nextCond = conditionsFor(
    wx.find((w) => w.kind === (next && next !== 'sprint' && next !== 'race' ? next : raceKind)),
  );
  const direct = new Set((resOf('practice')?.rows ?? []).slice(0, fmtW.toQ2).map((x) => x.riderId));
  const promoted = new Set((resOf('q1')?.rows ?? []).slice(0, fmtW.fromQ1).map((x) => x.riderId));
  const myRiders = entry.seats.flatMap((seat) => {
    const r = seat.riderId ? s.tables.riders[seat.riderId] : undefined;
    if (!r) return [];
    const laps = nextLaps;
    const left = tyresLeft(s, current, r.id);
    const inNext =
      next === 'q1' ? !direct.has(r.id) : next === 'q2' ? direct.has(r.id) || promoted.has(r.id) : true;
    const refLap = circuit.lengthM / RACE_FORMAT[cat.tier].avgSpeed;
    const tmU = Math.min(1, unit(r.attributes.tyreManagement) + upgradeBonus(s, entry.teamId).tyreCare);
    const mode: Strategy['mode'] =
      r.attributes.aggression >= 75 ? 'normal' : r.attributes.consistency >= 72 ? 'attack' : 'normal';
    // Secondi persi da ogni mescola rispetto alla migliore, per ciascun ritmo.
    const forecast = {} as Record<Strategy['mode'], Record<Strategy['compound'], number>>;
    const ALL = ['soft', 'medium', 'hard', 'wet'] as const;
    for (const m of ['conservative', 'normal', 'attack'] as const) {
      const fc = compoundForecast(tmU, m, laps, nextCond);
      const bestC = ALL.reduce((a, b) => (fc[a] <= fc[b] ? a : b));
      const sec = (c: Strategy['compound']) =>
        c === bestC ? 0 : Math.max(0.1, Math.round(((fc[c] - fc[bestC]) / 100) * refLap * 10) / 10);
      forecast[m] = { soft: sec('soft'), medium: sec('medium'), hard: sec('hard'), wet: sec('wet') };
    }
    const raceType = next === 'sprint' || next === 'race' || next === null;
    const ORDER: Record<string, Strategy['compound'][]> = {
      fp1: ['hard', 'medium', 'soft'],
      fp2: ['medium', 'hard', 'soft'],
      practice: ['soft', 'medium', 'hard'],
      q1: ['soft', 'medium', 'hard'],
      q2: ['soft', 'medium', 'hard'],
      qualifying: ['soft', 'medium', 'hard'],
      warmup: ['medium', 'hard', 'soft'],
    };
    const byForecast = (['soft', 'medium', 'hard', 'wet'] as const)
      .slice()
      .sort((a, b) => forecast[mode][a] - forecast[mode][b]);
    const order: Strategy['compound'][] = raceType
      ? byForecast
      : nextCond.grip !== 'dry'
        ? ['wet', ...ORDER[next!]!]
        : [...ORDER[next!]!, 'wet'];
    const compound = order.find((c) => left[c] > 0) ?? order[0]!;
    const NAME = { soft: 'morbida', medium: 'media', hard: 'dura', wet: 'da pioggia' };
    const others = (['soft', 'medium', 'hard', 'wet'] as const)
      .filter((c) => c !== compound)
      .map((c) => `${NAME[c]} +${forecast[mode][c].toFixed(1).replace('.', ',')} s`)
      .join(', ');
    const care = r.attributes.tyreManagement;
    const why = `${
      nextCond.grip === 'wet'
        ? 'Pista bagnata: servono le gomme da pioggia.'
        : nextCond.grip === 'damp'
          ? 'Pista umida: le gomme da pioggia sono di poco più veloci, ma si consumano se asciuga.'
          : `Asfalto a ${nextCond.trackTemp} °C${nextCond.trackTemp >= 45 ? ': caldo, le gomme si consumano di più' : nextCond.trackTemp <= 22 ? ': freddo, le gomme durano di più' : ''}.`
    } Gestione gomme ${care}/99: ${
      compound === 'wet'
        ? 'rain obbligatorie con questo meteo'
        : compound === 'soft'
          ? 'le tratta bene, la morbida regge fino in fondo'
          : compound === 'hard'
            ? 'le consuma molto, la dura cala meno nel finale'
            : 'la media è il miglior compromesso'
    }. Stima su ${laps} giri: ${others}.`;
    return [
      {
        id: r.id,
        name: `${r.firstName} ${r.lastName}`,
        number: seat.number,
        grid: quali?.rows.find((x) => x.riderId === r.id)?.position ?? null,
        tyresLeft: left,
        inNext,
        suggested: { compound, mode } as Strategy,
        why,
        forecast,
        practice: practiceView(s, current, r, cat.tier, nextCond.grip !== 'dry'),
      },
    ];
  });
  return {
    state: current.startDay === today ? 'today' : 'upcoming',
    seasonFinished,
    round: {
      id: current.id,
      number: current.number,
      total: rounds.length,
      circuit: circuit.name,
      country: circuit.country,
      date: cal(s).format(current.startDay),
      inDays: current.startDay - today,
      laps: RACE_FORMAT[cat.tier].laps,
      lengthKm: Math.round(circuit.lengthM / 10) / 100,
      turns: circuit.turns,
      category: cat.name,
      status: current.status ?? 'pending',
    },
    track: trackFor(s, current).points,
    categoryId: entry.categoryId,
    sessions: kinds.map((k, i) => ({
      kind: k,
      name: SESSION_NAME[k].name,
      day: SESSION_NAME[k].day,
      done: i < (current.stage ?? 0),
      results: resultView(s, resOf(k)),
      weather: wx[i]!,
    })),
    next,
    nextLaps,
    qualifying: resultView(s, quali),
    sprint: resultView(s, resOf('sprint')),
    race: resultView(s, race),
    allocation: TYRE_ALLOCATION[cat.tier],
    myRiders,
    last,
  };
}

// ---------------------------------------------------------------------------------------------
export interface ChampionshipView extends StandingsView {
  categoryId: string;
  category: string;
  year: number;
  racesTotal: number;
  myTeamId: string | null;
  races: { number: number; circuit: string; winner: string | null; done: boolean }[];
}

export function championship(s: GameState, categoryId?: string): ChampionshipView | null {
  const entry = playerEntry(s);
  const catId = categoryId ?? entry?.categoryId;
  if (!catId) return null;
  // Stagione più recente della categoria.
  const season = rows(s, 'seasons')
    .filter((x) => x.categoryId === catId)
    .sort((a, b) => b.year - a.year)[0];
  if (!season) return null;
  const rounds = seasonRounds(s, season.id);
  const races = rows(s, 'sessionResults').filter((x) => x.seasonId === season.id && x.kind === 'race');
  return {
    ...standings(s, season.id),
    categoryId: catId,
    category: s.tables.categories[catId as never]!.name,
    year: season.year,
    racesTotal: rounds.length,
    myTeamId: s.meta.playerTeamId,
    races: rounds.map((r) => {
      const res = races.find((x) => x.roundId === r.id);
      const w = res?.rows.find((x) => x.position === 1);
      const rider = w ? s.tables.riders[w.riderId] : undefined;
      return {
        number: r.number,
        circuit: s.tables.circuits[r.circuitId]!.name,
        winner: rider ? `${rider.firstName} ${rider.lastName}` : null,
        done: !!res,
      };
    }),
  };
}

// ---------------------------------------------------------------------------------------------
export const CATEGORY_LABEL: Record<TransactionCategory, string> = {
  sponsor: 'Sponsor',
  prizeMoney: 'Premi',
  commercialRights: 'Diritti TV e commerciali',
  investors: 'Investitori',
  merchandising: 'Merchandising',
  supply: 'Fornitura moto',
  salaries: 'Stipendi',
  development: 'Sviluppo',
  production: 'Produzione',
  travel: 'Trasferte',
  facilities: 'Strutture',
  repairs: 'Riparazioni',
  logistics: 'Logistica',
  other: 'Altro',
};

export interface FinanceView {
  balance: number;
  opening: number;
  monthly: { salaries: number; running: number; sponsor: number; net: number };
  perRace: { rights: number; travel: number; prizePerPoint: number };
  racesLeft: number;
  forecastYearEnd: number;
  byCategory: { category: string; label: string; amount: number }[];
  /** Saldo a fine di ogni mese dell'anno in corso (per il grafico). */
  history: { month: number; balance: number }[];
  movements: { date: string; label: string; note: string; amount: number }[];
}

export function financeView(s: GameState): FinanceView | null {
  const teamId = s.meta.playerTeamId as TeamId | null;
  const entry = playerEntry(s);
  if (!teamId || !entry) return null;
  const tier = s.tables.categories[entry.categoryId]!.tier;
  const c = cal(s);
  const now = c.toDate(s.meta.currentDay);
  const balance = teamBalance(s, teamId);
  const acc = s.accounts.find((a) => a.teamId === teamId);
  const trx = rows(s, 'transactions')
    .filter((t) => t.teamId === teamId)
    .sort((a, b) => a.day - b.day);
  const yearStart = c.fromDate({ year: now.year, month: 1, day: 1 });
  const thisYear = trx.filter((t) => t.day >= yearStart);
  const sums = new Map<string, number>();
  for (const t of thisYear) sums.set(t.category, (sums.get(t.category) ?? 0) + t.amount);
  const salaries = payrollMonthly(s, teamId);
  const sponsor = sponsorMonthly(s, teamId);
  const running = runningCostMonthly(s, teamId);
  const racesLeft = seasonRounds(s, entry.seasonId).filter((r) => r.status !== 'raced').length;
  // Mesi in cui si paga ancora (il 1° di ogni mese successivo a oggi, fino a dicembre).
  const monthsLeft = 12 - now.month;
  const forecastYearEnd =
    balance + monthsLeft * (sponsor - salaries - running) + racesLeft * (RACE_FEE[tier] - TRAVEL_COST[tier]);
  // Saldo a fine mese.
  let bal =
    (acc?.openingBalance ?? 0) + trx.filter((t) => t.day < yearStart).reduce((a, t) => a + t.amount, 0);
  const history: FinanceView['history'] = [];
  for (let m = 1; m <= now.month; m++) {
    const end =
      m === 12
        ? c.fromDate({ year: now.year + 1, month: 1, day: 1 })
        : c.fromDate({ year: now.year, month: m + 1, day: 1 });
    const start = c.fromDate({ year: now.year, month: m, day: 1 });
    bal += thisYear.filter((t) => t.day >= start && t.day < end).reduce((a, t) => a + t.amount, 0);
    history.push({ month: m, balance: bal });
  }
  return {
    balance,
    opening: acc?.openingBalance ?? 0,
    monthly: { salaries, running, sponsor, net: sponsor - salaries - running },
    perRace: { rights: RACE_FEE[tier], travel: TRAVEL_COST[tier], prizePerPoint: PRIZE_PER_POINT[tier] },
    racesLeft,
    forecastYearEnd,
    byCategory: [...sums.entries()]
      .map(([category, amount]) => ({
        category,
        label: CATEGORY_LABEL[category as TransactionCategory],
        amount,
      }))
      .sort((a, b) => b.amount - a.amount),
    history,
    movements: [...trx]
      .reverse()
      .slice(0, 60)
      .map((t) => ({
        date: c.format(t.day),
        label: CATEGORY_LABEL[t.category],
        note: t.note,
        amount: t.amount,
      })),
  };
}

// ---------------------------------------------------------------------------------------------
export function newsFeed(
  s: GameState,
  filter: 'all' | 'mine' = 'all',
  limit = 80,
): (NewsItem & { date: string })[] {
  const c = cal(s);
  return rows(s, 'news')
    .filter((n) => filter === 'all' || n.mine)
    .sort((a, b) => b.day - a.day || (a.id < b.id ? 1 : -1))
    .slice(0, limit)
    .map((n) => ({ ...n, date: c.format(n.day) }));
}

// ---------------------------------------------------------------------------------------------
export interface SeasonReview {
  year: number;
  champions: { category: string; rider: string; team: string; points: number }[];
  myTeam: { position: number; of: number; points: number; wins: number } | null;
  myRiders: {
    name: string;
    position: number;
    points: number;
    wins: number;
    contractEnds: string;
    expiring: boolean;
  }[];
}

export function seasonReview(s: GameState): SeasonReview | null {
  const entry = playerEntry(s);
  if (!entry) return null;
  const season = s.tables.seasons[entry.seasonId]!;
  const c = cal(s);
  const endOfYear = c.fromDate({ year: season.year, month: 12, day: 31 });
  const champions = rows(s, 'seasons')
    .filter((x) => x.year === season.year)
    .flatMap((x) => {
      const st = standings(s, x.id);
      const top = st.riders[0];
      return top
        ? [
            {
              category: s.tables.categories[x.categoryId]!.name,
              rider: top.name,
              team: top.team,
              points: top.points,
            },
          ]
        : [];
    });
  const st = standings(s, season.id);
  const ti = st.teams.findIndex((t) => t.teamId === entry.teamId);
  const myRiders = entry.seats.flatMap((seat) => {
    const r = seat.riderId ? s.tables.riders[seat.riderId] : undefined;
    if (!r) return [];
    const i = st.riders.findIndex((x) => x.riderId === r.id);
    const contract = rows(s, 'contracts').find(
      (k) => k.counterpartyId === r.id && k.status === 'active' && k.employerId === entry.teamId,
    );
    return [
      {
        name: `${r.firstName} ${r.lastName}`,
        position: i + 1,
        points: st.riders[i]?.points ?? 0,
        wins: st.riders[i]?.wins ?? 0,
        contractEnds: contract ? c.format(contract.endDay) : '—',
        expiring: !!contract && contract.endDay <= endOfYear,
      },
    ];
  });
  return {
    year: season.year,
    champions,
    myTeam:
      ti >= 0
        ? { position: ti + 1, of: st.teams.length, points: st.teams[ti]!.points, wins: st.teams[ti]!.wins }
        : null,
    myRiders,
  };
}

// ---------------------------------------------------------------------------------------------
export interface BikeView {
  team: string;
  colors: { primary: string; secondary: string };
  numbers: number[];
  balance: number;
  manufacturer: string;
  /** Categoria (premier, intermediate, lightweight, rookies): serve a scegliere la foto della moto. */
  tier: string;
  /** Qualità della moto 0–100 con gli upgrade montati, e media delle avversarie di categoria. */
  rating: number;
  rivalsAvg: number;
  /** Fascia di concessione del costruttore (solo MotoGP). */
  concession: ConcessionRank | null;
  /** Motori della stagione per pilota (solo MotoGP). */
  engines: { name: string; used: number; allocation: number; overLimit: boolean }[];
  parts: {
    key: PartKey;
    name: string;
    what: string;
    effect: string;
    color: string;
    level: number;
    max: number;
    nextCost: number | null;
    affordable: boolean;
    /** Giorni di produzione del prossimo livello se lo ordini oggi. */
    nextLeadDays: number | null;
    /** Ordine in fabbrica: livello in arrivo, data e giorni mancanti. */
    inProduction: { level: number; ready: string; daysLeft: number } | null;
  }[];
  /** Garage: moto di ogni pilota (A, e B solo dove il regolamento la concede) con i 14 componenti. */
  /** Manutenzione: automatica (capotecnico), assistita (avvisi) o manuale. */
  garageMode: 'auto' | 'assisted' | 'manual';
  /** Circuito del prossimo Gran Premio (per i commenti sull'assetto). */
  nextCircuit: string | null;
  /** Assetto di ogni pilota: regolazioni consentite, valori asciutto/bagnato, commenti, intesa. */
  setups: {
    riderId: string;
    rider: string;
    feedbackQuality: 'preciso' | 'vago';
    /** Minuti di lavoro rimasti prima della prossima sessione del weekend (null = nessun limite). */
    workLeft: number | null;
    keys: { key: string; name: string; low: string; high: string }[];
    dry: {
      values: Record<string, number>;
      feedback: { key: string; text: string; ok: boolean }[];
      match: number;
    };
    wet: {
      values: Record<string, number>;
      feedback: { key: string; text: string; ok: boolean }[];
      match: number;
    };
  }[];
  /** Sostituzioni importanti che aspettano la decisione del manager. */
  decisions: {
    bikeId: string;
    rider: string;
    slot: 'A' | 'B';
    part: string;
    name: string;
    wear: number;
    cost: number;
  }[];
  garage: {
    riderId: string;
    rider: string;
    number: number;
    bikes: {
      id: string;
      slot: 'A' | 'B';
      km: number;
      /** Affidabilità della moto in gara (base × componenti), 0–100. */
      reliability: number;
      /** Gruppi tecnici della categoria (quello che il giocatore vede). */
      groups: {
        key: string;
        name: string;
        zone: 'engine' | 'chassis' | 'suspension' | 'brakes' | 'aero' | 'electronics';
        what: string;
        /** Livello di sviluppo (media dei reparti che lo migliorano, 0–3). */
        level: number;
        condition: number;
        wear: number;
        reliability: number;
        lifeLeftKm: number;
        lifeLeftWeekends: number;
        parts: GarageKey[];
        serviceable: GarageKey[];
        serviceCost: number;
        /** Indice di prestazione 0–100 (costruttore + sviluppo) e quello col prossimo pacchetto. */
        performance: number;
        next: {
          partKey: string;
          part: string;
          level: number;
          performance: number;
          cost: number | null;
          leadDays: number | null;
          affordable: boolean;
          inProduction: { level: number; ready: string; daysLeft: number } | null;
        } | null;
        spares: number;
        spareCost: number | null;
      }[];
      /** Componenti di fornitura (gestiti dal fornitore, es. motore unico Moto2). */
      supplier: string[];
      parts: {
        key: GarageKey;
        name: string;
        group: string;
        upgradeLevel: number;
        km: number;
        lifeKm: number;
        wear: number;
        reliability: number;
        services: number;
        cost: number;
        serviceable: boolean;
      }[];
    }[];
  }[];
}

export function bikeView(s: GameState): BikeView | null {
  const entry = playerEntry(s);
  if (!entry) return null;
  const team = s.tables.teams[entry.teamId]!;
  const balance = teamBalance(s, entry.teamId);
  const rating = (teamId: string) => {
    const e = rows(s, 'teamEntries').find((x) => x.teamId === teamId)!;
    const m = s.tables.manufacturers[e.manufacturerId]!;
    return Math.round(m.engineeringStrength + upgradeBonus(s, teamId).bike * 100);
  };
  const rivals = rows(s, 'teamEntries').filter(
    (e) => e.seasonId === entry.seasonId && e.teamId !== entry.teamId,
  );
  return {
    team: team.name,
    colors: team.colors,
    numbers: entry.seats.map((x) => x.number),
    balance,
    manufacturer: s.tables.manufacturers[entry.manufacturerId]!.name,
    tier: s.tables.categories[entry.categoryId]!.tier,
    rating: rating(entry.teamId),
    concession: teamConcession(s, entry.teamId),
    engines:
      teamConcession(s, entry.teamId) === null
        ? []
        : entry.seats.flatMap((seat) => {
            const r = seat.riderId ? s.tables.riders[seat.riderId] : undefined;
            if (!r) return [];
            const e = engineStatus(s, r.id, entry.seasonId, entry.teamId);
            return [
              {
                name: `${r.firstName} ${r.lastName}`,
                used: e.used,
                allocation: e.allocation,
                overLimit: e.overLimit,
              },
            ];
          }),
    garageMode: garageModeOf(s, entry.teamId),
    ...(() => {
      const next = seasonRounds(s, entry.seasonId).find((r) => r.status !== 'raced');
      const tier = s.tables.categories[entry.categoryId]!.tier;
      const turns = turnsOf(s, next);
      return {
        nextCircuit: next ? s.tables.circuits[next.circuitId]!.name : null,
        setups: entry.seats.flatMap((seat) => {
          const r = seat.riderId ? s.tables.riders[seat.riderId] : undefined;
          if (!r) return [];
          const today = playerRoundToday(s);
          const clear = feedbackIsClear(r, next ? practiceRiderOf(s, next.id, r.id) : null);
          const side = (wet: boolean) => {
            const values = setupOf(s, r.id, wet);
            return {
              values,
              feedback: setupFeedback(r, tier, turns, wet, values, clear),
              match: Math.round(setupMatch(s, r, tier, turns, wet, true) * 100),
            };
          };
          return [
            {
              riderId: r.id,
              rider: `${r.firstName} ${r.lastName}`,
              feedbackQuality: clear ? ('preciso' as const) : ('vago' as const),
              workLeft: workMinutesLeft(s, today, r.id),
              keys: SETUP_KEYS[tier],
              dry: side(false),
              wet: side(true),
            },
          ];
        }),
      };
    })(),
    decisions: pendingDecisions(s, entry.teamId).map((d) => {
      const r = s.tables.riders[d.riderId as keyof typeof s.tables.riders];
      return { ...d, rider: r ? `${r.firstName} ${r.lastName}` : '' };
    }),
    garage: entry.seats.flatMap((seat) => {
      const r = seat.riderId ? s.tables.riders[seat.riderId] : undefined;
      if (!r) return [];
      const base = bikeOf(s, entry.teamId, entry.manufacturerId).reliability;
      const bikes = rows(s, 'bikes')
        .filter((b) => b.riderId === r.id && b.teamId === entry.teamId)
        .sort((a, b) => a.slot.localeCompare(b.slot));
      return [
        {
          riderId: r.id,
          rider: `${r.firstName} ${r.lastName}`,
          number: seat.number,
          bikes: bikes.map((b) => ({
            id: b.id,
            slot: b.slot,
            km: Math.round(b.mileageKm ?? 0),
            reliability: Math.round(base * bikeReliabilityFactor(b) * 1000) / 10,
            groups: groupsFor(s, b).map((g) => {
              const st = groupStatus(b, g);
              const serviceable = g.parts.filter((k) => canService(s, b, k) && (b.parts?.[k]?.km ?? 0) > 0);
              return {
                key: g.key,
                name: g.name,
                zone: g.zone,
                what: g.what,
                level: g.upgrade.length
                  ? Math.round(
                      (g.upgrade.reduce((t, u) => t + partLevel(s, entry.teamId, u), 0) / g.upgrade.length) *
                        10,
                    ) / 10
                  : 0,
                ...st,
                parts: g.parts,
                serviceable,
                serviceCost: serviceable.reduce((t, k) => t + serviceCost(s, b, k), 0),
                ...(() => {
                  const base = s.tables.manufacturers[entry.manufacturerId]!.engineeringStrength;
                  const lvl = (u: string) => partLevel(s, entry.teamId, u as PartKey);
                  const perf = (bonus: number) => Math.min(100, Math.round(base * 0.8 + bonus));
                  const levels = g.upgrade.map(lvl);
                  const avg = levels.length ? levels.reduce((t, x) => t + x, 0) / levels.length : 0;
                  // Prossimo pacchetto: il reparto del gruppo col livello più basso.
                  const target = g.upgrade.length
                    ? g.upgrade.reduce((a2, u) => (lvl(u) < lvl(a2) ? u : a2), g.upgrade[0]!)
                    : null;
                  const order = target ? pendingOrder(s, entry.teamId, target as PartKey) : undefined;
                  const cost = target ? upgradeCost(s, entry.teamId, target as PartKey) : null;
                  return {
                    performance: perf(avg * 6),
                    next:
                      target && (lvl(target) < MAX_PART_LEVEL || order)
                        ? {
                            partKey: target,
                            part: PARTS.find((x) => x.key === target)!.name,
                            level: order ? order.level : lvl(target) + 1,
                            performance: perf(((avg * levels.length + 1) / levels.length) * 6),
                            cost,
                            leadDays:
                              cost !== null
                                ? leadDays(s, entry.teamId, target as PartKey, lvl(target) + 1)
                                : null,
                            affordable: cost !== null && cost <= balance,
                            inProduction: order
                              ? {
                                  level: order.level,
                                  ready: cal(s).format(order.readyDay),
                                  daysLeft: order.readyDay - s.meta.currentDay,
                                }
                              : null,
                          }
                        : null,
                    spares: sparesOf(s, entry.teamId, g.key),
                    spareCost: spareCost(s, entry.teamId, g.key),
                  };
                })(),
              };
            }),
            supplier: GARAGE_PARTS.filter((p) => isSupplierPart(s, b, p.key)).map((p) => p.name),
            parts: GARAGE_PARTS.map((p) => {
              const w = partWear(b, p.key);
              return {
                key: p.key,
                name: p.name,
                group: p.group,
                upgradeLevel: partLevel(s, entry.teamId, p.upgrade),
                km: Math.round(b.parts?.[p.key]?.km ?? 0),
                lifeKm: p.life * GARAGE_WEEKEND_KM,
                wear: Math.round(w * 100),
                reliability: Math.round(partReliability(w) * 100),
                services: b.parts?.[p.key]?.services ?? 0,
                cost: serviceCost(s, b, p.key),
                serviceable: canService(s, b, p.key),
              };
            }),
          })),
        },
      ];
    }),
    rivalsAvg: Math.round(rivals.reduce((t, e) => t + rating(e.teamId), 0) / Math.max(1, rivals.length)),
    parts: PARTS.map((p) => {
      const cost = upgradeCost(s, entry.teamId, p.key);
      return {
        key: p.key,
        name: p.name,
        what: p.what,
        effect: p.effect,
        color: p.color,
        level: partLevel(s, entry.teamId, p.key),
        max: MAX_PART_LEVEL,
        nextCost: cost,
        affordable: cost !== null && cost <= balance,
        nextLeadDays:
          cost !== null ? leadDays(s, entry.teamId, p.key, partLevel(s, entry.teamId, p.key) + 1) : null,
        inProduction: (() => {
          const o = pendingOrder(s, entry.teamId, p.key);
          return o
            ? { level: o.level, ready: cal(s).format(o.readyDay), daysLeft: o.readyDay - s.meta.currentDay }
            : null;
        })(),
      };
    }),
  };
}

// ---------------------------------------------------------------------------------------------
export interface SponsorView {
  windowOpen: boolean;
  offers: SponsorOffer[];
  baseMonthly: number;
  expected: { position: number; of: number };
  deal: {
    sponsorName: string;
    risk: string;
    label: string;
    targetPosition: number;
    monthly: number;
    bonus: number;
    status: 'active' | 'met' | 'missed';
    /** Posizione attuale della squadra nella classifica squadre (null prima della prima gara). */
    currentPosition: number | null;
  } | null;
}

export function sponsorView(s: GameState): SponsorView | null {
  const entry = playerEntry(s);
  if (!entry) return null;
  const d = currentDeal(s);
  const st = standings(s, entry.seasonId);
  const idx = st.teams.findIndex((t) => t.teamId === entry.teamId);
  return {
    windowOpen: dealWindowOpen(s),
    offers: sponsorOffers(s),
    baseMonthly: sponsorMonthly(s, entry.teamId),
    expected: expectedPosition(s, entry.teamId),
    deal: d
      ? {
          sponsorName: d.sponsorName,
          risk: d.risk,
          label: SPONSOR_DEAL_RISK[d.risk].label,
          targetPosition: d.targetPosition,
          monthly: d.monthly,
          bonus: d.bonus,
          status: d.status,
          currentPosition: st.racesDone > 0 && idx >= 0 ? idx + 1 : null,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------------------------
export interface RiderProfile {
  detail: RiderDetail;
  teamColors: { primary: string; secondary: string } | null;
  category: string | null;
  personality: { key: string; value: number }[];
  contract: {
    start: string;
    end: string;
    salary: number;
    role: string;
    buyout: number;
    bonuses: { condition: string; amount: number }[];
    expiresThisYear: boolean;
  } | null;
  current: SeasonStats | null;
  history: SeasonStats[];
  career: ReturnType<typeof careerTotals>;
  preferences: ReturnType<typeof technicalPreferences>;
}

export function riderProfile(s: GameState, riderId: string): RiderProfile | null {
  const detail = riderDetail(s, riderId);
  const r = s.tables.riders[riderId as never] as Rider | undefined;
  if (!detail || !r) return null;
  const c = cal(s);
  const k = activeRiderContract(s, r.id);
  const team = k ? s.tables.teams[k.employerId as TeamId] : undefined;
  const history = riderHistory(s, r.id);
  const year = c.toDate(s.meta.currentDay).year;
  return {
    detail,
    teamColors: team ? { primary: team.colors.primary, secondary: team.colors.secondary } : null,
    category: r.categoryId ? s.tables.categories[r.categoryId]!.name : null,
    personality: Object.entries(r.personality).map(([key, value]) => ({ key, value })),
    contract: k
      ? {
          start: c.format(k.startDay),
          end: c.format(k.endDay),
          salary: k.salary,
          role: k.role ?? 'race',
          buyout: buyoutFor(s, k),
          bonuses: k.bonuses,
          expiresThisYear: c.toDate(k.endDay).year <= year,
        }
      : null,
    current: history.find((h) => h.year === year) ?? null,
    history,
    career: careerTotals(history),
    preferences: technicalPreferences(r),
  };
}

function practiceView(s: GameState, round: Round, r: Rider, tier: CategoryTier, wet: boolean): PracticeView {
  const turns = turnsOf(s, round);
  const pr = practiceRiderOf(s, round.id, r.id);
  const cur = setupOf(s, r.id, wet);
  const match = Math.round(setupMatch(s, r, tier, turns, wet, true) * 100);
  const clear = feedbackIsClear(r, pr);
  const names = Object.fromEntries(SETUP_KEYS[tier].map((k) => [k.key, k.name]));
  const adv = crewChiefAdvice(s, r, tier, turns, wet, cur);
  const from = cur[adv.key ?? ''] ?? 0;
  const to = Math.max(-5, Math.min(5, from + adv.delta));
  const trackConf = Math.round(pr?.trackConf ?? baseTrackConf(r));
  const bikeConf = Math.round(pr?.bikeConf ?? 50);
  return {
    laps: pr?.laps ?? 0,
    trackConf,
    bikeConf,
    longRun: pr?.longRun ?? false,
    match,
    wet,
    minutesLeft: workMinutesLeft(s, round, r.id),
    breakMinutes: BREAK_MINUTES,
    feedback: setupFeedback(r, tier, turns, wet, cur, clear).map((f) => ({
      ...f,
      name: names[f.key] ?? f.key,
    })),
    clear,
    advice: {
      crewChief: adv.name,
      text: adv.text,
      change:
        adv.key && to !== from
          ? { key: adv.key, from, to, minutes: changeMinutes(s, r.id, cur, { [adv.key]: to }) }
          : null,
    },
    suggestedProgram: match < 70 ? 'setup' : trackConf < 72 ? 'track' : 'longRun',
    programs: (Object.keys(PROGRAMS) as PracticeProgram[]).map((id) => ({ id, ...PROGRAMS[id] })),
    log: pr?.log ?? [],
  };
}
