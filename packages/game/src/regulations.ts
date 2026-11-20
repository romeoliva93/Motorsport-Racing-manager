/**
 * Regole tecniche della classe regina (versione di gioco del regolamento MotoGP).
 *
 * Concessioni ai costruttori (dal 2024): fascia in base alla percentuale dei punti costruttori ottenuti sul massimo
 * possibile nella stagione precedente (Sprint compresa):
 *   A ≥ 85%   B 60–85%   C 35–60%   D < 35%
 * Nella prima stagione della carriera la fascia è stimata dalla forza tecnica del costruttore
 * (≥ 86 A, ≥ 81 B, ≥ 76 C, altrimenti D).
 * Effetti nel gioco: costo e tempi di produzione degli upgrade (A 100%, B 95%, C 85%, D 75%) e motori a stagione
 * per pilota (A/B/C 8, D 10). Valgono solo in MotoGP.
 *
 * Motori: ogni motore dura 3 weekend di gara; un guasto meccanico in gara lo distrugge. Se per un weekend serve un
 * motore oltre la dotazione, il pilota parte dalla corsia box (Sprint e gara). Tutto è ricavato dai risultati salvati.
 */
import { rows, type GameState, type ManufacturerId } from '@lean-angle/data';
import { standings } from './weekend.ts';

export type ConcessionRank = 'A' | 'B' | 'C' | 'D';
export const CONCESSION_COST: Record<ConcessionRank, number> = { A: 1, B: 0.95, C: 0.85, D: 0.75 };
export const ENGINE_ALLOCATION: Record<ConcessionRank, number> = { A: 8, B: 8, C: 8, D: 10 };
export const ENGINE_LIFE = 3;
const MAX_POINTS_PER_WEEKEND = 25 + 12;

function premierSeasons(s: GameState) {
  return rows(s, 'seasons')
    .filter((x) => s.tables.categories[x.categoryId]!.tier === 'premier')
    .sort((a, b) => a.year - b.year);
}

export function concessionRank(s: GameState, manufacturerId: string): ConcessionRank {
  const m = s.tables.manufacturers[manufacturerId as ManufacturerId];
  const seasons = premierSeasons(s);
  const current = seasons.at(-1);
  const prev = seasons.filter((x) => x.status === 'finished' && x.year < (current?.year ?? 0)).at(-1);
  if (!prev) {
    const st = m?.engineeringStrength ?? 70;
    return st >= 86 ? 'A' : st >= 81 ? 'B' : st >= 76 ? 'C' : 'D';
  }
  const pts =
    standings(s, prev.id).constructors.find((c) => c.manufacturerId === manufacturerId)?.points ?? 0;
  const pct = pts / (prev.roundIds.length * MAX_POINTS_PER_WEEKEND);
  return pct >= 0.85 ? 'A' : pct >= 0.6 ? 'B' : pct >= 0.35 ? 'C' : 'D';
}

/** Fascia di concessione della squadra (null fuori dalla MotoGP). */
export function teamConcession(s: GameState, teamId: string): ConcessionRank | null {
  const entry = rows(s, 'teamEntries').find((e) => e.teamId === teamId);
  if (!entry || s.tables.categories[entry.categoryId]!.tier !== 'premier') return null;
  return concessionRank(s, entry.manufacturerId);
}

/** Motori usati da un pilota nella stagione (prima del prossimo weekend) e dotazione. */
export function engineStatus(s: GameState, riderId: string, seasonId: string, teamId: string) {
  const races = rows(s, 'sessionResults').filter((r) => r.seasonId === seasonId && r.kind === 'race');
  const mine = races.map((r) => r.rows.find((x) => x.riderId === riderId)).filter((x) => !!x);
  const broken = mine.filter((x) => x!.reason === 'mechanical').length;
  const weekends = mine.length;
  const used = weekends === 0 ? 0 : Math.floor((weekends - 1) / ENGINE_LIFE) + 1 + broken;
  // Il prossimo weekend richiede un motore nuovo se quello montato è a fine vita (o rotto).
  const needed = Math.floor(weekends / ENGINE_LIFE) + 1 + broken;
  const rank = teamConcession(s, teamId) ?? 'C';
  return { used, needed, allocation: ENGINE_ALLOCATION[rank], overLimit: needed > ENGINE_ALLOCATION[rank] };
}
