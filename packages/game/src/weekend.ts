/**
 * Weekend di gara: qualifiche e gara di tutte le categorie che corrono oggi, punti, premi e notizie.
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
  type PaceMode,
  type RaceOutcome,
  type RaceRider,
} from '@lean-angle/sim';
import { addNews } from './news.ts';
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
function aiStrategy(r: Rider, rng: Rng, laps: number): Strategy {
  const mode: PaceMode =
    r.attributes.aggression > 72 && rng.chance(0.45) ? 'attack' : rng.chance(0.1) ? 'conservative' : 'normal';
  const fc = compoundForecast(unit(r.attributes.tyreManagement), mode, laps);
  const compound = (['soft', 'medium', 'hard'] as Compound[])
    .map((c) => ({ c, v: fc[c] + rng.normal(0, 1.2) }))
    .sort((a, b) => a.v - b.v)[0]!.c;
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

/** Qualifiche di tutte le categorie che corrono oggi. */
export function runQualifyingDay(s: GameState, ids: IdFactory): void {
  for (const round of roundsToday(s)) {
    if (round.status) continue;
    const season = s.tables.seasons[round.seasonId]!;
    const list = entrants(s, round);
    const q = runQualifying(
      `${s.meta.seed}::${round.id}`,
      refLapOf(s, round),
      list.map((e) => toRaceRider(s, e, { compound: 'soft', mode: 'normal' })),
    );
    const id = ids.next('res') as SessionResultId;
    s.tables.sessionResults[id] = {
      id,
      roundId: round.id,
      seasonId: season.id,
      categoryId: season.categoryId,
      kind: 'qualifying',
      day: s.meta.currentDay,
      rows: q.map((x) => {
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
        } satisfies ResultRow;
      }),
    };
    round.status = 'qualified';
  }
}

