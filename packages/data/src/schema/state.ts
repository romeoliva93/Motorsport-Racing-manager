import type { GameDay, RngState } from '@lean-angle/core';
import type { Category, Circuit, Federation, Regulation, Round, Season } from './world.ts';
import type { Injury, Rider, RiderStaffBond, StaffMember } from './people.ts';
import type { Manufacturer, Sponsor, StaffAssignment, Team, TeamEntry, TeamId } from './org.ts';
import type { Bike, Component, Facility } from './tech.ts';
import type { Contract } from './contracts.ts';
import type { FinanceAccount, Transaction } from './finance.ts';

/** Versione dello schema dei salvataggi: va incrementata a ogni modifica incompatibile (con migrazione). */
export const SCHEMA_VERSION = 1;

export type Table<T extends { id: string }> = Record<T['id'], T>;

export interface GameMeta {
  saveName: string;
  seed: string;
  startYear: number;
  currentDay: GameDay;
  playerTeamId: TeamId | null;
  difficulty: 'easy' | 'normal' | 'hard';
}

/** Stato di gioco: database relazionale in memoria, normalizzato (ADR-0002). */
export interface GameState {
  schemaVersion: number;
  meta: GameMeta;
  /** Stato dei flussi del generatore casuale e dei contatori degli ID (per riprendere esattamente). */
  rng: Record<string, RngState>;
  idCounters: Record<string, number>;
  tables: {
    federations: Table<Federation>;
    categories: Table<Category>;
    regulations: Table<Regulation>;
    seasons: Table<Season>;
    rounds: Table<Round>;
    circuits: Table<Circuit>;
    manufacturers: Table<Manufacturer>;
    teams: Table<Team>;
    teamEntries: Table<TeamEntry>;
    sponsors: Table<Sponsor>;
    riders: Table<Rider>;
    staff: Table<StaffMember>;
    injuries: Table<Injury>;
    contracts: Table<Contract>;
    bikes: Table<Bike>;
    components: Table<Component>;
    facilities: Table<Facility>;
    transactions: Table<Transaction>;
  };
  /** Relazioni senza ID proprio. */
  staffAssignments: StaffAssignment[];
  bonds: RiderStaffBond[];
  accounts: FinanceAccount[];
}

export type TableName = keyof GameState['tables'];

export function createEmptyGameState(meta: GameMeta): GameState {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta,
    rng: {},
    idCounters: {},
    tables: {
      federations: {},
      categories: {},
      regulations: {},
      seasons: {},
      rounds: {},
      circuits: {},
      manufacturers: {},
      teams: {},
      teamEntries: {},
      sponsors: {},
      riders: {},
      staff: {},
      injuries: {},
      contracts: {},
      bikes: {},
      components: {},
      facilities: {},
      transactions: {},
    },
    staffAssignments: [],
    bonds: [],
    accounts: [],
  };
}
