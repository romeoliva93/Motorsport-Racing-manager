/**
 * Weekend di gara a sessioni (prove, qualifiche Q1/Q2, Sprint, gara) per tutte le categorie, punti, premi e notizie.
 * La simulazione vera e propria è nel pacchetto sim; qui si traducono piloti, moto e strutture in parametri.
 */
import { setupFactor, setupMatch, turnsOf } from './setup.ts';
import {
  PRACTICE_KINDS,
  confidenceFactor,
  defaultConfidence,
  practiceRiderOf,
  practicesDone,
  recordPracticeRun,
  RUNS_PER_SESSION,
  PRACTICE_LAPS,
  SESSION_SHORT,
  debriefFor,
} from './practice.ts';
import {
  addSessionMileage,
  aiMaintenance,
  crewChiefMaintenance,
  bikeReliabilityFactor,
  fitNewEnginesIfDue,
  mainBike,
} from './garage.ts';
import { GameCalendar, type IdFactory, type Rng } from '@lean-angle/core';
import {
  PRIZE_PER_POINT,
  portraitKey,
  poolPortraitKey,
  RACE_FEE,
  TRAVEL_COST,
  rows,
  type CategoryTier,
  type GameState,
  type ManufacturerId,
  type PracticeProgram,
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
  type TimedLap,
  runRace,
  unit,
  type Compound,
  type Conditions,
  type Grip,
  type PaceMode,
  type RaceOutcome,
  type RaceRider,
  type RaceSetup,
} from '@lean-angle/sim';
import { addNews } from './news.ts';
import { conditionsFor, weekendWeather, type SessionWeather } from './weather.ts';
import { engineStatus } from './regulations.ts';
import { upgradeBonus } from './upgrades.ts';
import { supplierPerks } from './suppliers.ts';
import { bikeBase, longRunFactor, trackBonus } from './preseasonEffects.ts';
import { settleDeals } from './sponsors.ts';

