/**
 * Weekend di gara a sessioni (prove, qualifiche Q1/Q2, Sprint, gara) per tutte le categorie, punti, premi e notizie.
 * La simulazione vera e propria è nel pacchetto sim; qui si traducono piloti, moto e strutture in parametri.
 */
import { GameCalendar, type IdFactory, type Rng } from '@lean-angle/core';
import {
  PRIZE_PER_POINT,
  RACE_FEE,
  TRAVEL_COST,
  rows,
  type CategoryTier,
  type GameState,
  type ManufacturerId,
  type ResultRow,
  type Rider,
  type RiderId,
  type Round,
  type SessionKind,
  type SessionResult,
  type SessionResultId,
  type TeamId,
} from '@lean-angle/data';
import {
  compoundForecast,
  generateTrack,
  runQualifying,
  runRace,
  unit,
  type Compound,
  type Conditions,
  type Grip,
  type PaceMode,
  type RaceOutcome,
  type RaceRider,
} from '@lean-angle/sim';
import { addNews } from './news.ts';
import { conditionsFor, weekendWeather, type SessionWeather } from './weather.ts';
import { upgradeBonus } from './upgrades.ts';
import { settleDeals } from './sponsors.ts';

export interface Strategy {
  compound: Compound;
  mode: PaceMode;
}

/** Giri e velocità media di riferimento per categoria (gare più corte del reale per renderle guardabili). */
export const RACE_FORMAT: Record<CategoryTier, { laps: number; avgSpeed: number }> = {
  premier: { laps: 15, avgSpeed: 46 },
  intermediate: { laps: 13, avgSpeed: 43.5 },
  lightweight: { laps: 12, avgSpeed: 40.5 },
  rookies: { laps: 10, avgSpeed: 38 },
};

export function trackFor(s: GameState, round: Round) {
  const c = s.tables.circuits[round.circuitId]!;
  return generateTrack(c.name, c.turns);
}

/** Round di tutte le categorie che iniziano oggi. */
export function roundsToday(s: GameState): Round[] {
  return rows(s, 'rounds').filter(
    (r) => r.startDay === s.meta.currentDay && s.tables.seasons[r.seasonId]?.status !== 'finished',
  );
}

export function playerRoundToday(s: GameState): Round | undefined {
  const teamId = s.meta.playerTeamId;
  if (!teamId) return undefined;
  const entry = rows(s, 'teamEntries').find((e) => e.teamId === teamId);
  return roundsToday(s).find((r) => entry && r.seasonId === entry.seasonId);
}

function riderSkill(r: Rider): number {
  const a = r.attributes;
  const v =
    0.25 * a.speed +
    0.25 * a.racePace +
    0.15 * a.braking +
    0.15 * a.cornerEntry +
    0.1 * a.acceleration +
    0.1 * a.consistency;
  return unit(v);
}

function bikeOf(
  s: GameState,
  teamId: TeamId,
  manufacturerId: ManufacturerId,
): { bike: number; reliability: number } {
  const team = s.tables.teams[teamId]!;
  const m = s.tables.manufacturers[manufacturerId]!;
  if (team.type === 'organizer') return { bike: 0.75, reliability: 0.95 };
  const dept = rows(s, 'facilities').filter(
    (f) =>
      f.teamId === teamId && ['engineDept', 'chassisDept', 'aeroDept', 'electronicsDept'].includes(f.type),
  );
  const avg = dept.length ? dept.reduce((t, f) => t + f.level, 0) / dept.length : 3;
  const satellitePenalty =
    team.type === 'factory' ? 0 : team.type === 'satellite' ? 1.5 : team.type === 'independent' ? 2.5 : 3.5;
  const score = m.engineeringStrength + (avg - 3) * 1.5 - satellitePenalty;
  const up = upgradeBonus(s, teamId);
  return {
    bike: Math.min(1, score / 100 + up.bike),
    reliability: Math.min(0.995, (m.engineeringStrength + 8) / 100 + up.reliability),
  };
}

interface Entrant {
  rider: Rider;
  teamId: TeamId;
  manufacturerId: ManufacturerId;
  number: number;
}

