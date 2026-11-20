import type { Id } from '@lean-angle/core';
import type { CategoryId } from './world.ts';
import type { ManufacturerId, TeamId } from './org.ts';
import type { RiderId } from './people.ts';

export type BikeId = Id<'bik'>;
export type ComponentId = Id<'cmp'>;
export type FacilityId = Id<'fac'>;

export const COMPONENT_SLOTS = [
  'engine',
  'chassis',
  'swingarm',
  'suspension',
  'brakes',
  'electronics',
  'gearbox',
  'aero',
  'cooling',
  'accessories',
] as const;
export type ComponentSlot = (typeof COMPONENT_SLOTS)[number];

export interface Component {
  id: ComponentId;
  slot: ComponentSlot;
  manufacturerId: ManufacturerId;
  name: string;
  /** Valori 0–100 per le caratteristiche del componente. */
  stats: Record<string, number>;
  reliability: number;
  mileageKm: number;
  condition: number;
  status: 'available' | 'fitted' | 'broken' | 'sealed';
}

export interface Bike {
  id: BikeId;
  teamId: TeamId;
  riderId: RiderId | null;
  categoryId: CategoryId;
  /** 'B' esiste solo se il regolamento della categoria prevede 2 moto per pilota. */
  slot: 'A' | 'B';
  label: 'reference' | 'experimental' | 'dry' | 'wet' | 'test';
  components: Partial<Record<ComponentSlot, ComponentId>>;
  mileageKm: number;
  wear: number;
  readiness: number;
  availability: 'ready' | 'preparing' | 'damaged' | 'notAllowed';
  /** Chilometri percorsi da ciascun componente del garage dall'ultima revisione (assente = nuovo). */
  parts?: Partial<Record<string, { km: number; services: number }>>;
}

export const FACILITY_TYPES = [
  'engineDept',
  'chassisDept',
  'aeroDept',
  'electronicsDept',
  'factory',
  'telemetryCentre',
  'simulator',
  'medicalCentre',
  'gym',
  'academy',
  'hospitality',
  'commercialOffice',
] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

export interface Facility {
  id: FacilityId;
  teamId: TeamId;
  type: FacilityType;
  level: 1 | 2 | 3 | 4 | 5;
}
