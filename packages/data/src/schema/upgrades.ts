/**
 * Upgrade dei componenti della moto e contratti sponsor con obiettivo stagionale (schema v4).
 */
import type { Credits, GameDay, Id } from '@lean-angle/core';
import type { TeamId } from './org.ts';
import type { SeasonId } from './world.ts';

/** Componenti potenziabili. Livello 0 = di serie, massimo 3. */
export const PART_KEYS = [
  'engine',
  'brakes',
  'suspension',
  'chassis',
  'aero',
  'electronics',
  'exhaust',
] as const;
export type PartKey = (typeof PART_KEYS)[number];
export const MAX_PART_LEVEL = 3;

export type SponsorDealId = Id<'spd'>;
export type SponsorRisk = 'safe' | 'balanced' | 'ambitious';

export interface SponsorDeal {
  id: SponsorDealId;
  teamId: TeamId;
  seasonId: SeasonId;
  sponsorName: string;
  risk: SponsorRisk;
  /** Obiettivo: posizione massima della squadra nella classifica squadre a fine stagione. */
  targetPosition: number;
  /** Rata mensile in più rispetto agli sponsor di base, pagata il 1° di ogni mese. */
  monthly: Credits;
  /** Premio a fine stagione se l'obiettivo è raggiunto. */
  bonus: Credits;
  signedDay: GameDay;
  status: 'active' | 'met' | 'missed';
}