function entrants(s: GameState, round: Round): Entrant[] {
  return rows(s, 'teamEntries')
    .filter((e) => e.seasonId === round.seasonId)
    .flatMap((e) =>
      e.seats.flatMap((seat) => {
        const r = seat.riderId ? s.tables.riders[seat.riderId] : undefined;
        return r
          ? [{ rider: r, teamId: e.teamId, manufacturerId: e.manufacturerId, number: seat.number }]
          : [];
      }),
    );
}

/**
 * Strategia delle squadre IA: ritmo dal carattere del pilota, mescola con la previsione del proprio ingegnere
 * (con un margine d'errore: non sempre azzeccano la scelta migliore).
 */
function aiStrategy(
  r: Rider,
  rng: Rng,
  laps: number,
  left?: Record<Compound, number>,
  cond?: Conditions,
): Strategy {
  const wet = cond && cond.grip !== 'dry';
  const mode: PaceMode = wet
    ? rng.chance(0.5)
      ? 'conservative'
      : 'normal'
    : r.attributes.aggression > 72 && rng.chance(0.45)
      ? 'attack'
      : rng.chance(0.1)
        ? 'conservative'
        : 'normal';
  const fc = compoundForecast(unit(r.attributes.tyreManagement), mode, laps, cond);
  const ranked = (['soft', 'medium', 'hard', 'wet'] as Compound[])
    .map((c) => ({ c, v: fc[c] + rng.normal(0, 1.2) }))
    .sort((a, b) => a.v - b.v)
    .map((x) => x.c);
  const compound = ranked.find((c) => !left || left[c] > 0) ?? ranked[0]!;
  return { compound, mode };
}

function toRaceRider(s: GameState, e: Entrant, strat: Strategy): RaceRider {
  const a = e.rider.attributes;
  const { bike, reliability } = bikeOf(s, e.teamId, e.manufacturerId);
  return {
    id: e.rider.id,
    skill: riderSkill(e.rider),
    overtaking: unit(a.overtaking),
    defending: unit(a.defending),
    consistency: unit(a.consistency),
    concentration: unit(a.concentration),
    aggression: unit(a.aggression),
    tyreManagement: Math.min(1, unit(a.tyreManagement) + upgradeBonus(s, e.teamId).tyreCare),
    bike,
    reliability,
    compound: strat.compound,
    mode: strat.mode,
  };
}

const tierOf = (s: GameState, round: Round): CategoryTier =>
  s.tables.categories[s.tables.seasons[round.seasonId]!.categoryId]!.tier;
const refLapOf = (s: GameState, round: Round) => {
  const c = s.tables.circuits[round.circuitId]!;
  return c.lengthM / RACE_FORMAT[tierOf(s, round)].avgSpeed;
};

/**
 * Formato del weekend per categoria (sul modello del mondiale reale, in un unico giorno di gioco):
 *   MotoGP:        Prove libere 1 · Prove (i primi 10 vanno in Q2) · Prove libere 2 · Q1 (i primi 2 salgono in Q2)
 *                  · Q2 (griglia 1–12) · Sprint (metà giri, punti ai primi 9) · Gara
 *   Moto2 / Moto3: Prove libere 1 · Prove (primi 14 in Q2) · Q1 (primi 4 in Q2) · Q2 (griglia 1–18) · Gara
 *   Rookies Cup:   Prove libere 1 · Qualifica unica · Gara
 */
export const WEEKEND_FORMAT: Record<CategoryTier, { sessions: SessionKind[]; toQ2: number; fromQ1: number }> =
  {
    premier: { sessions: ['fp1', 'practice', 'fp2', 'q1', 'q2', 'sprint', 'race'], toQ2: 10, fromQ1: 2 },
    intermediate: { sessions: ['fp1', 'practice', 'q1', 'q2', 'race'], toQ2: 14, fromQ1: 4 },
    lightweight: { sessions: ['fp1', 'practice', 'q1', 'q2', 'race'], toQ2: 14, fromQ1: 4 },
    rookies: { sessions: ['fp1', 'qualifying', 'race'], toQ2: 0, fromQ1: 0 },
  };
export const SPRINT_POINTS = [12, 9, 7, 6, 5, 4, 3, 2, 1];
export const sprintLaps = (laps: number) => Math.ceil(laps / 2);

