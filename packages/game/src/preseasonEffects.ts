/**
 * Programmi di lavoro del pilota: quattro percentuali (0–100) diverse per ogni pilota, che partono dalle sue
 * caratteristiche e salgono con i test pre-stagionali (il programma scelto ha il boost più grande).
 *
 * - **Circuito** → confidenza col circuito di partenza in ogni weekend (±6 punti).
 * - **Assetto** → confidenza con la moto di partenza in ogni weekend (35 + 0,45 × %: da ~50 a ~80).
 * - **Passo gara** → gestione gomme in gara (±5%).
 * - **Sviluppo** → upgrade della sua moto più economici e più rapidi (fino a −12% e −20%).
 *
 * I piloti delle squadre IA fanno sempre i loro test: partono dai loro valori già potenziati da un programma
 * misto (come tre giornate di lavoro).
 */
import { rows, type GameState, type TestProgram } from '@lean-angle/data';

export const PROGRAM_KEYS: TestProgram[] = ['track', 'setup', 'longRun', 'development'];
export type ProgramLevels = Record<TestProgram, number>;

/** Boost di una giornata di test: il programma scelto e, meno, gli altri (si gira comunque). */
export const MAIN_GAIN = 0.2;
export const SIDE_GAIN = 0.03;

/** Stato dei test della stagione in corso della squadra del giocatore (null se di un'altra stagione). */
export function activePreseason(s: GameState) {
  const p = s.preseason;
  if (!p) return null;
  const e = rows(s, 'teamEntries').find((x) => x.teamId === s.meta.playerTeamId);
  return e && e.seasonId === p.seasonId ? p : null;
}

/** Piccola variazione fissa per pilota (−1…+1), così due piloti simili non hanno gli stessi valori. */
function jitter(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 2001) / 1000 - 1;
}

const clampPct = (x: number) => Math.max(5, Math.min(98, Math.round(x * 10) / 10));

/** Valori di partenza del pilota, prima dei test (dalle sue caratteristiche). */
export function baseProgramLevels(s: GameState, riderId: string): ProgramLevels {
  const r = s.tables.riders[riderId as never] as { attributes: Record<string, number> } | undefined;
  const a = r?.attributes ?? {};
  const v = (k: string) => a[k] ?? 50;
  return {
    track: clampPct(0.35 * v('adaptability') + 0.3 * v('consistency') - 8 + 8 * jitter(riderId, 1)),
    setup: clampPct(0.55 * v('technicalFeedback') - 2 + 8 * jitter(riderId, 2)),
    longRun: clampPct(0.35 * v('tyreManagement') + 0.25 * v('racePace') - 10 + 8 * jitter(riderId, 3)),
    development: clampPct(
      0.45 * v('technicalFeedback') + 0.15 * v('adaptability') - 12 + 8 * jitter(riderId, 4),
    ),
  };
}

/** Aggiunge `days` giornate di test con il programma indicato (null = programma misto). */
export function boosted(l: ProgramLevels, program: TestProgram | null, days = 1): ProgramLevels {
  const out = { ...l };
  for (let d = 0; d < days; d++)
    for (const k of PROGRAM_KEYS) {
      const g = program === null ? 0.08 : k === program ? MAIN_GAIN : SIDE_GAIN;
      out[k] = clampPct(out[k] + (100 - out[k]) * g);
    }
  return out;
}

/** Percentuali attuali del pilota: del giocatore dai test fatti, delle IA con i loro test già fatti. */
export function programLevels(s: GameState, riderId: string, mine?: boolean): ProgramLevels {
  const isMine =
    mine ??
    rows(s, 'teamEntries').some(
      (e) => e.teamId === s.meta.playerTeamId && e.seats.some((x) => x.riderId === riderId),
    );
  if (!isMine) return boosted(baseProgramLevels(s, riderId), null, 3);
  return activePreseason(s)?.levels?.[riderId] ?? baseProgramLevels(s, riderId);
}

/** Confidenza con la moto da cui il pilota parte in ogni weekend. */
export function bikeBase(s: GameState, riderId: string, mine: boolean): number {
  return Math.round((35 + 0.45 * programLevels(s, riderId, mine).setup) * 10) / 10;
}

/** Punti di confidenza col circuito in più (o in meno) a inizio weekend. */
export function trackBonus(s: GameState, riderId: string, mine: boolean): number {
  return Math.round(((programLevels(s, riderId, mine).track - 50) / 50) * 6 * 10) / 10;
}

/** Moltiplicatore della gestione gomme in gara (±5%). */
export function longRunFactor(s: GameState, riderId: string, mine: boolean): number {
  return 1 + ((programLevels(s, riderId, mine).longRun - 50) / 50) * 0.05;
}

/** Sconto su costo e tempi degli upgrade della moto del pilota (senza pilota: nessun effetto). */
export function devFactor(s: GameState, _teamId: string, riderId?: string): { cost: number; lead: number } {
  if (!riderId) return { cost: 1, lead: 1 };
  const d = Math.max(0, (programLevels(s, riderId).development - 40) / 60);
  return { cost: 1 - 0.12 * d, lead: 1 - 0.2 * d };
}
