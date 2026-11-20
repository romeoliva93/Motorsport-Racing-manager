/**
 * Effetti dei test pre-stagionali usati da prove, simulazione e sviluppo (modulo senza altre dipendenze).
 * - Confidenza con la moto di partenza nei weekend: 50 senza test, fino a 78 con test ben fatti. Le squadre
 *   dell'IA fanno sempre i loro test: partono da 60.
 * - Giornate di sviluppo: tempi di consegna −5% e costi −3% per giornata (al massimo −20% e −12%).
 */
import { rows, type GameState } from '@lean-angle/data';

export const AI_BIKE_BASE = 60;
export const BIKE_BASE_MAX = 78;

/** Stato dei test della stagione in corso della squadra del giocatore (null se di un'altra stagione). */
export function activePreseason(s: GameState) {
  const p = s.preseason;
  if (!p) return null;
  const e = rows(s, 'teamEntries').find((x) => x.teamId === s.meta.playerTeamId);
  return e && e.seasonId === p.seasonId ? p : null;
}

export function bikeBase(s: GameState, riderId: string, mine: boolean): number {
  if (!mine) return AI_BIKE_BASE;
  return activePreseason(s)?.bikeBase[riderId] ?? 50;
}

export function devFactor(s: GameState, teamId: string): { cost: number; lead: number } {
  const d = teamId === s.meta.playerTeamId ? (activePreseason(s)?.devDays ?? 0) : 0;
  return { cost: 1 - Math.min(0.12, 0.03 * d), lead: 1 - Math.min(0.2, 0.05 * d) };
}