/**
 * Dotazione di gomme per pilota e per weekend: ogni sessione consuma un treno nuovo della mescola scelta.
 * Le squadre IA tengono le morbide per qualifiche e gara: prove libere con dure/medie, Prove e qualifiche con
 * morbide, Sprint e gara con la mescola migliore secondo la previsione fra quelle rimaste.
 */
export const TYRE_ALLOCATION: Record<CategoryTier, Record<Compound, number>> = {
  premier: { soft: 4, medium: 4, hard: 3, wet: 5 },
  intermediate: { soft: 3, medium: 3, hard: 2, wet: 4 },
  lightweight: { soft: 3, medium: 3, hard: 2, wet: 4 },
  rookies: { soft: 2, medium: 2, hard: 1, wet: 3 },
};

/** Treni di gomme nuove rimasti a un pilota in questo weekend. */
export function tyresLeft(s: GameState, round: Round, riderId: string): Record<Compound, number> {
  const left = { ...TYRE_ALLOCATION[tierOf(s, round)] };
  for (const res of rows(s, 'sessionResults')) {
    if (res.roundId !== round.id || res.kind === 'qualifying') continue;
    const c = res.rows.find((x) => x.riderId === riderId)?.compound;
    if (c) left[c] = Math.max(0, left[c] - 1);
  }
  return left;
}

const AI_ORDER: Partial<Record<SessionKind, Compound[]>> = {
  fp1: ['hard', 'medium', 'soft'],
  fp2: ['medium', 'hard', 'soft'],
  practice: ['soft', 'medium', 'hard'],
  q1: ['soft', 'medium', 'hard'],
  q2: ['soft', 'medium', 'hard'],
  qualifying: ['soft', 'medium', 'hard'],
};

function pickTyre(
  left: Record<Compound, number>,
  wanted: Compound | undefined,
  kind: SessionKind,
  grip: Grip = 'dry',
): Compound {
  if (wanted && left[wanted] > 0) return wanted;
  const dryOrder = AI_ORDER[kind] ?? ['medium', 'hard', 'soft'];
  const order: Compound[] = grip === 'dry' ? [...dryOrder, 'wet'] : ['wet', ...dryOrder];
  return order.find((c) => left[c] > 0) ?? wanted ?? order[0]!;
}

export function sessionsOf(s: GameState, round: Round): SessionKind[] {
  return WEEKEND_FORMAT[tierOf(s, round)].sessions;
}
export function weatherOf(s: GameState, round: Round): SessionWeather[] {
  return weekendWeather(s, round, sessionsOf(s, round));
}
const condOf = (s: GameState, round: Round, kind: SessionKind) =>
  conditionsFor(weatherOf(s, round).find((w) => w.kind === kind));
export function nextSession(s: GameState, round: Round): SessionKind | null {
  return sessionsOf(s, round)[round.stage ?? 0] ?? null;
}

function store(
  s: GameState,
  ids: IdFactory,
  round: Round,
  kind: SessionKind,
  rowsOut: ResultRow[],
  extra: Partial<Pick<SessionResult, 'fastestLap'>> = {},
) {
  const season = s.tables.seasons[round.seasonId]!;
  const id = ids.next('res') as SessionResultId;
  s.tables.sessionResults[id] = {
    id,
    roundId: round.id,
    seasonId: season.id,
    categoryId: season.categoryId,
    kind,
    day: s.meta.currentDay,
    rows: rowsOut,
    ...extra,
  };
}
const resultOf = (s: GameState, round: Round, kind: SessionKind) =>
  rows(s, 'sessionResults').find((x) => x.roundId === round.id && x.kind === kind);

