/**
 * Test pre-stagionali (REGULATIONS.md §1: MotoGP due test, Moto2/Moto3 un test, Rookies una giornata collettiva).
 *
 * Si corrono nelle settimane prima del primo Gran Premio sui circuiti del calendario. Ogni giornata il manager
 * sceglie un programma per pilota:
 * - Circuito / Assetto / Passo gara: cresce la confidenza con la moto con cui il pilota inizierà ogni weekend
 *   (l'assetto di più); 50 senza test, fino a 78. Le squadre dell'IA fanno sempre i loro test (60).
 * - Sviluppo: si provano componenti nuovi; in stagione upgrade più rapidi (−5% per giornata) ed economici (−3%).
 * Ogni giornata costa trasferta e personale. I test si possono saltare (si perde il vantaggio).
 */
import type { IdFactory } from '@lean-angle/core';
import {
  rows,
  type CategoryTier,
  type GameState,
  type PreseasonState,
  type Round,
  type TestProgram,
  type TransactionId,
} from '@lean-angle/data';
import { BIKE_BASE_MAX, activePreseason, bikeBase, devFactor } from './preseasonEffects.ts';
import { simulateTestDay, type SessionTiming } from './weekend.ts';

/** Calendario dei test per categoria: giorni prima del primo GP, durata, circuito (indice del round). */
const PLAN: Record<CategoryTier, { offset: number; days: number; roundIdx: number }[]> = {
  premier: [
    { offset: 35, days: 3, roundIdx: 1 },
    { offset: 14, days: 2, roundIdx: 0 },
  ],
  intermediate: [{ offset: 21, days: 3, roundIdx: 0 }],
  lightweight: [{ offset: 21, days: 3, roundIdx: 0 }],
  rookies: [{ offset: 10, days: 1, roundIdx: 0 }],
};
/** Costo di ogni giornata (trasferta, personale, gomme). */
const DAY_COST: Record<CategoryTier, number> = {
  premier: 90_000,
  intermediate: 20_000,
  lightweight: 9_000,
  rookies: 0,
};

export const TEST_PROGRAMS: { id: TestProgram; label: string; text: string }[] = [
  {
    id: 'track',
    label: 'Circuito',
    text: 'Tanti giri: il pilota prende ritmo. Confidenza con la moto un po’ più alta per tutta la stagione.',
  },
  {
    id: 'setup',
    label: 'Assetto',
    text: 'Si cerca la base d’assetto: la confidenza con la moto cresce di più, per tutta la stagione.',
  },
  {
    id: 'longRun',
    label: 'Passo gara',
    text: 'Simulazione di gara con gomme dure: confidenza con la moto in crescita, ritmo costante.',
  },
  {
    id: 'development',
    label: 'Sviluppo',
    text: 'Si provano componenti nuovi: in stagione upgrade più rapidi (−5% per giornata) ed economici (−3%).',
  },
];

const GAIN: Record<TestProgram, number> = { track: 0.1, setup: 0.25, longRun: 0.12, development: 0.05 };

function playerSeason(s: GameState) {
  const e = rows(s, 'teamEntries').find((x) => x.teamId === s.meta.playerTeamId);
  if (!e) return null;
  const season = s.tables.seasons[e.seasonId]!;
  const tier = s.tables.categories[e.categoryId]!.tier;
  const rounds = season.roundIds.map((id) => s.tables.rounds[id]!).sort((a, b) => a.startDay - b.startDay);
  return { entry: e, season, tier, rounds };
}

export interface PreseasonTest {
  id: string;
  name: string;
  round: Round;
  circuit: string;
  country: string;
  startDay: number;
  days: number;
  done: number;
  skipped: boolean;
}

export function preseasonTests(s: GameState): PreseasonTest[] {
  const ps = playerSeason(s);
  if (!ps || ps.rounds.length === 0) return [];
  const first = ps.rounds[0]!.startDay;
  const p = activePreseason(s);
  return PLAN[ps.tier].map((t, i) => {
    const round = ps.rounds[Math.min(t.roundIdx, ps.rounds.length - 1)]!;
    const c = s.tables.circuits[round.circuitId]!;
    const id = `${ps.season.id}-test-${i + 1}`;
    return {
      id,
      name: PLAN[ps.tier].length > 1 ? `Test pre-stagionale ${i + 1}` : 'Test pre-stagionale',
      round,
      circuit: c.name,
      country: c.country,
      startDay: first - t.offset,
      days: t.days,
      done: p?.done[id] ?? 0,
      skipped: p?.skipped.includes(id) ?? false,
    };
  });
}

