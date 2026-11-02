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
  /** Gomma usata in questa sessione. */
  compound?: 'soft' | 'medium' | 'hard' | 'wet';
  /** Penalità della direzione gara (Long Lap, secondi aggiunti, posizione persa). */
  penalty?: { longLaps: number; served: number; timeAdded: number; positionDrop: boolean };
}

export type SessionKind = 'fp1' | 'practice' | 'fp2' | 'q1' | 'q2' | 'qualifying' | 'sprint' | 'race';

export interface SessionResult {
  id: SessionResultId;
  roundId: RoundId;
  seasonId: SeasonId;
  categoryId: CategoryId;
  /**
   * Sessione del weekend. 'qualifying' è la griglia ufficiale (Q1+Q2 combinate, o qualifica unica).
   */
  kind: SessionKind;
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