/** Sessione a tempo (prove, Q1, Q2, qualifica unica): vale il giro migliore. */
function timedSession(
  s: GameState,
  ids: IdFactory,
  round: Round,
  kind: SessionKind,
  list: Entrant[],
  strategies: Record<string, Strategy>,
): ResultRow[] {
  const cond = condOf(s, round, kind);
  const tyre = new Map(
    list.map((e) => [
      e.rider.id,
      pickTyre(tyresLeft(s, round, e.rider.id), strategies[e.rider.id]?.compound, kind, cond.grip),
    ]),
  );
  const q = runQualifying(
    `${s.meta.seed}::${round.id}::${kind}`,
    refLapOf(s, round),
    list.map((e) => toRaceRider(s, e, { compound: tyre.get(e.rider.id)!, mode: 'normal' })),
    cond,
  );
  const out = q.map((x) => {
    const e = list.find((y) => y.rider.id === x.riderId)!;
    return {
      riderId: e.rider.id,
      teamId: e.teamId,
      manufacturerId: e.manufacturerId,
      position: x.position,
      status: 'finished',
      time: x.best,
      gap: Math.round((x.best - q[0]!.best) * 1000) / 1000,
      bestLap: x.best,
      points: 0,
      compound: tyre.get(e.rider.id)!,
    } satisfies ResultRow;
  });
  store(s, ids, round, kind, out);
  return out;
}

function qualifyingSessions(
  s: GameState,
  ids: IdFactory,
  round: Round,
  kind: SessionKind,
  strategies: Record<string, Strategy>,
): void {
  const list = entrants(s, round);
  const fmt = WEEKEND_FORMAT[tierOf(s, round)];
  const byId = (id: string) => list.find((e) => e.rider.id === id)!;
  if (kind === 'qualifying') {
    timedSession(s, ids, round, 'qualifying', list, strategies);
    round.status = 'qualified';
    return;
  }
  const practice = resultOf(s, round, 'practice');
  const direct = new Set((practice?.rows ?? []).slice(0, fmt.toQ2).map((r) => r.riderId));
  if (kind === 'q1') {
    timedSession(
      s,
      ids,
      round,
      'q1',
      list.filter((e) => !direct.has(e.rider.id)),
      strategies,
    );
    return;
  }
  // Q2 e griglia ufficiale.
  const q1 = resultOf(s, round, 'q1')?.rows ?? [];
  const promoted = q1.slice(0, fmt.fromQ1).map((r) => r.riderId);
  const q2 = timedSession(s, ids, round, 'q2', [...direct, ...promoted].map(byId), strategies);
  const rest = q1.slice(fmt.fromQ1);
  const pole = q2[0]?.time ?? 0;
  const grid: ResultRow[] = [...q2, ...rest].map((r, i) => ({
    ...r,
    position: i + 1,
    gap: r.time !== null ? Math.round((r.time - pole) * 1000) / 1000 : null,
  }));
  store(s, ids, round, 'qualifying', grid);
  round.status = 'qualified';
}

export interface ReplayData {
  roundId: string;
  /** 'sprint' o 'race'. */
  kind: 'sprint' | 'race';
  categoryName: string;
  circuit: string;
  /** Codice del paese del circuito (ambiente: deserto, verde, tropicale…). */
  country: string;
  laps: number;
  lengthM: number;
  /** Tracciato: punti normalizzati e indici dei due confini di settore (S1|S2|S3). */
  track: { points: [number, number][]; sectors: [number, number] };
  /** Meteo della sessione. */
  weather: { sky: string; grip: string; airTemp: number; trackTemp: number };
  riders: {
    id: string;
    name: string;
    nationality: string;
    short: string;
    number: number;
    team: string;
    color: string;
    color2: string;
    mine: boolean;
  }[];
  frames: number[][];
  frameEvery: number;
  events: RaceOutcome['events'];
  results: RaceOutcome['results'];
}