const pending = (t: PreseasonTest) => !t.skipped && t.done < t.days;

/** Test con una giornata da correre oggi (null se nessuna). */
export function testToday(s: GameState): PreseasonTest | null {
  const d = s.meta.currentDay;
  // La giornata da correre è la successiva a quelle già fatte (una al giorno).
  return (
    preseasonTests(s).find((t) => pending(t) && d >= t.startDay + t.done && d < t.startDay + t.days) ?? null
  );
}

/** Prossimo giorno di test ancora da correre (dopo oggi), per fermare l'avanzamento del tempo. */
export function nextTestDay(s: GameState): number | null {
  const d = s.meta.currentDay;
  const days = preseasonTests(s)
    .filter(pending)
    .map((t) => Math.max(t.startDay, t.startDay + t.done))
    .filter((x) => x > d);
  return days.length ? Math.min(...days) : null;
}

function ensure(s: GameState): PreseasonState {
  const p = activePreseason(s);
  if (p) return p;
  const ps = playerSeason(s)!;
  s.preseason = {
    seasonId: ps.season.id,
    done: {},
    skipped: [],
    bikeBase: {},
    devDays: 0,
    log: [],
    lastDay: null,
  };
  return s.preseason;
}

/** Chi va avanti senza correre le giornate di oggi rinuncia al resto del test. */
export function skipTestToday(s: GameState): void {
  const t = testToday(s);
  if (!t) return;
  const p = ensure(s);
  p.skipped.push(t.id);
  p.log.push({ testId: t.id, day: t.done + 1, text: `${t.name} saltato dal giorno ${t.done + 1}.` });
}

export function validateTestDay(s: GameState, programs: Record<string, string>): string | null {
  if (!testToday(s)) return 'Oggi non ci sono test';
  const ok = new Set(TEST_PROGRAMS.map((x) => x.id));
  for (const v of Object.values(programs))
    if (!ok.has(v as TestProgram)) return 'Programma di test sconosciuto';
  return null;
}

/** Corre la giornata di oggi: tempi di tutti, effetti per i piloti del giocatore, costo. */
export function runTestDay(
  s: GameState,
  ids: IdFactory,
  programs: Record<string, TestProgram>,
): SessionTiming {
  const t = testToday(s)!;
  const p = ensure(s);
  const ps = playerSeason(s)!;
  const day = t.done + 1;
  const { rows: out, timing } = simulateTestDay(s, t.round, programs, `${t.id}-${day}`);
  const mine = ps.entry.seats.map((x) => x.riderId).filter((x): x is NonNullable<typeof x> => !!x);
  for (const id of mine) {
    const r = s.tables.riders[id]!;
    const prog: TestProgram = programs[id] ?? 'setup';
    const before = bikeBase(s, id, true);
    const after = Math.round((before + (BIKE_BASE_MAX - before) * GAIN[prog]) * 10) / 10;
    p.bikeBase[id] = after;
    if (prog === 'development') p.devDays += 0.5;
    const best = out.find((x) => x.riderId === id)?.best;
    const pos = out.findIndex((x) => x.riderId === id) + 1;
    p.log.push({
      testId: t.id,
      day,
      text: `${r.firstName} ${r.lastName}: programma ${TEST_PROGRAMS.find((x) => x.id === prog)!.label.toLowerCase()}, ${pos}° tempo${best ? ` (${fmt(best)})` : ''}; confidenza con la moto ${Math.round(before)} → ${Math.round(after)}.`,
    });
  }
  p.done[t.id] = day;
  p.lastDay = { testId: t.id, day, rows: out };
  const cost = DAY_COST[ps.tier];
  if (cost) {
    const id = ids.next('trx') as TransactionId;
    s.tables.transactions[id] = {
      id,
      teamId: s.meta.playerTeamId!,
      day: s.meta.currentDay,
      amount: -cost,
      category: 'travel',
      note: `${t.name}, giorno ${day} (${t.circuit})`,
    };
  }
  return timing;
}

const fmt = (sec: number) => {
  const m = Math.floor(sec / 60);
  return `${m}'${(sec - m * 60).toFixed(3).padStart(6, '0')}`;
};

