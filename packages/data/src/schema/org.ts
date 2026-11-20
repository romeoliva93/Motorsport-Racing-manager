import type { Credits, Id } from '@lean-angle/core';
import type { CategoryId, SeasonId } from './world.ts';
import type { RiderId, StaffId } from './people.ts';

export type ManufacturerId = Id<'mfr'>;
export type TeamId = Id<'tem'>;
export type SponsorId = Id<'spo'>;
export type TeamEntryId = Id<'ent'>;

export interface Manufacturer {
  id: ManufacturerId;
  name: string;
  country: string;
  categories: CategoryId[];
  engineeringStrength: number;
  philosophy: string;
}

/** 'organizer' = ente che iscrive direttamente i piloti (es. Velocity Rookies Cup, monomarca). */
export type TeamType = 'private' | 'independent' | 'satellite' | 'factory' | 'newManufacturer' | 'organizer';

export interface Team {
  id: TeamId;
  name: string;
  shortName: string;
  nationality: string;
  baseCity: string;
  founded: number;
  type: TeamType;
  colors: { primary: string; secondary: string; accent?: string };
  reputation: number;
  /** Proprietario: un costruttore (squadre ufficiali) o un soggetto privato. */
  owner: { kind: 'manufacturer'; manufacturerId: ManufacturerId } | { kind: 'private'; name: string };
}

/** Un posto in griglia: può essere occupato dal titolare, da un sostituto o restare vacante. */
export interface Seat {
  number: number;
  riderId: RiderId | null;
}

/** Iscrizione di una squadra a una categoria per una stagione. */
export interface TeamEntry {
  id: TeamEntryId;
  teamId: TeamId;
  categoryId: CategoryId;
  seasonId: SeasonId;
  manufacturerId: ManufacturerId;
  seats: Seat[];
}

/** Assegnazione dello staff tecnico a un pilota (TECH_TEAM.md §5). */
export interface StaffAssignment {
  teamId: TeamId;
  riderId: RiderId;
  crewChiefId: StaffId;
  trackEngineerId: StaffId;
  analystId?: StaffId;
}

export interface Sponsor {
  id: SponsorId;
  name: string;
  industry: string;
  country: string;
  budgetRange: [Credits, Credits];
}
