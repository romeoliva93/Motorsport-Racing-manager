/**
 * Viste di Fase 2: weekend di gara, classifiche, finanze, notizie e riepilogo di fine stagione.
 * Come per queries.ts sono funzioni pure di sola lettura sullo stato.
 */
import { GameCalendar } from '@lean-angle/core';
import {
  RACE_FEE,
  TRAVEL_COST,
  PRIZE_PER_POINT,
  rows,
  teamBalance,
  type GameState,
  type NewsItem,
  type Round,
  type SessionResult,
  type TeamId,
  type TransactionCategory,
} from '@lean-angle/data';
import { payrollMonthly, runningCostMonthly, sponsorMonthly } from './economy.ts';
import { RACE_FORMAT, standings, trackFor, type StandingsView, type Strategy } from './weekend.ts';

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
  number: number;
  team: string;
  color: string;
  mine: boolean;
  time: number | null;
  gap: number | null;
  bestLap: number;
  points: number;
  status: 'finished' | 'dnf';
  reason?: 'crash' | 'mechanical';
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
    };
  });
}

export interface WeekendView {
  /** today = si corre oggi; upcoming = prossimo GP; seasonOver = stagione conclusa; none = niente squadra. */
  state: 'none' | 'today' | 'upcoming' | 'seasonOver';
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
  qualifying: ResultRowView[] | null;
  race: ResultRowView[] | null;
  myRiders: {
    id: string;
    name: string;
    number: number;
    grid: number | null;
    suggested: Strategy;
    why: string;
  }[];
  /** Ultima gara del giocatore, per mostrare i risultati fra un weekend e l'altro. */
  last: { circuit: string; number: number; race: ResultRowView[] } | null;
}

export function weekendView(s: GameState): WeekendView {
  const entry = playerEntry(s);
  const empty: WeekendView = {
    state: 'none',
    round: null,
    track: null,
    qualifying: null,
    race: null,
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
  if (!current) return { ...empty, state: 'seasonOver', last };

  const circuit = s.tables.circuits[current.circuitId]!;
  const quali = rows(s, 'sessionResults').find((x) => x.roundId === current.id && x.kind === 'qualifying');
  const race = rows(s, 'sessionResults').find((x) => x.roundId === current.id && x.kind === 'race');
  const myRiders = entry.seats.flatMap((seat) => {
    const r = seat.riderId ? s.tables.riders[seat.riderId] : undefined;
    if (!r) return [];
    const tm = r.attributes.tyreManagement;
    const ag = r.attributes.aggression;
    const compound = tm >= 70 ? 'soft' : tm <= 45 ? 'hard' : 'medium';
    const mode = ag >= 75 ? 'normal' : r.attributes.consistency >= 72 ? 'attack' : 'normal';
    const why =
      compound === 'soft'
        ? 'Gestisce bene le gomme: la morbida gli dà più velocità senza calare troppo.'
        : compound === 'hard'
          ? 'Consuma molto le gomme: la dura cala meno nel finale.'
          : 'La media è il compromesso più sicuro.';
    return [
      {
        id: r.id,
        name: `${r.firstName} ${r.lastName}`,
        number: seat.number,
        grid: quali?.rows.find((x) => x.riderId === r.id)?.position ?? null,
        suggested: { compound, mode } as Strategy,
        why,
      },
    ];
  });
  return {
    state: current.startDay === today ? 'today' : 'upcoming',
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
    qualifying: resultView(s, quali),
    race: resultView(s, race),
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
