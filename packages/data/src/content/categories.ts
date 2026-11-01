/** Categorie e regolamenti iniziali (REGULATIONS.md). Valori della stagione di partenza. */
import type { CategoryTier, Regulation, SessionSpec } from '../schema/world.ts';

export interface CategoryContent {
  key: CategoryTier;
  name: string;
  maxGrid: number;
  teamsManaged: boolean;
  /** Qualità media e deviazione dei piloti (scala 1–100) usate dal generatore. */
  riderQuality: { mean: number; sd: number; min: number; max: number };
  /** Età tipiche al 1° gennaio della stagione di partenza. */
  riderAgeRange: [number, number];
  /** Indici (0-based) dei round del calendario a cui partecipa la categoria; null = tutti. */
  rounds: number[] | null;
  regulation: Omit<Regulation, 'id' | 'categoryId' | 'season'>;
}

const POINTS = [25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const SPRINT = [12, 9, 7, 6, 5, 4, 3, 2, 1];
const premierWeekend: SessionSpec[] = [
  { type: 'FP', minutes: 45 },
  { type: 'PR', minutes: 60 },
  { type: 'FP', minutes: 30 },
  { type: 'Q1', minutes: 15 },
  { type: 'Q2', minutes: 15 },
  { type: 'SPRINT', laps: 13 },
  { type: 'WUP', minutes: 10 },
  { type: 'RACE', laps: 27 },
];
const lowerWeekend: SessionSpec[] = [
  { type: 'FP', minutes: 35 },
  { type: 'PR', minutes: 35 },
  { type: 'FP', minutes: 30 },
  { type: 'Q1', minutes: 15 },
  { type: 'Q2', minutes: 15 },
  { type: 'WUP', minutes: 10 },
  { type: 'RACE', laps: 20 },
];

export const CATEGORIES: CategoryContent[] = [
  {
    key: 'premier',
    name: 'MotoGP',
    maxGrid: 22,
    teamsManaged: true,
    riderQuality: { mean: 79, sd: 5, min: 68, max: 93 },
    riderAgeRange: [20, 36],
    rounds: null,
    regulation: {
      points: POINTS,
      sprintPoints: SPRINT,
      weekendFormat: premierWeekend,
      bikesPerRider: 2,
      flagToFlag: true,
      enginesPerSeason: 7,
      testBikesPerTeam: 2,
      riderAge: { min: 18, max: null },
      radioPolicy: 'dashboard',
      substitution: {
        allowed: 'yes',
        vacancyAllowed: true,
        participationFeeReductionPerRound: 45_000,
        entryDeadlineDaysBefore: 3,
      },
      inSeasonTests: { everyRounds: 5, sessions: 3 },
    },
  },
  {
    key: 'intermediate',
    name: 'Moto2',
    maxGrid: 30,
    teamsManaged: true,
    riderQuality: { mean: 69, sd: 5, min: 58, max: 84 },
    riderAgeRange: [18, 29],
    rounds: null,
    regulation: {
      points: POINTS,
      sprintPoints: [],
      weekendFormat: lowerWeekend,
      bikesPerRider: 1,
      flagToFlag: false,
      enginesPerSeason: null,
      testBikesPerTeam: 1,
      riderAge: { min: 16, max: null },
      radioPolicy: 'none',
      substitution: {
        allowed: 'yes',
        vacancyAllowed: true,
        participationFeeReductionPerRound: null,
        entryDeadlineDaysBefore: 3,
      },
      inSeasonTests: { everyRounds: null, sessions: 2 },
    },
  },
  {
    key: 'lightweight',
    name: 'Moto3',
    maxGrid: 28,
    teamsManaged: true,
    riderQuality: { mean: 61, sd: 6, min: 48, max: 78 },
    riderAgeRange: [16, 23],
    rounds: null,
    regulation: {
      points: POINTS,
      sprintPoints: [],
      weekendFormat: lowerWeekend,
      bikesPerRider: 1,
      flagToFlag: false,
      enginesPerSeason: 6,
      testBikesPerTeam: 1,
      riderAge: { min: 16, max: 28 },
      radioPolicy: 'none',
      substitution: {
        allowed: 'yes',
        vacancyAllowed: true,
        participationFeeReductionPerRound: null,
        entryDeadlineDaysBefore: 3,
      },
      inSeasonTests: { everyRounds: null, sessions: 2 },
    },
  },
  {
    key: 'rookies',
    name: 'Velocity Rookies Cup',
    maxGrid: 24,
    teamsManaged: false,
    riderQuality: { mean: 47, sd: 7, min: 32, max: 66 },
    riderAgeRange: [13, 16],
    rounds: [2, 3, 5, 6, 8, 10, 12],
    regulation: {
      points: POINTS,
      sprintPoints: [],
      weekendFormat: [
        { type: 'FP', minutes: 30 },
        { type: 'Q1', minutes: 25 },
        { type: 'RACE', laps: 14 },
        { type: 'RACE', laps: 14 },
      ],
      bikesPerRider: 1,
      flagToFlag: false,
      enginesPerSeason: null,
      testBikesPerTeam: 0,
      riderAge: { min: 13, max: 17 },
      radioPolicy: 'none',
      substitution: {
        allowed: 'organizerReserveOnly',
        vacancyAllowed: true,
        participationFeeReductionPerRound: null,
        entryDeadlineDaysBefore: 7,
      },
      inSeasonTests: { everyRounds: null, sessions: 1 },
    },
  },
];
