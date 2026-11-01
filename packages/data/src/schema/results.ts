/** Risultati delle sessioni e notizie (schema v3). */
import type { GameDay, Id } from '@lean-angle/core';
import type { CategoryId, RoundId, SeasonId } from './world.ts';
import type { RiderId } from './people.ts';
import type { ManufacturerId, TeamId } from './org.ts';

export type SessionResultId = Id<'res'>;
export type NewsId = Id<'nws'>;

export interface ResultRow {
  riderId: RiderId;
  teamId: TeamId;
  manufacturerId: ManufacturerId;
  position: number | null;
  status: 'finished' | 'dnf';
  /** Tempo totale (gara) o miglior giro (qualifiche), in secondi. */
  time: number | null;
  gap: number | null;
  bestLap: number;
  points: number;
  reason?: 'crash' | 'mechanical';
}

export interface SessionResult {
  id: SessionResultId;
  roundId: RoundId;
  seasonId: SeasonId;
  categoryId: CategoryId;
  kind: 'qualifying' | 'race';
  day: GameDay;
  rows: ResultRow[];
  fastestLap?: { riderId: RiderId; time: number };
}

export interface NewsItem {
  id: NewsId;
  day: GameDay;
  tag: 'gara' | 'mercato' | 'squadra' | 'campionato' | 'finanze';
  title: string;
  body: string;
  /** true se riguarda la squadra del giocatore. */
  mine: boolean;
}
