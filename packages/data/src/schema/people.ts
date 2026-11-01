import type { GameDay, Id } from '@lean-angle/core';
import type { CategoryId } from './world.ts';

export type PersonId = Id<'rdr'> | Id<'stf'>;
export type RiderId = Id<'rdr'>;
export type StaffId = Id<'stf'>;

export interface Personality {
  ambition: number;
  loyalty: number;
  temperament: number;
  professionalism: number;
  mediaSavvy: number;
}

interface PersonBase {
  firstName: string;
  lastName: string;
  /** Codice nazione a 3 lettere (ITA, ESP, …). */
  nationality: string;
  birthDay: GameDay;
  reputation: number;
  morale: number;
  personality: Personality;
  status: 'active' | 'free' | 'retired';
}

export const RIDER_ATTRIBUTES = [
  'speed',
  'racePace',
  'braking',
  'acceleration',
  'cornerEntry',
  'overtaking',
  'defending',
  'tyreManagement',
  'fuelManagement',
  'wet',
  'consistency',
  'aggression',
  'concentration',
  'technicalFeedback',
  'adaptability',
  'fitness',
  'mentalStrength',
] as const;
export type RiderAttribute = (typeof RIDER_ATTRIBUTES)[number];

export type RiderRole = 'race' | 'test' | 'reserve' | 'academy';

export interface Rider extends PersonBase {
  id: RiderId;
  categoryId: CategoryId | null;
  role: RiderRole;
  attributes: Record<RiderAttribute, number>;
  /** Potenziale reale (nascosto alla UI: passa solo dalle stime degli scout). */
  potential: number;
  form: number;
  fatigue: number;
  /** Solo collaudatori: capacità di sviluppo (INJURIES_AND_TESTERS.md §4). */
  developmentSkill?: number;
}

export const STAFF_ROLES = [
  'technicalDirector',
  'crewChief',
  'trackEngineer',
  'engineEngineer',
  'electronicsEngineer',
  'chassisEngineer',
  'aeroEngineer',
  'strategyChief',
  'telemetryAnalyst',
  'mechanic',
  'productionManager',
  'sportingDirector',
  'athleticTrainer',
  'physio',
  'doctor',
  'talentScout',
  'sponsorManager',
  'financeManager',
  'logisticsManager',
  'academyInstructor',
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export interface StaffMember extends PersonBase {
  id: StaffId;
  role: StaffRole;
  specialization:
    | 'engine'
    | 'electronics'
    | 'chassis'
    | 'aero'
    | 'telemetry'
    | 'trackside'
    | 'mechanics'
    | 'management'
    | 'medical';
  /** Attributi dipendenti dal ruolo (TECH_TEAM.md §3.2), 1–100. */
  skills: Record<string, number>;
  experienceYears: number;
  potential: number;
}

export type InjurySeverity = 'minor' | 'medium' | 'severe' | 'critical';

export interface Injury {
  id: Id<'inj'>;
  riderId: RiderId;
  type: string;
  severity: InjurySeverity;
  cause: 'race' | 'practice' | 'test' | 'training' | 'relapse';
  startDay: GameDay;
  recoveryDaysEstimate: [number, number];
  /** Giorno in cui il pilota sarà realmente idoneo (nascosto: la UI vede la stima). */
  actualReturnDay: GameDay;
  status: 'active' | 'healed';
}

/** Rapporto pilota–membro dello staff (TECH_TEAM.md §5). Valori 0–100. */
export interface RiderStaffBond {
  riderId: RiderId;
  staffId: StaffId;
  trust: number;
  communication: number;
  compatibility: number;
  sharedSessions: number;
  styleUnderstanding: number;
  satisfaction: number;
}