/** Sprint o gara. Restituisce i dati per rivederla se è la gara del giocatore. */
function raceSession(
  s: GameState,
  ids: IdFactory,
  rng: Rng,
  round: Round,
  kind: 'sprint' | 'race',
  playerStrategies: Record<string, Strategy>,
): ReplayData | null {
  const cal = new GameCalendar(s.meta.startYear);
  const playerTeam = s.meta.playerTeamId;
  const season = s.tables.seasons[round.seasonId]!;
  const cat = s.tables.categories[season.categoryId]!;
  const reg = s.tables.regulations[season.regulationId]!;
  const quali = resultOf(s, round, 'qualifying')!;
  const list = entrants(s, round);
  const gridOrder = quali.rows
    .map((r) => list.find((e) => e.rider.id === r.riderId))
    .filter((e): e is Entrant => !!e);
  const fmt = RACE_FORMAT[cat.tier];
  const laps = kind === 'sprint' ? sprintLaps(fmt.laps) : fmt.laps;
  const used = new Map<string, Compound>();
  const cond = condOf(s, round, kind);
  const grid = gridOrder.map((e) => {
    const left = tyresLeft(s, round, e.rider.id);
    const mine = playerStrategies[e.rider.id];
    const st: Strategy = mine
      ? { mode: mine.mode, compound: pickTyre(left, mine.compound, kind, cond.grip) }
      : aiStrategy(e.rider, rng, laps, left, cond);
    used.set(e.rider.id, st.compound);
    return toRaceRider(s, e, st);
  });
  const circuit = s.tables.circuits[round.circuitId]!;
  const track = trackFor(s, round);
  const isPlayers = gridOrder.some((e) => e.teamId === playerTeam);
  const out = runRace({
    seed: `${s.meta.seed}::${round.id}::${kind}`,
    track,
    lengthM: circuit.lengthM,
    laps,
    refLap: refLapOf(s, round),
    grid,
    frameEvery: isPlayers ? 0.5 : 1000,
    conditions: cond,
  });
  const table = kind === 'sprint' ? SPRINT_POINTS : reg.points;
  const rowsOut: ResultRow[] = out.results.map((r) => {
    const e = gridOrder.find((x) => x.rider.id === r.riderId)!;
    return {
      riderId: e.rider.id,
      teamId: e.teamId,
      manufacturerId: e.manufacturerId,
      position: r.position,
      status: r.status,
      time: r.time,
      gap: r.gap,
      bestLap: r.bestLap,
      points: r.position !== null ? (table[r.position - 1] ?? 0) : 0,
      compound: used.get(e.rider.id)!,
      ...(r.reason ? { reason: r.reason } : {}),
    };
  });
  store(
    s,
    ids,
    round,
    kind,
    rowsOut,
    out.fastestLap.riderId
      ? {
          fastestLap: {
            riderId: out.fastestLap.riderId as RiderId,
            time: Math.round(out.fastestLap.time * 1000) / 1000,
          },
        }
      : {},
  );
  if (kind === 'race') round.status = 'raced';

  // Soldi: premi per punti (Sprint e gara); diritti commerciali e trasferta una volta per weekend (gara).
  const teamsHere = [...new Set(gridOrder.map((e) => e.teamId))];
  for (const t of teamsHere) {
    if (!s.accounts.some((a) => a.teamId === t)) continue;
    const pts = rowsOut.filter((x) => x.teamId === t).reduce((sum, x) => sum + x.points, 0);
    const label = kind === 'sprint' ? 'Sprint' : 'gara';
    const entries: [number, 'commercialRights' | 'prizeMoney' | 'travel', string][] = [
      [pts * PRIZE_PER_POINT[cat.tier], 'prizeMoney', `Premi ${label} (${pts} punti) · ${circuit.name}`],
    ];
    if (kind === 'race')
      entries.push(
        [RACE_FEE[cat.tier], 'commercialRights', `Diritti commerciali · ${circuit.name}`],
        [-TRAVEL_COST[cat.tier], 'travel', `Trasferta e logistica · ${circuit.name}`],
      );
    for (const [amount, category, note] of entries) {
      if (amount === 0) continue;
      const tid = ids.next('trx');
      s.tables.transactions[tid] = { id: tid, teamId: t, day: s.meta.currentDay, amount, category, note };
    }
  }

  // Notizie.
  const winner = rowsOut[0];
  if (winner?.position === 1) {
    const w = s.tables.riders[winner.riderId]!;
    addNews(s, ids, {
      day: s.meta.currentDay,
      tag: 'gara',
      mine: winner.teamId === playerTeam,
      title:
        kind === 'sprint'
          ? `${cat.name} · ${circuit.name}: ${w.firstName} ${w.lastName} vince la Sprint`
          : `${cat.name} · ${circuit.name}: vince ${w.firstName} ${w.lastName}`,
      body: `${w.firstName} ${w.lastName} (${s.tables.teams[winner.teamId]!.name}) vince ${kind === 'sprint' ? 'la gara Sprint' : 'il Gran Premio'}. ${rowsOut.filter((x) => x.status === 'dnf').length} ritirati.`,
    });
  }
  let replay: ReplayData | null = null;
  if (isPlayers) {
    if (kind === 'race') {
      const text = rowsOut
        .filter((x) => x.teamId === playerTeam)
        .map((x) => {
          const r = s.tables.riders[x.riderId]!;
          return `${r.firstName} ${r.lastName} ${x.position ? `${x.position}° (${x.points} punti)` : x.reason === 'mechanical' ? 'ritirato per guasto' : 'caduto'}`;
        })
        .join(', ');
      if (text)
        addNews(s, ids, {
          day: s.meta.currentDay,
          tag: 'gara',
          mine: true,
          title: `I nostri piloti a ${circuit.name}`,
          body: text + '.',
        });
    }
    replay = {
      roundId: round.id,
      kind,
      categoryName: cat.name,
      circuit: circuit.name,
      laps,
      lengthM: circuit.lengthM,
      country: circuit.country,
      track: { points: track.points, sectors: track.sectors },
      weather: (() => {
        const w = weatherOf(s, round).find((x) => x.kind === kind);
        return w
          ? { sky: w.sky, grip: w.grip, airTemp: w.airTemp, trackTemp: w.trackTemp }
          : { sky: 'sun', grip: 'dry', airTemp: 22, trackTemp: 35 };
      })(),
      riders: gridOrder.map((e) => {
        const t = s.tables.teams[e.teamId]!;
        return {
          id: e.rider.id,
          name: `${e.rider.firstName} ${e.rider.lastName}`,
          nationality: e.rider.nationality,
          short: e.rider.lastName.slice(0, 3).toUpperCase(),
          number: e.number,
          team: t.name,
          color: t.colors.primary,
          color2: t.colors.secondary,
          mine: e.teamId === playerTeam,
        };
      }),
      frames: out.frames,
      frameEvery: out.frameEvery,
      events: out.events,
      results: out.results,
    };
  }
  // Ultimo round della stagione: stagione conclusa, campioni e premi sponsor.
  if (kind === 'race') {
    const last = Math.max(...season.roundIds.map((rid) => s.tables.rounds[rid]!.startDay));
    if (round.startDay === last) {
      season.status = 'finished';
      settleDeals(
        s,
        ids,
        season.id,
        standings(s, season.id).teams.map((t) => t.teamId),
      );
      const champ = standings(s, season.id).riders[0];
      if (champ) {
        const r = s.tables.riders[champ.riderId as RiderId]!;
        addNews(s, ids, {
          day: s.meta.currentDay,
          tag: 'campionato',
          mine: champ.teamId === playerTeam,
          title: `${r.firstName} ${r.lastName} campione ${cat.name} ${cal.toDate(s.meta.currentDay).year}`,
          body: `Titolo conquistato con ${champ.points} punti e ${champ.wins} vittorie.`,
        });
      }
    }
  }
  return replay;
}