// ---------------------------------------------------------------------------------------------
export interface PreseasonView {
  tests: {
    id: string;
    name: string;
    circuit: string;
    country: string;
    date: string;
    days: number;
    done: number;
    status: 'upcoming' | 'today' | 'done' | 'skipped';
  }[];
  today: {
    id: string;
    name: string;
    circuit: string;
    day: number;
    days: number;
    cost: number;
    riders: { id: string; name: string; number: number; bikeBase: number }[];
  } | null;
  programs: typeof TEST_PROGRAMS;
  devDays: number;
  devEffect: string;
  riders: { id: string; name: string; bikeBase: number }[];
  log: PreseasonState['log'];
  lastDay: {
    title: string;
    rows: {
      pos: number;
      name: string;
      team: string;
      color: string;
      number: number;
      best: number;
      gap: number;
      mine: boolean;
    }[];
  } | null;
}

export function preseasonView(s: GameState, formatDay: (d: number) => string): PreseasonView | null {
  const ps = playerSeason(s);
  if (!ps) return null;
  const tests = preseasonTests(s);
  const today = testToday(s);
  const p = activePreseason(s);
  const nums = new Map<string, number>();
  const teamOf = new Map<string, string>();
  for (const e of rows(s, 'teamEntries').filter((x) => x.seasonId === ps.season.id))
    for (const seat of e.seats)
      if (seat.riderId) {
        nums.set(seat.riderId, seat.number);
        teamOf.set(seat.riderId, e.teamId);
      }
  const mine = ps.entry.seats
    .map((x) => x.riderId)
    .filter((x): x is NonNullable<typeof x> => !!x)
    .map((id) => {
      const r = s.tables.riders[id]!;
      return {
        id,
        name: `${r.firstName} ${r.lastName}`,
        number: nums.get(id) ?? 0,
        bikeBase: Math.round(bikeBase(s, id, true)),
      };
    });
  const f = devFactor(s, s.meta.playerTeamId!);
  const last = p?.lastDay;
  const lastTest = last ? tests.find((t) => t.id === last.testId) : undefined;
  return {
    tests: tests.map((t) => ({
      id: t.id,
      name: t.name,
      circuit: t.circuit,
      country: t.country,
      date: formatDay(t.startDay),
      days: t.days,
      done: t.done,
      status: t.skipped
        ? 'skipped'
        : t.done >= t.days
          ? 'done'
          : today?.id === t.id
            ? 'today'
            : s.meta.currentDay >= t.startDay + t.days
              ? 'skipped'
              : 'upcoming',
    })),
    today: today
      ? {
          id: today.id,
          name: today.name,
          circuit: today.circuit,
          day: today.done + 1,
          days: today.days,
          cost: DAY_COST[ps.tier],
          riders: mine,
        }
      : null,
    programs: TEST_PROGRAMS,
    devDays: p?.devDays ?? 0,
    devEffect:
      (p?.devDays ?? 0) > 0
        ? `upgrade ${Math.round((1 - f.lead) * 100)}% più rapidi e ${Math.round((1 - f.cost) * 100)}% più economici`
        : 'nessuno',
    riders: mine.map(({ id, name, bikeBase: b }) => ({ id, name, bikeBase: b })),
    log: p?.log ?? [],
    lastDay:
      last && lastTest
        ? {
            title: `${lastTest.name} · giorno ${last.day} · ${lastTest.circuit}`,
            rows: last.rows.map((x, i) => {
              const r = s.tables.riders[x.riderId as never]!;
              const team = s.tables.teams[teamOf.get(x.riderId) as never];
              return {
                pos: i + 1,
                name: `${(r as { firstName: string }).firstName} ${(r as { lastName: string }).lastName}`,
                team: team?.name ?? '',
                color: team?.colors.primary ?? '#888',
                number: nums.get(x.riderId) ?? 0,
                best: x.best,
                gap: Math.round((x.best - last.rows[0]!.best) * 1000) / 1000,
                mine: teamOf.get(x.riderId) === s.meta.playerTeamId,
              };
            }),
          }
        : null,
  };
}

/** Rinuncia a tutti i test pre-stagionali della stagione (usato dai test automatici che vanno subito al GP). */
export function skipPreseason<T extends { state: GameState }>(e: T): T {
  const p = ensure(e.state);
  for (const t of preseasonTests(e.state)) if (!p.skipped.includes(t.id)) p.skipped.push(t.id);
  return e;
}
