import type { Credits, GameDay, Id } from '@lean-angle/core';

export type FederationId = Id<'fed'>;
export type CategoryId = Id<'cat'>;
export type RegulationId = Id<'reg'>;
export type SeasonId = Id<'ssn'>;
export type RoundId = Id<'rnd'>;
export type CircuitId = Id<'cir'>;

export type CategoryTier = 'rookies' | 'lightweight' | 'intermediate' | 'premier';

export interface Federation {
  id: FederationId;
  name: string;
  acronym: string;
}

export interface Category {
  id: CategoryId;
  tier: CategoryTier;
  name: string;
  /** Numero massimo di piloti in griglia. */
  maxGrid: number;
  /** true se il giocatore può gestire una squadra (la Rookies Cup è gestita dall'organizzatore). */
  teamsManaged: boolean;
}

export type SessionType = 'FP' | 'PR' | 'Q1' | 'Q2' | 'SPRINT' | 'WUP' | 'RACE';

export interface SessionSpec {
  type: SessionType;
  /** Durata in minuti (prove/qualifiche) oppure giri (gare). */
  minutes?: number;
  laps?: number;
}

export type SubstitutionPolicy = 'yes' | 'organizerReserveOnly' | 'no';

/** Regolamento di una categoria per una stagione (REGULATIONS.md). */
export interface Regulation {
  id: RegulationId;
  categoryId: CategoryId;
  season: number;
  points: number[];
  sprintPoints: number[];
  weekendFormat: SessionSpec[];
  /** Moto per pilota: Rookies/Lightweight/Intermediate 1, Premier 2. */
  bikesPerRider: 1 | 2;
  /** Cambio moto in gara: ammesso solo con 2 moto per pilota. */
  flagToFlag: boolean;
  enginesPerSeason: number | null;
  testBikesPerTeam: number;
  riderAge: { min: number; max: number | null };
  radioPolicy: 'none' | 'dashboard' | 'full';
  substitution: {
    allowed: SubstitutionPolicy;
    vacancyAllowed: boolean;
    /** Riduzione della quota di partecipazione per GP senza pilota (null = nessuna). */
    participationFeeReductionPerRound: Credits | null;
    /** Scadenza iscrizione: giorni prima dell'inizio dell'evento. */
    entryDeadlineDaysBefore: number;
  };
  inSeasonTests: { everyRounds: number | null; sessions: number };
}

export interface Season {
  id: SeasonId;
  year: number;
  categoryId: CategoryId;
  regulationId: RegulationId;
  roundIds: RoundId[];
  status: 'planned' | 'running' | 'finished';
}

export interface Round {
  id: RoundId;
  seasonId: SeasonId;
  number: number;
  circuitId: CircuitId;
  /** Primo giorno dell'evento (giovedì: conferenza stampa). */
  startDay: GameDay;
  /** Avanzamento del weekend: assente = non ancora disputato. */
  status?: 'qualified' | 'raced';
}

export interface Circuit {
  id: CircuitId;
  name: string;
  country: string;
  lengthM: number;
  turns: number;
  /** 0–1: abrasività dell'asfalto. */
  abrasiveness: number;
  /** 0–1: facilità di sorpasso. */
  overtaking: number;
}