/** Disputa la prossima sessione di un round. Restituisce i dati di replay se era una Sprint/gara del giocatore. */
export function runNextSession(
  s: GameState,
  ids: IdFactory,
  rng: Rng,
  round: Round,
  strategies: Record<string, Strategy>,
): ReplayData | null {
  const kind = nextSession(s, round);
  if (!kind) return null;
  let replay: ReplayData | null = null;
  if (kind === 'fp1' || kind === 'fp2' || kind === 'practice')
    timedSession(s, ids, round, kind, entrants(s, round), strategies);
  else if (kind === 'q1' || kind === 'q2' || kind === 'qualifying')
    qualifyingSessions(s, ids, round, kind, strategies);
  else replay = raceSession(s, ids, rng, round, kind, strategies);
  round.stage = (round.stage ?? 0) + 1;
  return replay;
}

/** Disputa tutte le sessioni rimaste di un round; restituisce l'ultimo replay (la gara). */
export function runRestOfWeekend(
  s: GameState,
  ids: IdFactory,
  rng: Rng,
  round: Round,
  strategies: Record<string, Strategy>,
): ReplayData | null {
  let replay: ReplayData | null = null;
  while (nextSession(s, round)) replay = runNextSession(s, ids, rng, round, strategies) ?? replay;
  return replay;
}

