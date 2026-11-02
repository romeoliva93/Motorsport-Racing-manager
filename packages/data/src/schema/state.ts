import type { PartKey, SponsorDeal, UpgradeOrder } from './upgrades.ts';
import type { GameDay, RngState } from '@lean-angle/core';
import type { Category, Circuit, Federation, Regulation, Round, Season } from './world.ts';
import type { Injury, Rider, RiderStaffBond, StaffMember } from './people.ts';
import type { Manufacturer, Sponsor, StaffAssignment, Team, TeamEntry, TeamId } from './org.ts';
import type { Bike, Component, Facility } from './tech.ts';
import type { Contract } from './contracts.ts';
import type { FinanceAccount, Transaction } from './finance.ts';
import type { Negotiation } from './market.ts';
import type { NewsItem, SessionResult } from './results.ts';

/** Versione dello schema dei salvataggi: va incrementata a ogni modifica incompatibile (con migrazione). */
export const SCHEMA_VERSION = 5;

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
    negotiations: Table<Negotiation>;
    sessionResults: Table<SessionResult>;
    news: Table<NewsItem>;
    sponsorDeals: Table<SponsorDeal>;
    upgradeOrders: Table<UpgradeOrder>;
  };
  /** Relazioni senza ID proprio. */
  staffAssignments: StaffAssignment[];
  bonds: RiderStaffBond[];
  accounts: FinanceAccount[];
  /** Livello degli upgrade montati sulle moto di ogni squadra. */
  upgrades: Record<string, Partial<Record<PartKey, number>>>;
  /**
   * Manutenzione per squadra: 'auto' = il capotecnico revisiona da solo; 'assisted' = avvisa e propone;
   * 'manual' = decide tutto il manager. Assente = 'auto'.
   */
  garageMode?: Record<string, 'auto' | 'assisted' | 'manual'>;
  /** Ricambi in magazzino per squadra e gruppo tecnico. */
  spares?: Record<string, Record<string, number>>;
  /** Assetto di ogni pilota (asciutto e bagnato): regolazioni da −5 a +5. */
  setups?: Record<string, { dry: Record<string, number>; wet: Record<string, number> }>;
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
      negotiations: {},
      sessionResults: {},
      news: {},
      sponsorDeals: {},
      upgradeOrders: {},
    },
    staffAssignments: [],
    bonds: [],
    accounts: [],
    upgrades: {},
  };
}