export interface ReplayData {
  roundId: string;
  categoryName: string;
  circuit: string;
  laps: number;
  lengthM: number;
  track: { points: [number, number][] };
  riders: {
    id: string;
    name: string;
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

/** Gara di tutte le categorie che corrono oggi. Restituisce i dati per rivedere la gara del giocatore. */
export function runRaceDay(
  s: GameState,
  ids: IdFactory,
  rng: Rng,
  playerStrategies: Record<string, Strategy>,
): ReplayData | null {
  const cal = new GameCalendar(s.meta.startYear);
  let replay: ReplayData | null = null;
  const playerTeam = s.meta.playerTeamId;
  for (const round of roundsToday(s)) {
    if (round.status === 'raced') continue;
    if (!round.status) runQualifyingDay(s, ids);
    const season = s.tables.seasons[round.seasonId]!;
    const cat = s.tables.categories[season.categoryId]!;
    const reg = s.tables.regulations[season.regulationId]!;
    const quali = rows(s, 'sessionResults').find((x) => x.roundId === round.id && x.kind === 'qualifying')!;
    const list = entrants(s, round);
    const gridOrder = quali.rows
      .map((r) => list.find((e) => e.rider.id === r.riderId))
      .filter((e): e is Entrant => !!e);
    const grid = gridOrder.map((e) =>
      toRaceRider(s, e, playerStrategies[e.rider.id] ?? aiStrategy(e.rider, rng, RACE_FORMAT[cat.tier].laps)),
    );
    const circuit = s.tables.circuits[round.circuitId]!;
    const track = trackFor(s, round);
    const fmt = RACE_FORMAT[cat.tier];
    const isPlayers = gridOrder.some((e) => e.teamId === playerTeam);
    const out = runRace({
      seed: `${s.meta.seed}::${round.id}`,
      track,
      lengthM: circuit.lengthM,
      laps: fmt.laps,
      refLap: refLapOf(s, round),
      grid,
      frameEvery: isPlayers ? 0.5 : 1000,
    });

    const rowsOut: ResultRow[] = out.results.map((r) => {
      const e = gridOrder.find((x) => x.rider.id === r.riderId)!;
      const pts = r.position !== null ? (reg.points[r.position - 1] ?? 0) : 0;
      return {
        riderId: e.rider.id,
        teamId: e.teamId,
        manufacturerId: e.manufacturerId,
        position: r.position,
        status: r.status,
        time: r.time,
        gap: r.gap,
        bestLap: r.bestLap,
        points: pts,
        ...(r.reason ? { reason: r.reason } : {}),
      };
    });
    const id = ids.next('res') as SessionResultId;
    s.tables.sessionResults[id] = {
      id,
      roundId: round.id,
      seasonId: season.id,
      categoryId: season.categoryId,
      kind: 'race',
      day: s.meta.currentDay,
      rows: rowsOut,
      ...(out.fastestLap.riderId
        ? {
            fastestLap: {
              riderId: out.fastestLap.riderId as RiderId,
              time: Math.round(out.fastestLap.time * 1000) / 1000,
            },
          }
        : {}),
    };
    round.status = 'raced';

    // Soldi: diritti commerciali per squadra e premi per punti.
    const teamsHere = [...new Set(gridOrder.map((e) => e.teamId))];
    for (const t of teamsHere) {
      if (!s.accounts.some((a) => a.teamId === t)) continue;
      const pts = rowsOut.filter((x) => x.teamId === t).reduce((sum, x) => sum + x.points, 0);
      const fee = RACE_FEE[cat.tier];
      const prize = pts * PRIZE_PER_POINT[cat.tier];
      for (const [amount, category, note] of [
        [fee, 'commercialRights', `Diritti commerciali · ${circuit.name}`],
        [prize, 'prizeMoney', `Premi gara (${pts} punti) · ${circuit.name}`],
        [-TRAVEL_COST[cat.tier], 'travel', `Trasferta e logistica · ${circuit.name}`],
      ] as const) {
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
        title: `${cat.name} · ${circuit.name}: vince ${w.firstName} ${w.lastName}`,
        body: `${w.firstName} ${w.lastName} (${s.tables.teams[winner.teamId]!.name}) vince il Gran Premio. ${rowsOut.filter((x) => x.status === 'dnf').length} ritirati.`,
      });
    }
    if (isPlayers) {
      const mine = rowsOut.filter((x) => x.teamId === playerTeam);
      const text = mine
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
      replay = {
        roundId: round.id,
        categoryName: cat.name,
        circuit: circuit.name,
        laps: fmt.laps,
        lengthM: circuit.lengthM,
        track: { points: track.points },
        riders: gridOrder.map((e) => {
          const t = s.tables.teams[e.teamId]!;
          return {
            id: e.rider.id,
            name: `${e.rider.firstName} ${e.rider.lastName}`,
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
    // Ultimo round della stagione: stagione conclusa e campioni.
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
  }[];
  teams: { teamId: string; team: string; color: string; points: number; wins: number }[];
  constructors: { manufacturerId: string; name: string; points: number; wins: number }[];
  racesDone: number;
}

export function standings(s: GameState, seasonId: string): StandingsView {
  const races = rows(s, 'sessionResults').filter((x) => x.seasonId === seasonId && x.kind === 'race');
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
      };
      re.points += row.points;
      re.teamId = row.teamId;
      re.team = t.name;
      re.color = t.colors.primary;
      if (row.position === 1) re.wins++;
      if (row.position !== null && row.position <= 3) re.podiums++;
      rmap.set(row.riderId, re);
      const te = tmap.get(row.teamId) ?? {
        teamId: row.teamId,
        team: t.name,
        color: t.colors.primary,
        points: 0,
        wins: 0,
      };
      te.points += row.points;
      if (row.position === 1) te.wins++;
      tmap.set(row.teamId, te);
      if (!bestByMfr.has(row.manufacturerId) || row.points > bestByMfr.get(row.manufacturerId)!)
        bestByMfr.set(row.manufacturerId, row.points);
    }
    for (const [mid, pts] of bestByMfr) {
      const m = s.tables.manufacturers[mid as ManufacturerId]!;
      const me = mmap.get(mid) ?? { manufacturerId: mid, name: m.name, points: 0, wins: 0 };
      me.points += pts;
      if (race.rows[0]?.manufacturerId === mid && race.rows[0]?.position === 1) me.wins++;
      mmap.set(mid, me);
    }
  }
  const sort = <T extends { points: number; wins: number }>(xs: T[]) =>
    xs.sort((a, b) => b.points - a.points || b.wins - a.wins);
  return {
    riders: sort([...rmap.values()]),
    teams: sort([...tmap.values()]),
    constructors: sort([...mmap.values()]),
    racesDone: races.length,
  };
}