/** Le altre categorie del giorno completano il loro weekend (quando il giocatore ha finito il suo). */
export function finishOtherRounds(s: GameState, ids: IdFactory, rng: Rng): void {
  const mine = playerRoundToday(s)?.id;
  for (const r of roundsToday(s)) if (r.id !== mine) runRestOfWeekend(s, ids, rng, r, {});
}

// ---------------------------------------------------------------------------------------------
export interface StandingsView {
  riders: {
    riderId: string;
    name: string;
    nationality: string;
    teamId: string;
    team: string;
    color: string;
    points: number;
    wins: number;
    podiums: number;
    poles: number;
    fastestLaps: number;
  }[];
  teams: { teamId: string; team: string; color: string; points: number; wins: number }[];
  constructors: { manufacturerId: string; name: string; points: number; wins: number }[];
  racesDone: number;
}

export function standings(s: GameState, seasonId: string): StandingsView {
  const races = rows(s, 'sessionResults').filter(
    (x) => x.seasonId === seasonId && (x.kind === 'race' || x.kind === 'sprint'),
  );
  const rmap = new Map<string, StandingsView['riders'][number]>();
  const tmap = new Map<string, StandingsView['teams'][number]>();
  const mmap = new Map<string, StandingsView['constructors'][number]>();
  for (const race of races) {
    const bestByMfr = new Map<string, number>();
    for (const row of race.rows) {
      const r = s.tables.riders[row.riderId]!;
      const t = s.tables.teams[row.teamId]!;
      const re = rmap.get(row.riderId) ?? {
        riderId: row.riderId,
        name: `${r.firstName} ${r.lastName}`,
        nationality: r.nationality,
        teamId: row.teamId,
        team: t.name,
        color: t.colors.primary,
        points: 0,
        wins: 0,
        podiums: 0,
        poles: 0,
        fastestLaps: 0,
      };
      re.points += row.points;
      re.teamId = row.teamId;
      re.team = t.name;
      re.color = t.colors.primary;
      const gp = race.kind === 'race';
      if (gp && row.position === 1) re.wins++;
      if (gp && row.position !== null && row.position <= 3) re.podiums++;
      rmap.set(row.riderId, re);
      const te = tmap.get(row.teamId) ?? {
        teamId: row.teamId,
        team: t.name,
        color: t.colors.primary,
        points: 0,
        wins: 0,
      };
      te.points += row.points;
      if (gp && row.position === 1) te.wins++;
      tmap.set(row.teamId, te);
      if (!bestByMfr.has(row.manufacturerId) || row.points > bestByMfr.get(row.manufacturerId)!)
        bestByMfr.set(row.manufacturerId, row.points);
    }
    for (const [mid, pts] of bestByMfr) {
      const m = s.tables.manufacturers[mid as ManufacturerId]!;
      const me = mmap.get(mid) ?? { manufacturerId: mid, name: m.name, points: 0, wins: 0 };
      me.points += pts;
      if (race.kind === 'race' && race.rows[0]?.manufacturerId === mid && race.rows[0]?.position === 1)
        me.wins++;
      mmap.set(mid, me);
    }
  }
  // Pole (griglia ufficiale) e giri veloci (gara) per i piloti già in classifica.
  for (const res of rows(s, 'sessionResults').filter((x) => x.seasonId === seasonId)) {
    if (res.kind === 'qualifying') {
      const p = res.rows.find((x) => x.position === 1);
      const re = p && rmap.get(p.riderId);
      if (re) re.poles++;
    }
    if (res.kind === 'race' && res.fastestLap) {
      const re = rmap.get(res.fastestLap.riderId);
      if (re) re.fastestLaps++;
    }
  }
  const sort = <T extends { points: number; wins: number }>(xs: T[]) =>
    xs.sort((a, b) => b.points - a.points || b.wins - a.wins);
  return {
    riders: sort([...rmap.values()]),
    teams: sort([...tmap.values()]),
    constructors: sort([...mmap.values()]),
    racesDone: races.filter((r) => r.kind === 'race').length,
  };
}
