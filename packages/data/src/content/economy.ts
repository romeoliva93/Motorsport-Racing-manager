/**
 * Parametri economici condivisi da generatore del mondo, mercato e creazione squadra.
 * Importi in euro all'anno.
 */
import type { CategoryTier } from '../schema/world.ts';
import type { TeamType } from '../schema/org.ts';

/** Stipendio annuo del pilota titolare di livello medio nella categoria. */
export const RIDER_BASE_SALARY: Record<CategoryTier, number> = {
  premier: 1_500_000,
  intermediate: 250_000,
  lightweight: 80_000,
  rookies: 0,
};

/** Crescita dello stipendio per ogni punto di valutazione sopra la media della categoria. */
export const SALARY_GROWTH_PER_POINT = 1.12;

/** Budget iniziale (min–max) per tipo di squadra e categoria. */
export const OPENING_BALANCE: Record<CategoryTier, Partial<Record<TeamType, [number, number]>>> = {
  premier: {
    factory: [60_000_000, 90_000_000],
    satellite: [25_000_000, 40_000_000],
    independent: [15_000_000, 25_000_000],
    private: [10_000_000, 15_000_000],
  },
  intermediate: {
    satellite: [6_000_000, 9_000_000],
    independent: [5_000_000, 8_000_000],
    private: [3_500_000, 5_500_000],
  },
  lightweight: {
    factory: [4_000_000, 6_000_000],
    satellite: [3_000_000, 4_500_000],
    independent: [2_500_000, 4_000_000],
    private: [1_800_000, 2_800_000],
  },
  rookies: {},
};

export const FACILITY_LEVELS: Record<TeamType, [number, number]> = {
  factory: [3, 5],
  satellite: [2, 4],
  independent: [2, 3],
  private: [1, 2],
  newManufacturer: [2, 4],
  organizer: [1, 1],
};

/** Qualità media dello staff per categoria (1–100). */
export const STAFF_QUALITY: Record<CategoryTier, number> = {
  premier: 72,
  intermediate: 64,
  lightweight: 58,
  rookies: 50,
};

/** Stipendi annui base dello staff (squadra MotoGP media); le altre categorie applicano una scala. */
export const STAFF_BASE_SALARY: Record<string, number> = {
  technicalDirector: 900_000,
  crewChief: 380_000,
  trackEngineer: 300_000,
  telemetryAnalyst: 140_000,
  strategyChief: 260_000,
  mechanic: 70_000,
  sportingDirector: 300_000,
  physio: 90_000,
  doctor: 160_000,
};
export const STAFF_SALARY_SCALE: Record<CategoryTier, number> = {
  premier: 1,
  intermediate: 0.4,
  lightweight: 0.25,
  rookies: 0.2,
};

/** Entrate mensili degli sponsor per una squadra con reputazione 70 (scalate in proporzione). */
export const SPONSOR_MONTHLY: Record<CategoryTier, number> = {
  premier: 1_200_000,
  intermediate: 220_000,
  lightweight: 90_000,
  rookies: 0,
};
/** Premio per ogni punto conquistato in gara. */
export const PRIZE_PER_POINT: Record<CategoryTier, number> = {
  premier: 12_000,
  intermediate: 2_400,
  lightweight: 900,
  rookies: 0,
};
/** Diritti commerciali per ogni Gran Premio disputato (per squadra). */
export const RACE_FEE: Record<CategoryTier, number> = {
  premier: 300_000,
  intermediate: 60_000,
  lightweight: 25_000,
  rookies: 0,
};
/** Trasferte e logistica per ogni Gran Premio (per squadra): viaggi, trasporto moto, hospitality. */
export const TRAVEL_COST: Record<CategoryTier, number> = {
  premier: 160_000,
  intermediate: 35_000,
  lightweight: 15_000,
  rookies: 0,
};
/** Costi fissi mensili di gestione (sede, officina, magazzino ricambi, utenze). */
export const RUNNING_COST_MONTHLY: Record<CategoryTier, number> = {
  premier: 560_000,
  intermediate: 105_000,
  lightweight: 46_000,
  rookies: 0,
};