export interface Strategy {
  compound: Compound;
  mode: PaceMode;
  /** Programma di lavoro nelle prove libere (solo giocatore). */
  program?: PracticeProgram;
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

/**
 * Dopo ogni gara: forma (−10…+10) e morale (0–100) dei piloti in base al risultato rispetto alla posizione di
 * partenza. La forma vale in pista (±1% di ritmo a ±10); il morale si vede nelle schede e torna lentamente
 * verso 60 se non succede nulla.
 */
export function updateFormAndMorale(s: GameState, grid: Rider[], rowsOut: ResultRow[]) {
  grid.forEach((r, start) => {
    const row = rowsOut.find((x) => x.riderId === r.id);
    if (!row) return;
    const rider = s.tables.riders[r.id]!;
    const gained = row.position !== null ? start + 1 - row.position : -6;
    const delta = Math.max(-5, Math.min(5, gained / 2));
    rider.form = Math.round(Math.max(-10, Math.min(10, (rider.form ?? 0) * 0.6 + delta)));
    const m =
      row.position === null
        ? row.reason === 'mechanical'
          ? -2
          : -4
        : row.position === 1
          ? 8
          : row.position <= 3
            ? 5
            : row.points > 0
              ? 1 + Math.sign(gained)
              : -1 + Math.sign(gained);
    rider.morale = Math.round(Math.max(0, Math.min(100, rider.morale + m + (60 - rider.morale) * 0.05)));
  });
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
  // Forma recente: ±1% di ritmo agli estremi (−10…+10).
  return unit(v) * (1 + (r.form ?? 0) * 0.001);
}

export function bikeOf(
  s: GameState,
  teamId: TeamId,
  manufacturerId: ManufacturerId,
  riderId?: string,
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
  const up = upgradeBonus(s, teamId, riderId);
  // Accordo di fornitura del costruttore (solo squadre clienti).
  const deal = supplierPerks(s, teamId, manufacturerId);
  return {
    bike: Math.min(1, score / 100 + up.bike + deal.bike),
    reliability: Math.min(0.995, (m.engineeringStrength + 8) / 100 + up.reliability + deal.reliability),
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

function toRaceRider(s: GameState, e: Entrant, strat: Strategy, round?: Round, wet = false): RaceRider {
  const a = e.rider.attributes;
  const { bike, reliability } = bikeOf(s, e.teamId, e.manufacturerId, e.rider.id);
  const mine = e.teamId === s.meta.playerTeamId;
  const match = round ? setupMatch(s, e.rider, tierOf(s, round), turnsOf(s, round), wet, mine) : 0.75;
  // Confidenza col circuito e con la moto costruita nelle prove (±1% di ritmo); passo gara = gomme gestite meglio.
  const pr = round && mine ? practiceRiderOf(s, round.id, e.rider.id) : null;
  const conf = pr
    ? pr
    : round
      ? defaultConfidence(
          e.rider,
          practicesDone(sessionsOf(s, round), round.stage ?? 0),
          match * 100,
          // Confidenza di partenza con la moto: dai test pre-stagionali (le IA li fanno sempre).
          bikeBase(s, e.rider.id, mine),
          trackBonus(s, e.rider.id, mine),
        )
      : null;
  return {
    id: e.rider.id,
    // Assetto: intesa fra le regolazioni scelte e quelle ideali per pilota e circuito (±1,5% di ritmo).
    skill:
      riderSkill(e.rider) *
      (round ? setupFactor(match) : 1) *
      (conf ? confidenceFactor(conf.trackConf, conf.bikeConf) : 1),
    overtaking: unit(a.overtaking),
    defending: unit(a.defending),
    consistency: unit(a.consistency),
    concentration: unit(a.concentration),
    aggression: unit(a.aggression),
    tyreManagement: Math.min(
      1,
      (unit(a.tyreManagement) +
        upgradeBonus(s, e.teamId, e.rider.id).tyreCare +
        supplierPerks(s, e.teamId, e.manufacturerId).tyreCare) *
        (pr?.longRun ? 1.04 : 1) *
        longRunFactor(s, e.rider.id, mine),
    ),
    fitness: unit(a.fitness),
    fuelManagement: unit(a.fuelManagement),
    bike,
    // affidabilità di base (costruttore + upgrade) × stato dei componenti della moto A (garage)
    reliability: reliability * bikeReliabilityFactor(mainBike(s, e.rider.id)),
    compound: strat.compound,
    mode: strat.mode,
  };
}

export const tierOf = (s: GameState, round: Round): CategoryTier =>
  s.tables.categories[s.tables.seasons[round.seasonId]!.categoryId]!.tier;
const refLapOf = (s: GameState, round: Round) => {
  const c = s.tables.circuits[round.circuitId]!;
  return c.lengthM / RACE_FORMAT[tierOf(s, round)].avgSpeed;
};

/**
 * Formato del weekend per categoria (sul modello del mondiale reale, in un unico giorno di gioco):
 *   MotoGP:        Prove libere 1 · Prove (i primi 10 vanno in Q2) · Prove libere 2 · Q1 (i primi 2 salgono in Q2)
 *                  · Q2 (griglia 1–12) · Sprint (metà giri, punti ai primi 9) · Warm Up (domenica mattina) · Gara
 *   Moto2 / Moto3: Prove libere 1 · Prove (primi 14 in Q2) · Q1 (primi 4 in Q2) · Q2 (griglia 1–18) · Gara
 *   Rookies Cup:   Prove libere 1 · Qualifica unica · Gara
 */
export const WEEKEND_FORMAT: Record<CategoryTier, { sessions: SessionKind[]; toQ2: number; fromQ1: number }> =
  {
    premier: {
      sessions: ['fp1', 'practice', 'fp2', 'q1', 'q2', 'sprint', 'warmup', 'race'],
      toQ2: 10,
      fromQ1: 2,
    },
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
  warmup: ['medium', 'hard', 'soft'],
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
  sink?: { timing?: SessionTiming },
): ResultRow[] {
  const cond = condOf(s, round, kind);
  const sectors = timingSectors(trackFor(s, round));
  const length = SESSION_LENGTH[kind] ?? 1800;
  const tyre = new Map(
    list.map((e) => [
      e.rider.id,
      pickTyre(tyresLeft(s, round, e.rider.id), strategies[e.rider.id]?.compound, kind, cond.grip),
    ]),
  );
  const q = runQualifying(
    `${s.meta.seed}::${round.id}::${kind}`,
    refLapOf(s, round),
    list.map((e) =>
      toRaceRider(s, e, { compound: tyre.get(e.rider.id)!, mode: 'normal' }, round, cond.grip !== 'dry'),
    ),
    cond,
    { sectors, length },
  );
  // Sessione del weekend del giocatore (anche se i suoi piloti non corrono): dati per la schermata tempi.
  if (sink) {
    const circuit = s.tables.circuits[round.circuitId]!;
    const fmt = WEEKEND_FORMAT[tierOf(s, round)];
    sink.timing = {
      roundId: round.id,
      kind,
      circuit: circuit.name,
      lengthM: circuit.lengthM,
      length: Math.max(
        length,
        ...q.flatMap((x) => x.laps.map((l) => l.start + l.seg.reduce((a, b) => a + b, 0) + 20)),
      ),
      sectors,
      q2Cut: kind === 'practice' ? fmt.toQ2 : 0,
      riders: q.map((x) => {
        const e = list.find((y) => y.rider.id === x.riderId)!;
        return { ...timingRider(s, e, tyre.get(e.rider.id)!), laps: x.laps };
      }),
    };
  }
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
  // Prove del giocatore: giri, confidenza e cronologia per il briefing.
  if ((PRACTICE_KINDS as readonly string[]).includes(kind))
    for (const e of list)
      if (e.teamId === s.meta.playerTeamId) {
        const wet = cond.grip !== 'dry';
        const m = setupMatch(s, e.rider, tierOf(s, round), turnsOf(s, round), wet, true);
        const row = out.find((x) => x.riderId === e.rider.id);
        recordPracticeRun(
          s,
          round,
          kind,
          e.rider,
          strategies[e.rider.id]?.program ?? 'track',
          wet,
          m * 100,
          row?.bestLap ?? null,
        );
      }
  return out;
}

/**
 * Un'uscita della sessione di prove del giocatore (o della giornata di test): tutti i piloti girano per una
 * parte della sessione; i piloti del giocatore poi rientrano ai box (rapporto in `s.stint.debrief`). All'ultima
 * uscita la sessione si chiude: vale il miglior giro di tutte le uscite.
 */
export function runStint(
  s: GameState,
  ids: IdFactory,
  round: Round,
  kind: SessionKind | 'test',
  strategies: Record<string, Strategy>,
  opts: { testId?: string; programs?: Record<string, string> } = {},
): {
  timing: SessionTiming;
  finished: boolean;
  rows: { riderId: string; best: number }[];
  programs: Record<string, string>;
} {
  const isTest = kind === 'test';
  const list = entrants(s, round);
  const cond = isTest ? conditionsFor(undefined) : condOf(s, round, kind);
  const wet = cond.grip !== 'dry';
  const runs = RUNS_PER_SESSION[kind] ?? 3;
  let st = s.stint;
  if (!st || st.roundId !== round.id || st.kind !== kind || st.testId !== opts.testId) {
    if (!isTest) beforeSession(s, ids, round);
    const programs = opts.programs ?? {};
    st = s.stint = {
      roundId: round.id,
      kind,
      ...(opts.testId ? { testId: opts.testId } : {}),
      done: 0,
      runs,
      best: {},
      tyre: Object.fromEntries(
        list.map((e) => [
          e.rider.id,
          isTest
            ? programs[e.rider.id] === 'longRun'
              ? 'hard'
              : 'medium'
            : pickTyre(tyresLeft(s, round, e.rider.id), strategies[e.rider.id]?.compound, kind, cond.grip),
        ]),
      ),
      programs: Object.fromEntries(
        list
          .filter((e) => e.teamId === s.meta.playerTeamId)
          .map((e) => [e.rider.id, programs[e.rider.id] ?? strategies[e.rider.id]?.program ?? 'track']),
      ),
      debrief: {},
    };
  }
  // Il programma si può cambiare a ogni uscita (prove del weekend).
  if (!isTest)
    for (const [id, x] of Object.entries(strategies))
      if (x.program && id in st.programs) st.programs[id] = x.program;
  const n = st.done + 1;
  const sectors = timingSectors(trackFor(s, round));
  const total = isTest ? 3600 : (SESSION_LENGTH[kind as SessionKind] ?? 1800);
  const runLen = total / runs;
  const tag = isTest ? `test::${opts.testId}` : kind;
  const tyre = (id: string) => st.tyre[id] as Compound;
  const q = runQualifying(
    `${s.meta.seed}::${round.id}::${tag}::run${n}`,
    refLapOf(s, round),
    list.map((e) => toRaceRider(s, e, { compound: tyre(e.rider.id), mode: 'normal' }, round, wet)),
    cond,
    { sectors, length: runLen },
  );
  for (const x of q) st.best[x.riderId] = Math.min(st.best[x.riderId] ?? Infinity, x.best);
  const order = Object.entries(st.best).sort((a, b) => a[1] - b[1]);
  const tier = tierOf(s, round);
  const turns = turnsOf(s, round);
  st.debrief = {};
  for (const e of list) {
    if (e.teamId !== s.meta.playerTeamId) continue;
    const runBest = q.find((x) => x.riderId === e.rider.id)?.best ?? null;
    if (!isTest) {
      const m = setupMatch(s, e.rider, tier, turns, wet, true);
      recordPracticeRun(
        s,
        round,
        kind,
        e.rider,
        (st.programs[e.rider.id] ?? 'track') as 'track' | 'setup' | 'longRun',
        wet,
        m * 100,
        runBest,
        {
          laps: Math.round((PRACTICE_LAPS[kind] ?? 12) / runs),
          label: `${SESSION_SHORT[kind] ?? kind} · uscita ${n}`,
        },
      );
    }
    if (n < runs)
      st.debrief[e.rider.id] = debriefFor(s, e.rider, tier, turns, wet, {
        run: n,
        runs,
        best: st.best[e.rider.id] ?? null,
        position: order.findIndex(([id]) => id === e.rider.id) + 1,
        laps: 0,
        tag: `${round.id}:${tag}:${n}`,
      });
  }
  const circuit = s.tables.circuits[round.circuitId]!;
  const fmt = WEEKEND_FORMAT[tier];
  const timing: SessionTiming = {
    roundId: round.id,
    kind,
    circuit: circuit.name,
    lengthM: circuit.lengthM,
    length: Math.max(
      runLen,
      ...q.flatMap((x) => x.laps.map((l) => l.start + l.seg.reduce((a, b) => a + b, 0) + 20)),
    ),
    sectors,
    q2Cut: kind === 'practice' && n === runs ? fmt.toQ2 : 0,
    run: { n, of: runs },
    riders: q.map((x) => {
      const e = list.find((y) => y.rider.id === x.riderId)!;
      return { ...timingRider(s, e, tyre(e.rider.id)), laps: x.laps };
    }),
  };
  st.done = n;
  const rowsBest = order.map(([riderId, best]) => ({ riderId, best }));
  const programs = { ...st.programs };
  if (n < runs) return { timing, finished: false, rows: rowsBest, programs };
  // Fine della sessione.
  s.stint = undefined;
  if (!isTest) {
    const lead = order[0]?.[1] ?? 0;
    const out = order.map(([riderId, best], i) => {
      const e = list.find((y) => y.rider.id === riderId)!;
      return {
        riderId: e.rider.id,
        teamId: e.teamId,
        manufacturerId: e.manufacturerId,
        position: i + 1,
        status: 'finished',
        time: best,
        gap: Math.round((best - lead) * 1000) / 1000,
        bestLap: best,
        points: 0,
        compound: tyre(riderId),
      } satisfies ResultRow;
    });
    store(s, ids, round, kind as SessionKind, out);
    afterSession(s, round, kind as SessionKind);
  }
  return { timing, finished: true, rows: rowsBest, programs };
}

function qualifyingSessions(
  s: GameState,
  ids: IdFactory,
  round: Round,
  kind: SessionKind,
  strategies: Record<string, Strategy>,
  sink?: { timing?: SessionTiming },
): void {
  const list = entrants(s, round);
  const fmt = WEEKEND_FORMAT[tierOf(s, round)];
  const byId = (id: string) => list.find((e) => e.rider.id === id)!;
  if (kind === 'qualifying') {
    timedSession(s, ids, round, 'qualifying', list, strategies, sink);
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
      sink,
    );
    return;
  }
  // Q2 e griglia ufficiale.
  const q1 = resultOf(s, round, 'q1')?.rows ?? [];
  const promoted = q1.slice(0, fmt.fromQ1).map((r) => r.riderId);
  const q2 = timedSession(s, ids, round, 'q2', [...direct, ...promoted].map(byId), strategies, sink);
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

/** Gara preparata (serializzabile): impostazione della simulazione e dati per chiuderla. */
export interface RacePrep {
  roundId: string;
  kind: 'sprint' | 'race';
  setup: RaceSetup;
  grid: string[];
  used: Record<string, Compound>;
  pitStarters: string[];
  meta: ReplayData | null;
}

/** Carburante a inizio gara (litri) per categoria. */
export const FUEL_CAPACITY: Record<CategoryTier, number> = {
  premier: 22,
  intermediate: 24,
  lightweight: 11,
  rookies: 11,
};

export interface ReplayData {
  roundId: string;
  /** 'sprint' o 'race'. */
  kind: 'sprint' | 'race';
  categoryName: string;
  /** Categoria tecnica: decide il modello di moto nella vista 3D. */
  tier: CategoryTier;
  circuit: string;
  /** Codice del paese del circuito (ambiente: deserto, verde, tropicale…). */
  country: string;
  laps: number;
  lengthM: number;
  /** Tracciato: punti normalizzati e indici dei due confini di settore (S1|S2|S3). */
  track: { points: [number, number][]; sectors: [number, number]; longLap: number };
  /** Settori di cronometraggio (fine di S1, S2, S3) per la schermata tempi. */
  timingSectors: [number, number, number];
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
    firstName: string;
    lastName: string;
    /** Costruttore della moto. */
    bike: string;
    /** Ritratto (chiave e volto di riserva). */
    portrait: { key: string; pool: string };
    /** Strategia e moto: gomma, ritmo, affidabilità (0–100), giri per giro tempi e usura gomma. */
    compound: string;
    mode: string;
    reliability: number;
    lapTimes: number[];
    wear: number[];
  }[];
  /** Carburante a inizio gara (litri) per categoria. */
  fuelCapacity: number;
  frames: number[][];
  frameEvery: number;
  events: RaceOutcome['events'];
  results: RaceOutcome['results'];
}

/** Settori di cronometraggio (frazioni del giro): i due confini del tracciato e la metà dell'ultimo tratto. */
export function timingSectors(track: {
  points: unknown[];
  sectors: [number, number];
}): [number, number, number] {
  const n = track.points.length;
  const a = track.sectors[0] / n,
    b = track.sectors[1] / n;
  return [a, b, (b + 1) / 2];
}

/** Pilota nella schermata tempi. */
export interface TimingRider {
  id: string;
  firstName: string;
  lastName: string;
  nationality: string;
  number: number;
  team: string;
  color: string;
  color2: string;
  mine: boolean;
  bike: string;
  compound: string;
}

/** Sessione a tempo (prove, qualifiche, Warm Up) per la schermata tempi: giri e settori di ogni pilota. */
export interface SessionTiming {
  roundId: string;
  kind: SessionKind | 'test';
  circuit: string;
  lengthM: number;
  /** Durata della sessione (s). */
  length: number;
  sectors: [number, number, number];
  /** Prove del venerdì: i primi N vanno direttamente in Q2 (0 = nessuno). */
  q2Cut: number;
  /** Sessione a uscite: numero dell'uscita mostrata e totale. */
  run?: { n: number; of: number };
  riders: (TimingRider & { laps: TimedLap[] })[];
}

const SESSION_LENGTH: Partial<Record<SessionKind, number>> = {
  fp1: 2700,
  fp2: 2700,
  practice: 3600,
  q1: 900,
  q2: 900,
  qualifying: 1200,
  warmup: 600,
};

function timingRider(s: GameState, e: Entrant, compound: string): TimingRider {
  const t = s.tables.teams[e.teamId]!;
  return {
    id: e.rider.id,
    firstName: e.rider.firstName,
    lastName: e.rider.lastName,
    nationality: e.rider.nationality,
    number: e.number,
    team: t.name,
    color: t.colors.primary,
    color2: t.colors.secondary,
    mine: e.teamId === s.meta.playerTeamId,
    bike: s.tables.manufacturers[e.manufacturerId]?.name ?? '',
    compound,
  };
}

/** Sprint o gara. Restituisce i dati per rivederla se è la gara del giocatore. */
/**
 * Preparazione di Sprint o gara (serializzabile: si può salvare con la gara in corso): griglia dalle qualifiche,
 * strategie (giocatore o IA), gomme, partenza dalla corsia box, impostazione della simulazione e dati per la vista.
 * `live` = gara seguita dal giocatore: i suoi piloti hanno strategia manuale (l'IA non la cambia).
 */
export function prepareRace(
  s: GameState,
  rng: Rng,
  round: Round,
  kind: 'sprint' | 'race',
  playerStrategies: Record<string, Strategy>,
  live = false,
): RacePrep {
  const cal = new GameCalendar(s.meta.startYear);
  const playerTeam = s.meta.playerTeamId;
  const season = s.tables.seasons[round.seasonId]!;
  const cat = s.tables.categories[season.categoryId]!;
  const quali = resultOf(s, round, 'qualifying')!;
  const list = entrants(s, round);
  const gridOrder = quali.rows
    .map((r) => list.find((e) => e.rider.id === r.riderId))
    .filter((e): e is Entrant => !!e);
  const fmt = RACE_FORMAT[cat.tier];
  const laps = kind === 'sprint' ? sprintLaps(fmt.laps) : fmt.laps;
  const used = new Map<string, Compound>();
  const pitStarters: Entrant[] = [];
  const cond = condOf(s, round, kind);
  const grid = gridOrder.map((e) => {
    const left = tyresLeft(s, round, e.rider.id);
    const mine = playerStrategies[e.rider.id];
    const st: Strategy = mine
      ? { mode: mine.mode, compound: pickTyre(left, mine.compound, kind, cond.grip) }
      : aiStrategy(e.rider, rng, laps, left, cond);
    used.set(e.rider.id, st.compound);
    const rr = toRaceRider(s, e, st, round, cond.grip !== 'dry');
    if (live && e.teamId === playerTeam) rr.manual = true;
    // Troppi motori usati (solo MotoGP): partenza dalla corsia box.
    if (cat.tier === 'premier' && engineStatus(s, e.rider.id, season.id, e.teamId).overLimit) {
      rr.pitLaneStart = true;
      pitStarters.push(e);
    }
    return rr;
  });
  const circuit = s.tables.circuits[round.circuitId]!;
  const track = trackFor(s, round);
  const isPlayers = gridOrder.some((e) => e.teamId === playerTeam);
  const capacity = FUEL_CAPACITY[cat.tier];
  const perLap = (capacity * 0.94) / fmt.laps; // a ritmo normale e mappa standard si arriva con il 6% di margine
  const setup: RaceSetup = {
    seed: `${s.meta.seed}::${round.id}::${kind}`,
    track,
    lengthM: circuit.lengthM,
    laps,
    refLap: refLapOf(s, round),
    grid,
    frameEvery: isPlayers ? 0.5 : 1000,
    conditions: cond,
    sprint: kind === 'sprint',
    fuel: { capacity, perLap, start: Math.min(capacity, perLap * laps * 1.06) },
  };
  const meta: ReplayData | null = isPlayers
    ? {
        roundId: round.id,
        kind,
        categoryName: cat.name,
        tier: cat.tier,
        circuit: circuit.name,
        laps,
        lengthM: circuit.lengthM,
        country: circuit.country,
        track: { points: track.points, sectors: track.sectors, longLap: track.longLap },
        timingSectors: timingSectors(track),
        weather: (() => {
          const w = weatherOf(s, round).find((x) => x.kind === kind);
          return w
            ? { sky: w.sky, grip: w.grip, airTemp: w.airTemp, trackTemp: w.trackTemp }
            : { sky: 'sun', grip: 'dry', airTemp: 22, trackTemp: 35 };
        })(),
        riders: gridOrder.map((e, k) => {
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
            firstName: e.rider.firstName,
            lastName: e.rider.lastName,
            bike: s.tables.manufacturers[e.manufacturerId]?.name ?? '',
            portrait: (() => {
              const key = portraitKey(e.rider);
              return { key, pool: poolPortraitKey(key, cal.ageOn(e.rider.birthDay, s.meta.currentDay)) };
            })(),
            compound: grid[k]!.compound,
            mode: grid[k]!.mode,
            reliability: Math.round(grid[k]!.reliability * 100),
            lapTimes: [],
            wear: [],
          };
        }),
        fuelCapacity: capacity,
        frames: [],
        frameEvery: setup.frameEvery!,
        events: [],
        results: [],
      }
    : null;
  return {
    roundId: round.id,
    kind,
    setup,
    grid: gridOrder.map((e) => e.rider.id),
    used: Object.fromEntries(used),
    pitStarters: pitStarters.map((e) => e.rider.id),
    meta,
  };
}

/**
 * Chiusura di Sprint o gara con il risultato della simulazione: classifica, punti, premi, notizie, forma e morale,
 * fine stagione. Restituisce i dati per rivedere la gara (solo la gara del giocatore).
 */
export function finalizeRace(
  s: GameState,
  ids: IdFactory,
  round: Round,
  prep: RacePrep,
  out: RaceOutcome,
): ReplayData | null {
  const kind = prep.kind;
  const cal = new GameCalendar(s.meta.startYear);
  const playerTeam = s.meta.playerTeamId;
  const season = s.tables.seasons[round.seasonId]!;
  const cat = s.tables.categories[season.categoryId]!;
  const reg = s.tables.regulations[season.regulationId]!;
  const list = entrants(s, round);
  const gridOrder = prep.grid
    .map((id) => list.find((e) => e.rider.id === id))
    .filter((e): e is Entrant => !!e);
  const used = new Map(Object.entries(prep.used) as [string, Compound][]);
  const pitStarters = gridOrder.filter((e) => prep.pitStarters.includes(e.rider.id));
  const circuit = s.tables.circuits[round.circuitId]!;
  const isPlayers = !!prep.meta;
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
      ...(r.penalty ? { penalty: r.penalty } : {}),
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
  if (kind === 'race') {
    round.status = 'raced';
    updateFormAndMorale(
      s,
      gridOrder.map((e) => e.rider),
      rowsOut,
    );
  }

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
  for (const e of pitStarters.filter((x) => x.teamId === playerTeam && kind === 'race'))
    addNews(s, ids, {
      day: s.meta.currentDay,
      tag: 'gara',
      mine: true,
      title: `${e.rider.firstName} ${e.rider.lastName} parte dalla corsia box`,
      body: 'Ha superato il numero di motori consentiti in stagione: il regolamento lo fa partire dopo il gruppo.',
    });
  // Notizie sulle penalità dei nostri piloti.
  for (const row of rowsOut.filter((x) => x.teamId === playerTeam && x.penalty)) {
    const p = row.penalty!;
    const r = s.tables.riders[row.riderId]!;
    const parts = [
      p.longLaps ? `${p.longLaps} Long Lap Penalty (${p.served} scontate in pista)` : '',
      p.timeAdded
        ? `${p.timeAdded.toFixed(1).replace('.', ',')} s aggiunti per Long Lap non scontate in tempo`
        : '',
      p.positionDrop ? 'una posizione persa per i limiti della pista all’ultimo giro' : '',
    ].filter(Boolean);
    addNews(s, ids, {
      day: s.meta.currentDay,
      tag: 'gara',
      mine: true,
      title: `${r.firstName} ${r.lastName} penalizzato ${kind === 'sprint' ? 'nella Sprint' : 'in gara'}`,
      body: `Direzione gara: ${parts.join('; ')}.`,
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
      ...prep.meta!,
      riders: prep.meta!.riders.map((r, k) => ({
        ...r,
        lapTimes: out.laps[k]!.times,
        wear: out.laps[k]!.wear,
      })),
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

function raceSession(
  s: GameState,
  ids: IdFactory,
  rng: Rng,
  round: Round,
  kind: 'sprint' | 'race',
  playerStrategies: Record<string, Strategy>,
): ReplayData | null {
  const prep = prepareRace(s, rng, round, kind, playerStrategies);
  return finalizeRace(s, ids, round, prep, runRace(prep.setup));
}

/** Disputa la prossima sessione di un round. Restituisce i dati di replay se era una Sprint/gara del giocatore. */
export function runNextSession(
  s: GameState,
  ids: IdFactory,
  rng: Rng,
  round: Round,
  strategies: Record<string, Strategy>,
  /** Riceve i dati della schermata tempi delle sessioni a tempo. */
  sink?: { timing?: SessionTiming },
): ReplayData | null {
  const kind = nextSession(s, round);
  if (!kind) return null;
  // Sessione a uscite già cominciata dal giocatore: le uscite rimaste si corrono di fila, senza modifiche.
  if (s.stint && s.stint.roundId === round.id && s.stint.kind === kind) {
    let res = runStint(s, ids, round, kind, strategies);
    while (!res.finished) res = runStint(s, ids, round, kind, strategies);
    if (sink) sink.timing = res.timing;
    return null;
  }
  beforeSession(s, ids, round);
  let replay: ReplayData | null = null;
  if (kind === 'fp1' || kind === 'fp2' || kind === 'practice' || kind === 'warmup')
    timedSession(s, ids, round, kind, entrants(s, round), strategies, sink);
  else if (kind === 'q1' || kind === 'q2' || kind === 'qualifying')
    qualifyingSessions(s, ids, round, kind, strategies, sink);
  else replay = raceSession(s, ids, rng, round, kind, strategies);
  afterSession(s, round, kind);
  return replay;
}

/** Prima sessione del weekend: motori nuovi se dovuti (MotoGP) e manutenzione. */
function beforeSession(s: GameState, ids: IdFactory, round: Round) {
  if (round.stage) return;
  fitNewEnginesIfDue(s, round);
  crewChiefMaintenance(s, ids, round);
  aiMaintenance(s, ids, round);
}

/** Dopo ogni sessione: chilometri al garage e avanzamento del weekend. */
function afterSession(s: GameState, round: Round, kind: SessionKind) {
  const fmtLaps = RACE_FORMAT[tierOf(s, round)].laps;
  addSessionMileage(
    s,
    round,
    kind,
    entrants(s, round).map((e) => e.rider.id),
    kind === 'race' ? fmtLaps : kind === 'sprint' ? sprintLaps(fmtLaps) : undefined,
  );
  round.stage = (round.stage ?? 0) + 1;
}

/**
 * Gara in diretta (Sprint o gara del giocatore): prepara e restituisce l'impostazione; la simulazione avanza poi a
 * passi (RaceSim) mentre il giocatore guarda e cambia strategia. `completeLiveRace` la chiude.
 */
export function startLiveRace(
  s: GameState,
  ids: IdFactory,
  rng: Rng,
  round: Round,
  strategies: Record<string, Strategy>,
): RacePrep | null {
  const kind = nextSession(s, round);
  if (kind !== 'sprint' && kind !== 'race') return null;
  beforeSession(s, ids, round);
  return prepareRace(s, rng, round, kind, strategies, true);
}

export function completeLiveRace(
  s: GameState,
  ids: IdFactory,
  round: Round,
  prep: RacePrep,
  out: RaceOutcome,
): ReplayData | null {
  const replay = finalizeRace(s, ids, round, prep, out);
  afterSession(s, round, prep.kind);
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
  /** Squadre e piloti indipendenti (non ufficiali): classifiche separate come nel mondiale. */
  independentTeams: { teamId: string; team: string; color: string; points: number; wins: number }[];
  independentRiders: StandingsView['riders'];
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
    independentTeams: sort([...tmap.values()]).filter(
      (t) => s.tables.teams[t.teamId as TeamId]!.type !== 'factory',
    ),
    independentRiders: sort([...rmap.values()]).filter(
      (r) => s.tables.teams[r.teamId as TeamId]!.type !== 'factory',
    ),
    racesDone: races.filter((r) => r.kind === 'race').length,
  };
}

// ---------------------------------------------------------------------------------------------
/** Pole, vittoria e giro più veloce di un Gran Premio. */
export interface PastResult {
  year: number;
  /** true = stagione giocata nella carriera; false = stagione prima dell'inizio della carriera (simulata). */
  played: boolean;
  pole: { riderId: string; time: number } | null;
  winner: { riderId: string; time: number | null } | null;
  fastestLap: { riderId: string; time: number } | null;
}

/**
 * Risultati di un circuito in una stagione della categoria. Le stagioni giocate usano i risultati veri; per
 * l'anno prima dell'inizio della carriera il Gran Premio viene simulato (in modo fisso) con le squadre attuali:
 * qualifica con gomma morbida e passo gara con gomma media.
 */
export function pastResult(s: GameState, round: Round, year: number): PastResult | null {
  const season = s.tables.seasons[round.seasonId]!;
  const old = rows(s, 'seasons').find((x) => x.categoryId === season.categoryId && x.year === year);
  if (old) {
    const r = old.roundIds.map((id) => s.tables.rounds[id]!).find((x) => x.circuitId === round.circuitId);
    if (!r) return null;
    const quali = resultOf(s, r, 'qualifying');
    const race = resultOf(s, r, 'race');
    if (!quali && !race) return null;
    const p = quali?.rows.find((x) => x.position === 1);
    const w = race?.rows.find((x) => x.position === 1);
    return {
      year,
      played: true,
      pole: p ? { riderId: p.riderId, time: p.bestLap ?? p.time ?? 0 } : null,
      winner: w ? { riderId: w.riderId, time: w.time ?? null } : null,
      fastestLap: race?.fastestLap ?? null,
    };
  }
  const startYear = Math.min(...rows(s, 'seasons').map((x) => x.year));
  if (year !== startYear - 1) return null;
  const list = entrants(s, { ...round, stage: 0 });
  const ref = refLapOf(s, round);
  const sim = (compound: Compound, tag: string) =>
    runQualifying(
      `${s.meta.seed}::storia::${round.circuitId}::${year}::${tag}`,
      ref,
      list.map((e) => toRaceRider(s, e, { compound, mode: 'normal' })),
      conditionsFor(undefined),
    );
  const q = sim('soft', 'q');
  const race = sim('medium', 'r');
  const laps = RACE_FORMAT[tierOf(s, round)].laps;
  return {
    year,
    played: false,
    pole: q[0] ? { riderId: q[0].riderId, time: q[0].best } : null,
    winner: race[0]
      ? { riderId: race[0].riderId, time: Math.round(race[0].best * 1.012 * laps * 1000) / 1000 }
      : null,
    fastestLap: race[0]
      ? { riderId: race[0].riderId, time: Math.round(race[0].best * 1.004 * 1000) / 1000 }
      : null,
  };
}
