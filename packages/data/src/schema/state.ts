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
export const SCHEMA_VERSION = 6;

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
  /**
   * Sprint o gara in corso, seguita dal giocatore (simulazione incrementale): preparazione, fotografia della
   * simulazione e istante raggiunto dalla visione. Permette di salvare e riprendere a metà gara.
   * Struttura definita nei pacchetti game/sim (RacePrep, RaceSnapshot).
   */
  liveSession?: { prep: unknown; snapshot: unknown; viewerT: number };
  /**
   * Prove del weekend in corso (giocatore): giri, confidenza col circuito e con la moto, tempo usato per le
   * modifiche d'assetto fra una sessione e l'altra, cronologia di uscite e modifiche. Si azzera a ogni weekend.
   */
  practice?: PracticeState;
  /** Il manager (il giocatore): reputazione, stipendio, soldi personali, corsi, offerte di lavoro. */
  manager?: ManagerState;
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

export type PracticeProgram = 'track' | 'setup' | 'longRun';
export interface PracticeLogEntry {
  /** Sessione dopo cui (o in cui) è avvenuto. */
  session: string;
  kind: 'run' | 'change';
  text: string;
  laps?: number;
  best?: number;
  /** Intesa con l'assetto in quel momento (0–100). */
  match?: number;
  minutes?: number;
}
export interface PracticeRider {
  laps: number;
  /** Confidenza col circuito e con la moto, 0–100. */
  trackConf: number;
  bikeConf: number;
  /** Minuti di lavoro già usati nella pausa corrente. */
  minutesUsed: number;
  longRun: boolean;
  log: PracticeLogEntry[];
}
export interface PracticeState {
  roundId: string;
  riders: Record<string, PracticeRider>;
}

export type ManagerSkill = 'negotiation' | 'commercial' | 'technical';

/** Offerta di lavoro di un'altra squadra (a fine stagione). */
export interface JobOffer {
  id: string;
  teamId: string;
  /** top = squadra forte, più soldi; star = media, meno soldi ma un pilota di punta; bike = debole, moto al top. */
  kind: 'top' | 'star' | 'bike';
  /** Stipendio annuo offerto ora (sale con la trattativa). */
  salary: number;
  /** Massimo che la squadra è disposta a pagare (nascosto). */
  maxSalary: number;
  years: number;
  status: 'open' | 'accepted' | 'withdrawn' | 'declined';
  rounds: { ask: number; answer: 'accepted' | 'countered' | 'withdrawn'; offer: number }[];
  /** Pilota di punta promesso (star) o costruttore e livelli di sviluppo garantiti (bike). */
  starRiderId?: string;
  manufacturerId?: string;
  upgradeLevels?: number;
}

export interface ManagerState {
  /** 0–100: cresce con i risultati oltre le attese. */
  reputation: number;
  /** Stipendio annuo dalla squadra attuale. */
  salary: number;
  /** Soldi personali del manager. */
  wallet: number;
  skills: Record<ManagerSkill, number>;
  /** Anno della stagione di cui sono già state generate le offerte. */
  offersYear: number | null;
  offers: JobOffer[];
  history: { year: number; team: string; position: number; of: number }[];
}
